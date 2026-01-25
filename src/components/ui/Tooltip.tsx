import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { clsx } from 'clsx';
import type { ReactNode } from 'react';

interface TooltipProps {
  children: ReactNode;
  content: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  delayDuration?: number;
  className?: string;
}

export function Tooltip({
  children,
  content,
  side = 'top',
  align = 'center',
  delayDuration = 200,
  className,
}: TooltipProps) {
  return (
    <TooltipPrimitive.Provider>
      <TooltipPrimitive.Root delayDuration={delayDuration}>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            align={align}
            sideOffset={6}
            className={clsx(
              'z-50 px-3 py-1.5 text-sm rounded-[var(--radius-md)]',
              'bg-[var(--bg-elevated)] text-[var(--text-primary)]',
              'border border-[var(--glass-border)]',
              'shadow-lg shadow-black/30',
              'animate-scale-in',
              className
            )}
          >
            {content}
            <TooltipPrimitive.Arrow className="fill-[var(--bg-elevated)]" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

// Hover card for richer content
interface HoverCardProps {
  children: ReactNode;
  content: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
}

export function HoverCard({
  children,
  content,
  side = 'bottom',
  align = 'center',
}: HoverCardProps) {
  return (
    <TooltipPrimitive.Provider>
      <TooltipPrimitive.Root delayDuration={300}>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            align={align}
            sideOffset={8}
            className={clsx(
              'z-50 min-w-[200px] max-w-[320px] p-4 rounded-[var(--radius-lg)]',
              'bg-[var(--glass-bg)] backdrop-blur-xl',
              'border border-[var(--glass-border)]',
              'shadow-xl shadow-black/40',
              'animate-scale-in'
            )}
          >
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
