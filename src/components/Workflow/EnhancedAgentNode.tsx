import { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import {
  Brain,
  Building2,
  Code,
  FlaskConical,
  FileText,
  Shield,
  Container,
  Play,
  Pause,
  Square,
  ChevronDown,
  ChevronUp,
  Terminal,
  Clock,
  Zap,
  FileCode,
} from 'lucide-react';
import type { AgentRole } from '../../types';

export interface EnhancedAgentNodeData {
  label: string;
  agentRole: AgentRole;
  agentId?: string;
  status?: 'idle' | 'starting' | 'running' | 'paused' | 'completed' | 'failed' | 'killed';
  progress?: number;
  // Enhanced data
  currentTask?: string;
  elapsedTime?: number; // seconds
  tokenUsage?: { input: number; output: number };
  filesModified?: number;
  terminalOutput?: string[]; // last few lines
  errorMessage?: string;
}

const roleIcons: Record<AgentRole, typeof Brain> = {
  orchestrator: Brain,
  architect: Building2,
  implementer: Code,
  tester: FlaskConical,
  documenter: FileText,
  security: Shield,
  devops: Container,
};

const roleColors: Record<AgentRole, { primary: string; bg: string; glow: string }> = {
  orchestrator: { primary: '#00fff9', bg: 'rgba(0, 255, 249, 0.1)', glow: '0 0 20px rgba(0, 255, 249, 0.4)' },
  architect: { primary: '#00fff9', bg: 'rgba(0, 255, 249, 0.1)', glow: '0 0 20px rgba(0, 255, 249, 0.4)' },
  implementer: { primary: '#39ff14', bg: 'rgba(57, 255, 20, 0.1)', glow: '0 0 20px rgba(57, 255, 20, 0.4)' },
  tester: { primary: '#ff6600', bg: 'rgba(255, 102, 0, 0.1)', glow: '0 0 20px rgba(255, 102, 0, 0.4)' },
  documenter: { primary: '#ff00ff', bg: 'rgba(255, 0, 255, 0.1)', glow: '0 0 20px rgba(255, 0, 255, 0.4)' },
  security: { primary: '#ff0040', bg: 'rgba(255, 0, 64, 0.1)', glow: '0 0 20px rgba(255, 0, 64, 0.4)' },
  devops: { primary: '#808080', bg: 'rgba(128, 128, 128, 0.1)', glow: '0 0 20px rgba(128, 128, 128, 0.4)' },
};

const statusConfig = {
  idle: { label: 'Idle', color: '#808080', pulse: false },
  starting: { label: 'Starting', color: '#ff6600', pulse: true },
  running: { label: 'Running', color: '#39ff14', pulse: true },
  paused: { label: 'Paused', color: '#ff6600', pulse: false },
  completed: { label: 'Completed', color: '#00fff9', pulse: false },
  failed: { label: 'Failed', color: '#ff0040', pulse: false },
  killed: { label: 'Killed', color: '#ff0040', pulse: false },
};

function EnhancedAgentNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as EnhancedAgentNodeData;
  const [isExpanded, setIsExpanded] = useState(false);

  const Icon = roleIcons[nodeData.agentRole] || Brain;
  const colors = roleColors[nodeData.agentRole] || roleColors.orchestrator;
  const status = nodeData.status || 'idle';
  const statusInfo = statusConfig[status];

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatTokens = (count: number) => {
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return count.toString();
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={clsx(
        'relative rounded-xl overflow-hidden transition-all duration-300',
        'bg-[var(--bg-secondary)] border-2',
        selected ? 'border-white/30' : 'border-[var(--glass-border)]'
      )}
      style={{
        minWidth: isExpanded ? 280 : 200,
        borderColor: selected ? colors.primary : undefined,
        boxShadow: selected ? colors.glow : 'none',
      }}
    >
      {/* Glow effect for active states */}
      {statusInfo.pulse && (
        <motion.div
          className="absolute inset-0 rounded-xl pointer-events-none"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{ boxShadow: colors.glow }}
        />
      )}

      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-4 !h-4 !border-2 !-left-2"
        style={{
          background: colors.primary,
          borderColor: '#0a0a0f',
        }}
      />

      {/* Header */}
      <div
        className="flex items-center gap-3 px-3 py-2 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ backgroundColor: colors.bg }}
      >
        <div className="p-1.5 rounded-lg" style={{ backgroundColor: colors.bg }}>
          <Icon size={18} style={{ color: colors.primary }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium text-[var(--text-primary)] truncate">
              {nodeData.label}
            </span>
          </div>
          <span className="text-xs text-[var(--text-secondary)] capitalize">
            {nodeData.agentRole}
          </span>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            {statusInfo.pulse && (
              <motion.span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: statusInfo.color }}
                animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            )}
            {!statusInfo.pulse && (
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: statusInfo.color }}
              />
            )}
            <span className="text-[10px] font-mono" style={{ color: statusInfo.color }}>
              {statusInfo.label}
            </span>
          </div>

          {/* Expand/collapse */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </motion.button>
        </div>
      </div>

      {/* Progress bar */}
      {status === 'running' && nodeData.progress !== undefined && (
        <div className="h-1 bg-[var(--bg-tertiary)]">
          <motion.div
            className="h-full"
            style={{ backgroundColor: colors.primary }}
            initial={{ width: 0 }}
            animate={{ width: `${nodeData.progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      )}

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 py-2 space-y-2 border-t border-[var(--glass-border)]">
              {/* Current task */}
              {nodeData.currentTask && (
                <div className="text-xs">
                  <span className="text-[var(--text-tertiary)]">Task: </span>
                  <span className="text-[var(--text-secondary)]">{nodeData.currentTask}</span>
                </div>
              )}

              {/* Stats row */}
              <div className="flex items-center gap-3 text-[10px]">
                {nodeData.elapsedTime !== undefined && (
                  <div className="flex items-center gap-1 text-[var(--text-tertiary)]">
                    <Clock size={10} />
                    <span>{formatTime(nodeData.elapsedTime)}</span>
                  </div>
                )}
                {nodeData.tokenUsage && (
                  <div className="flex items-center gap-1 text-[var(--text-tertiary)]">
                    <Zap size={10} />
                    <span>
                      {formatTokens(nodeData.tokenUsage.input)}↑{' '}
                      {formatTokens(nodeData.tokenUsage.output)}↓
                    </span>
                  </div>
                )}
                {nodeData.filesModified !== undefined && nodeData.filesModified > 0 && (
                  <div className="flex items-center gap-1 text-[var(--text-tertiary)]">
                    <FileCode size={10} />
                    <span>{nodeData.filesModified} files</span>
                  </div>
                )}
              </div>

              {/* Mini terminal */}
              {nodeData.terminalOutput && nodeData.terminalOutput.length > 0 && (
                <div className="rounded-lg bg-[var(--bg-primary)] p-2 font-mono text-[10px]">
                  <div className="flex items-center gap-1 mb-1 text-[var(--text-tertiary)]">
                    <Terminal size={10} />
                    <span>Output</span>
                  </div>
                  <div className="space-y-0.5 max-h-[60px] overflow-hidden">
                    {nodeData.terminalOutput.slice(-3).map((line, i) => (
                      <div
                        key={i}
                        className="text-[var(--text-secondary)] truncate"
                        style={{ color: i === nodeData.terminalOutput!.length - 1 ? colors.primary : undefined }}
                      >
                        <span className="text-[var(--text-tertiary)]">{'>'}</span> {line}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Error message */}
              {status === 'failed' && nodeData.errorMessage && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-2">
                  <p className="text-[10px] text-red-400 truncate">{nodeData.errorMessage}</p>
                </div>
              )}

              {/* Quick actions */}
              <div className="flex items-center gap-1 pt-1">
                {(status === 'idle' || status === 'paused') && (
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="p-1.5 rounded-md bg-green-500/10 text-green-400 hover:bg-green-500/20"
                    title="Start"
                  >
                    <Play size={12} />
                  </motion.button>
                )}
                {status === 'running' && (
                  <>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="p-1.5 rounded-md bg-orange-500/10 text-orange-400 hover:bg-orange-500/20"
                      title="Pause"
                    >
                      <Pause size={12} />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="p-1.5 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20"
                      title="Stop"
                    >
                      <Square size={12} />
                    </motion.button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-4 !h-4 !border-2 !-right-2"
        style={{
          background: colors.primary,
          borderColor: '#0a0a0f',
        }}
      />
    </motion.div>
  );
}

export const EnhancedAgentNode = memo(EnhancedAgentNodeComponent);
