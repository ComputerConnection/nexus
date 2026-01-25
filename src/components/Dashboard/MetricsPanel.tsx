import { clsx } from 'clsx';
import { Activity, Cpu, HardDrive, Zap } from 'lucide-react';
import { NeonCard } from '../common';

interface Metric {
  label: string;
  value: string | number;
  icon: typeof Activity;
  variant: 'cyan' | 'green' | 'magenta' | 'orange';
  trend?: 'up' | 'down' | 'stable';
}

interface MetricsPanelProps {
  metrics?: Metric[];
  className?: string;
}

const defaultMetrics: Metric[] = [
  { label: 'Active Agents', value: 0, icon: Activity, variant: 'green' },
  { label: 'Tasks Completed', value: 0, icon: Zap, variant: 'cyan' },
  { label: 'CPU Usage', value: '0%', icon: Cpu, variant: 'orange' },
  { label: 'Memory', value: '0 MB', icon: HardDrive, variant: 'magenta' },
];

export function MetricsPanel({ metrics = defaultMetrics, className }: MetricsPanelProps) {
  return (
    <div className={clsx('grid grid-cols-2 lg:grid-cols-4 gap-3', className)}>
      {metrics.map((metric, index) => (
        <MetricCard key={index} metric={metric} />
      ))}
    </div>
  );
}

interface MetricCardProps {
  metric: Metric;
}

function MetricCard({ metric }: MetricCardProps) {
  const Icon = metric.icon;

  const variantColors = {
    cyan: 'text-neon-cyan border-neon-cyan/30',
    green: 'text-neon-green border-neon-green/30',
    magenta: 'text-neon-magenta border-neon-magenta/30',
    orange: 'text-neon-orange border-neon-orange/30',
  };

  return (
    <NeonCard variant={metric.variant} className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-mono text-text-secondary mb-1">{metric.label}</p>
          <p className={clsx('text-2xl font-mono font-bold', variantColors[metric.variant])}>
            {metric.value}
          </p>
        </div>
        <Icon size={24} className={clsx('opacity-50', variantColors[metric.variant])} />
      </div>
      {metric.trend && (
        <div className="mt-2">
          <span
            className={clsx(
              'text-xs font-mono',
              metric.trend === 'up' && 'text-neon-green',
              metric.trend === 'down' && 'text-neon-red',
              metric.trend === 'stable' && 'text-text-secondary'
            )}
          >
            {metric.trend === 'up' && '↑'}
            {metric.trend === 'down' && '↓'}
            {metric.trend === 'stable' && '→'}
          </span>
        </div>
      )}
    </NeonCard>
  );
}
