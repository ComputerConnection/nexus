import type { Node, Edge } from '@xyflow/react';

export interface WorkflowNode extends Node {
  data: {
    label: string;
    agentRole: string;
    agentId?: string;
    status?: 'pending' | 'running' | 'completed' | 'failed';
    progress?: number;
    systemPrompt?: string;
    assignedTask?: string;
  };
}

export interface WorkflowEdge extends Edge {
  data?: {
    label?: string;
    dataType?: string;
  };
  animated?: boolean;
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  graph: WorkflowGraph;
  isTemplate: boolean;
  createdAt: string;
}

export interface CreateWorkflowRequest {
  name: string;
  description?: string;
  graph: WorkflowGraph;
  is_template?: boolean;
}

export interface ExecuteWorkflowRequest {
  workflow_id: string;
  project_id: string;
  input_prompt: string;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  projectId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  result?: unknown;
}
