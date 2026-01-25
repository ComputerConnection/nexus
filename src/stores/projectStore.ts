import { create } from 'zustand';
import type { Project, CreateProjectRequest, UpdateProjectRequest } from '../types';
import * as tauri from '../services/tauri';

interface ProjectState {
  projects: Map<string, Project>;
  selectedProjectId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchProjects: () => Promise<void>;
  createProject: (request: CreateProjectRequest) => Promise<Project>;
  updateProject: (projectId: string, request: UpdateProjectRequest) => Promise<Project>;
  deleteProject: (projectId: string) => Promise<void>;
  selectProject: (projectId: string | null) => void;
  clearError: () => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: new Map(),
  selectedProjectId: null,
  isLoading: false,
  error: null,

  fetchProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const projects = await tauri.listProjects();
      const projectMap = new Map(projects.map((p) => [p.id, p]));
      set({ projects: projectMap, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  createProject: async (request) => {
    set({ isLoading: true, error: null });
    try {
      const project = await tauri.createProject(request);
      set((state) => {
        const newProjects = new Map(state.projects);
        newProjects.set(project.id, project);
        return { projects: newProjects, isLoading: false };
      });
      return project;
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  updateProject: async (projectId, request) => {
    try {
      const project = await tauri.updateProject(projectId, request);
      set((state) => {
        const newProjects = new Map(state.projects);
        newProjects.set(project.id, project);
        return { projects: newProjects };
      });
      return project;
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  deleteProject: async (projectId) => {
    try {
      await tauri.deleteProject(projectId);
      set((state) => {
        const newProjects = new Map(state.projects);
        newProjects.delete(projectId);
        return {
          projects: newProjects,
          selectedProjectId: state.selectedProjectId === projectId ? null : state.selectedProjectId,
        };
      });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  selectProject: (projectId) => {
    set({ selectedProjectId: projectId });
  },

  clearError: () => {
    set({ error: null });
  },
}));
