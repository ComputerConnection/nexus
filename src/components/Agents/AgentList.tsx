import { useMemo } from 'react';
import { clsx } from 'clsx';
import { useAgentStore } from '../../stores/agentStore';
import { AgentCard } from './AgentCard';

interface AgentListProps {
  className?: string;
  onAgentSelect?: (agentId: string) => void;
  onAgentExpand?: (agentId: string) => void;
}

export function AgentList({ className, onAgentSelect, onAgentExpand }: AgentListProps) {
  const { agents, selectedAgentId, selectAgent, killAgent } = useAgentStore();

  const agentList = useMemo(() => Array.from(agents.values()), [agents]);

  if (agentList.length === 0) {
    return (
      <div className={clsx('flex items-center justify-center h-64', className)}>
        <div className="text-center text-text-secondary">
          <p className="text-lg font-mono">No agents active</p>
          <p className="text-sm mt-2">Spawn agents from the Command Center</p>
        </div>
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
