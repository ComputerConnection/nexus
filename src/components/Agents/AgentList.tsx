import { useMemo } from 'react';
import { clsx } from 'clsx';
import { Bot } from 'lucide-react';
import { useAgentStore } from '../../stores/agentStore';
import { AgentCard } from './AgentCard';
import { CompactEmptyState } from '../EmptyState';

interface AgentListProps {
  className?: string;
  onAgentSelect?: (agentId: string) => void;
  onAgentExpand?: (agentId: string) => void;
  onSpawnAgent?: () => void;
}

export function AgentList({ className, onAgentSelect, onAgentExpand, onSpawnAgent }: AgentListProps) {
  const { agents, selectedAgentId, selectAgent, killAgent } = useAgentStore();

  const agentList = useMemo(() => Array.from(agents.values()), [agents]);

  if (agentList.length === 0) {
    return (
      <div className={clsx('h-64', className)}>
        <CompactEmptyState
          icon={Bot}
          message="No agents active. Spawn agents from the Command Center."
          action={onSpawnAgent ? { label: 'Spawn Agent', onClick: onSpawnAgent } : undefined}
        />
      </div>
    );
  }

  return (
    <div className={clsx('grid gap-4', className)}>
      {agentList.map((agent) => (
        <AgentCard
          key={agent.id}
          agent={agent}
          selected={selectedAgentId === agent.id}
          onSelect={() => {
            selectAgent(agent.id);
            onAgentSelect?.(agent.id);
          }}
          onKill={() => killAgent(agent.id)}
          onExpand={() => onAgentExpand?.(agent.id)}
        />
      ))}
    </div>
  );
}
