use serde::{Deserialize, Serialize};

use super::state::NodeExecutionStatus;

/// Events emitted during workflow execution for frontend updates
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum WorkflowEvent {
    /// Workflow execution has started
    ExecutionStarted {
        execution_id: String,
        workflow_id: String,
        workflow_name: String,
        total_nodes: usize,
    },

    /// A node's status has changed
    NodeStatusChanged {
        execution_id: String,
        node_id: String,
        status: NodeExecutionStatus,
        progress: u8,
        agent_id: Option<String>,
        error: Option<String>,
    },

    /// Node execution started (convenience event)
    NodeStarted {
        execution_id: String,
        node_id: String,
        agent_id: String,
    },

    /// Node execution completed (convenience event)
    NodeCompleted {
        execution_id: String,
        node_id: String,
        output: Option<String>,
    },

    /// Node execution failed (convenience event)
    NodeFailed {
        execution_id: String,
        node_id: String,
        error: String,
    },

    /// Node was skipped due to dependency failure
    NodeSkipped {
        execution_id: String,
        node_id: String,
        reason: String,
    },

    /// Execution level started (all nodes in level running in parallel)
    LevelStarted {
        execution_id: String,
        level: usize,
        node_ids: Vec<String>,
    },

    /// Execution level completed
    LevelCompleted {
        execution_id: String,
        level: usize,
    },

    /// Overall progress update
    ProgressUpdate {
        execution_id: String,
        completed_nodes: usize,
        total_nodes: usize,
        progress_percent: u8,
    },

    /// Workflow execution completed successfully
    ExecutionCompleted {
        execution_id: String,
        workflow_id: String,
        duration_ms: u64,
    },

    /// Workflow execution failed
    ExecutionFailed {
        execution_id: String,
        workflow_id: String,
        error: String,
        failed_nodes: Vec<String>,
    },

    /// Workflow execution was cancelled
    ExecutionCancelled {
        execution_id: String,
        workflow_id: String,
    },
}

impl WorkflowEvent {
    /// Get the execution_id for any event type
    pub fn execution_id(&self) -> &str {
        match self {
            WorkflowEvent::ExecutionStarted { execution_id, .. } => execution_id,
            WorkflowEvent::NodeStatusChanged { execution_id, .. } => execution_id,
            WorkflowEvent::NodeStarted { execution_id, .. } => execution_id,
            WorkflowEvent::NodeCompleted { execution_id, .. } => execution_id,
            WorkflowEvent::NodeFailed { execution_id, .. } => execution_id,
            WorkflowEvent::NodeSkipped { execution_id, .. } => execution_id,
            WorkflowEvent::LevelStarted { execution_id, .. } => execution_id,
            WorkflowEvent::LevelCompleted { execution_id, .. } => execution_id,
            WorkflowEvent::ProgressUpdate { execution_id, .. } => execution_id,
            WorkflowEvent::ExecutionCompleted { execution_id, .. } => execution_id,
            WorkflowEvent::ExecutionFailed { execution_id, .. } => execution_id,
            WorkflowEvent::ExecutionCancelled { execution_id, .. } => execution_id,
        }
    }

    /// Check if this is a terminal event (execution finished)
    pub fn is_terminal(&self) -> bool {
        matches!(
            self,
            WorkflowEvent::ExecutionCompleted { .. }
                | WorkflowEvent::ExecutionFailed { .. }
                | WorkflowEvent::ExecutionCancelled { .. }
        )
    }
}

/// Event name constant for Tauri event emission
pub const WORKFLOW_EVENT_NAME: &str = "workflow-event";
