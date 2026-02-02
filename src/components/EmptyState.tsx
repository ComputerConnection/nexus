import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import {
  Search,
  FolderPlus,
  Bot,
  GitBranch,
  Database,
  Cloud,
  Server,
  ScrollText,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { Button } from './ui';

export type EmptyStateVariant =
  | 'search'
  | 'projects'
  | 'agents'
  | 'workflows'
  | 'database'
  | 'kubernetes'
  | 'remote'
  | 'recipes'
  | 'settings'
  | 'generic';

interface EmptyStateProps {
  /** Pre-configured variant for common use cases */
  variant?: EmptyStateVariant;
  /** Custom icon (overrides variant icon) */
  icon?: LucideIcon | React.ReactNode;
  /** Main title */
  title: string;
  /** Description text */
  description?: string;
  /** Primary action button */
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  /** Secondary action button */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  /** Custom className */
  className?: string;
  /** Compact mode for smaller containers */
  compact?: boolean;
}

const variantConfig: Record<
  EmptyStateVariant,
  { icon: LucideIcon; gradient: string }
> = {
  search: {
    icon: Search,
    gradient: 'from-gray-500/20 to-gray-600/20 border-gray-500/30',
  },
  projects: {
    icon: FolderPlus,
    gradient: 'from-orange-500/20 to-red-500/20 border-orange-500/30',
  },
  agents: {
    icon: Bot,
    gradient: 'from-cyan-500/20 to-blue-500/20 border-cyan-500/30',
  },
  workflows: {
    icon: GitBranch,
    gradient: 'from-purple-500/20 to-pink-500/20 border-purple-500/30',
  },
  database: {
    icon: Database,
    gradient: 'from-green-500/20 to-emerald-500/20 border-green-500/30',
  },
  kubernetes: {
    icon: Cloud,
    gradient: 'from-blue-500/20 to-indigo-500/20 border-blue-500/30',
  },
  remote: {
    icon: Server,
    gradient: 'from-violet-500/20 to-purple-500/20 border-violet-500/30',
  },
  recipes: {
    icon: ScrollText,
    gradient: 'from-pink-500/20 to-rose-500/20 border-pink-500/30',
  },
  settings: {
    icon: Settings,
    gradient: 'from-gray-500/20 to-slate-500/20 border-gray-500/30',
  },
  generic: {
    icon: Search,
    gradient: 'from-gray-500/20 to-gray-600/20 border-gray-500/30',
  },
};

export function EmptyState({
  variant = 'generic',
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  compact = false,
}: EmptyStateProps) {
  const config = variantConfig[variant];
  const IconComponent = config.icon;

  const renderIcon = () => {
    if (icon) {
      if (typeof icon === 'function') {
        const CustomIcon = icon as LucideIcon;
        return <CustomIcon size={compact ? 32 : 40} className="text-[var(--text-tertiary)]" />;
      }
      return icon;
    }
    return <IconComponent size={compact ? 32 : 40} className="text-[var(--text-tertiary)]" />;
  };

  return (
    <div
      className={clsx(
        'flex items-center justify-center',
        compact ? 'py-8' : 'py-16',
        className
      )}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={clsx('text-center', compact ? 'max-w-sm' : 'max-w-md')}
      >
        {/* Icon */}
        <motion.div
          className={clsx(
            'mx-auto mb-4 rounded-2xl bg-gradient-to-br flex items-center justify-center border',
            config.gradient,
            compact ? 'w-16 h-16' : 'w-20 h-20'
          )}
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          {renderIcon()}
        </motion.div>

        {/* Title */}
        <h2
          className={clsx(
            'font-semibold text-[var(--text-primary)] mb-2',
            compact ? 'text-lg' : 'text-xl'
          )}
        >
          {title}
        </h2>

        {/* Description */}
        {description && (
          <p
            className={clsx(
              'text-[var(--text-secondary)]',
              compact ? 'text-sm mb-4' : 'mb-6'
            )}
          >
            {description}
          </p>
        )}

        {/* Actions */}
        {(action || secondaryAction) && (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {action && (
              <Button
                variant="primary"
                size={compact ? 'sm' : 'md'}
                onClick={action.onClick}
                icon={action.icon && <action.icon size={16} />}
                glow
              >
                {action.label}
              </Button>
            )}
            {secondaryAction && (
              <Button
                variant="ghost"
                size={compact ? 'sm' : 'md'}
                onClick={secondaryAction.onClick}
              >
                {secondaryAction.label}
              </Button>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}

// Pre-configured empty states for common scenarios

interface SearchEmptyStateProps {
  query: string;
  onClear: () => void;
  itemType?: string;
}

export function SearchEmptyState({ query, onClear, itemType = 'items' }: SearchEmptyStateProps) {
  return (
    <EmptyState
      variant="search"
      title={`No matching ${itemType}`}
      description={`No ${itemType} found for "${query}". Try a different search term.`}
      action={{
        label: 'Clear Search',
        onClick: onClear,
      }}
    />
  );
}

interface NoDataEmptyStateProps {
  variant: EmptyStateVariant;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  actionIcon?: LucideIcon;
}

export function NoDataEmptyState({
  variant,
  title,
  description,
  actionLabel,
  onAction,
  actionIcon,
}: NoDataEmptyStateProps) {
  return (
    <EmptyState
      variant={variant}
      title={title}
      description={description}
      action={{
        label: actionLabel,
        onClick: onAction,
        icon: actionIcon,
      }}
    />
  );
}

// Compact empty state for smaller panels/sections
interface CompactEmptyStateProps {
  icon?: LucideIcon;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function CompactEmptyState({ icon: Icon, message, action }: CompactEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      {Icon && (
        <div className="w-12 h-12 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] flex items-center justify-center mb-3">
          <Icon size={24} className="text-[var(--text-tertiary)]" />
        </div>
      )}
      <p className="text-sm text-[var(--text-secondary)] mb-3">{message}</p>
      {action && (
        <Button variant="ghost" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
