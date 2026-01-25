import { useCallback } from 'react';
import { WorkflowCanvas, WorkflowToolbar } from '../components/Workflow';
import { GlitchText } from '../components/common';
import { useWorkflowStore } from '../stores/workflowStore';
import { useWorkflowExecution } from '../hooks';
import type { AgentRole, WorkflowNode } from '../types';

export function WorkflowEditor() {
  const { nodes, addNode, clearCanvas } = useWorkflowStore();
  const { isExecuting } = useWorkflowExecution();

  const handleAddNode = useCallback(
    (role: AgentRole) => {
      const newNode: WorkflowNode = {
        id: `node-${Date.now()}`,
        type: 'agent',
        position: {
          x: 100 + Math.random() * 200,
          y: 100 + Math.random() * 200,
        },
        data: {
          label: `${role.charAt(0).toUpperCase() + role.slice(1)} Agent`,
          agentRole: role,
          status: 'pending',
        },
      };
      addNode(newNode);
    },
    [addNode]
  );

  const handlePlay = useCallback(() => {
    console.log('Starting workflow execution');
    // Would trigger workflow execution
  }, []);

  const handlePause = useCallback(() => {
    console.log('Pausing workflow');
  }, []);

  const handleStop = useCallback(() => {
    console.log('Stopping workflow');
  }, []);

  const handleSave = useCallback(() => {
    console.log('Saving workflow');
  }, []);

  const handleLoad = useCallback(() => {
    console.log('Loading workflow');
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-bg-tertiary">
        <div className="flex items-center gap-4">
          <GlitchText className="text-xl font-mono font-bold text-neon-magenta">
            Workflow Editor
          </GlitchText>
          <span className="text-sm text-text-secondary font-mono">
            {nodes.length} nodes
          </span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="p-4 border-b border-bg-tertiary">
        <WorkflowToolbar
          onAddNode={handleAddNode}
          onPlay={handlePlay}
          onPause={handlePause}
          onStop={handleStop}
          onSave={handleSave}
          onLoad={handleLoad}
          onClear={clearCanvas}
          isExecuting={isExecuting}
        />
      </div>

      {/* Canvas */}
      <div className="flex-1 min-h-0">
        <WorkflowCanvas />
      </div>
    </div>
  );
}
