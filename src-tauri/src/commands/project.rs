use crate::state::AppState;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use dashmap::DashMap;

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
    pub working_directory: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProjectRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Serialize)]
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

#[tauri::command]
pub async fn create_project(
    _state: State<'_, Arc<AppState>>,
    request: CreateProjectRequest,
) -> Result<ProjectResponse, String> {
    let now = Utc::now();
    let project = Project {
        id: Uuid::new_v4(),
        name: request.name,
        description: request.description,
        status: "pending".to_string(),
        working_directory: request.working_directory,
        created_at: now,
        updated_at: now,
    };

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
            project.status = status;
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
