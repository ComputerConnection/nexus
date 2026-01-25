import { clsx } from 'clsx';
import {
  Code,
  TestTube,
  FileText,
  Shield,
  Rocket,
  GitBranch,
} from 'lucide-react';

interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: typeof Code;
  prompt: string;
  variant: 'cyan' | 'green' | 'magenta' | 'orange';
}

const defaultActions: QuickAction[] = [
  {
    id: 'implement',
    label: 'Implement Feature',
    description: 'Write production code',
    icon: Code,
    prompt: 'Implement the following feature:',
    variant: 'green',
  },
  {
    id: 'test',
    label: 'Write Tests',
    description: 'Create test suites',
    icon: TestTube,
    prompt: 'Write comprehensive tests for:',
    variant: 'orange',
  },
  {
    id: 'docs',
    label: 'Documentation',
    description: 'Generate docs',
    icon: FileText,
    prompt: 'Create documentation for:',
    variant: 'magenta',
  },
  {
    id: 'security',
    label: 'Security Audit',
    description: 'Review for vulnerabilities',
    icon: Shield,
    prompt: 'Perform a security audit on:',
    variant: 'cyan',
  },
  {
    id: 'deploy',
    label: 'Setup CI/CD',
    description: 'Configure deployment',
    icon: Rocket,
    prompt: 'Set up CI/CD pipeline for:',
    variant: 'orange',
  },
  {
    id: 'refactor',
    label: 'Refactor Code',
    description: 'Improve code quality',
    icon: GitBranch,
    prompt: 'Refactor the following code:',
    variant: 'cyan',
  },
];

interface QuickActionsProps {
  onSelect: (prompt: string) => void;
  actions?: QuickAction[];
  className?: string;
}

export function QuickActions({
  onSelect,
  actions = defaultActions,
  className,
}: QuickActionsProps) {
  return (
    <div className={clsx('grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3', className)}>
      {actions.map((action) => (
        <QuickActionCard key={action.id} action={action} onClick={() => onSelect(action.prompt)} />
      ))}
    </div>
  );
}

interface QuickActionCardProps {
  action: QuickAction;
  onClick: () => void;
}

function QuickActionCard({ action, onClick }: QuickActionCardProps) {
  const Icon = action.icon;

  const variantColors = {
    cyan: 'hover:border-neon-cyan hover:text-neon-cyan',
    green: 'hover:border-neon-green hover:text-neon-green',
    magenta: 'hover:border-neon-magenta hover:text-neon-magenta',
    orange: 'hover:border-neon-orange hover:text-neon-orange',
  };

  return (
    <button
      onClick={onClick}
      className={clsx(
        'p-4 rounded-lg border border-bg-tertiary bg-bg-secondary',
        'text-left transition-all duration-200',
        'hover:bg-bg-tertiary',
        variantColors[action.variant]
      )}
    >
      <Icon size={24} className="mb-2 opacity-70" />
      <p className="font-mono text-sm font-medium text-text-primary">{action.label}</p>
      <p className="text-xs text-text-secondary mt-1">{action.description}</p>
    </button>
  );
}
