import { useState, useEffect, useCallback, useMemo } from 'react';
import { Command } from 'cmdk';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderKanban,
  Settings,
  Search,
  Plus,
  Play,
  Pause,
  Trash2,
  Home,
  Bot,
  Workflow,
  Command as CommandIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface CommandItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  shortcut?: string[];
  action: () => void;
  group: string;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const commands: CommandItem[] = useMemo(
    () => [
      // Navigation
      {
        id: 'nav-home',
        label: 'Go to Command Center',
        icon: <Home size={16} />,
        shortcut: ['G', 'H'],
        action: () => navigate('/'),
        group: 'Navigation',
      },
      {
        id: 'nav-agents',
        label: 'Go to Agents',
        icon: <Bot size={16} />,
        shortcut: ['G', 'A'],
        action: () => navigate('/agents'),
        group: 'Navigation',
      },
      {
        id: 'nav-workflows',
        label: 'Go to Workflows (Enhanced)',
        icon: <Workflow size={16} />,
        shortcut: ['G', 'W'],
        action: () => navigate('/workflows'),
        group: 'Navigation',
      },
      {
        id: 'nav-workflows-classic',
        label: 'Go to Workflows (Classic)',
        icon: <Workflow size={16} />,
        action: () => navigate('/workflows/classic'),
        group: 'Navigation',
      },
      {
        id: 'nav-projects',
        label: 'Go to Projects',
        icon: <FolderKanban size={16} />,
        shortcut: ['G', 'P'],
        action: () => navigate('/projects'),
        group: 'Navigation',
      },
      // Actions
      {
        id: 'action-new-agent',
        label: 'Spawn New Agent',
        icon: <Plus size={16} />,
        shortcut: ['N', 'A'],
        action: () => console.log('Spawn agent'),
        group: 'Actions',
      },
      {
        id: 'action-new-project',
        label: 'Create New Project',
        icon: <Plus size={16} />,
        shortcut: ['N', 'P'],
        action: () => console.log('New project'),
        group: 'Actions',
      },
      {
        id: 'action-new-workflow',
        label: 'Create New Workflow',
        icon: <Plus size={16} />,
        shortcut: ['N', 'W'],
        action: () => console.log('New workflow'),
        group: 'Actions',
      },
      // Agent controls
      {
        id: 'agent-start-all',
        label: 'Start All Agents',
        icon: <Play size={16} />,
        action: () => console.log('Start all'),
        group: 'Agent Controls',
      },
      {
        id: 'agent-pause-all',
        label: 'Pause All Agents',
        icon: <Pause size={16} />,
        action: () => console.log('Pause all'),
        group: 'Agent Controls',
      },
      {
        id: 'agent-kill-all',
        label: 'Kill All Agents',
        icon: <Trash2 size={16} />,
        action: () => console.log('Kill all'),
        group: 'Agent Controls',
      },
      // Settings
      {
        id: 'settings',
        label: 'Open Settings',
        icon: <Settings size={16} />,
        shortcut: ['⌘', ','],
        action: () => console.log('Settings'),
        group: 'Settings',
      },
    ],
    [navigate]
  );

  // Handle keyboard shortcut to open palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === 'Escape') {
        onOpenChange(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  const handleSelect = useCallback(
    (command: CommandItem) => {
      command.action();
      onOpenChange(false);
      setSearch('');
    },
    [onOpenChange]
  );

  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    commands.forEach((cmd) => {
      if (!groups[cmd.group]) groups[cmd.group] = [];
      groups[cmd.group].push(cmd);
    });
    return groups;
  }, [commands]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
          onClick={() => onOpenChange(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ type: 'spring', duration: 0.3, bounce: 0.1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[560px] overflow-hidden rounded-[var(--radius-xl)] bg-[var(--bg-secondary)] border border-[var(--glass-border)] shadow-2xl shadow-cyan-500/10"
          >
            <Command className="w-full" shouldFilter={true}>
              {/* Search input */}
              <div className="flex items-center gap-3 px-4 border-b border-[var(--glass-border)]">
                <Search size={18} className="text-[var(--text-tertiary)]" />
                <Command.Input
                  value={search}
                  onValueChange={setSearch}
                  placeholder="Type a command or search..."
                  className="flex-1 py-4 bg-transparent text-[var(--text-primary)] text-base placeholder:text-[var(--text-tertiary)] outline-none"
                />
                <kbd className="px-2 py-1 text-xs text-[var(--text-tertiary)] bg-[var(--bg-tertiary)] rounded border border-[var(--glass-border)]">
                  ESC
                </kbd>
              </div>

              {/* Command list */}
              <Command.List className="max-h-[400px] overflow-y-auto p-2">
                <Command.Empty className="py-8 text-center text-[var(--text-tertiary)]">
                  No results found.
                </Command.Empty>

                {Object.entries(groupedCommands).map(([group, items]) => (
                  <Command.Group
                    key={group}
                    heading={group}
                    className="mb-2"
                  >
                    <div className="px-2 py-1.5 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                      {group}
                    </div>
                    {items.map((command) => (
                      <Command.Item
                        key={command.id}
                        value={command.label}
                        onSelect={() => handleSelect(command)}
                        className="flex items-center gap-3 px-3 py-2.5 mx-1 rounded-[var(--radius-md)] text-[var(--text-secondary)] cursor-pointer transition-colors data-[selected=true]:bg-[var(--bg-hover)] data-[selected=true]:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                      >
                        <div className="flex items-center justify-center w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--bg-tertiary)] text-[var(--neon-cyan)]">
                          {command.icon}
                        </div>
                        <span className="flex-1">{command.label}</span>
                        {command.shortcut && (
                          <div className="flex gap-1">
                            {command.shortcut.map((key, i) => (
                              <kbd
                                key={i}
                                className="px-1.5 py-0.5 text-xs bg-[var(--bg-tertiary)] rounded border border-[var(--glass-border)] text-[var(--text-tertiary)]"
                              >
                                {key}
                              </kbd>
                            ))}
                          </div>
                        )}
                      </Command.Item>
                    ))}
                  </Command.Group>
                ))}
              </Command.List>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--glass-border)] text-xs text-[var(--text-tertiary)]">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-[var(--bg-tertiary)] rounded border border-[var(--glass-border)]">
                      ↑↓
                    </kbd>
                    navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-[var(--bg-tertiary)] rounded border border-[var(--glass-border)]">
                      ↵
                    </kbd>
                    select
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <CommandIcon size={12} />
                  <span>Command Palette</span>
                </div>
              </div>
            </Command>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Hook to manage command palette state
export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return { open, setOpen };
}
