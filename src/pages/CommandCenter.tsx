import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Activity,
  Zap,
  Cpu,
  Clock,
  ArrowRight,
  Sparkles,
  Bot,
  GitBranch,
  FileCode,
  Shield,
  Send,
  Mic,
} from 'lucide-react';
import { Card, Button, Badge } from '../components/ui';
import { toast } from '../components/ui/Toast';
import { useAgentStore } from '../stores/agentStore';
import { useSystemStatus } from '../hooks';
import { clsx } from 'clsx';

const quickActions = [
  {
    id: 'api',
    label: 'Build REST API',
    icon: FileCode,
    prompt: 'Build a REST API with authentication and CRUD operations',
    color: 'cyan',
  },
  {
    id: 'refactor',
    label: 'Refactor Code',
    icon: GitBranch,
    prompt: 'Analyze and refactor this codebase for better maintainability',
    color: 'purple',
  },
  {
    id: 'tests',
    label: 'Write Tests',
    icon: Shield,
    prompt: 'Write comprehensive tests for the existing codebase',
    color: 'green',
  },
  {
    id: 'debug',
    label: 'Debug Issue',
    icon: Bot,
    prompt: 'Help me debug and fix issues in the code',
    color: 'orange',
  },
];

export function CommandCenter() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { agents, spawnAgent } = useAgentStore();
  const { data: systemStatus, execute: fetchSystemStatus } = useSystemStatus();

  useEffect(() => {
    fetchSystemStatus();
    const interval = setInterval(fetchSystemStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchSystemStatus]);

  const handleSubmit = useCallback(
    async (taskPrompt: string) => {
      if (!taskPrompt.trim()) return;

      setIsProcessing(true);
      try {
        await spawnAgent({
          name: 'Orchestrator',
          role: 'orchestrator',
          workingDirectory: '/tmp',
          systemPrompt: `You are the Orchestrator agent for NEXUS. Analyze the following task and coordinate its execution.`,
          assignedTask: taskPrompt,
        });

        toast.agentSpawned('Orchestrator');
        navigate('/agents');
      } catch (error) {
        toast.error('Failed to spawn agent', {
          description: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [spawnAgent, navigate]
  );

  const handleQuickAction = (action: typeof quickActions[0]) => {
    setPrompt(action.prompt);
  };

  return (
    <div className="h-full flex flex-col p-6 overflow-auto">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: 'spring' }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-6"
        >
          <Sparkles size={16} className="text-cyan-400" />
          <span className="text-sm text-cyan-400">AI-Powered Multi-Agent System</span>
        </motion.div>

        <h1 className="text-5xl font-bold mb-4">
          <span className="gradient-text-animated">NEXUS</span>
        </h1>
        <p className="text-lg text-[var(--text-secondary)] max-w-xl mx-auto">
          Transform a single prompt into coordinated multi-agent operations.
          Design, execute, and monitor complex workflows with ease.
        </p>
      </motion.div>

      {/* Command Input */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="max-w-3xl mx-auto w-full mb-8"
      >
        <Card variant="elevated" padding="none" className="overflow-hidden">
          <div className="p-1">
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your task... (e.g., 'Build a REST API with user authentication')"
                className={clsx(
                  'w-full min-h-[120px] p-4 pr-24 resize-none',
                  'bg-transparent text-[var(--text-primary)] text-base',
                  'placeholder:text-[var(--text-tertiary)]',
                  'border-0 outline-none rounded-[var(--radius-lg)]',
                  'focus:ring-0'
                )}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    handleSubmit(prompt);
                  }
                }}
              />

              {/* Actions */}
              <div className="absolute right-3 bottom-3 flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Mic size={16} />}
                  className="text-[var(--text-tertiary)]"
                />
                <Button
                  variant="primary"
                  size="md"
                  icon={<Send size={16} />}
                  loading={isProcessing}
                  onClick={() => handleSubmit(prompt)}
                  disabled={!prompt.trim()}
                >
                  Execute
                </Button>
              </div>
            </div>
          </div>

          {/* Keyboard hint */}
          <div className="px-4 py-2 border-t border-[var(--glass-border)] bg-[var(--bg-tertiary)]/50">
            <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)]">
              <span>Press ⌘+Enter to execute</span>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-[var(--bg-tertiary)] rounded border border-[var(--glass-border)]">
                    ⌘K
                  </kbd>
                  Command palette
                </span>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="max-w-3xl mx-auto w-full mb-10"
      >
        <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <motion.button
                key={action.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.05 }}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleQuickAction(action)}
                className={clsx(
                  'flex flex-col items-center gap-2 p-4 rounded-[var(--radius-lg)]',
                  'bg-[var(--glass-bg)] backdrop-blur-xl',
                  'border border-[var(--glass-border)]',
                  'hover:border-white/15 transition-all duration-200',
                  'text-left group'
                )}
              >
                <div
                  className={clsx(
                    'w-10 h-10 rounded-xl flex items-center justify-center',
                    action.color === 'cyan' && 'bg-cyan-500/10 text-cyan-400',
                    action.color === 'purple' && 'bg-purple-500/10 text-purple-400',
                    action.color === 'green' && 'bg-green-500/10 text-green-400',
                    action.color === 'orange' && 'bg-orange-500/10 text-orange-400'
                  )}
                >
                  <Icon size={20} />
                </div>
                <span className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--neon-cyan)] transition-colors">
                  {action.label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="max-w-4xl mx-auto w-full"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={Activity}
            label="Active Agents"
            value={agents.size.toString()}
            trend={agents.size > 0 ? '+' + agents.size : undefined}
            color="green"
          />
          <StatCard
            icon={Zap}
            label="Tasks Today"
            value="0"
            color="cyan"
          />
          <StatCard
            icon={Cpu}
            label="System"
            value={systemStatus?.databaseConnected ? 'Online' : 'Offline'}
            color={systemStatus?.databaseConnected ? 'green' : 'orange'}
          />
          <StatCard
            icon={Clock}
            label="Uptime"
            value={formatUptime(systemStatus?.uptimeSeconds || 0)}
            color="purple"
          />
        </div>
      </motion.div>

      {/* Recent Activity (placeholder) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="max-w-4xl mx-auto w-full mt-8"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-[var(--text-secondary)]">
            Recent Activity
          </h3>
          <Button variant="ghost" size="sm" iconRight={<ArrowRight size={14} />}>
            View all
          </Button>
        </div>
        <Card padding="lg" className="border-dashed">
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center mx-auto mb-3">
              <Activity size={24} className="text-[var(--text-tertiary)]" />
            </div>
            <p className="text-[var(--text-secondary)]">No recent activity</p>
            <p className="text-sm text-[var(--text-tertiary)] mt-1">
              Execute a command to get started
            </p>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}

interface StatCardProps {
  icon: typeof Activity;
  label: string;
  value: string;
  trend?: string;
  color: 'cyan' | 'green' | 'orange' | 'purple';
}

function StatCard({ icon: Icon, label, value, trend, color }: StatCardProps) {
  const colorClasses = {
    cyan: 'text-cyan-400 bg-cyan-500/10',
    green: 'text-green-400 bg-green-500/10',
    orange: 'text-orange-400 bg-orange-500/10',
    purple: 'text-purple-400 bg-purple-500/10',
  };

  return (
    <Card padding="md" className="group hover:border-white/15 transition-colors">
      <div className="flex items-start justify-between">
        <div
          className={clsx(
            'w-10 h-10 rounded-xl flex items-center justify-center',
            colorClasses[color]
          )}
        >
          <Icon size={20} />
        </div>
        {trend && (
          <Badge variant="green" size="sm">
            {trend}
          </Badge>
        )}
      </div>
      <div className="mt-4">
        <p className="text-2xl font-semibold text-[var(--text-primary)]">{value}</p>
        <p className="text-sm text-[var(--text-secondary)] mt-1">{label}</p>
      </div>
    </Card>
  );
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}
