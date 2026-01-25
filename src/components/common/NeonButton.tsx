import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { clsx } from 'clsx';

interface NeonButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'cyan' | 'magenta' | 'green' | 'orange' | 'red';
  size?: 'sm' | 'md' | 'lg';
  glow?: boolean;
  loading?: boolean;
}

export const NeonButton = forwardRef<HTMLButtonElement, NeonButtonProps>(
  (
    {
      children,
      variant = 'cyan',
      size = 'md',
      glow = true,
      loading = false,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const variantStyles = {
      cyan: {
        bg: 'bg-neon-cyan/10 hover:bg-neon-cyan/20',
        border: 'border-neon-cyan/50 hover:border-neon-cyan',
        text: 'text-neon-cyan',
        shadow: glow ? 'hover:shadow-neon-cyan' : '',
      },
      magenta: {
        bg: 'bg-neon-magenta/10 hover:bg-neon-magenta/20',
        border: 'border-neon-magenta/50 hover:border-neon-magenta',
        text: 'text-neon-magenta',
        shadow: glow ? 'hover:shadow-neon-magenta' : '',
      },
      green: {
        bg: 'bg-neon-green/10 hover:bg-neon-green/20',
        border: 'border-neon-green/50 hover:border-neon-green',
        text: 'text-neon-green',
        shadow: glow ? 'hover:shadow-neon-green' : '',
      },
      orange: {
        bg: 'bg-neon-orange/10 hover:bg-neon-orange/20',
        border: 'border-neon-orange/50 hover:border-neon-orange',
        text: 'text-neon-orange',
        shadow: glow ? 'hover:shadow-neon-orange' : '',
      },
      red: {
        bg: 'bg-neon-red/10 hover:bg-neon-red/20',
        border: 'border-neon-red/50 hover:border-neon-red',
        text: 'text-neon-red',
        shadow: glow ? 'hover:shadow-neon-red' : '',
      },
    };

    const sizeStyles = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
    };

    const styles = variantStyles[variant];

    return (
      <button
        ref={ref}
        className={clsx(
          'relative font-mono border rounded transition-all duration-200',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none',
          styles.bg,
          styles.border,
          styles.text,
          styles.shadow,
          sizeStyles[size],
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="animate-spin">◌</span>
            Processing...
          </span>
        ) : (
          children
        )}
      </button>
    );
  }
);

NeonButton.displayName = 'NeonButton';
