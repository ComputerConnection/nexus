import { useState, useCallback, useMemo } from 'react';

// MCP Server configuration
const MCP_SERVER_URL = 'http://localhost:9999';

// Recipe types
export type RecipeCategory =
  | 'debugging'
  | 'setup'
  | 'maintenance'
  | 'monitoring'
  | 'deployment'
  | 'testing'
  | 'documentation'
  | 'custom';

export interface RecipeParameter {
  name: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'path';
  required: boolean;
  default?: string | number | boolean;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  category: RecipeCategory;
  tags: string[];
  parameters: RecipeParameter[];
  steps: RecipeStep[];
}

export interface RecipeStep {
  id: string;
  name: string;
  description: string;
  tool: string;
}

export interface StepResult {
  step_id: string;
  step_name: string;
  status: 'success' | 'failed' | 'skipped';
  output?: unknown;
  error?: string;
  duration_ms: number;
}

export interface RecipeExecutionResult {
  recipe_id: string;
  recipe_name: string;
  success: boolean;
  steps: StepResult[];
  summary: string;
  total_duration_ms: number;
}

export interface RecipesState {
  recipes: Recipe[];
  selectedRecipe: Recipe | null;
  executionResult: RecipeExecutionResult | null;
  isLoading: boolean;
  isExecuting: boolean;
  error: string | null;
  categoryFilter: RecipeCategory | 'all';
  searchQuery: string;
}

// Category metadata
export const CATEGORY_CONFIG: Record<
  RecipeCategory,
  { icon: string; color: string; label: string }
> = {
  debugging: { icon: '🐛', color: 'red', label: 'Debugging' },
  setup: { icon: '🔧', color: 'blue', label: 'Setup' },
  maintenance: { icon: '🛠️', color: 'yellow', label: 'Maintenance' },
  monitoring: { icon: '📊', color: 'green', label: 'Monitoring' },
  deployment: { icon: '🚀', color: 'purple', label: 'Deployment' },
  testing: { icon: '🧪', color: 'cyan', label: 'Testing' },
  documentation: { icon: '📝', color: 'orange', label: 'Documentation' },
  custom: { icon: '⚡', color: 'gray', label: 'Custom' },
};

export function useRecipes() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [executionResult, setExecutionResult] = useState<RecipeExecutionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<RecipeCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Call MCP tool via HTTP
  const callMcpTool = useCallback(async <T>(
    toolName: string,
    args: Record<string, unknown> = {}
  ): Promise<T> => {
    const response = await fetch(`${MCP_SERVER_URL}/tools/${toolName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
    });

    if (!response.ok) {
      throw new Error(`MCP tool call failed: ${response.statusText}`);
    }

    return response.json();
  }, []);

  // Fetch all recipes
  const fetchRecipes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await callMcpTool<{ recipes: Recipe[] }>('list_recipes', {});
      setRecipes(result.recipes || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      // If MCP server is not available, use built-in recipes
      console.warn('MCP server not available, using built-in recipes:', errorMessage);
      setRecipes(BUILTIN_RECIPES);
      // Don't set error since we have fallback data
    } finally {
      setIsLoading(false);
    }
  }, [callMcpTool]);

  // Get a specific recipe by ID
  const getRecipe = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await callMcpTool<{ recipe: Recipe }>('get_recipe', { recipe_id: id });
      setSelectedRecipe(result.recipe || null);
      return result.recipe;
    } catch (err) {
      // Fallback to finding recipe in current list
      const recipe = recipes.find((r) => r.id === id) || BUILTIN_RECIPES.find((r) => r.id === id);
      if (recipe) {
        setSelectedRecipe(recipe);
        return recipe;
      }
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      console.error('Failed to get recipe:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [callMcpTool, recipes]);

  // Run a recipe with parameters
  const runRecipe = useCallback(
    async (id: string, params: Record<string, unknown> = {}) => {
      setIsExecuting(true);
      setError(null);
      setExecutionResult(null);
      try {
        const result = await callMcpTool<RecipeExecutionResult>('run_recipe', {
          recipe_id: id,
          params,
        });
        setExecutionResult(result);
        return result;
      } catch (err) {
        // If MCP server not available, simulate execution for demo
        const recipe = recipes.find((r) => r.id === id) || BUILTIN_RECIPES.find((r) => r.id === id);
        if (recipe) {
          const simulatedResult = simulateRecipeExecution(recipe, params);
          setExecutionResult(simulatedResult);
          return simulatedResult;
        }
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(errorMessage);
        console.error('Failed to run recipe:', err);
        return null;
      } finally {
        setIsExecuting(false);
      }
    },
    [callMcpTool, recipes]
  );

  // Select a recipe
  const selectRecipe = useCallback((recipe: Recipe | null) => {
    setSelectedRecipe(recipe);
    setExecutionResult(null);
  }, []);

  // Clear execution result
  const clearExecutionResult = useCallback(() => {
    setExecutionResult(null);
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Filtered recipes based on category and search
  const filteredRecipes = useMemo(() => {
    return recipes.filter((recipe) => {
      // Category filter
      if (categoryFilter !== 'all' && recipe.category !== categoryFilter) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = recipe.name.toLowerCase().includes(query);
        const matchesDescription = recipe.description.toLowerCase().includes(query);
        const matchesTags = recipe.tags.some((tag) => tag.toLowerCase().includes(query));
        return matchesName || matchesDescription || matchesTags;
      }

      return true;
    });
  }, [recipes, categoryFilter, searchQuery]);

  // Get category icon
  const getCategoryIcon = useCallback((category: RecipeCategory): string => {
    return CATEGORY_CONFIG[category]?.icon || '⚡';
  }, []);

  // Get category color
  const getCategoryColor = useCallback((category: RecipeCategory): string => {
    return CATEGORY_CONFIG[category]?.color || 'gray';
  }, []);

  // Get category label
  const getCategoryLabel = useCallback((category: RecipeCategory): string => {
    return CATEGORY_CONFIG[category]?.label || category;
  }, []);

  return {
    // State
    recipes,
    selectedRecipe,
    executionResult,
    isLoading,
    isExecuting,
    error,
    categoryFilter,
    searchQuery,
    filteredRecipes,

    // Actions
    fetchRecipes,
    getRecipe,
    runRecipe,
    selectRecipe,
    clearExecutionResult,
    clearError,
    setCategoryFilter,
    setSearchQuery,

    // Helpers
    getCategoryIcon,
    getCategoryColor,
    getCategoryLabel,
  };
}

// Simulate recipe execution for demo/offline mode
function simulateRecipeExecution(
  recipe: Recipe,
  _params: Record<string, unknown>
): RecipeExecutionResult {
  const steps: StepResult[] = (recipe.steps || []).map((step, index) => {
    // Simulate random success/failure for demo
    const isSuccess = Math.random() > 0.1; // 90% success rate
    const duration = Math.floor(Math.random() * 2000) + 500; // 500-2500ms

    return {
      step_id: step.id,
      step_name: step.name,
      status: isSuccess ? 'success' : 'failed',
      output: isSuccess ? { message: `Step ${index + 1} completed successfully` } : undefined,
      error: isSuccess ? undefined : 'Simulated error for demo',
      duration_ms: duration,
    };
  });

  const allSucceeded = steps.every((s) => s.status === 'success');
  const totalDuration = steps.reduce((sum, s) => sum + s.duration_ms, 0);

  return {
    recipe_id: recipe.id,
    recipe_name: recipe.name,
    success: allSucceeded,
    steps,
    summary: allSucceeded
      ? `All ${steps.length} steps completed successfully`
      : `${steps.filter((s) => s.status === 'failed').length} of ${steps.length} steps failed`,
    total_duration_ms: totalDuration,
  };
}

// Built-in recipes for offline mode / demo
const BUILTIN_RECIPES: Recipe[] = [
  {
    id: 'debug-frontend',
    name: 'Debug Frontend',
    description: 'Diagnose frontend issues including console errors, network failures, and React component problems',
    category: 'debugging',
    tags: ['frontend', 'react', 'console', 'network'],
    parameters: [
      { name: 'path', description: 'Project path', type: 'path', required: true },
      { name: 'verbose', description: 'Enable verbose logging', type: 'boolean', required: false, default: false },
    ],
    steps: [
      { id: 'step-1', name: 'Check dev server logs', description: 'Scan dev server for errors', tool: 'get_dev_server_errors' },
      { id: 'step-2', name: 'Analyze console output', description: 'Parse browser console logs', tool: 'analyze_console' },
      { id: 'step-3', name: 'Check network requests', description: 'Inspect failed API calls', tool: 'check_network' },
    ],
  },
  {
    id: 'debug-api',
    name: 'Debug API',
    description: 'Troubleshoot backend API issues including endpoint failures, authentication, and database queries',
    category: 'debugging',
    tags: ['backend', 'api', 'rest', 'database'],
    parameters: [
      { name: 'path', description: 'Project path', type: 'path', required: true },
      { name: 'endpoint', description: 'Specific endpoint to debug', type: 'string', required: false },
    ],
    steps: [
      { id: 'step-1', name: 'Check server logs', description: 'Scan server logs for errors', tool: 'get_error_logs' },
      { id: 'step-2', name: 'Test endpoints', description: 'Run endpoint health checks', tool: 'test_endpoints' },
      { id: 'step-3', name: 'Check database', description: 'Verify database connectivity', tool: 'test_database_connection' },
    ],
  },
  {
    id: 'debug-database',
    name: 'Debug Database',
    description: 'Diagnose database connection issues, query performance, and migration problems',
    category: 'debugging',
    tags: ['database', 'sql', 'migrations', 'performance'],
    parameters: [
      { name: 'path', description: 'Project path', type: 'path', required: true },
    ],
    steps: [
      { id: 'step-1', name: 'Test connection', description: 'Verify database connectivity', tool: 'test_database_connection' },
      { id: 'step-2', name: 'Check migrations', description: 'Verify migration status', tool: 'get_migration_status' },
      { id: 'step-3', name: 'Analyze slow queries', description: 'Find performance bottlenecks', tool: 'analyze_queries' },
    ],
  },
  {
    id: 'setup-project',
    name: 'Setup Project',
    description: 'Initialize a new project with dependencies, environment setup, and initial configuration',
    category: 'setup',
    tags: ['init', 'dependencies', 'environment', 'config'],
    parameters: [
      { name: 'path', description: 'Project path', type: 'path', required: true },
      { name: 'install_deps', description: 'Install dependencies', type: 'boolean', required: false, default: true },
    ],
    steps: [
      { id: 'step-1', name: 'Detect project type', description: 'Identify framework and tools', tool: 'detect_project_env' },
      { id: 'step-2', name: 'Install dependencies', description: 'Run package manager install', tool: 'install_dependencies' },
      { id: 'step-3', name: 'Setup environment', description: 'Create .env from template', tool: 'setup_env' },
      { id: 'step-4', name: 'Validate imports', description: 'Check for import errors', tool: 'validate_imports' },
    ],
  },
  {
    id: 'claim-ports',
    name: 'Claim Ports',
    description: 'Reserve and manage development ports for your services',
    category: 'setup',
    tags: ['ports', 'network', 'development'],
    parameters: [
      { name: 'path', description: 'Project path', type: 'path', required: true },
      { name: 'services', description: 'Number of services', type: 'number', required: false, default: 3 },
    ],
    steps: [
      { id: 'step-1', name: 'Scan existing ports', description: 'Find used ports', tool: 'list_ports' },
      { id: 'step-2', name: 'Assign ports', description: 'Claim available ports', tool: 'assign_port' },
      { id: 'step-3', name: 'Update config', description: 'Write port configuration', tool: 'update_config' },
    ],
  },
  {
    id: 'health-check',
    name: 'Health Check',
    description: 'Run comprehensive health checks on your development environment',
    category: 'maintenance',
    tags: ['health', 'diagnostics', 'status'],
    parameters: [
      { name: 'path', description: 'Project path', type: 'path', required: true },
    ],
    steps: [
      { id: 'step-1', name: 'Check dependencies', description: 'Verify dependency health', tool: 'check_dependencies' },
      { id: 'step-2', name: 'Check services', description: 'Verify running services', tool: 'list_ports' },
      { id: 'step-3', name: 'Check disk space', description: 'Verify available storage', tool: 'get_system_resources' },
      { id: 'step-4', name: 'Check git status', description: 'Verify repository state', tool: 'get_git_health_summary' },
    ],
  },
  {
    id: 'cleanup',
    name: 'Cleanup',
    description: 'Clean up temporary files, caches, and unused resources',
    category: 'maintenance',
    tags: ['cleanup', 'cache', 'disk-space'],
    parameters: [
      { name: 'path', description: 'Project path', type: 'path', required: true },
      { name: 'aggressive', description: 'Remove node_modules too', type: 'boolean', required: false, default: false },
    ],
    steps: [
      { id: 'step-1', name: 'Clear build cache', description: 'Remove build artifacts', tool: 'clear_build_cache' },
      { id: 'step-2', name: 'Prune Docker', description: 'Remove unused containers', tool: 'prune_docker_containers' },
      { id: 'step-3', name: 'Clean node_modules', description: 'Optional deep clean', tool: 'clear_node_modules' },
    ],
  },
  {
    id: 'morning-briefing',
    name: 'Morning Briefing',
    description: 'Get a summary of project status, pending tasks, and important updates',
    category: 'monitoring',
    tags: ['status', 'summary', 'daily'],
    parameters: [
      { name: 'path', description: 'Project path', type: 'path', required: true },
    ],
    steps: [
      { id: 'step-1', name: 'Git summary', description: 'Recent commits and changes', tool: 'get_recent_activity' },
      { id: 'step-2', name: 'Issue status', description: 'Open issues and PRs', tool: 'list_open_issues' },
      { id: 'step-3', name: 'CI status', description: 'Check workflow runs', tool: 'get_workflow_status' },
      { id: 'step-4', name: 'Dependency alerts', description: 'Security updates', tool: 'get_security_alerts' },
    ],
  },
  {
    id: 'security-audit',
    name: 'Security Audit',
    description: 'Run security checks on dependencies and code',
    category: 'monitoring',
    tags: ['security', 'audit', 'vulnerabilities'],
    parameters: [
      { name: 'path', description: 'Project path', type: 'path', required: true },
    ],
    steps: [
      { id: 'step-1', name: 'Dependency audit', description: 'Check for vulnerable packages', tool: 'get_dependency_audit' },
      { id: 'step-2', name: 'Secret detection', description: 'Scan for exposed secrets', tool: 'detect_env_secrets' },
      { id: 'step-3', name: 'License check', description: 'Verify license compliance', tool: 'get_license_report' },
    ],
  },
  {
    id: 'pr-checklist',
    name: 'PR Checklist',
    description: 'Run pre-PR checks including tests, linting, and build verification',
    category: 'deployment',
    tags: ['pr', 'ci', 'checks', 'validation'],
    parameters: [
      { name: 'path', description: 'Project path', type: 'path', required: true },
    ],
    steps: [
      { id: 'step-1', name: 'Run tests', description: 'Execute test suite', tool: 'run_tests' },
      { id: 'step-2', name: 'Check types', description: 'Verify type safety', tool: 'validate_tauri_types' },
      { id: 'step-3', name: 'Build check', description: 'Verify build succeeds', tool: 'build_project' },
      { id: 'step-4', name: 'Git status', description: 'Check for uncommitted changes', tool: 'get_uncommitted_status' },
    ],
  },
  {
    id: 'test-suite',
    name: 'Test Suite',
    description: 'Run the full test suite with coverage reporting',
    category: 'testing',
    tags: ['tests', 'coverage', 'unit', 'integration'],
    parameters: [
      { name: 'path', description: 'Project path', type: 'path', required: true },
      { name: 'coverage', description: 'Generate coverage report', type: 'boolean', required: false, default: true },
    ],
    steps: [
      { id: 'step-1', name: 'Detect framework', description: 'Identify test framework', tool: 'detect_test_framework' },
      { id: 'step-2', name: 'Run tests', description: 'Execute all tests', tool: 'run_tests' },
      { id: 'step-3', name: 'Generate coverage', description: 'Collect coverage data', tool: 'get_test_coverage' },
      { id: 'step-4', name: 'Report flaky tests', description: 'Identify unstable tests', tool: 'get_flaky_tests' },
    ],
  },
  {
    id: 'generate-docs',
    name: 'Generate Docs',
    description: 'Generate project documentation including README, API docs, and architecture overview',
    category: 'documentation',
    tags: ['docs', 'readme', 'api', 'architecture'],
    parameters: [
      { name: 'path', description: 'Project path', type: 'path', required: true },
      { name: 'format', description: 'Output format (markdown/html)', type: 'string', required: false, default: 'markdown' },
    ],
    steps: [
      { id: 'step-1', name: 'Analyze project', description: 'Detect project structure', tool: 'detect_project_info' },
      { id: 'step-2', name: 'Generate README', description: 'Create README.md', tool: 'generate_readme' },
      { id: 'step-3', name: 'Generate API docs', description: 'Document endpoints', tool: 'generate_api_docs' },
      { id: 'step-4', name: 'Architecture overview', description: 'Create architecture diagram', tool: 'generate_architecture_overview' },
    ],
  },
];
