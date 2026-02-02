use std::sync::Arc;
use std::net::SocketAddr;
use tauri::AppHandle;
use tower_http::cors::{Any, CorsLayer};

use crate::state::AppState;
use super::routes::{create_router, ApiState};

const DEFAULT_PORT: u16 = 9999;
const MAX_PORT_ATTEMPTS: u16 = 10;

/// Check if a port is available for binding
async fn is_port_available(port: u16) -> bool {
    tokio::net::TcpListener::bind(SocketAddr::from(([127, 0, 0, 1], port)))
        .await
        .is_ok()
}

/// Find an available port starting from the preferred port
async fn find_available_port(preferred: u16) -> Option<u16> {
    for offset in 0..MAX_PORT_ATTEMPTS {
        let port = preferred + offset;
        if is_port_available(port).await {
            return Some(port);
        }
        log::debug!("Port {} is in use, trying next...", port);
    }
    None
}

pub async fn start_api_server(
    app_handle: AppHandle,
    app_state: Arc<AppState>,
    port: Option<u16>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let preferred_port = port.unwrap_or(DEFAULT_PORT);

    // Find an available port
    let actual_port = match find_available_port(preferred_port).await {
        Some(p) => p,
        None => {
            log::warn!(
                "Could not find available port in range {}-{}. API server disabled.",
                preferred_port,
                preferred_port + MAX_PORT_ATTEMPTS - 1
            );
            return Ok(());
        }
    };

    if actual_port != preferred_port {
        log::info!(
            "Port {} was in use, using port {} instead",
            preferred_port,
            actual_port
        );
    }

    let addr = SocketAddr::from(([127, 0, 0, 1], actual_port));

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
    log::info!("OpenDeck can now connect to: http://localhost:{}/api", actual_port);

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
