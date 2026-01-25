import { clsx } from 'clsx';

interface ScanlineOverlayProps {
  intensity?: 'light' | 'medium' | 'heavy';
  className?: string;
}

export function ScanlineOverlay({ intensity = 'light', className }: ScanlineOverlayProps) {
  const opacityMap = {
    light: 'opacity-[0.02]',
    medium: 'opacity-[0.05]',
    heavy: 'opacity-[0.1]',
  };

  return (
    <div className={clsx('pointer-events-none fixed inset-0 z-50', className)}>
      {/* Scanlines */}
      <div
        className={clsx('absolute inset-0', opacityMap[intensity])}
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0, 255, 249, 0.03) 1px, rgba(0, 255, 249, 0.03) 2px)',
          backgroundSize: '100% 4px',
        }}
      />

      {/* Moving scanline */}
      <div
        className="absolute left-0 right-0 h-[2px] bg-neon-cyan/10 animate-scanline"
        style={{ boxShadow: '0 0 10px 2px rgba(0, 255, 249, 0.2)' }}
      />

      {/* Vignette effect */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 0%, transparent 60%, rgba(0, 0, 0, 0.4) 100%)',
        }}
      />
    </div>
  );
}
