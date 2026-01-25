use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentOutput {
    pub agent_id: String,
    pub output: String,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamEvent {
    pub event_type: StreamEventType,
    pub agent_id: String,
    pub data: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StreamEventType {
    Output,
    StatusChange,
    Progress,
    Error,
    Completed,
}

pub fn broadcast_output(app: &AppHandle, agent_id: Uuid, output: String) {
    let event = AgentOutput {
        agent_id: agent_id.to_string(),
        output,
        timestamp: chrono::Utc::now().timestamp_millis(),
    };
    let _ = app.emit("agent-output", &event);
}

pub fn broadcast_status(app: &AppHandle, agent_id: Uuid, status: &str) {
    let event = StreamEvent {
        event_type: StreamEventType::StatusChange,
        agent_id: agent_id.to_string(),
        data: serde_json::json!({ "status": status }),
    };
    let _ = app.emit("agent-status", &event);
}

pub fn broadcast_progress(app: &AppHandle, agent_id: Uuid, progress: u8) {
    let event = StreamEvent {
        event_type: StreamEventType::Progress,
        agent_id: agent_id.to_string(),
        data: serde_json::json!({ "progress": progress }),
    };
    let _ = app.emit("agent-progress", &event);
}

pub fn broadcast_error(app: &AppHandle, agent_id: Uuid, error: &str) {
    let event = StreamEvent {
        event_type: StreamEventType::Error,
        agent_id: agent_id.to_string(),
        data: serde_json::json!({ "error": error }),
    };
    let _ = app.emit("agent-error", &event);
}

pub fn broadcast_completed(app: &AppHandle, agent_id: Uuid, result: serde_json::Value) {
    let event = StreamEvent {
        event_type: StreamEventType::Completed,
        agent_id: agent_id.to_string(),
        data: result,
    };
    let _ = app.emit("agent-completed", &event);
}
