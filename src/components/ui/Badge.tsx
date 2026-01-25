import type { ReactNode } from 'react';
import { clsx } from 'clsx';

type BadgeVariant = 'default' | 'cyan' | 'green' | 'magenta' | 'orange' | 'red' | 'purple';
type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: ReactNode;
  pulse?: boolean;
  className?: string;
}

const variants: Record<BadgeVariant, string> = {
  default: 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--glass-border)]',
  cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  green: 'bg-green-500/10 text-green-400 border-green-500/20',
  magenta: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  orange: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  red: 'bg-red-500/10 text-red-400 border-red-500/20',
  purple: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
};

const sizes: Record<BadgeSize, string> = {
  sm: 'px-1.5 py-0.5 text-[10px] gap-1',
  md: 'px-2.5 py-1 text-xs gap-1.5',
  lg: 'px-3 py-1.5 text-sm gap-2',
};

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  icon,
  pulse,
  className,
}: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center font-medium rounded-full border',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span
            className={clsx(
              'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
              variant === 'green' && 'bg-green-400',
              variant === 'cyan' && 'bg-cyan-400',
              variant === 'orange' && 'bg-orange-400',
              variant === 'red' && 'bg-red-400',
              variant === 'default' && 'bg-gray-400'
            )}
          />
          <span
            className={clsx(
              'relative inline-flex rounded-full h-2 w-2',
              variant === 'green' && 'bg-green-400',
              variant === 'cyan' && 'bg-cyan-400',
              variant === 'orange' && 'bg-orange-400',
              variant === 'red' && 'bg-red-400',
              variant === 'default' && 'bg-gray-400'
            )}
          />
        </span>
      )}
      {icon}
      {children}
    </span>
  );
}

// Status badge with animated indicator
interface StatusBadgeProps {
  status: 'running' | 'paused' | 'completed' | 'failed' | 'idle' | 'starting';
  label?: string;
  size?: BadgeSize;
}

const statusConfig: Record<
  StatusBadgeProps['status'],
  { variant: BadgeVariant; label: string; pulse: boolean }
> = {
  running: { variant: 'green', label: 'Running', pulse: true },
  paused: { variant: 'orange', label: 'Paused', pulse: false },
  completed: { variant: 'cyan', label: 'Completed', pulse: false },
  failed: { variant: 'red', label: 'Failed', pulse: false },
  idle: { variant: 'default', label: 'Idle', pulse: false },
  starting: { variant: 'cyan', label: 'Starting', pulse: true },
};

export function StatusBadge({ status, label, size = 'md' }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <Badge variant={config.variant} size={size} pulse={config.pulse}>
      {label || config.label}
    </Badge>
  );
}
