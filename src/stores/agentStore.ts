import { create } from 'zustand';
import type { Agent, AgentStatus } from '../types';
import * as tauri from '../services/tauri';
import { logAgentSpawned, logAgentKilled, logAgentCompleted, logAgentFailed } from './activityStore';

interface AgentState {
  agents: Map<string, Agent>;
  outputs: Map<string, string[]>;
  selectedAgentId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchAgents: () => Promise<void>;
  spawnAgent: (config: {
    name: string;
    role: string;
    workingDirectory: string;
    projectId?: string;
    systemPrompt?: string;
    assignedTask?: string;
  }) => Promise<Agent>;
  killAgent: (agentId: string) => Promise<void>;
  sendInput: (agentId: string, input: string) => Promise<void>;
  selectAgent: (agentId: string | null) => void;
  addOutput: (agentId: string, output: string) => void;
  updateAgentStatus: (agentId: string, status: AgentStatus) => void;
  updateAgentProgress: (agentId: string, progress: number) => void;
  clearError: () => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  agents: new Map(),
  outputs: new Map(),
  selectedAgentId: null,
  isLoading: false,
  error: null,

  fetchAgents: async () => {
    set({ isLoading: true, error: null });
    try {
      const agents = await tauri.listAgents();
      const agentMap = new Map(agents.map((a) => [a.id, a]));
      set({ agents: agentMap, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  spawnAgent: async (config) => {
    set({ isLoading: true, error: null });
    try {
      const agent = await tauri.spawnAgent({
        name: config.name,
        role: config.role,
        working_directory: config.workingDirectory,
        project_id: config.projectId,
        system_prompt: config.systemPrompt,
        assigned_task: config.assignedTask,
      });
      set((state) => {
        const newAgents = new Map(state.agents);
        newAgents.set(agent.id, agent);
        const newOutputs = new Map(state.outputs);
        newOutputs.set(agent.id, []);
        return { agents: newAgents, outputs: newOutputs, isLoading: false };
      });
      logAgentSpawned(agent.name, config.role);
      return agent;
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  killAgent: async (agentId) => {
    try {
      const state = useAgentStore.getState();
      const agent = state.agents.get(agentId);
      await tauri.killAgent(agentId);
      set((state) => {
        const newAgents = new Map(state.agents);
        newAgents.delete(agentId);
        return {
          agents: newAgents,
          selectedAgentId: state.selectedAgentId === agentId ? null : state.selectedAgentId,
        };
      });
      if (agent) {
        logAgentKilled(agent.name);
      }
    } catch (error) {
      set({ error: String(error) });
    }
  },

  sendInput: async (agentId, input) => {
    try {
      await tauri.sendToAgent(agentId, input);
    } catch (error) {
      set({ error: String(error) });
    }
  },

  selectAgent: (agentId) => {
    set({ selectedAgentId: agentId });
  },

  addOutput: (agentId, output) => {
    set((state) => {
      const newOutputs = new Map(state.outputs);
      const existing = newOutputs.get(agentId) || [];
      // Keep last 1000 lines
      const updated = [...existing, output].slice(-1000);
      newOutputs.set(agentId, updated);
      return { outputs: newOutputs };
    });
  },

  updateAgentStatus: (agentId, status) => {
    set((state) => {
      const agent = state.agents.get(agentId);
      if (!agent) return state;

      // Log activity for completion/failure
      const statusLower = String(status).toLowerCase();
      if (statusLower === 'completed') {
        logAgentCompleted(agent.name);
      } else if (statusLower === 'failed') {
        logAgentFailed(agent.name);
      }

      const newAgents = new Map(state.agents);
      newAgents.set(agentId, { ...agent, status });
      return { agents: newAgents };
    });
  },

  updateAgentProgress: (agentId, progress) => {
    set((state) => {
      const agent = state.agents.get(agentId);
      if (!agent) return state;
      const newAgents = new Map(state.agents);
      newAgents.set(agentId, { ...agent, progress });
      return { agents: newAgents };
    });
  },

  clearError: () => {
    set({ error: null });
  },
}));
