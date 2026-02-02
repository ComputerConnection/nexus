import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Clock,
  Layers,
  CheckCircle2,
  ChevronRight,
  Folder,
  File,
  Users,
  ListTodo,
  GitBranch,
  Zap,
  AlertTriangle,
  Info,
  Code2,
  BookOpen,
  Shield,
  Settings,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { Button } from './ui';
import type { ProjectTemplate, FolderItem, SetupTask, RecommendedAgent } from '../data/projectTemplates';

interface TemplateDetailModalProps {
  template: ProjectTemplate;
  isOpen: boolean;
  onClose: () => void;
  onUseTemplate: (template: ProjectTemplate) => void;
}

type TabId = 'overview' | 'structure' | 'tasks' | 'agents' | 'tech';

export function TemplateDetailModal({
  template,
  isOpen,
  onClose,
  onUseTemplate,
}: TemplateDetailModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const Icon = template.icon;

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: Info },
    { id: 'structure', label: 'Structure', icon: Folder },
    { id: 'tasks', label: 'Setup Tasks', icon: ListTodo },
    { id: 'agents', label: 'Agents', icon: Users },
    { id: 'tech', label: 'Tech Stack', icon: Code2 },
  ];

  const difficultyColors = {
    beginner: 'bg-green-500/20 text-green-400 border-green-500/30',
    intermediate: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    advanced: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-5xl max-h-[90vh] bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="relative p-6 border-b border-[var(--glass-border)]">
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--glass-bg)] to-transparent" />
            <div className="relative flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${template.color} flex items-center justify-center shadow-lg`}
                >
                  <Icon size={32} className="text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-[var(--text-primary)]">
                    {template.name}
                  </h2>
                  <p className="text-[var(--text-secondary)] mt-1 max-w-xl">
                    {template.description}
                  </p>
                  <div className="flex items-center gap-3 mt-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium border ${difficultyColors[template.difficulty]}`}
                    >
                      {template.difficulty.charAt(0).toUpperCase() + template.difficulty.slice(1)}
                    </span>
                    <span className="flex items-center gap-1 text-sm text-[var(--text-tertiary)]">
                      <Clock size={14} />
                      {template.estimatedSetupTime}
                    </span>
                    <span className="flex items-center gap-1 text-sm text-[var(--text-tertiary)]">
                      <ListTodo size={14} />
                      {template.setupTasks.length} tasks
                    </span>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X size={20} />
              </Button>
            </div>

            {/* Tags */}
            <div className="relative flex flex-wrap gap-2 mt-4">
              {template.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 rounded-md bg-[var(--glass-bg)] border border-[var(--glass-border)] text-xs text-[var(--text-secondary)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[var(--glass-border)] px-6">
            {tabs.map((tab) => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                    activeTab === tab.id
                      ? 'text-[var(--neon-cyan)] border-[var(--neon-cyan)]'
                      : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]'
                  }`}
                >
                  <TabIcon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'overview' && <OverviewTab template={template} />}
            {activeTab === 'structure' && <StructureTab structure={template.folderStructure} />}
            {activeTab === 'tasks' && <TasksTab tasks={template.setupTasks} />}
            {activeTab === 'agents' && <AgentsTab agents={template.recommendedAgents} />}
            {activeTab === 'tech' && <TechStackTab techStack={template.techStack} />}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-[var(--glass-border)] bg-[var(--bg-secondary)]/50">
            <div className="text-sm text-[var(--text-tertiary)]">
              This template will create a project with {template.folderStructure.length} root items
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                icon={<Sparkles size={16} />}
                onClick={() => onUseTemplate(template)}
                glow
              >
                Use This Template
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// Overview Tab
function OverviewTab({ template }: { template: ProjectTemplate }) {
  return (
    <div className="space-y-8">
      {/* Description */}
      <div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3">About This Template</h3>
        <p className="text-[var(--text-secondary)] leading-relaxed">{template.longDescription}</p>
      </div>

      {/* Features */}
      <div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Features</h3>
        <div className="grid grid-cols-2 gap-2">
          {template.features.map((feature, i) => (
            <div key={i} className="flex items-start gap-2">
              <CheckCircle2 size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-[var(--text-secondary)]">{feature}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Prerequisites */}
        <div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Prerequisites</h3>
          <ul className="space-y-2">
            {template.prerequisites.map((prereq, i) => (
              <li key={i} className="flex items-start gap-2">
                <AlertTriangle size={14} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-[var(--text-secondary)]">{prereq}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Success Criteria */}
        <div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Success Criteria</h3>
          <ul className="space-y-2">
            {template.successCriteria.map((criteria, i) => (
              <li key={i} className="flex items-start gap-2">
                <Zap size={14} className="text-[var(--neon-cyan)] mt-0.5 flex-shrink-0" />
                <span className="text-sm text-[var(--text-secondary)]">{criteria}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Suggested Workflows */}
      {template.suggestedWorkflows.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Suggested Workflows</h3>
          <div className="space-y-3">
            {template.suggestedWorkflows.map((workflow) => (
              <div
                key={workflow.id}
                className="p-4 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)]"
              >
                <div className="flex items-center gap-2 mb-2">
                  <GitBranch size={16} className="text-purple-400" />
                  <h4 className="font-medium text-[var(--text-primary)]">{workflow.name}</h4>
                </div>
                <p className="text-sm text-[var(--text-secondary)] mb-3">{workflow.description}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {workflow.steps.map((step, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <span className="px-2 py-1 rounded-md bg-[var(--bg-secondary)] text-xs text-[var(--text-secondary)]">
                        {step}
                      </span>
                      {i < workflow.steps.length - 1 && (
                        <ChevronRight size={12} className="text-[var(--text-tertiary)]" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Structure Tab
function StructureTab({ structure }: { structure: FolderItem[] }) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Project Structure</h3>
      <div className="bg-[var(--bg-secondary)] rounded-xl p-4 font-mono text-sm">
        <FolderTree items={structure} depth={0} />
      </div>
    </div>
  );
}

function FolderTree({ items, depth }: { items: FolderItem[]; depth: number }) {
  return (
    <div className="space-y-1">
      {items.map((item, i) => (
        <FolderTreeItem key={`${item.name}-${i}`} item={item} depth={depth} />
      ))}
    </div>
  );
}

function FolderTreeItem({ item, depth }: { item: FolderItem; depth: number }) {
  const [isOpen, setIsOpen] = useState(depth < 2);

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-1 px-2 rounded-md hover:bg-[var(--glass-bg)] cursor-pointer group`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => item.type === 'folder' && item.children && setIsOpen(!isOpen)}
      >
        {item.type === 'folder' ? (
          <>
            <ChevronRight
              size={14}
              className={`text-[var(--text-tertiary)] transition-transform ${isOpen ? 'rotate-90' : ''}`}
            />
            <Folder size={14} className="text-yellow-400" />
          </>
        ) : (
          <>
            <span className="w-3.5" />
            <File size={14} className="text-[var(--text-tertiary)]" />
          </>
        )}
        <span className="text-[var(--text-primary)]">{item.name}</span>
        {item.description && (
          <span className="text-[var(--text-tertiary)] text-xs ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
            — {item.description}
          </span>
        )}
      </div>
      {item.type === 'folder' && item.children && isOpen && (
        <FolderTree items={item.children} depth={depth + 1} />
      )}
    </div>
  );
}

// Tasks Tab
function TasksTab({ tasks }: { tasks: SetupTask[] }) {
  const priorityColors = {
    high: 'border-red-500/30 bg-red-500/10',
    medium: 'border-yellow-500/30 bg-yellow-500/10',
    low: 'border-green-500/30 bg-green-500/10',
  };

  const priorityLabels = {
    high: 'text-red-400',
    medium: 'text-yellow-400',
    low: 'text-green-400',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Setup Tasks</h3>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            High Priority
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-400" />
            Medium
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            Low
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {tasks.map((task, i) => (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`p-4 rounded-xl border ${priorityColors[task.priority]}`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[var(--glass-bg)] text-xs font-medium text-[var(--text-secondary)]">
                  {i + 1}
                </span>
                <h4 className="font-medium text-[var(--text-primary)]">{task.title}</h4>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className={`font-medium ${priorityLabels[task.priority]}`}>
                  {task.priority.toUpperCase()}
                </span>
                <span className="text-[var(--text-tertiary)] flex items-center gap-1">
                  <Clock size={12} />
                  {task.estimatedTime}
                </span>
              </div>
            </div>

            <p className="text-sm text-[var(--text-secondary)] mb-3 ml-9">
              {task.description}
            </p>

            <div className="flex items-center gap-4 ml-9 text-xs">
              <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--glass-bg)] text-[var(--neon-cyan)]">
                <Users size={12} />
                {task.agentRole}
              </span>
              {task.dependencies && task.dependencies.length > 0 && (
                <span className="flex items-center gap-1 text-[var(--text-tertiary)]">
                  <ArrowRight size={12} />
                  Depends on: {task.dependencies.join(', ')}
                </span>
              )}
            </div>

            {task.commands && task.commands.length > 0 && (
              <div className="mt-3 ml-9 p-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--glass-border)]">
                <div className="text-xs text-[var(--text-tertiary)] mb-1">Commands:</div>
                {task.commands.map((cmd, j) => (
                  <code key={j} className="block text-xs text-[var(--text-secondary)] font-mono">
                    $ {cmd}
                  </code>
                ))}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// Agents Tab
function AgentsTab({ agents }: { agents: RecommendedAgent[] }) {
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  return (
    <div>
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Recommended Agents</h3>
      <div className="space-y-3">
        {agents.map((agent, i) => (
          <motion.div
            key={agent.role}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] overflow-hidden"
          >
            <button
              className="w-full p-4 flex items-center justify-between text-left"
              onClick={() => setExpandedAgent(expandedAgent === agent.role ? null : agent.role)}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--neon-cyan)]/20 to-purple-500/20 border border-[var(--neon-cyan)]/30 flex items-center justify-center">
                  <Users size={18} className="text-[var(--neon-cyan)]" />
                </div>
                <div>
                  <h4 className="font-medium text-[var(--text-primary)]">{agent.name}</h4>
                  <p className="text-sm text-[var(--text-secondary)]">{agent.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 rounded-md bg-[var(--bg-secondary)] text-xs text-[var(--text-tertiary)]">
                  Priority {agent.priority}
                </span>
                <ChevronRight
                  size={18}
                  className={`text-[var(--text-tertiary)] transition-transform ${
                    expandedAgent === agent.role ? 'rotate-90' : ''
                  }`}
                />
              </div>
            </button>

            <AnimatePresence>
              {expandedAgent === agent.role && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4">
                    <div className="p-4 rounded-lg bg-[var(--bg-primary)] border border-[var(--glass-border)]">
                      <div className="text-xs text-[var(--text-tertiary)] mb-2 font-medium">
                        System Prompt:
                      </div>
                      <pre className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap font-mono leading-relaxed">
                        {agent.systemPrompt}
                      </pre>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// Tech Stack Tab
function TechStackTab({ techStack }: { techStack: ProjectTemplate['techStack'] }) {
  const categories = {
    frontend: { label: 'Frontend', icon: Code2, color: 'text-blue-400' },
    backend: { label: 'Backend', icon: Settings, color: 'text-green-400' },
    database: { label: 'Database', icon: Layers, color: 'text-purple-400' },
    devops: { label: 'DevOps', icon: GitBranch, color: 'text-orange-400' },
    testing: { label: 'Testing', icon: Shield, color: 'text-yellow-400' },
    other: { label: 'Other', icon: BookOpen, color: 'text-gray-400' },
  };

  const groupedTech = techStack.reduce((acc, tech) => {
    if (!acc[tech.category]) acc[tech.category] = [];
    acc[tech.category].push(tech);
    return acc;
  }, {} as Record<string, typeof techStack>);

  return (
    <div>
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Technology Stack</h3>
      <div className="grid grid-cols-2 gap-4">
        {Object.entries(groupedTech).map(([category, techs]) => {
          const cat = categories[category as keyof typeof categories];
          const CatIcon = cat.icon;
          return (
            <div
              key={category}
              className="p-4 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)]"
            >
              <div className="flex items-center gap-2 mb-3">
                <CatIcon size={18} className={cat.color} />
                <h4 className="font-medium text-[var(--text-primary)]">{cat.label}</h4>
              </div>
              <div className="space-y-2">
                {techs.map((tech) => (
                  <div key={tech.name} className="flex items-center justify-between">
                    <span className="text-sm text-[var(--text-secondary)]">{tech.name}</span>
                    {tech.optional && (
                      <span className="text-xs text-[var(--text-tertiary)] px-2 py-0.5 rounded-full bg-[var(--bg-secondary)]">
                        Optional
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
