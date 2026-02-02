//! Shared execution context for inter-agent communication and data flow.
//!
//! This module provides a shared memory system that allows agents to:
//! - Store and retrieve execution results
//! - Pass data to downstream agents
//! - Access aggregated outputs from parallel agents
//! - Share context across the workflow execution

use chrono::{DateTime, Utc};
use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

/// A single piece of data produced by an agent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentOutput {
    /// ID of the agent that produced this output
    pub agent_id: Uuid,
    /// Node ID in the workflow graph
    pub node_id: String,
    /// Role of the agent
    pub agent_role: String,
    /// The actual output data
    pub data: OutputData,
    /// When this output was produced
    pub timestamp: DateTime<Utc>,
    /// Optional tags for categorization
    pub tags: Vec<String>,
}

/// Types of data an agent can output
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "value")]
pub enum OutputData {
    /// Plain text output (most common)
    Text(String),
    /// Structured JSON data
    Json(serde_json::Value),
    /// File path to an artifact
    FilePath(String),
    /// Multiple files
    FileSet(Vec<String>),
    /// Code with language annotation
    Code { language: String, content: String },
    /// Error information
    Error { message: String, details: Option<String> },
    /// Key-value pairs
    KeyValue(Vec<(String, String)>),
}

impl OutputData {
    /// Convert output to a string representation for passing to downstream agents
    pub fn to_context_string(&self) -> String {
        match self {
            OutputData::Text(s) => s.clone(),
            OutputData::Json(v) => serde_json::to_string_pretty(v).unwrap_or_default(),
            OutputData::FilePath(p) => format!("File: {}", p),
            OutputData::FileSet(files) => {
                format!("Files:\n{}", files.iter().map(|f| format!("  - {}", f)).collect::<Vec<_>>().join("\n"))
            }
            OutputData::Code { language, content } => {
                format!("```{}\n{}\n```", language, content)
            }
            OutputData::Error { message, details } => {
                let mut s = format!("Error: {}", message);
                if let Some(d) = details {
                    s.push_str(&format!("\nDetails: {}", d));
                }
                s
            }
            OutputData::KeyValue(pairs) => {
                pairs.iter().map(|(k, v)| format!("{}: {}", k, v)).collect::<Vec<_>>().join("\n")
            }
        }
    }
}

/// Shared context for workflow execution
pub struct ExecutionContext {
    /// Unique execution ID
    pub execution_id: Uuid,
    /// Project ID for this execution
    pub project_id: Uuid,
    /// The original user prompt
    pub original_prompt: String,
    /// Outputs from each node, keyed by node_id
    outputs: DashMap<String, Vec<AgentOutput>>,
    /// Global variables that can be set by any agent
    variables: DashMap<String, serde_json::Value>,
    /// Execution metadata
    metadata: DashMap<String, String>,
    /// When execution started
    pub started_at: DateTime<Utc>,
}

impl ExecutionContext {
    /// Create a new execution context
    pub fn new(execution_id: Uuid, project_id: Uuid, original_prompt: String) -> Self {
        Self {
            execution_id,
            project_id,
            original_prompt,
            outputs: DashMap::new(),
            variables: DashMap::new(),
            metadata: DashMap::new(),
            started_at: Utc::now(),
        }
    }

    /// Store output from an agent
    pub fn store_output(&self, output: AgentOutput) {
        self.outputs
            .entry(output.node_id.clone())
            .or_insert_with(Vec::new)
            .push(output);
    }

    /// Get all outputs from a specific node
    pub fn get_node_outputs(&self, node_id: &str) -> Vec<AgentOutput> {
        self.outputs
            .get(node_id)
            .map(|v| v.clone())
            .unwrap_or_default()
    }

    /// Get the latest output from a node
    pub fn get_latest_output(&self, node_id: &str) -> Option<AgentOutput> {
        self.outputs
            .get(node_id)
            .and_then(|v| v.last().cloned())
    }

    /// Get outputs from multiple predecessor nodes (for aggregation)
    pub fn get_predecessor_outputs(&self, predecessor_ids: &[String]) -> Vec<AgentOutput> {
        predecessor_ids
            .iter()
            .flat_map(|id| self.get_node_outputs(id))
            .collect()
    }

    /// Aggregate outputs from predecessors into a single context string
    pub fn aggregate_predecessor_context(&self, predecessor_ids: &[String]) -> String {
        let outputs = self.get_predecessor_outputs(predecessor_ids);
        if outputs.is_empty() {
            return String::new();
        }

        let mut context = String::from("=== Context from Previous Agents ===\n\n");

        for output in outputs {
            context.push_str(&format!(
                "--- From {} ({}) ---\n{}\n\n",
                output.node_id,
                output.agent_role,
                output.data.to_context_string()
            ));
        }

        context
    }

    /// Set a global variable
    pub fn set_variable(&self, key: &str, value: serde_json::Value) {
        self.variables.insert(key.to_string(), value);
    }

    /// Get a global variable
    pub fn get_variable(&self, key: &str) -> Option<serde_json::Value> {
        self.variables.get(key).map(|v| v.clone())
    }

    /// Get all variables as a map
    pub fn get_all_variables(&self) -> std::collections::HashMap<String, serde_json::Value> {
        self.variables
            .iter()
            .map(|entry| (entry.key().clone(), entry.value().clone()))
            .collect()
    }

    /// Set metadata
    pub fn set_metadata(&self, key: &str, value: &str) {
        self.metadata.insert(key.to_string(), value.to_string());
    }

    /// Get metadata
    pub fn get_metadata(&self, key: &str) -> Option<String> {
        self.metadata.get(key).map(|v| v.clone())
    }

    /// Build a prompt context for a downstream agent
    /// Includes relevant outputs from predecessor nodes
    pub fn build_agent_prompt(
        &self,
        base_task: &str,
        predecessor_ids: &[String],
        include_original_prompt: bool,
    ) -> String {
        let mut prompt = String::new();

        // Include original user request if needed
        if include_original_prompt {
            prompt.push_str(&format!(
                "=== Original User Request ===\n{}\n\n",
                self.original_prompt
            ));
        }

        // Include context from predecessors
        let predecessor_context = self.aggregate_predecessor_context(predecessor_ids);
        if !predecessor_context.is_empty() {
            prompt.push_str(&predecessor_context);
        }

        // Include relevant variables
        let vars = self.get_all_variables();
        if !vars.is_empty() {
            prompt.push_str("=== Shared Variables ===\n");
            for (k, v) in vars {
                prompt.push_str(&format!("{}: {}\n", k, v));
            }
            prompt.push_str("\n");
        }

        // Add the actual task
        prompt.push_str(&format!("=== Your Task ===\n{}", base_task));

        prompt
    }

    /// Get a summary of all outputs for debugging/logging
    pub fn get_execution_summary(&self) -> ExecutionSummaryData {
        let node_outputs: Vec<_> = self.outputs
            .iter()
            .map(|entry| NodeOutputSummary {
                node_id: entry.key().clone(),
                output_count: entry.value().len(),
                latest_timestamp: entry.value().last().map(|o| o.timestamp),
            })
            .collect();

        ExecutionSummaryData {
            execution_id: self.execution_id,
            project_id: self.project_id,
            started_at: self.started_at,
            node_count: node_outputs.len(),
            total_outputs: node_outputs.iter().map(|n| n.output_count).sum(),
            variable_count: self.variables.len(),
            node_outputs,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeOutputSummary {
    pub node_id: String,
    pub output_count: usize,
    pub latest_timestamp: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionSummaryData {
    pub execution_id: Uuid,
    pub project_id: Uuid,
    pub started_at: DateTime<Utc>,
    pub node_count: usize,
    pub total_outputs: usize,
    pub variable_count: usize,
    pub node_outputs: Vec<NodeOutputSummary>,
}

/// Store for all execution contexts
pub struct ContextStore {
    contexts: DashMap<Uuid, Arc<ExecutionContext>>,
}

impl ContextStore {
    pub fn new() -> Self {
        Self {
            contexts: DashMap::new(),
        }
    }

    pub fn create(&self, execution_id: Uuid, project_id: Uuid, original_prompt: String) -> Arc<ExecutionContext> {
        let context = Arc::new(ExecutionContext::new(execution_id, project_id, original_prompt));
        self.contexts.insert(execution_id, context.clone());
        context
    }

    pub fn get(&self, execution_id: &Uuid) -> Option<Arc<ExecutionContext>> {
        self.contexts.get(execution_id).map(|v| v.clone())
    }

    pub fn remove(&self, execution_id: &Uuid) -> Option<Arc<ExecutionContext>> {
        self.contexts.remove(execution_id).map(|(_, v)| v)
    }
}

impl Default for ContextStore {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_output_storage_and_retrieval() {
        let ctx = ExecutionContext::new(Uuid::new_v4(), Uuid::new_v4(), "Test prompt".to_string());

        let output = AgentOutput {
            agent_id: Uuid::new_v4(),
            node_id: "node-1".to_string(),
            agent_role: "architect".to_string(),
            data: OutputData::Text("Design complete".to_string()),
            timestamp: Utc::now(),
            tags: vec!["design".to_string()],
        };

        ctx.store_output(output.clone());

        let retrieved = ctx.get_latest_output("node-1");
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().node_id, "node-1");
    }

    #[test]
    fn test_predecessor_aggregation() {
        let ctx = ExecutionContext::new(Uuid::new_v4(), Uuid::new_v4(), "Test prompt".to_string());

        // Store outputs from two predecessor nodes
        ctx.store_output(AgentOutput {
            agent_id: Uuid::new_v4(),
            node_id: "design".to_string(),
            agent_role: "architect".to_string(),
            data: OutputData::Text("Use microservices pattern".to_string()),
            timestamp: Utc::now(),
            tags: vec![],
        });

        ctx.store_output(AgentOutput {
            agent_id: Uuid::new_v4(),
            node_id: "security".to_string(),
            agent_role: "security".to_string(),
            data: OutputData::Text("Enable OAuth2 authentication".to_string()),
            timestamp: Utc::now(),
            tags: vec![],
        });

        let aggregated = ctx.aggregate_predecessor_context(&["design".to_string(), "security".to_string()]);
        assert!(aggregated.contains("microservices"));
        assert!(aggregated.contains("OAuth2"));
    }

    #[test]
    fn test_variables() {
        let ctx = ExecutionContext::new(Uuid::new_v4(), Uuid::new_v4(), "Test".to_string());

        ctx.set_variable("api_url", serde_json::json!("https://api.example.com"));
        ctx.set_variable("max_retries", serde_json::json!(3));

        assert_eq!(
            ctx.get_variable("api_url"),
            Some(serde_json::json!("https://api.example.com"))
        );
        assert_eq!(
            ctx.get_variable("max_retries"),
            Some(serde_json::json!(3))
        );
    }
}
