import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AppSettings {
  // General
  defaultWorkingDirectory: string;
  theme: 'dark' | 'light' | 'system';

  // Agent settings
  maxConcurrentAgents: number;
  defaultAgentTimeout: number; // seconds
  agentOutputRetentionLines: number;

  // UI preferences
  sidebarCollapsed: boolean;
  showAgentTimestamps: boolean;
  terminalFontSize: number;

  // Advanced
  enableDebugLogging: boolean;
  apiPort: number;
}

interface SettingsState {
  settings: AppSettings;
  isLoading: boolean;

  // Actions
  updateSettings: (partial: Partial<AppSettings>) => void;
  resetSettings: () => void;
  loadSettings: () => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  defaultWorkingDirectory: '/tmp',
  theme: 'dark',
  maxConcurrentAgents: 5,
  defaultAgentTimeout: 300,
  agentOutputRetentionLines: 1000,
  sidebarCollapsed: false,
  showAgentTimestamps: true,
  terminalFontSize: 13,
  enableDebugLogging: false,
  apiPort: 3000,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      isLoading: false,

      updateSettings: (partial) => {
        set((state) => ({
          settings: { ...state.settings, ...partial },
        }));
      },

      resetSettings: () => {
        set({ settings: DEFAULT_SETTINGS });
      },

      loadSettings: () => {
        // Settings are auto-loaded by zustand persist
        // This is a no-op but kept for explicit loading if needed
      },
    }),
    {
      name: 'nexus-settings',
    }
  )
);
