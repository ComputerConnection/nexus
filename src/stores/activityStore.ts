import { create } from 'zustand';

export type ActivityType =
  | 'agent_spawned'
  | 'agent_killed'
  | 'agent_completed'
  | 'agent_failed'
  | 'project_created'
  | 'project_deleted'
  | 'workflow_started'
  | 'workflow_completed'
  | 'workflow_failed';

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

interface ActivityState {
  activities: Activity[];
  maxActivities: number;

  // Actions
  addActivity: (activity: Omit<Activity, 'id' | 'timestamp'>) => void;
  clearActivities: () => void;
}

export const useActivityStore = create<ActivityState>((set) => ({
  activities: [],
  maxActivities: 50,

  addActivity: (activity) => {
    const newActivity: Activity = {
      ...activity,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    set((state) => ({
      activities: [newActivity, ...state.activities].slice(0, state.maxActivities),
    }));
  },

  clearActivities: () => {
    set({ activities: [] });
  },
}));

// Helper functions to log common activities
export const logAgentSpawned = (agentName: string, role: string) => {
  useActivityStore.getState().addActivity({
    type: 'agent_spawned',
    title: 'Agent Spawned',
    description: `${agentName} (${role}) started`,
  });
};

export const logAgentKilled = (agentName: string) => {
  useActivityStore.getState().addActivity({
    type: 'agent_killed',
    title: 'Agent Killed',
    description: `${agentName} was terminated`,
  });
};

export const logAgentCompleted = (agentName: string) => {
  useActivityStore.getState().addActivity({
    type: 'agent_completed',
    title: 'Agent Completed',
    description: `${agentName} finished successfully`,
  });
};

export const logAgentFailed = (agentName: string, error?: string) => {
  useActivityStore.getState().addActivity({
    type: 'agent_failed',
    title: 'Agent Failed',
    description: error ? `${agentName}: ${error}` : `${agentName} failed`,
  });
};

export const logProjectCreated = (projectName: string) => {
  useActivityStore.getState().addActivity({
    type: 'project_created',
    title: 'Project Created',
    description: `Created project "${projectName}"`,
  });
};

export const logProjectDeleted = (projectName: string) => {
  useActivityStore.getState().addActivity({
    type: 'project_deleted',
    title: 'Project Deleted',
    description: `Deleted project "${projectName}"`,
  });
};

export const logWorkflowStarted = (workflowName: string) => {
  useActivityStore.getState().addActivity({
    type: 'workflow_started',
    title: 'Workflow Started',
    description: `Started workflow "${workflowName}"`,
  });
};

export const logWorkflowCompleted = (workflowName: string) => {
  useActivityStore.getState().addActivity({
    type: 'workflow_completed',
    title: 'Workflow Completed',
    description: `Workflow "${workflowName}" completed`,
  });
};

export const logWorkflowFailed = (workflowName: string, error?: string) => {
  useActivityStore.getState().addActivity({
    type: 'workflow_failed',
    title: 'Workflow Failed',
    description: error ? `${workflowName}: ${error}` : `Workflow "${workflowName}" failed`,
  });
};
