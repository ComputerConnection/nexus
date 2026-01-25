import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';
import { clsx } from 'clsx';

interface ConnectionEdgeData {
  label?: string;
  dataType?: string;
  animated?: boolean;
}

function ConnectionEdgeComponent({
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
  const edgeData = data as ConnectionEdgeData | undefined;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      {/* Glow effect */}
      <BaseEdge
        path={edgePath}
        style={{
          ...style,
          stroke: '#00fff9',
          strokeWidth: selected ? 4 : 2,
          opacity: 0.3,
          filter: 'blur(4px)',
        }}
      />

      {/* Main edge */}
      <BaseEdge
        path={edgePath}
        style={{
          ...style,
          stroke: '#00fff9',
          strokeWidth: selected ? 2 : 1,
        }}
      />

      {/* Animated particles */}
      {(edgeData?.animated !== false) && (
        <circle r="3" fill="#00fff9">
          <animateMotion dur="2s" repeatCount="indefinite" path={edgePath} />
        </circle>
      )}

      {/* Label */}
      {edgeData?.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className={clsx(
              'px-2 py-1 rounded text-xs font-mono',
              'bg-bg-secondary border border-neon-cyan/30',
              'text-neon-cyan'
            )}
          >
            {edgeData.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const ConnectionEdge = memo(ConnectionEdgeComponent);
