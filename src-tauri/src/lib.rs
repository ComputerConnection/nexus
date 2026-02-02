pub mod api;
pub mod commands;
pub mod process;
pub mod project;
pub mod state;
pub mod workflow;

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
    // Load .env file (supports comments, quoted values, and multiline)
    #[cfg(feature = "database")]
    if let Err(e) = dotenvy::dotenv() {
        if e.not_found() {
            log::debug!("No .env file found, using environment variables");
        } else {
            log::warn!("Failed to load .env file: {}", e);
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
                match std::env::var("DATABASE_URL") {
                    Ok(database_url) => {
                        // Create a temporary runtime for async database initialization.
                        // The pool remains valid after the runtime is dropped since sqlx
                        // pools are runtime-agnostic once created.
                        let pool_result = {
                            let rt = Runtime::new().expect("Failed to create Tokio runtime");
                            rt.block_on(async {
                                db::pool::create_pool(&database_url).await
                            })
                        };

                        match pool_result {
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
                    Err(_) => {
                        log::info!("DATABASE_URL not set. Running in offline mode.");
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
            commands::agent::restart_agent,
            commands::agent::get_agent_output,
            commands::agent::get_agent_runtime,
            commands::agent::pause_agent,
            commands::agent::resume_agent,
            // Project commands
            commands::project::create_project,
            commands::project::get_project,
            commands::project::list_projects,
            commands::project::update_project,
            commands::project::delete_project,
            commands::project::get_projects_base_directory,
            // Workflow commands
            commands::workflow::create_workflow,
            commands::workflow::get_workflow,
            commands::workflow::list_workflows,
            commands::workflow::execute_workflow,
            commands::workflow::execute_orchestrated_workflow,
            commands::workflow::cancel_workflow_execution,
            commands::workflow::get_workflow_execution_status,
            commands::workflow::validate_workflow,
            // Enhanced orchestration commands
            commands::workflow::execute_enhanced_workflow,
            commands::workflow::get_execution_context,
            commands::workflow::list_checkpoints,
            commands::workflow::list_execution_checkpoints,
            commands::workflow::cleanup_checkpoints,
            commands::workflow::get_available_agent_roles,
            commands::workflow::get_aggregation_strategies,
            commands::workflow::get_condition_types,
            // Template commands
            commands::workflow::list_workflow_templates,
            commands::workflow::get_workflow_template,
            commands::workflow::search_workflow_templates,
            commands::workflow::get_templates_by_category,
            commands::workflow::instantiate_template,
            commands::workflow::get_template_categories,
            // History commands
            commands::workflow::get_execution_history_stats,
            commands::workflow::list_execution_history,
            commands::workflow::search_execution_history,
            // Resource management commands
            commands::workflow::get_resource_stats,
            commands::workflow::get_resource_config,
            commands::workflow::check_resource_availability,
            // Messaging commands
            commands::workflow::get_execution_messages,
            commands::workflow::get_unread_agent_messages,
            // System commands
            commands::system::get_system_status,
            commands::system::get_database_status,
            // MCP commands
            commands::mcp::mcp_call_tool,
            commands::mcp::mcp_list_tools,
            commands::mcp::mcp_health_check,
            commands::mcp::mcp_server_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
