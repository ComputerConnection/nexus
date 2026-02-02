import { Toaster } from 'sonner';
import { CheckCircle, XCircle, AlertCircle, Info, Loader2 } from 'lucide-react';

// Custom toast component wrapper
export function ToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      gap={8}
      toastOptions={{
        style: {
          background: 'var(--bg-secondary)',
          border: '1px solid var(--glass-border)',
          borderRadius: 'var(--radius-lg)',
          color: 'var(--text-primary)',
          boxShadow: 'var(--shadow-lg)',
        },
        className: 'sonner-toast',
      }}
      icons={{
        success: <CheckCircle size={18} className="text-[var(--neon-green)]" />,
        error: <XCircle size={18} className="text-[var(--neon-red)]" />,
        warning: <AlertCircle size={18} className="text-[var(--neon-orange)]" />,
        info: <Info size={18} className="text-[var(--neon-cyan)]" />,
        loading: <Loader2 size={18} className="text-[var(--neon-cyan)] animate-spin" />,
      }}
    />
  );
}
