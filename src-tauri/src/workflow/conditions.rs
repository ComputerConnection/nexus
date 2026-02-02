//! Conditional execution support for workflow branching.
//!
//! Allows workflows to have dynamic execution paths based on:
//! - Node output values
//! - Execution context variables
//! - Custom conditions
//! - Success/failure status

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use super::context::ExecutionContext;
use super::state::NodeExecutionStatus;

/// A condition that determines whether a node should execute
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ExecutionCondition {
    /// Always execute (default)
    Always,

    /// Never execute (disabled node)
    Never,

    /// Execute only if predecessor succeeded
    OnSuccess { predecessor_id: String },

    /// Execute only if predecessor failed
    OnFailure { predecessor_id: String },

    /// Execute if all predecessors succeeded
    AllPredecessorsSucceeded,

    /// Execute if any predecessor succeeded
    AnyPredecessorSucceeded,

    /// Execute based on a variable value
    VariableEquals {
        variable: String,
        value: serde_json::Value,
    },

    /// Execute if variable exists and is truthy
    VariableTruthy { variable: String },

    /// Execute based on output content matching a pattern
    OutputContains {
        predecessor_id: String,
        pattern: String,
        case_sensitive: bool,
    },

    /// Execute based on JSON path in output
    OutputJsonPath {
        predecessor_id: String,
        path: String,
        expected_value: Option<serde_json::Value>,
    },

    /// Combine multiple conditions with AND
    And { conditions: Vec<ExecutionCondition> },

    /// Combine multiple conditions with OR
    Or { conditions: Vec<ExecutionCondition> },

    /// Negate a condition
    Not { condition: Box<ExecutionCondition> },

    /// Custom expression (evaluated at runtime)
    Expression { expr: String },
}

impl Default for ExecutionCondition {
    fn default() -> Self {
        Self::Always
    }
}

/// Result of evaluating a condition
#[derive(Debug, Clone)]
pub struct ConditionResult {
    pub should_execute: bool,
    pub reason: String,
    pub evaluated_conditions: Vec<String>,
}

impl ExecutionCondition {
    /// Evaluate this condition given the current context
    pub fn evaluate(
        &self,
        context: &ExecutionContext,
        node_statuses: &HashMap<String, NodeExecutionStatus>,
        predecessor_ids: &[String],
    ) -> ConditionResult {
        let mut evaluated = Vec::new();

        let (should_execute, reason) = self.evaluate_inner(
            context,
            node_statuses,
            predecessor_ids,
            &mut evaluated,
        );

        ConditionResult {
            should_execute,
            reason,
            evaluated_conditions: evaluated,
        }
    }

    fn evaluate_inner(
        &self,
        context: &ExecutionContext,
        node_statuses: &HashMap<String, NodeExecutionStatus>,
        predecessor_ids: &[String],
        evaluated: &mut Vec<String>,
    ) -> (bool, String) {
        match self {
            ExecutionCondition::Always => {
                evaluated.push("Always".to_string());
                (true, "Always execute".to_string())
            }

            ExecutionCondition::Never => {
                evaluated.push("Never".to_string());
                (false, "Node is disabled".to_string())
            }

            ExecutionCondition::OnSuccess { predecessor_id } => {
                evaluated.push(format!("OnSuccess({})", predecessor_id));
                match node_statuses.get(predecessor_id) {
                    Some(NodeExecutionStatus::Completed) => {
                        (true, format!("Predecessor {} succeeded", predecessor_id))
                    }
                    Some(status) => {
                        (false, format!("Predecessor {} has status {:?}", predecessor_id, status))
                    }
                    None => {
                        (false, format!("Predecessor {} not found", predecessor_id))
                    }
                }
            }

            ExecutionCondition::OnFailure { predecessor_id } => {
                evaluated.push(format!("OnFailure({})", predecessor_id));
                match node_statuses.get(predecessor_id) {
                    Some(NodeExecutionStatus::Failed) => {
                        (true, format!("Predecessor {} failed", predecessor_id))
                    }
                    Some(status) => {
                        (false, format!("Predecessor {} has status {:?}", predecessor_id, status))
                    }
                    None => {
                        (false, format!("Predecessor {} not found", predecessor_id))
                    }
                }
            }

            ExecutionCondition::AllPredecessorsSucceeded => {
                evaluated.push("AllPredecessorsSucceeded".to_string());
                let all_succeeded = predecessor_ids.iter().all(|id| {
                    matches!(node_statuses.get(id), Some(NodeExecutionStatus::Completed))
                });
                if all_succeeded {
                    (true, "All predecessors succeeded".to_string())
                } else {
                    let failed: Vec<_> = predecessor_ids
                        .iter()
                        .filter(|id| !matches!(node_statuses.get(*id), Some(NodeExecutionStatus::Completed)))
                        .collect();
                    (false, format!("Not all predecessors succeeded: {:?}", failed))
                }
            }

            ExecutionCondition::AnyPredecessorSucceeded => {
                evaluated.push("AnyPredecessorSucceeded".to_string());
                let any_succeeded = predecessor_ids.iter().any(|id| {
                    matches!(node_statuses.get(id), Some(NodeExecutionStatus::Completed))
                });
                if any_succeeded {
                    (true, "At least one predecessor succeeded".to_string())
                } else {
                    (false, "No predecessors succeeded".to_string())
                }
            }

            ExecutionCondition::VariableEquals { variable, value } => {
                evaluated.push(format!("VariableEquals({}, {:?})", variable, value));
                match context.get_variable(variable) {
                    Some(v) if &v == value => {
                        (true, format!("Variable {} equals {:?}", variable, value))
                    }
                    Some(v) => {
                        (false, format!("Variable {} is {:?}, expected {:?}", variable, v, value))
                    }
                    None => {
                        (false, format!("Variable {} not set", variable))
                    }
                }
            }

            ExecutionCondition::VariableTruthy { variable } => {
                evaluated.push(format!("VariableTruthy({})", variable));
                match context.get_variable(variable) {
                    Some(v) => {
                        let truthy = match &v {
                            serde_json::Value::Null => false,
                            serde_json::Value::Bool(b) => *b,
                            serde_json::Value::Number(n) => n.as_f64().map(|f| f != 0.0).unwrap_or(false),
                            serde_json::Value::String(s) => !s.is_empty(),
                            serde_json::Value::Array(a) => !a.is_empty(),
                            serde_json::Value::Object(o) => !o.is_empty(),
                        };
                        if truthy {
                            (true, format!("Variable {} is truthy", variable))
                        } else {
                            (false, format!("Variable {} is falsy", variable))
                        }
                    }
                    None => {
                        (false, format!("Variable {} not set", variable))
                    }
                }
            }

            ExecutionCondition::OutputContains {
                predecessor_id,
                pattern,
                case_sensitive,
            } => {
                evaluated.push(format!("OutputContains({}, {})", predecessor_id, pattern));
                match context.get_latest_output(predecessor_id) {
                    Some(output) => {
                        let content = output.data.to_context_string();
                        let contains = if *case_sensitive {
                            content.contains(pattern)
                        } else {
                            content.to_lowercase().contains(&pattern.to_lowercase())
                        };
                        if contains {
                            (true, format!("Output from {} contains '{}'", predecessor_id, pattern))
                        } else {
                            (false, format!("Output from {} does not contain '{}'", predecessor_id, pattern))
                        }
                    }
                    None => {
                        (false, format!("No output from {}", predecessor_id))
                    }
                }
            }

            ExecutionCondition::OutputJsonPath {
                predecessor_id,
                path,
                expected_value,
            } => {
                evaluated.push(format!("OutputJsonPath({}, {})", predecessor_id, path));
                match context.get_latest_output(predecessor_id) {
                    Some(output) => {
                        // Try to parse output as JSON
                        let json_result: Result<serde_json::Value, _> =
                            serde_json::from_str(&output.data.to_context_string());

                        match json_result {
                            Ok(json) => {
                                // Simple JSON path implementation (just handles dot notation)
                                let value = get_json_path(&json, path);
                                match (value, expected_value) {
                                    (Some(v), Some(expected)) => {
                                        if &v == expected {
                                            (true, format!("JSON path {} equals expected value", path))
                                        } else {
                                            (false, format!("JSON path {} is {:?}, expected {:?}", path, v, expected))
                                        }
                                    }
                                    (Some(_), None) => {
                                        (true, format!("JSON path {} exists", path))
                                    }
                                    (None, _) => {
                                        (false, format!("JSON path {} not found", path))
                                    }
                                }
                            }
                            Err(_) => {
                                (false, format!("Output from {} is not valid JSON", predecessor_id))
                            }
                        }
                    }
                    None => {
                        (false, format!("No output from {}", predecessor_id))
                    }
                }
            }

            ExecutionCondition::And { conditions } => {
                evaluated.push("And".to_string());
                for condition in conditions {
                    let (result, reason) = condition.evaluate_inner(
                        context,
                        node_statuses,
                        predecessor_ids,
                        evaluated,
                    );
                    if !result {
                        return (false, format!("AND failed: {}", reason));
                    }
                }
                (true, "All AND conditions passed".to_string())
            }

            ExecutionCondition::Or { conditions } => {
                evaluated.push("Or".to_string());
                for condition in conditions {
                    let (result, _reason) = condition.evaluate_inner(
                        context,
                        node_statuses,
                        predecessor_ids,
                        evaluated,
                    );
                    if result {
                        return (true, "OR condition passed".to_string());
                    }
                }
                (false, "No OR conditions passed".to_string())
            }

            ExecutionCondition::Not { condition } => {
                evaluated.push("Not".to_string());
                let (result, reason) = condition.evaluate_inner(
                    context,
                    node_statuses,
                    predecessor_ids,
                    evaluated,
                );
                (!result, format!("NOT({})", reason))
            }

            ExecutionCondition::Expression { expr } => {
                evaluated.push(format!("Expression({})", expr));
                // Simple expression evaluation
                // Supports: true, false, and variable references like $var
                let result = evaluate_expression(expr, context);
                (result, format!("Expression '{}' evaluated to {}", expr, result))
            }
        }
    }
}

/// Simple JSON path getter (handles dot notation like "data.items.0.name")
fn get_json_path(json: &serde_json::Value, path: &str) -> Option<serde_json::Value> {
    let parts: Vec<&str> = path.split('.').collect();
    let mut current = json.clone();

    for part in parts {
        match &current {
            serde_json::Value::Object(map) => {
                current = map.get(part)?.clone();
            }
            serde_json::Value::Array(arr) => {
                let index: usize = part.parse().ok()?;
                current = arr.get(index)?.clone();
            }
            _ => return None,
        }
    }

    Some(current)
}

/// Simple expression evaluator
fn evaluate_expression(expr: &str, context: &ExecutionContext) -> bool {
    let expr = expr.trim();

    // Handle literal booleans
    if expr == "true" {
        return true;
    }
    if expr == "false" {
        return false;
    }

    // Handle variable references ($var)
    if let Some(var_name) = expr.strip_prefix('$') {
        return context.get_variable(var_name)
            .map(|v| match v {
                serde_json::Value::Bool(b) => b,
                serde_json::Value::Null => false,
                _ => true,
            })
            .unwrap_or(false);
    }

    // Handle simple comparisons like "$var == value"
    if expr.contains("==") {
        let parts: Vec<&str> = expr.split("==").map(|s| s.trim()).collect();
        if parts.len() == 2 {
            let left = evaluate_operand(parts[0], context);
            let right = evaluate_operand(parts[1], context);
            return left == right;
        }
    }

    if expr.contains("!=") {
        let parts: Vec<&str> = expr.split("!=").map(|s| s.trim()).collect();
        if parts.len() == 2 {
            let left = evaluate_operand(parts[0], context);
            let right = evaluate_operand(parts[1], context);
            return left != right;
        }
    }

    false
}

fn evaluate_operand(operand: &str, context: &ExecutionContext) -> String {
    let operand = operand.trim();

    // Variable reference
    if let Some(var_name) = operand.strip_prefix('$') {
        return context.get_variable(var_name)
            .map(|v| match v {
                serde_json::Value::String(s) => s,
                other => other.to_string(),
            })
            .unwrap_or_default();
    }

    // String literal (quoted)
    if (operand.starts_with('"') && operand.ends_with('"'))
        || (operand.starts_with('\'') && operand.ends_with('\''))
    {
        return operand[1..operand.len() - 1].to_string();
    }

    // Return as-is
    operand.to_string()
}

/// Edge type for conditional workflow connections
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EdgeType {
    /// Standard data flow edge
    DataFlow,
    /// Conditional edge (only followed if condition is true)
    Conditional { condition: ExecutionCondition },
    /// Error handling edge (followed on failure)
    OnError,
    /// Success edge (followed on success)
    OnSuccess,
}

impl Default for EdgeType {
    fn default() -> Self {
        Self::DataFlow
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    fn create_test_context() -> ExecutionContext {
        let ctx = ExecutionContext::new(Uuid::new_v4(), Uuid::new_v4(), "Test".to_string());
        ctx.set_variable("flag", serde_json::json!(true));
        ctx.set_variable("count", serde_json::json!(5));
        ctx.set_variable("name", serde_json::json!("test"));
        ctx
    }

    fn create_test_statuses() -> HashMap<String, NodeExecutionStatus> {
        let mut statuses = HashMap::new();
        statuses.insert("node-1".to_string(), NodeExecutionStatus::Completed);
        statuses.insert("node-2".to_string(), NodeExecutionStatus::Failed);
        statuses.insert("node-3".to_string(), NodeExecutionStatus::Running);
        statuses
    }

    #[test]
    fn test_always_condition() {
        let ctx = create_test_context();
        let statuses = create_test_statuses();
        let result = ExecutionCondition::Always.evaluate(&ctx, &statuses, &[]);
        assert!(result.should_execute);
    }

    #[test]
    fn test_on_success_condition() {
        let ctx = create_test_context();
        let statuses = create_test_statuses();

        let condition = ExecutionCondition::OnSuccess {
            predecessor_id: "node-1".to_string(),
        };
        let result = condition.evaluate(&ctx, &statuses, &[]);
        assert!(result.should_execute);

        let condition = ExecutionCondition::OnSuccess {
            predecessor_id: "node-2".to_string(),
        };
        let result = condition.evaluate(&ctx, &statuses, &[]);
        assert!(!result.should_execute);
    }

    #[test]
    fn test_variable_equals() {
        let ctx = create_test_context();
        let statuses = create_test_statuses();

        let condition = ExecutionCondition::VariableEquals {
            variable: "name".to_string(),
            value: serde_json::json!("test"),
        };
        let result = condition.evaluate(&ctx, &statuses, &[]);
        assert!(result.should_execute);

        let condition = ExecutionCondition::VariableEquals {
            variable: "name".to_string(),
            value: serde_json::json!("other"),
        };
        let result = condition.evaluate(&ctx, &statuses, &[]);
        assert!(!result.should_execute);
    }

    #[test]
    fn test_and_condition() {
        let ctx = create_test_context();
        let statuses = create_test_statuses();

        let condition = ExecutionCondition::And {
            conditions: vec![
                ExecutionCondition::VariableTruthy {
                    variable: "flag".to_string(),
                },
                ExecutionCondition::OnSuccess {
                    predecessor_id: "node-1".to_string(),
                },
            ],
        };
        let result = condition.evaluate(&ctx, &statuses, &[]);
        assert!(result.should_execute);
    }

    #[test]
    fn test_or_condition() {
        let ctx = create_test_context();
        let statuses = create_test_statuses();

        let condition = ExecutionCondition::Or {
            conditions: vec![
                ExecutionCondition::OnSuccess {
                    predecessor_id: "node-2".to_string(), // Failed
                },
                ExecutionCondition::OnSuccess {
                    predecessor_id: "node-1".to_string(), // Succeeded
                },
            ],
        };
        let result = condition.evaluate(&ctx, &statuses, &[]);
        assert!(result.should_execute);
    }

    #[test]
    fn test_not_condition() {
        let ctx = create_test_context();
        let statuses = create_test_statuses();

        let condition = ExecutionCondition::Not {
            condition: Box::new(ExecutionCondition::OnSuccess {
                predecessor_id: "node-2".to_string(),
            }),
        };
        let result = condition.evaluate(&ctx, &statuses, &[]);
        assert!(result.should_execute); // NOT(failed) = should execute
    }
}
