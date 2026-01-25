import { clsx } from 'clsx';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animate?: boolean;
}

export function Skeleton({
  className,
  variant = 'rectangular',
  width,
  height,
  animate = true,
}: SkeletonProps) {
  const style: React.CSSProperties = {
    width: width,
    height: height,
  };

  return (
    <div
      style={style}
      className={clsx(
        'bg-gradient-to-r from-[var(--bg-tertiary)] via-[var(--bg-elevated)] to-[var(--bg-tertiary)]',
        animate && 'animate-pulse bg-[length:200%_100%]',
        variant === 'circular' && 'rounded-full',
        variant === 'text' && 'rounded h-4',
        variant === 'rectangular' && 'rounded-[var(--radius-md)]',
        className
      )}
    />
  );
}

// Skeleton card preset
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        'p-5 rounded-[var(--radius-lg)] bg-[var(--glass-bg)] border border-[var(--glass-border)]',
        className
      )}
    >
      <div className="flex items-center gap-3 mb-4">
        <Skeleton variant="circular" width={40} height={40} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="text" width="40%" height={12} />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton variant="text" width="100%" />
        <Skeleton variant="text" width="80%" />
        <Skeleton variant="text" width="90%" />
      </div>
    </div>
  );
}

// Skeleton list preset
export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 rounded-[var(--radius-md)] bg-[var(--glass-bg)] border border-[var(--glass-border)]"
        >
          <Skeleton variant="circular" width={32} height={32} />
          <div className="flex-1 space-y-1.5">
            <Skeleton variant="text" width="50%" />
            <Skeleton variant="text" width="30%" height={10} />
          </div>
          <Skeleton variant="rectangular" width={60} height={24} />
        </div>
      ))}
    </div>
  );
}

// Skeleton terminal preset
export function SkeletonTerminal({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        'rounded-[var(--radius-lg)] bg-[var(--bg-primary)] border border-[var(--glass-border)] overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-[var(--bg-secondary)] border-b border-[var(--glass-border)]">
        <Skeleton variant="circular" width={12} height={12} />
        <Skeleton variant="circular" width={12} height={12} />
        <Skeleton variant="circular" width={12} height={12} />
        <Skeleton variant="text" width={120} height={14} className="ml-4" />
      </div>
      {/* Body */}
      <div className="p-4 space-y-2">
        <Skeleton variant="text" width="70%" height={14} />
        <Skeleton variant="text" width="50%" height={14} />
        <Skeleton variant="text" width="85%" height={14} />
        <Skeleton variant="text" width="40%" height={14} />
      </div>
    </div>
  );
}

// Agent card skeleton
export function SkeletonAgentCard({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        'p-4 rounded-[var(--radius-lg)] bg-[var(--glass-bg)] border border-[var(--glass-border)]',
        className
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <Skeleton variant="circular" width={40} height={40} />
          <div className="space-y-1.5">
            <Skeleton variant="text" width={100} height={16} />
            <Skeleton variant="text" width={60} height={12} />
          </div>
        </div>
        <Skeleton variant="rectangular" width={60} height={24} />
      </div>
      <Skeleton variant="rectangular" width="100%" height={80} className="mb-3" />
      <div className="flex items-center justify-between">
        <Skeleton variant="text" width={80} height={12} />
        <Skeleton variant="rectangular" width={100} height={6} />
      </div>
    </div>
  );
}
