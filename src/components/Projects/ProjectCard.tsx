import { clsx } from 'clsx';
import { Folder, Clock, MoreVertical, Trash2, Edit2, Play } from 'lucide-react';
import { NeonCard } from '../common';
import type { Project } from '../../types';

interface ProjectCardProps {
  project: Project;
  onSelect?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onLaunch?: () => void;
  selected?: boolean;
  className?: string;
}

const statusColors: Record<string, 'cyan' | 'green' | 'magenta' | 'orange' | 'red'> = {
  pending: 'cyan',
  active: 'green',
  paused: 'orange',
  completed: 'cyan',
  failed: 'red',
  archived: 'cyan',
};

export function ProjectCard({
  project,
  onSelect,
  onEdit,
  onDelete,
  onLaunch,
  selected,
  className,
}: ProjectCardProps) {
  const variant = statusColors[project.status] || 'cyan';
  const formattedDate = new Date(project.updatedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

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
          <div className="p-2 rounded-lg bg-neon-cyan/10">
            <Folder size={24} className="text-neon-cyan" />
          </div>
          <div>
            <h3 className="font-mono text-sm font-medium text-text-primary">
              {project.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={clsx(
                  'px-2 py-0.5 text-xs font-mono rounded capitalize',
                  variant === 'green' && 'bg-neon-green/20 text-neon-green',
                  variant === 'orange' && 'bg-neon-orange/20 text-neon-orange',
                  variant === 'red' && 'bg-neon-red/20 text-neon-red',
                  variant === 'cyan' && 'bg-neon-cyan/20 text-neon-cyan'
                )}
              >
                {project.status}
              </span>
            </div>
          </div>
        </div>

        {/* Menu */}
        <div className="relative group">
          <button
            onClick={(e) => e.stopPropagation()}
            className="p-1 text-text-secondary hover:text-text-primary transition-colors"
          >
            <MoreVertical size={16} />
          </button>
          <div className="absolute right-0 top-full mt-1 hidden group-hover:block z-10">
            <div className="bg-bg-secondary border border-neon-cyan/30 rounded-lg py-1 min-w-[120px]">
              {onLaunch && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onLaunch();
                  }}
                  className="w-full px-3 py-2 text-left text-sm font-mono text-text-primary hover:bg-bg-tertiary flex items-center gap-2"
                >
                  <Play size={14} />
                  Launch
                </button>
              )}
              {onEdit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                  }}
                  className="w-full px-3 py-2 text-left text-sm font-mono text-text-primary hover:bg-bg-tertiary flex items-center gap-2"
                >
                  <Edit2 size={14} />
                  Edit
                </button>
              )}
              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="w-full px-3 py-2 text-left text-sm font-mono text-neon-red hover:bg-bg-tertiary flex items-center gap-2"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      {project.description && (
        <p className="text-xs text-text-secondary mb-3 line-clamp-2">
          {project.description}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-bg-tertiary">
        <span className="text-xs text-text-secondary truncate max-w-[60%]">
          {project.workingDirectory}
        </span>
        <div className="flex items-center gap-1 text-xs text-text-secondary">
          <Clock size={12} />
          {formattedDate}
        </div>
      </div>
    </NeonCard>
  );
}
