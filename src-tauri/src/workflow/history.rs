//! Execution history tracking and replay capabilities.
//!
//! Stores detailed records of past workflow executions for:
//! - Debugging and analysis
//! - Performance comparison
//! - Audit trails
//! - Execution replay

use chrono::{DateTime, Utc};
use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use uuid::Uuid;

use super::context::AgentOutput;
use super::state::{ExecutionStatus, NodeExecutionStatus};

/// A complete record of a workflow execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionRecord {
    /// Unique execution ID
    pub id: Uuid,
    /// Workflow that was executed (None for orchestrated)
    pub workflow_id: Option<Uuid>,
    /// Workflow name at time of execution
    pub workflow_name: String,
    /// Project context
    pub project_id: Uuid,
    /// Project name at time of execution
    pub project_name: String,
    /// Original input prompt
    pub input_prompt: String,
    /// Final status
    pub status: ExecutionStatus,
    /// When execution started
    pub started_at: DateTime<Utc>,
    /// When execution completed
    pub completed_at: Option<DateTime<Utc>>,
    /// Total duration in milliseconds
    pub duration_ms: Option<u64>,
    /// Number of nodes in the workflow
    pub total_nodes: usize,
    /// Number of nodes that completed successfully
    pub completed_nodes: usize,
    /// Number of nodes that failed
    pub failed_nodes: usize,
    /// Number of nodes that were skipped
    pub skipped_nodes: usize,
    /// Detailed node execution records
    pub node_records: Vec<NodeExecutionRecord>,
    /// Agent outputs collected during execution
    pub outputs: HashMap<String, Vec<AgentOutput>>,
    /// Execution timeline events
    pub timeline: Vec<TimelineEvent>,
    /// Execution metrics
    pub metrics: ExecutionMetrics,
    /// Tags for categorization
    pub tags: Vec<String>,
    /// User notes
    pub notes: Option<String>,
}

/// Record of a single node's execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeExecutionRecord {
    pub node_id: String,
    pub node_name: String,
    pub agent_role: String,
    pub agent_id: Option<Uuid>,
    pub status: NodeExecutionStatus,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub duration_ms: Option<u64>,
    pub retry_count: u32,
    pub output_summary: Option<String>,
    pub error: Option<String>,
}

/// Timeline event during execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineEvent {
    pub timestamp: DateTime<Utc>,
    pub event_type: TimelineEventType,
    pub node_id: Option<String>,
    pub message: String,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TimelineEventType {
    ExecutionStarted,
    ExecutionCompleted,
    ExecutionFailed,
    ExecutionCancelled,
    LevelStarted,
    LevelCompleted,
    NodeStarted,
    NodeCompleted,
    NodeFailed,
    NodeSkipped,
    NodeRetry,
    AgentSpawned,
    AgentOutput,
    ContextUpdated,
    CheckpointCreated,
    ReplanTriggered,
    Custom,
}

/// Metrics collected during execution
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ExecutionMetrics {
    /// Total tokens used (if tracked)
    pub total_tokens: Option<u64>,
    /// Total API calls made
    pub api_calls: u32,
    /// Average node execution time in ms
    pub avg_node_duration_ms: Option<u64>,
    /// Longest node execution time
    pub max_node_duration_ms: Option<u64>,
    /// Shortest node execution time
    pub min_node_duration_ms: Option<u64>,
    /// Number of retries across all nodes
    pub total_retries: u32,
    /// Parallel execution efficiency (0-100%)
    pub parallelism_efficiency: Option<f32>,
    /// Memory usage peak (bytes)
    pub peak_memory_bytes: Option<u64>,
}

/// In-memory execution history store
pub struct ExecutionHistoryStore {
    records: DashMap<Uuid, ExecutionRecord>,
    /// Maximum number of records to keep
    max_records: usize,
}

impl ExecutionHistoryStore {
    pub fn new(max_records: usize) -> Self {
        Self {
            records: DashMap::new(),
            max_records,
        }
    }

    /// Add a new execution record
    pub fn add(&self, record: ExecutionRecord) {
        // Remove oldest records if we're at capacity
        if self.records.len() >= self.max_records {
            self.cleanup_oldest(self.max_records / 10); // Remove 10% oldest
        }
        self.records.insert(record.id, record);
    }

    /// Get a record by ID
    pub fn get(&self, id: &Uuid) -> Option<ExecutionRecord> {
        self.records.get(id).map(|r| r.clone())
    }

    /// List all records, sorted by start time (newest first)
    pub fn list(&self) -> Vec<ExecutionRecord> {
        let mut records: Vec<_> = self.records.iter().map(|r| r.clone()).collect();
        records.sort_by(|a, b| b.started_at.cmp(&a.started_at));
        records
    }

    /// List records for a specific project
    pub fn list_for_project(&self, project_id: &Uuid) -> Vec<ExecutionRecord> {
        self.list()
            .into_iter()
            .filter(|r| r.project_id == *project_id)
            .collect()
    }

    /// List records for a specific workflow
    pub fn list_for_workflow(&self, workflow_id: &Uuid) -> Vec<ExecutionRecord> {
        self.list()
            .into_iter()
            .filter(|r| r.workflow_id == Some(*workflow_id))
            .collect()
    }

    /// Search records by input prompt
    pub fn search(&self, query: &str) -> Vec<ExecutionRecord> {
        let query_lower = query.to_lowercase();
        self.list()
            .into_iter()
            .filter(|r| {
                r.input_prompt.to_lowercase().contains(&query_lower)
                    || r.workflow_name.to_lowercase().contains(&query_lower)
                    || r.tags.iter().any(|t| t.to_lowercase().contains(&query_lower))
            })
            .collect()
    }

    /// Get records by status
    pub fn list_by_status(&self, status: ExecutionStatus) -> Vec<ExecutionRecord> {
        self.list()
            .into_iter()
            .filter(|r| r.status == status)
            .collect()
    }

    /// Delete a record
    pub fn delete(&self, id: &Uuid) -> Option<ExecutionRecord> {
        self.records.remove(id).map(|(_, v)| v)
    }

    /// Update notes for a record
    pub fn update_notes(&self, id: &Uuid, notes: String) -> bool {
        if let Some(mut record) = self.records.get_mut(id) {
            record.notes = Some(notes);
            true
        } else {
            false
        }
    }

    /// Add tags to a record
    pub fn add_tags(&self, id: &Uuid, tags: Vec<String>) -> bool {
        if let Some(mut record) = self.records.get_mut(id) {
            record.tags.extend(tags);
            record.tags.sort();
            record.tags.dedup();
            true
        } else {
            false
        }
    }

    /// Get execution statistics
    pub fn get_statistics(&self) -> HistoryStatistics {
        let records = self.list();
        let total = records.len();

        if total == 0 {
            return HistoryStatistics::default();
        }

        let completed = records.iter().filter(|r| r.status == ExecutionStatus::Completed).count();
        let failed = records.iter().filter(|r| r.status == ExecutionStatus::Failed).count();
        let cancelled = records.iter().filter(|r| r.status == ExecutionStatus::Cancelled).count();

        let durations: Vec<u64> = records.iter().filter_map(|r| r.duration_ms).collect();
        let avg_duration = if durations.is_empty() {
            None
        } else {
            Some(durations.iter().sum::<u64>() / durations.len() as u64)
        };

        let total_nodes: usize = records.iter().map(|r| r.total_nodes).sum();
        let total_completed_nodes: usize = records.iter().map(|r| r.completed_nodes).sum();

        HistoryStatistics {
            total_executions: total,
            completed_executions: completed,
            failed_executions: failed,
            cancelled_executions: cancelled,
            success_rate: (completed as f32 / total as f32) * 100.0,
            average_duration_ms: avg_duration,
            total_nodes_executed: total_nodes,
            total_nodes_completed: total_completed_nodes,
            node_success_rate: if total_nodes > 0 {
                (total_completed_nodes as f32 / total_nodes as f32) * 100.0
            } else {
                0.0
            },
        }
    }

    /// Remove oldest records
    fn cleanup_oldest(&self, count: usize) {
        let mut records = self.list();
        records.sort_by(|a, b| a.started_at.cmp(&b.started_at)); // Oldest first

        for record in records.into_iter().take(count) {
            self.records.remove(&record.id);
        }
    }
}

impl Default for ExecutionHistoryStore {
    fn default() -> Self {
        Self::new(1000) // Keep last 1000 executions
    }
}

/// Statistics about execution history
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct HistoryStatistics {
    pub total_executions: usize,
    pub completed_executions: usize,
    pub failed_executions: usize,
    pub cancelled_executions: usize,
    pub success_rate: f32,
    pub average_duration_ms: Option<u64>,
    pub total_nodes_executed: usize,
    pub total_nodes_completed: usize,
    pub node_success_rate: f32,
}

/// Builder for creating execution records
pub struct ExecutionRecordBuilder {
    id: Uuid,
    workflow_id: Option<Uuid>,
    workflow_name: String,
    project_id: Uuid,
    project_name: String,
    input_prompt: String,
    started_at: DateTime<Utc>,
    node_records: Vec<NodeExecutionRecord>,
    timeline: Vec<TimelineEvent>,
    outputs: HashMap<String, Vec<AgentOutput>>,
    tags: Vec<String>,
}

impl ExecutionRecordBuilder {
    pub fn new(
        id: Uuid,
        project_id: Uuid,
        project_name: String,
        input_prompt: String,
    ) -> Self {
        Self {
            id,
            workflow_id: None,
            workflow_name: "Orchestrated Workflow".to_string(),
            project_id,
            project_name,
            input_prompt,
            started_at: Utc::now(),
            node_records: Vec::new(),
            timeline: Vec::new(),
            outputs: HashMap::new(),
            tags: Vec::new(),
        }
    }

    pub fn workflow(mut self, workflow_id: Uuid, workflow_name: String) -> Self {
        self.workflow_id = Some(workflow_id);
        self.workflow_name = workflow_name;
        self
    }

    pub fn add_timeline_event(&mut self, event: TimelineEvent) {
        self.timeline.push(event);
    }

    pub fn add_node_record(&mut self, record: NodeExecutionRecord) {
        self.node_records.push(record);
    }

    pub fn add_output(&mut self, node_id: String, output: AgentOutput) {
        self.outputs.entry(node_id).or_default().push(output);
    }

    pub fn tags(mut self, tags: Vec<String>) -> Self {
        self.tags = tags;
        self
    }

    pub fn build(self, status: ExecutionStatus, completed_at: DateTime<Utc>) -> ExecutionRecord {
        let duration_ms = (completed_at - self.started_at).num_milliseconds() as u64;

        let total_nodes = self.node_records.len();
        let completed_nodes = self.node_records.iter()
            .filter(|n| n.status == NodeExecutionStatus::Completed)
            .count();
        let failed_nodes = self.node_records.iter()
            .filter(|n| n.status == NodeExecutionStatus::Failed)
            .count();
        let skipped_nodes = self.node_records.iter()
            .filter(|n| n.status == NodeExecutionStatus::Skipped)
            .count();

        // Calculate metrics
        let node_durations: Vec<u64> = self.node_records.iter()
            .filter_map(|n| n.duration_ms)
            .collect();

        let metrics = ExecutionMetrics {
            total_tokens: None,
            api_calls: self.node_records.len() as u32,
            avg_node_duration_ms: if node_durations.is_empty() {
                None
            } else {
                Some(node_durations.iter().sum::<u64>() / node_durations.len() as u64)
            },
            max_node_duration_ms: node_durations.iter().max().copied(),
            min_node_duration_ms: node_durations.iter().min().copied(),
            total_retries: self.node_records.iter().map(|n| n.retry_count).sum(),
            parallelism_efficiency: None,
            peak_memory_bytes: None,
        };

        ExecutionRecord {
            id: self.id,
            workflow_id: self.workflow_id,
            workflow_name: self.workflow_name,
            project_id: self.project_id,
            project_name: self.project_name,
            input_prompt: self.input_prompt,
            status,
            started_at: self.started_at,
            completed_at: Some(completed_at),
            duration_ms: Some(duration_ms),
            total_nodes,
            completed_nodes,
            failed_nodes,
            skipped_nodes,
            node_records: self.node_records,
            outputs: self.outputs,
            timeline: self.timeline,
            metrics,
            tags: self.tags,
            notes: None,
        }
    }
}

/// Persistent history storage using JSON files
pub struct PersistentHistoryStore {
    store_dir: PathBuf,
    memory_store: ExecutionHistoryStore,
}

impl PersistentHistoryStore {
    pub fn new(store_dir: PathBuf) -> std::io::Result<Self> {
        std::fs::create_dir_all(&store_dir)?;

        let memory_store = ExecutionHistoryStore::new(100); // Keep 100 in memory

        // Load recent records from disk
        let mut store = Self { store_dir, memory_store };
        store.load_recent(100)?;

        Ok(store)
    }

    pub fn default_store_dir() -> PathBuf {
        dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("nexus")
            .join("history")
    }

    /// Save a record to disk and memory
    pub fn save(&self, record: &ExecutionRecord) -> std::io::Result<()> {
        let filename = format!("{}_{}.json",
            record.started_at.format("%Y%m%d_%H%M%S"),
            record.id
        );
        let path = self.store_dir.join(&filename);

        let json = serde_json::to_string_pretty(record)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;

        std::fs::write(&path, json)?;
        self.memory_store.add(record.clone());

        Ok(())
    }

    /// Load a record by ID
    pub fn load(&self, id: &Uuid) -> std::io::Result<ExecutionRecord> {
        // Check memory first
        if let Some(record) = self.memory_store.get(id) {
            return Ok(record);
        }

        // Search on disk
        for entry in std::fs::read_dir(&self.store_dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.file_name()
                .and_then(|n| n.to_str())
                .map(|n| n.contains(&id.to_string()))
                .unwrap_or(false)
            {
                let content = std::fs::read_to_string(&path)?;
                let record: ExecutionRecord = serde_json::from_str(&content)
                    .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;
                return Ok(record);
            }
        }

        Err(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            format!("Record {} not found", id),
        ))
    }

    /// List records from memory
    pub fn list(&self) -> Vec<ExecutionRecord> {
        self.memory_store.list()
    }

    /// Get statistics
    pub fn get_statistics(&self) -> HistoryStatistics {
        self.memory_store.get_statistics()
    }

    /// Load recent records from disk
    fn load_recent(&mut self, count: usize) -> std::io::Result<()> {
        let mut files: Vec<_> = std::fs::read_dir(&self.store_dir)?
            .filter_map(|e| e.ok())
            .filter(|e| e.path().extension().map(|ext| ext == "json").unwrap_or(false))
            .collect();

        // Sort by filename (which includes timestamp)
        files.sort_by(|a, b| b.file_name().cmp(&a.file_name()));

        for entry in files.into_iter().take(count) {
            if let Ok(content) = std::fs::read_to_string(entry.path()) {
                if let Ok(record) = serde_json::from_str::<ExecutionRecord>(&content) {
                    self.memory_store.add(record);
                }
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_execution_record_builder() {
        let mut builder = ExecutionRecordBuilder::new(
            Uuid::new_v4(),
            Uuid::new_v4(),
            "Test Project".to_string(),
            "Test prompt".to_string(),
        );

        builder.add_node_record(NodeExecutionRecord {
            node_id: "node-1".to_string(),
            node_name: "Test Node".to_string(),
            agent_role: "implementer".to_string(),
            agent_id: Some(Uuid::new_v4()),
            status: NodeExecutionStatus::Completed,
            started_at: Some(Utc::now()),
            completed_at: Some(Utc::now()),
            duration_ms: Some(1000),
            retry_count: 0,
            output_summary: Some("Done".to_string()),
            error: None,
        });

        let record = builder.build(ExecutionStatus::Completed, Utc::now());

        assert_eq!(record.total_nodes, 1);
        assert_eq!(record.completed_nodes, 1);
        assert_eq!(record.status, ExecutionStatus::Completed);
    }

    #[test]
    fn test_history_store() {
        let store = ExecutionHistoryStore::new(10);

        let record = ExecutionRecord {
            id: Uuid::new_v4(),
            workflow_id: None,
            workflow_name: "Test".to_string(),
            project_id: Uuid::new_v4(),
            project_name: "Project".to_string(),
            input_prompt: "Test".to_string(),
            status: ExecutionStatus::Completed,
            started_at: Utc::now(),
            completed_at: Some(Utc::now()),
            duration_ms: Some(1000),
            total_nodes: 1,
            completed_nodes: 1,
            failed_nodes: 0,
            skipped_nodes: 0,
            node_records: vec![],
            outputs: HashMap::new(),
            timeline: vec![],
            metrics: ExecutionMetrics::default(),
            tags: vec![],
            notes: None,
        };

        store.add(record.clone());

        let retrieved = store.get(&record.id);
        assert!(retrieved.is_some());

        let stats = store.get_statistics();
        assert_eq!(stats.total_executions, 1);
        assert_eq!(stats.success_rate, 100.0);
    }
}
