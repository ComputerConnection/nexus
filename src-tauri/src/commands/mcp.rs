use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::env;

/// MCP Server configuration
const DEFAULT_MCP_SERVER_URL: &str = "http://localhost:9999";

/// Response wrapper for MCP tool calls
#[derive(Debug, Serialize, Deserialize)]
pub struct McpToolResponse {
    pub success: bool,
    #[serde(default)]
    pub data: Value,
    #[serde(default)]
    pub error: Option<String>,
}

/// Get the MCP server URL from environment or use default
fn get_mcp_server_url() -> String {
    env::var("MCP_SERVER_URL").unwrap_or_else(|_| DEFAULT_MCP_SERVER_URL.to_string())
}

/// Call an MCP tool by name with arguments
///
/// This command acts as a bridge between the Tauri frontend and the MCP server,
/// allowing any MCP tool to be invoked from the UI.
#[tauri::command]
pub async fn mcp_call_tool(
    name: String,
    arguments: Value,
) -> Result<Value, String> {
    let server_url = get_mcp_server_url();
    let url = format!("{}/tools/{}", server_url, name);

    log::debug!("Calling MCP tool: {} with args: {:?}", name, arguments);

    let client = reqwest::Client::new();

    let response = client
        .post(&url)
        .json(&arguments)
        .timeout(std::time::Duration::from_secs(300)) // 5 minute timeout for long-running tools
        .send()
        .await
        .map_err(|e| format!("Failed to connect to MCP server at {}: {}", server_url, e))?;

    let status = response.status();

    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("MCP tool '{}' failed with status {}: {}", name, status, error_text));
    }

    let result: Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse MCP response: {}", e))?;

    log::debug!("MCP tool {} returned: {:?}", name, result);

    Ok(result)
}

/// List available MCP tools from the server
#[tauri::command]
pub async fn mcp_list_tools() -> Result<Value, String> {
    let server_url = get_mcp_server_url();
    let url = format!("{}/tools", server_url);

    let client = reqwest::Client::new();

    let response = client
        .get(&url)
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| format!("Failed to connect to MCP server: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Failed to list MCP tools: {}", response.status()));
    }

    let tools: Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse tools list: {}", e))?;

    Ok(tools)
}

/// Check if MCP server is available
#[tauri::command]
pub async fn mcp_health_check() -> Result<bool, String> {
    let server_url = get_mcp_server_url();
    let url = format!("{}/health", server_url);

    let client = reqwest::Client::new();

    match client
        .get(&url)
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
    {
        Ok(response) => Ok(response.status().is_success()),
        Err(_) => Ok(false),
    }
}

/// Get MCP server info
#[tauri::command]
pub async fn mcp_server_info() -> Result<Value, String> {
    let server_url = get_mcp_server_url();

    // Try to get server info
    let client = reqwest::Client::new();

    // First check health
    let health_url = format!("{}/health", server_url);
    let health_ok = client
        .get(&health_url)
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
        .map(|r| r.status().is_success())
        .unwrap_or(false);

    if !health_ok {
        return Ok(serde_json::json!({
            "connected": false,
            "url": server_url,
            "error": "MCP server not reachable"
        }));
    }

    // Get tool count
    let tools_url = format!("{}/tools", server_url);
    let tool_count = match client
        .get(&tools_url)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
    {
        Ok(response) => {
            match response.json::<Value>().await {
                Ok(value) => value.as_array().map(|a| a.len()).unwrap_or(0),
                Err(_) => 0,
            }
        }
        Err(_) => 0,
    };

    Ok(serde_json::json!({
        "connected": true,
        "url": server_url,
        "toolCount": tool_count
    }))
}
