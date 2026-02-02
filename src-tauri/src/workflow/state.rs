use chrono::{DateTime, Utc};
use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::broadcast;
use uuid::Uuid;

/// Status of a single node during execution
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NodeExecutionStatus {
    /// Waiting to be executed
    Pending,
    /// Currently running
    Running,
    /// Successfully completed
    Completed,
    /// Failed with an error
    Failed,
    /// Skipped due to dependency failure
    Skipped,
}

impl Default for NodeExecutionStatus {
    fn default() -> Self {
        Self::Pending
    }
}

/// Execution state for a single workflow node
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeExecutionState {
    pub node_id: String,
    pub status: NodeExecutionStatus,
    /// ID of the spawned agent, if any
    pub agent_id: Option<Uuid>,
    /// Progress percentage (0-100)
    pub progress: u8,
    /// When execution started
    pub started_at: Option<DateTime<Utc>>,
    /// When execution completed
    pub completed_at: Option<DateTime<Utc>>,
    /// Output from the agent
    pub output: Option<String>,
    /// Error message if failed
    pub error: Option<String>,
}

impl NodeExecutionState {
    pub fn new(node_id: String) -> Self {
        Self {
            node_id,
            status: NodeExecutionStatus::Pending,
            agent_id: None,
            progress: 0,
            started_at: None,
            completed_at: None,
            output: None,
            error: None,
        }
    }

    pub fn start(&mut self, agent_id: Uuid) {
        self.status = NodeExecutionStatus::Running;
        self.agent_id = Some(agent_id);
        self.started_at = Some(Utc::now());
        self.progress = 0;
    }

    pub fn complete(&mut self, output: Option<String>) {
        self.status = NodeExecutionStatus::Completed;
        self.completed_at = Some(Utc::now());
        self.progress = 100;
        self.output = output;
    }

    pub fn fail(&mut self, error: String) {
        self.status = NodeExecutionStatus::Failed;
        self.completed_at = Some(Utc::now());
        self.error = Some(error);
    }

    pub fn skip(&mut self, reason: String) {
        self.status = NodeExecutionStatus::Skipped;
        self.completed_at = Some(Utc::now());
        self.error = Some(reason);
    }

    pub fn update_progress(&mut self, progress: u8) {
        self.progress = progress.min(100);
    }

    pub fn is_terminal(&self) -> bool {
        matches!(
            self.status,
            NodeExecutionStatus::Completed
                | NodeExecutionStatus::Failed
                | NodeExecutionStatus::Skipped
        )
    }
}

/// Overall status of a workflow execution
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExecutionStatus {
    /// Waiting to start
    Pending,
    /// Currently executing
    Running,
    /// All nodes completed successfully
    Completed,
    /// One or more nodes failed
    Failed,
    /// Execution was cancelled
    Cancelled,
}

impl Default for ExecutionStatus {
    fn default() -> Self {
        Self::Pending
    }
}

/// Complete state for a workflow execution
pub struct WorkflowExecutionState {
    pub execution_id: Uuid,
    pub workflow_id: Uuid,
    pub project_id: Uuid,
    pub status: parking_lot::RwLock<ExecutionStatus>,
    /// State for each node, keyed by node_id
    pub node_states: DashMap<String, NodeExecutionState>,
    /// Ordered list of execution levels (for progress tracking)
    pub execution_levels: Vec<Vec<String>>,
    /// Input prompt that started the execution
    pub input_prompt: String,
    /// When execution started
    pub started_at: DateTime<Utc>,
    /// When execution completed
    pub completed_at: parking_lot::RwLock<Option<DateTime<Utc>>>,
    /// Channel to signal cancellation
    pub cancel_tx: broadcast::Sender<()>,
}

impl WorkflowExecutionState {
    pub fn new(
        execution_id: Uuid,
        workflow_id: Uuid,
        project_id: Uuid,
        input_prompt: String,
        execution_levels: Vec<Vec<String>>,
    ) -> Self {
        let (cancel_tx, _) = broadcast::channel(1);

        // Initialize node states
        let node_states = DashMap::new();
        for level in &execution_levels {
            for node_id in level {
                node_states.insert(node_id.clone(), NodeExecutionState::new(node_id.clone()));
            }
        }

        Self {
            execution_id,
            workflow_id,
            project_id,
            status: parking_lot::RwLock::new(ExecutionStatus::Pending),
            node_states,
            execution_levels,
            input_prompt,
            started_at: Utc::now(),
            completed_at: parking_lot::RwLock::new(None),
            cancel_tx,
        }
    }

    pub fn get_status(&self) -> ExecutionStatus {
        *self.status.read()
    }

    pub fn set_status(&self, status: ExecutionStatus) {
        *self.status.write() = status;
        if matches!(
            status,
            ExecutionStatus::Completed | ExecutionStatus::Failed | ExecutionStatus::Cancelled
        ) {
            *self.completed_at.write() = Some(Utc::now());
        }
    }

    pub fn get_node_state(&self, node_id: &str) -> Option<NodeExecutionState> {
        self.node_states.get(node_id).map(|entry| entry.clone())
    }

    pub fn update_node_state<F>(&self, node_id: &str, f: F)
    where
        F: FnOnce(&mut NodeExecutionState),
    {
        if let Some(mut entry) = self.node_states.get_mut(node_id) {
            f(entry.value_mut());
        }
    }

    pub fn subscribe_cancel(&self) -> broadcast::Receiver<()> {
        self.cancel_tx.subscribe()
    }

    pub fn cancel(&self) {
        let _ = self.cancel_tx.send(());
        self.set_status(ExecutionStatus::Cancelled);
    }

    pub fn total_nodes(&self) -> usize {
        self.node_states.len()
    }

    pub fn completed_nodes(&self) -> usize {
        self.node_states
            .iter()
            .filter(|entry| entry.value().is_terminal())
            .count()
    }

    pub fn failed_nodes(&self) -> Vec<String> {
        self.node_states
            .iter()
            .filter(|entry| entry.value().status == NodeExecutionStatus::Failed)
            .map(|entry| entry.key().clone())
            .collect()
    }

    pub fn get_overall_progress(&self) -> u8 {
        let total = self.total_nodes();
        if total == 0 {
            return 100;
        }

        let sum: u32 = self
            .node_states
            .iter()
            .map(|entry| entry.value().progress as u32)
            .sum();

        ((sum * 100) / (total as u32 * 100)) as u8
    }
}

/// Global store for all workflow executions
pub struct ExecutionStore {
    executions: DashMap<Uuid, Arc<WorkflowExecutionState>>,
}

impl ExecutionStore {
    pub fn new() -> Self {
        Self {
            executions: DashMap::new(),
        }
    }

    pub fn insert(&self, state: WorkflowExecutionState) -> Arc<WorkflowExecutionState> {
        let execution_id = state.execution_id;
        let arc_state = Arc::new(state);
        self.executions.insert(execution_id, arc_state.clone());
        arc_state
    }

    pub fn get(&self, execution_id: &Uuid) -> Option<Arc<WorkflowExecutionState>> {
        self.executions.get(execution_id).map(|e| e.clone())
    }

    pub fn remove(&self, execution_id: &Uuid) -> Option<Arc<WorkflowExecutionState>> {
        self.executions.remove(execution_id).map(|(_, v)| v)
    }

    pub fn list_active(&self) -> Vec<Uuid> {
        self.executions
            .iter()
            .filter(|entry| {
                matches!(
                    entry.value().get_status(),
                    ExecutionStatus::Pending | ExecutionStatus::Running
                )
            })
            .map(|entry| *entry.key())
            .collect()
    }

    pub fn cancel_all(&self) {
        for entry in self.executions.iter() {
            entry.value().cancel();
        }
    }
}

impl Default for ExecutionStore {
    fn default() -> Self {
        Self::new()
    }
}

/// Summary of execution state for serialization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionSummary {
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

impl From<&WorkflowExecutionState> for ExecutionSummary {
    fn from(state: &WorkflowExecutionState) -> Self {
        Self {
            execution_id: state.execution_id.to_string(),
            workflow_id: state.workflow_id.to_string(),
            project_id: state.project_id.to_string(),
            status: state.get_status(),
            total_nodes: state.total_nodes(),
            completed_nodes: state.completed_nodes(),
            failed_nodes: state.failed_nodes(),
            progress: state.get_overall_progress(),
            started_at: state.started_at.to_rfc3339(),
            completed_at: state.completed_at.read().map(|dt| dt.to_rfc3339()),
        }
    }
}
