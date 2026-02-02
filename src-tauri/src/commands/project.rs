use crate::project::workspace;
use crate::state::AppState;
use chrono::{DateTime, Utc};
use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::State;
use uuid::Uuid;

// In-memory project storage for offline mode
lazy_static::lazy_static! {
    static ref PROJECTS: DashMap<Uuid, Project> = DashMap::new();
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub status: String,
    pub working_directory: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateProjectRequest {
    pub name: String,
    pub description: Option<String>,
    /// Optional custom working directory. If not provided, a directory will be created automatically.
    pub working_directory: Option<String>,
    /// Whether to initialize the project structure (README, .gitignore, etc.)
    #[serde(default = "default_true")]
    pub init_structure: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Deserialize)]
pub struct UpdateProjectRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectResponse {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub status: String,
    pub working_directory: String,
    pub created_at: String,
    pub updated_at: String,
}

impl From<&Project> for ProjectResponse {
    fn from(p: &Project) -> Self {
        Self {
            id: p.id.to_string(),
            name: p.name.clone(),
            description: p.description.clone(),
            status: p.status.clone(),
            working_directory: p.working_directory.clone(),
            created_at: p.created_at.to_rfc3339(),
            updated_at: p.updated_at.to_rfc3339(),
        }
    }
}

/// Validate project name
fn validate_project_name(name: &str) -> Result<(), String> {
    if name.is_empty() {
        return Err("Project name cannot be empty".to_string());
    }
    if name.len() > 100 {
        return Err("Project name cannot exceed 100 characters".to_string());
    }
    // Check for characters that are problematic for filesystems
    let invalid_chars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|', '\0'];
    if name.chars().any(|c| invalid_chars.contains(&c)) {
        return Err("Project name contains invalid characters".to_string());
    }
    // Don't allow names that are only whitespace
    if name.trim().is_empty() {
        return Err("Project name cannot be only whitespace".to_string());
    }
    Ok(())
}

/// Validate description
fn validate_description(description: &Option<String>) -> Result<(), String> {
    if let Some(desc) = description {
        if desc.len() > 500 {
            return Err("Description cannot exceed 500 characters".to_string());
        }
    }
    Ok(())
}

/// Validate working directory path
fn validate_working_directory(path: &Option<String>) -> Result<(), String> {
    if let Some(p) = path {
        let path = PathBuf::from(p);
        // Check if it's an absolute path
        if !path.is_absolute() {
            return Err("Working directory must be an absolute path".to_string());
        }
        // Check if parent exists (we'll create the final directory)
        if let Some(parent) = path.parent() {
            if !parent.exists() {
                return Err(format!("Parent directory does not exist: {}", parent.display()));
            }
        }
    }
    Ok(())
}

/// Validate project status
fn validate_status(status: &Option<String>) -> Result<(), String> {
    if let Some(s) = status {
        let valid_statuses = ["active", "completed", "paused", "archived"];
        if !valid_statuses.contains(&s.to_lowercase().as_str()) {
            return Err(format!(
                "Invalid status '{}'. Must be one of: {}",
                s,
                valid_statuses.join(", ")
            ));
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn create_project(
    _state: State<'_, Arc<AppState>>,
    request: CreateProjectRequest,
) -> Result<ProjectResponse, String> {
    // Validate inputs
    validate_project_name(&request.name)?;
    validate_description(&request.description)?;
    validate_working_directory(&request.working_directory)?;

    // Create workspace directory
    let custom_path = request.working_directory.as_ref().map(PathBuf::from);
    let workspace = workspace::create_project_workspace(
        &request.name,
        custom_path.as_deref(),
    )
    .map_err(|e| format!("Failed to create workspace: {}", e))?;

    // Initialize project structure if requested
    if request.init_structure {
        workspace::init_project_structure(&workspace)
            .map_err(|e| format!("Failed to initialize project structure: {}", e))?;
    }

    let now = Utc::now();
    let project = Project {
        id: Uuid::new_v4(),
        name: request.name,
        description: request.description,
        status: "active".to_string(),
        working_directory: workspace.path.to_string_lossy().to_string(),
        created_at: now,
        updated_at: now,
    };

    log::info!(
        "Created project '{}' at {:?}",
        project.name,
        workspace.path
    );

    let response = ProjectResponse::from(&project);
    PROJECTS.insert(project.id, project);

    Ok(response)
}

#[tauri::command]
pub async fn get_project(
    _state: State<'_, Arc<AppState>>,
    project_id: String,
) -> Result<ProjectResponse, String> {
    let id = Uuid::parse_str(&project_id).map_err(|e| format!("Invalid project ID: {}", e))?;

    PROJECTS
        .get(&id)
        .map(|entry| ProjectResponse::from(entry.value()))
        .ok_or("Project not found".to_string())
}

#[tauri::command]
pub async fn list_projects(
    _state: State<'_, Arc<AppState>>,
) -> Result<Vec<ProjectResponse>, String> {
    let projects: Vec<ProjectResponse> = PROJECTS
        .iter()
        .map(|entry| ProjectResponse::from(entry.value()))
        .collect();
    Ok(projects)
}

#[tauri::command]
pub async fn update_project(
    _state: State<'_, Arc<AppState>>,
    project_id: String,
    request: UpdateProjectRequest,
) -> Result<ProjectResponse, String> {
    // Validate inputs
    if let Some(ref name) = request.name {
        validate_project_name(name)?;
    }
    if request.description.is_some() {
        validate_description(&request.description)?;
    }
    validate_status(&request.status)?;

    let id = Uuid::parse_str(&project_id).map_err(|e| format!("Invalid project ID: {}", e))?;

    if let Some(mut entry) = PROJECTS.get_mut(&id) {
        let project = entry.value_mut();
        if let Some(name) = request.name {
            project.name = name;
        }
        if let Some(description) = request.description {
            project.description = Some(description);
        }
        if let Some(status) = request.status {
            project.status = status.to_lowercase();
        }
        project.updated_at = Utc::now();
        Ok(ProjectResponse::from(&*project))
    } else {
        Err("Project not found".to_string())
    }
}

#[tauri::command]
pub async fn delete_project(
    _state: State<'_, Arc<AppState>>,
    project_id: String,
) -> Result<(), String> {
    let id = Uuid::parse_str(&project_id).map_err(|e| format!("Invalid project ID: {}", e))?;

    if PROJECTS.remove(&id).is_some() {
        Ok(())
    } else {
        Err("Project not found".to_string())
    }
}

/// Get the default base directory for NEXUS projects
#[tauri::command]
pub async fn get_projects_base_directory() -> Result<String, String> {
    let base_dir = workspace::get_projects_base_dir()
        .map_err(|e| format!("Failed to get projects directory: {}", e))?;

    Ok(base_dir.to_string_lossy().to_string())
}

/// Get a project's working directory by ID
pub fn get_project_working_directory(project_id: &Uuid) -> Option<String> {
    PROJECTS
        .get(project_id)
        .map(|entry| entry.value().working_directory.clone())
}
