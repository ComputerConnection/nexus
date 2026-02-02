import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import {
  FolderPlus,
  FolderKanban,
  Calendar,
  MoreVertical,
  Play,
  Trash2,
  Edit,
  ExternalLink,
  Search,
  Sparkles,
  GitBranch,
  Clock,
  CheckCircle2,
  PauseCircle,
  Zap,
  LayoutGrid,
  List,
  Activity,
  Folder,
  Plus,
  Eye,
  ChevronRight,
  ListTodo,
  Star,
  History,
} from 'lucide-react';
import {
  Card,
  Button,
  StatusBadge,
  Input,
  Dropdown,
  DropdownItem,
  DropdownSeparator,
  SkeletonCard,
  Tabs,
  TabsList,
  TabsTrigger,
  Modal,
  ModalContent,
  ModalFooter,
  toast,
} from '../components/ui';
import { useProjectStore } from '../stores/projectStore';
import { useAgentStore } from '../stores/agentStore';
import type { Project } from '../types';
import {
  PROJECT_TEMPLATES,
  TEMPLATE_CATEGORIES,
  type ProjectTemplate,
  type TemplateCategory,
  getFavoriteTemplates,
  toggleFavorite,
  getRecentTemplates,
  addRecentTemplate,
} from '../data/projectTemplates';
import { TemplateDetailModal } from '../components/TemplateDetailModal';
import { TemplateWizard } from '../components/TemplateWizard';

export function ProjectHub() {
  const navigate = useNavigate();
  const { projects, fetchProjects, createProject, deleteProject } = useProjectStore();
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'completed'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Create modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all');
  const [templateSearchQuery, setTemplateSearchQuery] = useState('');
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    workingDirectory: '',
  });
  const [isCreating, setIsCreating] = useState(false);

  // Template detail modal state
  const [detailTemplate, setDetailTemplate] = useState<ProjectTemplate | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Wizard state
  const [showWizard, setShowWizard] = useState(false);
  const [wizardTemplate, setWizardTemplate] = useState<ProjectTemplate | null>(null);

  // Favorites and recents
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recents, setRecents] = useState<string[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showRecents, setShowRecents] = useState(false);

  // Load favorites and recents on mount
  useEffect(() => {
    setFavorites(getFavoriteTemplates());
    setRecents(getRecentTemplates());
  }, []);

  useEffect(() => {
    const load = async () => {
      await fetchProjects();
      setIsLoading(false);
    };
    load();
  }, [fetchProjects]);

  const projectList = Array.from(projects.values());

  // Count projects by status
  const activeCount = projectList.filter(p => p.status?.toLowerCase() === 'active').length;
  const completedCount = projectList.filter(p => p.status?.toLowerCase() === 'completed').length;
  const pausedCount = projectList.filter(p => p.status?.toLowerCase() === 'paused').length;

  // Filter templates
  const filteredTemplates = PROJECT_TEMPLATES.filter(t => {
    const matchesSearch = templateSearchQuery === '' ||
      t.name.toLowerCase().includes(templateSearchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(templateSearchQuery.toLowerCase()) ||
      t.tags.some(tag => tag.toLowerCase().includes(templateSearchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || t.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleCreateProject = async () => {
    if (!newProject.name.trim()) {
      toast.error('Please enter a project name');
      return;
    }

    setIsCreating(true);
    try {
      // Create the project
      const project = await createProject({
        name: newProject.name,
        working_directory: newProject.workingDirectory || undefined,
        description: newProject.description || selectedTemplate?.description || 'A new NEXUS project',
      });

      // If a template is selected, spawn agents from it
      if (selectedTemplate) {
        await bootstrapProjectFromTemplate(project.id, project.workingDirectory, selectedTemplate);
      }

      toast.projectCreated(newProject.name);
      setIsCreateModalOpen(false);
      setNewProject({ name: '', description: '', workingDirectory: '' });
      setSelectedTemplate(null);

      // Select the project and navigate to dashboard
      useProjectStore.getState().selectProject(project.id);
      navigate('/');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      toast.error('Failed to create project', { description: errorMsg });
    } finally {
      setIsCreating(false);
    }
  };

  // Bootstrap a project with agents and tasks from a template
  const bootstrapProjectFromTemplate = async (
    projectId: string,
    workingDirectory: string,
    template: ProjectTemplate
  ) => {
    const { spawnAgent } = useAgentStore.getState();

    // Sort agents by priority and spawn them
    const sortedAgents = [...template.recommendedAgents].sort((a, b) => a.priority - b.priority);

    for (const agentDef of sortedAgents) {
      try {
        // Find the first task for this agent's role
        const firstTask = template.setupTasks.find(
          t => t.agentRole === agentDef.role && (!t.dependencies || t.dependencies.length === 0)
        );

        await spawnAgent({
          name: agentDef.name,
          role: agentDef.role,
          workingDirectory,
          projectId,
          systemPrompt: agentDef.systemPrompt,
          assignedTask: firstTask ? `${firstTask.title}: ${firstTask.description}` : undefined,
        });

        toast.info(`Spawned agent: ${agentDef.name}`);
      } catch (error) {
        console.error(`Failed to spawn agent ${agentDef.name}:`, error);
      }
    }

    toast.success(`Project initialized with ${sortedAgents.length} agents from ${template.name} template`);
  };

  const handleUseTemplate = (template: ProjectTemplate) => {
    setSelectedTemplate(template);
    setNewProject({
      ...newProject,
      name: newProject.name || template.name.toLowerCase().replace(/\s+/g, '-'),
      description: template.description,
    });
    setIsDetailModalOpen(false);
    // Track as recent
    addRecentTemplate(template.id);
    setRecents(getRecentTemplates());
  };

  const handleConfigureTemplate = (template: ProjectTemplate) => {
    setWizardTemplate(template);
    setShowWizard(true);
    setIsCreateModalOpen(false);
    addRecentTemplate(template.id);
    setRecents(getRecentTemplates());
  };

  const handleWizardComplete = async (config: Record<string, unknown>) => {
    if (!wizardTemplate) return;

    const projectName = (config.projectName as string) || wizardTemplate.name.toLowerCase().replace(/\s+/g, '-');

    setIsCreating(true);
    try {
      const project = await createProject({
        name: projectName,
        working_directory: (config.workingDirectory as string) || undefined,
        description: (config.description as string) || wizardTemplate.description,
      });

      // Bootstrap agents from template
      await bootstrapProjectFromTemplate(project.id, project.workingDirectory, wizardTemplate);

      toast.projectCreated(projectName);
      setShowWizard(false);
      setWizardTemplate(null);

      // Select the project and navigate to dashboard
      useProjectStore.getState().selectProject(project.id);
      navigate('/');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      toast.error('Failed to create project', { description: errorMsg });
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleFavorite = (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(templateId);
    setFavorites(getFavoriteTemplates());
  };

  const handleQuickCreate = async (template: ProjectTemplate) => {
    const projectName = template.name.toLowerCase().replace(/\s+/g, '-');
    addRecentTemplate(template.id);
    setRecents(getRecentTemplates());

    setIsCreating(true);
    try {
      const project = await createProject({
        name: projectName,
        description: template.description,
      });

      // Bootstrap agents from template
      await bootstrapProjectFromTemplate(project.id, project.workingDirectory, template);

      toast.projectCreated(projectName);
      setIsCreateModalOpen(false);

      // Select the project and navigate to dashboard
      useProjectStore.getState().selectProject(project.id);
      navigate('/');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      toast.error('Failed to create project', { description: errorMsg });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteProject = async (projectId: string, projectName: string) => {
    if (!confirm(`Delete project "${projectName}"? This cannot be undone.`)) return;
    try {
      await deleteProject(projectId);
      toast.info(`Project "${projectName}" deleted`);
    } catch {
      toast.error('Failed to delete project');
    }
  };

  const handleLaunchProject = (projectId: string, projectName: string) => {
    useProjectStore.getState().selectProject(projectId);
    navigate('/');
    toast.success(`Selected project: ${projectName}`);
  };

  const handleEditProject = async (projectId: string, currentName: string) => {
    const newName = prompt('Project name:', currentName);
    if (newName && newName !== currentName) {
      try {
        await useProjectStore.getState().updateProject(projectId, { name: newName });
        toast.success('Project updated');
      } catch {
        toast.error('Failed to update project');
      }
    }
  };

  const handleOpenDirectory = async (directory: string) => {
    try {
      await invoke('plugin:shell|open', { path: directory });
    } catch {
      toast.error('Failed to open directory');
    }
  };

  // Filter by tab and search query
  const filteredProjects = projectList.filter((project) => {
    const matchesSearch =
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const status = project.status?.toLowerCase() || 'active';

    if (!matchesSearch) return false;

    switch (activeTab) {
      case 'active':
        return status === 'active' || status === 'running';
      case 'completed':
        return status === 'completed';
      default:
        return true;
    }
  });

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-[var(--bg-primary)] via-[var(--bg-primary)] to-[var(--bg-secondary)]">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between p-6 border-b border-[var(--glass-border)]"
      >
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
            <motion.div
              className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/25"
              whileHover={{ scale: 1.05, rotate: 5 }}
              transition={{ type: 'spring', stiffness: 400 }}
            >
              <FolderKanban size={28} className="text-white" />
            </motion.div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">
                Project Hub
              </h1>
              <p className="text-sm text-[var(--text-secondary)]">
                Manage and orchestrate your projects
              </p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="hidden lg:flex items-center gap-4 ml-8 pl-8 border-l border-[var(--glass-border)]">
            <StatBadge icon={Activity} value={activeCount} label="Active" color="cyan" />
            <StatBadge icon={CheckCircle2} value={completedCount} label="Completed" color="green" />
            <StatBadge icon={PauseCircle} value={pausedCount} label="Paused" color="yellow" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-72">
            <Input
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<Search size={16} />}
              inputSize="md"
            />
          </div>
          <div className="flex items-center gap-1 p-1 bg-[var(--glass-bg)] rounded-lg border border-[var(--glass-border)]">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid size={16} />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List size={16} />
            </Button>
          </div>
          <Button
            variant="primary"
            size="md"
            icon={<Plus size={18} />}
            onClick={() => setIsCreateModalOpen(true)}
            glow
          >
            New Project
          </Button>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="px-6 pt-4">
        <Tabs defaultValue="all" onChange={(v: string) => setActiveTab(v as typeof activeTab)}>
          <TabsList>
            <TabsTrigger value="all">
              <Folder size={14} className="mr-2" />
              All Projects
              <span className="ml-2 px-2 py-0.5 rounded-full bg-[var(--glass-bg)] text-xs">
                {projectList.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="active">
              <Zap size={14} className="mr-2" />
              Active
              <span className="ml-2 px-2 py-0.5 rounded-full bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)] text-xs">
                {activeCount}
              </span>
            </TabsTrigger>
            <TabsTrigger value="completed">
              <CheckCircle2 size={14} className="mr-2" />
              Completed
              <span className="ml-2 px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs">
                {completedCount}
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className={viewMode === 'grid'
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            : "flex flex-col gap-3"
          }>
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <EmptyState
            hasProjects={projectList.length > 0}
            onCreate={() => setIsCreateModalOpen(true)}
            searchQuery={searchQuery}
          />
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={viewMode === 'grid'
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
              : "flex flex-col gap-3"
            }
          >
            {filteredProjects.map((project, index) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                {viewMode === 'grid' ? (
                  <ProjectCard
                    project={project}
                    onDelete={() => handleDeleteProject(project.id, project.name)}
                    onLaunch={() => handleLaunchProject(project.id, project.name)}
                    onEdit={() => handleEditProject(project.id, project.name)}
                    onOpenDirectory={() => handleOpenDirectory(project.workingDirectory)}
                  />
                ) : (
                  <ProjectListItem
                    project={project}
                    onDelete={() => handleDeleteProject(project.id, project.name)}
                    onLaunch={() => handleLaunchProject(project.id, project.name)}
                    onEdit={() => handleEditProject(project.id, project.name)}
                    onOpenDirectory={() => handleOpenDirectory(project.workingDirectory)}
                  />
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Create Project Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setSelectedTemplate(null);
          setNewProject({ name: '', description: '', workingDirectory: '' });
          setSelectedCategory('all');
          setTemplateSearchQuery('');
        }}
        title="Create New Project"
        description="Start with a template or create from scratch"
        size="xl"
      >
        <ModalContent className="max-h-[60vh] overflow-y-auto">
          {/* Template Selection */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <label className="text-sm font-medium text-[var(--text-secondary)]">
                Choose a template
              </label>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Search templates..."
                  value={templateSearchQuery}
                  onChange={(e) => setTemplateSearchQuery(e.target.value)}
                  icon={<Search size={14} />}
                  inputSize="sm"
                  className="w-48"
                />
              </div>
            </div>

            {/* Quick Filters: Favorites & Recent */}
            {(favorites.length > 0 || recents.length > 0) && (
              <div className="flex gap-2 mb-3">
                {favorites.length > 0 && (
                  <button
                    onClick={() => { setShowFavorites(!showFavorites); setShowRecents(false); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      showFavorites
                        ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                        : 'bg-[var(--glass-bg)] text-[var(--text-secondary)] border border-[var(--glass-border)] hover:border-yellow-500/30'
                    }`}
                  >
                    <Star size={12} fill={showFavorites ? 'currentColor' : 'none'} />
                    Favorites ({favorites.length})
                  </button>
                )}
                {recents.length > 0 && (
                  <button
                    onClick={() => { setShowRecents(!showRecents); setShowFavorites(false); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      showRecents
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : 'bg-[var(--glass-bg)] text-[var(--text-secondary)] border border-[var(--glass-border)] hover:border-purple-500/30'
                    }`}
                  >
                    <History size={12} />
                    Recent ({recents.length})
                  </button>
                )}
              </div>
            )}

            {/* Category Filter */}
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => { setSelectedCategory('all'); setShowFavorites(false); setShowRecents(false); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedCategory === 'all' && !showFavorites && !showRecents
                    ? 'bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)] border border-[var(--neon-cyan)]/30'
                    : 'bg-[var(--glass-bg)] text-[var(--text-secondary)] border border-[var(--glass-border)] hover:border-[var(--text-tertiary)]'
                }`}
              >
                All Templates
              </button>
              {Object.entries(TEMPLATE_CATEGORIES).map(([key, cat]) => (
                <button
                  key={key}
                  onClick={() => { setSelectedCategory(key as TemplateCategory); setShowFavorites(false); setShowRecents(false); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selectedCategory === key && !showFavorites && !showRecents
                      ? 'bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)] border border-[var(--neon-cyan)]/30'
                      : 'bg-[var(--glass-bg)] text-[var(--text-secondary)] border border-[var(--glass-border)] hover:border-[var(--text-tertiary)]'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Template Grid */}
            <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-2">
              {(showFavorites
                ? PROJECT_TEMPLATES.filter(t => favorites.includes(t.id))
                : showRecents
                ? PROJECT_TEMPLATES.filter(t => recents.includes(t.id))
                : filteredTemplates
              ).map((template) => {
                const Icon = template.icon;
                const isSelected = selectedTemplate?.id === template.id;
                const isFav = favorites.includes(template.id);
                const hasOptions = template.optionGroups && template.optionGroups.length > 0;
                return (
                  <motion.div
                    key={template.id}
                    className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all group ${
                      isSelected
                        ? 'border-[var(--neon-cyan)] bg-[var(--neon-cyan)]/10'
                        : 'border-[var(--glass-border)] bg-[var(--glass-bg)] hover:border-[var(--text-tertiary)]'
                    }`}
                    whileHover={{ scale: 1.01 }}
                    onClick={() => setSelectedTemplate(isSelected ? null : template)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${template.color} flex items-center justify-center`}>
                        <Icon size={20} className="text-white" />
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => handleToggleFavorite(template.id, e)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isFav
                              ? 'text-yellow-400 hover:bg-yellow-400/10'
                              : 'text-[var(--text-tertiary)] hover:text-yellow-400 hover:bg-[var(--glass-bg)] opacity-0 group-hover:opacity-100'
                          }`}
                          title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          <Star size={14} fill={isFav ? 'currentColor' : 'none'} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailTemplate(template);
                            setIsDetailModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg hover:bg-[var(--glass-bg)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                          title="View details"
                        >
                          <Eye size={14} />
                        </button>
                      </div>
                    </div>
                    <h4 className="font-medium text-[var(--text-primary)] mb-1">{template.name}</h4>
                    <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mb-2">
                      {template.description}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {template.estimatedSetupTime}
                      </span>
                      <span className="flex items-center gap-1">
                        <ListTodo size={10} />
                        {template.setupTasks.length} tasks
                      </span>
                    </div>
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {template.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--text-tertiary)] text-[10px]"
                        >
                          {tag}
                        </span>
                      ))}
                      {template.tags.length > 3 && (
                        <span className="px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--text-tertiary)] text-[10px]">
                          +{template.tags.length - 3}
                        </span>
                      )}
                    </div>
                    {/* Quick action buttons */}
                    <div className="flex gap-2 mt-3 pt-3 border-t border-[var(--glass-border)] opacity-0 group-hover:opacity-100 transition-opacity">
                      {template.quickCreate?.enabled && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuickCreate(template);
                          }}
                        >
                          <Zap size={12} className="mr-1" />
                          Quick
                        </Button>
                      )}
                      {hasOptions && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleConfigureTemplate(template);
                          }}
                        >
                          <Sparkles size={12} className="mr-1" />
                          Configure
                        </Button>
                      )}
                    </div>
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-2 right-20 w-5 h-5 rounded-full bg-[var(--neon-cyan)] flex items-center justify-center"
                      >
                        <CheckCircle2 size={12} className="text-black" />
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Selected Template Info */}
            {selectedTemplate && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-4 rounded-xl bg-[var(--neon-cyan)]/5 border border-[var(--neon-cyan)]/20"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${selectedTemplate.color} flex items-center justify-center`}>
                      <selectedTemplate.icon size={16} className="text-white" />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-[var(--text-primary)]">
                        Selected: {selectedTemplate.name}
                      </span>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {selectedTemplate.setupTasks.length} setup tasks • {selectedTemplate.recommendedAgents.length} agents
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDetailTemplate(selectedTemplate);
                      setIsDetailModalOpen(true);
                    }}
                  >
                    View Details
                    <ChevronRight size={14} className="ml-1" />
                  </Button>
                </div>
              </motion.div>
            )}
          </div>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--glass-border)]" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 bg-[var(--bg-primary)] text-xs text-[var(--text-tertiary)]">
                Project Details
              </span>
            </div>
          </div>

          {/* Project Details Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                Project Name <span className="text-red-400">*</span>
              </label>
              <Input
                placeholder="my-awesome-project"
                value={newProject.name}
                onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                icon={<FolderKanban size={16} />}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                Description
              </label>
              <Input
                placeholder="What is this project about?"
                value={newProject.description}
                onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                icon={<Edit size={16} />}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                Working Directory
                <span className="text-[var(--text-tertiary)] font-normal ml-2">
                  (optional)
                </span>
              </label>
              <Input
                placeholder="/home/user/projects/my-project"
                value={newProject.workingDirectory}
                onChange={(e) => setNewProject({ ...newProject, workingDirectory: e.target.value })}
                icon={<Folder size={16} />}
              />
              <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                Leave empty to auto-create in ~/nexus-projects/
              </p>
            </div>
          </div>
        </ModalContent>

        <ModalFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setIsCreateModalOpen(false);
              setSelectedTemplate(null);
              setNewProject({ name: '', description: '', workingDirectory: '' });
            }}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreateProject}
            disabled={!newProject.name.trim() || isCreating}
            icon={isCreating ? undefined : <Sparkles size={16} />}
            glow
          >
            {isCreating ? 'Creating...' : 'Create Project'}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Template Wizard Modal */}
      {showWizard && wizardTemplate && (
        <Modal
          isOpen={showWizard}
          onClose={() => {
            setShowWizard(false);
            setWizardTemplate(null);
          }}
          size="lg"
          showCloseButton={false}
        >
          <TemplateWizard
            template={wizardTemplate}
            onComplete={handleWizardComplete}
            onCancel={() => {
              setShowWizard(false);
              setWizardTemplate(null);
            }}
          />
        </Modal>
      )}

      {/* Template Detail Modal */}
      {detailTemplate && (
        <TemplateDetailModal
          template={detailTemplate}
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setDetailTemplate(null);
          }}
          onUseTemplate={handleUseTemplate}
        />
      )}
    </div>
  );
}

// Stat Badge Component
function StatBadge({
  icon: Icon,
  value,
  label,
  color
}: {
  icon: React.ElementType;
  value: number;
  label: string;
  color: 'cyan' | 'green' | 'yellow' | 'red';
}) {
  const colorClasses = {
    cyan: 'text-[var(--neon-cyan)] bg-[var(--neon-cyan)]/10',
    green: 'text-green-400 bg-green-400/10',
    yellow: 'text-yellow-400 bg-yellow-400/10',
    red: 'text-red-400 bg-red-400/10',
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
        <Icon size={16} />
      </div>
      <div>
        <p className="text-lg font-semibold text-[var(--text-primary)]">{value}</p>
        <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
      </div>
    </div>
  );
}

// Project Card Component
interface ProjectCardProps {
  project: Project;
  onDelete: () => void;
  onLaunch: () => void;
  onEdit: () => void;
  onOpenDirectory: () => void;
}

function ProjectCard({ project, onDelete, onLaunch, onEdit, onOpenDirectory }: ProjectCardProps) {
  const getStatusConfig = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'running':
        return { variant: 'running' as const, icon: Zap, color: 'cyan' };
      case 'completed':
        return { variant: 'completed' as const, icon: CheckCircle2, color: 'green' };
      case 'paused':
        return { variant: 'idle' as const, icon: PauseCircle, color: 'yellow' };
      default:
        return { variant: 'idle' as const, icon: Clock, color: 'gray' };
    }
  };

  const statusConfig = getStatusConfig(project.status);
  const StatusIcon = statusConfig.icon;

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 400 }}
    >
      <Card interactive className="group h-full">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <motion.div
              className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30 flex items-center justify-center"
              whileHover={{ rotate: 10 }}
            >
              <FolderKanban size={24} className="text-orange-400" />
            </motion.div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--neon-cyan)] transition-colors truncate">
                {project.name}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <StatusIcon size={12} className={`text-${statusConfig.color}-400`} />
                <span className="text-xs text-[var(--text-secondary)] capitalize">
                  {project.status || 'Active'}
                </span>
              </div>
            </div>
          </div>
          <Dropdown
            trigger={
              <Button
                variant="ghost"
                size="sm"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical size={16} />
              </Button>
            }
          >
            <DropdownItem icon={<Play size={14} />} onSelect={onLaunch}>
              Launch Project
            </DropdownItem>
            <DropdownItem icon={<Edit size={14} />} onSelect={onEdit}>
              Edit Details
            </DropdownItem>
            <DropdownItem icon={<ExternalLink size={14} />} onSelect={onOpenDirectory}>
              Open in Explorer
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem icon={<Trash2 size={14} />} danger onSelect={onDelete}>
              Delete Project
            </DropdownItem>
          </Dropdown>
        </div>

        {project.description && (
          <p className="text-sm text-[var(--text-secondary)] mb-4 line-clamp-2">
            {project.description}
          </p>
        )}

        <div className="flex items-center gap-4 text-xs text-[var(--text-tertiary)] mb-4">
          <div className="flex items-center gap-1.5">
            <Calendar size={12} />
            <span>{new Date(project.createdAt).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <GitBranch size={12} />
            <span>main</span>
          </div>
        </div>

        <div className="pt-4 border-t border-[var(--glass-border)] flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            icon={<Play size={14} />}
            onClick={onLaunch}
          >
            Launch
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<ExternalLink size={14} />}
            onClick={onOpenDirectory}
          />
        </div>
      </Card>
    </motion.div>
  );
}

// Project List Item Component
function ProjectListItem({ project, onDelete, onLaunch, onEdit, onOpenDirectory }: ProjectCardProps) {
  return (
    <motion.div
      whileHover={{ x: 4 }}
      className="flex items-center gap-4 p-4 bg-[var(--glass-bg)] rounded-xl border border-[var(--glass-border)] hover:border-[var(--neon-cyan)]/30 transition-all group"
    >
      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
        <FolderKanban size={20} className="text-orange-400" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <h3 className="font-medium text-[var(--text-primary)] group-hover:text-[var(--neon-cyan)] transition-colors">
            {project.name}
          </h3>
          <StatusBadge status={project.status === 'completed' ? 'completed' : 'running'} size="sm" />
        </div>
        <p className="text-sm text-[var(--text-secondary)] truncate mt-0.5">
          {project.description || project.workingDirectory}
        </p>
      </div>

      <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
        <Calendar size={12} />
        <span>{new Date(project.createdAt).toLocaleDateString()}</span>
      </div>

      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="primary" size="sm" icon={<Play size={14} />} onClick={onLaunch}>
          Launch
        </Button>
        <Dropdown
          trigger={
            <Button variant="ghost" size="sm">
              <MoreVertical size={16} />
            </Button>
          }
        >
          <DropdownItem icon={<Edit size={14} />} onSelect={onEdit}>
            Edit
          </DropdownItem>
          <DropdownItem icon={<ExternalLink size={14} />} onSelect={onOpenDirectory}>
            Open Directory
          </DropdownItem>
          <DropdownSeparator />
          <DropdownItem icon={<Trash2 size={14} />} danger onSelect={onDelete}>
            Delete
          </DropdownItem>
        </Dropdown>
      </div>
    </motion.div>
  );
}

// Empty State Component
function EmptyState({
  hasProjects,
  onCreate,
  searchQuery,
}: {
  hasProjects: boolean;
  onCreate: () => void;
  searchQuery: string;
}) {
  return (
    <div className="h-full flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-lg"
      >
        {hasProjects ? (
          <>
            <motion.div
              className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--glass-bg)] to-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center mx-auto mb-6"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatType: 'reverse' }}
            >
              <Search size={32} className="text-[var(--text-tertiary)]" />
            </motion.div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
              No matching projects
            </h2>
            <p className="text-[var(--text-secondary)]">
              No projects found for "{searchQuery}". Try a different search term.
            </p>
          </>
        ) : (
          <>
            <motion.div
              className="relative w-24 h-24 mx-auto mb-6"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 opacity-20 blur-xl" />
              <div className="relative w-full h-full rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30 flex items-center justify-center">
                <FolderPlus size={40} className="text-orange-400" />
              </div>
              <motion.div
                className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-[var(--neon-cyan)] flex items-center justify-center"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Sparkles size={16} className="text-black" />
              </motion.div>
            </motion.div>

            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-3">
              Create Your First Project
            </h2>
            <p className="text-[var(--text-secondary)] mb-8 max-w-md mx-auto">
              Start with one of our detailed templates or create a project from scratch.
              Templates include setup tasks, recommended agents, and best practices.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                variant="primary"
                size="lg"
                icon={<Sparkles size={18} />}
                onClick={onCreate}
                glow
              >
                Browse Templates
              </Button>
            </div>

            {/* Template Preview */}
            <div className="grid grid-cols-3 gap-4 mt-12 pt-8 border-t border-[var(--glass-border)]">
              {PROJECT_TEMPLATES.slice(0, 3).map((template, i) => {
                const Icon = template.icon;
                return (
                  <motion.div
                    key={template.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                    className="text-center cursor-pointer group"
                    onClick={onCreate}
                  >
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${template.color} flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform`}>
                      <Icon size={24} className="text-white" />
                    </div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{template.name}</p>
                    <p className="text-xs text-[var(--text-tertiary)]">{template.setupTasks.length} tasks</p>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
