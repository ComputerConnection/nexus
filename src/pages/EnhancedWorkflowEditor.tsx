import { useCallback, useState, useMemo, useEffect, useRef } from 'react';
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
  X,
  FileText,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  EnhancedAgentNode,
  DataFlowEdge,
  ExecutionTimeline,
  MessagePanel,
  WorkflowToolbar,
} from '../components/Workflow';
import { Button } from '../components/ui';
import { useWorkflowStore } from '../stores/workflowStore';
import { useProjectStore } from '../stores/projectStore';
import type { Workflow } from '../types';
import { useWorkflowCanvas, useWorkflowExecution } from '../hooks';
import type { AgentRole, WorkflowNode } from '../types';
import type { EnhancedAgentNodeData } from '../components/Workflow/EnhancedAgentNode';
import type { AgentMessage } from '../components/Workflow/MessagePanel';
import { applyLayout, type LayoutPreset } from '../utils/layoutWorkflow';

// Node and edge types for React Flow
const nodeTypes: NodeTypes = {
  agent: EnhancedAgentNode,
};

const edgeTypes: EdgeTypes = {
  dataFlow: DataFlowEdge,
};

// Layout presets imported from utils/layoutWorkflow

// View modes
type ViewMode = 'canvas' | 'timeline' | 'split';

export function EnhancedWorkflowEditor() {
  const {
    nodes,
    edges,
    addNode,
    setNodes,
    clearCanvas,
    workflows,
    currentWorkflow,
    fetchWorkflows,
    saveCurrentWorkflow,
    loadWorkflow,
    deleteWorkflow,
    isLoading,
    nodeStatuses,
    executionStartTime,
    messages: workflowMessages,
    executeWorkflow,
    cancelExecution,
    resetExecutionState,
  } = useWorkflowStore();
  const { projects, selectedProjectId, fetchProjects } = useProjectStore();
  const { onNodesChange, onEdgesChange, onConnect } = useWorkflowCanvas();
  const { isExecuting } = useWorkflowExecution();

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>('canvas');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<'messages' | 'agents'>('messages');
  const [layoutPreset, setLayoutPreset] = useState<LayoutPreset>('manual');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);

  // Save/Load dialog state
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');

  // Execution dialog state
  const [showExecuteDialog, setShowExecuteDialog] = useState(false);
  const [executeProjectId, setExecuteProjectId] = useState<string>('');
  const [executePrompt, setExecutePrompt] = useState('');

  // Timeline state
  const [currentTime, setCurrentTime] = useState(0);

  // Stable time reference for timeline calculations
  // eslint-disable-next-line react-hooks/purity
  const initialTimeRef = useRef(Date.now());

  // Fetch workflows and projects on mount
  useEffect(() => {
    fetchWorkflows();
    fetchProjects();
  }, [fetchWorkflows, fetchProjects]);

  // Convert projects Map to array for display
  const projectList = useMemo(() => Array.from(projects.values()), [projects]);

  // Convert workflows Map to array for display
  const workflowList = useMemo(() => Array.from(workflows.values()), [workflows]);

  // Timeline data from actual execution state
  const timelineAgents = useMemo(() => {
    const startTime = executionStartTime || initialTimeRef.current;
    const now = initialTimeRef.current;
    return Array.from(nodes).map((node) => {
      const nodeStatus = nodeStatuses.get(node.id);
      const data = node.data as EnhancedAgentNodeData;
      const events: { type: 'start' | 'running' | 'pause' | 'resume' | 'complete' | 'fail' | 'blocked'; timestamp: number; duration?: number }[] = [];

      if (nodeStatus) {
        const relativeStart = (nodeStatus.startedAt || startTime) - startTime;
        const duration = nodeStatus.completedAt
          ? nodeStatus.completedAt - (nodeStatus.startedAt || startTime)
          : nodeStatus.status === 'running'
          ? now - (nodeStatus.startedAt || startTime)
          : 0;

        // Map status to timeline event types
        const statusToEventType = {
          pending: 'blocked' as const,
          running: 'running' as const,
          completed: 'complete' as const,
          failed: 'fail' as const,
          skipped: 'blocked' as const,
        };

        const eventType = statusToEventType[nodeStatus.status as keyof typeof statusToEventType] || 'blocked';

        events.push({
          type: eventType,
          timestamp: relativeStart,
          duration: duration > 0 ? duration : undefined,
        });
      } else {
        events.push({ type: 'blocked', timestamp: 0 });
      }

      return {
        id: node.id,
        name: data.label,
        role: data.agentRole,
        events,
      };
    });
  }, [nodes, nodeStatuses, executionStartTime]);

  // Convert workflow messages to AgentMessage format for MessagePanel
  const messages = useMemo<AgentMessage[]>(() => {
    return workflowMessages.map((msg) => ({
      id: msg.id,
      timestamp: msg.timestamp,
      from: {
        id: msg.fromNodeId,
        name: msg.fromNodeName,
        role: msg.fromNodeRole as AgentRole,
      },
      to: msg.toNodeId === 'broadcast'
        ? 'broadcast'
        : { id: msg.toNodeId, name: msg.toNodeName || msg.toNodeId, role: 'agent' as AgentRole },
      type: msg.type,
      content: { message: msg.content },
      preview: msg.content,
    }));
  }, [workflowMessages]);

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
    if (!currentWorkflow) {
      toast.error('Save workflow first before executing');
      return;
    }
    if (nodes.length === 0) {
      toast.error('Add agents to the workflow before executing');
      return;
    }
    // Pre-select project if one is selected
    setExecuteProjectId(selectedProjectId || '');
    setExecutePrompt('');
    setShowExecuteDialog(true);
  }, [currentWorkflow, nodes.length, selectedProjectId]);

  const handleExecuteConfirm = useCallback(async () => {
    if (!executeProjectId) {
      toast.error('Please select a project');
      return;
    }
    if (!executePrompt.trim()) {
      toast.error('Please enter a task prompt');
      return;
    }
    if (!currentWorkflow) {
      toast.error('No workflow to execute');
      return;
    }

    try {
      setShowExecuteDialog(false);
      await executeWorkflow(currentWorkflow.id, executeProjectId, executePrompt.trim());
      toast.success('Workflow execution started');
    } catch (error) {
      toast.error(`Failed to start execution: ${error}`);
    }
  }, [executeProjectId, executePrompt, currentWorkflow, executeWorkflow]);

  const handlePause = useCallback(() => {
    toast.info('Workflow pause not supported - use Stop to cancel');
  }, []);

  const handleStop = useCallback(async () => {
    if (isExecuting) {
      try {
        await cancelExecution();
        toast.success('Workflow execution cancelled');
      } catch (error) {
        toast.error(`Failed to cancel: ${error}`);
      }
    }
    resetExecutionState();
    setCurrentTime(0);
  }, [isExecuting, cancelExecution, resetExecutionState]);

  const handleSave = useCallback(() => {
    if (nodes.length === 0) {
      toast.error('Cannot save empty workflow');
      return;
    }
    // Pre-fill with current workflow name if editing
    if (currentWorkflow) {
      setWorkflowName(currentWorkflow.name);
      setWorkflowDescription(currentWorkflow.description || '');
    } else {
      setWorkflowName('');
      setWorkflowDescription('');
    }
    setShowSaveDialog(true);
  }, [nodes.length, currentWorkflow]);

  const handleSaveConfirm = useCallback(async () => {
    if (!workflowName.trim()) {
      toast.error('Please enter a workflow name');
      return;
    }

    try {
      await saveCurrentWorkflow(workflowName.trim(), workflowDescription.trim() || undefined);
      toast.success(`Workflow "${workflowName}" saved`);
      setShowSaveDialog(false);
      setWorkflowName('');
      setWorkflowDescription('');
    } catch (error) {
      toast.error(`Failed to save: ${error}`);
    }
  }, [workflowName, workflowDescription, saveCurrentWorkflow]);

  const handleLoad = useCallback(() => {
    fetchWorkflows();
    setShowLoadDialog(true);
  }, [fetchWorkflows]);

  const handleLoadWorkflow = useCallback(async (workflow: Workflow) => {
    try {
      await loadWorkflow(workflow.id);
      toast.success(`Loaded "${workflow.name}"`);
      setShowLoadDialog(false);
    } catch (error) {
      toast.error(`Failed to load: ${error}`);
    }
  }, [loadWorkflow]);

  const handleDeleteWorkflow = useCallback(async (workflowId: string, name: string) => {
    try {
      await deleteWorkflow(workflowId);
      toast.success(`Deleted "${name}"`);
    } catch (error) {
      toast.error(`Failed to delete: ${error}`);
    }
  }, [deleteWorkflow]);

  const handleLayoutChange = useCallback(
    (newLayout: LayoutPreset) => {
      setLayoutPreset(newLayout);
      if (newLayout === 'manual' || nodes.length === 0) {
        return;
      }
      const layoutedNodes = applyLayout(newLayout, nodes, edges);
      setNodes(layoutedNodes);
      toast.success(`Applied ${newLayout} layout`);
    },
    [nodes, edges, setNodes]
  );

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
        if (isExecuting) {
          handleStop();
        } else {
          handlePlay();
        }
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
    [isExecuting, handlePlay, handleStop]
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
              onSave={handleSave}
              onLoad={handleLoad}
              onClear={clearCanvas}
              isExecuting={isExecuting}
            />
          </div>

          {/* Right: Layout controls */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-tertiary)]">Layout:</span>
            <select
              value={layoutPreset}
              onChange={(e) => handleLayoutChange(e.target.value as LayoutPreset)}
              className="text-xs bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--glass-border)] rounded-md px-2 py-1"
            >
              <option value="manual">Manual</option>
              <option value="dagre">Dagre (Hierarchical)</option>
              <option value="force">Force-Directed</option>
              <option value="timeline">Timeline</option>
            </select>
            {layoutPreset !== 'manual' && (
              <button
                onClick={() => handleLayoutChange(layoutPreset)}
                className="text-xs px-2 py-1 rounded-md bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--glass-border)] hover:border-[var(--neon-cyan)]/50 transition-colors"
                title="Re-apply current layout"
              >
                Apply
              </button>
            )}
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
                isPlaying={isExecuting}
                onSeek={setCurrentTime}
                onPlayPause={() => (isExecuting ? handleStop() : handlePlay())}
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
                  isPlaying={isExecuting}
                  onSeek={setCurrentTime}
                  onPlayPause={() => (isExecuting ? handleStop() : handlePlay())}
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

      {/* Save Workflow Dialog */}
      <AnimatePresence>
        {showSaveDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowSaveDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--glass-border)] p-6 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  Save Workflow
                </h2>
                <button
                  onClick={() => setShowSaveDialog(false)}
                  className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">
                    Workflow Name *
                  </label>
                  <input
                    type="text"
                    value={workflowName}
                    onChange={(e) => setWorkflowName(e.target.value)}
                    placeholder="My Workflow"
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--glass-border)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--neon-cyan)]"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">
                    Description (optional)
                  </label>
                  <textarea
                    value={workflowDescription}
                    onChange={(e) => setWorkflowDescription(e.target.value)}
                    placeholder="Describe what this workflow does..."
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--glass-border)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--neon-cyan)] resize-none"
                  />
                </div>

                <div className="text-xs text-[var(--text-tertiary)]">
                  {nodes.length} agent{nodes.length !== 1 ? 's' : ''}, {edges.length} connection{edges.length !== 1 ? 's' : ''}
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setShowSaveDialog(false)}
                  className="flex-1 py-2 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveConfirm}
                  disabled={!workflowName.trim() || isLoading}
                  className="flex-1 py-2 rounded-lg bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)]/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Load Workflow Dialog */}
      <AnimatePresence>
        {showLoadDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowLoadDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--glass-border)] p-6 max-w-lg w-full mx-4 max-h-[80vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  Load Workflow
                </h2>
                <button
                  onClick={() => setShowLoadDialog(false)}
                  className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 min-h-[200px]">
                {workflowList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-[var(--text-tertiary)]">
                    <FileText size={48} className="mb-3 opacity-50" />
                    <p className="text-sm">No saved workflows</p>
                    <p className="text-xs mt-1">Create and save a workflow to see it here</p>
                  </div>
                ) : (
                  workflowList.map((workflow) => (
                    <div
                      key={workflow.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--glass-border)] hover:border-[var(--neon-cyan)]/50 transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => handleLoadWorkflow(workflow)}
                          className="w-full text-left"
                        >
                          <div className="font-medium text-[var(--text-primary)] truncate">
                            {workflow.name}
                          </div>
                          {workflow.description && (
                            <div className="text-xs text-[var(--text-tertiary)] truncate mt-0.5">
                              {workflow.description}
                            </div>
                          )}
                          <div className="text-xs text-[var(--text-tertiary)] mt-1">
                            {workflow.graph?.nodes?.length || 0} agents &bull; Created {new Date(workflow.createdAt).toLocaleDateString()}
                          </div>
                        </button>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteWorkflow(workflow.id, workflow.name);
                        }}
                        className="p-2 rounded hover:bg-red-500/20 text-[var(--text-tertiary)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        title="Delete workflow"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <button
                onClick={() => setShowLoadDialog(false)}
                className="mt-4 w-full py-2 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Execute Workflow Dialog */}
      <AnimatePresence>
        {showExecuteDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowExecuteDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--glass-border)] p-6 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  Execute Workflow
                </h2>
                <button
                  onClick={() => setShowExecuteDialog(false)}
                  className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">
                    Project *
                  </label>
                  <select
                    value={executeProjectId}
                    onChange={(e) => setExecuteProjectId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--glass-border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--neon-cyan)]"
                  >
                    <option value="">Select a project...</option>
                    {projectList.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                  {projectList.length === 0 && (
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">
                      No projects available. Create a project first.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">
                    Task Prompt *
                  </label>
                  <textarea
                    value={executePrompt}
                    onChange={(e) => setExecutePrompt(e.target.value)}
                    placeholder="Describe what you want the agents to do..."
                    rows={4}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--glass-border)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--neon-cyan)] resize-none"
                    autoFocus
                  />
                </div>

                <div className="text-xs text-[var(--text-tertiary)]">
                  Workflow: <span className="text-[var(--text-secondary)]">{currentWorkflow?.name}</span>
                  {' • '}
                  {nodes.length} agent{nodes.length !== 1 ? 's' : ''}
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setShowExecuteDialog(false)}
                  className="flex-1 py-2 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteConfirm}
                  disabled={!executeProjectId || !executePrompt.trim() || isLoading}
                  className="flex-1 py-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Starting...' : 'Run Workflow'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
