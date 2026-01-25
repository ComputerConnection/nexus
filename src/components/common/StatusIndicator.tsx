import { clsx } from 'clsx';

type Status = 'idle' | 'starting' | 'running' | 'paused' | 'completed' | 'failed' | 'killed';

interface StatusIndicatorProps {
  status: Status;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  pulse?: boolean;
  className?: string;
}

const statusConfig: Record<Status, { color: string; label: string; animate: boolean }> = {
  idle: { color: 'bg-text-secondary', label: 'Idle', animate: false },
  starting: { color: 'bg-neon-orange', label: 'Starting', animate: true },
  running: { color: 'bg-neon-green', label: 'Running', animate: true },
  paused: { color: 'bg-neon-orange', label: 'Paused', animate: false },
  completed: { color: 'bg-neon-cyan', label: 'Completed', animate: false },
  failed: { color: 'bg-neon-red', label: 'Failed', animate: false },
  killed: { color: 'bg-neon-red', label: 'Killed', animate: false },
};

const sizeStyles = {
  sm: 'w-2 h-2',
  md: 'w-3 h-3',
  lg: 'w-4 h-4',
};

export function StatusIndicator({
  status,
  size = 'md',
  showLabel = false,
  pulse = true,
  className,
}: StatusIndicatorProps) {
  const config = statusConfig[status];

  return (
    <div className={clsx('flex items-center gap-2', className)}>
      <span className="relative flex">
        <span
          className={clsx(
            'rounded-full',
            sizeStyles[size],
            config.color,
            pulse && config.animate && 'animate-ping absolute opacity-75'
          )}
        />
        <span
          className={clsx('relative rounded-full', sizeStyles[size], config.color)}
        />
      </span>
      {showLabel && (
        <span className="text-sm font-mono text-text-secondary">{config.label}</span>
      )}
    </div>
  );
}
