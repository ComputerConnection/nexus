//! Pre-built workflow templates for common development tasks.
//!
//! Templates provide ready-to-use workflow patterns that users can
//! customize for their specific needs.

use serde::{Deserialize, Serialize};

use super::orchestrator::PlannedTask;

/// A workflow template definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowTemplate {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: TemplateCategory,
    pub tags: Vec<String>,
    pub tasks: Vec<PlannedTask>,
    pub variables: Vec<TemplateVariable>,
    pub estimated_duration_minutes: Option<u32>,
}

/// Categories for organizing templates
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TemplateCategory {
    Development,
    Testing,
    Documentation,
    Security,
    DevOps,
    CodeReview,
    Refactoring,
    Research,
    Custom,
}

/// A variable that can be customized when using a template
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateVariable {
    pub name: String,
    pub description: String,
    pub default_value: Option<String>,
    pub required: bool,
    pub variable_type: VariableType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VariableType {
    String,
    Number,
    Boolean,
    FilePath,
    Choice { options: Vec<String> },
}

impl WorkflowTemplate {
    /// Create a template instance with custom variable values
    pub fn instantiate(&self, variables: &std::collections::HashMap<String, String>) -> Vec<PlannedTask> {
        self.tasks
            .iter()
            .map(|task| {
                let mut task = task.clone();
                // Replace {{variable}} placeholders in description
                for (key, value) in variables {
                    let placeholder = format!("{{{{{}}}}}", key);
                    task.description = task.description.replace(&placeholder, value);
                    if let Some(ref mut prompt) = task.system_prompt {
                        *prompt = prompt.replace(&placeholder, value);
                    }
                }
                task
            })
            .collect()
    }
}

/// Get all built-in workflow templates
pub fn get_builtin_templates() -> Vec<WorkflowTemplate> {
    vec![
        // Feature Development Template
        WorkflowTemplate {
            id: "feature-development".to_string(),
            name: "Feature Development".to_string(),
            description: "Complete workflow for implementing a new feature with design, implementation, testing, and documentation.".to_string(),
            category: TemplateCategory::Development,
            tags: vec!["feature".to_string(), "full-stack".to_string(), "agile".to_string()],
            estimated_duration_minutes: Some(60),
            variables: vec![
                TemplateVariable {
                    name: "feature_name".to_string(),
                    description: "Name of the feature to implement".to_string(),
                    default_value: None,
                    required: true,
                    variable_type: VariableType::String,
                },
                TemplateVariable {
                    name: "feature_description".to_string(),
                    description: "Detailed description of the feature requirements".to_string(),
                    default_value: None,
                    required: true,
                    variable_type: VariableType::String,
                },
            ],
            tasks: vec![
                PlannedTask {
                    id: "design".to_string(),
                    name: "Architecture Design".to_string(),
                    agent_role: "architect".to_string(),
                    description: "Design the architecture for {{feature_name}}. Requirements: {{feature_description}}. Create a technical specification including data models, API contracts, and component interactions.".to_string(),
                    depends_on: vec![],
                    system_prompt: None,
                },
                PlannedTask {
                    id: "implement".to_string(),
                    name: "Implementation".to_string(),
                    agent_role: "implementer".to_string(),
                    description: "Implement {{feature_name}} following the architectural design. Write clean, well-structured code with proper error handling.".to_string(),
                    depends_on: vec!["design".to_string()],
                    system_prompt: None,
                },
                PlannedTask {
                    id: "test".to_string(),
                    name: "Testing".to_string(),
                    agent_role: "tester".to_string(),
                    description: "Write comprehensive tests for {{feature_name}} including unit tests, integration tests, and edge cases.".to_string(),
                    depends_on: vec!["implement".to_string()],
                    system_prompt: None,
                },
                PlannedTask {
                    id: "security-review".to_string(),
                    name: "Security Review".to_string(),
                    agent_role: "security".to_string(),
                    description: "Review {{feature_name}} for security vulnerabilities. Check for OWASP top 10, input validation, and secure coding practices.".to_string(),
                    depends_on: vec!["implement".to_string()],
                    system_prompt: None,
                },
                PlannedTask {
                    id: "document".to_string(),
                    name: "Documentation".to_string(),
                    agent_role: "documenter".to_string(),
                    description: "Create documentation for {{feature_name}} including API docs, usage examples, and integration guides.".to_string(),
                    depends_on: vec!["test".to_string(), "security-review".to_string()],
                    system_prompt: None,
                },
            ],
        },

        // Bug Fix Template
        WorkflowTemplate {
            id: "bug-fix".to_string(),
            name: "Bug Fix".to_string(),
            description: "Systematic workflow for investigating and fixing bugs with proper testing.".to_string(),
            category: TemplateCategory::Development,
            tags: vec!["bug".to_string(), "fix".to_string(), "debugging".to_string()],
            estimated_duration_minutes: Some(30),
            variables: vec![
                TemplateVariable {
                    name: "bug_description".to_string(),
                    description: "Description of the bug and how to reproduce it".to_string(),
                    default_value: None,
                    required: true,
                    variable_type: VariableType::String,
                },
                TemplateVariable {
                    name: "affected_area".to_string(),
                    description: "The component or area of the codebase affected".to_string(),
                    default_value: None,
                    required: false,
                    variable_type: VariableType::String,
                },
            ],
            tasks: vec![
                PlannedTask {
                    id: "investigate".to_string(),
                    name: "Investigation".to_string(),
                    agent_role: "architect".to_string(),
                    description: "Investigate the bug: {{bug_description}}. Identify root cause, affected code paths, and potential fix strategies.".to_string(),
                    depends_on: vec![],
                    system_prompt: None,
                },
                PlannedTask {
                    id: "fix".to_string(),
                    name: "Fix Implementation".to_string(),
                    agent_role: "implementer".to_string(),
                    description: "Implement the fix for: {{bug_description}}. Follow the investigation findings and ensure minimal code changes.".to_string(),
                    depends_on: vec!["investigate".to_string()],
                    system_prompt: None,
                },
                PlannedTask {
                    id: "regression-test".to_string(),
                    name: "Regression Testing".to_string(),
                    agent_role: "tester".to_string(),
                    description: "Create regression tests to prevent recurrence of: {{bug_description}}. Verify the fix works and doesn't break existing functionality.".to_string(),
                    depends_on: vec!["fix".to_string()],
                    system_prompt: None,
                },
            ],
        },

        // Code Review Template
        WorkflowTemplate {
            id: "code-review".to_string(),
            name: "Comprehensive Code Review".to_string(),
            description: "Multi-perspective code review covering quality, security, and performance.".to_string(),
            category: TemplateCategory::CodeReview,
            tags: vec!["review".to_string(), "quality".to_string(), "security".to_string()],
            estimated_duration_minutes: Some(20),
            variables: vec![
                TemplateVariable {
                    name: "files_to_review".to_string(),
                    description: "Files or directories to review".to_string(),
                    default_value: Some(".".to_string()),
                    required: true,
                    variable_type: VariableType::FilePath,
                },
                TemplateVariable {
                    name: "review_focus".to_string(),
                    description: "Specific areas to focus on".to_string(),
                    default_value: Some("general quality".to_string()),
                    required: false,
                    variable_type: VariableType::String,
                },
            ],
            tasks: vec![
                PlannedTask {
                    id: "quality-review".to_string(),
                    name: "Code Quality Review".to_string(),
                    agent_role: "architect".to_string(),
                    description: "Review {{files_to_review}} for code quality: readability, maintainability, SOLID principles, and best practices. Focus: {{review_focus}}".to_string(),
                    depends_on: vec![],
                    system_prompt: None,
                },
                PlannedTask {
                    id: "security-review".to_string(),
                    name: "Security Review".to_string(),
                    agent_role: "security".to_string(),
                    description: "Review {{files_to_review}} for security issues: vulnerabilities, sensitive data handling, authentication, authorization.".to_string(),
                    depends_on: vec![],
                    system_prompt: None,
                },
                PlannedTask {
                    id: "test-coverage".to_string(),
                    name: "Test Coverage Analysis".to_string(),
                    agent_role: "tester".to_string(),
                    description: "Analyze test coverage for {{files_to_review}}. Identify untested code paths and suggest additional test cases.".to_string(),
                    depends_on: vec![],
                    system_prompt: None,
                },
                PlannedTask {
                    id: "consolidate".to_string(),
                    name: "Consolidate Feedback".to_string(),
                    agent_role: "documenter".to_string(),
                    description: "Consolidate all review feedback into a structured report with prioritized recommendations.".to_string(),
                    depends_on: vec!["quality-review".to_string(), "security-review".to_string(), "test-coverage".to_string()],
                    system_prompt: None,
                },
            ],
        },

        // API Development Template
        WorkflowTemplate {
            id: "api-development".to_string(),
            name: "API Development".to_string(),
            description: "Design and implement a REST API with documentation and testing.".to_string(),
            category: TemplateCategory::Development,
            tags: vec!["api".to_string(), "rest".to_string(), "backend".to_string()],
            estimated_duration_minutes: Some(45),
            variables: vec![
                TemplateVariable {
                    name: "api_name".to_string(),
                    description: "Name of the API".to_string(),
                    default_value: None,
                    required: true,
                    variable_type: VariableType::String,
                },
                TemplateVariable {
                    name: "api_description".to_string(),
                    description: "What the API should do".to_string(),
                    default_value: None,
                    required: true,
                    variable_type: VariableType::String,
                },
                TemplateVariable {
                    name: "auth_type".to_string(),
                    description: "Authentication type".to_string(),
                    default_value: Some("JWT".to_string()),
                    required: false,
                    variable_type: VariableType::Choice {
                        options: vec!["JWT".to_string(), "OAuth2".to_string(), "API Key".to_string(), "None".to_string()],
                    },
                },
            ],
            tasks: vec![
                PlannedTask {
                    id: "api-design".to_string(),
                    name: "API Design".to_string(),
                    agent_role: "architect".to_string(),
                    description: "Design {{api_name}} API. Requirements: {{api_description}}. Create OpenAPI specification with endpoints, request/response schemas, and {{auth_type}} authentication.".to_string(),
                    depends_on: vec![],
                    system_prompt: None,
                },
                PlannedTask {
                    id: "implement-endpoints".to_string(),
                    name: "Implement Endpoints".to_string(),
                    agent_role: "implementer".to_string(),
                    description: "Implement the {{api_name}} API endpoints according to the design. Include proper validation, error handling, and {{auth_type}} authentication.".to_string(),
                    depends_on: vec!["api-design".to_string()],
                    system_prompt: None,
                },
                PlannedTask {
                    id: "api-tests".to_string(),
                    name: "API Testing".to_string(),
                    agent_role: "tester".to_string(),
                    description: "Create API tests for {{api_name}} including happy path, error cases, authentication tests, and load testing considerations.".to_string(),
                    depends_on: vec!["implement-endpoints".to_string()],
                    system_prompt: None,
                },
                PlannedTask {
                    id: "api-docs".to_string(),
                    name: "API Documentation".to_string(),
                    agent_role: "documenter".to_string(),
                    description: "Create comprehensive documentation for {{api_name}} API including usage examples, authentication guide, and error handling reference.".to_string(),
                    depends_on: vec!["implement-endpoints".to_string()],
                    system_prompt: None,
                },
            ],
        },

        // Refactoring Template
        WorkflowTemplate {
            id: "refactoring".to_string(),
            name: "Code Refactoring".to_string(),
            description: "Systematic refactoring with analysis, implementation, and validation.".to_string(),
            category: TemplateCategory::Refactoring,
            tags: vec!["refactor".to_string(), "cleanup".to_string(), "improvement".to_string()],
            estimated_duration_minutes: Some(40),
            variables: vec![
                TemplateVariable {
                    name: "target_code".to_string(),
                    description: "Code or module to refactor".to_string(),
                    default_value: None,
                    required: true,
                    variable_type: VariableType::String,
                },
                TemplateVariable {
                    name: "refactor_goals".to_string(),
                    description: "Goals for the refactoring".to_string(),
                    default_value: Some("Improve readability and maintainability".to_string()),
                    required: false,
                    variable_type: VariableType::String,
                },
            ],
            tasks: vec![
                PlannedTask {
                    id: "analysis".to_string(),
                    name: "Code Analysis".to_string(),
                    agent_role: "architect".to_string(),
                    description: "Analyze {{target_code}} for refactoring opportunities. Goals: {{refactor_goals}}. Identify code smells, complexity issues, and improvement areas.".to_string(),
                    depends_on: vec![],
                    system_prompt: None,
                },
                PlannedTask {
                    id: "test-baseline".to_string(),
                    name: "Test Baseline".to_string(),
                    agent_role: "tester".to_string(),
                    description: "Ensure comprehensive test coverage exists for {{target_code}} before refactoring. Add tests if needed to establish baseline behavior.".to_string(),
                    depends_on: vec![],
                    system_prompt: None,
                },
                PlannedTask {
                    id: "refactor".to_string(),
                    name: "Refactoring".to_string(),
                    agent_role: "implementer".to_string(),
                    description: "Refactor {{target_code}} following the analysis recommendations. Make incremental changes, ensuring tests pass at each step.".to_string(),
                    depends_on: vec!["analysis".to_string(), "test-baseline".to_string()],
                    system_prompt: None,
                },
                PlannedTask {
                    id: "validate".to_string(),
                    name: "Validation".to_string(),
                    agent_role: "tester".to_string(),
                    description: "Validate the refactored {{target_code}}. Ensure all tests pass and behavior is unchanged. Run performance comparisons if applicable.".to_string(),
                    depends_on: vec!["refactor".to_string()],
                    system_prompt: None,
                },
            ],
        },

        // CI/CD Pipeline Template
        WorkflowTemplate {
            id: "cicd-setup".to_string(),
            name: "CI/CD Pipeline Setup".to_string(),
            description: "Set up a complete CI/CD pipeline with testing, building, and deployment.".to_string(),
            category: TemplateCategory::DevOps,
            tags: vec!["cicd".to_string(), "devops".to_string(), "automation".to_string()],
            estimated_duration_minutes: Some(50),
            variables: vec![
                TemplateVariable {
                    name: "project_type".to_string(),
                    description: "Type of project".to_string(),
                    default_value: None,
                    required: true,
                    variable_type: VariableType::Choice {
                        options: vec!["Node.js".to_string(), "Python".to_string(), "Rust".to_string(), "Go".to_string(), "Java".to_string()],
                    },
                },
                TemplateVariable {
                    name: "deployment_target".to_string(),
                    description: "Where to deploy".to_string(),
                    default_value: Some("Docker".to_string()),
                    required: false,
                    variable_type: VariableType::Choice {
                        options: vec!["Docker".to_string(), "Kubernetes".to_string(), "AWS".to_string(), "GCP".to_string(), "Azure".to_string()],
                    },
                },
            ],
            tasks: vec![
                PlannedTask {
                    id: "pipeline-design".to_string(),
                    name: "Pipeline Design".to_string(),
                    agent_role: "devops".to_string(),
                    description: "Design CI/CD pipeline for {{project_type}} project deploying to {{deployment_target}}. Include stages for lint, test, build, and deploy.".to_string(),
                    depends_on: vec![],
                    system_prompt: None,
                },
                PlannedTask {
                    id: "build-config".to_string(),
                    name: "Build Configuration".to_string(),
                    agent_role: "devops".to_string(),
                    description: "Create build configuration for {{project_type}}: Dockerfile, build scripts, and artifact management.".to_string(),
                    depends_on: vec!["pipeline-design".to_string()],
                    system_prompt: None,
                },
                PlannedTask {
                    id: "test-automation".to_string(),
                    name: "Test Automation".to_string(),
                    agent_role: "tester".to_string(),
                    description: "Set up automated testing in the pipeline for {{project_type}}. Include unit tests, integration tests, and coverage reporting.".to_string(),
                    depends_on: vec!["pipeline-design".to_string()],
                    system_prompt: None,
                },
                PlannedTask {
                    id: "security-scan".to_string(),
                    name: "Security Scanning".to_string(),
                    agent_role: "security".to_string(),
                    description: "Add security scanning to the pipeline: dependency vulnerability checks, SAST, and container scanning for {{deployment_target}}.".to_string(),
                    depends_on: vec!["build-config".to_string()],
                    system_prompt: None,
                },
                PlannedTask {
                    id: "deploy-config".to_string(),
                    name: "Deployment Configuration".to_string(),
                    agent_role: "devops".to_string(),
                    description: "Create deployment configuration for {{deployment_target}}. Include environment configs, secrets management, and rollback strategy.".to_string(),
                    depends_on: vec!["build-config".to_string(), "test-automation".to_string(), "security-scan".to_string()],
                    system_prompt: None,
                },
            ],
        },

        // Documentation Sprint Template
        WorkflowTemplate {
            id: "documentation-sprint".to_string(),
            name: "Documentation Sprint".to_string(),
            description: "Comprehensive documentation update for a project.".to_string(),
            category: TemplateCategory::Documentation,
            tags: vec!["docs".to_string(), "documentation".to_string(), "readme".to_string()],
            estimated_duration_minutes: Some(35),
            variables: vec![
                TemplateVariable {
                    name: "project_name".to_string(),
                    description: "Name of the project".to_string(),
                    default_value: None,
                    required: true,
                    variable_type: VariableType::String,
                },
            ],
            tasks: vec![
                PlannedTask {
                    id: "readme".to_string(),
                    name: "README Update".to_string(),
                    agent_role: "documenter".to_string(),
                    description: "Create or update the README for {{project_name}}. Include overview, installation, usage, and contributing sections.".to_string(),
                    depends_on: vec![],
                    system_prompt: None,
                },
                PlannedTask {
                    id: "api-docs".to_string(),
                    name: "API Documentation".to_string(),
                    agent_role: "documenter".to_string(),
                    description: "Document all APIs in {{project_name}} with examples, parameters, and return values.".to_string(),
                    depends_on: vec![],
                    system_prompt: None,
                },
                PlannedTask {
                    id: "architecture".to_string(),
                    name: "Architecture Documentation".to_string(),
                    agent_role: "architect".to_string(),
                    description: "Document the architecture of {{project_name}} including diagrams, component interactions, and design decisions.".to_string(),
                    depends_on: vec![],
                    system_prompt: None,
                },
                PlannedTask {
                    id: "examples".to_string(),
                    name: "Code Examples".to_string(),
                    agent_role: "implementer".to_string(),
                    description: "Create comprehensive code examples for {{project_name}} covering common use cases and advanced scenarios.".to_string(),
                    depends_on: vec!["api-docs".to_string()],
                    system_prompt: None,
                },
            ],
        },

        // Security Audit Template
        WorkflowTemplate {
            id: "security-audit".to_string(),
            name: "Security Audit".to_string(),
            description: "Comprehensive security audit of a codebase.".to_string(),
            category: TemplateCategory::Security,
            tags: vec!["security".to_string(), "audit".to_string(), "vulnerability".to_string()],
            estimated_duration_minutes: Some(45),
            variables: vec![
                TemplateVariable {
                    name: "audit_scope".to_string(),
                    description: "Scope of the security audit".to_string(),
                    default_value: Some("Full codebase".to_string()),
                    required: true,
                    variable_type: VariableType::String,
                },
            ],
            tasks: vec![
                PlannedTask {
                    id: "dependency-scan".to_string(),
                    name: "Dependency Scanning".to_string(),
                    agent_role: "security".to_string(),
                    description: "Scan all dependencies in {{audit_scope}} for known vulnerabilities. Generate a report with CVEs and remediation steps.".to_string(),
                    depends_on: vec![],
                    system_prompt: None,
                },
                PlannedTask {
                    id: "code-analysis".to_string(),
                    name: "Static Code Analysis".to_string(),
                    agent_role: "security".to_string(),
                    description: "Perform static analysis on {{audit_scope}} for security issues: injection flaws, XSS, CSRF, insecure configurations.".to_string(),
                    depends_on: vec![],
                    system_prompt: None,
                },
                PlannedTask {
                    id: "auth-review".to_string(),
                    name: "Authentication Review".to_string(),
                    agent_role: "security".to_string(),
                    description: "Review authentication and authorization mechanisms in {{audit_scope}}. Check for proper session handling, password policies, and access controls.".to_string(),
                    depends_on: vec![],
                    system_prompt: None,
                },
                PlannedTask {
                    id: "data-handling".to_string(),
                    name: "Data Handling Review".to_string(),
                    agent_role: "security".to_string(),
                    description: "Review data handling in {{audit_scope}}: encryption, PII protection, secure storage, and data transmission.".to_string(),
                    depends_on: vec![],
                    system_prompt: None,
                },
                PlannedTask {
                    id: "security-report".to_string(),
                    name: "Security Report".to_string(),
                    agent_role: "documenter".to_string(),
                    description: "Compile all findings into a comprehensive security report with severity ratings, risk assessment, and prioritized remediation plan.".to_string(),
                    depends_on: vec!["dependency-scan".to_string(), "code-analysis".to_string(), "auth-review".to_string(), "data-handling".to_string()],
                    system_prompt: None,
                },
            ],
        },
    ]
}

/// Get a template by ID
pub fn get_template(id: &str) -> Option<WorkflowTemplate> {
    get_builtin_templates().into_iter().find(|t| t.id == id)
}

/// Get templates by category
pub fn get_templates_by_category(category: TemplateCategory) -> Vec<WorkflowTemplate> {
    get_builtin_templates()
        .into_iter()
        .filter(|t| t.category == category)
        .collect()
}

/// Search templates by name or tags
pub fn search_templates(query: &str) -> Vec<WorkflowTemplate> {
    let query_lower = query.to_lowercase();
    get_builtin_templates()
        .into_iter()
        .filter(|t| {
            t.name.to_lowercase().contains(&query_lower)
                || t.description.to_lowercase().contains(&query_lower)
                || t.tags.iter().any(|tag| tag.to_lowercase().contains(&query_lower))
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_builtin_templates() {
        let templates = get_builtin_templates();
        assert!(!templates.is_empty());
        assert!(templates.len() >= 8);
    }

    #[test]
    fn test_template_instantiation() {
        let template = get_template("feature-development").unwrap();
        let mut vars = std::collections::HashMap::new();
        vars.insert("feature_name".to_string(), "User Auth".to_string());
        vars.insert("feature_description".to_string(), "OAuth2 login".to_string());

        let tasks = template.instantiate(&vars);
        assert!(tasks[0].description.contains("User Auth"));
        assert!(tasks[0].description.contains("OAuth2 login"));
    }

    #[test]
    fn test_search_templates() {
        let results = search_templates("security");
        assert!(!results.is_empty());
        assert!(results.iter().any(|t| t.id == "security-audit"));
    }
}
