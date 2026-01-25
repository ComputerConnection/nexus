import { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import { Maximize2, Minimize2, X } from 'lucide-react';
import { XTerminal } from './XTerminal';
import { useAgentStore } from '../../stores/agentStore';
import { StatusIndicator, NeonCard } from '../common';
import type { Agent, AgentRole } from '../../types';

interface TerminalGridProps {
  layout?: '1x1' | '2x2' | '3x3' | '2x1' | '1x2';
  className?: string;
}

const layoutGridClasses = {
  '1x1': 'grid-cols-1 grid-rows-1',
  '2x2': 'grid-cols-2 grid-rows-2',
  '3x3': 'grid-cols-3 grid-rows-3',
  '2x1': 'grid-cols-2 grid-rows-1',
  '1x2': 'grid-cols-1 grid-rows-2',
};

const roleToTheme: Record<AgentRole, 'cyan' | 'green' | 'magenta'> = {
  orchestrator: 'cyan',
  architect: 'cyan',
  implementer: 'green',
  tester: 'magenta',
  documenter: 'magenta',
  security: 'magenta',
  devops: 'cyan',
};

export function TerminalGrid({ layout = '2x2', className }: TerminalGridProps) {
  const { agents, outputs, killAgent, sendInput } = useAgentStore();
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  const agentList = useMemo(() => Array.from(agents.values()), [agents]);

  const handleKill = async (agentId: string) => {
    await killAgent(agentId);
    if (expandedAgent === agentId) {
      setExpandedAgent(null);
    }
  };

  const handleInput = (agentId: string) => (data: string) => {
    sendInput(agentId, data);
  };

  if (agentList.length === 0) {
    return (
      <div className={clsx('flex items-center justify-center h-full', className)}>
        <div className="text-center text-text-secondary">
          <p className="text-lg font-mono">No active agents</p>
          <p className="text-sm mt-2">Spawn an agent from the Command Center</p>
        </div>
      </div>
    );
  }

  // If an agent is expanded, show only that agent
  if (expandedAgent) {
    const agent = agents.get(expandedAgent);
    if (!agent) {
      setExpandedAgent(null);
      return null;
    }

    return (
      <div className={clsx('h-full', className)}>
        <TerminalPane
          agent={agent}
          output={outputs.get(agent.id) || []}
          expanded
          onToggleExpand={() => setExpandedAgent(null)}
          onKill={() => handleKill(agent.id)}
          onInput={handleInput(agent.id)}
        />
      </div>
    );
  }

  return (
    <div className={clsx('grid gap-2 h-full', layoutGridClasses[layout], className)}>
      {agentList.map((agent) => (
        <TerminalPane
          key={agent.id}
          agent={agent}
          output={outputs.get(agent.id) || []}
          expanded={false}
          onToggleExpand={() => setExpandedAgent(agent.id)}
          onKill={() => handleKill(agent.id)}
          onInput={handleInput(agent.id)}
        />
      ))}
    </div>
  );
}

interface TerminalPaneProps {
  agent: Agent;
  output: string[];
  expanded: boolean;
  onToggleExpand: () => void;
  onKill: () => void;
  onInput: (data: string) => void;
}

function TerminalPane({
  agent,
  output,
  expanded,
  onToggleExpand,
  onKill,
  onInput,
}: TerminalPaneProps) {
  const theme = roleToTheme[agent.role as AgentRole] || 'cyan';

  return (
    <NeonCard
      variant={theme === 'green' ? 'green' : theme === 'magenta' ? 'magenta' : 'cyan'}
      className="flex flex-col h-full overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-bg-tertiary">
        <div className="flex items-center gap-2">
          <StatusIndicator status={agent.status} size="sm" />
          <span className="font-mono text-sm text-text-primary">{agent.name}</span>
          <span className="text-xs text-text-secondary">({agent.role})</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleExpand}
            className="p-1 text-text-secondary hover:text-text-primary transition-colors"
            title={expanded ? 'Minimize' : 'Maximize'}
          >
            {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button
            onClick={onKill}
            className="p-1 text-text-secondary hover:text-neon-red transition-colors"
            title="Kill Agent"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Terminal */}
      <div className="flex-1 p-1 min-h-0">
        <XTerminal output={output} onInput={onInput} theme={theme} />
      </div>

      {/* Footer with progress */}
      {agent.progress > 0 && agent.progress < 100 && (
        <div className="px-3 py-1 border-t border-bg-tertiary">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-bg-tertiary rounded-full overflow-hidden">
              <div
                className={clsx(
                  'h-full transition-all duration-300',
                  theme === 'green' ? 'bg-neon-green' : theme === 'magenta' ? 'bg-neon-magenta' : 'bg-neon-cyan'
                )}
                style={{ width: `${agent.progress}%` }}
              />
            </div>
            <span className="text-xs font-mono text-text-secondary">{agent.progress}%</span>
          </div>
        </div>
      )}
    </NeonCard>
  );
}
