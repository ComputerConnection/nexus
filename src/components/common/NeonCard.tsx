import { forwardRef, type ReactNode, type HTMLAttributes } from 'react';
import { clsx } from 'clsx';

interface NeonCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'cyan' | 'magenta' | 'green' | 'orange' | 'red';
  glow?: boolean;
  pulse?: boolean;
  className?: string;
}

export const NeonCard = forwardRef<HTMLDivElement, NeonCardProps>(
  ({ children, variant = 'cyan', glow = false, pulse = false, className, ...props }, ref) => {
    const variantStyles = {
      cyan: {
        border: 'border-neon-cyan/30',
        shadow: glow ? 'shadow-neon-cyan' : '',
        hoverBorder: 'hover:border-neon-cyan/60',
      },
      magenta: {
        border: 'border-neon-magenta/30',
        shadow: glow ? 'shadow-neon-magenta' : '',
        hoverBorder: 'hover:border-neon-magenta/60',
      },
      green: {
        border: 'border-neon-green/30',
        shadow: glow ? 'shadow-neon-green' : '',
        hoverBorder: 'hover:border-neon-green/60',
      },
      orange: {
        border: 'border-neon-orange/30',
        shadow: glow ? 'shadow-neon-orange' : '',
        hoverBorder: 'hover:border-neon-orange/60',
      },
      red: {
        border: 'border-neon-red/30',
        shadow: glow ? 'shadow-neon-red' : '',
        hoverBorder: 'hover:border-neon-red/60',
      },
    };

    const styles = variantStyles[variant];

    return (
      <div
        ref={ref}
        className={clsx(
          'bg-bg-secondary rounded-lg border transition-all duration-300',
          styles.border,
          styles.shadow,
          styles.hoverBorder,
          pulse && 'animate-pulse-neon',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

NeonCard.displayName = 'NeonCard';
