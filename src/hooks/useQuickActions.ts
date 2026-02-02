import { useState, useCallback } from 'react';
import { mcpCallTool } from '../services/tauri';
import { toast } from '../components/ui';
import type { ActionStatus } from '../components/ActionOutputModal';

export type QuickActionId =
  | 'updateDeps'
  | 'runTests'
  | 'runBuild'
  | 'runLint'
  | 'auditDeps'
  | 'deleteMergedBranches'
  | 'clearStashes';

export interface AvailableActions {
  updateDeps: boolean;
  runTests: boolean;
  runBuild: boolean;
  runLint: boolean;
  auditDeps: boolean;
  deleteMergedBranches: boolean;
  clearStashes: boolean;
}

export interface ActionOutput {
  actionId: QuickActionId;
  title: string;
  status: ActionStatus;
  output: string;
  error?: string;
}

interface ProjectInfo {
  projectType?: string;
  hasPackageJson?: boolean;
  hasCargoToml?: boolean;
  hasMakefile?: boolean;
  hasGit?: boolean;
  scripts?: string[];
}

interface QuickActionsState {
  available: AvailableActions | null;
  isLoading: boolean;
  runningAction: QuickActionId | null;
  error: string | null;
  actionOutput: ActionOutput | null;
  showOutputModal: boolean;
}

// MCP tool name mappings
const MCP_TOOLS = {
  detectProject: 'mcp__localhost-infinity__detect_project_info',
  getScripts: 'mcp__localhost-infinity__get_project_scripts',
  runTests: 'mcp__localhost-infinity__run_tests',
  runScript: 'mcp__localhost-infinity__run_project_script',
  getOutdated: 'mcp__localhost-infinity__get_outdated_packages',
  auditDeps: 'mcp__localhost-infinity__audit_dependencies',
  getStaleBranches: 'mcp__localhost-infinity__get_stale_branches',
  gitStashPop: 'mcp__localhost-infinity__git_stash_pop',
  gitHealthSummary: 'mcp__localhost-infinity__get_git_health_summary',
} as const;

export function useQuickActions() {
  const [state, setState] = useState<QuickActionsState>({
    available: null,
    isLoading: false,
    runningAction: null,
    error: null,
    actionOutput: null,
    showOutputModal: false,
  });

  const fetchAvailable = useCallback(async (projectPath: string) => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      // Detect project info to determine available actions
      let projectInfo: ProjectInfo = {};
      let scripts: string[] = [];

      try {
        const info = await mcpCallTool<{ projectType?: string; frameworks?: string[] }>(
          MCP_TOOLS.detectProject,
          { path: projectPath }
        );
        projectInfo.projectType = info?.projectType;
      } catch {
        // Project detection failed, assume basic availability
      }

      try {
        const scriptsResult = await mcpCallTool<{ scripts?: Record<string, string> }>(
          MCP_TOOLS.getScripts,
          { path: projectPath }
        );
        scripts = Object.keys(scriptsResult?.scripts || {});
      } catch {
        // Scripts detection failed
      }

      try {
        await mcpCallTool(MCP_TOOLS.gitHealthSummary, { path: projectPath });
        projectInfo.hasGit = true;
      } catch {
        projectInfo.hasGit = false;
      }

      // Determine available actions based on project info
      const available: AvailableActions = {
        updateDeps: true, // Always try - will fail gracefully if no package manager
        runTests: scripts.includes('test') || scripts.includes('tests') || true,
        runBuild: scripts.includes('build') || true,
        runLint: scripts.includes('lint') || scripts.includes('eslint') || true,
        auditDeps: true,
        deleteMergedBranches: projectInfo.hasGit ?? true,
        clearStashes: projectInfo.hasGit ?? true,
      };

      setState((s) => ({ ...s, available, isLoading: false }));
    } catch (error) {
      // On any error, enable all actions and let them fail gracefully
      const available: AvailableActions = {
        updateDeps: true,
        runTests: true,
        runBuild: true,
        runLint: true,
        auditDeps: true,
        deleteMergedBranches: true,
        clearStashes: true,
      };
      setState((s) => ({
        ...s,
        available,
        isLoading: false,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }, []);

  const runAction = useCallback(
    async (
      actionId: QuickActionId,
      title: string,
      projectPath: string,
      toolName: string,
      args: Record<string, unknown> = {}
    ) => {
      setState((s) => ({
        ...s,
        runningAction: actionId,
        error: null,
        actionOutput: {
          actionId,
          title,
          status: 'running',
          output: '',
        },
        showOutputModal: true,
      }));

      try {
        const result = await mcpCallTool<unknown>(toolName, { path: projectPath, ...args });

        // Format the output
        let output: string;
        if (typeof result === 'string') {
          output = result;
        } else if (result && typeof result === 'object') {
          output = JSON.stringify(result, null, 2);
        } else {
          output = 'Action completed successfully';
        }

        setState((s) => ({
          ...s,
          runningAction: null,
          actionOutput: {
            actionId,
            title,
            status: 'success',
            output,
          },
        }));

        toast.success(`${title} completed`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        setState((s) => ({
          ...s,
          runningAction: null,
          error: message,
          actionOutput: {
            actionId,
            title,
            status: 'error',
            output: s.actionOutput?.output || '',
            error: message,
          },
        }));

        toast.error(`${title} failed`, { description: message });
      }
    },
    []
  );

  const closeOutputModal = useCallback(() => {
    setState((s) => ({ ...s, showOutputModal: false }));
  }, []);

  const updateDeps = useCallback(
    (projectPath: string) =>
      runAction('updateDeps', 'Update Dependencies', projectPath, MCP_TOOLS.getOutdated),
    [runAction]
  );

  const auditDeps = useCallback(
    (projectPath: string) =>
      runAction('auditDeps', 'Audit Dependencies', projectPath, MCP_TOOLS.auditDeps),
    [runAction]
  );

  const runTests = useCallback(
    (projectPath: string) =>
      runAction('runTests', 'Run Tests', projectPath, MCP_TOOLS.runTests, { verbose: true }),
    [runAction]
  );

  const runBuild = useCallback(
    (projectPath: string) =>
      runAction('runBuild', 'Build Project', projectPath, MCP_TOOLS.runScript, { script: 'build' }),
    [runAction]
  );

  const runLint = useCallback(
    (projectPath: string) =>
      runAction('runLint', 'Lint Project', projectPath, MCP_TOOLS.runScript, { script: 'lint' }),
    [runAction]
  );

  const deleteMergedBranches = useCallback(
    (projectPath: string) =>
      runAction(
        'deleteMergedBranches',
        'Find Stale Branches',
        projectPath,
        MCP_TOOLS.getStaleBranches,
        { thresholdDays: 30 }
      ),
    [runAction]
  );

  const clearStashes = useCallback(
    (projectPath: string) =>
      runAction('clearStashes', 'Pop Stash', projectPath, MCP_TOOLS.gitStashPop),
    [runAction]
  );

  return {
    available: state.available,
    isLoading: state.isLoading,
    runningAction: state.runningAction,
    error: state.error,
    actionOutput: state.actionOutput,
    showOutputModal: state.showOutputModal,
    fetchAvailable,
    updateDeps,
    auditDeps,
    runTests,
    runBuild,
    runLint,
    deleteMergedBranches,
    clearStashes,
    closeOutputModal,
  };
}
