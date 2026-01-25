import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  Bot,
  GitBranch,
  FolderKanban,
  Settings,
  Command,
  Zap,
} from 'lucide-react';
import { CommandCenter } from './pages/CommandCenter';
import { AgentGrid } from './pages/AgentGrid';
import { WorkflowEditor } from './pages/WorkflowEditor';
import { EnhancedWorkflowEditor } from './pages/EnhancedWorkflowEditor';
import { ProjectHub } from './pages/ProjectHub';
import { CommandPalette, useCommandPalette } from './components/ui/CommandPalette';
import { ToastProvider } from './components/ui/Toast';
import { Tooltip } from './components/ui/Tooltip';
import { clsx } from 'clsx';

const navItems = [
  { path: '/', icon: Home, label: 'Command Center' },
  { path: '/agents', icon: Bot, label: 'Agents' },
  { path: '/workflows', icon: GitBranch, label: 'Workflows' },
  { path: '/projects', icon: FolderKanban, label: 'Projects' },
];

function Sidebar() {
  const location = useLocation();

  return (
    <aside className="w-16 flex flex-col bg-[var(--glass-bg)] backdrop-blur-xl border-r border-[var(--glass-border)]">
      {/* Logo */}
      <div className="h-16 flex items-center justify-center border-b border-[var(--glass-border)]">
        <motion.div
          whileHover={{ scale: 1.1, rotate: 180 }}
          transition={{ type: 'spring', stiffness: 300 }}
          className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center shadow-lg shadow-cyan-500/25"
        >
          <Zap size={20} className="text-white" />
        </motion.div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col items-center py-4 gap-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <Tooltip key={item.path} content={item.label} side="right">
              <NavLink to={item.path}>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={clsx(
                    'relative w-12 h-12 rounded-xl flex items-center justify-center transition-colors',
                    isActive
                      ? 'text-[var(--neon-cyan)] bg-cyan-500/10'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute left-0 w-1 h-6 bg-[var(--neon-cyan)] rounded-r-full"
                      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    />
                  )}
                  <Icon size={22} />
                </motion.div>
              </NavLink>
            </Tooltip>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="pb-4 flex flex-col items-center gap-2">
        <Tooltip content="Command Palette (⌘K)" side="right">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-12 h-12 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <Command size={20} />
          </motion.button>
        </Tooltip>
        <Tooltip content="Settings" side="right">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-12 h-12 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <Settings size={20} />
          </motion.button>
        </Tooltip>
      </div>
    </aside>
  );
}

function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="flex-1 overflow-hidden"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

function AppContent() {
  const { open, setOpen } = useCommandPalette();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <main className="flex-1 flex flex-col overflow-hidden">
        <Routes>
          <Route
            path="/"
            element={
              <PageTransition>
                <CommandCenter />
              </PageTransition>
            }
          />
          <Route
            path="/agents"
            element={
              <PageTransition>
                <AgentGrid />
              </PageTransition>
            }
          />
          <Route
            path="/workflows"
            element={
              <PageTransition>
                <EnhancedWorkflowEditor />
              </PageTransition>
            }
          />
          <Route
            path="/workflows/classic"
            element={
              <PageTransition>
                <WorkflowEditor />
              </PageTransition>
            }
          />
          <Route
            path="/projects"
            element={
              <PageTransition>
                <ProjectHub />
              </PageTransition>
            }
          />
        </Routes>
      </main>

      {/* Command Palette */}
      <CommandPalette open={open} onOpenChange={setOpen} />

      {/* Toast notifications */}
      <ToastProvider />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
