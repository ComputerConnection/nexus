export type ProjectStatus = 'pending' | 'active' | 'paused' | 'completed' | 'failed' | 'archived';

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  workingDirectory: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  working_directory: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  status?: ProjectStatus;
}

export const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  pending: '#808080',
  active: '#39ff14',
  paused: '#ff6600',
  completed: '#00fff9',
  failed: '#ff0040',
  archived: '#404040',
};
