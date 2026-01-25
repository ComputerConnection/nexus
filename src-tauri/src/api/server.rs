use std::sync::Arc;
use std::net::SocketAddr;
use tauri::AppHandle;
use tower_http::cors::{Any, CorsLayer};

use crate::state::AppState;
use super::routes::{create_router, ApiState};

const DEFAULT_PORT: u16 = 9999;

pub async fn start_api_server(
    app_handle: AppHandle,
    app_state: Arc<AppState>,
    port: Option<u16>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let port = port.unwrap_or(DEFAULT_PORT);
    let addr = SocketAddr::from(([127, 0, 0, 1], port));

    let api_state = ApiState {
        app_handle,
        app_state,
    };

    // Configure CORS for OpenDeck/external apps
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = create_router(api_state).layer(cors);

    log::info!("Starting NEXUS API server on http://{}", addr);
    log::info!("OpenDeck can now connect to: http://localhost:{}/api", port);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

/// Start the API server in a background thread with its own tokio runtime
pub fn spawn_api_server(
    app_handle: AppHandle,
    app_state: Arc<AppState>,
    port: Option<u16>,
) {
    std::thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().expect("Failed to create API server runtime");
        rt.block_on(async move {
            if let Err(e) = start_api_server(app_handle, app_state, port).await {
                log::error!("API server error: {}", e);
            }
        });
    });
}
