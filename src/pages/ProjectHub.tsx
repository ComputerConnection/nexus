import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
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
} from 'lucide-react';
import {
  Card,
  Button,
  StatusBadge,
  ProgressBar,
  Input,
  Dropdown,
  DropdownItem,
  DropdownSeparator,
  SkeletonCard,
  Tabs,
  TabsList,
  TabsTrigger,
} from '../components/ui';
import { toast } from '../components/ui/Toast';
import { useProjectStore } from '../stores/projectStore';

export function ProjectHub() {
  const { projects, fetchProjects, createProject, deleteProject } = useProjectStore();
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const load = async () => {
      await fetchProjects();
      setIsLoading(false);
    };
    load();
  }, [fetchProjects]);

  const handleCreateProject = async () => {
    const name = prompt('Project name:');
    const directory = prompt('Working directory:');

    if (name && directory) {
      try {
        await createProject({
          name,
          working_directory: directory,
          description: 'A new NEXUS project',
        });
        toast.projectCreated(name);
      } catch (error) {
        toast.error('Failed to create project');
      }
    }
  };

  const handleDeleteProject = async (projectId: string, projectName: string) => {
    try {
      await deleteProject(projectId);
      toast.info(`Project "${projectName}" deleted`);
    } catch (error) {
      toast.error('Failed to delete project');
    }
  };

  const projectList = Array.from(projects.values());
  const filteredProjects = projectList.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between p-4 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl"
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
              <FolderKanban size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[var(--text-primary)]">
                Project Hub
              </h1>
              <p className="text-sm text-[var(--text-secondary)]">
                {projects.size} {projects.size === 1 ? 'project' : 'projects'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-64">
            <Input
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<Search size={16} />}
              inputSize="sm"
            />
          </div>
          <Button
            variant="primary"
            size="md"
            icon={<FolderPlus size={16} />}
            onClick={handleCreateProject}
          >
            New Project
          </Button>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="px-4 pt-4">
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All Projects</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <EmptyState
            hasProjects={projectList.length > 0}
            onCreate={handleCreateProject}
          />
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {filteredProjects.map((project, index) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <ProjectCard
                  project={project}
                  onDelete={() => handleDeleteProject(project.id, project.name)}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}

interface ProjectCardProps {
  project: any;
  onDelete: () => void;
}

function ProjectCard({ project, onDelete }: ProjectCardProps) {
  const getStatusVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'running':
        return 'running';
      case 'completed':
        return 'completed';
      case 'pending':
        return 'idle';
      default:
        return 'idle';
    }
  };

  return (
    <Card interactive className="group">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/20 flex items-center justify-center">
            <FolderKanban size={24} className="text-orange-400" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--neon-cyan)] transition-colors">
              {project.name}
            </h3>
            <StatusBadge status={getStatusVariant(project.status)} size="sm" />
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
          <DropdownItem icon={<Play size={14} />}>Launch</DropdownItem>
          <DropdownItem icon={<Edit size={14} />}>Edit</DropdownItem>
          <DropdownItem icon={<ExternalLink size={14} />}>Open Directory</DropdownItem>
          <DropdownSeparator />
          <DropdownItem icon={<Trash2 size={14} />} danger onSelect={onDelete}>
            Delete
          </DropdownItem>
        </Dropdown>
      </div>

      {project.description && (
        <p className="text-sm text-[var(--text-secondary)] mb-4 line-clamp-2">
          {project.description}
        </p>
      )}

      <div className="flex items-center gap-4 text-xs text-[var(--text-tertiary)]">
        <div className="flex items-center gap-1">
          <Calendar size={12} />
          <span>
            {new Date(project.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-[var(--glass-border)]">
        <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)] mb-2">
          <span>Progress</span>
          <span>0%</span>
        </div>
        <ProgressBar value={0} size="sm" />
      </div>
    </Card>
  );
}

function EmptyState({
  hasProjects,
  onCreate,
}: {
  hasProjects: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="h-full flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-md"
      >
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-[var(--glass-border)] flex items-center justify-center mx-auto mb-6">
          <FolderKanban size={40} className="text-[var(--text-tertiary)]" />
        </div>
        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
          {hasProjects ? 'No matching projects' : 'No Projects Yet'}
        </h2>
        <p className="text-[var(--text-secondary)] mb-6">
          {hasProjects
            ? 'Try adjusting your search query'
            : 'Create your first project to start organizing your work and orchestrating agents.'}
        </p>
        {!hasProjects && (
          <Button
            variant="primary"
            size="lg"
            icon={<FolderPlus size={18} />}
            onClick={onCreate}
            glow
          >
            Create Your First Project
          </Button>
        )}
      </motion.div>
    </div>
  );
}
