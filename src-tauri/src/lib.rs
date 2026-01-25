pub mod api;
pub mod commands;
pub mod process;
pub mod state;

#[cfg(feature = "database")]
pub mod db;
#[cfg(feature = "database")]
pub mod messaging;

use state::AppState;
use std::sync::Arc;
use tauri::Manager;

#[cfg(feature = "database")]
use tokio::runtime::Runtime;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load .env file
    #[cfg(feature = "database")]
    {
        if let Ok(env_path) = std::env::current_dir() {
            let env_file = env_path.join(".env");
            if env_file.exists() {
                if let Ok(contents) = std::fs::read_to_string(&env_file) {
                    for line in contents.lines() {
                        if let Some((key, value)) = line.split_once('=') {
                            std::env::set_var(key.trim(), value.trim());
                        }
                    }
                }
            }
        }
    }

    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_state: Arc<AppState>;

            #[cfg(feature = "database")]
            {
                let database_url = std::env::var("DATABASE_URL")
                    .unwrap_or_else(|_| "postgres://nexus:nexus123@localhost:5432/nexus".to_string());

                let rt = Runtime::new().expect("Failed to create Tokio runtime");

                match rt.block_on(async {
                    let pool = db::pool::create_pool(&database_url).await?;
                    Ok::<_, db::pool::PoolError>(pool)
                }) {
                    Ok(pool) => {
                        app_state = Arc::new(AppState::with_database(pool));
                        log::info!("NEXUS initialized with database connection");
                    }
                    Err(e) => {
                        log::warn!("Failed to connect to database: {}. Running in offline mode.", e);
                        app_state = Arc::new(AppState::new());
                    }
                }
            }

            #[cfg(not(feature = "database"))]
            {
                app_state = Arc::new(AppState::new());
                log::info!("NEXUS initialized (offline mode - database feature disabled)");
            }

            app.manage(app_state.clone());

            // Start the HTTP API server for OpenDeck/Stream Deck integration
            let api_port = std::env::var("NEXUS_API_PORT")
                .ok()
                .and_then(|s| s.parse().ok());

            api::server::spawn_api_server(
                app.handle().clone(),
                app_state,
                api_port,
            );

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Agent commands
            commands::agent::spawn_agent,
            commands::agent::kill_agent,
            commands::agent::list_agents,
            commands::agent::get_agent,
            commands::agent::send_to_agent,
            // Project commands
            commands::project::create_project,
            commands::project::get_project,
            commands::project::list_projects,
            commands::project::update_project,
            commands::project::delete_project,
            // Workflow commands
            commands::workflow::create_workflow,
            commands::workflow::get_workflow,
            commands::workflow::list_workflows,
            commands::workflow::execute_workflow,
            // System commands
            commands::system::get_system_status,
            commands::system::get_database_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
