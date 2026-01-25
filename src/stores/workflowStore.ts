import { create } from 'zustand';
import type { Workflow, WorkflowNode, WorkflowEdge, CreateWorkflowRequest } from '../types';
import * as tauri from '../services/tauri';

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

  // Actions
  fetchWorkflows: () => Promise<void>;
  createWorkflow: (request: CreateWorkflowRequest) => Promise<Workflow>;
  loadWorkflow: (workflowId: string) => Promise<void>;
  executeWorkflow: (workflowId: string, projectId: string, prompt: string) => Promise<string>;

  // Canvas actions
  setNodes: (nodes: WorkflowNode[]) => void;
  setEdges: (edges: WorkflowEdge[]) => void;
  addNode: (node: WorkflowNode) => void;
  removeNode: (nodeId: string) => void;
  updateNodeStatus: (nodeId: string, status: 'pending' | 'running' | 'completed' | 'failed') => void;
  addEdge: (edge: WorkflowEdge) => void;
  removeEdge: (edgeId: string) => void;
  clearCanvas: () => void;

  clearError: () => void;
}

export const useWorkflowStore = create<WorkflowState>((set) => ({
  workflows: new Map(),
  currentWorkflow: null,
  isExecuting: false,
  executionId: null,
  isLoading: false,
  error: null,
  nodes: [],
  edges: [],

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
    set({ isExecuting: true, error: null });
    try {
      const executionId = await tauri.executeWorkflow({
        workflow_id: workflowId,
        project_id: projectId,
        input_prompt: prompt,
      });
      set({ executionId, isExecuting: true });
      return executionId;
    } catch (error) {
      set({ error: String(error), isExecuting: false });
      throw error;
    }
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
}));
