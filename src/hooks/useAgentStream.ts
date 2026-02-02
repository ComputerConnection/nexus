import { useEffect, useRef } from 'react';
import { useAgentStore } from '../stores/agentStore';
import * as tauri from '../services/tauri';
import type { UnlistenFn } from '@tauri-apps/api/event';
import type { AgentStatus } from '../types';

export function useAgentStream() {
  const { addOutput, updateAgentStatus, updateAgentProgress } = useAgentStore();
  const unlistenersRef = useRef<UnlistenFn[]>([]);

  useEffect(() => {
    const setupListeners = async () => {
      const unlisteners: UnlistenFn[] = [];

      // Listen for agent output
      const unlistenOutput = await tauri.onAgentOutput((output) => {
        addOutput(output.agentId, output.output);
      });
      unlisteners.push(unlistenOutput);

      // Listen for agent status changes
      const unlistenStatus = await tauri.onAgentStatus((data) => {
        updateAgentStatus(data.agentId, data.status as AgentStatus);
      });
      unlisteners.push(unlistenStatus);

      // Listen for agent progress updates
      const unlistenProgress = await tauri.onAgentProgress((data) => {
        updateAgentProgress(data.agentId, data.progress);
      });
      unlisteners.push(unlistenProgress);

      unlistenersRef.current = unlisteners;
    };

    setupListeners();

    return () => {
      unlistenersRef.current.forEach((unlisten) => unlisten());
    };
  }, [addOutput, updateAgentStatus, updateAgentProgress]);
}

export function useAgentOutput(agentId: string | null) {
  const outputs = useAgentStore((state) => state.outputs);

  if (!agentId) return [];
  return outputs.get(agentId) || [];
}
