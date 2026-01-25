import { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Clock,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { AgentRole } from '../../types';

interface TimelineAgent {
  id: string;
  name: string;
  role: AgentRole;
  events: TimelineEvent[];
}

interface TimelineEvent {
  type: 'start' | 'running' | 'pause' | 'resume' | 'complete' | 'fail' | 'blocked';
  timestamp: number; // ms from workflow start
  duration?: number; // ms
  message?: string;
}

interface ExecutionTimelineProps {
  agents: TimelineAgent[];
  totalDuration: number; // total workflow duration in ms
  currentTime?: number; // current playback position
  isPlaying?: boolean;
  onSeek?: (time: number) => void;
  onPlayPause?: () => void;
  className?: string;
}

const roleColors: Record<AgentRole, string> = {
  orchestrator: '#00fff9',
  architect: '#00fff9',
  implementer: '#39ff14',
  tester: '#ff6600',
  documenter: '#ff00ff',
  security: '#ff0040',
  devops: '#808080',
};

const eventColors = {
  start: '#00fff9',
  running: '#39ff14',
  pause: '#ff6600',
  resume: '#00fff9',
  complete: '#00fff9',
  fail: '#ff0040',
  blocked: '#808080',
};

export function ExecutionTimeline({
  agents,
  totalDuration,
  currentTime = 0,
  isPlaying = false,
  onSeek,
  onPlayPause,
  className,
}: ExecutionTimelineProps) {
  const [zoom, setZoom] = useState(1);
  const [hoveredEvent, setHoveredEvent] = useState<{ agentId: string; eventIndex: number } | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Time markers based on zoom level
  const timeMarkers = useMemo(() => {
    const markers: number[] = [];
    const interval = Math.max(1000, Math.floor(totalDuration / (10 * zoom))); // At least 1 second intervals
    for (let t = 0; t <= totalDuration; t += interval) {
      markers.push(t);
    }
    return markers;
  }, [totalDuration, zoom]);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (minutes > 0) {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
    return `${secs}s`;
  };

  const getTimePosition = (time: number) => {
    return (time / totalDuration) * 100 * zoom;
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !onSeek) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + timelineRef.current.scrollLeft;
    const percentage = x / (rect.width * zoom);
    const newTime = Math.max(0, Math.min(totalDuration, percentage * totalDuration));
    onSeek(newTime);
  };

  const handleMouseDown = () => setIsDragging(true);
  const handleMouseUp = () => setIsDragging(false);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mouseup', handleMouseUp);
      return () => window.removeEventListener('mouseup', handleMouseUp);
    }
  }, [isDragging]);

  return (
    <div className={clsx('flex flex-col bg-[var(--bg-secondary)] rounded-xl overflow-hidden', className)}>
      {/* Header with controls */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--glass-border)]">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-[var(--text-tertiary)]" />
          <span className="text-sm font-medium text-[var(--text-primary)]">
            Execution Timeline
          </span>
          <span className="text-xs text-[var(--text-tertiary)] ml-2">
            {formatTime(currentTime)} / {formatTime(totalDuration)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Playback controls */}
          <div className="flex items-center gap-1 mr-4">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => onSeek?.(0)}
              className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            >
              <SkipBack size={14} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onPlayPause}
              className={clsx(
                'p-2 rounded-lg',
                isPlaying
                  ? 'bg-orange-500/10 text-orange-400'
                  : 'bg-green-500/10 text-green-400'
              )}
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => onSeek?.(totalDuration)}
              className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            >
              <SkipForward size={14} />
            </motion.button>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 border-l border-[var(--glass-border)] pl-4">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.5))}
              className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            >
              <ZoomOut size={14} />
            </motion.button>
            <span className="text-xs text-[var(--text-tertiary)] min-w-[40px] text-center">
              {zoom}x
            </span>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setZoom((z) => Math.min(4, z + 0.5))}
              className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            >
              <ZoomIn size={14} />
            </motion.button>
          </div>
        </div>
      </div>

      {/* Timeline content */}
      <div className="flex-1 overflow-x-auto" ref={timelineRef}>
        <div
          className="relative min-h-[200px]"
          style={{ width: `${100 * zoom}%`, minWidth: '100%' }}
          onClick={handleTimelineClick}
          onMouseDown={handleMouseDown}
        >
          {/* Time markers */}
          <div className="sticky top-0 h-8 bg-[var(--bg-tertiary)] border-b border-[var(--glass-border)] z-10">
            {timeMarkers.map((time) => (
              <div
                key={time}
                className="absolute top-0 h-full flex flex-col justify-end"
                style={{ left: `${getTimePosition(time)}%` }}
              >
                <span className="text-[10px] text-[var(--text-tertiary)] px-1">
                  {formatTime(time)}
                </span>
                <div className="w-px h-2 bg-[var(--glass-border)]" />
              </div>
            ))}
          </div>

          {/* Agent tracks */}
          <div className="py-2">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center h-12 hover:bg-[var(--bg-hover)]/30 transition-colors"
              >
                {/* Agent label */}
                <div className="sticky left-0 w-32 px-3 bg-[var(--bg-secondary)] z-10 flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: roleColors[agent.role] }}
                  />
                  <span className="text-xs font-mono text-[var(--text-primary)] truncate">
                    {agent.name}
                  </span>
                </div>

                {/* Event bars */}
                <div className="flex-1 relative h-8 mx-2">
                  {agent.events.map((event, eventIndex) => {
                    if (!event.duration) return null;

                    const isHovered =
                      hoveredEvent?.agentId === agent.id &&
                      hoveredEvent?.eventIndex === eventIndex;

                    return (
                      <motion.div
                        key={eventIndex}
                        className="absolute top-1/2 -translate-y-1/2 h-6 rounded cursor-pointer"
                        style={{
                          left: `${getTimePosition(event.timestamp)}%`,
                          width: `${getTimePosition(event.duration)}%`,
                          minWidth: '4px',
                          backgroundColor: eventColors[event.type],
                          opacity: event.type === 'blocked' ? 0.3 : 0.8,
                        }}
                        onMouseEnter={() => setHoveredEvent({ agentId: agent.id, eventIndex })}
                        onMouseLeave={() => setHoveredEvent(null)}
                        whileHover={{ scaleY: 1.2 }}
                      >
                        {/* Striped pattern for blocked state */}
                        {event.type === 'blocked' && (
                          <div
                            className="absolute inset-0 rounded"
                            style={{
                              background: `repeating-linear-gradient(
                                45deg,
                                transparent,
                                transparent 4px,
                                rgba(0,0,0,0.3) 4px,
                                rgba(0,0,0,0.3) 8px
                              )`,
                            }}
                          />
                        )}

                        {/* Tooltip */}
                        <AnimatePresence>
                          {isHovered && (
                            <motion.div
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -5 }}
                              className={clsx(
                                'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20',
                                'px-2 py-1 rounded-lg whitespace-nowrap',
                                'bg-[var(--bg-primary)] border border-[var(--glass-border)]',
                                'text-xs shadow-xl'
                              )}
                            >
                              <div className="font-medium text-[var(--text-primary)]">
                                {event.type.charAt(0).toUpperCase() + event.type.slice(1)}
                              </div>
                              <div className="text-[var(--text-tertiary)]">
                                {formatTime(event.timestamp)} - {formatTime(event.timestamp + event.duration)}
                              </div>
                              {event.message && (
                                <div className="text-[var(--text-secondary)] mt-1 max-w-[200px] truncate">
                                  {event.message}
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Current time indicator */}
          <motion.div
            className="absolute top-0 bottom-0 w-0.5 bg-white z-20 pointer-events-none"
            style={{ left: `${getTimePosition(currentTime)}%` }}
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full" />
          </motion.div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-t border-[var(--glass-border)]">
        <span className="text-xs text-[var(--text-tertiary)]">Legend:</span>
        {Object.entries(eventColors).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div
              className="w-3 h-2 rounded-sm"
              style={{
                backgroundColor: color,
                opacity: type === 'blocked' ? 0.3 : 0.8,
              }}
            />
            <span className="text-[10px] text-[var(--text-secondary)] capitalize">{type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Mini timeline for embedding in other views
export function MiniTimeline({
  progress,
  status,
  className,
}: {
  progress: number;
  status: 'idle' | 'running' | 'completed' | 'failed';
  className?: string;
}) {
  const statusColors = {
    idle: '#808080',
    running: '#39ff14',
    completed: '#00fff9',
    failed: '#ff0040',
  };

  return (
    <div className={clsx('relative h-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden', className)}>
      <motion.div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ backgroundColor: statusColors[status] }}
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.3 }}
      />
      {status === 'running' && (
        <motion.div
          className="absolute inset-y-0 w-full"
          style={{
            background: `linear-gradient(90deg, transparent, ${statusColors[status]}40, transparent)`,
          }}
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}
    </div>
  );
}
