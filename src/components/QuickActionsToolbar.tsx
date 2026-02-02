import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuickActions } from '../hooks/useQuickActions';
import { Spinner } from './ui/Spinner';
import { ActionOutputModal } from './ActionOutputModal';
import { clsx } from 'clsx';

interface QuickActionsToolbarProps {
  projectPath: string;
  projectName: string;
}

export function QuickActionsToolbar({ projectPath, projectName }: QuickActionsToolbarProps) {
  const [showMore, setShowMore] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    available,
    isLoading,
    runningAction,
    actionOutput,
    showOutputModal,
    updateDeps,
    auditDeps,
    runTests,
    runBuild,
    runLint,
    deleteMergedBranches,
    clearStashes,
    fetchAvailable,
    closeOutputModal,
  } = useQuickActions();

  useEffect(() => {
    fetchAvailable(projectPath);
  }, [projectPath, fetchAvailable]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowMore(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isActionRunning = runningAction !== null;

  // Primary actions (always visible)
  const primaryActions = [
    {
      id: 'updateDeps' as const,
      label: 'Update',
      icon: '📦',
      shortcut: 'U',
      action: () => updateDeps(projectPath),
      available: available?.updateDeps,
    },
    {
      id: 'runTests' as const,
      label: 'Test',
      icon: '🧪',
      shortcut: 'T',
      action: () => runTests(projectPath),
      available: available?.runTests,
    },
    {
      id: 'runBuild' as const,
      label: 'Build',
      icon: '🔨',
      shortcut: 'B',
      action: () => runBuild(projectPath),
      available: available?.runBuild,
    },
  ];

  // Secondary actions (in dropdown)
  const secondaryActions = [
    {
      id: 'runLint' as const,
      label: 'Lint',
      icon: '✨',
      shortcut: 'L',
      action: () => runLint(projectPath),
      available: available?.runLint,
      danger: false,
    },
    {
      id: 'auditDeps' as const,
      label: 'Audit Deps',
      icon: '🔒',
      shortcut: 'A',
      action: () => auditDeps(projectPath),
      available: available?.auditDeps,
      danger: false,
    },
    {
      id: 'deleteMergedBranches' as const,
      label: 'Stale Branches',
      icon: '🗑️',
      action: () => deleteMergedBranches(projectPath),
      available: available?.deleteMergedBranches,
      danger: true,
    },
    {
      id: 'clearStashes' as const,
      label: 'Pop Stash',
      icon: '📚',
      action: () => clearStashes(projectPath),
      available: available?.clearStashes,
      danger: true,
    },
  ];

  return (
    <>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="flex items-center gap-3 px-4 py-2 bg-[var(--bg-tertiary)]/50 border-b border-[var(--glass-border)]"
      >
        {/* Project indicator */}
        <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] border-r border-[var(--glass-border)] pr-3">
          <span>📁</span>
          <span className="max-w-[150px] truncate">{projectName}</span>
        </div>

        {/* Primary action buttons */}
        <div className="flex items-center gap-1">
          {primaryActions.map(({ id, label, icon, shortcut, action, available: isAvailable }) => (
            <button
              key={id}
              onClick={action}
              disabled={!isAvailable || isActionRunning}
              title={`${label} (${shortcut})`}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium',
                'transition-all',
                isAvailable && !isActionRunning
                  ? 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-tertiary)] cursor-not-allowed opacity-50'
              )}
            >
              {runningAction === id ? (
                <Spinner size="sm" />
              ) : (
                <span>{icon}</span>
              )}
              <span>{label}</span>
              {shortcut && (
                <kbd className="ml-1 px-1 py-0.5 text-[10px] bg-[var(--bg-tertiary)] rounded border border-[var(--glass-border)] text-[var(--text-tertiary)]">
                  {shortcut}
                </kbd>
              )}
            </button>
          ))}
        </div>

        {/* More dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowMore(!showMore)}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <span>⋯</span>
            <span className="text-xs">More</span>
          </button>

          <AnimatePresence>
            {showMore && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-1 w-52 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-lg shadow-xl z-50 overflow-hidden"
              >
                {secondaryActions.map(({ id, label, icon, shortcut, action, available: isAvailable, danger }) => (
                  <button
                    key={id}
                    onClick={() => {
                      action();
                      setShowMore(false);
                    }}
                    disabled={!isAvailable || isActionRunning}
                    className={clsx(
                      'w-full flex items-center gap-2 px-3 py-2 text-sm text-left',
                      'transition-colors',
                      !isAvailable || isActionRunning
                        ? 'text-[var(--text-tertiary)] cursor-not-allowed opacity-50'
                        : danger
                          ? 'text-red-400 hover:bg-red-500/10'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                    )}
                  >
                    {runningAction === id ? <Spinner size="sm" /> : <span>{icon}</span>}
                    <span className="flex-1">{label}</span>
                    {shortcut && (
                      <kbd className="px-1 py-0.5 text-[10px] bg-[var(--bg-tertiary)] rounded border border-[var(--glass-border)] text-[var(--text-tertiary)]">
                        {shortcut}
                      </kbd>
                    )}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Loading indicator */}
        {isLoading && (
          <div className="ml-auto">
            <Spinner size="sm" />
          </div>
        )}
      </motion.div>

      {/* Action Output Modal */}
      {actionOutput && (
        <ActionOutputModal
          isOpen={showOutputModal}
          onClose={closeOutputModal}
          title={actionOutput.title}
          status={actionOutput.status}
          output={actionOutput.output}
          error={actionOutput.error}
        />
      )}
    </>
  );
}
