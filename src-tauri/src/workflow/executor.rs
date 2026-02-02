use std::sync::Arc;
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager};
use thiserror::Error;
use tokio::sync::broadcast;
use uuid::Uuid;

use crate::commands::project::get_project_working_directory;
use crate::commands::workflow::WORKFLOWS;
use crate::process::manager::{AgentConfig, AgentManager, AgentStatus};
use crate::process::AGENT_REGISTRY;
use crate::state::AppState;

use super::events::{WorkflowEvent, WORKFLOW_EVENT_NAME};
use super::graph::{GraphError, WorkflowGraph};
use super::orchestrator;
use super::state::{ExecutionStatus, ExecutionStore, NodeExecutionStatus, WorkflowExecutionState};

/// Polling interval for checking agent completion
const POLL_INTERVAL_MS: u64 = 500;

/// Maximum time to wait for an agent to complete (10 minutes)
const MAX_AGENT_WAIT_MS: u64 = 600_000;

#[derive(Debug, Error)]
pub enum ExecutorError {
    #[error("Workflow not found: {0}")]
    WorkflowNotFound(String),

    #[error("Invalid workflow ID: {0}")]
    InvalidWorkflowId(String),

    #[error("Invalid project ID: {0}")]
    InvalidProjectId(String),

    #[error("Graph error: {0}")]
    GraphError(#[from] GraphError),

    #[error("Agent spawn failed: {0}")]
    AgentSpawnFailed(String),

    #[error("Execution cancelled")]
    Cancelled,

    #[error("Agent timeout: {0}")]
    AgentTimeout(String),
}

/// Workflow execution engine
pub struct WorkflowExecutor {
    app: AppHandle,
    store: Arc<ExecutionStore>,
}

impl WorkflowExecutor {
    pub fn new(app: AppHandle) -> Self {
        Self {
            app,
            store: Arc::new(ExecutionStore::new()),
        }
    }

    /// Start executing a workflow
    pub fn execute(
        &self,
        workflow_id: &str,
        project_id: &str,
        input_prompt: String,
    ) -> Result<Uuid, ExecutorError> {
        // Parse IDs
        let workflow_uuid = Uuid::parse_str(workflow_id)
            .map_err(|_| ExecutorError::InvalidWorkflowId(workflow_id.to_string()))?;
        let project_uuid = Uuid::parse_str(project_id)
            .map_err(|_| ExecutorError::InvalidProjectId(project_id.to_string()))?;

        // Get workflow from storage
        let workflow = WORKFLOWS
            .get(&workflow_uuid)
            .ok_or_else(|| ExecutorError::WorkflowNotFound(workflow_id.to_string()))?;

        let workflow_name = workflow.name.clone();
        let graph_json = workflow.graph.clone();
        drop(workflow); // Release the lock

        // Parse the graph
        let graph = WorkflowGraph::from_json(&graph_json)?;

        // Guard against empty graphs
        if graph.is_empty() {
            return Err(ExecutorError::GraphError(super::graph::GraphError::InvalidFormat(
                "Workflow graph has no nodes".to_string(),
            )));
        }

        // Compute execution levels
        let execution_levels = graph.compute_execution_levels()?;

        // Create execution ID
        let execution_id = Uuid::new_v4();

        // Create execution state
        let state = WorkflowExecutionState::new(
            execution_id,
            workflow_uuid,
            project_uuid,
            input_prompt.clone(),
            execution_levels.clone(),
        );

        // Store execution state
        let execution_state = self.store.insert(state);

        // Emit execution started event
        let total_nodes = graph.node_count();
        self.emit_event(WorkflowEvent::ExecutionStarted {
            execution_id: execution_id.to_string(),
            workflow_id: workflow_uuid.to_string(),
            workflow_name,
            total_nodes,
        });

        // Clone what we need for the async task
        let app = self.app.clone();
        let store = self.store.clone();

        // Spawn the execution task
        tokio::spawn(async move {
            run_execution(app, store, execution_state, graph, input_prompt).await;
        });

        Ok(execution_id)
    }

    /// Start an orchestrated workflow execution
    /// The orchestrator creates a plan, then we execute the dynamically generated graph
    pub fn execute_orchestrated(
        &self,
        project_id: &str,
        input_prompt: String,
    ) -> Result<Uuid, ExecutorError> {
        let project_uuid = Uuid::parse_str(project_id)
            .map_err(|_| ExecutorError::InvalidProjectId(project_id.to_string()))?;

        let execution_id = Uuid::new_v4();

        // Emit execution started event (orchestrator mode)
        self.emit_event(WorkflowEvent::ExecutionStarted {
            execution_id: execution_id.to_string(),
            workflow_id: "orchestrated".to_string(),
            workflow_name: "Orchestrated Workflow".to_string(),
            total_nodes: 1, // Just orchestrator initially
        });

        let app = self.app.clone();
        let store = self.store.clone();
        let exec_id = execution_id;

        tokio::spawn(async move {
            run_orchestrated_execution(app, store, exec_id, project_uuid, input_prompt).await;
        });

        Ok(execution_id)
    }

    /// Cancel a running execution
    pub fn cancel(&self, execution_id: &Uuid) -> bool {
        if let Some(state) = self.store.get(execution_id) {
            state.cancel();
            true
        } else {
            false
        }
    }

    /// Get execution status
    pub fn get_status(&self, execution_id: &Uuid) -> Option<super::state::ExecutionSummary> {
        self.store
            .get(execution_id)
            .map(|state| super::state::ExecutionSummary::from(state.as_ref()))
    }

    /// Get the execution store
    pub fn store(&self) -> &Arc<ExecutionStore> {
        &self.store
    }

    fn emit_event(&self, event: WorkflowEvent) {
        let _ = self.app.emit(WORKFLOW_EVENT_NAME, &event);
    }
}

/// Main execution loop (runs in spawned task)
async fn run_execution(
    app: AppHandle,
    _store: Arc<ExecutionStore>,
    state: Arc<WorkflowExecutionState>,
    graph: WorkflowGraph,
    input_prompt: String,
) {
    let execution_id = state.execution_id;
    let workflow_id = state.workflow_id;

    // Mark as running
    state.set_status(ExecutionStatus::Running);

    // Get cancellation receiver
    let mut cancel_rx = state.subscribe_cancel();

    // Track failed nodes for skipping dependents
    let mut failed_nodes: std::collections::HashSet<String> = std::collections::HashSet::new();

    let start_time = std::time::Instant::now();

    // Execute level by level
    for (level_idx, level_node_ids) in state.execution_levels.iter().enumerate() {
        // Check for cancellation before starting level
        if cancel_rx.try_recv().is_ok() {
            log::info!("Execution {} cancelled before level {}", execution_id, level_idx);
            emit_event(
                &app,
                WorkflowEvent::ExecutionCancelled {
                    execution_id: execution_id.to_string(),
                    workflow_id: workflow_id.to_string(),
                },
            );
            return;
        }

        // Determine which nodes to run vs skip
        let mut nodes_to_run = Vec::new();
        let mut nodes_to_skip = Vec::new();

        for node_id in level_node_ids {
            // Check if any predecessor failed
            let deps = graph.get_dependencies(node_id);
            let has_failed_dep = deps.iter().any(|dep| failed_nodes.contains(dep));

            if has_failed_dep {
                nodes_to_skip.push(node_id.clone());
            } else {
                nodes_to_run.push(node_id.clone());
            }
        }

        // Skip nodes with failed dependencies
        for node_id in &nodes_to_skip {
            state.update_node_state(node_id, |ns| {
                ns.skip("Dependency failed".to_string());
            });

            emit_event(
                &app,
                WorkflowEvent::NodeSkipped {
                    execution_id: execution_id.to_string(),
                    node_id: node_id.clone(),
                    reason: "Dependency failed".to_string(),
                },
            );
        }

        if nodes_to_run.is_empty() {
            continue;
        }

        // Emit level started event
        emit_event(
            &app,
            WorkflowEvent::LevelStarted {
                execution_id: execution_id.to_string(),
                level: level_idx,
                node_ids: nodes_to_run.clone(),
            },
        );

        // Spawn all nodes in this level concurrently
        let mut handles = Vec::new();

        for node_id in nodes_to_run {
            let node = match graph.get_node(&node_id) {
                Some(n) => n.clone(),
                None => continue,
            };

            let app_clone = app.clone();
            let state_clone = state.clone();
            let execution_id_str = execution_id.to_string();
            let input = input_prompt.clone();
            let cancel_rx = state.subscribe_cancel();

            let handle = tokio::spawn(async move {
                spawn_node_execution(
                    app_clone,
                    state_clone,
                    execution_id_str,
                    node.id.clone(),
                    node.agent_role.clone(),
                    node.system_prompt.clone(),
                    node.assigned_task.clone().or(Some(input)),
                    cancel_rx,
                )
                .await
            });

            handles.push((node_id, handle));
        }

        // Wait for all nodes in this level to complete
        for (node_id, handle) in handles {
            match handle.await {
                Ok(Ok(())) => {
                    // Node completed successfully
                }
                Ok(Err(e)) => {
                    log::error!("Node {} failed: {}", node_id, e);
                    failed_nodes.insert(node_id);
                }
                Err(e) => {
                    log::error!("Node {} task panicked: {}", node_id, e);
                    failed_nodes.insert(node_id);
                }
            }
        }

        // Emit level completed event
        emit_event(
            &app,
            WorkflowEvent::LevelCompleted {
                execution_id: execution_id.to_string(),
                level: level_idx,
            },
        );

        // Emit progress update
        emit_event(
            &app,
            WorkflowEvent::ProgressUpdate {
                execution_id: execution_id.to_string(),
                completed_nodes: state.completed_nodes(),
                total_nodes: state.total_nodes(),
                progress_percent: state.get_overall_progress(),
            },
        );
    }

    let duration_ms = start_time.elapsed().as_millis() as u64;

    // Determine final status
    if failed_nodes.is_empty() {
        state.set_status(ExecutionStatus::Completed);
        emit_event(
            &app,
            WorkflowEvent::ExecutionCompleted {
                execution_id: execution_id.to_string(),
                workflow_id: workflow_id.to_string(),
                duration_ms,
            },
        );
        log::info!(
            "Workflow execution {} completed successfully in {}ms",
            execution_id,
            duration_ms
        );
    } else {
        state.set_status(ExecutionStatus::Failed);
        let failed_list: Vec<String> = failed_nodes.into_iter().collect();
        emit_event(
            &app,
            WorkflowEvent::ExecutionFailed {
                execution_id: execution_id.to_string(),
                workflow_id: workflow_id.to_string(),
                error: format!("{} node(s) failed", failed_list.len()),
                failed_nodes: failed_list,
            },
        );
        log::warn!(
            "Workflow execution {} failed after {}ms",
            execution_id,
            duration_ms
        );
    }
}

/// Run an orchestrated execution - orchestrator creates the plan, then we execute it
async fn run_orchestrated_execution(
    app: AppHandle,
    store: Arc<ExecutionStore>,
    execution_id: Uuid,
    project_id: Uuid,
    input_prompt: String,
) {
    let execution_id_str = execution_id.to_string();

    // Phase 1: Run orchestrator to create a plan
    emit_event(
        &app,
        WorkflowEvent::NodeStatusChanged {
            execution_id: execution_id_str.clone(),
            node_id: "orchestrator".to_string(),
            status: NodeExecutionStatus::Running,
            progress: 0,
            agent_id: None,
            error: None,
        },
    );

    log::info!("Starting orchestrator planning phase for execution {}", execution_id);

    let plan = match orchestrator::run_orchestrator_planning(
        &app,
        &execution_id_str,
        project_id,
        &input_prompt,
    )
    .await
    {
        Ok(plan) => {
            emit_event(
                &app,
                WorkflowEvent::NodeCompleted {
                    execution_id: execution_id_str.clone(),
                    node_id: "orchestrator".to_string(),
                    output: Some(plan.project_summary.clone()),
                },
            );
            plan
        }
        Err(e) => {
            log::error!("Orchestrator planning failed: {}", e);
            emit_event(
                &app,
                WorkflowEvent::NodeFailed {
                    execution_id: execution_id_str.clone(),
                    node_id: "orchestrator".to_string(),
                    error: e.clone(),
                },
            );
            emit_event(
                &app,
                WorkflowEvent::ExecutionFailed {
                    execution_id: execution_id_str,
                    workflow_id: "orchestrated".to_string(),
                    error: format!("Orchestrator planning failed: {}", e),
                    failed_nodes: vec!["orchestrator".to_string()],
                },
            );
            return;
        }
    };

    // Phase 2: Convert plan to graph
    let graph = orchestrator::plan_to_graph(&plan);

    // Emit the dynamic graph to frontend
    orchestrator::emit_dynamic_graph_events(&app, &execution_id_str, &graph);

    // Compute execution levels
    let execution_levels = match graph.compute_execution_levels() {
        Ok(levels) => levels,
        Err(e) => {
            log::error!("Failed to compute execution levels: {}", e);
            emit_event(
                &app,
                WorkflowEvent::ExecutionFailed {
                    execution_id: execution_id_str,
                    workflow_id: "orchestrated".to_string(),
                    error: format!("Invalid plan graph: {}", e),
                    failed_nodes: vec![],
                },
            );
            return;
        }
    };

    // Create execution state for the dynamic workflow
    let state = WorkflowExecutionState::new(
        execution_id,
        Uuid::nil(), // No static workflow ID for orchestrated
        project_id,
        input_prompt.clone(),
        execution_levels,
    );

    let execution_state = store.insert(state);

    // Emit updated node count
    emit_event(
        &app,
        WorkflowEvent::ProgressUpdate {
            execution_id: execution_id_str.clone(),
            completed_nodes: 1, // Orchestrator done
            total_nodes: graph.node_count() + 1, // +1 for orchestrator
            progress_percent: (100 / (graph.node_count() + 1)) as u8,
        },
    );

    log::info!(
        "Orchestrator created plan with {} tasks, starting execution",
        graph.node_count()
    );

    // Phase 3: Execute the dynamic graph
    run_execution(app, store, execution_state, graph, input_prompt).await;
}

/// Execute a single node by spawning an agent
async fn spawn_node_execution(
    app: AppHandle,
    state: Arc<WorkflowExecutionState>,
    execution_id: String,
    node_id: String,
    agent_role: String,
    system_prompt: Option<String>,
    assigned_task: Option<String>,
    mut cancel_rx: broadcast::Receiver<()>,
) -> Result<(), ExecutorError> {
    // Get app state for agent management
    let app_state: tauri::State<'_, Arc<AppState>> = app.state();

    // Get working directory from project, or use current directory as fallback
    let working_directory = get_project_working_directory(&state.project_id)
        .unwrap_or_else(|| {
            std::env::current_dir()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|_| ".".to_string())
        });

    // Create agent config
    let config = AgentConfig {
        name: format!("workflow-{}-{}", &execution_id[..8], node_id),
        role: agent_role,
        working_directory,
        project_id: Some(state.project_id),
        system_prompt,
        assigned_task,
    };

    // Create agent manager and spawn agent
    let manager = AgentManager::new(app.clone());

    let agent_info = manager
        .spawn_agent(config)
        .map_err(|e| ExecutorError::AgentSpawnFailed(e))?;

    let agent_id = agent_info.id;

    // Update node state
    state.update_node_state(&node_id, |ns| {
        ns.start(agent_id);
    });

    // Store agent in app state
    app_state.agents.insert(agent_id, agent_info);

    // Emit node started event
    emit_event(
        &app,
        WorkflowEvent::NodeStarted {
            execution_id: execution_id.clone(),
            node_id: node_id.clone(),
            agent_id: agent_id.to_string(),
        },
    );

    emit_event(
        &app,
        WorkflowEvent::NodeStatusChanged {
            execution_id: execution_id.clone(),
            node_id: node_id.clone(),
            status: NodeExecutionStatus::Running,
            progress: 0,
            agent_id: Some(agent_id.to_string()),
            error: None,
        },
    );

    // Wait for agent completion
    let result = wait_for_agent_completion(&app, agent_id, &mut cancel_rx).await;

    match result {
        Ok(output) => {
            state.update_node_state(&node_id, |ns| {
                ns.complete(output.clone());
            });

            emit_event(
                &app,
                WorkflowEvent::NodeCompleted {
                    execution_id: execution_id.clone(),
                    node_id: node_id.clone(),
                    output,
                },
            );

            emit_event(
                &app,
                WorkflowEvent::NodeStatusChanged {
                    execution_id,
                    node_id,
                    status: NodeExecutionStatus::Completed,
                    progress: 100,
                    agent_id: Some(agent_id.to_string()),
                    error: None,
                },
            );

            Ok(())
        }
        Err(e) => {
            let error_msg = e.to_string();

            state.update_node_state(&node_id, |ns| {
                ns.fail(error_msg.clone());
            });

            emit_event(
                &app,
                WorkflowEvent::NodeFailed {
                    execution_id: execution_id.clone(),
                    node_id: node_id.clone(),
                    error: error_msg.clone(),
                },
            );

            emit_event(
                &app,
                WorkflowEvent::NodeStatusChanged {
                    execution_id,
                    node_id,
                    status: NodeExecutionStatus::Failed,
                    progress: 0,
                    agent_id: Some(agent_id.to_string()),
                    error: Some(error_msg.clone()),
                },
            );

            Err(e)
        }
    }
}

/// Poll agent status until completion or timeout
async fn wait_for_agent_completion(
    app: &AppHandle,
    agent_id: Uuid,
    cancel_rx: &mut broadcast::Receiver<()>,
) -> Result<Option<String>, ExecutorError> {
    let app_state: tauri::State<'_, Arc<AppState>> = app.state();
    let start = std::time::Instant::now();

    loop {
        // Check for cancellation
        if cancel_rx.try_recv().is_ok() {
            // Kill the agent process via registry
            AGENT_REGISTRY.kill(&agent_id);
            // Update status in app state
            if let Some(mut agent) = app_state.agents.get_mut(&agent_id) {
                agent.status = AgentStatus::Killed;
            }
            return Err(ExecutorError::Cancelled);
        }

        // Check agent status
        if let Some(agent) = app_state.agents.get(&agent_id) {
            match agent.status {
                AgentStatus::Completed => {
                    return Ok(None); // Agent output is streamed via events
                }
                AgentStatus::Failed => {
                    return Err(ExecutorError::AgentSpawnFailed(
                        "Agent execution failed".to_string(),
                    ));
                }
                AgentStatus::Killed => {
                    return Err(ExecutorError::Cancelled);
                }
                _ => {
                    // Still running, continue polling
                }
            }
        } else {
            // Agent not found - assume completed
            return Ok(None);
        }

        // Check timeout
        if start.elapsed().as_millis() as u64 > MAX_AGENT_WAIT_MS {
            return Err(ExecutorError::AgentTimeout(format!(
                "Agent {} did not complete within {} seconds",
                agent_id,
                MAX_AGENT_WAIT_MS / 1000
            )));
        }

        // Wait before next poll
        tokio::time::sleep(Duration::from_millis(POLL_INTERVAL_MS)).await;
    }
}

fn emit_event(app: &AppHandle, event: WorkflowEvent) {
    let _ = app.emit(WORKFLOW_EVENT_NAME, &event);
}
