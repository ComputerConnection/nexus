import { clsx } from 'clsx';
import {
  Brain,
  Building2,
  Code,
  FlaskConical,
  FileText,
  Shield,
  Container,
  X,
  Maximize2,
} from 'lucide-react';
import { NeonCard, ProgressBar, StatusIndicator } from '../common';
import type { Agent, AgentRole } from '../../types';

interface AgentCardProps {
  agent: Agent;
  onSelect?: () => void;
  onKill?: () => void;
  onExpand?: () => void;
  selected?: boolean;
  className?: string;
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

const roleColors: Record<AgentRole, 'cyan' | 'green' | 'magenta' | 'orange' | 'red'> = {
  orchestrator: 'cyan',
  architect: 'cyan',
  implementer: 'green',
  tester: 'orange',
  documenter: 'magenta',
  security: 'red',
  devops: 'cyan',
};

export function AgentCard({
  agent,
  onSelect,
  onKill,
  onExpand,
  selected,
  className,
}: AgentCardProps) {
  const Icon = roleIcons[agent.role as AgentRole] || Brain;
  const variant = roleColors[agent.role as AgentRole] || 'cyan';

  return (
    <NeonCard
      variant={variant}
      glow={selected}
      className={clsx(
        'p-4 cursor-pointer transition-all duration-200',
        selected && 'ring-1 ring-current',
        className
      )}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className={clsx(
              'p-2 rounded-lg',
              variant === 'cyan' && 'bg-neon-cyan/10',
              variant === 'green' && 'bg-neon-green/10',
              variant === 'magenta' && 'bg-neon-magenta/10',
              variant === 'orange' && 'bg-neon-orange/10',
              variant === 'red' && 'bg-neon-red/10'
            )}
          >
            <Icon
              size={24}
              className={clsx(
                variant === 'cyan' && 'text-neon-cyan',
                variant === 'green' && 'text-neon-green',
                variant === 'magenta' && 'text-neon-magenta',
                variant === 'orange' && 'text-neon-orange',
                variant === 'red' && 'text-neon-red'
              )}
            />
          </div>
          <div>
            <h3 className="font-mono text-sm font-medium text-text-primary">
              {agent.name}
            </h3>
            <p className="text-xs text-text-secondary capitalize">{agent.role}</p>
          </div>
        </div>
        <StatusIndicator status={agent.status} size="md" />
      </div>

      {/* Task */}
      {agent.assignedTask && (
        <p className="text-xs text-text-secondary mb-3 line-clamp-2">
          {agent.assignedTask}
        </p>
      )}

      {/* Progress */}
      {agent.status === 'running' && (
        <ProgressBar
          progress={agent.progress}
          variant={variant}
          size="sm"
          showLabel
          className="mb-3"
        />
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-bg-tertiary">
        {onExpand && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExpand();
            }}
            className="p-1.5 text-text-secondary hover:text-text-primary transition-colors"
            title="Expand"
          >
            <Maximize2 size={14} />
          </button>
        )}
        {onKill && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onKill();
            }}
            className="p-1.5 text-text-secondary hover:text-neon-red transition-colors"
            title="Kill Agent"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </NeonCard>
  );
}
