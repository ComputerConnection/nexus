pub mod adaptive;
pub mod aggregation;
pub mod checkpoint;
pub mod conditions;
pub mod context;
pub mod enhanced_executor;
pub mod events;
pub mod executor;
pub mod graph;
pub mod history;
pub mod messaging;
pub mod orchestrator;
pub mod resources;
pub mod retry;
pub mod state;
pub mod templates;

// Core exports
pub use events::WorkflowEvent;
pub use executor::WorkflowExecutor;
pub use graph::{GraphError, ParsedEdge, ParsedNode, WorkflowGraph};
pub use orchestrator::{OrchestratorPlan, PlannedTask};
pub use state::{ExecutionStatus, ExecutionStore, NodeExecutionStatus, WorkflowExecutionState};

// Enhanced orchestration exports
pub use adaptive::{AdaptivePlanningConfig, PlanModification, ReplanRequest, ReplanResult, ReplanTrigger};
pub use aggregation::{AggregatedOutput, AggregationStrategy, NodeAggregationConfig};
pub use checkpoint::{CheckpointManager, CheckpointSummary, ExecutionCheckpoint, ResumeOptions};
pub use conditions::{ConditionResult, EdgeType, ExecutionCondition};
pub use context::{AgentOutput, ContextStore, ExecutionContext, OutputData};
pub use enhanced_executor::{EnhancedExecutionConfig, EnhancedNodeConfig, EnhancedWorkflowExecutor};
pub use retry::{FallbackStrategy, RetryConfig, RetryDecision, RetryResult, RetryState};

// Additional feature exports
pub use history::{ExecutionHistoryStore, ExecutionRecord, HistoryStatistics, TimelineEvent, TimelineEventType};
pub use messaging::{AgentMessage, MessageBus, MessageBusStore, MessageContent, MessagePriority, MessageType};
pub use resources::{QueuedTask, ResourceConfig, ResourceError, ResourceManager, ResourceStatsSnapshot, TaskPriority};
pub use templates::{TemplateCategory, TemplateVariable, VariableType, WorkflowTemplate, get_builtin_templates, get_template, get_templates_by_category, search_templates};
