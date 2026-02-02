use serde::{Deserialize, Serialize};
use std::io::Write;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::mpsc;
use uuid::Uuid;

use super::registry::{AgentCompletion, AGENT_REGISTRY};
use super::spawner::{start_pty_reader, PtyHandle};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AgentStatus {
    Starting,
    Running,
    Paused,
    Completed,
    Failed,
    Killed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    pub name: String,
    pub role: String,
    pub working_directory: String,
    pub project_id: Option<Uuid>,
    pub system_prompt: Option<String>,
    pub assigned_task: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentInfo {
    pub id: Uuid,
    pub name: String,
    pub role: String,
    pub status: AgentStatus,
    pub project_id: Option<Uuid>,
    pub assigned_task: Option<String>,
    pub progress: u8,
    pub pid: Option<u32>,
}

impl AgentInfo {
    pub fn new(id: Uuid, config: &AgentConfig) -> Self {
        Self {
            id,
            name: config.name.clone(),
            role: config.role.clone(),
            status: AgentStatus::Starting,
            project_id: config.project_id,
            assigned_task: config.assigned_task.clone(),
            progress: 0,
            pid: None,
        }
    }
}

/// Holds a PTY writer handle for sending input to an agent
pub struct AgentPtyWriter(pub Arc<Mutex<Box<dyn Write + Send>>>);

pub struct AgentManager {
    app: AppHandle,
}

impl AgentManager {
    pub fn new(app: AppHandle) -> Self {
        Self { app }
    }

    pub fn spawn_agent(&self, config: AgentConfig) -> Result<AgentInfo, String> {
        let id = Uuid::new_v4();
        let mut info = AgentInfo::new(id, &config);

        // Verify working directory exists
        let working_dir = std::path::Path::new(&config.working_directory);
        if !working_dir.exists() {
            std::fs::create_dir_all(working_dir)
                .map_err(|e| format!("Failed to create working directory: {}", e))?;
            log::info!("Created working directory: {:?}", working_dir);
        }

        // Build initial prompt for Claude Code
        let initial_prompt = match (&config.system_prompt, &config.assigned_task) {
            (Some(sys), Some(task)) => Some(format!("{}\n\nTask: {}", sys, task)),
            (Some(sys), None) => Some(sys.clone()),
            (None, Some(task)) => Some(format!("Task: {}", task)),
            (None, None) => None,
        };

        // Emit starting event
        let _ = self.app.emit(
            "agent-output",
            serde_json::json!({
                "agentId": id.to_string(),
                "output": format!("🚀 Starting Claude Code agent '{}' ({})...\n", config.name, config.role),
                "stream": "system",
                "timestamp": chrono::Utc::now().timestamp_millis(),
            }),
        );

        let _ = self.app.emit(
            "agent-output",
            serde_json::json!({
                "agentId": id.to_string(),
                "output": format!("📂 Working directory: {}\n", config.working_directory),
                "stream": "system",
                "timestamp": chrono::Utc::now().timestamp_millis(),
            }),
        );

        if let Some(ref task) = config.assigned_task {
            let _ = self.app.emit(
                "agent-output",
                serde_json::json!({
                    "agentId": id.to_string(),
                    "output": format!("📋 Task: {}\n", task),
                    "stream": "system",
                    "timestamp": chrono::Utc::now().timestamp_millis(),
                }),
            );
        }

        let _ = self.app.emit(
            "agent-output",
            serde_json::json!({
                "agentId": id.to_string(),
                "output": "⏳ Spawning Claude Code terminal session...\n\n",
                "stream": "system",
                "timestamp": chrono::Utc::now().timestamp_millis(),
            }),
        );

        // Spawn Claude Code in a PTY
        match PtyHandle::spawn_claude_pty(&config.working_directory, initial_prompt.as_deref()) {
            Ok(pty_handle) => {
                let pid = pty_handle.id();
                info.pid = Some(pid);
                info.status = AgentStatus::Running;
                info.progress = 5;

                // Get reader for output streaming
                let reader = pty_handle.take_reader().map_err(|e| e.to_string())?;

                // Get writer handle for input
                let writer_handle = pty_handle.writer_handle();

                // Register PTY agent and store config/writer in registry
                AGENT_REGISTRY.register_pty_agent(id, pid);
                AGENT_REGISTRY.store_config(id, config.clone());
                AGENT_REGISTRY.store_pty_writer(id, writer_handle);

                // Emit initial progress
                let _ = self.app.emit(
                    "agent-progress",
                    serde_json::json!({
                        "agentId": id.to_string(),
                        "progress": 5,
                    }),
                );

                let app = self.app.clone();
                let agent_id = id;

                // Start output streaming from PTY
                let (tx, mut rx) = mpsc::unbounded_channel::<Vec<u8>>();
                start_pty_reader(reader, tx);

                // Forward PTY output to frontend
                // Use Tauri's async runtime which is properly set up, not tokio::spawn
                tauri::async_runtime::spawn(async move {
                    while let Some(data) = rx.recv().await {
                        // Try to convert to UTF-8, handling ANSI codes
                        let text = String::from_utf8_lossy(&data);

                        // Collect output in registry buffer
                        AGENT_REGISTRY.append_output(&agent_id, &text);

                        let _ = app.emit(
                            "agent-output",
                            serde_json::json!({
                                "agentId": agent_id.to_string(),
                                "output": text,
                                "stream": "stdout",
                                "timestamp": chrono::Utc::now().timestamp_millis(),
                            }),
                        );
                    }

                    // Stream closed - agent finished
                    let output = AGENT_REGISTRY.get_output(&agent_id).unwrap_or_default();

                    let _ = app.emit(
                        "agent-output",
                        serde_json::json!({
                            "agentId": agent_id.to_string(),
                            "output": "\n✅ Claude Code session ended\n",
                            "stream": "system",
                            "timestamp": chrono::Utc::now().timestamp_millis(),
                        }),
                    );

                    // Update agent status
                    if let Some(app_state) =
                        app.try_state::<std::sync::Arc<crate::state::AppState>>()
                    {
                        if let Some(mut agent) = app_state.agents.get_mut(&agent_id) {
                            agent.status = AgentStatus::Completed;
                            agent.progress = 100;
                        }
                    }

                    let _ = app.emit(
                        "agent-progress",
                        serde_json::json!({
                            "agentId": agent_id.to_string(),
                            "progress": 100,
                        }),
                    );

                    let _ = app.emit(
                        "agent-status",
                        serde_json::json!({
                            "agentId": agent_id.to_string(),
                            "status": "Completed",
                        }),
                    );

                    // Notify completion
                    AGENT_REGISTRY.notify_completion(
                        &agent_id,
                        AgentCompletion {
                            success: true,
                            output,
                            error: None,
                        },
                    );
                });

                let _ = self.app.emit("agent-spawned", &info);

                Ok(info)
            }
            Err(e) => {
                info.status = AgentStatus::Failed;

                let _ = self.app.emit(
                    "agent-output",
                    serde_json::json!({
                        "agentId": id.to_string(),
                        "output": format!("❌ Failed to spawn: {}\n", e),
                        "stream": "stderr",
                        "timestamp": chrono::Utc::now().timestamp_millis(),
                    }),
                );

                Err(format!("Failed to spawn agent: {}", e))
            }
        }
    }

    /// Kill an agent by ID
    pub fn kill_agent(&self, agent_id: &Uuid) -> bool {
        let killed = AGENT_REGISTRY.kill(agent_id);

        if let Some(app_state) = self.app.try_state::<std::sync::Arc<crate::state::AppState>>() {
            if let Some(mut agent) = app_state.agents.get_mut(agent_id) {
                agent.status = AgentStatus::Killed;
            }
        }

        let _ = self.app.emit(
            "agent-status",
            serde_json::json!({
                "agentId": agent_id.to_string(),
                "status": "Killed",
            }),
        );

        killed
    }

    /// Get collected output for an agent
    pub fn get_agent_output(&self, agent_id: &Uuid) -> Option<String> {
        AGENT_REGISTRY.get_output(agent_id)
    }

    /// Subscribe to agent completion
    pub fn subscribe_completion(
        &self,
        agent_id: Uuid,
    ) -> tokio::sync::oneshot::Receiver<AgentCompletion> {
        AGENT_REGISTRY.subscribe_completion(agent_id)
    }
}
