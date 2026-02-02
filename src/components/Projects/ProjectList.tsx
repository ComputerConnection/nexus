import { useMemo } from 'react';
import { clsx } from 'clsx';
import { FolderPlus } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { ProjectCard } from './ProjectCard';
import { CompactEmptyState } from '../EmptyState';

interface ProjectListProps {
  className?: string;
  onProjectSelect?: (projectId: string) => void;
  onProjectLaunch?: (projectId: string) => void;
  onCreateProject?: () => void;
}

export function ProjectList({ className, onProjectSelect, onProjectLaunch, onCreateProject }: ProjectListProps) {
  const { projects, selectedProjectId, selectProject, deleteProject } = useProjectStore();

  const projectList = useMemo(() => Array.from(projects.values()), [projects]);

  if (projectList.length === 0) {
    return (
      <div className={clsx('h-64', className)}>
        <CompactEmptyState
          icon={FolderPlus}
          message="No projects yet. Create a project to get started."
          action={onCreateProject ? { label: 'Create Project', onClick: onCreateProject } : undefined}
        />
      </div>
    );
  }

  return (
    <div className={clsx('grid gap-4 md:grid-cols-2 lg:grid-cols-3', className)}>
      {projectList.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          selected={selectedProjectId === project.id}
          onSelect={() => {
            selectProject(project.id);
            onProjectSelect?.(project.id);
          }}
          onDelete={() => deleteProject(project.id)}
          onLaunch={() => onProjectLaunch?.(project.id)}
        />
      ))}
    </div>
  );
}
