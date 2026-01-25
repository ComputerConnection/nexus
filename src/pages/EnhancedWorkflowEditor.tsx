import { useCallback, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import {
  Layout,
  Clock,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Settings,
  Keyboard,
} from 'lucide-react';

import {
  EnhancedAgentNode,
  DataFlowEdge,
  ExecutionTimeline,
  MessagePanel,
  WorkflowToolbar,
} from '../components/Workflow';
import { Button } from '../components/ui';
import { useWorkflowStore } from '../stores/workflowStore';
import { useWorkflowCanvas, useWorkflowExecution } from '../hooks';
import type { AgentRole, WorkflowNode } from '../types';
import type { EnhancedAgentNodeData } from '../components/Workflow/EnhancedAgentNode';
import type { AgentMessage } from '../components/Workflow/MessagePanel';

// Node and edge types for React Flow
const nodeTypes: NodeTypes = {
  agent: EnhancedAgentNode,
};

const edgeTypes: EdgeTypes = {
  dataFlow: DataFlowEdge,
};

// Layout presets
type LayoutPreset = 'dagre' | 'force' | 'timeline' | 'manual';

// View modes
type ViewMode = 'canvas' | 'timeline' | 'split';

export function EnhancedWorkflowEditor() {
  const { nodes, edges, addNode, clearCanvas } = useWorkflowStore();
  const { onNodesChange, onEdgesChange, onConnect } = useWorkflowCanvas();
  const { isExecuting } = useWorkflowExecution();

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>('canvas');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<'messages' | 'agents'>('messages');
  const [layoutPreset, setLayoutPreset] = useState<LayoutPreset>('manual');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);

  // Mock data for demo
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Mock timeline data
  const timelineAgents = useMemo(
    () =>
      Array.from(nodes).map((node) => ({
        id: node.id,
        name: (node.data as EnhancedAgentNodeData).label,
        role: (node.data as EnhancedAgentNodeData).agentRole,
        events: [
          { type: 'running' as const, timestamp: Math.random() * 10000, duration: 5000 + Math.random() * 10000 },
        ],
      })),
    [nodes]
  );

  // Mock messages
  const [messages] = useState<AgentMessage[]>([
    {
      id: '1',
      timestamp: Date.now() - 60000,
      from: { id: 'orchestrator', name: 'Orchestrator', role: 'orchestrator' },
      to: 'broadcast',
      type: 'command',
      content: { action: 'start', task: 'Build REST API' },
      preview: 'Starting task: Build REST API',
    },
    {
      id: '2',
      timestamp: Date.now() - 50000,
      from: { id: 'architect', name: 'Architect', role: 'architect' },
      to: { id: 'implementer', name: 'Implementer', role: 'implementer' },
      type: 'data',
      content: { schema: { users: {}, posts: {} }, files: ['user.ts', 'post.ts'] },
      preview: 'Schema definition with 2 models',
    },
    {
      id: '3',
      timestamp: Date.now() - 30000,
      from: { id: 'implementer', name: 'Implementer', role: 'implementer' },
      to: { id: 'tester', name: 'Tester', role: 'tester' },
      type: 'result',
      content: { filesCreated: 3, linesOfCode: 250 },
      preview: 'Implementation complete: 3 files, 250 LOC',
    },
  ]);

  const handleAddNode = useCallback(
    (role: AgentRole) => {
      const newNode: WorkflowNode = {
        id: `node-${Date.now()}`,
        type: 'agent',
        position: {
          x: 200 + Math.random() * 300,
          y: 150 + Math.random() * 200,
        },
        data: {
          label: `${role.charAt(0).toUpperCase() + role.slice(1)}`,
          agentRole: role,
          status: 'pending',
          progress: 0,
        },
      };
      addNode(newNode);
    },
    [addNode]
  );

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    // Simulate execution
  }, []);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const handleStop = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  const defaultEdgeOptions = useMemo(
    () => ({
      type: 'dataFlow',
      animated: true,
    }),
    []
  );

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === ' ' && e.target === document.body) {
        e.preventDefault();
        isPlaying ? handlePause() : handlePlay();
      }
      if (e.key === 'r' && !e.metaKey && !e.ctrlKey) {
        handlePlay();
      }
      if (e.key === 's' && !e.metaKey && !e.ctrlKey) {
        handleStop();
      }
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        setShowKeyboardShortcuts((prev) => !prev);
      }
    },
    [isPlaying, handlePlay, handlePause, handleStop]
  );

  return (
    <div
      className="h-full flex flex-col bg-[var(--bg-primary)]"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">
            Workflow Editor
          </h1>
          <span className="text-xs text-[var(--text-tertiary)] px-2 py-1 rounded-full bg-[var(--bg-tertiary)]">
            {nodes.length} agents
          </span>
          {isExecuting && (
            <motion.span
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="text-xs text-green-400 flex items-center gap-1"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              Executing
            </motion.span>
          )}
        </div>

        {/* View mode tabs */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--bg-tertiary)]">
            {[
              { value: 'canvas', icon: Layout, label: 'Canvas' },
              { value: 'timeline', icon: Clock, label: 'Timeline' },
              { value: 'split', icon: Maximize2, label: 'Split' },
            ].map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                onClick={() => setViewMode(value as ViewMode)}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors',
                  viewMode === value
                    ? 'bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                )}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 ml-2">
            <Button variant="ghost" size="sm" icon={<Keyboard size={14} />} onClick={() => setShowKeyboardShortcuts(true)}>
              Shortcuts
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              onClick={() => setIsFullscreen((prev) => !prev)}
            />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-4 py-2 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/50">
        <div className="flex items-center justify-between">
          {/* Left: Agent controls */}
          <div className="flex items-center gap-2">
            <WorkflowToolbar
              onAddNode={handleAddNode}
              onPlay={handlePlay}
              onPause={handlePause}
              onStop={handleStop}
              onSave={() => console.log('Save')}
              onLoad={() => console.log('Load')}
              onClear={clearCanvas}
              isExecuting={isPlaying}
            />
          </div>

          {/* Right: Layout controls */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-tertiary)]">Layout:</span>
            <select
              value={layoutPreset}
              onChange={(e) => setLayoutPreset(e.target.value as LayoutPreset)}
              className="text-xs bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--glass-border)] rounded-md px-2 py-1"
            >
              <option value="manual">Manual</option>
              <option value="dagre">Dagre (Hierarchical)</option>
              <option value="force">Force-Directed</option>
              <option value="timeline">Timeline</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Canvas / Timeline area */}
        <div className="flex-1 flex flex-col min-w-0">
          {viewMode === 'canvas' && (
            <div className="flex-1 min-h-0">
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
                <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1a1a25" />
                <Controls className="!bg-[var(--bg-secondary)] !border-[var(--glass-border)] !rounded-lg" />
                <MiniMap
                  className="!bg-[var(--bg-secondary)] !border-[var(--glass-border)] !rounded-lg"
                  nodeColor={(node) => {
                    const data = node.data as { agentRole?: AgentRole };
                    const colors: Record<AgentRole, string> = {
                      orchestrator: '#00fff9',
                      architect: '#00fff9',
                      implementer: '#39ff14',
                      tester: '#ff6600',
                      documenter: '#ff00ff',
                      security: '#ff0040',
                      devops: '#808080',
                    };
                    return colors[data.agentRole || 'orchestrator'];
                  }}
                  maskColor="rgba(10, 10, 15, 0.8)"
                />
              </ReactFlow>
            </div>
          )}

          {viewMode === 'timeline' && (
            <div className="flex-1 p-4">
              <ExecutionTimeline
                agents={timelineAgents}
                totalDuration={30000}
                currentTime={currentTime}
                isPlaying={isPlaying}
                onSeek={setCurrentTime}
                onPlayPause={() => (isPlaying ? handlePause() : handlePlay())}
                className="h-full"
              />
            </div>
          )}

          {viewMode === 'split' && (
            <div className="flex-1 flex flex-col">
              <div className="flex-1 min-h-0">
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
                  <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1a1a25" />
                  <Controls className="!bg-[var(--bg-secondary)] !border-[var(--glass-border)] !rounded-lg" />
                </ReactFlow>
              </div>
              <div className="h-[200px] border-t border-[var(--glass-border)]">
                <ExecutionTimeline
                  agents={timelineAgents}
                  totalDuration={30000}
                  currentTime={currentTime}
                  isPlaying={isPlaying}
                  onSeek={setCurrentTime}
                  onPlayPause={() => (isPlaying ? handlePause() : handlePlay())}
                  className="h-full"
                />
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-l border-[var(--glass-border)] bg-[var(--bg-secondary)] flex flex-col overflow-hidden"
            >
              {/* Sidebar tabs */}
              <div className="flex items-center border-b border-[var(--glass-border)]">
                <button
                  onClick={() => setSidebarTab('messages')}
                  className={clsx(
                    'flex-1 flex items-center justify-center gap-2 py-3 text-sm transition-colors',
                    sidebarTab === 'messages'
                      ? 'text-[var(--neon-cyan)] border-b-2 border-[var(--neon-cyan)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  )}
                >
                  <MessageSquare size={14} />
                  Messages
                </button>
                <button
                  onClick={() => setSidebarTab('agents')}
                  className={clsx(
                    'flex-1 flex items-center justify-center gap-2 py-3 text-sm transition-colors',
                    sidebarTab === 'agents'
                      ? 'text-[var(--neon-cyan)] border-b-2 border-[var(--neon-cyan)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  )}
                >
                  <Settings size={14} />
                  Agents
                </button>
              </div>

              {/* Sidebar content */}
              <div className="flex-1 overflow-hidden">
                {sidebarTab === 'messages' && (
                  <MessagePanel messages={messages} className="h-full border-0 rounded-none" />
                )}
                {sidebarTab === 'agents' && (
                  <div className="p-4 space-y-3">
                    {nodes.map((node) => {
                      const data = node.data as EnhancedAgentNodeData;
                      return (
                        <div
                          key={node.id}
                          className="p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--glass-border)]"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-[var(--text-primary)]">
                              {data.label}
                            </span>
                            <span className="text-xs text-[var(--text-tertiary)]">{data.agentRole}</span>
                          </div>
                        </div>
                      );
                    })}
                    {nodes.length === 0 && (
                      <div className="text-center py-8 text-[var(--text-tertiary)]">
                        <p className="text-sm">No agents added</p>
                        <p className="text-xs mt-1">Use the toolbar to add agents</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sidebar toggle */}
        <button
          onClick={() => setSidebarOpen((prev) => !prev)}
          className={clsx(
            'absolute right-0 top-1/2 -translate-y-1/2 z-10',
            'p-1.5 rounded-l-lg bg-[var(--bg-secondary)] border border-r-0 border-[var(--glass-border)]',
            'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
            sidebarOpen && 'right-[320px]'
          )}
        >
          {sidebarOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Keyboard shortcuts modal */}
      <AnimatePresence>
        {showKeyboardShortcuts && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowKeyboardShortcuts(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--glass-border)] p-6 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
                Keyboard Shortcuts
              </h2>
              <div className="space-y-2">
                {[
                  { key: 'Space', action: 'Play / Pause' },
                  { key: 'R', action: 'Run workflow' },
                  { key: 'S', action: 'Stop workflow' },
                  { key: 'Delete', action: 'Remove selected' },
                  { key: '⌘/Ctrl + S', action: 'Save workflow' },
                  { key: 'F', action: 'Fit view' },
                  { key: '?', action: 'Show shortcuts' },
                ].map(({ key, action }) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-sm text-[var(--text-secondary)]">{action}</span>
                    <kbd className="px-2 py-1 text-xs bg-[var(--bg-tertiary)] rounded border border-[var(--glass-border)] text-[var(--text-tertiary)]">
                      {key}
                    </kbd>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setShowKeyboardShortcuts(false)}
                className="mt-4 w-full py-2 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
