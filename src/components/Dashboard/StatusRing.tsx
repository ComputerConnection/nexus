import { useMemo } from 'react';
import { clsx } from 'clsx';
import { Brain, Activity, Database, Clock } from 'lucide-react';

interface StatusRingProps {
  activeAgents: number;
  databaseConnected: boolean;
  isProcessing: boolean;
  uptimeSeconds?: number;
  className?: string;
}

export function StatusRing({
  activeAgents,
  databaseConnected,
  isProcessing,
  uptimeSeconds = 0,
  className,
}: StatusRingProps) {
  const formattedUptime = useMemo(() => {
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }, [uptimeSeconds]);

  return (
    <div className={clsx('relative', className)}>
      {/* Outer ring */}
      <div
        className={clsx(
          'w-48 h-48 rounded-full border-2 flex items-center justify-center',
          'transition-all duration-500',
          isProcessing
            ? 'border-neon-cyan animate-pulse shadow-neon-cyan'
            : 'border-neon-cyan/30'
        )}
      >
        {/* Inner ring */}
        <div
          className={clsx(
            'w-40 h-40 rounded-full border flex items-center justify-center',
            'bg-bg-secondary/50',
            isProcessing ? 'border-neon-cyan/50' : 'border-neon-cyan/20'
          )}
        >
          {/* Center content */}
          <div className="text-center">
            <Brain
              size={32}
              className={clsx(
                'mx-auto mb-2 transition-all duration-300',
                isProcessing ? 'text-neon-cyan animate-pulse' : 'text-neon-cyan/60'
              )}
            />
            <div className="text-xs font-mono text-text-secondary">
              {isProcessing ? 'PROCESSING' : 'READY'}
            </div>
          </div>
        </div>
      </div>

      {/* Status indicators around the ring */}
      {/* Active Agents - Top */}
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 flex flex-col items-center">
        <div
          className={clsx(
            'w-10 h-10 rounded-full border flex items-center justify-center',
            'bg-bg-secondary',
            activeAgents > 0
              ? 'border-neon-green text-neon-green'
              : 'border-text-secondary/30 text-text-secondary'
          )}
        >
          <Activity size={18} />
        </div>
        <span className="mt-1 text-xs font-mono text-text-secondary">{activeAgents}</span>
      </div>

      {/* Database - Right */}
      <div className="absolute top-1/2 -right-2 -translate-y-1/2 flex items-center">
        <div
          className={clsx(
            'w-10 h-10 rounded-full border flex items-center justify-center',
            'bg-bg-secondary',
            databaseConnected
              ? 'border-neon-cyan text-neon-cyan'
              : 'border-neon-red/50 text-neon-red'
          )}
        >
          <Database size={18} />
        </div>
      </div>

      {/* Uptime - Bottom */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex flex-col items-center">
        <div
          className={clsx(
            'w-10 h-10 rounded-full border flex items-center justify-center',
            'bg-bg-secondary border-neon-magenta/50 text-neon-magenta'
          )}
        >
          <Clock size={18} />
        </div>
        <span className="mt-1 text-xs font-mono text-text-secondary">{formattedUptime}</span>
      </div>
    </div>
  );
}
