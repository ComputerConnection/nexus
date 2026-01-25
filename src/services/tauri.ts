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
