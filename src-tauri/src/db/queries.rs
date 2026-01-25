use super::models::*;
use sqlx::PgPool;
use uuid::Uuid;

// Project queries
pub async fn get_project_by_id(pool: &PgPool, id: Uuid) -> Result<Option<Project>, sqlx::Error> {
    sqlx::query_as!(
        Project,
        r#"
        SELECT id, name, description, status as "status!: ProjectStatus", working_directory, created_at, updated_at
        FROM projects
        WHERE id = $1
        "#,
        id
    )
    .fetch_optional(pool)
    .await
}

pub async fn list_projects(pool: &PgPool) -> Result<Vec<Project>, sqlx::Error> {
    sqlx::query_as!(
        Project,
        r#"
        SELECT id, name, description, status as "status!: ProjectStatus", working_directory, created_at, updated_at
        FROM projects
        ORDER BY updated_at DESC
        "#
    )
    .fetch_all(pool)
    .await
}

// Agent template queries
pub async fn get_agent_template_by_id(
    pool: &PgPool,
    id: Uuid,
) -> Result<Option<AgentTemplate>, sqlx::Error> {
    sqlx::query_as!(
        AgentTemplate,
        r#"
        SELECT id, name, role, system_prompt, capabilities, icon, color
        FROM agent_templates
        WHERE id = $1
        "#,
        id
    )
    .fetch_optional(pool)
    .await
}

pub async fn list_agent_templates(pool: &PgPool) -> Result<Vec<AgentTemplate>, sqlx::Error> {
    sqlx::query_as!(
        AgentTemplate,
        r#"
        SELECT id, name, role, system_prompt, capabilities, icon, color
        FROM agent_templates
        ORDER BY name
        "#
    )
    .fetch_all(pool)
    .await
}

pub async fn get_agent_template_by_role(
    pool: &PgPool,
    role: &str,
) -> Result<Option<AgentTemplate>, sqlx::Error> {
    sqlx::query_as!(
        AgentTemplate,
        r#"
        SELECT id, name, role, system_prompt, capabilities, icon, color
        FROM agent_templates
        WHERE role = $1
        "#,
        role
    )
    .fetch_optional(pool)
    .await
}

// Agent queries
pub async fn get_agents_by_project(
    pool: &PgPool,
    project_id: Uuid,
) -> Result<Vec<Agent>, sqlx::Error> {
    sqlx::query_as!(
        Agent,
        r#"
        SELECT id, project_id, template_id, name, role, status as "status!: AgentDbStatus", pid, assigned_task, progress, created_at
        FROM agents
        WHERE project_id = $1
        ORDER BY created_at
        "#,
        project_id
    )
    .fetch_all(pool)
    .await
}

pub async fn update_agent_status(
    pool: &PgPool,
    agent_id: Uuid,
    status: AgentDbStatus,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        UPDATE agents
        SET status = $2
        WHERE id = $1
        "#,
        agent_id,
        status as AgentDbStatus
    )
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn update_agent_progress(
    pool: &PgPool,
    agent_id: Uuid,
    progress: i32,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        UPDATE agents
        SET progress = $2
        WHERE id = $1
        "#,
        agent_id,
        progress
    )
    .execute(pool)
    .await?;
    Ok(())
}

// Message queries
pub async fn create_message(
    pool: &PgPool,
    project_id: Uuid,
    from_agent_id: Option<Uuid>,
    to_agent_id: Option<Uuid>,
    message_type: MessageType,
    content: &str,
    metadata: serde_json::Value,
) -> Result<Message, sqlx::Error> {
    sqlx::query_as!(
        Message,
        r#"
        INSERT INTO messages (project_id, from_agent_id, to_agent_id, message_type, content, metadata)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, project_id as "project_id!", from_agent_id, to_agent_id, message_type as "message_type!: MessageType", content, metadata, created_at as "created_at!"
        "#,
        project_id,
        from_agent_id,
        to_agent_id,
        message_type as MessageType,
        content,
        metadata
    )
    .fetch_one(pool)
    .await
}

pub async fn get_messages_for_project(
    pool: &PgPool,
    project_id: Uuid,
    limit: i64,
) -> Result<Vec<Message>, sqlx::Error> {
    sqlx::query_as!(
        Message,
        r#"
        SELECT id, project_id as "project_id!", from_agent_id, to_agent_id, message_type as "message_type!: MessageType", content, metadata, created_at as "created_at!"
        FROM messages
        WHERE project_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        "#,
        project_id,
        limit
    )
    .fetch_all(pool)
    .await
}

// Execution log queries
pub async fn create_execution_log(
    pool: &PgPool,
    agent_id: Uuid,
    log_type: LogType,
    content: &str,
) -> Result<ExecutionLog, sqlx::Error> {
    sqlx::query_as!(
        ExecutionLog,
        r#"
        INSERT INTO execution_logs (agent_id, log_type, content)
        VALUES ($1, $2, $3)
        RETURNING id, agent_id, log_type as "log_type!: LogType", content, created_at
        "#,
        agent_id,
        log_type as LogType,
        content
    )
    .fetch_one(pool)
    .await
}

pub async fn get_logs_for_agent(
    pool: &PgPool,
    agent_id: Uuid,
    limit: i64,
) -> Result<Vec<ExecutionLog>, sqlx::Error> {
    sqlx::query_as!(
        ExecutionLog,
        r#"
        SELECT id, agent_id, log_type as "log_type!: LogType", content, created_at
        FROM execution_logs
        WHERE agent_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        "#,
        agent_id,
        limit
    )
    .fetch_all(pool)
    .await
}
