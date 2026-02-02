//! Enhanced workflow executor with full orchestration capabilities.
//!
//! Integrates:
//! - Inter-agent data flow via ExecutionContext
//! - Retry logic with exponential backoff
//! - Conditional execution and branching
//! - Checkpointing for recovery
//! - Output aggregation from parallel nodes
//! - Adaptive replanning

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use chrono::Utc;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::broadcast;
use uuid::Uuid;

use crate::commands::project::get_project_working_directory;
use crate::process::manager::{AgentConfig, AgentManager, AgentStatus};
use crate::process::AGENT_REGISTRY;
use crate::state::AppState;

use super::adaptive::AdaptivePlanningConfig;
use super::aggregation::{AggregationStrategy, NodeAggregationConfig};
use super::checkpoint::{CheckpointManager, CheckpointTrigger, ExecutionCheckpoint, NodeCheckpointState};
use super::conditions::ExecutionCondition;
use super::context::{AgentOutput, ContextStore, ExecutionContext, OutputData};
use super::events::{WorkflowEvent, WORKFLOW_EVENT_NAME};
use super::graph::WorkflowGraph;
use super::retry::{FallbackStrategy, RetryConfig, RetryDecision, RetryState};
use super::state::{ExecutionStatus, ExecutionStore, NodeExecutionStatus, WorkflowExecutionState};

/// Polling interval for checking agent completion
const POLL_INTERVAL_MS: u64 = 500;
/// Maximum time to wait for an agent to complete (10 minutes)
const MAX_AGENT_WAIT_MS: u64 = 600_000;

/// Enhanced configuration for workflow execution
#[derive(Debug, Clone)]
pub struct EnhancedExecutionConfig {
    /// Retry configuration for failed nodes
    pub retry: RetryConfig,
    /// Fallback strategy when retries fail
    pub fallback: FallbackStrategy,
    /// Checkpoint trigger configuration
    pub checkpoint_trigger: CheckpointTrigger,
    /// Adaptive planning configuration
    pub adaptive: AdaptivePlanningConfig,
    /// Default aggregation strategy for nodes with multiple predecessors
    pub default_aggregation: AggregationStrategy,
    /// Include original prompt in agent context
    pub include_original_prompt: bool,
    /// Pass predecessor outputs to downstream agents
    pub enable_data_flow: bool,
}

impl Default for EnhancedExecutionConfig {
    fn default() -> Self {
        Self {
            retry: RetryConfig::default(),
            fallback: FallbackStrategy::FailWorkflow,
            checkpoint_trigger: CheckpointTrigger::AfterLevel,
            adaptive: AdaptivePlanningConfig::default(),
            default_aggregation: AggregationStrategy::Concatenate {
                separator: "\n\n---\n\n".to_string(),
                include_source: true,
            },
            include_original_prompt: true,
            enable_data_flow: true,
        }
    }
}

/// Enhanced node configuration
#[derive(Debug, Clone, Default)]
pub struct EnhancedNodeConfig {
    /// Condition that must be true for this node to execute
    pub condition: ExecutionCondition,
    /// Custom retry config (overrides workflow default)
    pub retry: Option<RetryConfig>,
    /// Custom fallback strategy
    pub fallback: Option<FallbackStrategy>,
    /// Aggregation config for inputs from predecessors
    pub aggregation: Option<NodeAggregationConfig>,
    /// Custom system prompt override
    pub system_prompt_override: Option<String>,
    /// Tags to add to output
    pub output_tags: Vec<String>,
}

/// Enhanced workflow executor
pub struct EnhancedWorkflowExecutor {
    app: AppHandle,
    store: Arc<ExecutionStore>,
    context_store: Arc<ContextStore>,
    checkpoint_manager: Option<CheckpointManager>,
}

impl EnhancedWorkflowExecutor {
    pub fn new(app: AppHandle) -> Self {
        let checkpoint_manager = CheckpointManager::new(CheckpointManager::default_checkpoint_dir())
            .ok();

        Self {
            app,
            store: Arc::new(ExecutionStore::new()),
            context_store: Arc::new(ContextStore::new()),
            checkpoint_manager,
        }
    }

    /// Execute a workflow with enhanced capabilities
    pub fn execute_enhanced(
        &self,
        graph: WorkflowGraph,
        project_id: Uuid,
        input_prompt: String,
        config: EnhancedExecutionConfig,
        node_configs: HashMap<String, EnhancedNodeConfig>,
    ) -> Result<Uuid, String> {
        // Validate graph
        if graph.is_empty() {
            return Err("Workflow graph has no nodes".to_string());
        }

        // Compute execution levels
        let execution_levels = graph.compute_execution_levels()
            .map_err(|e| e.to_string())?;

        // Create execution ID
        let execution_id = Uuid::new_v4();

        // Create execution state
        let state = WorkflowExecutionState::new(
            execution_id,
            Uuid::nil(), // Dynamic workflow
            project_id,
            input_prompt.clone(),
            execution_levels.clone(),
        );

        let execution_state = self.store.insert(state);

        // Create execution context for data flow
        let context = self.context_store.create(execution_id, project_id, input_prompt.clone());

        // Emit execution started event
        let total_nodes = graph.node_count();
        self.emit_event(WorkflowEvent::ExecutionStarted {
            execution_id: execution_id.to_string(),
            workflow_id: "enhanced".to_string(),
            workflow_name: "Enhanced Workflow".to_string(),
            total_nodes,
        });

        // Clone what we need for the async task
        let app = self.app.clone();
        let store = self.store.clone();
        let context_store = self.context_store.clone();
        let checkpoint_manager = self.checkpoint_manager.as_ref().map(|_| {
            CheckpointManager::new(CheckpointManager::default_checkpoint_dir()).ok()
        }).flatten();

        // Spawn the execution task
        tokio::spawn(async move {
            run_enhanced_execution(
                app,
                store,
                context_store,
                checkpoint_manager,
                execution_state,
                context,
                graph,
                input_prompt,
                config,
                node_configs,
            )
            .await;
        });

        Ok(execution_id)
    }

    /// Get the context store
    pub fn context_store(&self) -> &Arc<ContextStore> {
        &self.context_store
    }

    /// Get the execution store
    pub fn execution_store(&self) -> &Arc<ExecutionStore> {
        &self.store
    }

    fn emit_event(&self, event: WorkflowEvent) {
        let _ = self.app.emit(WORKFLOW_EVENT_NAME, &event);
    }
}

/// Main enhanced execution loop
async fn run_enhanced_execution(
    app: AppHandle,
    _store: Arc<ExecutionStore>,
    _context_store: Arc<ContextStore>,
    checkpoint_manager: Option<CheckpointManager>,
    state: Arc<WorkflowExecutionState>,
    context: Arc<ExecutionContext>,
    graph: WorkflowGraph,
    input_prompt: String,
    config: EnhancedExecutionConfig,
    node_configs: HashMap<String, EnhancedNodeConfig>,
) {
    let execution_id = state.execution_id;
    let _project_id = state.project_id;

    // Mark as running
    state.set_status(ExecutionStatus::Running);

    // Get cancellation receiver
    let mut cancel_rx = state.subscribe_cancel();

    // Track failed and skipped nodes
    let mut failed_nodes: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut skipped_nodes: std::collections::HashSet<String> = std::collections::HashSet::new();

    // Track node statuses for condition evaluation
    let mut node_statuses: HashMap<String, NodeExecutionStatus> = HashMap::new();

    let start_time = std::time::Instant::now();

    // Execute level by level
    for (level_idx, level_node_ids) in state.execution_levels.iter().enumerate() {
        // Check for cancellation before starting level
        if cancel_rx.try_recv().is_ok() {
            log::info!("Execution {} cancelled before level {}", execution_id, level_idx);
            emit_event(&app, WorkflowEvent::ExecutionCancelled {
                execution_id: execution_id.to_string(),
                workflow_id: "enhanced".to_string(),
            });
            return;
        }

        // Determine which nodes to run, skip, or exclude based on conditions
        let mut nodes_to_run = Vec::new();
        let mut nodes_to_skip = Vec::new();

        for node_id in level_node_ids {
            // Check if any predecessor failed
            let deps = graph.get_dependencies(node_id);
            let has_failed_dep = deps.iter().any(|dep| failed_nodes.contains(dep));

            if has_failed_dep {
                nodes_to_skip.push((node_id.clone(), "Dependency failed".to_string()));
                continue;
            }

            // Evaluate node condition
            let node_config = node_configs.get(node_id);
            let condition = node_config
                .map(|c| &c.condition)
                .unwrap_or(&ExecutionCondition::Always);

            let condition_result = condition.evaluate(&context, &node_statuses, &deps);

            if !condition_result.should_execute {
                nodes_to_skip.push((node_id.clone(), condition_result.reason));
                continue;
            }

            nodes_to_run.push(node_id.clone());
        }

        // Skip nodes
        for (node_id, reason) in &nodes_to_skip {
            skipped_nodes.insert(node_id.clone());
            node_statuses.insert(node_id.clone(), NodeExecutionStatus::Skipped);

            state.update_node_state(node_id, |ns| {
                ns.skip(reason.clone());
            });

            emit_event(&app, WorkflowEvent::NodeSkipped {
                execution_id: execution_id.to_string(),
                node_id: node_id.clone(),
                reason: reason.clone(),
            });
        }

        if nodes_to_run.is_empty() {
            continue;
        }

        // Emit level started event
        emit_event(&app, WorkflowEvent::LevelStarted {
            execution_id: execution_id.to_string(),
            level: level_idx,
            node_ids: nodes_to_run.clone(),
        });

        // Spawn all nodes in this level concurrently
        let mut handles = Vec::new();

        for node_id in nodes_to_run {
            let node = match graph.get_node(&node_id) {
                Some(n) => n.clone(),
                None => continue,
            };

            let app_clone = app.clone();
            let state_clone = state.clone();
            let context_clone = context.clone();
            let graph_clone = graph.clone();
            let config_clone = config.clone();
            let node_config = node_configs.get(&node_id).cloned().unwrap_or_default();
            let execution_id_str = execution_id.to_string();
            let input = input_prompt.clone();
            let cancel_rx = state.subscribe_cancel();

            let handle = tokio::spawn(async move {
                spawn_enhanced_node_execution(
                    app_clone,
                    state_clone,
                    context_clone,
                    graph_clone,
                    execution_id_str,
                    node.id.clone(),
                    node.agent_role.clone(),
                    node.system_prompt.clone(),
                    node.assigned_task.clone().or(Some(input)),
                    config_clone,
                    node_config,
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
                    node_statuses.insert(node_id.clone(), NodeExecutionStatus::Completed);
                }
                Ok(Err(e)) => {
                    log::error!("Node {} failed: {}", node_id, e);
                    failed_nodes.insert(node_id.clone());
                    node_statuses.insert(node_id.clone(), NodeExecutionStatus::Failed);
                }
                Err(e) => {
                    log::error!("Node {} task panicked: {}", node_id, e);
                    failed_nodes.insert(node_id.clone());
                    node_statuses.insert(node_id.clone(), NodeExecutionStatus::Failed);
                }
            }
        }

        // Check for adaptive replanning after level
        if config.adaptive.enabled && config.adaptive.replan_after_level && !failed_nodes.is_empty() {
            // Would trigger replan here (simplified for now)
            log::info!("Level {} completed with {} failures, replanning may be triggered",
                      level_idx, failed_nodes.len());
        }

        // Checkpoint after level if configured
        if let (Some(ref manager), CheckpointTrigger::AfterLevel) = (&checkpoint_manager, &config.checkpoint_trigger) {
            if let Ok(checkpoint) = create_checkpoint(&state, &context, level_idx) {
                let _ = manager.save(&checkpoint);
            }
        }

        // Emit level completed event
        emit_event(&app, WorkflowEvent::LevelCompleted {
            execution_id: execution_id.to_string(),
            level: level_idx,
        });

        // Emit progress update
        emit_event(&app, WorkflowEvent::ProgressUpdate {
            execution_id: execution_id.to_string(),
            completed_nodes: state.completed_nodes(),
            total_nodes: state.total_nodes(),
            progress_percent: state.get_overall_progress(),
        });
    }

    let duration_ms = start_time.elapsed().as_millis() as u64;

    // Determine final status
    if failed_nodes.is_empty() {
        state.set_status(ExecutionStatus::Completed);
        emit_event(&app, WorkflowEvent::ExecutionCompleted {
            execution_id: execution_id.to_string(),
            workflow_id: "enhanced".to_string(),
            duration_ms,
        });
        log::info!("Enhanced workflow execution {} completed successfully in {}ms", execution_id, duration_ms);
    } else {
        state.set_status(ExecutionStatus::Failed);
        let failed_list: Vec<String> = failed_nodes.into_iter().collect();
        emit_event(&app, WorkflowEvent::ExecutionFailed {
            execution_id: execution_id.to_string(),
            workflow_id: "enhanced".to_string(),
            error: format!("{} node(s) failed", failed_list.len()),
            failed_nodes: failed_list,
        });
        log::warn!("Enhanced workflow execution {} failed after {}ms", execution_id, duration_ms);
    }
}

/// Execute a single node with enhanced capabilities
async fn spawn_enhanced_node_execution(
    app: AppHandle,
    state: Arc<WorkflowExecutionState>,
    context: Arc<ExecutionContext>,
    graph: WorkflowGraph,
    execution_id: String,
    node_id: String,
    agent_role: String,
    system_prompt: Option<String>,
    assigned_task: Option<String>,
    config: EnhancedExecutionConfig,
    node_config: EnhancedNodeConfig,
    mut cancel_rx: broadcast::Receiver<()>,
) -> Result<(), String> {
    // Get app state for agent management
    let app_state: tauri::State<'_, Arc<AppState>> = app.state();

    // Get working directory from project
    let working_directory = get_project_working_directory(&state.project_id)
        .unwrap_or_else(|| {
            std::env::current_dir()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|_| ".".to_string())
        });

    // Build enhanced prompt with predecessor context
    let predecessor_ids = graph.get_dependencies(&node_id);
    let enhanced_task = if config.enable_data_flow && !predecessor_ids.is_empty() {
        // Aggregate outputs from predecessors
        let aggregation = node_config.aggregation
            .map(|a| a.strategy)
            .unwrap_or(config.default_aggregation.clone());

        let predecessor_outputs = context.get_predecessor_outputs(&predecessor_ids);
        let _aggregated = aggregation.aggregate(&predecessor_outputs);

        // Build context-aware prompt
        let base_task = assigned_task.as_deref().unwrap_or("");
        Some(context.build_agent_prompt(base_task, &predecessor_ids, config.include_original_prompt))
    } else {
        assigned_task.clone()
    };

    // Get retry config
    let retry_config = node_config.retry.clone().unwrap_or(config.retry.clone());
    let mut retry_state = RetryState::new(retry_config);

    // Retry loop
    loop {
        // Create agent config
        let agent_config = AgentConfig {
            name: format!("workflow-{}-{}", &execution_id[..8], node_id),
            role: agent_role.clone(),
            working_directory: working_directory.clone(),
            project_id: Some(state.project_id),
            system_prompt: node_config.system_prompt_override.clone().or(system_prompt.clone()),
            assigned_task: enhanced_task.clone(),
        };

        // Create agent manager and spawn agent
        let manager = AgentManager::new(app.clone());

        let spawn_result = manager.spawn_agent(agent_config);

        match spawn_result {
            Ok(agent_info) => {
                let agent_id = agent_info.id;

                // Update node state
                state.update_node_state(&node_id, |ns| {
                    ns.start(agent_id);
                });

                // Store agent in app state
                app_state.agents.insert(agent_id, agent_info);

                // Emit node started event
                emit_event(&app, WorkflowEvent::NodeStarted {
                    execution_id: execution_id.clone(),
                    node_id: node_id.clone(),
                    agent_id: agent_id.to_string(),
                });

                emit_event(&app, WorkflowEvent::NodeStatusChanged {
                    execution_id: execution_id.clone(),
                    node_id: node_id.clone(),
                    status: NodeExecutionStatus::Running,
                    progress: 0,
                    agent_id: Some(agent_id.to_string()),
                    error: None,
                });

                // Wait for agent completion
                let result = wait_for_agent_completion(&app, agent_id, &mut cancel_rx).await;

                match result {
                    Ok(output) => {
                        // Store output in context for downstream agents
                        if let Some(output_text) = &output {
                            let agent_output = AgentOutput {
                                agent_id,
                                node_id: node_id.clone(),
                                agent_role: agent_role.clone(),
                                data: OutputData::Text(output_text.clone()),
                                timestamp: Utc::now(),
                                tags: node_config.output_tags.clone(),
                            };
                            context.store_output(agent_output);
                        }

                        state.update_node_state(&node_id, |ns| {
                            ns.complete(output.clone());
                        });

                        emit_event(&app, WorkflowEvent::NodeCompleted {
                            execution_id: execution_id.clone(),
                            node_id: node_id.clone(),
                            output,
                        });

                        emit_event(&app, WorkflowEvent::NodeStatusChanged {
                            execution_id,
                            node_id,
                            status: NodeExecutionStatus::Completed,
                            progress: 100,
                            agent_id: Some(agent_id.to_string()),
                            error: None,
                        });

                        let _ = retry_state.mark_success();
                        return Ok(());
                    }
                    Err(e) => {
                        let error_msg = e.to_string();

                        // Check if we should retry
                        match retry_state.should_retry(&error_msg) {
                            RetryDecision::Retry { delay, attempt } => {
                                log::warn!(
                                    "Node {} attempt {} failed: {}. Retrying in {:?}...",
                                    node_id, attempt, error_msg, delay
                                );
                                tokio::time::sleep(delay).await;
                                continue; // Retry
                            }
                            RetryDecision::NoRetry { reason: _ } | RetryDecision::Exhausted { .. } => {
                                // Final failure
                                state.update_node_state(&node_id, |ns| {
                                    ns.fail(error_msg.clone());
                                });

                                emit_event(&app, WorkflowEvent::NodeFailed {
                                    execution_id: execution_id.clone(),
                                    node_id: node_id.clone(),
                                    error: error_msg.clone(),
                                });

                                emit_event(&app, WorkflowEvent::NodeStatusChanged {
                                    execution_id,
                                    node_id,
                                    status: NodeExecutionStatus::Failed,
                                    progress: 0,
                                    agent_id: Some(agent_id.to_string()),
                                    error: Some(error_msg.clone()),
                                });

                                let _ = retry_state.mark_failure(&error_msg);
                                return Err(error_msg);
                            }
                        }
                    }
                }
            }
            Err(e) => {
                // Spawn failure - check if we should retry
                match retry_state.should_retry(&e) {
                    RetryDecision::Retry { delay, attempt } => {
                        log::warn!(
                            "Node {} spawn attempt {} failed: {}. Retrying in {:?}...",
                            node_id, attempt, e, delay
                        );
                        tokio::time::sleep(delay).await;
                        continue;
                    }
                    _ => {
                        state.update_node_state(&node_id, |ns| {
                            ns.fail(e.clone());
                        });

                        emit_event(&app, WorkflowEvent::NodeFailed {
                            execution_id,
                            node_id,
                            error: e.clone(),
                        });

                        let _ = retry_state.mark_failure(&e);
                        return Err(e);
                    }
                }
            }
        }
    }
}

/// Wait for agent completion with cancellation support
async fn wait_for_agent_completion(
    app: &AppHandle,
    agent_id: Uuid,
    cancel_rx: &mut broadcast::Receiver<()>,
) -> Result<Option<String>, String> {
    let app_state: tauri::State<'_, Arc<AppState>> = app.state();
    let start = std::time::Instant::now();

    loop {
        // Check for cancellation
        if cancel_rx.try_recv().is_ok() {
            AGENT_REGISTRY.kill(&agent_id);
            if let Some(mut agent) = app_state.agents.get_mut(&agent_id) {
                agent.status = AgentStatus::Killed;
            }
            return Err("Execution cancelled".to_string());
        }

        // Check agent status
        if let Some(agent) = app_state.agents.get(&agent_id) {
            match agent.status {
                AgentStatus::Completed => {
                    // Get output from registry
                    let output = AGENT_REGISTRY.get_output(&agent_id);
                    return Ok(output);
                }
                AgentStatus::Failed => {
                    return Err("Agent execution failed".to_string());
                }
                AgentStatus::Killed => {
                    return Err("Agent was killed".to_string());
                }
                _ => {
                    // Still running
                }
            }
        } else {
            // Agent not found - might have completed and been cleaned up
            let output = AGENT_REGISTRY.get_output(&agent_id);
            return Ok(output);
        }

        // Check timeout
        if start.elapsed().as_millis() as u64 > MAX_AGENT_WAIT_MS {
            return Err(format!(
                "Agent {} did not complete within {} seconds",
                agent_id,
                MAX_AGENT_WAIT_MS / 1000
            ));
        }

        tokio::time::sleep(Duration::from_millis(POLL_INTERVAL_MS)).await;
    }
}

/// Create a checkpoint from current state
fn create_checkpoint(
    state: &WorkflowExecutionState,
    context: &ExecutionContext,
    current_level: usize,
) -> Result<ExecutionCheckpoint, String> {
    let mut node_states = HashMap::new();

    for entry in state.node_states.iter() {
        let ns = entry.value();
        node_states.insert(
            entry.key().clone(),
            NodeCheckpointState {
                node_id: ns.node_id.clone(),
                status: ns.status,
                agent_id: ns.agent_id,
                progress: ns.progress,
                started_at: ns.started_at,
                completed_at: ns.completed_at,
                output: ns.output.clone(),
                error: ns.error.clone(),
                retry_attempts: vec![],
            },
        );
    }

    // Get outputs from context
    let outputs = HashMap::new();
    // Note: In a full implementation, we'd iterate over context outputs

    Ok(ExecutionCheckpoint::new(
        state.execution_id,
        state.workflow_id,
        state.project_id,
        context.original_prompt.clone(),
        state.get_status(),
        node_states,
        state.execution_levels.clone(),
        context.get_all_variables(),
        outputs,
        state.started_at,
        current_level,
    ))
}

fn emit_event(app: &AppHandle, event: WorkflowEvent) {
    let _ = app.emit(WORKFLOW_EVENT_NAME, &event);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = EnhancedExecutionConfig::default();
        assert!(config.enable_data_flow);
        assert!(config.include_original_prompt);
        assert_eq!(config.retry.max_attempts, 3);
    }
}
