use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;
use uuid::Uuid;

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

// Agent manager that stores only serializable info
// Actual process handles are managed separately
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

        // Build initial prompt
        let initial_prompt = match (&config.system_prompt, &config.assigned_task) {
            (Some(sys), Some(task)) => Some(format!("{}\n\nTask: {}", sys, task)),
            (Some(sys), None) => Some(sys.clone()),
            (None, Some(task)) => Some(format!("Task: {}", task)),
            (None, None) => None,
        };

        // Emit starting event immediately for UI feedback
        let _ = self.app.emit("agent-output", serde_json::json!({
            "agentId": id.to_string(),
            "output": format!("🚀 Starting agent '{}' with role: {}\n", config.name, config.role),
            "stream": "system",
            "timestamp": chrono::Utc::now().timestamp_millis(),
        }));

        if let Some(ref task) = config.assigned_task {
            let _ = self.app.emit("agent-output", serde_json::json!({
                "agentId": id.to_string(),
                "output": format!("📋 Task: {}\n", task),
                "stream": "system",
                "timestamp": chrono::Utc::now().timestamp_millis(),
            }));
        }

        let _ = self.app.emit("agent-output", serde_json::json!({
            "agentId": id.to_string(),
            "output": "⏳ Connecting to Claude API... (this may take 10-20 seconds)\n",
            "stream": "system",
            "timestamp": chrono::Utc::now().timestamp_millis(),
        }));

        // Spawn the process
        match super::spawner::ProcessHandle::spawn_claude(
            &config.working_directory,
            initial_prompt.as_deref(),
        ) {
            Ok(mut handle) => {
                info.pid = Some(handle.id());
                info.status = AgentStatus::Running;

                let app = self.app.clone();
                let agent_id = id;

                // Start stdout forwarding
                if let Some(stdout) = handle.take_stdout() {
                    let (tx, mut rx) = mpsc::unbounded_channel::<Vec<u8>>();
                    super::spawner::start_output_reader(stdout, tx);

                    let app_clone = app.clone();
                    tokio::spawn(async move {
                        while let Some(data) = rx.recv().await {
                            if let Ok(text) = String::from_utf8(data) {
                                let _ = app_clone.emit("agent-output", serde_json::json!({
                                    "agentId": agent_id.to_string(),
                                    "output": text,
                                    "stream": "stdout",
                                    "timestamp": chrono::Utc::now().timestamp_millis(),
                                }));
                            }
                        }
                        // Stream closed - process completed
                        let _ = app_clone.emit("agent-output", serde_json::json!({
                            "agentId": agent_id.to_string(),
                            "output": "\n✅ Agent task completed\n",
                            "stream": "system",
                            "timestamp": chrono::Utc::now().timestamp_millis(),
                        }));
                        let _ = app_clone.emit("agent-stream-closed", serde_json::json!({
                            "agentId": agent_id.to_string(),
                            "stream": "stdout",
                        }));
                    });
                }

                // Start stderr forwarding
                if let Some(stderr) = handle.take_stderr() {
                    let (tx, mut rx) = mpsc::unbounded_channel::<Vec<u8>>();
                    super::spawner::start_output_reader(stderr, tx);

                    let agent_id_stderr = id;
                    let app_clone = app.clone();
                    tokio::spawn(async move {
                        while let Some(data) = rx.recv().await {
                            if let Ok(text) = String::from_utf8(data) {
                                let _ = app_clone.emit("agent-output", serde_json::json!({
                                    "agentId": agent_id_stderr.to_string(),
                                    "output": text,
                                    "stream": "stderr",
                                    "timestamp": chrono::Utc::now().timestamp_millis(),
                                }));
                            }
                        }
                    });
                }

                // Emit agent started event
                let _ = self.app.emit("agent-spawned", &info);

                Ok(info)
            }
            Err(e) => {
                info.status = AgentStatus::Failed;
                Err(format!("Failed to spawn agent: {}", e))
            }
        }
    }
}
