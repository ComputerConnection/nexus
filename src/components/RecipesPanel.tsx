import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import {
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Play,
  Check,
  X,
  AlertCircle,
  Clock,
  Tag,
  FolderOpen,
  Loader2,
  RotateCcw,
  Copy,
  Filter,
} from 'lucide-react';
import {
  useRecipes,
  CATEGORY_CONFIG,
  type Recipe,
  type RecipeCategory,
  type RecipeParameter,
  type RecipeExecutionResult,
  type StepResult,
} from '../hooks/useRecipes';
import { useProjectStore } from '../stores/projectStore';
import {
  Button,
  Input,
  Card,
  Badge,
  Dropdown,
  DropdownItem,
  toast,
} from './ui';

// View states for the panel
type ViewState = 'list' | 'detail' | 'execution';

export function RecipesPanel() {
  const {
    recipes,
    selectedRecipe,
    executionResult,
    isLoading,
    isExecuting,
    error,
    categoryFilter,
    searchQuery,
    filteredRecipes,
    fetchRecipes,
    getRecipe,
    runRecipe,
    selectRecipe,
    clearExecutionResult,
    setCategoryFilter,
    setSearchQuery,
    getCategoryIcon,
    getCategoryColor,
    getCategoryLabel,
  } = useRecipes();

  const { projects, selectedProjectId } = useProjectStore();
  const selectedProject = selectedProjectId ? projects.get(selectedProjectId) : null;

  const [viewState, setViewState] = useState<ViewState>('list');
  const [parameterValues, setParameterValues] = useState<Record<string, unknown>>({});

  // Fetch recipes on mount
  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  // Auto-fill path parameters with selected project
  useEffect(() => {
    if (selectedRecipe && selectedProject) {
      const newValues = { ...parameterValues };
      selectedRecipe.parameters.forEach((param) => {
        if (param.type === 'path' && !parameterValues[param.name]) {
          newValues[param.name] = selectedProject.workingDirectory;
        }
      });
      setParameterValues(newValues);
    }
  }, [selectedRecipe, selectedProject]);

  // Handle recipe selection
  const handleSelectRecipe = async (recipe: Recipe) => {
    await getRecipe(recipe.id);
    setParameterValues({});
    setViewState('detail');
  };

  // Handle run recipe
  const handleRunRecipe = async () => {
    if (!selectedRecipe) return;

    // Validate required parameters
    const missingParams = selectedRecipe.parameters
      .filter((p) => p.required && !parameterValues[p.name])
      .map((p) => p.name);

    if (missingParams.length > 0) {
      toast.error(`Missing required parameters: ${missingParams.join(', ')}`);
      return;
    }

    setViewState('execution');
    const result = await runRecipe(selectedRecipe.id, parameterValues);
    if (result) {
      if (result.success) {
        toast.success(`Recipe "${selectedRecipe.name}" completed successfully`);
      } else {
        toast.error(`Recipe "${selectedRecipe.name}" failed`);
      }
    }
  };

  // Handle back navigation
  const handleBack = () => {
    if (viewState === 'execution') {
      clearExecutionResult();
      setViewState('detail');
    } else if (viewState === 'detail') {
      selectRecipe(null);
      setParameterValues({});
      setViewState('list');
    }
  };

  // Handle run again
  const handleRunAgain = () => {
    clearExecutionResult();
    handleRunRecipe();
  };

  if (error && !isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center p-8">
          <AlertCircle size={48} className="mx-auto mb-4 text-red-400" />
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
            Failed to Load Recipes
          </h2>
          <p className="text-[var(--text-secondary)] mb-4">{error}</p>
          <Button variant="primary" onClick={fetchRecipes}>
            <RefreshCw size={16} className="mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-[var(--bg-primary)] via-[var(--bg-primary)] to-[var(--bg-secondary)]">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between p-6 border-b border-[var(--glass-border)]"
      >
        <div className="flex items-center gap-4">
          {viewState !== 'list' && (
            <Button variant="ghost" size="sm" onClick={handleBack}>
              <ChevronLeft size={20} />
            </Button>
          )}
          <div className="flex items-center gap-4">
            <motion.div
              className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/25"
              whileHover={{ scale: 1.05, rotate: 5 }}
              transition={{ type: 'spring', stiffness: 400 }}
            >
              <span className="text-2xl">📜</span>
            </motion.div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">
                {viewState === 'list'
                  ? 'Recipes'
                  : viewState === 'detail'
                  ? selectedRecipe?.name || 'Recipe'
                  : 'Execution'}
              </h1>
              <p className="text-sm text-[var(--text-secondary)]">
                {viewState === 'list'
                  ? 'Browse and run automated workflows'
                  : viewState === 'detail'
                  ? selectedRecipe?.description || ''
                  : isExecuting
                  ? 'Running recipe...'
                  : executionResult?.success
                  ? 'Recipe completed'
                  : 'Recipe failed'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {selectedProject && (
            <div className="flex items-center gap-2 px-3 py-2 bg-[var(--glass-bg)] rounded-lg border border-[var(--glass-border)]">
              <FolderOpen size={16} className="text-[var(--neon-cyan)]" />
              <span className="text-sm text-[var(--text-secondary)]">
                {selectedProject.name}
              </span>
            </div>
          )}
          {viewState === 'list' && (
            <>
              <div className="w-64">
                <Input
                  placeholder="Search recipes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  icon={<Search size={16} />}
                  inputSize="md"
                />
              </div>
              <CategoryFilterDropdown
                value={categoryFilter}
                onChange={setCategoryFilter}
                getCategoryIcon={getCategoryIcon}
                getCategoryLabel={getCategoryLabel}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchRecipes}
                disabled={isLoading}
              >
                <RefreshCw
                  size={16}
                  className={clsx(isLoading && 'animate-spin')}
                />
              </Button>
            </>
          )}
        </div>
      </motion.div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <AnimatePresence mode="wait">
          {viewState === 'list' && (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <RecipeCardSkeleton key={i} />
                  ))}
                </div>
              ) : filteredRecipes.length === 0 ? (
                <EmptyState
                  hasRecipes={recipes.length > 0}
                  searchQuery={searchQuery}
                  onClearFilters={() => {
                    setSearchQuery('');
                    setCategoryFilter('all');
                  }}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredRecipes.map((recipe, index) => (
                    <motion.div
                      key={recipe.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                    >
                      <RecipeCard
                        recipe={recipe}
                        onClick={() => handleSelectRecipe(recipe)}
                        getCategoryIcon={getCategoryIcon}
                        getCategoryColor={getCategoryColor}
                      />
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {viewState === 'detail' && selectedRecipe && (
            <motion.div
              key="detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <RecipeDetailView
                recipe={selectedRecipe}
                parameterValues={parameterValues}
                onParameterChange={(name, value) =>
                  setParameterValues((prev) => ({ ...prev, [name]: value }))
                }
                onRun={handleRunRecipe}
                isExecuting={isExecuting}
                getCategoryIcon={getCategoryIcon}
                getCategoryColor={getCategoryColor}
              />
            </motion.div>
          )}

          {viewState === 'execution' && (
            <motion.div
              key="execution"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <RecipeExecutionView
                recipe={selectedRecipe}
                result={executionResult}
                isExecuting={isExecuting}
                onRunAgain={handleRunAgain}
                onBack={handleBack}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Category Filter Dropdown
interface CategoryFilterDropdownProps {
  value: RecipeCategory | 'all';
  onChange: (value: RecipeCategory | 'all') => void;
  getCategoryIcon: (category: RecipeCategory) => string;
  getCategoryLabel: (category: RecipeCategory) => string;
}

function CategoryFilterDropdown({
  value,
  onChange,
  getCategoryIcon,
  getCategoryLabel,
}: CategoryFilterDropdownProps) {
  const categories = Object.keys(CATEGORY_CONFIG) as RecipeCategory[];

  return (
    <Dropdown
      trigger={
        <Button variant="ghost" size="sm">
          <Filter size={16} className="mr-2" />
          {value === 'all' ? 'All Categories' : getCategoryLabel(value)}
          <ChevronDown size={14} className="ml-2" />
        </Button>
      }
    >
      <DropdownItem onSelect={() => onChange('all')}>
        <span className="mr-2">📋</span>
        All Categories
      </DropdownItem>
      {categories.map((category) => (
        <DropdownItem key={category} onSelect={() => onChange(category)}>
          <span className="mr-2">{getCategoryIcon(category)}</span>
          {getCategoryLabel(category)}
        </DropdownItem>
      ))}
    </Dropdown>
  );
}

// Recipe Card Component
interface RecipeCardProps {
  recipe: Recipe;
  onClick: () => void;
  getCategoryIcon: (category: RecipeCategory) => string;
  getCategoryColor: (category: RecipeCategory) => string;
}

function RecipeCard({
  recipe,
  onClick,
  getCategoryIcon,
  getCategoryColor,
}: RecipeCardProps) {
  const colorClass = getCategoryColor(recipe.category);
  const colorMap: Record<string, string> = {
    red: 'from-red-500/20 to-red-600/20 border-red-500/30',
    blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/30',
    yellow: 'from-yellow-500/20 to-yellow-600/20 border-yellow-500/30',
    green: 'from-green-500/20 to-green-600/20 border-green-500/30',
    purple: 'from-purple-500/20 to-purple-600/20 border-purple-500/30',
    cyan: 'from-cyan-500/20 to-cyan-600/20 border-cyan-500/30',
    orange: 'from-orange-500/20 to-orange-600/20 border-orange-500/30',
    gray: 'from-gray-500/20 to-gray-600/20 border-gray-500/30',
  };

  return (
    <motion.div whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 400 }}>
      <Card
        interactive
        className="group h-full cursor-pointer"
        onClick={onClick}
      >
        <div className="flex items-start justify-between mb-3">
          <div
            className={clsx(
              'w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center border',
              colorMap[colorClass] || colorMap.gray
            )}
          >
            <span className="text-2xl">{getCategoryIcon(recipe.category)}</span>
          </div>
          <Badge variant="default" size="sm">
            {recipe.steps?.length || 0} steps
          </Badge>
        </div>

        <h3 className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--neon-cyan)] transition-colors mb-2">
          {recipe.name}
        </h3>

        <p className="text-sm text-[var(--text-secondary)] line-clamp-2 mb-3">
          {recipe.description}
        </p>

        <div className="flex flex-wrap gap-1.5">
          {recipe.tags?.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-full bg-[var(--glass-bg)] text-[var(--text-tertiary)] text-xs"
            >
              {tag}
            </span>
          ))}
          {recipe.tags && recipe.tags.length > 3 && (
            <span className="px-2 py-0.5 rounded-full bg-[var(--glass-bg)] text-[var(--text-tertiary)] text-xs">
              +{recipe.tags.length - 3}
            </span>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-[var(--glass-border)] flex items-center justify-between">
          <span className="text-xs text-[var(--text-tertiary)] flex items-center gap-1">
            <Tag size={12} />
            {recipe.category}
          </span>
          <ChevronRight
            size={16}
            className="text-[var(--text-tertiary)] group-hover:text-[var(--neon-cyan)] transition-colors"
          />
        </div>
      </Card>
    </motion.div>
  );
}

// Recipe Card Skeleton
function RecipeCardSkeleton() {
  return (
    <Card className="animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="w-12 h-12 rounded-xl bg-[var(--glass-bg)]" />
        <div className="w-16 h-5 rounded bg-[var(--glass-bg)]" />
      </div>
      <div className="h-5 w-3/4 rounded bg-[var(--glass-bg)] mb-2" />
      <div className="h-4 w-full rounded bg-[var(--glass-bg)] mb-1" />
      <div className="h-4 w-2/3 rounded bg-[var(--glass-bg)] mb-3" />
      <div className="flex gap-1.5">
        <div className="h-5 w-12 rounded-full bg-[var(--glass-bg)]" />
        <div className="h-5 w-16 rounded-full bg-[var(--glass-bg)]" />
      </div>
    </Card>
  );
}

// Recipe Detail View
interface RecipeDetailViewProps {
  recipe: Recipe;
  parameterValues: Record<string, unknown>;
  onParameterChange: (name: string, value: unknown) => void;
  onRun: () => void;
  isExecuting: boolean;
  getCategoryIcon: (category: RecipeCategory) => string;
  getCategoryColor: (category: RecipeCategory) => string;
}

function RecipeDetailView({
  recipe,
  parameterValues,
  onParameterChange,
  onRun,
  isExecuting,
  getCategoryIcon,
  getCategoryColor,
}: RecipeDetailViewProps) {
  const colorClass = getCategoryColor(recipe.category);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Recipe Info */}
      <Card>
        <div className="flex items-start gap-4 mb-4">
          <div
            className={clsx(
              'w-16 h-16 rounded-xl bg-gradient-to-br flex items-center justify-center border',
              `from-${colorClass}-500/20 to-${colorClass}-600/20 border-${colorClass}-500/30`
            )}
          >
            <span className="text-3xl">{getCategoryIcon(recipe.category)}</span>
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-1">
              {recipe.name}
            </h2>
            <p className="text-[var(--text-secondary)]">{recipe.description}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <Badge variant="purple">
            <Tag size={12} className="mr-1" />
            {recipe.category}
          </Badge>
          {recipe.tags?.map((tag) => (
            <Badge key={tag} variant="default">
              {tag}
            </Badge>
          ))}
        </div>

        {/* Steps Preview */}
        {recipe.steps && recipe.steps.length > 0 && (
          <div className="pt-4 border-t border-[var(--glass-border)]">
            <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
              Steps ({recipe.steps.length})
            </h3>
            <div className="space-y-2">
              {recipe.steps.map((step, index) => (
                <div
                  key={step.id}
                  className="flex items-center gap-3 text-sm"
                >
                  <span className="w-6 h-6 rounded-full bg-[var(--glass-bg)] flex items-center justify-center text-xs text-[var(--text-tertiary)]">
                    {index + 1}
                  </span>
                  <span className="text-[var(--text-primary)]">{step.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Parameters Form */}
      {recipe.parameters && recipe.parameters.length > 0 && (
        <Card>
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            Parameters
          </h3>
          <div className="space-y-4">
            {recipe.parameters.map((param) => (
              <ParameterInput
                key={param.name}
                parameter={param}
                value={parameterValues[param.name]}
                onChange={(value) => onParameterChange(param.name, value)}
              />
            ))}
          </div>
        </Card>
      )}

      {/* Run Button */}
      <div className="flex justify-end">
        <Button
          variant="primary"
          size="lg"
          onClick={onRun}
          disabled={isExecuting}
          glow
        >
          {isExecuting ? (
            <>
              <Loader2 size={18} className="mr-2 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play size={18} className="mr-2" />
              Run Recipe
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// Parameter Input Component
interface ParameterInputProps {
  parameter: RecipeParameter;
  value: unknown;
  onChange: (value: unknown) => void;
}

function ParameterInput({ parameter, value, onChange }: ParameterInputProps) {
  const { name, description, type, required, default: defaultValue } = parameter;

  const handleChange = (newValue: unknown) => {
    onChange(newValue);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
        {name}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {description && (
        <p className="text-xs text-[var(--text-tertiary)] mb-2">{description}</p>
      )}

      {type === 'boolean' ? (
        <button
          onClick={() => handleChange(!(value ?? defaultValue ?? false))}
          className={clsx(
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
            value ?? defaultValue
              ? 'bg-[var(--neon-cyan)]'
              : 'bg-[var(--glass-bg)]'
          )}
        >
          <span
            className={clsx(
              'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
              value ?? defaultValue ? 'translate-x-6' : 'translate-x-1'
            )}
          />
        </button>
      ) : type === 'number' ? (
        <Input
          type="number"
          value={String(value ?? defaultValue ?? '')}
          onChange={(e) => handleChange(Number(e.target.value))}
          placeholder={defaultValue !== undefined ? String(defaultValue) : 'Enter a number'}
        />
      ) : (
        <Input
          type="text"
          value={String(value ?? defaultValue ?? '')}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={
            type === 'path'
              ? '/path/to/directory'
              : defaultValue !== undefined
              ? String(defaultValue)
              : 'Enter value'
          }
          icon={type === 'path' ? <FolderOpen size={16} /> : undefined}
        />
      )}
    </div>
  );
}

// Recipe Execution View
interface RecipeExecutionViewProps {
  recipe: Recipe | null;
  result: RecipeExecutionResult | null;
  isExecuting: boolean;
  onRunAgain: () => void;
  onBack: () => void;
}

function RecipeExecutionView({
  recipe,
  result,
  isExecuting,
  onRunAgain,
  onBack,
}: RecipeExecutionViewProps) {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Progress Indicator */}
      {isExecuting && (
        <Card>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <Loader2 size={48} className="mx-auto mb-4 text-[var(--neon-cyan)] animate-spin" />
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                Running {recipe?.name}...
              </h3>
              <p className="text-[var(--text-secondary)]">
                Please wait while the recipe executes
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Summary Card */}
          <Card
            className={clsx(
              'border-l-4',
              result.success ? 'border-l-green-500' : 'border-l-red-500'
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                {result.success ? (
                  <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Check size={24} className="text-green-400" />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                    <X size={24} className="text-red-400" />
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                    {result.success ? 'Recipe Completed' : 'Recipe Failed'}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {result.summary}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
                <Clock size={14} />
                {formatDuration(result.total_duration_ms)}
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-6 mt-4 pt-4 border-t border-[var(--glass-border)]">
              <div>
                <span className="text-2xl font-bold text-green-400">
                  {result.steps.filter((s) => s.status === 'success').length}
                </span>
                <span className="text-sm text-[var(--text-secondary)] ml-1">succeeded</span>
              </div>
              <div>
                <span className="text-2xl font-bold text-red-400">
                  {result.steps.filter((s) => s.status === 'failed').length}
                </span>
                <span className="text-sm text-[var(--text-secondary)] ml-1">failed</span>
              </div>
              <div>
                <span className="text-2xl font-bold text-[var(--text-tertiary)]">
                  {result.steps.filter((s) => s.status === 'skipped').length}
                </span>
                <span className="text-sm text-[var(--text-secondary)] ml-1">skipped</span>
              </div>
            </div>
          </Card>

          {/* Step Results */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-[var(--text-secondary)]">
              Step Results
            </h3>
            {result.steps.map((step, index) => (
              <StepResultCard key={step.step_id} step={step} index={index} />
            ))}
          </div>

          {/* Actions */}
          <div className="flex justify-between">
            <Button variant="ghost" onClick={onBack}>
              <ChevronLeft size={16} className="mr-2" />
              Back to Details
            </Button>
            <Button variant="primary" onClick={onRunAgain}>
              <RotateCcw size={16} className="mr-2" />
              Run Again
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// Step Result Card
interface StepResultCardProps {
  step: StepResult;
  index: number;
}

function StepResultCard({ step, index }: StepResultCardProps) {
  const [isExpanded, setIsExpanded] = useState(step.status === 'failed');
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const content = step.error || JSON.stringify(step.output, null, 2);
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusConfig = {
    success: {
      icon: Check,
      color: 'text-green-400',
      bg: 'bg-green-500/20',
    },
    failed: {
      icon: X,
      color: 'text-red-400',
      bg: 'bg-red-500/20',
    },
    skipped: {
      icon: AlertCircle,
      color: 'text-[var(--text-tertiary)]',
      bg: 'bg-[var(--glass-bg)]',
    },
  };

  const config = statusConfig[step.status];
  const StatusIcon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card
        className={clsx(
          'cursor-pointer transition-colors',
          isExpanded && 'border-[var(--neon-cyan)]/30'
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center', config.bg)}>
            <StatusIcon size={16} className={config.color} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-tertiary)]">#{index + 1}</span>
              <span className="font-medium text-[var(--text-primary)]">
                {step.step_name}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm text-[var(--text-tertiary)]">
            <span>{formatDuration(step.duration_ms)}</span>
            <ChevronDown
              size={16}
              className={clsx(
                'transition-transform',
                isExpanded && 'rotate-180'
              )}
            />
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && (step.output || step.error) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 pt-4 border-t border-[var(--glass-border)]">
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy();
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded hover:bg-[var(--glass-bg)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                  >
                    {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                  </button>
                  <pre
                    className={clsx(
                      'p-3 rounded-lg text-xs font-mono overflow-x-auto max-h-48',
                      step.error
                        ? 'bg-red-500/10 text-red-400'
                        : 'bg-[var(--bg-primary)] text-[var(--text-secondary)]'
                    )}
                  >
                    {step.error || JSON.stringify(step.output, null, 2)}
                  </pre>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

// Empty State
interface EmptyStateProps {
  hasRecipes: boolean;
  searchQuery: string;
  onClearFilters: () => void;
}

function EmptyState({ hasRecipes, searchQuery, onClearFilters }: EmptyStateProps) {
  return (
    <div className="h-full flex items-center justify-center py-16">
      <div className="text-center max-w-md">
        {hasRecipes ? (
          <>
            <Search size={48} className="mx-auto mb-4 text-[var(--text-tertiary)]" />
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
              No matching recipes
            </h2>
            <p className="text-[var(--text-secondary)] mb-4">
              No recipes found for "{searchQuery}". Try a different search or filter.
            </p>
            <Button variant="secondary" onClick={onClearFilters}>
              Clear Filters
            </Button>
          </>
        ) : (
          <>
            <span className="text-6xl mb-4 block">📜</span>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
              No recipes available
            </h2>
            <p className="text-[var(--text-secondary)]">
              Connect to the localhost-infinity MCP server to access recipes.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// Helper function to format duration
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}
