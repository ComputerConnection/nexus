import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import {
  Grid2X2,
  Grid3X3,
  Rows,
  Columns,
  Plus,
  Bot,
  MoreVertical,
  Play,
  Pause,
  Trash2,
  Maximize2,
  Terminal,
} from 'lucide-react';
import {
  Card,
  Button,
  StatusBadge,
  ProgressBar,
  Dropdown,
  DropdownItem,
  DropdownSeparator,
  SkeletonAgentCard,
  Tooltip,
} from '../components/ui';
import { toast } from '../components/ui/Toast';
import { useAgentStore } from '../stores/agentStore';
import { useAgentStream, useAgentOutput } from '../hooks';

type Layout = '1x1' | '2x2' | '3x3' | '2x1';

export function AgentGrid() {
  const [layout, setLayout] = useState<Layout>('2x2');
  const [showSidebar] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const { agents, fetchAgents, spawnAgent, killAgent } = useAgentStore();

  useAgentStream();

  useEffect(() => {
    const loadAgents = async () => {
      await fetchAgents();
      setIsLoading(false);
    };
    loadAgents();
  }, [fetchAgents]);

  const handleSpawnAgent = async () => {
    try {
      await spawnAgent({
        name: `Agent-${Date.now().toString(36)}`,
        role: 'implementer',
        workingDirectory: '/tmp',
        assignedTask: 'Awaiting task assignment',
      });
      toast.agentSpawned(`Agent-${Date.now().toString(36)}`);
    } catch (error) {
      toast.error('Failed to spawn agent');
    }
  };

  const handleKillAgent = async (agentId: string, agentName: string) => {
    try {
      await killAgent(agentId);
      toast.agentKilled(agentName);
    } catch (error) {
      toast.error('Failed to kill agent');
    }
  };

  const agentList = Array.from(agents.values());

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between p-4 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl"
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
              <Bot size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[var(--text-primary)]">
                Agent Grid
              </h1>
              <p className="text-sm text-[var(--text-secondary)]">
                {agents.size} active {agents.size === 1 ? 'agent' : 'agents'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Layout selector */}
          <div className="flex items-center gap-1 p-1 rounded-[var(--radius-lg)] bg-[var(--bg-tertiary)] border border-[var(--glass-border)]">
            {[
              { id: '1x1', icon: Rows, label: 'Single' },
              { id: '2x1', icon: Columns, label: 'Split' },
              { id: '2x2', icon: Grid2X2, label: '2x2' },
              { id: '3x3', icon: Grid3X3, label: '3x3' },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = layout === item.id;
              return (
                <Tooltip key={item.id} content={item.label}>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setLayout(item.id as Layout)}
                    className={clsx(
                      'p-2 rounded-[var(--radius-md)] transition-all',
                      isActive
                        ? 'bg-[var(--bg-elevated)] text-[var(--neon-cyan)] shadow-sm'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    )}
                  >
                    <Icon size={18} />
                  </motion.button>
                </Tooltip>
              );
            })}
          </div>

          <Button
            variant="primary"
            size="md"
            icon={<Plus size={16} />}
            onClick={handleSpawnAgent}
          >
            Spawn Agent
          </Button>
        </div>
      </motion.div>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Terminal Grid */}
        <div className={clsx('flex-1 p-4 overflow-auto', showSidebar && 'pr-0')}>
          {isLoading ? (
            <div className={clsx(
              'grid gap-4',
              layout === '1x1' && 'grid-cols-1',
              layout === '2x1' && 'grid-cols-2',
              layout === '2x2' && 'grid-cols-2',
              layout === '3x3' && 'grid-cols-3'
            )}>
              {Array.from({ length: layout === '3x3' ? 9 : layout === '2x2' ? 4 : layout === '2x1' ? 2 : 1 }).map((_, i) => (
                <SkeletonAgentCard key={i} />
              ))}
            </div>
          ) : agentList.length === 0 ? (
            <EmptyState onSpawn={handleSpawnAgent} />
          ) : (
            <div
              className={clsx(
                'grid gap-4 h-full',
                layout === '1x1' && 'grid-cols-1',
                layout === '2x1' && 'grid-cols-2',
                layout === '2x2' && 'grid-cols-2 grid-rows-2',
                layout === '3x3' && 'grid-cols-3 grid-rows-3'
              )}
            >
              {agentList.slice(0, getMaxAgents(layout)).map((agent, index) => (
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <AgentTerminalCard
                    agent={agent}
                    onKill={() => handleKillAgent(agent.id, agent.name)}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        {showSidebar && (
          <div className="w-80 border-l border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl overflow-y-auto">
            <div className="p-4">
              <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">
                Agent Overview
              </h3>
              <div className="space-y-3">
                {agentList.map((agent, index) => (
                  <motion.div
                    key={agent.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <AgentSidebarCard
                      agent={agent}
                      onKill={() => handleKillAgent(agent.id, agent.name)}
                    />
                  </motion.div>
                ))}
                {agentList.length === 0 && (
                  <p className="text-sm text-[var(--text-tertiary)] text-center py-8">
                    No agents running
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getMaxAgents(layout: Layout): number {
  switch (layout) {
    case '1x1': return 1;
    case '2x1': return 2;
    case '2x2': return 4;
    case '3x3': return 9;
    default: return 4;
  }
}

interface AgentTerminalCardProps {
  agent: any;
  onKill: () => void;
}

function AgentTerminalCard({ agent, onKill }: AgentTerminalCardProps) {
  const outputs = useAgentOutput(agent.id);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new output arrives
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [outputs]);

  const isRunning = agent.status.toLowerCase() === 'running' || agent.status.toLowerCase() === 'starting';

  return (
    <Card padding="none" className="h-full flex flex-col overflow-hidden">
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className={clsx(
              'w-3 h-3 rounded-full',
              isRunning ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            )} />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {agent.name}
          </span>
          <StatusBadge status={agent.status.toLowerCase()} size="sm" />
        </div>

        <div className="flex items-center gap-1">
          <Tooltip content="Maximize">
            <Button variant="ghost" size="sm" className="p-1.5">
              <Maximize2 size={14} />
            </Button>
          </Tooltip>
          <Dropdown
            trigger={
              <Button variant="ghost" size="sm" className="p-1.5">
                <MoreVertical size={14} />
              </Button>
            }
          >
            <DropdownItem icon={<Pause size={14} />}>Pause</DropdownItem>
            <DropdownItem icon={<Play size={14} />}>Resume</DropdownItem>
            <DropdownSeparator />
            <DropdownItem icon={<Trash2 size={14} />} danger onSelect={onKill}>
              Kill Agent
            </DropdownItem>
          </Dropdown>
        </div>
      </div>

      {/* Terminal Body */}
      <div
        ref={terminalRef}
        className="flex-1 bg-[var(--bg-primary)] p-4 font-mono text-sm overflow-auto"
      >
        {/* Task header */}
        <div className="text-[var(--text-tertiary)] mb-2">
          <span className="text-[var(--neon-green)]">$</span> {agent.assignedTask || 'Awaiting task...'}
        </div>
        <div className="text-[var(--text-secondary)] mb-3 pb-3 border-b border-[var(--glass-border)]">
          <span className="text-[var(--neon-cyan)]">[{agent.role}]</span> Agent started
        </div>

        {/* Output lines */}
        {outputs.length > 0 ? (
          <div className="space-y-0.5">
            {outputs.map((line, idx) => (
              <div
                key={idx}
                className="text-[var(--text-secondary)] whitespace-pre-wrap break-all leading-relaxed"
              >
                {line}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[var(--text-tertiary)] italic">
            Waiting for output...
          </div>
        )}

        {/* Cursor */}
        {isRunning && (
          <div className="mt-2 flex items-center gap-2">
            <div className="w-2 h-4 bg-[var(--neon-cyan)] animate-pulse" />
          </div>
        )}
      </div>

      {/* Terminal Footer */}
      <div className="px-4 py-2 border-t border-[var(--glass-border)] bg-[var(--bg-secondary)]">
        <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)]">
          <span>Progress: {agent.progress}%</span>
          <div className="flex items-center gap-3">
            <span>{outputs.length} lines</span>
            <span>PID: {agent.pid || 'N/A'}</span>
          </div>
        </div>
        <ProgressBar value={agent.progress} size="sm" className="mt-2" />
      </div>
    </Card>
  );
}

interface AgentSidebarCardProps {
  agent: any;
  onKill?: () => void;
}

function AgentSidebarCard({ agent }: AgentSidebarCardProps) {
  return (
    <Card padding="sm" interactive className="group">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
          <Terminal size={18} className="text-[var(--neon-cyan)]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-[var(--text-primary)] truncate">
              {agent.name}
            </h4>
            <StatusBadge status={agent.status.toLowerCase()} size="sm" />
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">
            {agent.role}
          </p>
          <ProgressBar value={agent.progress} size="sm" className="mt-2" />
        </div>
      </div>
    </Card>
  );
}

function EmptyState({ onSpawn }: { onSpawn: () => void }) {
  return (
    <div className="h-full flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-md"
      >
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-[var(--glass-border)] flex items-center justify-center mx-auto mb-6">
          <Bot size={40} className="text-[var(--text-tertiary)]" />
        </div>
        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
          No Active Agents
        </h2>
        <p className="text-[var(--text-secondary)] mb-6">
          Spawn your first agent to start executing tasks. Agents run Claude Code instances
          that work autonomously on your behalf.
        </p>
        <Button
          variant="primary"
          size="lg"
          icon={<Plus size={18} />}
          onClick={onSpawn}
          glow
        >
          Spawn Your First Agent
        </Button>
      </motion.div>
    </div>
  );
}
