import { forwardRef } from 'react';
import type { ReactNode } from 'react';
import type { HTMLMotionProps } from 'framer-motion';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

interface CardProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  variant?: 'default' | 'elevated' | 'outlined';
  interactive?: boolean;
  glow?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddings = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-6',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      children,
      variant = 'default',
      interactive = false,
      glow = false,
      padding = 'md',
      className,
      ...props
    },
    ref
  ) => {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        whileHover={
          interactive
            ? {
                y: -4,
                transition: { type: 'spring', stiffness: 300, damping: 20 },
              }
            : undefined
        }
        className={clsx(
          'relative rounded-[var(--radius-lg)] transition-all duration-300',
          'bg-[var(--glass-bg)] backdrop-blur-xl',
          'border border-[var(--glass-border)]',
          variant === 'elevated' && 'shadow-lg shadow-black/20',
          interactive && 'cursor-pointer hover:border-white/15 hover:shadow-xl hover:shadow-cyan-500/5',
          glow && 'glow-border',
          paddings[padding],
          className
        )}
        {...props}
      >
        {/* Glass highlight */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        {children}
      </motion.div>
    );
  }
);

Card.displayName = 'Card';

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export function CardHeader({ children, className, action }: CardHeaderProps) {
  return (
    <div className={clsx('flex items-center justify-between mb-4', className)}>
      <div>{children}</div>
      {action}
    </div>
  );
}

interface CardTitleProps {
  children: ReactNode;
  className?: string;
  gradient?: boolean;
}

export function CardTitle({ children, className, gradient }: CardTitleProps) {
  return (
    <h3
      className={clsx(
        'text-base font-semibold',
        gradient ? 'gradient-text' : 'text-[var(--text-primary)]',
        className
      )}
    >
      {children}
    </h3>
  );
}

interface CardDescriptionProps {
  children: ReactNode;
  className?: string;
}

export function CardDescription({ children, className }: CardDescriptionProps) {
  return (
    <p className={clsx('text-sm text-[var(--text-secondary)] mt-1', className)}>
      {children}
    </p>
  );
}

interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export function CardContent({ children, className }: CardContentProps) {
  return <div className={clsx(className)}>{children}</div>;
}

interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

export function CardFooter({ children, className }: CardFooterProps) {
  return (
    <div
      className={clsx(
        'flex items-center gap-3 mt-4 pt-4 border-t border-[var(--glass-border)]',
        className
      )}
    >
      {children}
    </div>
  );
}
