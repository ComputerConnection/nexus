import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, XCircle, Loader2, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { clsx } from 'clsx';

export type ActionStatus = 'running' | 'success' | 'error';

interface ActionOutputModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  status: ActionStatus;
  output: string;
  error?: string;
}

export function ActionOutputModal({
  isOpen,
  onClose,
  title,
  status,
  output,
  error,
}: ActionOutputModalProps) {
  const outputRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  // Auto-scroll to bottom when output changes
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && status !== 'running') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, status]);

  const handleCopy = async () => {
    const text = error || output;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusIcon = {
    running: <Loader2 size={20} className="animate-spin text-cyan-400" />,
    success: <CheckCircle2 size={20} className="text-green-400" />,
    error: <XCircle size={20} className="text-red-400" />,
  };

  const statusText = {
    running: 'Running...',
    success: 'Completed',
    error: 'Failed',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={status !== 'running' ? onClose : undefined}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', duration: 0.3, bounce: 0.2 }}
            className="relative w-full max-w-3xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--glass-border)]">
              <div className="flex items-center gap-3">
                {statusIcon[status]}
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                    {title}
                  </h2>
                  <p
                    className={clsx(
                      'text-sm',
                      status === 'running' && 'text-cyan-400',
                      status === 'success' && 'text-green-400',
                      status === 'error' && 'text-red-400'
                    )}
                  >
                    {statusText[status]}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="p-2 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                  title="Copy output"
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                </button>
                {status !== 'running' && (
                  <button
                    onClick={onClose}
                    className="p-2 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            </div>

            {/* Output */}
            <pre
              ref={outputRef}
              className={clsx(
                'p-4 h-[400px] overflow-auto font-mono text-sm',
                'bg-[#0a0a0f]',
                error ? 'text-red-400' : 'text-[var(--text-secondary)]'
              )}
            >
              {error || output || (status === 'running' ? 'Waiting for output...' : 'No output')}
            </pre>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--glass-border)] bg-[var(--bg-secondary)]/50">
              <span className="text-xs text-[var(--text-tertiary)]">
                {status === 'running' ? 'Action in progress...' : 'Press ESC to close'}
              </span>
              {status !== 'running' && (
                <button
                  onClick={onClose}
                  className="px-4 py-1.5 rounded-lg text-sm font-medium bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                >
                  Close
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
