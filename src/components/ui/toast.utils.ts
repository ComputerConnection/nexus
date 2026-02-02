import { toast as sonnerToast } from 'sonner';

// Toast API wrapper with consistent styling
export const toast = {
  success: (message: string, options?: { description?: string }) => {
    return sonnerToast.success(message, {
      description: options?.description,
      style: {
        borderLeft: '3px solid var(--neon-green)',
      },
    });
  },

  error: (message: string, options?: { description?: string }) => {
    return sonnerToast.error(message, {
      description: options?.description,
      style: {
        borderLeft: '3px solid var(--neon-red)',
      },
    });
  },

  warning: (message: string, options?: { description?: string }) => {
    return sonnerToast.warning(message, {
      description: options?.description,
      style: {
        borderLeft: '3px solid var(--neon-orange)',
      },
    });
  },

  info: (message: string, options?: { description?: string }) => {
    return sonnerToast.info(message, {
      description: options?.description,
      style: {
        borderLeft: '3px solid var(--neon-cyan)',
      },
    });
  },

  loading: (message: string, options?: { description?: string }) => {
    return sonnerToast.loading(message, {
      description: options?.description,
    });
  },

  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: unknown) => string);
    }
  ) => {
    return sonnerToast.promise(promise, messages);
  },

  dismiss: (toastId?: string | number) => {
    return sonnerToast.dismiss(toastId);
  },

  custom: (
    message: string,
    options?: {
      icon?: React.ReactNode;
      description?: string;
      action?: {
        label: string;
        onClick: () => void;
      };
      duration?: number;
    }
  ) => {
    return sonnerToast(message, {
      description: options?.description,
      icon: options?.icon,
      duration: options?.duration,
      action: options?.action
        ? {
            label: options.action.label,
            onClick: options.action.onClick,
          }
        : undefined,
    });
  },

  // Agent-specific toasts
  agentSpawned: (agentName: string) => {
    return toast.success(`Agent "${agentName}" spawned`, {
      description: 'Agent is now running and ready for tasks',
    });
  },

  agentCompleted: (agentName: string) => {
    return toast.success(`Agent "${agentName}" completed`, {
      description: 'Task finished successfully',
    });
  },

  agentFailed: (agentName: string, error?: string) => {
    return toast.error(`Agent "${agentName}" failed`, {
      description: error || 'An unexpected error occurred',
    });
  },

  agentKilled: (agentName: string) => {
    return toast.info(`Agent "${agentName}" killed`, {
      description: 'Agent has been terminated',
    });
  },

  // Project toasts
  projectCreated: (projectName: string) => {
    return toast.success(`Project "${projectName}" created`, {
      description: 'Ready to start working',
    });
  },

  // Workflow toasts
  workflowStarted: (workflowName: string) => {
    return toast.info(`Workflow "${workflowName}" started`, {
      description: 'Execution in progress...',
    });
  },

  workflowCompleted: (workflowName: string) => {
    return toast.success(`Workflow "${workflowName}" completed`, {
      description: 'All tasks finished successfully',
    });
  },
};
