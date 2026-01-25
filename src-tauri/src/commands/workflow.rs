use crate::state::AppState;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use dashmap::DashMap;

// In-memory workflow storage for offline mode
lazy_static::lazy_static! {
    static ref WORKFLOWS: DashMap<Uuid, Workflow> = DashMap::new();
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
    let workflow_id =
        Uuid::parse_str(&request.workflow_id).map_err(|e| format!("Invalid workflow ID: {}", e))?;

    let workflow = WORKFLOWS
        .get(&workflow_id)
        .ok_or("Workflow not found")?;

    // Create execution record
    let execution_id = Uuid::new_v4();

    // Emit workflow execution started event
    let _ = app.emit(
        "workflow-execution-started",
        serde_json::json!({
            "execution_id": execution_id.to_string(),
            "workflow_id": workflow.id.to_string(),
            "workflow_name": workflow.name.clone(),
        }),
    );

    log::info!(
        "Executing workflow {} with prompt: {}",
        workflow.name,
        request.input_prompt
    );

    Ok(execution_id.to_string())
}
