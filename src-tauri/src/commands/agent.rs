use crate::process::manager::{AgentConfig, AgentInfo, AgentManager, AgentStatus};
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

    if let Some((_, mut info)) = state.agents.remove(&id) {
        // Kill by PID if available
        if let Some(pid) = info.pid {
            #[cfg(unix)]
            {
                use std::process::Command;
                let _ = Command::new("kill")
                    .arg("-9")
                    .arg(pid.to_string())
                    .output();
            }
        }
        info.status = AgentStatus::Killed;
        let _ = app.emit("agent-killed", agent_id);
        Ok(())
    } else {
        Err("Agent not found".to_string())
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
    // In a full implementation, this would send input to the agent's stdin
    // For now, we just log it
    log::info!("Sending to agent {}: {}", agent_id, input);
    Ok(())
}
