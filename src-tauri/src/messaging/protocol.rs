use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum AgentMessage {
    // Task-related messages
    TaskAssignment {
        task_id: String,
        description: String,
        priority: u8,
        dependencies: Vec<String>,
    },
    TaskUpdate {
        task_id: String,
        status: TaskStatus,
        progress: u8,
        message: Option<String>,
    },
    TaskComplete {
        task_id: String,
        result: serde_json::Value,
    },

    // Data exchange
    DataRequest {
        request_id: String,
        data_type: String,
        query: serde_json::Value,
    },
    DataResponse {
        request_id: String,
        data: serde_json::Value,
    },

    // Coordination
    Ping {
        timestamp: i64,
    },
    Pong {
        timestamp: i64,
        original_timestamp: i64,
    },
    Heartbeat {
        status: AgentHealthStatus,
        load: f32,
    },

    // File operations
    FileCreated {
        path: String,
        content_hash: Option<String>,
    },
    FileModified {
        path: String,
        changes: String,
    },
    FileDeleted {
        path: String,
    },

    // Error handling
    Error {
        code: String,
        message: String,
        recoverable: bool,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TaskStatus {
    Pending,
    InProgress,
    Blocked,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AgentHealthStatus {
    Healthy,
    Degraded,
    Unhealthy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageEnvelope {
    pub id: Uuid,
    pub from: Uuid,
    pub to: Option<Uuid>, // None means broadcast
    pub timestamp: i64,
    pub message: AgentMessage,
    pub reply_to: Option<Uuid>,
    pub ttl: Option<u32>, // Time to live in seconds
}

impl MessageEnvelope {
    pub fn new(from: Uuid, to: Option<Uuid>, message: AgentMessage) -> Self {
        Self {
            id: Uuid::new_v4(),
            from,
            to,
            timestamp: chrono::Utc::now().timestamp_millis(),
            message,
            reply_to: None,
            ttl: None,
        }
    }

    pub fn reply(original: &MessageEnvelope, from: Uuid, message: AgentMessage) -> Self {
        Self {
            id: Uuid::new_v4(),
            from,
            to: Some(original.from),
            timestamp: chrono::Utc::now().timestamp_millis(),
            message,
            reply_to: Some(original.id),
            ttl: None,
        }
    }

    pub fn broadcast(from: Uuid, message: AgentMessage) -> Self {
        Self {
            id: Uuid::new_v4(),
            from,
            to: None,
            timestamp: chrono::Utc::now().timestamp_millis(),
            message,
            reply_to: None,
            ttl: Some(60), // Default 60 second TTL for broadcasts
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrchestratorCommand {
    pub command_type: OrchestratorCommandType,
    pub target_agents: Vec<Uuid>,
    pub payload: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OrchestratorCommandType {
    SpawnAgent,
    KillAgent,
    PauseAgent,
    ResumeAgent,
    AssignTask,
    Reconfigure,
    GatherStatus,
    Shutdown,
}
