import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Settings as SettingsIcon,
  Folder,
  Bot,
  Monitor,
  Code,
  RotateCcw,
  Save,
  Info,
  Database,
  Cpu,
  Clock,
  Terminal,
  Eye,
  Bug,
  Server,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';

import { useSettingsStore, type AppSettings } from '../stores/settingsStore';
import { Button } from '../components/ui';
import * as tauri from '../services/tauri';

type SettingsTab = 'general' | 'agents' | 'ui' | 'advanced' | 'about';

interface SystemStatus {
  databaseConnected: boolean;
  apiRunning: boolean;
  version: string;
  activeAgents: number;
  totalProjects: number;
  totalWorkflows: number;
}

export function Settings() {
  const { settings, updateSettings, resetSettings } = useSettingsStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [hasChanges, setHasChanges] = useState(false);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);

  // Track changes
  useEffect(() => {
    const changed = JSON.stringify(localSettings) !== JSON.stringify(settings);
    setHasChanges(changed);
  }, [localSettings, settings]);

  // Load system status
  useEffect(() => {
    const loadStatus = async () => {
      try {
        const [dbStatus, agents, projects, workflows] = await Promise.all([
          tauri.getDatabaseStatus().catch(() => ({ connected: false })),
          tauri.listAgents().catch(() => []),
          tauri.listProjects().catch(() => []),
          tauri.listWorkflows().catch(() => []),
        ]);

        setSystemStatus({
          databaseConnected: dbStatus.connected,
          apiRunning: true,
          version: '0.1.0',
          activeAgents: agents.filter((a: { status: string }) => a.status === 'running').length,
          totalProjects: projects.length,
          totalWorkflows: workflows.length,
        });
      } catch (error) {
        console.error('Failed to load system status:', error);
      }
    };

    loadStatus();
  }, []);

  const handleSave = () => {
    updateSettings(localSettings);
    toast.success('Settings saved');
    setHasChanges(false);
  };

  const handleReset = () => {
    resetSettings();
    setLocalSettings(settings);
    toast.info('Settings reset to defaults');
  };

  const updateLocal = (partial: Partial<AppSettings>) => {
    setLocalSettings((prev) => ({ ...prev, ...partial }));
  };

  const tabs: { id: SettingsTab; label: string; icon: typeof SettingsIcon }[] = [
    { id: 'general', label: 'General', icon: Folder },
    { id: 'agents', label: 'Agents', icon: Bot },
    { id: 'ui', label: 'Interface', icon: Monitor },
    { id: 'advanced', label: 'Advanced', icon: Code },
    { id: 'about', label: 'About', icon: Info },
  ];

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-3">
          <SettingsIcon className="text-[var(--neon-cyan)]" size={24} />
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Settings</h1>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <motion.span
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-xs text-yellow-400 mr-2"
            >
              Unsaved changes
            </motion.span>
          )}
          <Button variant="ghost" size="sm" icon={<RotateCcw size={14} />} onClick={handleReset}>
            Reset
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Save size={14} />}
            onClick={handleSave}
            disabled={!hasChanges}
          >
            Save
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar tabs */}
        <div className="w-48 border-r border-[var(--glass-border)] bg-[var(--bg-secondary)]/50 p-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors mb-1',
                  isActive
                    ? 'bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                )}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'general' && (
            <SettingsSection title="General Settings">
              <SettingItem
                icon={<Folder size={18} />}
                label="Default Working Directory"
                description="Default directory for new agents and projects"
              >
                <input
                  type="text"
                  value={localSettings.defaultWorkingDirectory}
                  onChange={(e) => updateLocal({ defaultWorkingDirectory: e.target.value })}
                  className="w-80 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--glass-border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--neon-cyan)]"
                  placeholder="/path/to/directory"
                />
              </SettingItem>

              <SettingItem
                icon={<Monitor size={18} />}
                label="Theme"
                description="Application color theme"
              >
                <select
                  value={localSettings.theme}
                  onChange={(e) => updateLocal({ theme: e.target.value as AppSettings['theme'] })}
                  className="w-40 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--glass-border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--neon-cyan)]"
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light (coming soon)</option>
                  <option value="system">System</option>
                </select>
              </SettingItem>
            </SettingsSection>
          )}

          {activeTab === 'agents' && (
            <SettingsSection title="Agent Settings">
              <SettingItem
                icon={<Cpu size={18} />}
                label="Max Concurrent Agents"
                description="Maximum number of agents that can run simultaneously"
              >
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={localSettings.maxConcurrentAgents}
                  onChange={(e) => updateLocal({ maxConcurrentAgents: parseInt(e.target.value) || 5 })}
                  className="w-24 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--glass-border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--neon-cyan)]"
                />
              </SettingItem>

              <SettingItem
                icon={<Clock size={18} />}
                label="Default Timeout"
                description="Default timeout for agent tasks (in seconds)"
              >
                <input
                  type="number"
                  min={30}
                  max={3600}
                  value={localSettings.defaultAgentTimeout}
                  onChange={(e) => updateLocal({ defaultAgentTimeout: parseInt(e.target.value) || 300 })}
                  className="w-24 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--glass-border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--neon-cyan)]"
                />
                <span className="text-xs text-[var(--text-tertiary)] ml-2">seconds</span>
              </SettingItem>

              <SettingItem
                icon={<Terminal size={18} />}
                label="Output Retention"
                description="Number of output lines to keep per agent"
              >
                <input
                  type="number"
                  min={100}
                  max={10000}
                  step={100}
                  value={localSettings.agentOutputRetentionLines}
                  onChange={(e) => updateLocal({ agentOutputRetentionLines: parseInt(e.target.value) || 1000 })}
                  className="w-24 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--glass-border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--neon-cyan)]"
                />
                <span className="text-xs text-[var(--text-tertiary)] ml-2">lines</span>
              </SettingItem>
            </SettingsSection>
          )}

          {activeTab === 'ui' && (
            <SettingsSection title="Interface Settings">
              <SettingItem
                icon={<Eye size={18} />}
                label="Show Timestamps"
                description="Show timestamps in agent output"
              >
                <ToggleSwitch
                  checked={localSettings.showAgentTimestamps}
                  onChange={(checked) => updateLocal({ showAgentTimestamps: checked })}
                />
              </SettingItem>

              <SettingItem
                icon={<Terminal size={18} />}
                label="Terminal Font Size"
                description="Font size for terminal output"
              >
                <input
                  type="number"
                  min={10}
                  max={24}
                  value={localSettings.terminalFontSize}
                  onChange={(e) => updateLocal({ terminalFontSize: parseInt(e.target.value) || 13 })}
                  className="w-24 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--glass-border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--neon-cyan)]"
                />
                <span className="text-xs text-[var(--text-tertiary)] ml-2">px</span>
              </SettingItem>
            </SettingsSection>
          )}

          {activeTab === 'advanced' && (
            <SettingsSection title="Advanced Settings">
              <SettingItem
                icon={<Bug size={18} />}
                label="Debug Logging"
                description="Enable verbose debug logging"
              >
                <ToggleSwitch
                  checked={localSettings.enableDebugLogging}
                  onChange={(checked) => updateLocal({ enableDebugLogging: checked })}
                />
              </SettingItem>

              <SettingItem
                icon={<Server size={18} />}
                label="API Port"
                description="Port for the local API server"
              >
                <input
                  type="number"
                  min={1024}
                  max={65535}
                  value={localSettings.apiPort}
                  onChange={(e) => updateLocal({ apiPort: parseInt(e.target.value) || 3000 })}
                  className="w-24 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--glass-border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--neon-cyan)]"
                />
              </SettingItem>

              <div className="mt-6 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-sm text-yellow-400">
                  Changes to advanced settings may require restarting the application.
                </p>
              </div>
            </SettingsSection>
          )}

          {activeTab === 'about' && (
            <SettingsSection title="About NEXUS">
              <div className="space-y-6">
                {/* App Info */}
                <div className="p-4 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--glass-border)]">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                    NEXUS - Neural EXecution Unified System
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] mb-4">
                    AI Agent Orchestration Platform
                  </p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-[var(--text-tertiary)]">Version:</span>
                      <span className="ml-2 text-[var(--text-primary)]">{systemStatus?.version || '0.1.0'}</span>
                    </div>
                    <div>
                      <span className="text-[var(--text-tertiary)]">Build:</span>
                      <span className="ml-2 text-[var(--text-primary)]">Development</span>
                    </div>
                  </div>
                </div>

                {/* System Status */}
                <div className="p-4 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--glass-border)]">
                  <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">System Status</h3>
                  <div className="space-y-2">
                    <StatusRow
                      icon={<Database size={16} />}
                      label="Database"
                      status={systemStatus?.databaseConnected ? 'connected' : 'disconnected'}
                    />
                    <StatusRow
                      icon={<Server size={16} />}
                      label="API Server"
                      status={systemStatus?.apiRunning ? 'running' : 'stopped'}
                    />
                  </div>
                </div>

                {/* Statistics */}
                {systemStatus && (
                  <div className="p-4 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--glass-border)]">
                    <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">Statistics</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-[var(--neon-cyan)]">
                          {systemStatus.activeAgents}
                        </div>
                        <div className="text-xs text-[var(--text-tertiary)]">Active Agents</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-[var(--neon-green)]">
                          {systemStatus.totalProjects}
                        </div>
                        <div className="text-xs text-[var(--text-tertiary)]">Projects</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-[var(--neon-purple)]">
                          {systemStatus.totalWorkflows}
                        </div>
                        <div className="text-xs text-[var(--text-tertiary)]">Workflows</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Links */}
                <div className="p-4 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--glass-border)]">
                  <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">Resources</h3>
                  <div className="space-y-2 text-sm">
                    <a href="#" className="block text-[var(--neon-cyan)] hover:underline">
                      Documentation
                    </a>
                    <a href="#" className="block text-[var(--neon-cyan)] hover:underline">
                      GitHub Repository
                    </a>
                    <a href="#" className="block text-[var(--neon-cyan)] hover:underline">
                      Report an Issue
                    </a>
                  </div>
                </div>
              </div>
            </SettingsSection>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function SettingItem({
  icon,
  label,
  description,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--glass-border)]">
      <div className="flex items-start gap-3">
        <div className="text-[var(--text-tertiary)] mt-0.5">{icon}</div>
        <div>
          <div className="font-medium text-[var(--text-primary)]">{label}</div>
          <div className="text-sm text-[var(--text-tertiary)]">{description}</div>
        </div>
      </div>
      <div className="flex items-center">{children}</div>
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative w-11 h-6 rounded-full transition-colors',
        checked ? 'bg-[var(--neon-cyan)]' : 'bg-[var(--bg-hover)]'
      )}
    >
      <motion.div
        animate={{ x: checked ? 20 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
      />
    </button>
  );
}

function StatusRow({
  icon,
  label,
  status,
}: {
  icon: React.ReactNode;
  label: string;
  status: 'connected' | 'disconnected' | 'running' | 'stopped';
}) {
  const isGood = status === 'connected' || status === 'running';
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-[var(--text-secondary)]">
        {icon}
        <span>{label}</span>
      </div>
      <div className={clsx('flex items-center gap-1 text-sm', isGood ? 'text-green-400' : 'text-red-400')}>
        {isGood ? <CheckCircle size={14} /> : <XCircle size={14} />}
        <span className="capitalize">{status}</span>
      </div>
    </div>
  );
}
