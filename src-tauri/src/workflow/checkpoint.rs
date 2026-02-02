//! Checkpointing and recovery for workflow executions.
//!
//! Enables:
//! - Saving execution state to disk
//! - Resuming interrupted executions
//! - Viewing execution history
//! - Debugging failed workflows

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use uuid::Uuid;

use super::context::AgentOutput;
use super::retry::RetryAttemptError;
use super::state::{ExecutionStatus, NodeExecutionStatus};

/// A checkpoint of the entire workflow execution state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionCheckpoint {
    /// Unique checkpoint ID
    pub id: Uuid,
    /// The execution this checkpoint belongs to
    pub execution_id: Uuid,
    /// Workflow being executed
    pub workflow_id: Uuid,
    /// Project context
    pub project_id: Uuid,
    /// Original user prompt
    pub original_prompt: String,
    /// Current overall status
    pub status: ExecutionStatus,
    /// State of each node
    pub node_states: HashMap<String, NodeCheckpointState>,
    /// Execution levels (preserved for resume)
    pub execution_levels: Vec<Vec<String>>,
    /// Variables from execution context
    pub variables: HashMap<String, serde_json::Value>,
    /// All agent outputs so far
    pub outputs: HashMap<String, Vec<AgentOutput>>,
    /// When execution started
    pub started_at: DateTime<Utc>,
    /// When this checkpoint was created
    pub checkpoint_at: DateTime<Utc>,
    /// Current level being executed
    pub current_level: usize,
    /// Checkpoint version for compatibility
    pub version: u32,
}

/// State of a single node in a checkpoint
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeCheckpointState {
    pub node_id: String,
    pub status: NodeExecutionStatus,
    pub agent_id: Option<Uuid>,
    pub progress: u8,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub output: Option<String>,
    pub error: Option<String>,
    pub retry_attempts: Vec<RetryAttemptError>,
}

const CHECKPOINT_VERSION: u32 = 1;

impl ExecutionCheckpoint {
    /// Create a new checkpoint from the current execution state
    pub fn new(
        execution_id: Uuid,
        workflow_id: Uuid,
        project_id: Uuid,
        original_prompt: String,
        status: ExecutionStatus,
        node_states: HashMap<String, NodeCheckpointState>,
        execution_levels: Vec<Vec<String>>,
        variables: HashMap<String, serde_json::Value>,
        outputs: HashMap<String, Vec<AgentOutput>>,
        started_at: DateTime<Utc>,
        current_level: usize,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            execution_id,
            workflow_id,
            project_id,
            original_prompt,
            status,
            node_states,
            execution_levels,
            variables,
            outputs,
            started_at,
            checkpoint_at: Utc::now(),
            current_level,
            version: CHECKPOINT_VERSION,
        }
    }

    /// Get nodes that were in progress when checkpoint was created
    pub fn get_interrupted_nodes(&self) -> Vec<String> {
        self.node_states
            .iter()
            .filter(|(_, state)| state.status == NodeExecutionStatus::Running)
            .map(|(id, _)| id.clone())
            .collect()
    }

    /// Get nodes that haven't started yet
    pub fn get_pending_nodes(&self) -> Vec<String> {
        self.node_states
            .iter()
            .filter(|(_, state)| state.status == NodeExecutionStatus::Pending)
            .map(|(id, _)| id.clone())
            .collect()
    }

    /// Get nodes that completed successfully
    pub fn get_completed_nodes(&self) -> Vec<String> {
        self.node_states
            .iter()
            .filter(|(_, state)| state.status == NodeExecutionStatus::Completed)
            .map(|(id, _)| id.clone())
            .collect()
    }

    /// Get nodes that failed
    pub fn get_failed_nodes(&self) -> Vec<String> {
        self.node_states
            .iter()
            .filter(|(_, state)| state.status == NodeExecutionStatus::Failed)
            .map(|(id, _)| id.clone())
            .collect()
    }

    /// Calculate overall progress
    pub fn get_progress(&self) -> f32 {
        let total = self.node_states.len();
        if total == 0 {
            return 100.0;
        }

        let completed = self.node_states
            .values()
            .filter(|s| matches!(s.status, NodeExecutionStatus::Completed | NodeExecutionStatus::Skipped))
            .count();

        (completed as f32 / total as f32) * 100.0
    }

    /// Get a summary of this checkpoint
    pub fn get_summary(&self) -> CheckpointSummary {
        CheckpointSummary {
            id: self.id,
            execution_id: self.execution_id,
            workflow_id: self.workflow_id,
            status: self.status.clone(),
            progress: self.get_progress(),
            total_nodes: self.node_states.len(),
            completed_nodes: self.get_completed_nodes().len(),
            failed_nodes: self.get_failed_nodes().len(),
            pending_nodes: self.get_pending_nodes().len(),
            checkpoint_at: self.checkpoint_at,
            current_level: self.current_level,
            total_levels: self.execution_levels.len(),
        }
    }
}

/// Summary of a checkpoint for listing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckpointSummary {
    pub id: Uuid,
    pub execution_id: Uuid,
    pub workflow_id: Uuid,
    pub status: ExecutionStatus,
    pub progress: f32,
    pub total_nodes: usize,
    pub completed_nodes: usize,
    pub failed_nodes: usize,
    pub pending_nodes: usize,
    pub checkpoint_at: DateTime<Utc>,
    pub current_level: usize,
    pub total_levels: usize,
}

/// Options for resuming from a checkpoint
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResumeOptions {
    /// Whether to retry failed nodes
    pub retry_failed: bool,
    /// Whether to re-run interrupted nodes
    pub rerun_interrupted: bool,
    /// Skip specific nodes
    pub skip_nodes: Vec<String>,
    /// Override variables before resuming
    pub override_variables: HashMap<String, serde_json::Value>,
}

impl Default for ResumeOptions {
    fn default() -> Self {
        Self {
            retry_failed: true,
            rerun_interrupted: true,
            skip_nodes: Vec::new(),
            override_variables: HashMap::new(),
        }
    }
}

/// Checkpoint storage manager
pub struct CheckpointManager {
    /// Directory to store checkpoints
    checkpoint_dir: PathBuf,
}

impl CheckpointManager {
    /// Create a new checkpoint manager
    pub fn new(checkpoint_dir: PathBuf) -> std::io::Result<Self> {
        // Ensure checkpoint directory exists
        std::fs::create_dir_all(&checkpoint_dir)?;

        Ok(Self { checkpoint_dir })
    }

    /// Get the default checkpoint directory
    pub fn default_checkpoint_dir() -> PathBuf {
        dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("nexus")
            .join("checkpoints")
    }

    /// Save a checkpoint to disk
    pub fn save(&self, checkpoint: &ExecutionCheckpoint) -> std::io::Result<PathBuf> {
        let filename = format!(
            "{}_{}.checkpoint.json",
            checkpoint.execution_id,
            checkpoint.checkpoint_at.format("%Y%m%d_%H%M%S")
        );
        let path = self.checkpoint_dir.join(&filename);

        let json = serde_json::to_string_pretty(checkpoint)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;

        std::fs::write(&path, json)?;

        log::info!("Saved checkpoint to {:?}", path);
        Ok(path)
    }

    /// Load a checkpoint from disk
    pub fn load(&self, checkpoint_id: &Uuid) -> std::io::Result<ExecutionCheckpoint> {
        // Find the checkpoint file
        let entries = std::fs::read_dir(&self.checkpoint_dir)?;

        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map(|e| e == "json").unwrap_or(false) {
                if path.file_name()
                    .and_then(|n| n.to_str())
                    .map(|n| n.contains(&checkpoint_id.to_string()))
                    .unwrap_or(false)
                {
                    let content = std::fs::read_to_string(&path)?;
                    let checkpoint: ExecutionCheckpoint = serde_json::from_str(&content)
                        .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;
                    return Ok(checkpoint);
                }
            }
        }

        Err(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            format!("Checkpoint {} not found", checkpoint_id),
        ))
    }

    /// Load the latest checkpoint for an execution
    pub fn load_latest(&self, execution_id: &Uuid) -> std::io::Result<ExecutionCheckpoint> {
        let entries = std::fs::read_dir(&self.checkpoint_dir)?;

        let mut checkpoints: Vec<(PathBuf, DateTime<Utc>)> = Vec::new();

        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map(|e| e == "json").unwrap_or(false) {
                if path.file_name()
                    .and_then(|n| n.to_str())
                    .map(|n| n.starts_with(&execution_id.to_string()))
                    .unwrap_or(false)
                {
                    // Extract timestamp from filename
                    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                        if let Some(ts_str) = name.split('_').nth(1) {
                            if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(
                                ts_str.trim_end_matches(".checkpoint.json"),
                                "%Y%m%d_%H%M%S",
                            ) {
                                let dt = dt.and_utc();
                                checkpoints.push((path, dt));
                            }
                        }
                    }
                }
            }
        }

        checkpoints.sort_by(|a, b| b.1.cmp(&a.1));

        if let Some((path, _)) = checkpoints.first() {
            let content = std::fs::read_to_string(path)?;
            let checkpoint: ExecutionCheckpoint = serde_json::from_str(&content)
                .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;
            return Ok(checkpoint);
        }

        Err(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            format!("No checkpoints found for execution {}", execution_id),
        ))
    }

    /// List all checkpoints
    pub fn list(&self) -> std::io::Result<Vec<CheckpointSummary>> {
        let entries = std::fs::read_dir(&self.checkpoint_dir)?;

        let mut summaries = Vec::new();

        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map(|e| e == "json").unwrap_or(false) {
                if let Ok(content) = std::fs::read_to_string(&path) {
                    if let Ok(checkpoint) = serde_json::from_str::<ExecutionCheckpoint>(&content) {
                        summaries.push(checkpoint.get_summary());
                    }
                }
            }
        }

        // Sort by checkpoint time, newest first
        summaries.sort_by(|a, b| b.checkpoint_at.cmp(&a.checkpoint_at));

        Ok(summaries)
    }

    /// List checkpoints for a specific execution
    pub fn list_for_execution(&self, execution_id: &Uuid) -> std::io::Result<Vec<CheckpointSummary>> {
        let all = self.list()?;
        Ok(all.into_iter().filter(|s| s.execution_id == *execution_id).collect())
    }

    /// Delete old checkpoints (keep only the latest N per execution)
    pub fn cleanup(&self, keep_per_execution: usize) -> std::io::Result<usize> {
        let all = self.list()?;

        // Group by execution_id
        let mut by_execution: HashMap<Uuid, Vec<CheckpointSummary>> = HashMap::new();
        for summary in all {
            by_execution
                .entry(summary.execution_id)
                .or_default()
                .push(summary);
        }

        let mut deleted = 0;

        for (execution_id, mut checkpoints) in by_execution {
            // Sort by time, newest first
            checkpoints.sort_by(|a, b| b.checkpoint_at.cmp(&a.checkpoint_at));

            // Delete all but the first N
            for checkpoint in checkpoints.into_iter().skip(keep_per_execution) {
                let filename = format!(
                    "{}_{}.checkpoint.json",
                    execution_id,
                    checkpoint.checkpoint_at.format("%Y%m%d_%H%M%S")
                );
                let path = self.checkpoint_dir.join(&filename);
                if std::fs::remove_file(&path).is_ok() {
                    deleted += 1;
                }
            }
        }

        Ok(deleted)
    }

    /// Delete all checkpoints for an execution
    pub fn delete_for_execution(&self, execution_id: &Uuid) -> std::io::Result<usize> {
        let entries = std::fs::read_dir(&self.checkpoint_dir)?;

        let mut deleted = 0;

        for entry in entries.flatten() {
            let path = entry.path();
            if path.file_name()
                .and_then(|n| n.to_str())
                .map(|n| n.starts_with(&execution_id.to_string()))
                .unwrap_or(false)
            {
                if std::fs::remove_file(&path).is_ok() {
                    deleted += 1;
                }
            }
        }

        Ok(deleted)
    }
}

/// Automatic checkpoint trigger conditions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CheckpointTrigger {
    /// Checkpoint after each level completes
    AfterLevel,
    /// Checkpoint after N nodes complete
    AfterNNodes { count: usize },
    /// Checkpoint on any failure
    OnFailure,
    /// Checkpoint at regular intervals
    Interval { seconds: u64 },
    /// Manual only (no automatic checkpoints)
    Manual,
}

impl Default for CheckpointTrigger {
    fn default() -> Self {
        Self::AfterLevel
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_checkpoint_summary() {
        let mut node_states = HashMap::new();
        node_states.insert(
            "node-1".to_string(),
            NodeCheckpointState {
                node_id: "node-1".to_string(),
                status: NodeExecutionStatus::Completed,
                agent_id: None,
                progress: 100,
                started_at: Some(Utc::now()),
                completed_at: Some(Utc::now()),
                output: None,
                error: None,
                retry_attempts: vec![],
            },
        );
        node_states.insert(
            "node-2".to_string(),
            NodeCheckpointState {
                node_id: "node-2".to_string(),
                status: NodeExecutionStatus::Pending,
                agent_id: None,
                progress: 0,
                started_at: None,
                completed_at: None,
                output: None,
                error: None,
                retry_attempts: vec![],
            },
        );

        let checkpoint = ExecutionCheckpoint::new(
            Uuid::new_v4(),
            Uuid::new_v4(),
            Uuid::new_v4(),
            "Test prompt".to_string(),
            ExecutionStatus::Running,
            node_states,
            vec![vec!["node-1".to_string()], vec!["node-2".to_string()]],
            HashMap::new(),
            HashMap::new(),
            Utc::now(),
            0,
        );

        let summary = checkpoint.get_summary();
        assert_eq!(summary.total_nodes, 2);
        assert_eq!(summary.completed_nodes, 1);
        assert_eq!(summary.pending_nodes, 1);
        assert_eq!(summary.progress, 50.0);
    }

    #[test]
    fn test_get_interrupted_nodes() {
        let mut node_states = HashMap::new();
        node_states.insert(
            "running-node".to_string(),
            NodeCheckpointState {
                node_id: "running-node".to_string(),
                status: NodeExecutionStatus::Running,
                agent_id: None,
                progress: 50,
                started_at: Some(Utc::now()),
                completed_at: None,
                output: None,
                error: None,
                retry_attempts: vec![],
            },
        );

        let checkpoint = ExecutionCheckpoint::new(
            Uuid::new_v4(),
            Uuid::new_v4(),
            Uuid::new_v4(),
            "Test".to_string(),
            ExecutionStatus::Running,
            node_states,
            vec![],
            HashMap::new(),
            HashMap::new(),
            Utc::now(),
            0,
        );

        let interrupted = checkpoint.get_interrupted_nodes();
        assert_eq!(interrupted.len(), 1);
        assert_eq!(interrupted[0], "running-node");
    }
}
