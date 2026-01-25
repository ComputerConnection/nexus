use crate::state::AppState;
use serde::Serialize;
use std::sync::Arc;
use tauri::State;

#[derive(Debug, Serialize)]
pub struct SystemStatus {
    pub version: String,
    pub active_agents: usize,
    pub database_connected: bool,
    pub uptime_seconds: u64,
}

#[derive(Debug, Serialize)]
pub struct DatabaseStatus {
    pub connected: bool,
    pub pool_size: Option<u32>,
    pub idle_connections: Option<u32>,
}

static START_TIME: std::sync::OnceLock<std::time::Instant> = std::sync::OnceLock::new();

fn get_uptime() -> u64 {
    START_TIME
        .get_or_init(std::time::Instant::now)
        .elapsed()
        .as_secs()
}

#[tauri::command]
pub async fn get_system_status(state: State<'_, Arc<AppState>>) -> Result<SystemStatus, String> {
    Ok(SystemStatus {
        version: env!("CARGO_PKG_VERSION").to_string(),
        active_agents: state.agents.len(),
        database_connected: state.has_db(),
        uptime_seconds: get_uptime(),
    })
}

#[tauri::command]
pub async fn get_database_status(
    state: State<'_, Arc<AppState>>,
) -> Result<DatabaseStatus, String> {
    Ok(DatabaseStatus {
        connected: state.has_db(),
        pool_size: None,
        idle_connections: None,
    })
}
