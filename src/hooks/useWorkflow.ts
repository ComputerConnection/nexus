import { useCallback, useEffect, useRef } from 'react';
import { useWorkflowStore } from '../stores/workflowStore';
import * as tauri from '../services/tauri';
import type { UnlistenFn } from '@tauri-apps/api/event';

export function useWorkflowExecution() {
  const { isExecuting, executionId, error } = useWorkflowStore();

  const unlistenRef = useRef<UnlistenFn | null>(null);

  useEffect(() => {
    const setupListener = async () => {
      unlistenRef.current = await tauri.onWorkflowExecutionStarted((data) => {
        console.log('Workflow execution started:', data);
      });
    };

    setupListener();

    return () => {
      unlistenRef.current?.();
    };
  }, []);

  return {
    isExecuting,
    executionId,
    error,
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
    (changes: any[]) => {
      // Handle node changes from React Flow
      const updatedNodes = nodes.map((node) => {
        const change = changes.find((c) => c.id === node.id);
        if (change) {
          if (change.type === 'position' && change.position) {
            return { ...node, position: change.position };
          }
          if (change.type === 'select') {
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
    (changes: any[]) => {
      // Handle edge changes from React Flow
      const removeIds = changes
        .filter((c) => c.type === 'remove')
        .map((c) => c.id);

      if (removeIds.length > 0) {
        setEdges(edges.filter((e) => !removeIds.includes(e.id)));
      }
    },
    [edges, setEdges]
  );

  const onConnect = useCallback(
    (connection: any) => {
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
