import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type {
  Agent,
  SpawnAgentRequest,
  Project,
  CreateProjectRequest,
  UpdateProjectRequest,
  Workflow,
  CreateWorkflowRequest,
  ExecuteWorkflowRequest,
  AgentOutput,
  SystemStatus,
  DatabaseStatus,
} from '../types';

// Agent Commands
export async function spawnAgent(request: SpawnAgentRequest): Promise<Agent> {
  return invoke('spawn_agent', { request });
}

export async function killAgent(agentId: string): Promise<void> {
  return invoke('kill_agent', { agentId });
}

export async function listAgents(): Promise<Agent[]> {
  return invoke('list_agents');
}

export async function getAgent(agentId: string): Promise<Agent> {
  return invoke('get_agent', { agentId });
}

export async function sendToAgent(agentId: string, input: string): Promise<void> {
  return invoke('send_to_agent', { agentId, input });
}

export async function restartAgent(agentId: string): Promise<Agent> {
  return invoke('restart_agent', { agentId });
}

export async function getAgentOutput(agentId: string): Promise<string> {
  return invoke('get_agent_output', { agentId });
}

export async function getAgentRuntime(agentId: string): Promise<number> {
  return invoke('get_agent_runtime', { agentId });
}

export async function pauseAgent(agentId: string): Promise<void> {
  return invoke('pause_agent', { agentId });
}

export async function resumeAgent(agentId: string): Promise<void> {
  return invoke('resume_agent', { agentId });
}

// Project Commands
export async function createProject(request: CreateProjectRequest): Promise<Project> {
  return invoke('create_project', { request });
}

export async function getProject(projectId: string): Promise<Project> {
  return invoke('get_project', { projectId });
}

export async function listProjects(): Promise<Project[]> {
  return invoke('list_projects');
}

export async function updateProject(projectId: string, request: UpdateProjectRequest): Promise<Project> {
  return invoke('update_project', { projectId, request });
}

export async function deleteProject(projectId: string): Promise<void> {
  return invoke('delete_project', { projectId });
}

export async function getProjectsBaseDirectory(): Promise<string> {
  return invoke('get_projects_base_directory');
}

// Workflow Commands
export async function createWorkflow(request: CreateWorkflowRequest): Promise<Workflow> {
  return invoke('create_workflow', { request });
}

export async function getWorkflow(workflowId: string): Promise<Workflow> {
  return invoke('get_workflow', { workflowId });
}

export async function listWorkflows(): Promise<Workflow[]> {
  return invoke('list_workflows');
}

export async function executeWorkflow(request: ExecuteWorkflowRequest): Promise<string> {
  return invoke('execute_workflow', { request });
}

export async function cancelWorkflowExecution(executionId: string): Promise<boolean> {
  return invoke('cancel_workflow_execution', { executionId });
}

export async function executeOrchestratedWorkflow(projectId: string, inputPrompt: string): Promise<string> {
  return invoke('execute_orchestrated_workflow', { projectId, inputPrompt });
}

export interface WorkflowExecutionStatus {
  execution_id: string;
  workflow_id: string;
  project_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  total_nodes: number;
  completed_nodes: number;
  failed_nodes: string[];
  progress: number;
  started_at: string;
  completed_at?: string;
}

export async function getWorkflowExecutionStatus(executionId: string): Promise<WorkflowExecutionStatus> {
  return invoke('get_workflow_execution_status', { executionId });
}

export interface WorkflowValidationResult {
  is_valid: boolean;
  has_cycle: boolean;
  disconnected_nodes: string[];
  root_nodes: string[];
  leaf_nodes: string[];
  total_nodes: number;
  total_edges: number;
  execution_levels: number | null;
  error: string | null;
}

export async function validateWorkflow(graph: { nodes: unknown[]; edges: unknown[] }): Promise<WorkflowValidationResult> {
  return invoke('validate_workflow', { graph });
}

// System Commands
export async function getSystemStatus(): Promise<SystemStatus> {
  return invoke('get_system_status');
}

export async function getDatabaseStatus(): Promise<DatabaseStatus> {
  return invoke('get_database_status');
}

// Event Listeners
export function onAgentOutput(callback: (output: AgentOutput) => void): Promise<UnlistenFn> {
  return listen<AgentOutput>('agent-output', (event) => callback(event.payload));
}

export function onAgentSpawned(callback: (agent: Agent) => void): Promise<UnlistenFn> {
  return listen<Agent>('agent-spawned', (event) => callback(event.payload));
}

export function onAgentKilled(callback: (agentId: string) => void): Promise<UnlistenFn> {
  return listen<string>('agent-killed', (event) => callback(event.payload));
}

export function onAgentStatus(callback: (data: { agentId: string; status: string }) => void): Promise<UnlistenFn> {
  return listen('agent-status', (event) => callback(event.payload as { agentId: string; status: string }));
}

export function onAgentProgress(callback: (data: { agentId: string; progress: number }) => void): Promise<UnlistenFn> {
  return listen('agent-progress', (event) => callback(event.payload as { agentId: string; progress: number }));
}

export function onWorkflowExecutionStarted(
  callback: (data: { executionId: string; workflowId: string; workflowName: string }) => void
): Promise<UnlistenFn> {
  return listen('workflow-execution-started', (event) =>
    callback(event.payload as { executionId: string; workflowId: string; workflowName: string })
  );
}

// Workflow Event Types
export type NodeExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface WorkflowEventExecutionStarted {
  type: 'execution_started';
  execution_id: string;
  workflow_id: string;
  workflow_name: string;
  total_nodes: number;
}

export interface WorkflowEventNodeStatusChanged {
  type: 'node_status_changed';
  execution_id: string;
  node_id: string;
  status: NodeExecutionStatus;
  progress: number;
  agent_id?: string;
  error?: string;
}

export interface WorkflowEventNodeStarted {
  type: 'node_started';
  execution_id: string;
  node_id: string;
  agent_id: string;
}

export interface WorkflowEventNodeCompleted {
  type: 'node_completed';
  execution_id: string;
  node_id: string;
  output?: string;
}

export interface WorkflowEventNodeFailed {
  type: 'node_failed';
  execution_id: string;
  node_id: string;
  error: string;
}

export interface WorkflowEventNodeSkipped {
  type: 'node_skipped';
  execution_id: string;
  node_id: string;
  reason: string;
}

export interface WorkflowEventLevelStarted {
  type: 'level_started';
  execution_id: string;
  level: number;
  node_ids: string[];
}

export interface WorkflowEventLevelCompleted {
  type: 'level_completed';
  execution_id: string;
  level: number;
}

export interface WorkflowEventProgressUpdate {
  type: 'progress_update';
  execution_id: string;
  completed_nodes: number;
  total_nodes: number;
  progress_percent: number;
}

export interface WorkflowEventExecutionCompleted {
  type: 'execution_completed';
  execution_id: string;
  workflow_id: string;
  duration_ms: number;
}

export interface WorkflowEventExecutionFailed {
  type: 'execution_failed';
  execution_id: string;
  workflow_id: string;
  error: string;
  failed_nodes: string[];
}

export interface WorkflowEventExecutionCancelled {
  type: 'execution_cancelled';
  execution_id: string;
  workflow_id: string;
}

export type WorkflowEvent =
  | WorkflowEventExecutionStarted
  | WorkflowEventNodeStatusChanged
  | WorkflowEventNodeStarted
  | WorkflowEventNodeCompleted
  | WorkflowEventNodeFailed
  | WorkflowEventNodeSkipped
  | WorkflowEventLevelStarted
  | WorkflowEventLevelCompleted
  | WorkflowEventProgressUpdate
  | WorkflowEventExecutionCompleted
  | WorkflowEventExecutionFailed
  | WorkflowEventExecutionCancelled;

export function onWorkflowEvent(callback: (event: WorkflowEvent) => void): Promise<UnlistenFn> {
  return listen<WorkflowEvent>('workflow-event', (event) => callback(event.payload));
}

// Dynamic graph update from orchestrator
export interface DynamicGraphNode {
  id: string;
  label: string;
  agent_role: string;
  system_prompt?: string;
  assigned_task?: string;
}

export interface DynamicGraphEdge {
  id: string;
  source: string;
  target: string;
  data_type?: string;
}

export interface WorkflowGraphUpdatedEvent {
  execution_id: string;
  nodes: DynamicGraphNode[];
  edges: DynamicGraphEdge[];
}

export function onWorkflowGraphUpdated(
  callback: (event: WorkflowGraphUpdatedEvent) => void
): Promise<UnlistenFn> {
  return listen<WorkflowGraphUpdatedEvent>('workflow-graph-updated', (event) =>
    callback(event.payload)
  );
}

// =============================================================================
// Enhanced Orchestration Types and Commands
// =============================================================================

// Retry configuration
export interface RetryConfig {
  max_attempts?: number;
  initial_delay_ms?: number;
  max_delay_ms?: number;
  backoff_multiplier?: number;
}

// Condition types for conditional execution
export type ConditionType =
  | 'always'
  | 'never'
  | 'on_success'
  | 'on_failure'
  | 'all_predecessors_succeeded'
  | 'any_predecessor_succeeded'
  | 'variable_equals'
  | 'variable_truthy';

// Node configuration for enhanced execution
export interface EnhancedNodeConfig {
  condition_type?: ConditionType;
  condition_params?: Record<string, unknown>;
  retry_config?: RetryConfig;
  system_prompt_override?: string;
  output_tags?: string[];
}

// Enhanced execution request
export interface EnhancedExecutionRequest {
  graph: { nodes: unknown[]; edges: unknown[] };
  project_id: string;
  input_prompt: string;
  retry_config?: RetryConfig;
  enable_data_flow?: boolean;
  include_original_prompt?: boolean;
  node_configs?: Record<string, EnhancedNodeConfig>;
}

// Execute workflow with enhanced features
export async function executeEnhancedWorkflow(request: EnhancedExecutionRequest): Promise<string> {
  return invoke('execute_enhanced_workflow', { request });
}

// Execution context summary
export interface ExecutionContextSummary {
  execution_id: string;
  project_id: string;
  started_at: string;
  node_count: number;
  total_outputs: number;
  variable_count: number;
  node_outputs: Array<{
    node_id: string;
    output_count: number;
    latest_timestamp?: string;
  }>;
}

// Get execution context data
export async function getExecutionContext(executionId: string): Promise<ExecutionContextSummary> {
  return invoke('get_execution_context', { executionId });
}

// Checkpoint summary
export interface CheckpointSummary {
  id: string;
  execution_id: string;
  workflow_id: string;
  status: string;
  progress: number;
  total_nodes: number;
  completed_nodes: number;
  failed_nodes: number;
  pending_nodes: number;
  checkpoint_at: string;
  current_level: number;
  total_levels: number;
}

// List all checkpoints
export async function listCheckpoints(): Promise<CheckpointSummary[]> {
  return invoke('list_checkpoints');
}

// List checkpoints for specific execution
export async function listExecutionCheckpoints(executionId: string): Promise<CheckpointSummary[]> {
  return invoke('list_execution_checkpoints', { executionId });
}

// Cleanup old checkpoints
export async function cleanupCheckpoints(keepPerExecution?: number): Promise<number> {
  return invoke('cleanup_checkpoints', { keepPerExecution });
}

// Agent role information
export interface AgentRoleInfo {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
}

// Get available agent roles
export async function getAvailableAgentRoles(): Promise<AgentRoleInfo[]> {
  return invoke('get_available_agent_roles');
}

// Aggregation strategy information
export interface AggregationStrategyInfo {
  id: string;
  name: string;
  description: string;
}

// Get available aggregation strategies
export async function getAggregationStrategies(): Promise<AggregationStrategyInfo[]> {
  return invoke('get_aggregation_strategies');
}

// Condition type information
export interface ConditionTypeInfo {
  id: string;
  name: string;
  description: string;
  params: string[];
}

// Get available condition types
export async function getConditionTypes(): Promise<ConditionTypeInfo[]> {
  return invoke('get_condition_types');
}

// =============================================================================
// Template Commands
// =============================================================================

// Template variable type
export interface TemplateVariable {
  name: string;
  description: string;
  default_value: string | null;
  required: boolean;
  variable_type: string;
  options: string[] | null;
}

// Workflow template response
export interface WorkflowTemplateInfo {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  estimated_duration_minutes: number | null;
  variables: TemplateVariable[];
  task_count: number;
}

// Planned task from template instantiation
export interface PlannedTask {
  id: string;
  name: string;
  agent_role: string;
  description: string;
  depends_on: string[];
}

// Template category info
export interface TemplateCategoryInfo {
  id: string;
  name: string;
  description: string;
}

// List all workflow templates
export async function listWorkflowTemplates(): Promise<WorkflowTemplateInfo[]> {
  return invoke('list_workflow_templates');
}

// Get a specific workflow template
export async function getWorkflowTemplate(templateId: string): Promise<WorkflowTemplateInfo> {
  return invoke('get_workflow_template', { templateId });
}

// Search workflow templates
export async function searchWorkflowTemplates(query: string): Promise<WorkflowTemplateInfo[]> {
  return invoke('search_workflow_templates', { query });
}

// Get templates by category
export async function getTemplatesByCategory(category: string): Promise<WorkflowTemplateInfo[]> {
  return invoke('get_templates_by_category', { category });
}

// Instantiate a template with variables
export async function instantiateTemplate(
  templateId: string,
  variables: Record<string, string>
): Promise<PlannedTask[]> {
  return invoke('instantiate_template', { templateId, variables });
}

// Get available template categories
export async function getTemplateCategories(): Promise<TemplateCategoryInfo[]> {
  return invoke('get_template_categories');
}

// =============================================================================
// Execution History Commands
// =============================================================================

// Execution record summary
export interface ExecutionRecordSummary {
  id: string;
  workflow_name: string;
  project_name: string;
  input_prompt: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  total_nodes: number;
  completed_nodes: number;
  failed_nodes: number;
  tags: string[];
}

// History statistics
export interface HistoryStatistics {
  total_executions: number;
  completed_executions: number;
  failed_executions: number;
  cancelled_executions: number;
  success_rate: number;
  average_duration_ms: number | null;
  total_nodes_executed: number;
  total_nodes_completed: number;
  node_success_rate: number;
}

// Get execution history statistics
export async function getExecutionHistoryStats(): Promise<HistoryStatistics> {
  return invoke('get_execution_history_stats');
}

// List execution history records
export async function listExecutionHistory(
  limit?: number,
  projectId?: string
): Promise<ExecutionRecordSummary[]> {
  return invoke('list_execution_history', { limit, projectId });
}

// Search execution history
export async function searchExecutionHistory(query: string): Promise<ExecutionRecordSummary[]> {
  return invoke('search_execution_history', { query });
}

// =============================================================================
// Resource Management Commands
// =============================================================================

// Resource statistics snapshot
export interface ResourceStats {
  current_active: number;
  queue_length: number;
  total_acquired: number;
  total_released: number;
  total_queued: number;
  total_dequeued: number;
  total_timeouts: number;
  total_rejected: number;
  peak_active: number;
  avg_duration_ms: number | null;
}

// Resource configuration
export interface ResourceConfigInfo {
  max_concurrent_agents: number;
  max_queue_size: number;
  rate_limit_per_minute: number | null;
  acquire_timeout_ms: number;
  enable_priority_queue: boolean;
}

// Resource availability
export interface ResourceAvailability {
  is_available: boolean;
  available_permits: number;
  active_count: number;
  queue_length: number;
}

// Get resource statistics
export async function getResourceStats(): Promise<ResourceStats> {
  return invoke('get_resource_stats');
}

// Get resource configuration
export async function getResourceConfig(): Promise<ResourceConfigInfo> {
  return invoke('get_resource_config');
}

// Check resource availability
export async function checkResourceAvailability(): Promise<ResourceAvailability> {
  return invoke('check_resource_availability');
}

// =============================================================================
// Messaging Commands
// =============================================================================

// Agent message response
export interface AgentMessageInfo {
  id: string;
  from_agent_id: string;
  from_node_id: string;
  from_role: string;
  to_agent_id: string | null;
  to_node_id: string | null;
  message_type: string;
  content: unknown;
  timestamp: string;
  priority: string;
  read: boolean;
}

// Get all messages for an execution
export async function getExecutionMessages(executionId: string): Promise<AgentMessageInfo[]> {
  return invoke('get_execution_messages', { executionId });
}

// Get unread messages for an agent
export async function getUnreadAgentMessages(
  executionId: string,
  agentId: string
): Promise<AgentMessageInfo[]> {
  return invoke('get_unread_agent_messages', { executionId, agentId });
}

// =============================================================================
// MCP Commands
// =============================================================================

// Call an MCP tool by name with arguments
export async function mcpCallTool<T = unknown>(
  name: string,
  args: Record<string, unknown> = {}
): Promise<T> {
  return invoke('mcp_call_tool', { name, arguments: args });
}

// List available MCP tools
export async function mcpListTools(): Promise<unknown[]> {
  return invoke('mcp_list_tools');
}

// Check if MCP server is available
export async function mcpHealthCheck(): Promise<boolean> {
  return invoke('mcp_health_check');
}

// Get MCP server info
export interface McpServerInfo {
  connected: boolean;
  url: string;
  toolCount?: number;
  error?: string;
}

export async function mcpServerInfo(): Promise<McpServerInfo> {
  return invoke('mcp_server_info');
}
