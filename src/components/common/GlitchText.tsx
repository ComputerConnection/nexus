import { useState, useEffect, type ReactNode } from 'react';
import { clsx } from 'clsx';

interface GlitchTextProps {
  children: ReactNode;
  className?: string;
  glitchOnHover?: boolean;
  glitchInterval?: number;
  active?: boolean;
}

export function GlitchText({
  children,
  className,
  glitchOnHover = false,
  glitchInterval,
  active = false,
}: GlitchTextProps) {
  const [isGlitching, setIsGlitching] = useState(false);

  useEffect(() => {
    if (!glitchInterval) return;

    const interval = setInterval(() => {
      setIsGlitching(true);
      setTimeout(() => setIsGlitching(false), 150);
    }, glitchInterval);

    return () => clearInterval(interval);
  }, [glitchInterval]);

  return (
    <span
      className={clsx(
        'relative inline-block',
        (isGlitching || active) && 'animate-glitch',
        glitchOnHover && 'hover:animate-glitch',
        className
      )}
      data-text={typeof children === 'string' ? children : undefined}
    >
      {children}
      {(isGlitching || active) && (
        <>
          <span
            className="absolute left-0 top-0 text-neon-cyan opacity-70"
            style={{ clipPath: 'inset(0 0 50% 0)', transform: 'translate(-2px, -1px)' }}
            aria-hidden="true"
          >
            {children}
          </span>
          <span
            className="absolute left-0 top-0 text-neon-magenta opacity-70"
            style={{ clipPath: 'inset(50% 0 0 0)', transform: 'translate(2px, 1px)' }}
            aria-hidden="true"
          >
            {children}
          </span>
        </>
      )}
    </span>
  );
}
