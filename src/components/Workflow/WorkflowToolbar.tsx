import { clsx } from 'clsx';
import {
  Plus,
  Play,
  Pause,
  Square,
  Save,
  FolderOpen,
  Trash2,
} from 'lucide-react';
import { NeonButton, NeonCard } from '../common';
import type { AgentRole } from '../../types';

interface WorkflowToolbarProps {
  onAddNode: (role: AgentRole) => void;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSave: () => void;
  onLoad: () => void;
  onClear: () => void;
  isExecuting: boolean;
  className?: string;
}

const agentOptions: { role: AgentRole; label: string; color: string }[] = [
  { role: 'orchestrator', label: 'Orchestrator', color: '#00fff9' },
  { role: 'architect', label: 'Architect', color: '#00fff9' },
  { role: 'implementer', label: 'Implementer', color: '#39ff14' },
  { role: 'tester', label: 'Tester', color: '#ff6600' },
  { role: 'documenter', label: 'Documenter', color: '#ff00ff' },
  { role: 'security', label: 'Security', color: '#ff0040' },
  { role: 'devops', label: 'DevOps', color: '#808080' },
];

export function WorkflowToolbar({
  onAddNode,
  onPlay,
  onPause,
  onStop,
  onSave,
  onLoad,
  onClear,
  isExecuting,
  className,
}: WorkflowToolbarProps) {
  return (
    <NeonCard variant="cyan" className={clsx('p-3', className)}>
      <div className="flex items-center justify-between gap-4">
        {/* Add Agent dropdown */}
        <div className="relative group">
          <NeonButton variant="cyan" size="sm" className="flex items-center gap-2">
            <Plus size={16} />
            Add Agent
          </NeonButton>
          <div className="absolute top-full left-0 mt-1 hidden group-hover:block z-10">
            <div className="bg-bg-secondary border border-neon-cyan/30 rounded-lg p-2 min-w-[150px]">
              {agentOptions.map((option) => (
                <button
                  key={option.role}
                  onClick={() => onAddNode(option.role)}
                  className="w-full px-3 py-2 text-left text-sm font-mono text-text-primary hover:bg-bg-tertiary rounded transition-colors"
                  style={{ borderLeft: `3px solid ${option.color}` }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Execution controls */}
        <div className="flex items-center gap-2">
          <NeonButton
            variant="green"
            size="sm"
            onClick={onPlay}
            disabled={isExecuting}
            className="flex items-center gap-2"
          >
            <Play size={16} />
            Run
          </NeonButton>
          <NeonButton
            variant="orange"
            size="sm"
            onClick={onPause}
            disabled={!isExecuting}
            className="flex items-center gap-2"
          >
            <Pause size={16} />
            Pause
          </NeonButton>
          <NeonButton
            variant="red"
            size="sm"
            onClick={onStop}
            disabled={!isExecuting}
            className="flex items-center gap-2"
          >
            <Square size={16} />
            Stop
          </NeonButton>
        </div>

        {/* File operations */}
        <div className="flex items-center gap-2">
          <NeonButton
            variant="cyan"
            size="sm"
            onClick={onSave}
            className="flex items-center gap-2"
          >
            <Save size={16} />
            Save
          </NeonButton>
          <NeonButton
            variant="cyan"
            size="sm"
            onClick={onLoad}
            className="flex items-center gap-2"
          >
            <FolderOpen size={16} />
            Load
          </NeonButton>
          <NeonButton
            variant="red"
            size="sm"
            onClick={onClear}
            glow={false}
            className="flex items-center gap-2"
          >
            <Trash2 size={16} />
            Clear
          </NeonButton>
        </div>
      </div>
    </NeonCard>
  );
}
