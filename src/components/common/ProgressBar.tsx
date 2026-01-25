import { clsx } from 'clsx';

interface ProgressBarProps {
  progress: number;
  variant?: 'cyan' | 'magenta' | 'green' | 'orange' | 'red';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  animated?: boolean;
  className?: string;
}

export function ProgressBar({
  progress,
  variant = 'cyan',
  size = 'md',
  showLabel = false,
  animated = true,
  className,
}: ProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  const variantColors = {
    cyan: 'bg-neon-cyan',
    magenta: 'bg-neon-magenta',
    green: 'bg-neon-green',
    orange: 'bg-neon-orange',
    red: 'bg-neon-red',
  };

  const variantGlow = {
    cyan: 'shadow-[0_0_10px_#00fff9]',
    magenta: 'shadow-[0_0_10px_#ff00ff]',
    green: 'shadow-[0_0_10px_#39ff14]',
    orange: 'shadow-[0_0_10px_#ff6600]',
    red: 'shadow-[0_0_10px_#ff0040]',
  };

  const sizeStyles = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  return (
    <div className={clsx('w-full', className)}>
      {showLabel && (
        <div className="flex justify-between mb-1 text-xs font-mono text-text-secondary">
          <span>Progress</span>
          <span>{clampedProgress}%</span>
        </div>
      )}
      <div
        className={clsx(
          'w-full bg-bg-tertiary rounded-full overflow-hidden',
          sizeStyles[size]
        )}
      >
        <div
          className={clsx(
            'h-full rounded-full transition-all duration-300',
            variantColors[variant],
            variantGlow[variant],
            animated && clampedProgress < 100 && 'animate-pulse'
          )}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
}
