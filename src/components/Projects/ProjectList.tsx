import { useMemo } from 'react';
import { clsx } from 'clsx';
import { useProjectStore } from '../../stores/projectStore';
import { ProjectCard } from './ProjectCard';

interface ProjectListProps {
  className?: string;
  onProjectSelect?: (projectId: string) => void;
  onProjectLaunch?: (projectId: string) => void;
}

export function ProjectList({ className, onProjectSelect, onProjectLaunch }: ProjectListProps) {
  const { projects, selectedProjectId, selectProject, deleteProject } = useProjectStore();

  const projectList = useMemo(() => Array.from(projects.values()), [projects]);

  if (projectList.length === 0) {
    return (
      <div className={clsx('flex items-center justify-center h-64', className)}>
        <div className="text-center text-text-secondary">
          <p className="text-lg font-mono">No projects</p>
          <p className="text-sm mt-2">Create a project to get started</p>
        </div>
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
