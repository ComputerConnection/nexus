//! Adaptive planning for dynamic workflow modification during execution.
//!
//! Enables the orchestrator to:
//! - Re-plan based on intermediate results
//! - Add new tasks dynamically
//! - Remove or skip planned tasks
//! - Modify task dependencies
//! - Handle unexpected situations

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

use super::context::AgentOutput;
use super::orchestrator::PlannedTask;

/// Configuration for adaptive planning behavior
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdaptivePlanningConfig {
    /// Enable adaptive planning
    pub enabled: bool,
    /// Re-plan after each level completes
    pub replan_after_level: bool,
    /// Re-plan when a node fails
    pub replan_on_failure: bool,
    /// Re-plan when output contains specific keywords
    pub replan_keywords: Vec<String>,
    /// Maximum number of dynamic tasks that can be added
    pub max_dynamic_tasks: usize,
    /// Minimum confidence score to proceed without replanning (0.0 - 1.0)
    pub confidence_threshold: f32,
}

impl Default for AdaptivePlanningConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            replan_after_level: false,
            replan_on_failure: true,
            replan_keywords: vec![
                "unexpected".to_string(),
                "additional work needed".to_string(),
                "requires further".to_string(),
                "discovered issue".to_string(),
                "blocker".to_string(),
            ],
            max_dynamic_tasks: 10,
            confidence_threshold: 0.7,
        }
    }
}

/// A modification to the workflow plan
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum PlanModification {
    /// Add a new task to the workflow
    AddTask {
        task: PlannedTask,
        reason: String,
    },

    /// Remove a pending task
    RemoveTask {
        task_id: String,
        reason: String,
    },

    /// Skip a task (mark as completed without running)
    SkipTask {
        task_id: String,
        reason: String,
    },

    /// Modify a task's description or configuration
    ModifyTask {
        task_id: String,
        new_description: Option<String>,
        new_system_prompt: Option<String>,
        reason: String,
    },

    /// Add a dependency between tasks
    AddDependency {
        from_task_id: String,
        to_task_id: String,
        reason: String,
    },

    /// Remove a dependency between tasks
    RemoveDependency {
        from_task_id: String,
        to_task_id: String,
        reason: String,
    },

    /// Replace a task with a different one
    ReplaceTask {
        old_task_id: String,
        new_task: PlannedTask,
        reason: String,
    },

    /// Insert a task between two existing tasks
    InsertTaskBetween {
        task: PlannedTask,
        after_task_id: String,
        before_task_ids: Vec<String>,
        reason: String,
    },
}

/// Request for the orchestrator to re-evaluate the plan
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplanRequest {
    pub execution_id: Uuid,
    pub trigger: ReplanTrigger,
    pub context_summary: String,
    pub completed_tasks: Vec<String>,
    pub pending_tasks: Vec<String>,
    pub failed_tasks: Vec<String>,
    pub agent_outputs: HashMap<String, String>,
    pub timestamp: DateTime<Utc>,
}

/// What triggered the replan request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ReplanTrigger {
    /// A level completed
    LevelCompleted { level: usize },
    /// A task failed
    TaskFailed { task_id: String, error: String },
    /// Output contained a trigger keyword
    KeywordDetected { task_id: String, keyword: String },
    /// Manual trigger from user
    Manual { reason: String },
    /// Confidence dropped below threshold
    LowConfidence { score: f32 },
    /// Periodic replan check
    Periodic { interval_ms: u64 },
}

/// Result of a replan operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplanResult {
    pub modifications: Vec<PlanModification>,
    pub reasoning: String,
    pub confidence: f32,
    pub should_pause: bool,
    pub requires_user_approval: bool,
}

/// System prompt for the adaptive orchestrator
pub const ADAPTIVE_ORCHESTRATOR_PROMPT: &str = r#"You are an adaptive orchestrator reviewing the progress of a workflow execution.

Based on the current state and agent outputs, determine if the plan needs modification.

Current execution state:
{{execution_state}}

Agent outputs so far:
{{agent_outputs}}

Original plan:
{{original_plan}}

Analyze the situation and respond with a JSON object:

```json
{
  "reasoning": "Your analysis of whether modifications are needed and why",
  "confidence": 0.0-1.0,
  "should_pause": false,
  "requires_user_approval": false,
  "modifications": [
    // Array of modifications, can be empty if no changes needed
    // Each modification should have a "type" field
  ]
}
```

Modification types:
- AddTask: { "type": "AddTask", "task": { "id": "...", "name": "...", "agent_role": "...", "description": "...", "depends_on": [...] }, "reason": "..." }
- RemoveTask: { "type": "RemoveTask", "task_id": "...", "reason": "..." }
- SkipTask: { "type": "SkipTask", "task_id": "...", "reason": "..." }
- ModifyTask: { "type": "ModifyTask", "task_id": "...", "new_description": "...", "reason": "..." }

Guidelines:
1. Only suggest modifications if they are clearly needed
2. Prefer minimal changes over major restructuring
3. Set requires_user_approval=true for significant changes
4. Set should_pause=true if human intervention is needed
5. Consider the confidence level based on output quality

Output ONLY the JSON response, no additional text."#;

/// Check if output contains any replan trigger keywords
pub fn check_for_replan_triggers(
    output: &AgentOutput,
    config: &AdaptivePlanningConfig,
) -> Option<String> {
    if !config.enabled {
        return None;
    }

    let content = output.data.to_context_string().to_lowercase();

    for keyword in &config.replan_keywords {
        if content.contains(&keyword.to_lowercase()) {
            return Some(keyword.clone());
        }
    }

    None
}

/// Build context for the adaptive orchestrator
pub fn build_replan_context(
    request: &ReplanRequest,
    original_tasks: &[PlannedTask],
) -> String {
    let mut context = String::new();

    // Execution state
    context.push_str(&format!(
        "Trigger: {:?}\n\n",
        request.trigger
    ));

    context.push_str("Completed tasks:\n");
    for task_id in &request.completed_tasks {
        context.push_str(&format!("  - {}\n", task_id));
    }

    context.push_str("\nPending tasks:\n");
    for task_id in &request.pending_tasks {
        context.push_str(&format!("  - {}\n", task_id));
    }

    context.push_str("\nFailed tasks:\n");
    for task_id in &request.failed_tasks {
        context.push_str(&format!("  - {}\n", task_id));
    }

    context.push_str("\n\nAgent outputs:\n");
    for (task_id, output) in &request.agent_outputs {
        context.push_str(&format!(
            "--- {} ---\n{}\n\n",
            task_id,
            if output.len() > 500 {
                format!("{}...", &output[..500])
            } else {
                output.clone()
            }
        ));
    }

    context.push_str("\n\nOriginal plan:\n");
    for task in original_tasks {
        context.push_str(&format!(
            "- {} ({}): {}\n  depends_on: {:?}\n",
            task.id, task.agent_role, task.name, task.depends_on
        ));
    }

    context
}

/// Parse the adaptive orchestrator's response
pub fn parse_replan_response(response: &str) -> Result<ReplanResult, String> {
    // Try to find JSON in the response
    let json_str = extract_json(response)?;

    serde_json::from_str(&json_str)
        .map_err(|e| format!("Failed to parse replan response: {}", e))
}

fn extract_json(text: &str) -> Result<String, String> {
    // Try to find JSON block
    if let Some(start) = text.find("```json") {
        let json_start = start + 7;
        if let Some(end) = text[json_start..].find("```") {
            return Ok(text[json_start..json_start + end].trim().to_string());
        }
    }

    // Try to find raw JSON
    if let Some(start) = text.find('{') {
        let mut depth = 0;
        for (i, c) in text[start..].char_indices() {
            match c {
                '{' => depth += 1,
                '}' => {
                    depth -= 1;
                    if depth == 0 {
                        return Ok(text[start..=start + i].to_string());
                    }
                }
                _ => {}
            }
        }
    }

    Err("Could not find JSON in response".to_string())
}

/// Apply modifications to the task list
pub fn apply_modifications(
    tasks: &mut Vec<PlannedTask>,
    modifications: &[PlanModification],
) -> Vec<String> {
    let mut applied = Vec::new();

    for modification in modifications {
        match modification {
            PlanModification::AddTask { task, reason } => {
                tasks.push(task.clone());
                applied.push(format!("Added task '{}': {}", task.id, reason));
            }

            PlanModification::RemoveTask { task_id, reason } => {
                if let Some(pos) = tasks.iter().position(|t| t.id == *task_id) {
                    tasks.remove(pos);
                    applied.push(format!("Removed task '{}': {}", task_id, reason));
                }
            }

            PlanModification::SkipTask { task_id, reason } => {
                // Mark for skipping (handled by executor)
                applied.push(format!("Marked task '{}' for skip: {}", task_id, reason));
            }

            PlanModification::ModifyTask {
                task_id,
                new_description,
                new_system_prompt,
                reason,
            } => {
                if let Some(task) = tasks.iter_mut().find(|t| t.id == *task_id) {
                    if let Some(desc) = new_description {
                        task.description = desc.clone();
                    }
                    if let Some(prompt) = new_system_prompt {
                        task.system_prompt = Some(prompt.clone());
                    }
                    applied.push(format!("Modified task '{}': {}", task_id, reason));
                }
            }

            PlanModification::AddDependency {
                from_task_id,
                to_task_id,
                reason,
            } => {
                if let Some(task) = tasks.iter_mut().find(|t| t.id == *to_task_id) {
                    if !task.depends_on.contains(from_task_id) {
                        task.depends_on.push(from_task_id.clone());
                        applied.push(format!(
                            "Added dependency {} -> {}: {}",
                            from_task_id, to_task_id, reason
                        ));
                    }
                }
            }

            PlanModification::RemoveDependency {
                from_task_id,
                to_task_id,
                reason,
            } => {
                if let Some(task) = tasks.iter_mut().find(|t| t.id == *to_task_id) {
                    if let Some(pos) = task.depends_on.iter().position(|d| d == from_task_id) {
                        task.depends_on.remove(pos);
                        applied.push(format!(
                            "Removed dependency {} -> {}: {}",
                            from_task_id, to_task_id, reason
                        ));
                    }
                }
            }

            PlanModification::ReplaceTask {
                old_task_id,
                new_task,
                reason,
            } => {
                if let Some(pos) = tasks.iter().position(|t| t.id == *old_task_id) {
                    // Update dependencies in other tasks
                    for task in tasks.iter_mut() {
                        if let Some(dep_pos) = task.depends_on.iter().position(|d| d == old_task_id) {
                            task.depends_on[dep_pos] = new_task.id.clone();
                        }
                    }
                    tasks[pos] = new_task.clone();
                    applied.push(format!(
                        "Replaced task '{}' with '{}': {}",
                        old_task_id, new_task.id, reason
                    ));
                }
            }

            PlanModification::InsertTaskBetween {
                task,
                after_task_id,
                before_task_ids,
                reason,
            } => {
                // Add dependency on the "after" task
                let mut new_task = task.clone();
                if !new_task.depends_on.contains(after_task_id) {
                    new_task.depends_on.push(after_task_id.clone());
                }
                tasks.push(new_task.clone());

                // Update "before" tasks to depend on the new task
                for before_id in before_task_ids {
                    if let Some(before_task) = tasks.iter_mut().find(|t| t.id == *before_id) {
                        // Remove old dependency on "after" task
                        before_task.depends_on.retain(|d| d != after_task_id);
                        // Add dependency on new task
                        if !before_task.depends_on.contains(&task.id) {
                            before_task.depends_on.push(task.id.clone());
                        }
                    }
                }

                applied.push(format!(
                    "Inserted task '{}' between '{}' and {:?}: {}",
                    task.id, after_task_id, before_task_ids, reason
                ));
            }
        }
    }

    applied
}

/// Validate that modifications don't create cycles
pub fn validate_modifications(
    tasks: &[PlannedTask],
    modifications: &[PlanModification],
) -> Result<(), String> {
    let mut tasks = tasks.to_vec();
    apply_modifications(&mut tasks, modifications);

    // Check for cycles using DFS
    let mut visited: HashMap<String, bool> = HashMap::new();
    let mut rec_stack: HashMap<String, bool> = HashMap::new();

    fn has_cycle(
        task_id: &str,
        tasks: &[PlannedTask],
        visited: &mut HashMap<String, bool>,
        rec_stack: &mut HashMap<String, bool>,
    ) -> bool {
        visited.insert(task_id.to_string(), true);
        rec_stack.insert(task_id.to_string(), true);

        if let Some(task) = tasks.iter().find(|t| t.id == task_id) {
            for dep in &task.depends_on {
                if !visited.get(dep).copied().unwrap_or(false) {
                    if has_cycle(dep, tasks, visited, rec_stack) {
                        return true;
                    }
                } else if rec_stack.get(dep).copied().unwrap_or(false) {
                    return true;
                }
            }
        }

        rec_stack.insert(task_id.to_string(), false);
        false
    }

    for task in &tasks {
        if !visited.get(&task.id).copied().unwrap_or(false) {
            if has_cycle(&task.id, &tasks, &mut visited, &mut rec_stack) {
                return Err("Modifications would create a cycle in the workflow".to_string());
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_tasks() -> Vec<PlannedTask> {
        vec![
            PlannedTask {
                id: "design".to_string(),
                name: "Design System".to_string(),
                agent_role: "architect".to_string(),
                description: "Design the system".to_string(),
                depends_on: vec![],
                system_prompt: None,
            },
            PlannedTask {
                id: "implement".to_string(),
                name: "Implement".to_string(),
                agent_role: "implementer".to_string(),
                description: "Implement the system".to_string(),
                depends_on: vec!["design".to_string()],
                system_prompt: None,
            },
            PlannedTask {
                id: "test".to_string(),
                name: "Test".to_string(),
                agent_role: "tester".to_string(),
                description: "Test the system".to_string(),
                depends_on: vec!["implement".to_string()],
                system_prompt: None,
            },
        ]
    }

    #[test]
    fn test_add_task_modification() {
        let mut tasks = create_test_tasks();
        let modifications = vec![PlanModification::AddTask {
            task: PlannedTask {
                id: "security".to_string(),
                name: "Security Review".to_string(),
                agent_role: "security".to_string(),
                description: "Review security".to_string(),
                depends_on: vec!["implement".to_string()],
                system_prompt: None,
            },
            reason: "Security is important".to_string(),
        }];

        apply_modifications(&mut tasks, &modifications);
        assert_eq!(tasks.len(), 4);
        assert!(tasks.iter().any(|t| t.id == "security"));
    }

    #[test]
    fn test_insert_between_modification() {
        let mut tasks = create_test_tasks();
        let modifications = vec![PlanModification::InsertTaskBetween {
            task: PlannedTask {
                id: "review".to_string(),
                name: "Code Review".to_string(),
                agent_role: "architect".to_string(),
                description: "Review the code".to_string(),
                depends_on: vec![],
                system_prompt: None,
            },
            after_task_id: "implement".to_string(),
            before_task_ids: vec!["test".to_string()],
            reason: "Need review before testing".to_string(),
        }];

        apply_modifications(&mut tasks, &modifications);

        // Check that review now depends on implement
        let review = tasks.iter().find(|t| t.id == "review").unwrap();
        assert!(review.depends_on.contains(&"implement".to_string()));

        // Check that test now depends on review (not implement)
        let test = tasks.iter().find(|t| t.id == "test").unwrap();
        assert!(test.depends_on.contains(&"review".to_string()));
        assert!(!test.depends_on.contains(&"implement".to_string()));
    }

    #[test]
    fn test_cycle_detection() {
        let tasks = create_test_tasks();

        // Try to add a cycle: design -> implement -> test -> design
        let modifications = vec![PlanModification::AddDependency {
            from_task_id: "test".to_string(),
            to_task_id: "design".to_string(),
            reason: "Bad idea".to_string(),
        }];

        let result = validate_modifications(&tasks, &modifications);
        assert!(result.is_err());
    }

    #[test]
    fn test_check_replan_triggers() {
        let config = AdaptivePlanningConfig::default();
        let output = AgentOutput {
            agent_id: Uuid::new_v4(),
            node_id: "test".to_string(),
            agent_role: "tester".to_string(),
            data: OutputData::Text("Discovered issue: authentication is broken".to_string()),
            timestamp: Utc::now(),
            tags: vec![],
        };

        let trigger = check_for_replan_triggers(&output, &config);
        assert!(trigger.is_some());
        assert_eq!(trigger.unwrap(), "discovered issue");
    }
}
