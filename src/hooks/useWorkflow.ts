import { useCallback, useEffect, useRef } from 'react';
import { useWorkflowStore } from '../stores/workflowStore';
import * as tauri from '../services/tauri';
import type { UnlistenFn } from '@tauri-apps/api/event';
import type { WorkflowEvent } from '../services/tauri';
import type { NodeChange, EdgeChange, Connection } from '@xyflow/react';

export function useWorkflowExecution() {
  const {
    isExecuting,
    executionId,
    error,
    executionProgress,
    completedNodes,
    totalNodes,
    updateNodeExecutionStatus,
    setExecutionProgress,
    setExecutionComplete,
    updateDynamicGraph,
  } = useWorkflowStore();

  const unlistenRef = useRef<UnlistenFn | null>(null);
  const unlistenEventRef = useRef<UnlistenFn | null>(null);
  const unlistenGraphRef = useRef<UnlistenFn | null>(null);

  useEffect(() => {
    const setupListeners = async () => {
      // Legacy listener for backward compatibility
      unlistenRef.current = await tauri.onWorkflowExecutionStarted((data) => {
        console.log('Workflow execution started (legacy):', data);
      });

      // Dynamic graph update listener (for orchestrated workflows)
      unlistenGraphRef.current = await tauri.onWorkflowGraphUpdated((event) => {
        console.log('Dynamic graph update:', event);
        updateDynamicGraph(event.nodes, event.edges);
      });

      // New workflow event listener
      unlistenEventRef.current = await tauri.onWorkflowEvent((event: WorkflowEvent) => {
        console.log('Workflow event:', event);

        switch (event.type) {
          case 'execution_started':
            setExecutionProgress(0, event.total_nodes, 0);
            break;

          case 'node_status_changed':
            updateNodeExecutionStatus(
              event.node_id,
              event.status,
              event.progress,
              event.agent_id,
              event.error
            );
            break;

          case 'node_started':
            updateNodeExecutionStatus(event.node_id, 'running', 0, event.agent_id);
            break;

          case 'node_completed':
            updateNodeExecutionStatus(event.node_id, 'completed', 100);
            break;

          case 'node_failed':
            updateNodeExecutionStatus(event.node_id, 'failed', 0, undefined, event.error);
            break;

          case 'node_skipped':
            updateNodeExecutionStatus(event.node_id, 'skipped', 0, undefined, event.reason);
            break;

          case 'progress_update':
            setExecutionProgress(
              event.completed_nodes,
              event.total_nodes,
              event.progress_percent
            );
            break;

          case 'execution_completed':
            setExecutionComplete(true);
            console.log(`Workflow completed in ${event.duration_ms}ms`);
            break;

          case 'execution_failed':
            setExecutionComplete(false, event.error);
            console.error('Workflow failed:', event.error, 'Failed nodes:', event.failed_nodes);
            break;

          case 'execution_cancelled':
            setExecutionComplete(false, 'Execution cancelled');
            console.log('Workflow execution cancelled');
            break;

          case 'level_started':
            console.log(`Starting level ${event.level} with nodes:`, event.node_ids);
            break;

          case 'level_completed':
            console.log(`Level ${event.level} completed`);
            break;
        }
      });
    };

    setupListeners();

    return () => {
      unlistenRef.current?.();
      unlistenEventRef.current?.();
      unlistenGraphRef.current?.();
    };
  }, [updateNodeExecutionStatus, setExecutionProgress, setExecutionComplete, updateDynamicGraph]);

  return {
    isExecuting,
    executionId,
    error,
    executionProgress,
    completedNodes,
    totalNodes,
  };
}

export function useWorkflowCanvas() {
  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    addNode,
    removeNode,
    addEdge,
    clearCanvas,
  } = useWorkflowStore();

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Handle node changes from React Flow
      const updatedNodes = nodes.map((node) => {
        const change = changes.find((c) => 'id' in c && c.id === node.id);
        if (change) {
          if (change.type === 'position' && 'position' in change && change.position) {
            return { ...node, position: change.position };
          }
          if (change.type === 'select' && 'selected' in change) {
            return { ...node, selected: change.selected };
          }
        }
        return node;
      });
      setNodes(updatedNodes);
    },
    [nodes, setNodes]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      // Handle edge changes from React Flow
      const removeIds = changes
        .filter((c): c is EdgeChange & { type: 'remove'; id: string } => c.type === 'remove')
        .map((c) => c.id);

      if (removeIds.length > 0) {
        setEdges(edges.filter((e) => !removeIds.includes(e.id)));
      }
    },
    [edges, setEdges]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const newEdge = {
        id: `edge-${connection.source}-${connection.target}`,
        source: connection.source,
        target: connection.target,
        animated: true,
      };
      addEdge(newEdge);
    },
    [addEdge]
  );

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    removeNode,
    clearCanvas,
  };
}

export function useWorkflowControl() {
  const { executeWorkflow, cancelExecution, resetExecutionState, isExecuting } =
    useWorkflowStore();

  const startExecution = useCallback(
    async (workflowId: string, projectId: string, prompt: string) => {
      return executeWorkflow(workflowId, projectId, prompt);
    },
    [executeWorkflow]
  );

  const stopExecution = useCallback(async () => {
    await cancelExecution();
  }, [cancelExecution]);

  const reset = useCallback(() => {
    resetExecutionState();
  }, [resetExecutionState]);

  return {
    isExecuting,
    startExecution,
    stopExecution,
    reset,
  };
}
