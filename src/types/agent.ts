export type AgentStatus = 'idle' | 'starting' | 'running' | 'paused' | 'completed' | 'failed' | 'killed';

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  status: AgentStatus;
  projectId?: string;
  assignedTask?: string;
  progress: number;
  pid?: number;
  createdAt?: string;
}

export type AgentRole =
  | 'orchestrator'
  | 'architect'
  | 'implementer'
  | 'tester'
  | 'documenter'
  | 'security'
  | 'devops';

export interface AgentTemplate {
  id: string;
  name: string;
  role: AgentRole;
  systemPrompt: string;
  capabilities: string[];
  icon: string;
  color: string;
}

export interface AgentOutput {
  agentId: string;
  output: string;
  timestamp: number;
}

export interface AgentConfig {
  name: string;
  role: AgentRole;
  workingDirectory: string;
  projectId?: string;
  systemPrompt?: string;
  assignedTask?: string;
}

export interface SpawnAgentRequest {
  name: string;
  role: string;
  working_directory: string;
  project_id?: string;
  system_prompt?: string;
  assigned_task?: string;
}

export const AGENT_ROLE_COLORS: Record<AgentRole, string> = {
  orchestrator: '#00fff9',
  architect: '#00fff9',
  implementer: '#39ff14',
  tester: '#ff6600',
  documenter: '#ff00ff',
  security: '#ff0040',
  devops: '#808080',
};

export const AGENT_ROLE_ICONS: Record<AgentRole, string> = {
  orchestrator: 'Brain',
  architect: 'Building2',
  implementer: 'Code',
  tester: 'FlaskConical',
  documenter: 'FileText',
  security: 'Shield',
  devops: 'Container',
};
