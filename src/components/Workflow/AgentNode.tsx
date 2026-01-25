import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { clsx } from 'clsx';
import {
  Brain,
  Building2,
  Code,
  FlaskConical,
  FileText,
  Shield,
  Container,
} from 'lucide-react';
import { StatusIndicator, ProgressBar } from '../common';
import type { AgentRole } from '../../types';

interface AgentNodeData {
  label: string;
  agentRole: AgentRole;
  agentId?: string;
  status?: 'pending' | 'running' | 'completed' | 'failed';
  progress?: number;
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

const roleColors: Record<AgentRole, string> = {
  orchestrator: '#00fff9',
  architect: '#00fff9',
  implementer: '#39ff14',
  tester: '#ff6600',
  documenter: '#ff00ff',
  security: '#ff0040',
  devops: '#808080',
};

function AgentNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as AgentNodeData;
  const Icon = roleIcons[nodeData.agentRole] || Brain;
  const color = roleColors[nodeData.agentRole] || '#00fff9';
  const status = nodeData.status || 'pending';

  const statusToIndicator = {
    pending: 'idle',
    running: 'running',
    completed: 'completed',
    failed: 'failed',
  } as const;

  return (
    <div
      className={clsx(
        'px-4 py-3 rounded-lg border-2 min-w-[150px]',
        'bg-bg-secondary transition-all duration-200',
        selected && 'shadow-lg',
        status === 'running' && 'animate-pulse'
      )}
      style={{
        borderColor: selected ? color : `${color}40`,
        boxShadow: selected ? `0 0 20px ${color}40` : 'none',
      }}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !border-2"
        style={{ background: color, borderColor: '#0a0a0f' }}
      />

      {/* Content */}
      <div className="flex items-center gap-3">
        <div
          className="p-2 rounded-lg"
          style={{ backgroundColor: `${color}20` }}
        >
          <Icon size={20} style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-text-primary truncate">
              {nodeData.label}
            </span>
            <StatusIndicator status={statusToIndicator[status]} size="sm" />
          </div>
          <span className="text-xs text-text-secondary capitalize">
            {nodeData.agentRole}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      {status === 'running' && nodeData.progress !== undefined && (
        <div className="mt-2">
          <ProgressBar
            progress={nodeData.progress}
            variant={
              nodeData.agentRole === 'implementer'
                ? 'green'
                : nodeData.agentRole === 'tester'
                ? 'orange'
                : 'cyan'
            }
            size="sm"
          />
        </div>
      )}

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !border-2"
        style={{ background: color, borderColor: '#0a0a0f' }}
      />
    </div>
  );
}

export const AgentNode = memo(AgentNodeComponent);
