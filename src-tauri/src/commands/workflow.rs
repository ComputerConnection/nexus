use crate::state::AppState;
use crate::workflow::{
    CheckpointManager, CheckpointSummary, EnhancedExecutionConfig,
    EnhancedNodeConfig, EnhancedWorkflowExecutor, ExecutionCondition, ExecutionStatus,
    ExecutionHistoryStore, HistoryStatistics, MessageBusStore,
    ResourceConfig, ResourceManager, ResourceStatsSnapshot,
    RetryConfig, TemplateCategory, WorkflowExecutor, WorkflowGraph, WorkflowTemplate,
};
use chrono::{DateTime, Utc};
use dashmap::DashMap;
use once_cell::sync::OnceCell;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, State};
use uuid::Uuid;

// In-memory workflow storage for offline mode
lazy_static::lazy_static! {
    pub static ref WORKFLOWS: DashMap<Uuid, Workflow> = DashMap::new();
}

// Global workflow executor instance
static EXECUTOR: OnceCell<RwLock<Option<WorkflowExecutor>>> = OnceCell::new();

fn get_executor(app: &AppHandle) -> &RwLock<Option<WorkflowExecutor>> {
    EXECUTOR.get_or_init(|| RwLock::new(Some(WorkflowExecutor::new(app.clone()))))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workflow {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub graph: serde_json::Value,
    pub is_template: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateWorkflowRequest {
    pub name: String,
    pub description: Option<String>,
    pub graph: serde_json::Value,
    pub is_template: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct WorkflowResponse {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub graph: serde_json::Value,
    pub is_template: bool,
    pub created_at: String,
}

impl From<&Workflow> for WorkflowResponse {
    fn from(w: &Workflow) -> Self {
        Self {
            id: w.id.to_string(),
            name: w.name.clone(),
            description: w.description.clone(),
            graph: w.graph.clone(),
            is_template: w.is_template,
            created_at: w.created_at.to_rfc3339(),
        }
    }
}

#[tauri::command]
pub async fn create_workflow(
    _state: State<'_, Arc<AppState>>,
    request: CreateWorkflowRequest,
) -> Result<WorkflowResponse, String> {
    let workflow = Workflow {
        id: Uuid::new_v4(),
        name: request.name,
        description: request.description,
        graph: request.graph,
        is_template: request.is_template.unwrap_or(false),
        created_at: Utc::now(),
    };

    let response = WorkflowResponse::from(&workflow);
    WORKFLOWS.insert(workflow.id, workflow);

    Ok(response)
}

#[tauri::command]
pub async fn get_workflow(
    _state: State<'_, Arc<AppState>>,
    workflow_id: String,
) -> Result<WorkflowResponse, String> {
    let id = Uuid::parse_str(&workflow_id).map_err(|e| format!("Invalid workflow ID: {}", e))?;

    WORKFLOWS
        .get(&id)
        .map(|entry| WorkflowResponse::from(entry.value()))
        .ok_or("Workflow not found".to_string())
}

#[tauri::command]
pub async fn list_workflows(
    _state: State<'_, Arc<AppState>>,
) -> Result<Vec<WorkflowResponse>, String> {
    let workflows: Vec<WorkflowResponse> = WORKFLOWS
        .iter()
        .map(|entry| WorkflowResponse::from(entry.value()))
        .collect();
    Ok(workflows)
}

#[derive(Debug, Deserialize)]
pub struct ExecuteWorkflowRequest {
    pub workflow_id: String,
    pub project_id: String,
    pub input_prompt: String,
}

#[tauri::command]
pub async fn execute_workflow(
    app: AppHandle,
    _state: State<'_, Arc<AppState>>,
    request: ExecuteWorkflowRequest,
) -> Result<String, String> {
    let executor_lock = get_executor(&app);
    let executor_guard = executor_lock.read();

    let executor = executor_guard
        .as_ref()
        .ok_or_else(|| "Executor not initialized".to_string())?;

    let execution_id = executor
        .execute(
            &request.workflow_id,
            &request.project_id,
            request.input_prompt,
        )
        .map_err(|e| e.to_string())?;

    log::info!("Started workflow execution: {}", execution_id);

    Ok(execution_id.to_string())
}

/// Execute an orchestrated workflow - the orchestrator creates a plan and wires up agents dynamically
#[tauri::command]
pub async fn execute_orchestrated_workflow(
    app: AppHandle,
    _state: State<'_, Arc<AppState>>,
    project_id: String,
    input_prompt: String,
) -> Result<String, String> {
    let executor_lock = get_executor(&app);
    let executor_guard = executor_lock.read();

    let executor = executor_guard
        .as_ref()
        .ok_or_else(|| "Executor not initialized".to_string())?;

    let execution_id = executor
        .execute_orchestrated(&project_id, input_prompt)
        .map_err(|e| e.to_string())?;

    log::info!("Started orchestrated workflow execution: {}", execution_id);

    Ok(execution_id.to_string())
}

#[tauri::command]
pub async fn cancel_workflow_execution(
    app: AppHandle,
    execution_id: String,
) -> Result<bool, String> {
    let uuid =
        Uuid::parse_str(&execution_id).map_err(|e| format!("Invalid execution ID: {}", e))?;

    let executor_lock = get_executor(&app);
    let executor_guard = executor_lock.read();

    let executor = executor_guard
        .as_ref()
        .ok_or_else(|| "Executor not initialized".to_string())?;

    let cancelled = executor.cancel(&uuid);

    if cancelled {
        log::info!("Cancelled workflow execution: {}", execution_id);
    } else {
        log::warn!(
            "Could not cancel workflow execution (not found): {}",
            execution_id
        );
    }

    Ok(cancelled)
}

#[derive(Debug, Serialize)]
pub struct ExecutionStatusResponse {
    pub execution_id: String,
    pub workflow_id: String,
    pub project_id: String,
    pub status: ExecutionStatus,
    pub total_nodes: usize,
    pub completed_nodes: usize,
    pub failed_nodes: Vec<String>,
    pub progress: u8,
    pub started_at: String,
    pub completed_at: Option<String>,
}

#[tauri::command]
pub async fn get_workflow_execution_status(
    app: AppHandle,
    execution_id: String,
) -> Result<ExecutionStatusResponse, String> {
    let uuid =
        Uuid::parse_str(&execution_id).map_err(|e| format!("Invalid execution ID: {}", e))?;

    let executor_lock = get_executor(&app);
    let executor_guard = executor_lock.read();

    let executor = executor_guard
        .as_ref()
        .ok_or_else(|| "Executor not initialized".to_string())?;

    let summary = executor
        .get_status(&uuid)
        .ok_or_else(|| format!("Execution not found: {}", execution_id))?;

    Ok(ExecutionStatusResponse {
        execution_id: summary.execution_id,
        workflow_id: summary.workflow_id,
        project_id: summary.project_id,
        status: summary.status,
        total_nodes: summary.total_nodes,
        completed_nodes: summary.completed_nodes,
        failed_nodes: summary.failed_nodes,
        progress: summary.progress,
        started_at: summary.started_at,
        completed_at: summary.completed_at,
    })
}

#[derive(Debug, Serialize)]
pub struct WorkflowValidationResult {
    pub is_valid: bool,
    pub has_cycle: bool,
    pub disconnected_nodes: Vec<String>,
    pub root_nodes: Vec<String>,
    pub leaf_nodes: Vec<String>,
    pub total_nodes: usize,
    pub total_edges: usize,
    pub execution_levels: Option<usize>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn validate_workflow(
    graph: serde_json::Value,
) -> Result<WorkflowValidationResult, String> {
    use crate::workflow::graph::WorkflowGraph;

    // Try to parse the graph
    let workflow_graph = match WorkflowGraph::from_json(&graph) {
        Ok(g) => g,
        Err(e) => {
            return Ok(WorkflowValidationResult {
                is_valid: false,
                has_cycle: false,
                disconnected_nodes: vec![],
                root_nodes: vec![],
                leaf_nodes: vec![],
                total_nodes: 0,
                total_edges: 0,
                execution_levels: None,
                error: Some(format!("Failed to parse graph: {}", e)),
            });
        }
    };

    // Get root and leaf nodes
    let root_nodes = workflow_graph.get_root_nodes();
    let leaf_nodes = workflow_graph.get_leaf_nodes();

    // Find disconnected nodes (nodes with no edges)
    let disconnected_nodes: Vec<String> = workflow_graph
        .nodes
        .keys()
        .filter(|id| {
            let has_predecessors = workflow_graph
                .predecessors
                .get(*id)
                .map_or(false, |p| !p.is_empty());
            let has_successors = workflow_graph
                .successors
                .get(*id)
                .map_or(false, |s| !s.is_empty());
            !has_predecessors && !has_successors && workflow_graph.nodes.len() > 1
        })
        .cloned()
        .collect();

    // Check for cycles by attempting topological sort
    let (has_cycle, execution_levels) = match workflow_graph.compute_execution_levels() {
        Ok(levels) => (false, Some(levels.len())),
        Err(crate::workflow::graph::GraphError::CycleDetected) => (true, None),
        Err(_) => (false, None),
    };

    let is_valid = !has_cycle && disconnected_nodes.is_empty();
    let disconnected_count = disconnected_nodes.len();

    Ok(WorkflowValidationResult {
        is_valid,
        has_cycle,
        disconnected_nodes,
        root_nodes,
        leaf_nodes,
        total_nodes: workflow_graph.node_count(),
        total_edges: workflow_graph.edges.len(),
        execution_levels,
        error: if has_cycle {
            Some("Workflow contains a cycle - agents cannot depend on each other circularly".to_string())
        } else if disconnected_count > 0 {
            Some(format!("Workflow has {} disconnected node(s)", disconnected_count))
        } else {
            None
        },
    })
}

// =============================================================================
// Enhanced Orchestration Commands
// =============================================================================

// Global enhanced executor instance
static ENHANCED_EXECUTOR: OnceCell<RwLock<Option<EnhancedWorkflowExecutor>>> = OnceCell::new();

fn get_enhanced_executor(app: &AppHandle) -> &RwLock<Option<EnhancedWorkflowExecutor>> {
    ENHANCED_EXECUTOR.get_or_init(|| RwLock::new(Some(EnhancedWorkflowExecutor::new(app.clone()))))
}

/// Request for enhanced workflow execution
#[derive(Debug, Deserialize)]
pub struct EnhancedExecutionRequest {
    pub graph: serde_json::Value,
    pub project_id: String,
    pub input_prompt: String,
    /// Optional retry configuration
    pub retry_config: Option<RetryConfigRequest>,
    /// Enable inter-agent data flow
    pub enable_data_flow: Option<bool>,
    /// Include original prompt in agent context
    pub include_original_prompt: Option<bool>,
    /// Per-node configurations
    pub node_configs: Option<HashMap<String, NodeConfigRequest>>,
}

#[derive(Debug, Deserialize)]
pub struct RetryConfigRequest {
    pub max_attempts: Option<u32>,
    pub initial_delay_ms: Option<u64>,
    pub max_delay_ms: Option<u64>,
    pub backoff_multiplier: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct NodeConfigRequest {
    /// Condition type: "always", "on_success", "on_failure", "variable_equals", etc.
    pub condition_type: Option<String>,
    /// Condition parameters (varies by type)
    pub condition_params: Option<serde_json::Value>,
    /// Override retry config for this node
    pub retry_config: Option<RetryConfigRequest>,
    /// Custom system prompt
    pub system_prompt_override: Option<String>,
    /// Tags to add to output
    pub output_tags: Option<Vec<String>>,
}

/// Execute a workflow with enhanced orchestration features
#[tauri::command]
pub async fn execute_enhanced_workflow(
    app: AppHandle,
    _state: State<'_, Arc<AppState>>,
    request: EnhancedExecutionRequest,
) -> Result<String, String> {
    // Parse project ID
    let project_id = Uuid::parse_str(&request.project_id)
        .map_err(|e| format!("Invalid project ID: {}", e))?;

    // Parse the graph
    let graph = WorkflowGraph::from_json(&request.graph)
        .map_err(|e| format!("Invalid graph: {}", e))?;

    // Build execution config
    let mut config = EnhancedExecutionConfig::default();

    if let Some(retry) = request.retry_config {
        config.retry = RetryConfig {
            max_attempts: retry.max_attempts.unwrap_or(3),
            initial_delay_ms: retry.initial_delay_ms.unwrap_or(1000),
            max_delay_ms: retry.max_delay_ms.unwrap_or(30000),
            backoff_multiplier: retry.backoff_multiplier.unwrap_or(2.0),
            ..Default::default()
        };
    }

    if let Some(enable) = request.enable_data_flow {
        config.enable_data_flow = enable;
    }

    if let Some(include) = request.include_original_prompt {
        config.include_original_prompt = include;
    }

    // Build node configs
    let mut node_configs: HashMap<String, EnhancedNodeConfig> = HashMap::new();

    if let Some(configs) = request.node_configs {
        for (node_id, node_config) in configs {
            let mut enhanced_config = EnhancedNodeConfig::default();

            // Parse condition
            if let Some(condition_type) = node_config.condition_type {
                enhanced_config.condition = parse_condition(&condition_type, node_config.condition_params)?;
            }

            // Parse retry config
            if let Some(retry) = node_config.retry_config {
                enhanced_config.retry = Some(RetryConfig {
                    max_attempts: retry.max_attempts.unwrap_or(3),
                    initial_delay_ms: retry.initial_delay_ms.unwrap_or(1000),
                    max_delay_ms: retry.max_delay_ms.unwrap_or(30000),
                    backoff_multiplier: retry.backoff_multiplier.unwrap_or(2.0),
                    ..Default::default()
                });
            }

            enhanced_config.system_prompt_override = node_config.system_prompt_override;
            enhanced_config.output_tags = node_config.output_tags.unwrap_or_default();

            node_configs.insert(node_id, enhanced_config);
        }
    }

    // Get enhanced executor
    let executor_lock = get_enhanced_executor(&app);
    let executor_guard = executor_lock.read();

    let executor = executor_guard
        .as_ref()
        .ok_or_else(|| "Enhanced executor not initialized".to_string())?;

    // Execute
    let execution_id = executor
        .execute_enhanced(graph, project_id, request.input_prompt, config, node_configs)
        .map_err(|e| e.to_string())?;

    log::info!("Started enhanced workflow execution: {}", execution_id);

    Ok(execution_id.to_string())
}

/// Parse a condition from request parameters
fn parse_condition(
    condition_type: &str,
    params: Option<serde_json::Value>,
) -> Result<ExecutionCondition, String> {
    match condition_type.to_lowercase().as_str() {
        "always" => Ok(ExecutionCondition::Always),
        "never" => Ok(ExecutionCondition::Never),
        "on_success" => {
            let predecessor_id = params
                .as_ref()
                .and_then(|p| p.get("predecessor_id"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .ok_or_else(|| "on_success condition requires predecessor_id".to_string())?;
            Ok(ExecutionCondition::OnSuccess { predecessor_id })
        }
        "on_failure" => {
            let predecessor_id = params
                .as_ref()
                .and_then(|p| p.get("predecessor_id"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .ok_or_else(|| "on_failure condition requires predecessor_id".to_string())?;
            Ok(ExecutionCondition::OnFailure { predecessor_id })
        }
        "all_predecessors_succeeded" => Ok(ExecutionCondition::AllPredecessorsSucceeded),
        "any_predecessor_succeeded" => Ok(ExecutionCondition::AnyPredecessorSucceeded),
        "variable_equals" => {
            let params = params.ok_or_else(|| "variable_equals condition requires params".to_string())?;
            let variable = params
                .get("variable")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .ok_or_else(|| "variable_equals condition requires variable".to_string())?;
            let value = params
                .get("value")
                .cloned()
                .ok_or_else(|| "variable_equals condition requires value".to_string())?;
            Ok(ExecutionCondition::VariableEquals { variable, value })
        }
        "variable_truthy" => {
            let variable = params
                .as_ref()
                .and_then(|p| p.get("variable"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .ok_or_else(|| "variable_truthy condition requires variable".to_string())?;
            Ok(ExecutionCondition::VariableTruthy { variable })
        }
        _ => Err(format!("Unknown condition type: {}", condition_type)),
    }
}

/// Get execution context data (for debugging/inspection)
#[tauri::command]
pub async fn get_execution_context(
    app: AppHandle,
    execution_id: String,
) -> Result<serde_json::Value, String> {
    let uuid = Uuid::parse_str(&execution_id)
        .map_err(|e| format!("Invalid execution ID: {}", e))?;

    let executor_lock = get_enhanced_executor(&app);
    let executor_guard = executor_lock.read();

    let executor = executor_guard
        .as_ref()
        .ok_or_else(|| "Enhanced executor not initialized".to_string())?;

    let context = executor
        .context_store()
        .get(&uuid)
        .ok_or_else(|| format!("Execution context not found: {}", execution_id))?;

    let summary = context.get_execution_summary();

    Ok(serde_json::to_value(summary)
        .map_err(|e| format!("Failed to serialize context: {}", e))?)
}

/// List available checkpoints
#[tauri::command]
pub async fn list_checkpoints() -> Result<Vec<CheckpointSummaryResponse>, String> {
    let manager = CheckpointManager::new(CheckpointManager::default_checkpoint_dir())
        .map_err(|e| format!("Failed to initialize checkpoint manager: {}", e))?;

    let summaries = manager
        .list()
        .map_err(|e| format!("Failed to list checkpoints: {}", e))?;

    Ok(summaries.into_iter().map(CheckpointSummaryResponse::from).collect())
}

#[derive(Debug, Serialize)]
pub struct CheckpointSummaryResponse {
    pub id: String,
    pub execution_id: String,
    pub workflow_id: String,
    pub status: String,
    pub progress: f32,
    pub total_nodes: usize,
    pub completed_nodes: usize,
    pub failed_nodes: usize,
    pub pending_nodes: usize,
    pub checkpoint_at: String,
    pub current_level: usize,
    pub total_levels: usize,
}

impl From<CheckpointSummary> for CheckpointSummaryResponse {
    fn from(s: CheckpointSummary) -> Self {
        Self {
            id: s.id.to_string(),
            execution_id: s.execution_id.to_string(),
            workflow_id: s.workflow_id.to_string(),
            status: format!("{:?}", s.status),
            progress: s.progress,
            total_nodes: s.total_nodes,
            completed_nodes: s.completed_nodes,
            failed_nodes: s.failed_nodes,
            pending_nodes: s.pending_nodes,
            checkpoint_at: s.checkpoint_at.to_rfc3339(),
            current_level: s.current_level,
            total_levels: s.total_levels,
        }
    }
}

/// List checkpoints for a specific execution
#[tauri::command]
pub async fn list_execution_checkpoints(
    execution_id: String,
) -> Result<Vec<CheckpointSummaryResponse>, String> {
    let uuid = Uuid::parse_str(&execution_id)
        .map_err(|e| format!("Invalid execution ID: {}", e))?;

    let manager = CheckpointManager::new(CheckpointManager::default_checkpoint_dir())
        .map_err(|e| format!("Failed to initialize checkpoint manager: {}", e))?;

    let summaries = manager
        .list_for_execution(&uuid)
        .map_err(|e| format!("Failed to list checkpoints: {}", e))?;

    Ok(summaries.into_iter().map(CheckpointSummaryResponse::from).collect())
}

/// Clean up old checkpoints
#[tauri::command]
pub async fn cleanup_checkpoints(
    keep_per_execution: Option<usize>,
) -> Result<usize, String> {
    let manager = CheckpointManager::new(CheckpointManager::default_checkpoint_dir())
        .map_err(|e| format!("Failed to initialize checkpoint manager: {}", e))?;

    let deleted = manager
        .cleanup(keep_per_execution.unwrap_or(3))
        .map_err(|e| format!("Failed to cleanup checkpoints: {}", e))?;

    Ok(deleted)
}

/// Get available agent roles
#[tauri::command]
pub async fn get_available_agent_roles() -> Result<Vec<AgentRoleInfo>, String> {
    Ok(vec![
        AgentRoleInfo {
            id: "orchestrator".to_string(),
            name: "Orchestrator".to_string(),
            description: "Plans and coordinates work between other agents".to_string(),
            capabilities: vec![
                "Task decomposition".to_string(),
                "Dependency analysis".to_string(),
                "Agent coordination".to_string(),
            ],
        },
        AgentRoleInfo {
            id: "architect".to_string(),
            name: "Architect".to_string(),
            description: "Designs system architecture and technical specifications".to_string(),
            capabilities: vec![
                "System design".to_string(),
                "API design".to_string(),
                "Technical planning".to_string(),
            ],
        },
        AgentRoleInfo {
            id: "implementer".to_string(),
            name: "Implementer".to_string(),
            description: "Writes code and implements features".to_string(),
            capabilities: vec![
                "Code writing".to_string(),
                "Feature implementation".to_string(),
                "Bug fixes".to_string(),
            ],
        },
        AgentRoleInfo {
            id: "tester".to_string(),
            name: "Tester".to_string(),
            description: "Writes tests and validates functionality".to_string(),
            capabilities: vec![
                "Test writing".to_string(),
                "Quality assurance".to_string(),
                "Validation".to_string(),
            ],
        },
        AgentRoleInfo {
            id: "documenter".to_string(),
            name: "Documenter".to_string(),
            description: "Creates documentation and guides".to_string(),
            capabilities: vec![
                "Documentation".to_string(),
                "API docs".to_string(),
                "User guides".to_string(),
            ],
        },
        AgentRoleInfo {
            id: "security".to_string(),
            name: "Security".to_string(),
            description: "Reviews code for security issues".to_string(),
            capabilities: vec![
                "Security review".to_string(),
                "Vulnerability analysis".to_string(),
                "Best practices".to_string(),
            ],
        },
        AgentRoleInfo {
            id: "devops".to_string(),
            name: "DevOps".to_string(),
            description: "Handles deployment and infrastructure".to_string(),
            capabilities: vec![
                "CI/CD".to_string(),
                "Infrastructure".to_string(),
                "Deployment".to_string(),
            ],
        },
        AgentRoleInfo {
            id: "reviewer".to_string(),
            name: "Code Reviewer".to_string(),
            description: "Reviews code for quality and best practices".to_string(),
            capabilities: vec![
                "Code review".to_string(),
                "Style checking".to_string(),
                "Best practices".to_string(),
            ],
        },
        AgentRoleInfo {
            id: "analyst".to_string(),
            name: "Analyst".to_string(),
            description: "Analyzes requirements and provides insights".to_string(),
            capabilities: vec![
                "Requirements analysis".to_string(),
                "Data analysis".to_string(),
                "Insights".to_string(),
            ],
        },
    ])
}

#[derive(Debug, Serialize)]
pub struct AgentRoleInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub capabilities: Vec<String>,
}

/// Get aggregation strategies
#[tauri::command]
pub async fn get_aggregation_strategies() -> Result<Vec<AggregationStrategyInfo>, String> {
    Ok(vec![
        AggregationStrategyInfo {
            id: "concatenate".to_string(),
            name: "Concatenate".to_string(),
            description: "Combine all outputs with separators".to_string(),
        },
        AggregationStrategyInfo {
            id: "merge_json".to_string(),
            name: "Merge JSON".to_string(),
            description: "Merge JSON objects from multiple sources".to_string(),
        },
        AggregationStrategyInfo {
            id: "collect_array".to_string(),
            name: "Collect Array".to_string(),
            description: "Collect all outputs into a JSON array".to_string(),
        },
        AggregationStrategyInfo {
            id: "select_one".to_string(),
            name: "Select One".to_string(),
            description: "Use output from a specific predecessor".to_string(),
        },
        AggregationStrategyInfo {
            id: "first_non_empty".to_string(),
            name: "First Non-Empty".to_string(),
            description: "Use the first non-empty output".to_string(),
        },
        AggregationStrategyInfo {
            id: "longest".to_string(),
            name: "Longest".to_string(),
            description: "Use the longest output".to_string(),
        },
        AggregationStrategyInfo {
            id: "template".to_string(),
            name: "Template".to_string(),
            description: "Use a custom template to combine outputs".to_string(),
        },
    ])
}

#[derive(Debug, Serialize)]
pub struct AggregationStrategyInfo {
    pub id: String,
    pub name: String,
    pub description: String,
}

/// Get condition types
#[tauri::command]
pub async fn get_condition_types() -> Result<Vec<ConditionTypeInfo>, String> {
    Ok(vec![
        ConditionTypeInfo {
            id: "always".to_string(),
            name: "Always".to_string(),
            description: "Always execute this node".to_string(),
            params: vec![],
        },
        ConditionTypeInfo {
            id: "never".to_string(),
            name: "Never".to_string(),
            description: "Never execute this node (disabled)".to_string(),
            params: vec![],
        },
        ConditionTypeInfo {
            id: "on_success".to_string(),
            name: "On Success".to_string(),
            description: "Execute only if a specific predecessor succeeded".to_string(),
            params: vec!["predecessor_id".to_string()],
        },
        ConditionTypeInfo {
            id: "on_failure".to_string(),
            name: "On Failure".to_string(),
            description: "Execute only if a specific predecessor failed".to_string(),
            params: vec!["predecessor_id".to_string()],
        },
        ConditionTypeInfo {
            id: "all_predecessors_succeeded".to_string(),
            name: "All Predecessors Succeeded".to_string(),
            description: "Execute only if all predecessors succeeded".to_string(),
            params: vec![],
        },
        ConditionTypeInfo {
            id: "any_predecessor_succeeded".to_string(),
            name: "Any Predecessor Succeeded".to_string(),
            description: "Execute if at least one predecessor succeeded".to_string(),
            params: vec![],
        },
        ConditionTypeInfo {
            id: "variable_equals".to_string(),
            name: "Variable Equals".to_string(),
            description: "Execute if a context variable equals a value".to_string(),
            params: vec!["variable".to_string(), "value".to_string()],
        },
        ConditionTypeInfo {
            id: "variable_truthy".to_string(),
            name: "Variable Truthy".to_string(),
            description: "Execute if a context variable is truthy".to_string(),
            params: vec!["variable".to_string()],
        },
    ])
}

#[derive(Debug, Serialize)]
pub struct ConditionTypeInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub params: Vec<String>,
}

// =============================================================================
// Template Commands
// =============================================================================

/// List all available workflow templates
#[tauri::command]
pub async fn list_workflow_templates() -> Result<Vec<WorkflowTemplateResponse>, String> {
    let templates = crate::workflow::get_builtin_templates();
    Ok(templates.into_iter().map(WorkflowTemplateResponse::from).collect())
}

/// Get a specific workflow template by ID
#[tauri::command]
pub async fn get_workflow_template(template_id: String) -> Result<WorkflowTemplateResponse, String> {
    crate::workflow::get_template(&template_id)
        .map(WorkflowTemplateResponse::from)
        .ok_or_else(|| format!("Template not found: {}", template_id))
}

/// Search workflow templates by query
#[tauri::command]
pub async fn search_workflow_templates(query: String) -> Result<Vec<WorkflowTemplateResponse>, String> {
    let templates = crate::workflow::search_templates(&query);
    Ok(templates.into_iter().map(WorkflowTemplateResponse::from).collect())
}

/// Get templates by category
#[tauri::command]
pub async fn get_templates_by_category(category: String) -> Result<Vec<WorkflowTemplateResponse>, String> {
    let category = match category.to_lowercase().as_str() {
        "development" => TemplateCategory::Development,
        "testing" => TemplateCategory::Testing,
        "documentation" => TemplateCategory::Documentation,
        "security" => TemplateCategory::Security,
        "devops" => TemplateCategory::DevOps,
        "codereview" | "code_review" => TemplateCategory::CodeReview,
        "refactoring" => TemplateCategory::Refactoring,
        "research" => TemplateCategory::Research,
        "custom" => TemplateCategory::Custom,
        _ => return Err(format!("Unknown category: {}", category)),
    };

    let templates = crate::workflow::get_templates_by_category(category);
    Ok(templates.into_iter().map(WorkflowTemplateResponse::from).collect())
}

/// Instantiate a template with variable values
#[tauri::command]
pub async fn instantiate_template(
    template_id: String,
    variables: HashMap<String, String>,
) -> Result<Vec<PlannedTaskResponse>, String> {
    let template = crate::workflow::get_template(&template_id)
        .ok_or_else(|| format!("Template not found: {}", template_id))?;

    let tasks = template.instantiate(&variables);
    Ok(tasks.into_iter().map(PlannedTaskResponse::from).collect())
}

#[derive(Debug, Serialize)]
pub struct WorkflowTemplateResponse {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: String,
    pub tags: Vec<String>,
    pub estimated_duration_minutes: Option<u32>,
    pub variables: Vec<TemplateVariableResponse>,
    pub task_count: usize,
}

#[derive(Debug, Serialize)]
pub struct TemplateVariableResponse {
    pub name: String,
    pub description: String,
    pub default_value: Option<String>,
    pub required: bool,
    pub variable_type: String,
    pub options: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
pub struct PlannedTaskResponse {
    pub id: String,
    pub name: String,
    pub agent_role: String,
    pub description: String,
    pub depends_on: Vec<String>,
}

impl From<WorkflowTemplate> for WorkflowTemplateResponse {
    fn from(t: WorkflowTemplate) -> Self {
        Self {
            id: t.id,
            name: t.name,
            description: t.description,
            category: format!("{:?}", t.category).to_lowercase(),
            tags: t.tags,
            estimated_duration_minutes: t.estimated_duration_minutes,
            variables: t.variables.into_iter().map(|v| {
                let (var_type, options) = match v.variable_type {
                    crate::workflow::VariableType::String => ("string".to_string(), None),
                    crate::workflow::VariableType::Number => ("number".to_string(), None),
                    crate::workflow::VariableType::Boolean => ("boolean".to_string(), None),
                    crate::workflow::VariableType::FilePath => ("file_path".to_string(), None),
                    crate::workflow::VariableType::Choice { options } => ("choice".to_string(), Some(options)),
                };
                TemplateVariableResponse {
                    name: v.name,
                    description: v.description,
                    default_value: v.default_value,
                    required: v.required,
                    variable_type: var_type,
                    options,
                }
            }).collect(),
            task_count: t.tasks.len(),
        }
    }
}

impl From<crate::workflow::orchestrator::PlannedTask> for PlannedTaskResponse {
    fn from(t: crate::workflow::orchestrator::PlannedTask) -> Self {
        Self {
            id: t.id,
            name: t.name,
            agent_role: t.agent_role,
            description: t.description,
            depends_on: t.depends_on,
        }
    }
}

// =============================================================================
// History Commands
// =============================================================================

// Global history store
static HISTORY_STORE: OnceCell<ExecutionHistoryStore> = OnceCell::new();

fn get_history_store() -> &'static ExecutionHistoryStore {
    HISTORY_STORE.get_or_init(|| ExecutionHistoryStore::new(1000))
}

/// Get execution history statistics
#[tauri::command]
pub async fn get_execution_history_stats() -> Result<HistoryStatistics, String> {
    Ok(get_history_store().get_statistics())
}

/// List execution history records
#[tauri::command]
pub async fn list_execution_history(
    limit: Option<usize>,
    project_id: Option<String>,
) -> Result<Vec<ExecutionRecordSummary>, String> {
    let store = get_history_store();

    let records = if let Some(pid) = project_id {
        let project_uuid = Uuid::parse_str(&pid)
            .map_err(|e| format!("Invalid project ID: {}", e))?;
        store.list_for_project(&project_uuid)
    } else {
        store.list()
    };

    let limit = limit.unwrap_or(50);
    Ok(records.into_iter().take(limit).map(ExecutionRecordSummary::from).collect())
}

/// Search execution history
#[tauri::command]
pub async fn search_execution_history(query: String) -> Result<Vec<ExecutionRecordSummary>, String> {
    let records = get_history_store().search(&query);
    Ok(records.into_iter().map(ExecutionRecordSummary::from).collect())
}

#[derive(Debug, Serialize)]
pub struct ExecutionRecordSummary {
    pub id: String,
    pub workflow_name: String,
    pub project_name: String,
    pub input_prompt: String,
    pub status: String,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub duration_ms: Option<u64>,
    pub total_nodes: usize,
    pub completed_nodes: usize,
    pub failed_nodes: usize,
    pub tags: Vec<String>,
}

impl From<crate::workflow::ExecutionRecord> for ExecutionRecordSummary {
    fn from(r: crate::workflow::ExecutionRecord) -> Self {
        Self {
            id: r.id.to_string(),
            workflow_name: r.workflow_name,
            project_name: r.project_name,
            input_prompt: if r.input_prompt.len() > 100 {
                format!("{}...", &r.input_prompt[..100])
            } else {
                r.input_prompt
            },
            status: format!("{:?}", r.status).to_lowercase(),
            started_at: r.started_at.to_rfc3339(),
            completed_at: r.completed_at.map(|t| t.to_rfc3339()),
            duration_ms: r.duration_ms,
            total_nodes: r.total_nodes,
            completed_nodes: r.completed_nodes,
            failed_nodes: r.failed_nodes,
            tags: r.tags,
        }
    }
}

// =============================================================================
// Resource Management Commands
// =============================================================================

// Global resource manager
static RESOURCE_MANAGER: OnceCell<ResourceManager> = OnceCell::new();

fn get_resource_manager() -> &'static ResourceManager {
    RESOURCE_MANAGER.get_or_init(|| ResourceManager::new(ResourceConfig::default()))
}

/// Get resource manager statistics
#[tauri::command]
pub async fn get_resource_stats() -> Result<ResourceStatsSnapshot, String> {
    Ok(get_resource_manager().get_stats())
}

/// Get current resource configuration
#[tauri::command]
pub async fn get_resource_config() -> Result<ResourceConfigResponse, String> {
    // Return default config since we don't have access to the internal config
    Ok(ResourceConfigResponse::from(ResourceConfig::default()))
}

/// Check resource availability
#[tauri::command]
pub async fn check_resource_availability() -> Result<ResourceAvailability, String> {
    let manager = get_resource_manager();
    Ok(ResourceAvailability {
        is_available: manager.is_available(),
        available_permits: manager.available_permits(),
        active_count: manager.active_count(),
        queue_length: manager.queue_length(),
    })
}

#[derive(Debug, Serialize)]
pub struct ResourceConfigResponse {
    pub max_concurrent_agents: u32,
    pub max_queue_size: usize,
    pub rate_limit_per_minute: Option<u32>,
    pub acquire_timeout_ms: u64,
    pub enable_priority_queue: bool,
}

impl From<ResourceConfig> for ResourceConfigResponse {
    fn from(c: ResourceConfig) -> Self {
        Self {
            max_concurrent_agents: c.max_concurrent_agents,
            max_queue_size: c.max_queue_size,
            rate_limit_per_minute: c.rate_limit_per_minute,
            acquire_timeout_ms: c.acquire_timeout_ms,
            enable_priority_queue: c.enable_priority_queue,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct ResourceAvailability {
    pub is_available: bool,
    pub available_permits: usize,
    pub active_count: u32,
    pub queue_length: usize,
}

// =============================================================================
// Messaging Commands
// =============================================================================

// Global message bus store
static MESSAGE_BUS_STORE: OnceCell<MessageBusStore> = OnceCell::new();

fn get_message_bus_store() -> &'static MessageBusStore {
    MESSAGE_BUS_STORE.get_or_init(MessageBusStore::new)
}

/// Get messages for an execution
#[tauri::command]
pub async fn get_execution_messages(
    execution_id: String,
) -> Result<Vec<AgentMessageResponse>, String> {
    let uuid = Uuid::parse_str(&execution_id)
        .map_err(|e| format!("Invalid execution ID: {}", e))?;

    let store = get_message_bus_store();

    let bus = store.get(&uuid)
        .ok_or_else(|| format!("No message bus found for execution: {}", execution_id))?;

    let messages = bus.get_all_messages();
    Ok(messages.into_iter().map(AgentMessageResponse::from).collect())
}

/// Get unread messages for an agent in an execution
#[tauri::command]
pub async fn get_unread_agent_messages(
    execution_id: String,
    agent_id: String,
) -> Result<Vec<AgentMessageResponse>, String> {
    let exec_uuid = Uuid::parse_str(&execution_id)
        .map_err(|e| format!("Invalid execution ID: {}", e))?;
    let agent_uuid = Uuid::parse_str(&agent_id)
        .map_err(|e| format!("Invalid agent ID: {}", e))?;

    let store = get_message_bus_store();

    let bus = store.get(&exec_uuid)
        .ok_or_else(|| format!("No message bus found for execution: {}", execution_id))?;

    let messages = bus.get_unread(&agent_uuid);
    Ok(messages.into_iter().map(AgentMessageResponse::from).collect())
}

#[derive(Debug, Serialize)]
pub struct AgentMessageResponse {
    pub id: String,
    pub from_agent_id: String,
    pub from_node_id: String,
    pub from_role: String,
    pub to_agent_id: Option<String>,
    pub to_node_id: Option<String>,
    pub message_type: String,
    pub content: serde_json::Value,
    pub timestamp: String,
    pub priority: String,
    pub read: bool,
}

impl From<crate::workflow::AgentMessage> for AgentMessageResponse {
    fn from(m: crate::workflow::AgentMessage) -> Self {
        Self {
            id: m.id.to_string(),
            from_agent_id: m.from_agent_id.to_string(),
            from_node_id: m.from_node_id,
            from_role: m.from_role,
            to_agent_id: m.to_agent_id.map(|id| id.to_string()),
            to_node_id: m.to_node_id,
            message_type: format!("{:?}", m.message_type).to_lowercase(),
            content: serde_json::to_value(&m.content).unwrap_or(serde_json::Value::Null),
            timestamp: m.timestamp.to_rfc3339(),
            priority: format!("{:?}", m.priority).to_lowercase(),
            read: m.read,
        }
    }
}

/// Get template categories
#[tauri::command]
pub async fn get_template_categories() -> Result<Vec<TemplateCategoryInfo>, String> {
    Ok(vec![
        TemplateCategoryInfo {
            id: "development".to_string(),
            name: "Development".to_string(),
            description: "Feature development and coding workflows".to_string(),
        },
        TemplateCategoryInfo {
            id: "testing".to_string(),
            name: "Testing".to_string(),
            description: "Testing and quality assurance workflows".to_string(),
        },
        TemplateCategoryInfo {
            id: "documentation".to_string(),
            name: "Documentation".to_string(),
            description: "Documentation and technical writing workflows".to_string(),
        },
        TemplateCategoryInfo {
            id: "security".to_string(),
            name: "Security".to_string(),
            description: "Security audits and vulnerability assessments".to_string(),
        },
        TemplateCategoryInfo {
            id: "devops".to_string(),
            name: "DevOps".to_string(),
            description: "CI/CD and infrastructure workflows".to_string(),
        },
        TemplateCategoryInfo {
            id: "code_review".to_string(),
            name: "Code Review".to_string(),
            description: "Code review and quality analysis workflows".to_string(),
        },
        TemplateCategoryInfo {
            id: "refactoring".to_string(),
            name: "Refactoring".to_string(),
            description: "Code refactoring and improvement workflows".to_string(),
        },
        TemplateCategoryInfo {
            id: "research".to_string(),
            name: "Research".to_string(),
            description: "Research and exploration workflows".to_string(),
        },
    ])
}

#[derive(Debug, Serialize)]
pub struct TemplateCategoryInfo {
    pub id: String,
    pub name: String,
    pub description: String,
}
