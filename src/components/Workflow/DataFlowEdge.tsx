import { memo, useMemo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { MessageSquare, AlertCircle, CheckCircle } from 'lucide-react';

export interface DataFlowEdgeData {
  label?: string;
  messageCount?: number;
  throughput?: number; // messages per second
  status?: 'idle' | 'active' | 'error' | 'success';
  lastMessage?: {
    type: string;
    preview: string;
    timestamp: number;
  };
}

const statusColors = {
  idle: '#808080',
  active: '#00fff9',
  error: '#ff0040',
  success: '#39ff14',
};

function DataFlowEdgeComponent({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  selected,
}: EdgeProps) {
  const edgeData = (data as DataFlowEdgeData) || {};
  const status = edgeData.status || 'idle';
  const messageCount = edgeData.messageCount || 0;
  const throughput = edgeData.throughput || 0;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Calculate particle count based on throughput
  const particleCount = useMemo(() => {
    if (status !== 'active') return 0;
    return Math.min(Math.max(Math.ceil(throughput / 2), 1), 5);
  }, [throughput, status]);

  // Particle animation duration based on throughput (faster = more throughput)
  const particleDuration = useMemo(() => {
    if (throughput <= 0) return 3;
    return Math.max(0.5, 3 - throughput * 0.2);
  }, [throughput]);

  const edgeColor = statusColors[status];

  return (
    <>
      {/* Glow effect layer */}
      <BaseEdge
        path={edgePath}
        style={{
          ...style,
          stroke: edgeColor,
          strokeWidth: selected ? 8 : 4,
          opacity: status === 'active' ? 0.4 : 0.15,
          filter: 'blur(6px)',
        }}
      />

      {/* Main edge line */}
      <BaseEdge
        path={edgePath}
        style={{
          ...style,
          stroke: edgeColor,
          strokeWidth: selected ? 3 : 2,
          strokeDasharray: status === 'idle' ? '5,5' : undefined,
        }}
      />

      {/* Animated data particles */}
      {status === 'active' &&
        Array.from({ length: particleCount }).map((_, i) => (
          <motion.circle
            key={i}
            r={4 + throughput * 0.5}
            fill={edgeColor}
            filter="url(#glow)"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0] }}
            transition={{
              duration: particleDuration,
              repeat: Infinity,
              delay: i * (particleDuration / particleCount),
            }}
          >
            <animateMotion
              dur={`${particleDuration}s`}
              repeatCount="indefinite"
              path={edgePath}
              begin={`${i * (particleDuration / particleCount)}s`}
            />
          </motion.circle>
        ))}

      {/* Pulse effect for active edges */}
      {status === 'active' && (
        <motion.circle
          r={6}
          fill="transparent"
          stroke={edgeColor}
          strokeWidth={2}
          initial={{ scale: 1, opacity: 0.8 }}
          animate={{ scale: 2, opacity: 0 }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          <animateMotion
            dur={`${particleDuration}s`}
            repeatCount="indefinite"
            path={edgePath}
          />
        </motion.circle>
      )}

      {/* Edge label with message count */}
      <EdgeLabelRenderer>
        <AnimatePresence>
          {(messageCount > 0 || edgeData.label || selected) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                pointerEvents: 'all',
              }}
              className="nodrag nopan"
            >
              <div
                className={clsx(
                  'flex items-center gap-2 px-2 py-1 rounded-lg',
                  'bg-[var(--bg-secondary)]/90 backdrop-blur-sm',
                  'border border-[var(--glass-border)]',
                  'shadow-lg',
                  selected && 'ring-1 ring-[var(--neon-cyan)]'
                )}
              >
                {/* Status icon */}
                {status === 'error' && (
                  <AlertCircle size={12} className="text-red-400" />
                )}
                {status === 'success' && (
                  <CheckCircle size={12} className="text-green-400" />
                )}
                {status === 'active' && (
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    <MessageSquare size={12} className="text-cyan-400" />
                  </motion.div>
                )}

                {/* Message count badge */}
                {messageCount > 0 && (
                  <span
                    className={clsx(
                      'text-xs font-mono font-bold',
                      status === 'active'
                        ? 'text-cyan-400'
                        : 'text-[var(--text-secondary)]'
                    )}
                  >
                    {messageCount > 99 ? '99+' : messageCount}
                  </span>
                )}

                {/* Label */}
                {edgeData.label && (
                  <span className="text-xs text-[var(--text-secondary)]">
                    {edgeData.label}
                  </span>
                )}

                {/* Throughput indicator */}
                {throughput > 0 && (
                  <span className="text-[10px] text-[var(--text-tertiary)]">
                    {throughput.toFixed(1)}/s
                  </span>
                )}
              </div>

              {/* Last message preview on hover/select */}
              {selected && edgeData.lastMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={clsx(
                    'absolute top-full left-1/2 -translate-x-1/2 mt-2',
                    'px-3 py-2 rounded-lg min-w-[200px] max-w-[300px]',
                    'bg-[var(--bg-secondary)] border border-[var(--glass-border)]',
                    'shadow-xl'
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono text-cyan-400">
                      {edgeData.lastMessage.type}
                    </span>
                    <span className="text-[10px] text-[var(--text-tertiary)]">
                      {new Date(edgeData.lastMessage.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] truncate">
                    {edgeData.lastMessage.preview}
                  </p>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </EdgeLabelRenderer>

      {/* SVG filter for glow effect */}
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </>
  );
}

export const DataFlowEdge = memo(DataFlowEdgeComponent);
