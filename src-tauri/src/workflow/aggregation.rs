//! Output aggregation strategies for combining results from parallel agents.
//!
//! When multiple agents run in parallel and feed into a single downstream node,
//! we need strategies to combine their outputs meaningfully.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use super::context::{AgentOutput, OutputData};

/// Strategy for aggregating outputs from multiple predecessor nodes
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum AggregationStrategy {
    /// Concatenate all outputs with separators
    Concatenate {
        separator: String,
        include_source: bool,
    },

    /// Merge JSON objects (later overwrites earlier on conflicts)
    MergeJson {
        deep_merge: bool,
    },

    /// Collect all outputs into a JSON array
    CollectArray,

    /// Use only the output from a specific predecessor
    SelectOne {
        node_id: String,
    },

    /// Use the first non-empty output
    FirstNonEmpty,

    /// Use the output with the most content
    Longest,

    /// Use the output with the least content
    Shortest,

    /// Use a voting mechanism (for structured outputs)
    Majority {
        field: String,
    },

    /// Custom template-based aggregation
    Template {
        template: String,
    },

    /// Pass outputs as key-value pairs
    KeyValue {
        key_field: Option<String>,
    },

    /// Structured summary with metadata
    StructuredSummary,
}

impl Default for AggregationStrategy {
    fn default() -> Self {
        Self::Concatenate {
            separator: "\n\n---\n\n".to_string(),
            include_source: true,
        }
    }
}

impl AggregationStrategy {
    /// Aggregate multiple outputs using this strategy
    pub fn aggregate(&self, outputs: &[AgentOutput]) -> AggregatedOutput {
        if outputs.is_empty() {
            return AggregatedOutput {
                data: OutputData::Text(String::new()),
                sources: Vec::new(),
                strategy_used: format!("{:?}", self),
            };
        }

        let sources: Vec<_> = outputs
            .iter()
            .map(|o| OutputSource {
                node_id: o.node_id.clone(),
                agent_role: o.agent_role.clone(),
                timestamp: o.timestamp,
            })
            .collect();

        let data = match self {
            AggregationStrategy::Concatenate { separator, include_source } => {
                let text = outputs
                    .iter()
                    .map(|o| {
                        let content = o.data.to_context_string();
                        if *include_source {
                            format!("[From {} ({})]\n{}", o.node_id, o.agent_role, content)
                        } else {
                            content
                        }
                    })
                    .collect::<Vec<_>>()
                    .join(separator);
                OutputData::Text(text)
            }

            AggregationStrategy::MergeJson { deep_merge } => {
                let mut merged = serde_json::Map::new();

                for output in outputs {
                    if let OutputData::Json(serde_json::Value::Object(obj)) = &output.data {
                        for (key, value) in obj {
                            if *deep_merge {
                                deep_merge_json(&mut merged, key, value.clone());
                            } else {
                                merged.insert(key.clone(), value.clone());
                            }
                        }
                    } else {
                        // Try to parse as JSON
                        let text = output.data.to_context_string();
                        if let Ok(serde_json::Value::Object(obj)) = serde_json::from_str(&text) {
                            for (key, value) in obj {
                                if *deep_merge {
                                    deep_merge_json(&mut merged, &key, value);
                                } else {
                                    merged.insert(key, value);
                                }
                            }
                        }
                    }
                }

                OutputData::Json(serde_json::Value::Object(merged))
            }

            AggregationStrategy::CollectArray => {
                let items: Vec<serde_json::Value> = outputs
                    .iter()
                    .map(|o| {
                        serde_json::json!({
                            "source": {
                                "node_id": o.node_id,
                                "agent_role": o.agent_role,
                                "timestamp": o.timestamp.to_rfc3339(),
                            },
                            "output": o.data.to_context_string(),
                        })
                    })
                    .collect();
                OutputData::Json(serde_json::Value::Array(items))
            }

            AggregationStrategy::SelectOne { node_id } => {
                if let Some(output) = outputs.iter().find(|o| o.node_id == *node_id) {
                    output.data.clone()
                } else {
                    OutputData::Error {
                        message: format!("Node {} not found in outputs", node_id),
                        details: None,
                    }
                }
            }

            AggregationStrategy::FirstNonEmpty => {
                for output in outputs {
                    let content = output.data.to_context_string();
                    if !content.trim().is_empty() {
                        return AggregatedOutput {
                            data: output.data.clone(),
                            sources,
                            strategy_used: "FirstNonEmpty".to_string(),
                        };
                    }
                }
                OutputData::Text(String::new())
            }

            AggregationStrategy::Longest => {
                outputs
                    .iter()
                    .max_by_key(|o| o.data.to_context_string().len())
                    .map(|o| o.data.clone())
                    .unwrap_or(OutputData::Text(String::new()))
            }

            AggregationStrategy::Shortest => {
                outputs
                    .iter()
                    .filter(|o| !o.data.to_context_string().is_empty())
                    .min_by_key(|o| o.data.to_context_string().len())
                    .map(|o| o.data.clone())
                    .unwrap_or(OutputData::Text(String::new()))
            }

            AggregationStrategy::Majority { field } => {
                let mut votes: HashMap<String, usize> = HashMap::new();

                for output in outputs {
                    // Try to extract the field value
                    let content = output.data.to_context_string();
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                        if let Some(value) = json.get(field) {
                            let key = value.to_string();
                            *votes.entry(key).or_insert(0) += 1;
                        }
                    }
                }

                if let Some((winner, count)) = votes.iter().max_by_key(|(_, v)| *v) {
                    OutputData::Json(serde_json::json!({
                        "field": field,
                        "value": winner,
                        "votes": count,
                        "total_voters": outputs.len(),
                    }))
                } else {
                    OutputData::Error {
                        message: format!("No votes found for field '{}'", field),
                        details: None,
                    }
                }
            }

            AggregationStrategy::Template { template } => {
                let mut result = template.clone();

                // Replace placeholders like {{node_id}} with actual values
                for output in outputs {
                    let placeholder = format!("{{{{{}}}}}", output.node_id);
                    result = result.replace(&placeholder, &output.data.to_context_string());

                    // Also support {{role:architect}} syntax
                    let role_placeholder = format!("{{{{role:{}}}}}", output.agent_role);
                    result = result.replace(&role_placeholder, &output.data.to_context_string());
                }

                OutputData::Text(result)
            }

            AggregationStrategy::KeyValue { key_field } => {
                let pairs: Vec<(String, String)> = outputs
                    .iter()
                    .map(|o| {
                        let key = if let Some(field) = key_field {
                            // Try to extract key from JSON output
                            let content = o.data.to_context_string();
                            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                                json.get(field)
                                    .map(|v| v.as_str().unwrap_or(&v.to_string()).to_string())
                                    .unwrap_or_else(|| o.node_id.clone())
                            } else {
                                o.node_id.clone()
                            }
                        } else {
                            o.node_id.clone()
                        };
                        (key, o.data.to_context_string())
                    })
                    .collect();

                OutputData::KeyValue(pairs)
            }

            AggregationStrategy::StructuredSummary => {
                let output_summaries: Vec<serde_json::Value> = outputs.iter().map(|o| {
                    let content = o.data.to_context_string();
                    let preview = if content.len() > 200 {
                        format!("{}...", &content[..200])
                    } else {
                        content.clone()
                    };
                    serde_json::json!({
                        "node_id": o.node_id.clone(),
                        "agent_role": o.agent_role.clone(),
                        "timestamp": o.timestamp.to_rfc3339(),
                        "content_length": content.len(),
                        "content_preview": preview,
                        "tags": o.tags.clone(),
                    })
                }).collect();

                let summary = serde_json::json!({
                    "total_outputs": outputs.len(),
                    "outputs": output_summaries,
                });

                OutputData::Json(summary)
            }
        };

        AggregatedOutput {
            data,
            sources,
            strategy_used: format!("{:?}", self),
        }
    }
}

fn deep_merge_json(target: &mut serde_json::Map<String, serde_json::Value>, key: &str, value: serde_json::Value) {
    if let (Some(serde_json::Value::Object(existing)), serde_json::Value::Object(new)) =
        (target.get_mut(key), &value)
    {
        for (k, v) in new {
            deep_merge_json(existing, k, v.clone());
        }
    } else {
        target.insert(key.to_string(), value);
    }
}

/// Result of aggregation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AggregatedOutput {
    pub data: OutputData,
    pub sources: Vec<OutputSource>,
    pub strategy_used: String,
}

/// Information about an output source
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutputSource {
    pub node_id: String,
    pub agent_role: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

impl AggregatedOutput {
    /// Convert to a prompt-friendly string
    pub fn to_prompt_context(&self) -> String {
        let sources_str = self.sources
            .iter()
            .map(|s| format!("{} ({})", s.node_id, s.agent_role))
            .collect::<Vec<_>>()
            .join(", ");

        format!(
            "=== Aggregated Output ===\nSources: {}\nStrategy: {}\n\n{}",
            sources_str,
            self.strategy_used,
            self.data.to_context_string()
        )
    }
}

/// Configuration for a node's input aggregation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeAggregationConfig {
    /// The aggregation strategy to use
    pub strategy: AggregationStrategy,
    /// Filter outputs by tags
    pub filter_tags: Option<Vec<String>>,
    /// Only aggregate from specific predecessors
    pub only_from: Option<Vec<String>>,
    /// Exclude specific predecessors
    pub exclude_from: Option<Vec<String>>,
    /// Transform the aggregated output before passing
    pub transform: Option<OutputTransform>,
}

impl Default for NodeAggregationConfig {
    fn default() -> Self {
        Self {
            strategy: AggregationStrategy::default(),
            filter_tags: None,
            only_from: None,
            exclude_from: None,
            transform: None,
        }
    }
}

/// Transformation to apply after aggregation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum OutputTransform {
    /// Wrap in a prefix/suffix
    Wrap { prefix: String, suffix: String },
    /// Extract a specific field from JSON
    ExtractField { path: String },
    /// Apply a string template
    Template { template: String },
    /// Truncate to max length
    Truncate { max_length: usize, suffix: String },
}

impl OutputTransform {
    pub fn apply(&self, data: &OutputData) -> OutputData {
        match self {
            OutputTransform::Wrap { prefix, suffix } => {
                let content = data.to_context_string();
                OutputData::Text(format!("{}{}{}", prefix, content, suffix))
            }

            OutputTransform::ExtractField { path } => {
                let content = data.to_context_string();
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                    // Simple path extraction (dot notation)
                    let parts: Vec<&str> = path.split('.').collect();
                    let mut current = &json;
                    for part in parts {
                        match current.get(part) {
                            Some(v) => current = v,
                            None => {
                                return OutputData::Error {
                                    message: format!("Path '{}' not found", path),
                                    details: None,
                                };
                            }
                        }
                    }
                    OutputData::Json(current.clone())
                } else {
                    OutputData::Error {
                        message: "Input is not valid JSON".to_string(),
                        details: None,
                    }
                }
            }

            OutputTransform::Template { template } => {
                let content = data.to_context_string();
                let result = template.replace("{{content}}", &content);
                OutputData::Text(result)
            }

            OutputTransform::Truncate { max_length, suffix } => {
                let content = data.to_context_string();
                if content.len() > *max_length {
                    OutputData::Text(format!("{}{}", &content[..*max_length], suffix))
                } else {
                    data.clone()
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use uuid::Uuid;

    fn create_test_outputs() -> Vec<AgentOutput> {
        vec![
            AgentOutput {
                agent_id: Uuid::new_v4(),
                node_id: "architect".to_string(),
                agent_role: "architect".to_string(),
                data: OutputData::Text("Use microservices architecture".to_string()),
                timestamp: Utc::now(),
                tags: vec!["design".to_string()],
            },
            AgentOutput {
                agent_id: Uuid::new_v4(),
                node_id: "security".to_string(),
                agent_role: "security".to_string(),
                data: OutputData::Text("Implement OAuth2 for authentication".to_string()),
                timestamp: Utc::now(),
                tags: vec!["security".to_string()],
            },
        ]
    }

    #[test]
    fn test_concatenate_strategy() {
        let outputs = create_test_outputs();
        let strategy = AggregationStrategy::Concatenate {
            separator: "\n---\n".to_string(),
            include_source: true,
        };

        let result = strategy.aggregate(&outputs);
        let text = result.data.to_context_string();

        assert!(text.contains("microservices"));
        assert!(text.contains("OAuth2"));
        assert!(text.contains("[From architect"));
    }

    #[test]
    fn test_collect_array_strategy() {
        let outputs = create_test_outputs();
        let strategy = AggregationStrategy::CollectArray;

        let result = strategy.aggregate(&outputs);
        if let OutputData::Json(serde_json::Value::Array(arr)) = result.data {
            assert_eq!(arr.len(), 2);
        } else {
            panic!("Expected JSON array");
        }
    }

    #[test]
    fn test_select_one_strategy() {
        let outputs = create_test_outputs();
        let strategy = AggregationStrategy::SelectOne {
            node_id: "security".to_string(),
        };

        let result = strategy.aggregate(&outputs);
        let text = result.data.to_context_string();

        assert!(text.contains("OAuth2"));
        assert!(!text.contains("microservices"));
    }

    #[test]
    fn test_template_strategy() {
        let outputs = create_test_outputs();
        let strategy = AggregationStrategy::Template {
            template: "Architecture: {{architect}}\nSecurity: {{security}}".to_string(),
        };

        let result = strategy.aggregate(&outputs);
        let text = result.data.to_context_string();

        assert!(text.contains("Architecture: Use microservices"));
        assert!(text.contains("Security: Implement OAuth2"));
    }

    #[test]
    fn test_longest_strategy() {
        let outputs = create_test_outputs();
        let strategy = AggregationStrategy::Longest;

        let result = strategy.aggregate(&outputs);
        let text = result.data.to_context_string();

        // "Implement OAuth2 for authentication" is longer than "Use microservices architecture"
        assert!(text.contains("OAuth2"));
    }
}
