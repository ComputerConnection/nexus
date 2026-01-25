import { useMemo } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  BackgroundVariant,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { clsx } from 'clsx';
import { AgentNode } from './AgentNode';
import { ConnectionEdge } from './ConnectionEdge';
import { useWorkflowCanvas } from '../../hooks';

interface WorkflowCanvasProps {
  className?: string;
}

const nodeTypes: NodeTypes = {
  agent: AgentNode,
};

const edgeTypes: EdgeTypes = {
  animated: ConnectionEdge,
};

export function WorkflowCanvas({ className }: WorkflowCanvasProps) {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect } = useWorkflowCanvas();

  const defaultEdgeOptions = useMemo(
    () => ({
      type: 'animated',
      animated: true,
    }),
    []
  );

  return (
    <div className={clsx('w-full h-full bg-bg-primary rounded-lg overflow-hidden', className)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        snapToGrid
        snapGrid={[15, 15]}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#1a1a25"
        />
        <Controls
          className="!bg-bg-secondary !border-neon-cyan/30 !rounded-lg"
          showZoom
          showFitView
          showInteractive
        />
        <MiniMap
          className="!bg-bg-secondary !border-neon-cyan/30 !rounded-lg"
          nodeColor={(node) => {
            const data = node.data as { agentRole?: string };
            switch (data.agentRole) {
              case 'orchestrator':
              case 'architect':
                return '#00fff9';
              case 'implementer':
                return '#39ff14';
              case 'tester':
                return '#ff6600';
              case 'documenter':
              case 'security':
                return '#ff00ff';
              default:
                return '#808080';
            }
          }}
          maskColor="rgba(10, 10, 15, 0.8)"
        />
      </ReactFlow>
    </div>
  );
}
