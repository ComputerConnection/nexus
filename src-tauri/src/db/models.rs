use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::Type;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq)]
#[sqlx(type_name = "varchar", rename_all = "lowercase")]
pub enum ProjectStatus {
    Pending,
    Active,
    Paused,
    Completed,
    Failed,
    Archived,
}

impl Default for ProjectStatus {
    fn default() -> Self {
        Self::Pending
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Project {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub status: ProjectStatus,
    pub working_directory: String,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AgentTemplate {
    pub id: Uuid,
    pub name: String,
    pub role: String,
    pub system_prompt: String,
    pub capabilities: serde_json::Value,
    pub icon: Option<String>,
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq)]
#[sqlx(type_name = "varchar", rename_all = "lowercase")]
pub enum AgentDbStatus {
    Idle,
    Starting,
    Running,
    Paused,
    Completed,
    Failed,
    Killed,
}

impl Default for AgentDbStatus {
    fn default() -> Self {
        Self::Idle
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Agent {
    pub id: Uuid,
    pub project_id: Option<Uuid>,
    pub template_id: Option<Uuid>,
    pub name: String,
    pub role: String,
    pub status: AgentDbStatus,
    pub pid: Option<i32>,
    pub assigned_task: Option<String>,
    pub progress: Option<i32>,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Workflow {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub graph: serde_json::Value,
    pub is_template: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
pub enum MessageType {
    TaskAssignment,
    StatusUpdate,
    DataTransfer,
    Query,
    Response,
    Error,
    Completion,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Message {
    pub id: Uuid,
    pub project_id: Uuid,
    pub from_agent_id: Option<Uuid>,
    pub to_agent_id: Option<Uuid>,
    pub message_type: MessageType,
    pub content: String,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq)]
#[sqlx(type_name = "varchar", rename_all = "lowercase")]
pub enum LogType {
    Info,
    Warning,
    Error,
    Debug,
    Output,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ExecutionLog {
    pub id: Uuid,
    pub agent_id: Option<Uuid>,
    pub log_type: LogType,
    pub content: String,
    pub created_at: Option<DateTime<Utc>>,
}
