use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use uuid::Uuid;

use crate::commands::project::get_project_working_directory;
use crate::process::manager::{AgentConfig, AgentManager};
use crate::process::AGENT_REGISTRY;
use crate::state::AppState;

use super::events::{WorkflowEvent, WORKFLOW_EVENT_NAME};
use super::graph::{ParsedEdge, ParsedNode, WorkflowGraph};

/// A task in the orchestrator's plan
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlannedTask {
    pub id: String,
    pub name: String,
    pub agent_role: String,
    pub description: String,
    #[serde(default)]
    pub depends_on: Vec<String>,
    #[serde(default)]
    pub system_prompt: Option<String>,
}

/// The structured plan created by the orchestrator
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrchestratorPlan {
    pub project_summary: String,
    pub tasks: Vec<PlannedTask>,
}

/// System prompt for the orchestrator to create a structured plan
pub const ORCHESTRATOR_PLAN_PROMPT: &str = r#"You are an orchestrator agent responsible for breaking down a project into tasks and assigning them to specialized agents.

Available agent roles:
- architect: Designs system architecture, defines interfaces, creates technical specifications
- implementer: Writes code, implements features, follows architectural designs
- tester: Writes tests, validates functionality, ensures quality
- documenter: Writes documentation, API docs, user guides
- security: Reviews code for security issues, implements security best practices
- devops: Handles deployment, CI/CD, infrastructure configuration

Analyze the user's request and create a structured execution plan. Output your plan as a JSON object with this exact format:

```json
{
  "project_summary": "Brief description of what this project will accomplish",
  "tasks": [
    {
      "id": "unique-task-id",
      "name": "Short task name",
      "agent_role": "one of the roles above",
      "description": "Detailed description of what this agent should do",
      "depends_on": ["ids of tasks that must complete first"]
    }
  ]
}
```

Guidelines:
1. Break the project into logical, independent tasks where possible
2. Use depends_on to specify task dependencies (creates execution order)
3. Tasks with no dependencies will run in parallel
4. Each task should be self-contained with clear deliverables
5. Start with architecture/design tasks, then implementation, then testing/docs
6. Be specific in task descriptions - agents will use these as their instructions

Output ONLY the JSON plan, no additional text."#;

/// Parse the orchestrator's output to extract the plan
pub fn parse_orchestrator_output(output: &str) -> Result<OrchestratorPlan, String> {
    // Try to find JSON in the output (may be wrapped in markdown code blocks)
    let json_str = extract_json_from_output(output)?;

    serde_json::from_str(&json_str)
        .map_err(|e| format!("Failed to parse orchestrator plan: {}", e))
}

/// Extract JSON from output that may contain markdown code blocks
fn extract_json_from_output(output: &str) -> Result<String, String> {
    // First try: look for ```json ... ``` blocks
    if let Some(start) = output.find("```json") {
        let json_start = start + 7;
        if let Some(end) = output[json_start..].find("```") {
            return Ok(output[json_start..json_start + end].trim().to_string());
        }
    }

    // Second try: look for ``` ... ``` blocks
    if let Some(start) = output.find("```") {
        let block_start = start + 3;
        if let Some(end) = output[block_start..].find("```") {
            let content = output[block_start..block_start + end].trim();
            // Skip language identifier if present
            if let Some(newline) = content.find('\n') {
                let first_line = &content[..newline];
                if !first_line.starts_with('{') {
                    return Ok(content[newline + 1..].trim().to_string());
                }
            }
            return Ok(content.to_string());
        }
    }

    // Third try: find raw JSON object
    if let Some(start) = output.find('{') {
        // Find matching closing brace
        let mut depth = 0;
        let mut end = start;
        for (i, c) in output[start..].char_indices() {
            match c {
                '{' => depth += 1,
                '}' => {
                    depth -= 1;
                    if depth == 0 {
                        end = start + i + 1;
                        break;
                    }
                }
                _ => {}
            }
        }
        if depth == 0 {
            return Ok(output[start..end].to_string());
        }
    }

    Err("Could not find JSON plan in orchestrator output".to_string())
}

/// Convert an orchestrator plan to a workflow graph
pub fn plan_to_graph(plan: &OrchestratorPlan) -> WorkflowGraph {
    let mut nodes = HashMap::new();
    let mut edges = Vec::new();
    let mut successors: HashMap<String, Vec<String>> = HashMap::new();
    let mut predecessors: HashMap<String, Vec<String>> = HashMap::new();

    // Create nodes from tasks
    for task in &plan.tasks {
        let node = ParsedNode {
            id: task.id.clone(),
            label: task.name.clone(),
            agent_role: task.agent_role.clone(),
            system_prompt: task.system_prompt.clone(),
            assigned_task: Some(task.description.clone()),
        };
        nodes.insert(task.id.clone(), node);
        successors.insert(task.id.clone(), Vec::new());
        predecessors.insert(task.id.clone(), Vec::new());
    }

    // Create edges from dependencies
    for task in &plan.tasks {
        for dep_id in &task.depends_on {
            if nodes.contains_key(dep_id) {
                let edge = ParsedEdge {
                    id: format!("edge-{}-{}", dep_id, task.id),
                    source: dep_id.clone(),
                    target: task.id.clone(),
                    data_type: None,
                };
                edges.push(edge);

                successors
                    .entry(dep_id.clone())
                    .or_default()
                    .push(task.id.clone());
                predecessors
                    .entry(task.id.clone())
                    .or_default()
                    .push(dep_id.clone());
            }
        }
    }

    WorkflowGraph {
        nodes,
        edges,
        successors,
        predecessors,
    }
}

/// Run the orchestrator to create a plan
pub async fn run_orchestrator_planning(
    app: &AppHandle,
    execution_id: &str,
    project_id: Uuid,
    input_prompt: &str,
) -> Result<OrchestratorPlan, String> {
    let app_state: tauri::State<'_, Arc<AppState>> = app.state();

    // Create orchestrator agent config
    // Get working directory from project
    let working_directory = get_project_working_directory(&project_id)
        .unwrap_or_else(|| {
            std::env::current_dir()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|_| ".".to_string())
        });

    let config = AgentConfig {
        name: format!("orchestrator-{}", &execution_id[..8]),
        role: "orchestrator".to_string(),
        working_directory,
        project_id: Some(project_id),
        system_prompt: Some(ORCHESTRATOR_PLAN_PROMPT.to_string()),
        assigned_task: Some(input_prompt.to_string()),
    };

    // Spawn the orchestrator agent
    let manager = AgentManager::new(app.clone());
    let agent_info = manager.spawn_agent(config).map_err(|e| e.to_string())?;
    let agent_id = agent_info.id;

    // Store agent in app state
    app_state.agents.insert(agent_id, agent_info);

    // Emit event that orchestrator started with real agent_id
    let _ = app.emit(
        WORKFLOW_EVENT_NAME,
        WorkflowEvent::NodeStarted {
            execution_id: execution_id.to_string(),
            node_id: "orchestrator".to_string(),
            agent_id: agent_id.to_string(),
        },
    );

    // Wait for orchestrator to complete and collect output
    let output = wait_for_agent_output(app, agent_id).await?;

    // Parse the plan from the output
    let plan = parse_orchestrator_output(&output)?;

    log::info!(
        "Orchestrator created plan with {} tasks: {}",
        plan.tasks.len(),
        plan.project_summary
    );

    Ok(plan)
}

/// Wait for agent to complete and collect its output
async fn wait_for_agent_output(_app: &AppHandle, agent_id: Uuid) -> Result<String, String> {
    use tokio::time::{timeout, Duration};

    // Subscribe to completion via the registry
    let completion_rx = AGENT_REGISTRY.subscribe_completion(agent_id);

    // Wait for completion with timeout (5 minutes for planning)
    let max_wait = Duration::from_secs(300);

    match timeout(max_wait, completion_rx).await {
        Ok(Ok(completion)) => {
            if completion.success {
                // Get the collected output from the registry
                let output = AGENT_REGISTRY.get_output(&agent_id)
                    .unwrap_or_else(|| completion.output);

                if output.is_empty() {
                    return Err("Orchestrator agent completed but produced no output".to_string());
                }

                Ok(output)
            } else {
                Err(completion.error.unwrap_or_else(|| "Orchestrator agent failed".to_string()))
            }
        }
        Ok(Err(_)) => {
            // Channel dropped - agent may have been cleaned up
            // Try to get output from registry anyway
            if let Some(output) = AGENT_REGISTRY.get_output(&agent_id) {
                if !output.is_empty() {
                    return Ok(output);
                }
            }
            Err("Orchestrator agent was terminated unexpectedly".to_string())
        }
        Err(_) => {
            // Timeout
            Err("Orchestrator planning timed out after 5 minutes".to_string())
        }
    }
}

/// Emit events for the dynamically created graph nodes
pub fn emit_dynamic_graph_events(
    app: &AppHandle,
    execution_id: &str,
    graph: &WorkflowGraph,
) {
    // Emit an event with the new graph structure for the frontend
    let nodes: Vec<_> = graph.nodes.values().collect();
    let edges: Vec<_> = graph.edges.iter().collect();

    let _ = app.emit(
        "workflow-graph-updated",
        serde_json::json!({
            "execution_id": execution_id,
            "nodes": nodes,
            "edges": edges,
        }),
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_json_from_code_block() {
        let output = r#"Here's my plan:

```json
{
  "project_summary": "Test project",
  "tasks": [
    {
      "id": "task-1",
      "name": "Design",
      "agent_role": "architect",
      "description": "Create design",
      "depends_on": []
    }
  ]
}
```

That's my plan."#;

        let plan = parse_orchestrator_output(output).unwrap();
        assert_eq!(plan.project_summary, "Test project");
        assert_eq!(plan.tasks.len(), 1);
        assert_eq!(plan.tasks[0].id, "task-1");
    }

    #[test]
    fn test_parse_raw_json() {
        let output = r#"{
  "project_summary": "Raw JSON test",
  "tasks": []
}"#;

        let plan = parse_orchestrator_output(output).unwrap();
        assert_eq!(plan.project_summary, "Raw JSON test");
    }

    #[test]
    fn test_plan_to_graph() {
        let plan = OrchestratorPlan {
            project_summary: "Test".to_string(),
            tasks: vec![
                PlannedTask {
                    id: "t1".to_string(),
                    name: "Task 1".to_string(),
                    agent_role: "architect".to_string(),
                    description: "Do task 1".to_string(),
                    depends_on: vec![],
                    system_prompt: None,
                },
                PlannedTask {
                    id: "t2".to_string(),
                    name: "Task 2".to_string(),
                    agent_role: "implementer".to_string(),
                    description: "Do task 2".to_string(),
                    depends_on: vec!["t1".to_string()],
                    system_prompt: None,
                },
            ],
        };

        let graph = plan_to_graph(&plan);

        assert_eq!(graph.nodes.len(), 2);
        assert_eq!(graph.edges.len(), 1);
        assert_eq!(graph.edges[0].source, "t1");
        assert_eq!(graph.edges[0].target, "t2");
    }
}
