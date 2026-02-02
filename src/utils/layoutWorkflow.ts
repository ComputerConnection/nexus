import dagre from 'dagre';
import type { WorkflowNode, WorkflowEdge } from '../types';

export type LayoutPreset = 'dagre' | 'force' | 'timeline' | 'manual';

interface LayoutOptions {
  direction?: 'TB' | 'LR' | 'BT' | 'RL';
  nodeWidth?: number;
  nodeHeight?: number;
  rankSep?: number;
  nodeSep?: number;
}

const DEFAULT_NODE_WIDTH = 200;
const DEFAULT_NODE_HEIGHT = 80;

/**
 * Apply dagre (hierarchical) layout to nodes
 */
export function applyDagreLayout(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  options: LayoutOptions = {}
): WorkflowNode[] {
  const {
    direction = 'TB',
    nodeWidth = DEFAULT_NODE_WIDTH,
    nodeHeight = DEFAULT_NODE_HEIGHT,
    rankSep = 80,
    nodeSep = 50,
  } = options;

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    ranksep: rankSep,
    nodesep: nodeSep,
    marginx: 50,
    marginy: 50,
  });

  // Add nodes to dagre graph
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  // Add edges to dagre graph
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Run the layout
  dagre.layout(dagreGraph);

  // Apply positions back to nodes
  return nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });
}

/**
 * Apply force-directed layout using simple spring simulation
 */
export function applyForceLayout(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  iterations: number = 100
): WorkflowNode[] {
  if (nodes.length === 0) return nodes;

  // Initialize positions if not set
  const positions = new Map<string, { x: number; y: number; vx: number; vy: number }>();

  nodes.forEach((node, i) => {
    // Start with a circle layout
    const angle = (2 * Math.PI * i) / nodes.length;
    const radius = Math.max(200, nodes.length * 30);
    positions.set(node.id, {
      x: node.position?.x ?? 400 + radius * Math.cos(angle),
      y: node.position?.y ?? 300 + radius * Math.sin(angle),
      vx: 0,
      vy: 0,
    });
  });

  // Simulation parameters
  const repulsion = 5000;
  const attraction = 0.05;
  const damping = 0.9;
  const minDistance = 150;

  for (let iter = 0; iter < iterations; iter++) {
    const alpha = 1 - iter / iterations;

    // Repulsion between all nodes
    nodes.forEach((nodeA) => {
      const posA = positions.get(nodeA.id)!;
      nodes.forEach((nodeB) => {
        if (nodeA.id === nodeB.id) return;
        const posB = positions.get(nodeB.id)!;

        const dx = posA.x - posB.x;
        const dy = posA.y - posB.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (repulsion * alpha) / (dist * dist);

        posA.vx += (dx / dist) * force;
        posA.vy += (dy / dist) * force;
      });
    });

    // Attraction along edges
    edges.forEach((edge) => {
      const posA = positions.get(edge.source);
      const posB = positions.get(edge.target);
      if (!posA || !posB) return;

      const dx = posB.x - posA.x;
      const dy = posB.y - posA.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist - minDistance) * attraction * alpha;

      posA.vx += (dx / dist) * force;
      posA.vy += (dy / dist) * force;
      posB.vx -= (dx / dist) * force;
      posB.vy -= (dy / dist) * force;
    });

    // Apply velocities and damping
    positions.forEach((pos) => {
      pos.x += pos.vx;
      pos.y += pos.vy;
      pos.vx *= damping;
      pos.vy *= damping;
    });
  }

  // Center the graph
  let minX = Infinity, minY = Infinity;
  positions.forEach((pos) => {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
  });

  return nodes.map((node) => {
    const pos = positions.get(node.id)!;
    return {
      ...node,
      position: {
        x: pos.x - minX + 50,
        y: pos.y - minY + 50,
      },
    };
  });
}

/**
 * Apply timeline layout - horizontal arrangement based on execution order
 */
export function applyTimelineLayout(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): WorkflowNode[] {
  if (nodes.length === 0) return nodes;

  // Build adjacency list and compute levels (topological order)
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  const levels = new Map<string, number>();

  nodes.forEach((node) => {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  });

  edges.forEach((edge) => {
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    adjacency.get(edge.source)?.push(edge.target);
  });

  // BFS to compute levels
  const queue: string[] = [];
  nodes.forEach((node) => {
    if (inDegree.get(node.id) === 0) {
      queue.push(node.id);
      levels.set(node.id, 0);
    }
  });

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentLevel = levels.get(current) || 0;

    adjacency.get(current)?.forEach((neighbor) => {
      const newLevel = currentLevel + 1;
      const existingLevel = levels.get(neighbor);
      if (existingLevel === undefined || newLevel > existingLevel) {
        levels.set(neighbor, newLevel);
      }

      const newInDegree = (inDegree.get(neighbor) || 1) - 1;
      inDegree.set(neighbor, newInDegree);
      if (newInDegree === 0) {
        queue.push(neighbor);
      }
    });
  }

  // Handle disconnected nodes
  nodes.forEach((node) => {
    if (!levels.has(node.id)) {
      levels.set(node.id, 0);
    }
  });

  // Group nodes by level
  const levelGroups = new Map<number, string[]>();
  let maxLevel = 0;
  levels.forEach((level, nodeId) => {
    maxLevel = Math.max(maxLevel, level);
    if (!levelGroups.has(level)) {
      levelGroups.set(level, []);
    }
    levelGroups.get(level)!.push(nodeId);
  });

  // Position nodes
  const horizontalGap = 300;
  const verticalGap = 120;

  return nodes.map((node) => {
    const level = levels.get(node.id) || 0;
    const nodesAtLevel = levelGroups.get(level) || [node.id];
    const indexInLevel = nodesAtLevel.indexOf(node.id);
    const totalAtLevel = nodesAtLevel.length;

    // Center nodes vertically within their level
    const startY = (totalAtLevel - 1) * verticalGap / -2 + 200;

    return {
      ...node,
      position: {
        x: 100 + level * horizontalGap,
        y: startY + indexInLevel * verticalGap,
      },
    };
  });
}

/**
 * Apply the specified layout algorithm
 */
export function applyLayout(
  preset: LayoutPreset,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): WorkflowNode[] {
  switch (preset) {
    case 'dagre':
      return applyDagreLayout(nodes, edges);
    case 'force':
      return applyForceLayout(nodes, edges);
    case 'timeline':
      return applyTimelineLayout(nodes, edges);
    case 'manual':
    default:
      return nodes;
  }
}
