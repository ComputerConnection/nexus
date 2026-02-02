use crate::process::manager::{AgentConfig, AgentInfo, AgentManager, AgentStatus};
use crate::process::registry::AGENT_REGISTRY;
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct AgentResponse {
    pub id: String,
    pub name: String,
    pub role: String,
    pub status: String,
    pub project_id: Option<String>,
    pub assigned_task: Option<String>,
    pub progress: u8,
    pub pid: Option<u32>,
}

impl From<&AgentInfo> for AgentResponse {
    fn from(info: &AgentInfo) -> Self {
        Self {
            id: info.id.to_string(),
            name: info.name.clone(),
            role: info.role.clone(),
            status: format!("{:?}", info.status),
            project_id: info.project_id.map(|id| id.to_string()),
            assigned_task: info.assigned_task.clone(),
            progress: info.progress,
            pid: info.pid,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct SpawnAgentRequest {
    pub name: String,
    pub role: String,
    pub working_directory: String,
    pub project_id: Option<String>,
    pub system_prompt: Option<String>,
    pub assigned_task: Option<String>,
}

#[tauri::command]
pub async fn spawn_agent(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    request: SpawnAgentRequest,
) -> Result<AgentResponse, String> {
    let project_id = request
        .project_id
        .map(|id| Uuid::parse_str(&id))
        .transpose()
        .map_err(|e| format!("Invalid project ID: {}", e))?;

    let config = AgentConfig {
        name: request.name,
        role: request.role,
        working_directory: request.working_directory,
        project_id,
        system_prompt: request.system_prompt,
        assigned_task: request.assigned_task,
    };

    let manager = AgentManager::new(app.clone());
    let info = manager.spawn_agent(config)?;

    let response = AgentResponse::from(&info);
    state.agents.insert(info.id, info);

    Ok(response)
}

#[tauri::command]
pub async fn kill_agent(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    agent_id: String,
) -> Result<(), String> {
    let id = Uuid::parse_str(&agent_id).map_err(|e| format!("Invalid agent ID: {}", e))?;

    // Use registry's graceful shutdown (SIGTERM then SIGKILL)
    let killed = AGENT_REGISTRY.kill(&id);

    if let Some(mut agent) = state.agents.get_mut(&id) {
        agent.status = AgentStatus::Killed;
    }

    let _ = app.emit("agent-killed", &agent_id);

    if killed {
        Ok(())
    } else {
        // Agent might not be in registry but could be in state
        if state.agents.contains_key(&id) {
            state.agents.remove(&id);
            Ok(())
        } else {
            Err("Agent not found".to_string())
        }
    }
}

#[tauri::command]
pub async fn list_agents(state: State<'_, Arc<AppState>>) -> Result<Vec<AgentResponse>, String> {
    let agents: Vec<AgentResponse> = state
        .agents
        .iter()
        .map(|entry| AgentResponse::from(entry.value()))
        .collect();
    Ok(agents)
}

#[tauri::command]
pub async fn get_agent(
    state: State<'_, Arc<AppState>>,
    agent_id: String,
) -> Result<AgentResponse, String> {
    let id = Uuid::parse_str(&agent_id).map_err(|e| format!("Invalid agent ID: {}", e))?;

    state
        .agents
        .get(&id)
        .map(|entry| AgentResponse::from(entry.value()))
        .ok_or_else(|| "Agent not found".to_string())
}

#[tauri::command]
pub async fn send_to_agent(
    _state: State<'_, Arc<AppState>>,
    agent_id: String,
    input: String,
) -> Result<(), String> {
    let id = Uuid::parse_str(&agent_id).map_err(|e| format!("Invalid agent ID: {}", e))?;

    // Use PTY input for terminal-based agents, falls back to stdin
    AGENT_REGISTRY.send_pty_input(&id, &input)
}

#[tauri::command]
pub async fn restart_agent(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    agent_id: String,
) -> Result<AgentResponse, String> {
    let id = Uuid::parse_str(&agent_id).map_err(|e| format!("Invalid agent ID: {}", e))?;

    // Get the stored config for this agent
    let config = AGENT_REGISTRY
        .get_config(&id)
        .ok_or_else(|| "No config found for agent (cannot restart)".to_string())?;

    // Kill the existing agent if still running
    AGENT_REGISTRY.kill(&id);

    // Remove from state
    state.agents.remove(&id);

    // Clean up registry
    AGENT_REGISTRY.remove(&id);

    // Spawn a new agent with the same config
    let manager = AgentManager::new(app.clone());
    let info = manager.spawn_agent(config)?;

    let response = AgentResponse::from(&info);
    state.agents.insert(info.id, info);

    log::info!("Restarted agent {} as new agent {}", agent_id, response.id);

    Ok(response)
}

#[tauri::command]
pub async fn get_agent_output(
    _state: State<'_, Arc<AppState>>,
    agent_id: String,
) -> Result<String, String> {
    let id = Uuid::parse_str(&agent_id).map_err(|e| format!("Invalid agent ID: {}", e))?;

    AGENT_REGISTRY
        .get_output(&id)
        .ok_or_else(|| "Agent not found or no output available".to_string())
}

#[tauri::command]
pub async fn get_agent_runtime(
    _state: State<'_, Arc<AppState>>,
    agent_id: String,
) -> Result<u64, String> {
    let id = Uuid::parse_str(&agent_id).map_err(|e| format!("Invalid agent ID: {}", e))?;

    AGENT_REGISTRY
        .get_runtime(&id)
        .map(|d| d.as_secs())
        .ok_or_else(|| "Agent not found".to_string())
}

#[tauri::command]
pub async fn pause_agent(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    agent_id: String,
) -> Result<(), String> {
    let id = Uuid::parse_str(&agent_id).map_err(|e| format!("Invalid agent ID: {}", e))?;

    AGENT_REGISTRY.pause(&id)?;

    // Update status in state
    if let Some(mut agent) = state.agents.get_mut(&id) {
        agent.status = AgentStatus::Paused;
    }

    // Emit status event
    let _ = app.emit(
        "agent-status",
        serde_json::json!({
            "agentId": agent_id,
            "status": "Paused",
        }),
    );

    Ok(())
}

#[tauri::command]
pub async fn resume_agent(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    agent_id: String,
) -> Result<(), String> {
    let id = Uuid::parse_str(&agent_id).map_err(|e| format!("Invalid agent ID: {}", e))?;

    AGENT_REGISTRY.resume(&id)?;

    // Update status in state
    if let Some(mut agent) = state.agents.get_mut(&id) {
        agent.status = AgentStatus::Running;
    }

    // Emit status event
    let _ = app.emit(
        "agent-status",
        serde_json::json!({
            "agentId": agent_id,
            "status": "Running",
        }),
    );

    Ok(())
}
