use std::fs;
use std::path::{Path, PathBuf};

use chrono::Utc;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum WorkspaceError {
    #[error("Failed to get home directory")]
    NoHomeDir,

    #[error("Failed to create directory: {0}")]
    CreateDirFailed(#[from] std::io::Error),

    #[error("Invalid project name: {0}")]
    InvalidProjectName(String),
}

/// Project workspace configuration
#[derive(Debug, Clone)]
pub struct ProjectWorkspace {
    pub path: PathBuf,
    pub name: String,
}

/// Default base directory name for NEXUS projects
const NEXUS_PROJECTS_DIR: &str = "nexus-projects";

/// Get the base directory for all NEXUS projects
/// Creates it if it doesn't exist
pub fn get_projects_base_dir() -> Result<PathBuf, WorkspaceError> {
    let home = dirs::home_dir().ok_or(WorkspaceError::NoHomeDir)?;
    let base_dir = home.join(NEXUS_PROJECTS_DIR);

    if !base_dir.exists() {
        fs::create_dir_all(&base_dir)?;
        log::info!("Created NEXUS projects directory: {:?}", base_dir);
    }

    Ok(base_dir)
}

/// Sanitize a project name for use as a directory name
fn sanitize_project_name(name: &str) -> String {
    name.chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' {
                c.to_ascii_lowercase()
            } else if c.is_whitespace() {
                '-'
            } else {
                '_'
            }
        })
        .collect::<String>()
        .trim_matches(|c| c == '-' || c == '_')
        .to_string()
}

/// Create a workspace directory for a project
pub fn create_project_workspace(
    project_name: &str,
    custom_path: Option<&Path>,
) -> Result<ProjectWorkspace, WorkspaceError> {
    let sanitized_name = sanitize_project_name(project_name);

    if sanitized_name.is_empty() {
        return Err(WorkspaceError::InvalidProjectName(
            "Project name cannot be empty".to_string(),
        ));
    }

    let workspace_path = if let Some(path) = custom_path {
        path.to_path_buf()
    } else {
        let base_dir = get_projects_base_dir()?;
        // Add timestamp to make unique if same name exists
        let dir_name = if base_dir.join(&sanitized_name).exists() {
            format!("{}-{}", sanitized_name, Utc::now().format("%Y%m%d-%H%M%S"))
        } else {
            sanitized_name.clone()
        };
        base_dir.join(dir_name)
    };

    // Create the workspace directory
    if !workspace_path.exists() {
        fs::create_dir_all(&workspace_path)?;
        log::info!("Created project workspace: {:?}", workspace_path);
    }

    Ok(ProjectWorkspace {
        path: workspace_path,
        name: sanitized_name,
    })
}

/// Initialize a basic project structure in the workspace
pub fn init_project_structure(workspace: &ProjectWorkspace) -> Result<(), WorkspaceError> {
    // Create standard subdirectories
    let subdirs = ["src", "docs", "tests", ".nexus"];

    for subdir in subdirs {
        let dir_path = workspace.path.join(subdir);
        if !dir_path.exists() {
            fs::create_dir_all(&dir_path)?;
        }
    }

    // Create a README if it doesn't exist
    let readme_path = workspace.path.join("README.md");
    if !readme_path.exists() {
        let readme_content = format!(
            r#"# {}

Project workspace created by NEXUS.

## Structure

- `src/` - Source code
- `docs/` - Documentation
- `tests/` - Test files
- `.nexus/` - NEXUS configuration and logs

## Getting Started

This project was set up with NEXUS orchestration. Use the NEXUS interface to manage agents and workflows.
"#,
            workspace.name
        );
        fs::write(&readme_path, readme_content)?;
        log::info!("Created README.md for project");
    }

    // Create .nexus/config.json
    let config_path = workspace.path.join(".nexus").join("config.json");
    if !config_path.exists() {
        let config_content = serde_json::json!({
            "version": "1.0",
            "project_name": workspace.name,
            "created_at": Utc::now().to_rfc3339(),
            "agents": {},
            "workflows": []
        });
        fs::write(&config_path, serde_json::to_string_pretty(&config_content).unwrap())?;
        log::info!("Created .nexus/config.json");
    }

    // Create .gitignore if it doesn't exist
    let gitignore_path = workspace.path.join(".gitignore");
    if !gitignore_path.exists() {
        let gitignore_content = r#"# NEXUS
.nexus/logs/
.nexus/*.log

# Dependencies
node_modules/
target/
vendor/

# Build outputs
dist/
build/
*.exe
*.dll
*.so
*.dylib

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Environment
.env
.env.local
*.pem
*.key
"#;
        fs::write(&gitignore_path, gitignore_content)?;
        log::info!("Created .gitignore");
    }

    Ok(())
}

/// Get the working directory for a project, creating it if needed
pub fn ensure_project_directory(working_dir: &str) -> Result<PathBuf, WorkspaceError> {
    let path = PathBuf::from(working_dir);

    if !path.exists() {
        fs::create_dir_all(&path)?;
        log::info!("Created project directory: {:?}", path);
    }

    Ok(path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_project_name() {
        assert_eq!(sanitize_project_name("My Project"), "my-project");
        assert_eq!(sanitize_project_name("Test_123"), "test_123");
        assert_eq!(sanitize_project_name("Hello World!"), "hello-world"); // trailing _ is trimmed
        assert_eq!(sanitize_project_name("---test---"), "test");
    }

    #[test]
    fn test_sanitize_empty_name() {
        assert_eq!(sanitize_project_name(""), "");
        assert_eq!(sanitize_project_name("---"), "");
    }
}
