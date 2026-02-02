import { create } from 'zustand';
import type { Workflow, WorkflowNode, WorkflowEdge, CreateWorkflowRequest } from '../types';
import type { NodeExecutionStatus, DynamicGraphNode, DynamicGraphEdge, WorkflowValidationResult } from '../services/tauri';
import * as tauri from '../services/tauri';
import { logWorkflowStarted, logWorkflowCompleted, logWorkflowFailed } from './activityStore';

export interface NodeExecutionState {
  status: NodeExecutionStatus;
  agentId?: string;
  progress: number;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface WorkflowMessage {
  id: string;
  timestamp: number;
  fromNodeId: string;
  fromNodeName: string;
  fromNodeRole: string;
  toNodeId: string | 'broadcast';
  toNodeName?: string;
  type: 'command' | 'data' | 'result' | 'error';
  content: string;
}

interface WorkflowState {
  workflows: Map<string, Workflow>;
  currentWorkflow: Workflow | null;
  isExecuting: boolean;
  executionId: string | null;
  isLoading: boolean;
  error: string | null;

  // Canvas state
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];

  // Execution state tracking
  nodeStatuses: Map<string, NodeExecutionState>;
  executionProgress: number;
  completedNodes: number;
  totalNodes: number;
  executionStartTime: number | null;
  messages: WorkflowMessage[];

  // Validation state
  validationResult: WorkflowValidationResult | null;

  // Actions
  fetchWorkflows: () => Promise<void>;
  createWorkflow: (request: CreateWorkflowRequest) => Promise<Workflow>;
  saveCurrentWorkflow: (name: string, description?: string) => Promise<Workflow>;
  updateWorkflow: (workflowId: string, name: string, description?: string) => Promise<void>;
  loadWorkflow: (workflowId: string) => Promise<void>;
  deleteWorkflow: (workflowId: string) => Promise<void>;
  executeWorkflow: (workflowId: string, projectId: string, prompt: string) => Promise<string>;
  executeOrchestratedWorkflow: (projectId: string, prompt: string) => Promise<string>;
  cancelExecution: () => Promise<void>;
  updateDynamicGraph: (nodes: DynamicGraphNode[], edges: DynamicGraphEdge[]) => void;

  // Canvas actions
  setNodes: (nodes: WorkflowNode[]) => void;
  setEdges: (edges: WorkflowEdge[]) => void;
  addNode: (node: WorkflowNode) => void;
  removeNode: (nodeId: string) => void;
  updateNodeStatus: (nodeId: string, status: 'pending' | 'running' | 'completed' | 'failed') => void;
  addEdge: (edge: WorkflowEdge) => void;
  removeEdge: (edgeId: string) => void;
  clearCanvas: () => void;

  // Execution status actions
  updateNodeExecutionStatus: (
    nodeId: string,
    status: NodeExecutionStatus,
    progress?: number,
    agentId?: string,
    error?: string
  ) => void;
  setExecutionProgress: (completed: number, total: number, progress: number) => void;
  setExecutionComplete: (success: boolean, error?: string) => void;
  resetExecutionState: () => void;
  addMessage: (message: Omit<WorkflowMessage, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;
  validateWorkflow: () => Promise<WorkflowValidationResult>;

  clearError: () => void;
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  workflows: new Map(),
  currentWorkflow: null,
  isExecuting: false,
  executionId: null,
  isLoading: false,
  error: null,
  nodes: [],
  edges: [],
  nodeStatuses: new Map(),
  executionProgress: 0,
  completedNodes: 0,
  totalNodes: 0,
  executionStartTime: null,
  messages: [],
  validationResult: null,

  fetchWorkflows: async () => {
    set({ isLoading: true, error: null });
    try {
      const workflows = await tauri.listWorkflows();
      const workflowMap = new Map(workflows.map((w) => [w.id, w]));
      set({ workflows: workflowMap, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  createWorkflow: async (request) => {
    set({ isLoading: true, error: null });
    try {
      const workflow = await tauri.createWorkflow(request);
      set((state) => {
        const newWorkflows = new Map(state.workflows);
        newWorkflows.set(workflow.id, workflow);
        return { workflows: newWorkflows, isLoading: false };
      });
      return workflow;
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  saveCurrentWorkflow: async (name, description) => {
    const { nodes, edges } = get();
    set({ isLoading: true, error: null });

    try {
      const workflow = await tauri.createWorkflow({
        name,
        description,
        graph: { nodes, edges },
        is_template: false,
      });

      set((state) => {
        const newWorkflows = new Map(state.workflows);
        newWorkflows.set(workflow.id, workflow);
        return {
          workflows: newWorkflows,
          currentWorkflow: workflow,
          isLoading: false
        };
      });

      return workflow;
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  updateWorkflow: async (workflowId, name, description) => {
    const { nodes, edges, workflows } = get();
    const existing = workflows.get(workflowId);
    if (!existing) {
      throw new Error('Workflow not found');
    }

    // Since we don't have an update endpoint, create a new workflow with the same data
    // and update the local state
    set((state) => {
      const newWorkflows = new Map(state.workflows);
      const updated: Workflow = {
        ...existing,
        name,
        description,
        graph: { nodes, edges },
      };
      newWorkflows.set(workflowId, updated);
      return { workflows: newWorkflows, currentWorkflow: updated };
    });
  },

  deleteWorkflow: async (workflowId) => {
    set((state) => {
      const newWorkflows = new Map(state.workflows);
      newWorkflows.delete(workflowId);
      return {
        workflows: newWorkflows,
        currentWorkflow: state.currentWorkflow?.id === workflowId ? null : state.currentWorkflow,
      };
    });
  },

  loadWorkflow: async (workflowId) => {
    set({ isLoading: true, error: null });
    try {
      const workflow = await tauri.getWorkflow(workflowId);
      set({
        currentWorkflow: workflow,
        nodes: workflow.graph.nodes,
        edges: workflow.graph.edges,
        isLoading: false,
      });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  executeWorkflow: async (workflowId, projectId, prompt) => {
    // Reset execution state before starting
    set({
      isExecuting: true,
      error: null,
      nodeStatuses: new Map(),
      executionProgress: 0,
      completedNodes: 0,
      totalNodes: 0,
      executionStartTime: Date.now(),
      messages: [],
    });

    // Reset all node statuses to pending
    const { nodes, workflows } = get();
    const workflow = workflows.get(workflowId);
    const workflowName = workflow?.name || 'Unknown Workflow';

    const updatedNodes = nodes.map((n) => ({
      ...n,
      data: { ...n.data, status: 'pending' as const, progress: 0 },
    }));
    set({ nodes: updatedNodes });

    try {
      const executionId = await tauri.executeWorkflow({
        workflow_id: workflowId,
        project_id: projectId,
        input_prompt: prompt,
      });
      set({ executionId, isExecuting: true });
      logWorkflowStarted(workflowName);
      return executionId;
    } catch (error) {
      set({ error: String(error), isExecuting: false });
      logWorkflowFailed(workflowName, String(error));
      throw error;
    }
  },

  executeOrchestratedWorkflow: async (projectId, prompt) => {
    // Reset execution state before starting
    set({
      isExecuting: true,
      error: null,
      nodeStatuses: new Map(),
      executionProgress: 0,
      completedNodes: 0,
      totalNodes: 0,
      executionStartTime: Date.now(),
      messages: [],
      nodes: [], // Clear canvas for dynamic graph
      edges: [],
    });

    try {
      const executionId = await tauri.executeOrchestratedWorkflow(projectId, prompt);
      set({ executionId, isExecuting: true });
      logWorkflowStarted('Orchestrated Workflow');
      return executionId;
    } catch (error) {
      set({ error: String(error), isExecuting: false });
      logWorkflowFailed('Orchestrated Workflow', String(error));
      throw error;
    }
  },

  cancelExecution: async () => {
    const { executionId } = get();
    if (executionId) {
      try {
        await tauri.cancelWorkflowExecution(executionId);
        set({ isExecuting: false });
      } catch (error) {
        set({ error: String(error) });
      }
    }
  },

  updateDynamicGraph: (dynamicNodes, dynamicEdges) => {
    // Convert dynamic graph nodes/edges to WorkflowNode/WorkflowEdge format
    const nodes: WorkflowNode[] = dynamicNodes.map((node, index) => ({
      id: node.id,
      type: 'agent',
      position: { x: 250, y: 100 + index * 150 }, // Auto-layout vertically
      data: {
        label: node.label,
        agentRole: node.agent_role,
        status: 'pending' as const,
        systemPrompt: node.system_prompt,
        assignedTask: node.assigned_task,
      },
    }));

    const edges: WorkflowEdge[] = dynamicEdges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      animated: true,
      data: {
        dataType: edge.data_type,
      },
    }));

    set({ nodes, edges, totalNodes: nodes.length });
  },

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  addNode: (node) => {
    set((state) => ({ nodes: [...state.nodes, node] }));
  },

  removeNode: (nodeId) => {
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== nodeId),
      edges: state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    }));
  },

  updateNodeStatus: (nodeId, status) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, status } } : n
      ),
    }));
  },

  addEdge: (edge) => {
    set((state) => ({ edges: [...state.edges, edge] }));
  },

  removeEdge: (edgeId) => {
    set((state) => ({ edges: state.edges.filter((e) => e.id !== edgeId) }));
  },

  clearCanvas: () => {
    set({ nodes: [], edges: [], currentWorkflow: null });
  },

  clearError: () => {
    set({ error: null });
  },

  updateNodeExecutionStatus: (nodeId, status, progress = 0, agentId, error) => {
    const { nodes, nodeStatuses, addMessage } = get();
    const node = nodes.find((n) => n.id === nodeId);
    const nodeName = node?.data?.label || nodeId;
    const nodeRole = node?.data?.agentRole || 'agent';
    const existingStatus = nodeStatuses.get(nodeId);

    set((state) => {
      // Update nodeStatuses map with timestamps
      const newNodeStatuses = new Map(state.nodeStatuses);
      const now = Date.now();
      newNodeStatuses.set(nodeId, {
        status,
        agentId,
        progress,
        error,
        startedAt: status === 'running' && !existingStatus?.startedAt ? now : existingStatus?.startedAt,
        completedAt: (status === 'completed' || status === 'failed') ? now : undefined,
      });

      // Also update the node in the nodes array for visual feedback
      const updatedNodes = state.nodes.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              data: {
                ...n.data,
                status: status as 'pending' | 'running' | 'completed' | 'failed',
                progress,
                agentId,
              },
            }
          : n
      );

      return {
        nodeStatuses: newNodeStatuses,
        nodes: updatedNodes,
      };
    });

    // Add messages for status changes
    if (status === 'running' && existingStatus?.status !== 'running') {
      addMessage({
        fromNodeId: nodeId,
        fromNodeName: nodeName,
        fromNodeRole: nodeRole,
        toNodeId: 'broadcast',
        type: 'command',
        content: `Agent ${nodeName} started execution`,
      });
    } else if (status === 'completed') {
      addMessage({
        fromNodeId: nodeId,
        fromNodeName: nodeName,
        fromNodeRole: nodeRole,
        toNodeId: 'broadcast',
        type: 'result',
        content: `Agent ${nodeName} completed successfully`,
      });
    } else if (status === 'failed') {
      addMessage({
        fromNodeId: nodeId,
        fromNodeName: nodeName,
        fromNodeRole: nodeRole,
        toNodeId: 'broadcast',
        type: 'error',
        content: error || `Agent ${nodeName} failed`,
      });
    }
  },

  setExecutionProgress: (completed, total, progress) => {
    set({
      completedNodes: completed,
      totalNodes: total,
      executionProgress: progress,
    });
  },

  setExecutionComplete: (success, error) => {
    const { currentWorkflow } = get();
    const workflowName = currentWorkflow?.name || 'Workflow';

    set({
      isExecuting: false,
      error: success ? null : error || 'Execution failed',
    });

    if (success) {
      logWorkflowCompleted(workflowName);
    } else {
      logWorkflowFailed(workflowName, error);
    }
  },

  resetExecutionState: () => {
    set({
      isExecuting: false,
      executionId: null,
      nodeStatuses: new Map(),
      executionProgress: 0,
      completedNodes: 0,
      totalNodes: 0,
      executionStartTime: null,
      messages: [],
      error: null,
    });

    // Reset all node statuses
    set((state) => ({
      nodes: state.nodes.map((n) => ({
        ...n,
        data: { ...n.data, status: undefined, progress: undefined },
      })),
    }));
  },

  addMessage: (message) => {
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...message,
          id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
        },
      ],
    }));
  },

  clearMessages: () => {
    set({ messages: [] });
  },

  validateWorkflow: async () => {
    const { nodes, edges } = get();
    try {
      const result = await tauri.validateWorkflow({ nodes, edges });
      set({ validationResult: result });
      return result;
    } catch (error) {
      const errorResult: WorkflowValidationResult = {
        is_valid: false,
        has_cycle: false,
        disconnected_nodes: [],
        root_nodes: [],
        leaf_nodes: [],
        total_nodes: nodes.length,
        total_edges: edges.length,
        execution_levels: null,
        error: String(error),
      };
      set({ validationResult: errorResult });
      return errorResult;
    }
  },
}));
