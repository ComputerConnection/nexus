import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import {
  MessageSquare,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Search,
  Filter,
  X,
  Copy,
  Check,
  AlertCircle,
  Info,
  Zap,
  FileJson,
} from 'lucide-react';

export interface AgentMessage {
  id: string;
  timestamp: number;
  from: {
    id: string;
    name: string;
    role: string;
  };
  to: {
    id: string;
    name: string;
    role: string;
  } | 'broadcast';
  type: 'data' | 'command' | 'status' | 'error' | 'result';
  content: unknown;
  preview?: string;
}

interface MessagePanelProps {
  messages: AgentMessage[];
  selectedMessageId?: string;
  onSelectMessage?: (id: string) => void;
  onHighlightEdge?: (fromId: string, toId: string) => void;
  className?: string;
}

const typeConfig = {
  data: { icon: FileJson, color: '#00fff9', label: 'Data' },
  command: { icon: Zap, color: '#ff6600', label: 'Command' },
  status: { icon: Info, color: '#808080', label: 'Status' },
  error: { icon: AlertCircle, color: '#ff0040', label: 'Error' },
  result: { icon: Check, color: '#39ff14', label: 'Result' },
};

export function MessagePanel({
  messages,
  selectedMessageId,
  onSelectMessage,
  onHighlightEdge,
  className,
}: MessagePanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const filteredMessages = messages.filter((msg) => {
    if (typeFilter.length > 0 && !typeFilter.includes(msg.type)) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesContent = msg.preview?.toLowerCase().includes(query);
      const matchesFrom = msg.from.name.toLowerCase().includes(query);
      const matchesTo =
        msg.to === 'broadcast' ? 'broadcast'.includes(query) : msg.to.name.toLowerCase().includes(query);
      return matchesContent || matchesFrom || matchesTo;
    }
    return true;
  });

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedMessages);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedMessages(newExpanded);
  };

  const copyContent = async (msg: AgentMessage) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(msg.content, null, 2));
      setCopiedId(msg.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  return (
    <div className={clsx('flex flex-col bg-[var(--bg-secondary)] rounded-xl overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--glass-border)]">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-[var(--neon-cyan)]" />
          <span className="text-sm font-medium text-[var(--text-primary)]">
            Agent Communication
          </span>
          <span className="text-xs text-[var(--text-tertiary)] px-1.5 py-0.5 rounded-full bg-[var(--bg-tertiary)]">
            {filteredMessages.length}
          </span>
        </div>
      </div>

      {/* Search and filters */}
      <div className="px-4 py-2 border-b border-[var(--glass-border)] space-y-2">
        {/* Search input */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            type="text"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={clsx(
              'w-full pl-9 pr-8 py-2 text-sm rounded-lg',
              'bg-[var(--bg-tertiary)] text-[var(--text-primary)]',
              'border border-[var(--glass-border)] focus:border-[var(--neon-cyan)]',
              'placeholder:text-[var(--text-tertiary)] outline-none'
            )}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Type filters */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter size={12} className="text-[var(--text-tertiary)]" />
          {Object.entries(typeConfig).map(([type, config]) => {
            const isActive = typeFilter.includes(type);
            return (
              <motion.button
                key={type}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setTypeFilter((prev) =>
                    isActive ? prev.filter((t) => t !== type) : [...prev, type]
                  );
                }}
                className={clsx(
                  'px-2 py-1 rounded-md text-[10px] font-medium transition-colors',
                  isActive
                    ? 'bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)]'
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                )}
              >
                {config.label}
              </motion.button>
            );
          })}
          {typeFilter.length > 0 && (
            <button
              onClick={() => setTypeFilter([])}
              className="text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] ml-1"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-[var(--text-tertiary)]">
            <MessageSquare size={24} className="mb-2 opacity-50" />
            <span className="text-sm">No messages</span>
          </div>
        ) : (
          filteredMessages.map((msg) => {
            const config = typeConfig[msg.type];
            const Icon = config.icon;
            const isExpanded = expandedMessages.has(msg.id);
            const isSelected = selectedMessageId === msg.id;

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={clsx(
                  'rounded-lg border transition-colors cursor-pointer',
                  isSelected
                    ? 'border-[var(--neon-cyan)] bg-[var(--neon-cyan)]/5'
                    : 'border-[var(--glass-border)] hover:border-white/10 bg-[var(--bg-tertiary)]/50'
                )}
                onClick={() => {
                  onSelectMessage?.(msg.id);
                  if (msg.to !== 'broadcast') {
                    onHighlightEdge?.(msg.from.id, msg.to.id);
                  }
                }}
              >
                {/* Message header */}
                <div className="flex items-start gap-2 p-2">
                  {/* Type indicator */}
                  <div
                    className="p-1.5 rounded-md mt-0.5"
                    style={{ backgroundColor: `${config.color}20` }}
                  >
                    <Icon size={12} style={{ color: config.color }} />
                  </div>

                  {/* Message info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="font-mono font-medium text-[var(--text-primary)]">
                        {msg.from.name}
                      </span>
                      <ArrowRight size={10} className="text-[var(--text-tertiary)]" />
                      <span className="font-mono text-[var(--text-secondary)]">
                        {msg.to === 'broadcast' ? 'All' : msg.to.name}
                      </span>
                    </div>

                    {/* Preview */}
                    {msg.preview && (
                      <p
                        className={clsx(
                          'text-xs text-[var(--text-secondary)] mt-1',
                          !isExpanded && 'truncate'
                        )}
                      >
                        {msg.preview}
                      </p>
                    )}
                  </div>

                  {/* Timestamp and expand */}
                  <div className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)]">
                    <span>{formatTime(msg.timestamp)}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(msg.id);
                      }}
                      className="p-1 hover:text-[var(--text-primary)]"
                    >
                      {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </button>
                  </div>
                </div>

                {/* Expanded content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-2 pb-2 pt-1 border-t border-[var(--glass-border)]">
                        {/* JSON content */}
                        <div className="relative rounded-lg bg-[var(--bg-primary)] p-2 font-mono text-[10px]">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyContent(msg);
                            }}
                            className={clsx(
                              'absolute top-2 right-2 p-1 rounded',
                              'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]',
                              'hover:bg-[var(--bg-hover)]'
                            )}
                          >
                            {copiedId === msg.id ? (
                              <Check size={12} className="text-green-400" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                          <pre className="text-[var(--text-secondary)] overflow-x-auto max-h-[200px]">
                            {JSON.stringify(msg.content, null, 2)}
                          </pre>
                        </div>

                        {/* Metadata */}
                        <div className="flex items-center gap-3 mt-2 text-[10px] text-[var(--text-tertiary)]">
                          <span>Type: {config.label}</span>
                          <span>From: {msg.from.role}</span>
                          {msg.to !== 'broadcast' && <span>To: {msg.to.role}</span>}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

// Compact message indicator for workflow edges
export function MessageIndicator({
  count,
  type,
  onClick,
}: {
  count: number;
  type: AgentMessage['type'];
  onClick?: () => void;
}) {
  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      className={clsx(
        'flex items-center gap-1 px-1.5 py-0.5 rounded-full',
        'bg-[var(--bg-secondary)] border border-[var(--glass-border)]',
        'text-[10px] font-mono'
      )}
      style={{ color: config.color }}
    >
      <Icon size={10} />
      <span>{count}</span>
    </motion.button>
  );
}
