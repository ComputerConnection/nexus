use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{delete, get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use crate::process::manager::{AgentConfig, AgentInfo, AgentManager, AgentStatus};
use crate::state::AppState;
use super::templates::{self, AgentTemplate, QuickAction};

#[derive(Clone)]
pub struct ApiState {
    pub app_handle: AppHandle,
    pub app_state: Arc<AppState>,
}

// Request/Response types
#[derive(Debug, Deserialize)]
pub struct SpawnAgentRequest {
    pub name: Option<String>,
    pub role: Option<String>,
    pub working_directory: String,
    pub system_prompt: Option<String>,
    pub assigned_task: Option<String>,
    pub project_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SpawnFromTemplateRequest {
    pub working_directory: String,
    pub assigned_task: Option<String>,
    pub project_id: Option<String>,
    pub name_override: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct QuickActionRequest {
    pub working_directory: String,
    pub task_override: Option<String>,
    pub project_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AgentResponse {
    pub id: String,
    pub name: String,
    pub role: String,
    pub status: String,
    pub pid: Option<u32>,
    pub assigned_task: Option<String>,
    pub progress: u8,
}

impl From<&AgentInfo> for AgentResponse {
    fn from(info: &AgentInfo) -> Self {
        Self {
            id: info.id.to_string(),
            name: info.name.clone(),
            role: info.role.clone(),
            status: format!("{:?}", info.status),
            pid: info.pid,
            assigned_task: info.assigned_task.clone(),
            progress: info.progress,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct SystemStatus {
    pub agents_running: usize,
    pub database_connected: bool,
    pub api_version: String,
    pub uptime_seconds: u64,
}

#[derive(Debug, Serialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T: Serialize> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    pub fn error(message: &str) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(message.to_string()),
        }
    }
}

// Route handlers

/// GET /api/health - Health check
async fn health_check() -> Json<ApiResponse<&'static str>> {
    Json(ApiResponse::success("OK"))
}

/// GET /api/status - System status
async fn get_status(State(state): State<ApiState>) -> Json<ApiResponse<SystemStatus>> {
    let status = SystemStatus {
        agents_running: state.app_state.agents.len(),
        database_connected: state.app_state.has_db(),
        api_version: "1.0.0".to_string(),
        uptime_seconds: 0, // TODO: Track actual uptime
    };
    Json(ApiResponse::success(status))
}

/// GET /api/agents - List all agents
async fn list_agents(State(state): State<ApiState>) -> Json<ApiResponse<Vec<AgentResponse>>> {
    let agents: Vec<AgentResponse> = state
        .app_state
        .agents
        .iter()
        .map(|entry| AgentResponse::from(entry.value()))
        .collect();
    Json(ApiResponse::success(agents))
}

/// GET /api/agents/:id - Get agent by ID
async fn get_agent(
    State(state): State<ApiState>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<AgentResponse>>, StatusCode> {
    let uuid = Uuid::parse_str(&id).map_err(|_| StatusCode::BAD_REQUEST)?;

    match state.app_state.agents.get(&uuid) {
        Some(entry) => Ok(Json(ApiResponse::success(AgentResponse::from(entry.value())))),
        None => Err(StatusCode::NOT_FOUND),
    }
}

/// POST /api/agents/spawn - Spawn a new agent
async fn spawn_agent(
    State(state): State<ApiState>,
    Json(request): Json<SpawnAgentRequest>,
) -> Result<Json<ApiResponse<AgentResponse>>, StatusCode> {
    let config = AgentConfig {
        name: request.name.unwrap_or_else(|| format!("Agent-{}", chrono::Utc::now().timestamp())),
        role: request.role.unwrap_or_else(|| "implementer".to_string()),
        working_directory: request.working_directory,
        project_id: request.project_id.and_then(|s| Uuid::parse_str(&s).ok()),
        system_prompt: request.system_prompt,
        assigned_task: request.assigned_task,
    };

    let manager = AgentManager::new(state.app_handle.clone());
    match manager.spawn_agent(config) {
        Ok(info) => {
            let response = AgentResponse::from(&info);
            state.app_state.agents.insert(info.id, info);
            Ok(Json(ApiResponse::success(response)))
        }
        Err(e) => {
            log::error!("Failed to spawn agent: {}", e);
            Ok(Json(ApiResponse::error(&e)))
        }
    }
}

/// POST /api/agents/spawn/:template - Spawn agent from template
async fn spawn_from_template(
    State(state): State<ApiState>,
    Path(template_id): Path<String>,
    Json(request): Json<SpawnFromTemplateRequest>,
) -> Result<Json<ApiResponse<AgentResponse>>, StatusCode> {
    let template = templates::get_template(&template_id)
        .ok_or(StatusCode::NOT_FOUND)?;

    let config = AgentConfig {
        name: request.name_override.unwrap_or_else(|| template.name.clone()),
        role: template.role.clone(),
        working_directory: request.working_directory,
        project_id: request.project_id.and_then(|s| Uuid::parse_str(&s).ok()),
        system_prompt: Some(template.system_prompt.clone()),
        assigned_task: request.assigned_task,
    };

    let manager = AgentManager::new(state.app_handle.clone());
    match manager.spawn_agent(config) {
        Ok(info) => {
            let response = AgentResponse::from(&info);
            state.app_state.agents.insert(info.id, info);
            Ok(Json(ApiResponse::success(response)))
        }
        Err(e) => {
            log::error!("Failed to spawn agent from template: {}", e);
            Ok(Json(ApiResponse::error(&e)))
        }
    }
}

/// POST /api/quick-actions/:action - Execute a quick action
async fn execute_quick_action(
    State(state): State<ApiState>,
    Path(action_id): Path<String>,
    Json(request): Json<QuickActionRequest>,
) -> Result<Json<ApiResponse<AgentResponse>>, StatusCode> {
    let action = templates::get_quick_action(&action_id)
        .ok_or(StatusCode::NOT_FOUND)?;

    let template = templates::get_template(&action.template)
        .ok_or(StatusCode::INTERNAL_SERVER_ERROR)?;

    let task = request.task_override
        .or_else(|| action.default_task.clone())
        .unwrap_or_else(|| "Execute quick action".to_string());

    let working_dir = action.working_directory.clone()
        .unwrap_or(request.working_directory);

    let config = AgentConfig {
        name: format!("{}-{}", action.name, chrono::Utc::now().timestamp()),
        role: template.role.clone(),
        working_directory: working_dir,
        project_id: request.project_id.and_then(|s| Uuid::parse_str(&s).ok()),
        system_prompt: Some(template.system_prompt.clone()),
        assigned_task: Some(task),
    };

    let manager = AgentManager::new(state.app_handle.clone());
    match manager.spawn_agent(config) {
        Ok(info) => {
            let response = AgentResponse::from(&info);
            state.app_state.agents.insert(info.id, info);
            Ok(Json(ApiResponse::success(response)))
        }
        Err(e) => {
            log::error!("Failed to execute quick action: {}", e);
            Ok(Json(ApiResponse::error(&e)))
        }
    }
}

/// DELETE /api/agents/:id - Kill an agent
async fn kill_agent(
    State(state): State<ApiState>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<&'static str>>, StatusCode> {
    let uuid = Uuid::parse_str(&id).map_err(|_| StatusCode::BAD_REQUEST)?;

    if let Some((_, mut info)) = state.app_state.agents.remove(&uuid) {
        if let Some(pid) = info.pid {
            #[cfg(unix)]
            {
                use std::process::Command;
                let _ = Command::new("kill").arg("-9").arg(pid.to_string()).output();
            }
        }
        info.status = AgentStatus::Killed;
        let _ = state.app_handle.emit("agent-killed", id);
        Ok(Json(ApiResponse::success("Agent killed")))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

/// DELETE /api/agents - Kill all agents
async fn kill_all_agents(State(state): State<ApiState>) -> Json<ApiResponse<usize>> {
    let mut killed = 0;

    let ids: Vec<Uuid> = state.app_state.agents.iter().map(|e| *e.key()).collect();

    for id in ids {
        if let Some((_, mut info)) = state.app_state.agents.remove(&id) {
            if let Some(pid) = info.pid {
                #[cfg(unix)]
                {
                    use std::process::Command;
                    let _ = Command::new("kill").arg("-9").arg(pid.to_string()).output();
                }
            }
            info.status = AgentStatus::Killed;
            let _ = state.app_handle.emit("agent-killed", id.to_string());
            killed += 1;
        }
    }

    Json(ApiResponse::success(killed))
}

/// GET /api/templates - List all agent templates
async fn list_templates() -> Json<ApiResponse<Vec<&'static AgentTemplate>>> {
    Json(ApiResponse::success(templates::list_templates()))
}

/// GET /api/templates/:id - Get template by ID
async fn get_template(Path(id): Path<String>) -> Result<Json<ApiResponse<&'static AgentTemplate>>, StatusCode> {
    match templates::get_template(&id) {
        Some(t) => Ok(Json(ApiResponse::success(t))),
        None => Err(StatusCode::NOT_FOUND),
    }
}

/// GET /api/quick-actions - List all quick actions
async fn list_quick_actions() -> Json<ApiResponse<Vec<&'static QuickAction>>> {
    Json(ApiResponse::success(templates::list_quick_actions()))
}

/// GET /api/quick-actions/:id - Get quick action by ID
async fn get_quick_action(Path(id): Path<String>) -> Result<Json<ApiResponse<&'static QuickAction>>, StatusCode> {
    match templates::get_quick_action(&id) {
        Some(a) => Ok(Json(ApiResponse::success(a))),
        None => Err(StatusCode::NOT_FOUND),
    }
}

/// Build the API router
pub fn create_router(api_state: ApiState) -> Router {
    Router::new()
        // Health & Status
        .route("/api/health", get(health_check))
        .route("/api/status", get(get_status))
        // Agents
        .route("/api/agents", get(list_agents))
        .route("/api/agents", delete(kill_all_agents))
        .route("/api/agents/spawn", post(spawn_agent))
        .route("/api/agents/spawn/:template", post(spawn_from_template))
        .route("/api/agents/:id", get(get_agent))
        .route("/api/agents/:id", delete(kill_agent))
        // Templates
        .route("/api/templates", get(list_templates))
        .route("/api/templates/:id", get(get_template))
        // Quick Actions
        .route("/api/quick-actions", get(list_quick_actions))
        .route("/api/quick-actions/:id", get(get_quick_action))
        .route("/api/quick-actions/:id/execute", post(execute_quick_action))
        .with_state(api_state)
}
