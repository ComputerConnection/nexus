import { useEffect, useCallback } from 'react';
import { useProjectStore } from '../stores/projectStore';
import { useQuickActions } from './useQuickActions';

/**
 * Global keyboard shortcuts for quick actions
 * - U: Update dependencies
 * - T: Run tests
 * - B: Run build
 * - L: Run lint
 * - A: Audit dependencies
 *
 * Shortcuts are disabled when:
 * - No project is selected
 * - User is typing in an input/textarea
 * - Another action is already running
 * - Command palette is open (Cmd+K)
 */
export function useQuickActionsShortcuts() {
  const { projects, selectedProjectId } = useProjectStore();
  const {
    runningAction,
    updateDeps,
    runTests,
    runBuild,
    runLint,
    auditDeps,
  } = useQuickActions();

  const selectedProject = selectedProjectId ? projects.get(selectedProjectId) : null;
  const projectPath = selectedProject?.workingDirectory;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Skip if no project selected or action running
      if (!projectPath || runningAction) return;

      // Skip if user is typing in an input
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Skip if modifier keys are pressed (allow Cmd+K for command palette, etc.)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key.toLowerCase()) {
        case 'u':
          e.preventDefault();
          updateDeps(projectPath);
          break;
        case 't':
          e.preventDefault();
          runTests(projectPath);
          break;
        case 'b':
          e.preventDefault();
          runBuild(projectPath);
          break;
        case 'l':
          e.preventDefault();
          runLint(projectPath);
          break;
        case 'a':
          e.preventDefault();
          auditDeps(projectPath);
          break;
      }
    },
    [projectPath, runningAction, updateDeps, runTests, runBuild, runLint, auditDeps]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
