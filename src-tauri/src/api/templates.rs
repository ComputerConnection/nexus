use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use lazy_static::lazy_static;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentTemplate {
    pub name: String,
    pub role: String,
    pub system_prompt: String,
    pub icon: String,
    pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuickAction {
    pub id: String,
    pub name: String,
    pub description: String,
    pub template: String,
    pub default_task: Option<String>,
    pub working_directory: Option<String>,
    pub icon: String,
    pub color: String,
}

lazy_static! {
    pub static ref AGENT_TEMPLATES: HashMap<String, AgentTemplate> = {
        let mut m = HashMap::new();

        m.insert("orchestrator".to_string(), AgentTemplate {
            name: "Orchestrator".to_string(),
            role: "orchestrator".to_string(),
            system_prompt: r#"You are the Orchestrator agent for NEXUS. Your role is to:
1. Analyze complex tasks and break them into subtasks
2. Determine which specialist agents are needed
3. Coordinate execution and aggregate results
4. Report progress and handle errors gracefully

Always provide clear status updates and structured output."#.to_string(),
            icon: "brain".to_string(),
            color: "#00fff9".to_string(),
        });

        m.insert("architect".to_string(), AgentTemplate {
            name: "Code Architect".to_string(),
            role: "architect".to_string(),
            system_prompt: r#"You are a Code Architect agent. Your role is to:
1. Design system architecture and file structures
2. Define interfaces and data models
3. Create technical specifications
4. Ensure scalability and maintainability

Focus on clean architecture principles and best practices."#.to_string(),
            icon: "building".to_string(),
            color: "#ff00ff".to_string(),
        });

        m.insert("implementer".to_string(), AgentTemplate {
            name: "Implementation Specialist".to_string(),
            role: "implementer".to_string(),
            system_prompt: r#"You are an Implementation Specialist agent. Your role is to:
1. Write production-quality code
2. Implement features according to specifications
3. Handle edge cases and error conditions
4. Follow coding standards and best practices

Write clean, efficient, and well-documented code."#.to_string(),
            icon: "code".to_string(),
            color: "#39ff14".to_string(),
        });

        m.insert("tester".to_string(), AgentTemplate {
            name: "Test Engineer".to_string(),
            role: "tester".to_string(),
            system_prompt: r#"You are a Test Engineer agent. Your role is to:
1. Write comprehensive test suites
2. Create unit, integration, and e2e tests
3. Ensure high code coverage
4. Validate implementations against requirements

Focus on edge cases, error handling, and regression prevention."#.to_string(),
            icon: "flask".to_string(),
            color: "#ff6600".to_string(),
        });

        m.insert("documenter".to_string(), AgentTemplate {
            name: "Documentation Writer".to_string(),
            role: "documenter".to_string(),
            system_prompt: r#"You are a Documentation Writer agent. Your role is to:
1. Create clear README files
2. Write API documentation
3. Document code with meaningful comments
4. Create user guides and tutorials

Make documentation accessible and comprehensive."#.to_string(),
            icon: "file-text".to_string(),
            color: "#808080".to_string(),
        });

        m.insert("security".to_string(), AgentTemplate {
            name: "Security Auditor".to_string(),
            role: "security".to_string(),
            system_prompt: r#"You are a Security Auditor agent. Your role is to:
1. Review code for security vulnerabilities
2. Check for OWASP Top 10 issues
3. Audit dependencies for known CVEs
4. Recommend security hardening measures

Be thorough and prioritize critical security issues."#.to_string(),
            icon: "shield".to_string(),
            color: "#ff0040".to_string(),
        });

        m.insert("devops".to_string(), AgentTemplate {
            name: "DevOps Engineer".to_string(),
            role: "devops".to_string(),
            system_prompt: r#"You are a DevOps Engineer agent. Your role is to:
1. Set up CI/CD pipelines
2. Configure deployment processes
3. Manage infrastructure as code
4. Optimize build and deployment times

Focus on automation, reliability, and observability."#.to_string(),
            icon: "container".to_string(),
            color: "#9945ff".to_string(),
        });

        m.insert("reviewer".to_string(), AgentTemplate {
            name: "Code Reviewer".to_string(),
            role: "reviewer".to_string(),
            system_prompt: r#"You are a Code Reviewer agent. Your role is to:
1. Review code changes for quality and correctness
2. Check for adherence to coding standards
3. Identify potential bugs and improvements
4. Provide constructive feedback

Be thorough but constructive in your reviews."#.to_string(),
            icon: "search".to_string(),
            color: "#00bfff".to_string(),
        });

        m
    };

    pub static ref QUICK_ACTIONS: HashMap<String, QuickAction> = {
        let mut m = HashMap::new();

        // Development Quick Actions
        m.insert("build-api".to_string(), QuickAction {
            id: "build-api".to_string(),
            name: "Build REST API".to_string(),
            description: "Create a REST API with CRUD operations".to_string(),
            template: "implementer".to_string(),
            default_task: Some("Build a REST API with proper error handling, validation, and documentation".to_string()),
            working_directory: None,
            icon: "server".to_string(),
            color: "#39ff14".to_string(),
        });

        m.insert("write-tests".to_string(), QuickAction {
            id: "write-tests".to_string(),
            name: "Write Tests".to_string(),
            description: "Create comprehensive test suite".to_string(),
            template: "tester".to_string(),
            default_task: Some("Analyze the codebase and write comprehensive tests with good coverage".to_string()),
            working_directory: None,
            icon: "flask".to_string(),
            color: "#ff6600".to_string(),
        });

        m.insert("security-audit".to_string(), QuickAction {
            id: "security-audit".to_string(),
            name: "Security Audit".to_string(),
            description: "Scan for security vulnerabilities".to_string(),
            template: "security".to_string(),
            default_task: Some("Perform a security audit of this codebase, checking for vulnerabilities".to_string()),
            working_directory: None,
            icon: "shield".to_string(),
            color: "#ff0040".to_string(),
        });

        m.insert("refactor".to_string(), QuickAction {
            id: "refactor".to_string(),
            name: "Refactor Code".to_string(),
            description: "Improve code quality and structure".to_string(),
            template: "architect".to_string(),
            default_task: Some("Analyze and refactor this codebase for better maintainability and performance".to_string()),
            working_directory: None,
            icon: "git-branch".to_string(),
            color: "#ff00ff".to_string(),
        });

        m.insert("generate-docs".to_string(), QuickAction {
            id: "generate-docs".to_string(),
            name: "Generate Docs".to_string(),
            description: "Create documentation".to_string(),
            template: "documenter".to_string(),
            default_task: Some("Generate comprehensive documentation for this codebase including README and API docs".to_string()),
            working_directory: None,
            icon: "file-text".to_string(),
            color: "#808080".to_string(),
        });

        m.insert("code-review".to_string(), QuickAction {
            id: "code-review".to_string(),
            name: "Code Review".to_string(),
            description: "Review recent changes".to_string(),
            template: "reviewer".to_string(),
            default_task: Some("Review the recent code changes and provide feedback on quality, bugs, and improvements".to_string()),
            working_directory: None,
            icon: "search".to_string(),
            color: "#00bfff".to_string(),
        });

        m.insert("setup-cicd".to_string(), QuickAction {
            id: "setup-cicd".to_string(),
            name: "Setup CI/CD".to_string(),
            description: "Configure deployment pipeline".to_string(),
            template: "devops".to_string(),
            default_task: Some("Set up a CI/CD pipeline with GitHub Actions including build, test, and deploy stages".to_string()),
            working_directory: None,
            icon: "container".to_string(),
            color: "#9945ff".to_string(),
        });

        m.insert("debug".to_string(), QuickAction {
            id: "debug".to_string(),
            name: "Debug Issue".to_string(),
            description: "Investigate and fix bugs".to_string(),
            template: "implementer".to_string(),
            default_task: Some("Investigate and fix any bugs or issues in this codebase".to_string()),
            working_directory: None,
            icon: "bug".to_string(),
            color: "#ff6600".to_string(),
        });

        m
    };
}

pub fn get_template(id: &str) -> Option<&'static AgentTemplate> {
    AGENT_TEMPLATES.get(id)
}

pub fn get_quick_action(id: &str) -> Option<&'static QuickAction> {
    QUICK_ACTIONS.get(id)
}

pub fn list_templates() -> Vec<&'static AgentTemplate> {
    AGENT_TEMPLATES.values().collect()
}

pub fn list_quick_actions() -> Vec<&'static QuickAction> {
    QUICK_ACTIONS.values().collect()
}
