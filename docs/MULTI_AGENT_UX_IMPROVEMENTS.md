# NEXUS Multi-Agent UX Improvements

## Overview

This document outlines comprehensive UX and UI improvements for multi-agent visualization and interaction in NEXUS, focusing on interactive Mermaid-esque charts, real-time status visualization, and enhanced workflow management.

---

## 1. Enhanced Interactive Workflow Canvas

### 1.1 Hierarchical Node Groups (Subgraphs)

Create collapsible node groups for organizing related agents:

```
┌─────────────────────────────────────┐
│ ▼ Code Generation Pipeline          │
│  ┌─────────┐    ┌─────────┐        │
│  │Architect│───▶│Implement│        │
│  └─────────┘    └─────────┘        │
│       │              │              │
│       └──────┬───────┘              │
│              ▼                      │
│        ┌─────────┐                  │
│        │ Tester  │                  │
│        └─────────┘                  │
└─────────────────────────────────────┘
```

**Implementation**: New `SubgraphNode` component with expand/collapse

### 1.2 Live Data Flow Edges

Enhance edges to show real-time message passing:

```
[Agent A] ══════●●●●═══▶ [Agent B]
                ↑
         Message packets
         (size = data volume)
```

**Features**:
- Animated particles sized by data volume
- Pulse speed indicates throughput
- Color indicates message type (data/command/status)
- Click edge to see message history

### 1.3 Smart Auto-Layout

Implement automatic graph layouts:

- **Dagre**: Hierarchical DAG layout (default)
- **Force-directed**: For exploring relationships
- **Timeline**: Left-to-right execution order
- **Circular**: For cyclic/feedback patterns

---

## 2. Agent Status Timeline View

### 2.1 Gantt-Style Execution Timeline

```
Timeline View
─────────────────────────────────────────────────────────────
                    0s      5s      10s     15s     20s
Orchestrator   ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
Architect      ░░░░████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░
Implementer-1  ░░░░░░░░░░░░████████████████░░░░░░░░░░░░░░░
Implementer-2  ░░░░░░░░░░░░████████████░░░░░░░░░░░░░░░░░░░
Tester         ░░░░░░░░░░░░░░░░░░░░░░░░░░░░████████████░░░
               ─────────────────────────────────────────────
Legend: ████ Running  ░░░░ Idle  ▓▓▓▓ Blocked  ╳╳╳╳ Failed
```

**Interactive Features**:
- Hover for detailed status at point in time
- Click to jump to that agent's terminal output
- Drag to scrub through execution history
- Zoom in/out on timeline

### 2.2 Agent State Machine View

Visual representation of agent lifecycle:

```
        ┌─────────┐
        │  Idle   │◀──────────────────┐
        └────┬────┘                   │
             │ spawn                  │ complete
             ▼                        │
        ┌─────────┐              ┌────┴────┐
        │Starting │─────────────▶│Completed│
        └────┬────┘              └─────────┘
             │ ready                  ▲
             ▼                        │ success
        ┌─────────┐    pause     ┌────┴────┐
        │ Running │◀────────────▶│ Paused  │
        └────┬────┘    resume    └─────────┘
             │ error
             ▼
        ┌─────────┐
        │ Failed  │──────▶ [Retry] ──▶ Starting
        └─────────┘
```

---

## 3. Real-Time Communication Panel

### 3.1 Message Flow Sidebar

```
┌─────────────────────────────────────┐
│ Agent Communication                 │
├─────────────────────────────────────┤
│ ● 14:32:05  Orchestrator → ALL     │
│   "Starting code generation task"   │
│                                     │
│ ● 14:32:06  Orchestrator → Architect│
│   { task: "Design API schema" }     │
│                                     │
│ ● 14:32:08  Architect → Implementer │
│   { schema: {...}, files: [...] }   │
│                                     │
│ ◐ 14:32:10  Implementer (thinking)  │
│   Generating code for user.ts...    │
└─────────────────────────────────────┘
```

### 3.2 Interactive Message Inspector

Click any message to see:
- Full payload (JSON viewer with syntax highlighting)
- Source/destination agents
- Timestamp and latency
- Message type and schema
- Related messages (thread view)

---

## 4. Workflow Templates Gallery

### 4.1 Pre-built Workflow Templates

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  ◆ API Builder  │  │ ◆ Code Review   │  │ ◆ Full Stack    │
│                 │  │                 │  │                 │
│  ○──○──○──○     │  │    ○──○         │  │  ○──┬──○──○     │
│                 │  │   / \          │  │     │           │
│  4 agents       │  │  ○   ○         │  │     ○──○        │
│  ~15 min        │  │                 │  │                 │
└─────────────────┘  │  3 agents       │  │  6 agents       │
                     │  ~5 min         │  │  ~30 min        │
                     └─────────────────┘  └─────────────────┘
```

### 4.2 Template Customization

- Drag-and-drop agents to modify templates
- Save custom workflows as new templates
- Share templates with team

---

## 5. Enhanced Node Visualizations

### 5.1 Rich Agent Node Design

```
┌──────────────────────────────────────┐
│ ⚡ Code Implementer            [▶/⏸] │
├──────────────────────────────────────┤
│ Status: ● Running (2m 34s)           │
│ Progress: ███████████░░░░ 73%        │
├──────────────────────────────────────┤
│ Current Task:                        │
│ "Implementing UserService.ts"        │
├──────────────────────────────────────┤
│ Tokens: 12.4k ↑  8.2k ↓              │
│ Files: 3 created, 2 modified         │
└──────────────────────────────────────┘
```

### 5.2 Mini Terminal Preview

Show last 3 lines of agent output directly on node:

```
┌─────────────────────────────┐
│ 🤖 Implementer              │
├─────────────────────────────┤
│ > Creating user model...    │
│ > Adding validation...      │
│ > Writing tests... ▌        │
├─────────────────────────────┤
│ [Expand Terminal]           │
└─────────────────────────────┘
```

---

## 6. Workflow Execution Insights

### 6.1 Performance Metrics Dashboard

```
┌─────────────────────────────────────────────────────────┐
│ Workflow Analytics                                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Total Time        Agents Used       Token Usage        │
│  ┌─────────┐       ┌─────────┐       ┌─────────┐       │
│  │  4m 23s │       │    5    │       │  45.2k  │       │
│  └─────────┘       └─────────┘       └─────────┘       │
│                                                         │
│  Execution Timeline                                     │
│  ═══●════════●══════════●════════●═══▶                 │
│     │        │          │        │                      │
│   Start   Architect  Implement  Complete                │
│                                                         │
│  Agent Performance                                      │
│  ┌────────────────────────────────────────────────┐    │
│  │ Architect     ████████░░░░░░░░░░░░  2m 10s     │    │
│  │ Implementer-1 ██████████████░░░░░░  3m 45s     │    │
│  │ Implementer-2 ████████████░░░░░░░░  3m 02s     │    │
│  │ Tester        ██████░░░░░░░░░░░░░░  1m 30s     │    │
│  └────────────────────────────────────────────────┘    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 6.2 Bottleneck Detection

Automatically highlight:
- Longest-running agents
- Blocked dependencies
- Failed retries
- High token consumption

---

## 7. Interactive Controls

### 7.1 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Space` | Play/Pause workflow |
| `R` | Run workflow |
| `S` | Stop all agents |
| `A` | Add agent node |
| `Delete` | Remove selected |
| `⌘/Ctrl + Z` | Undo |
| `⌘/Ctrl + Shift + Z` | Redo |
| `⌘/Ctrl + S` | Save workflow |
| `F` | Fit view |
| `1-9` | Select layout preset |

### 7.2 Context Menu

Right-click on node:
```
┌────────────────────┐
│ ▶ Run Agent        │
│ ⏸ Pause Agent      │
│ ⏹ Stop Agent       │
│ ───────────────────│
│ 📋 Copy Agent      │
│ 📝 Edit Config     │
│ 🔗 View Connections│
│ ───────────────────│
│ 🗑 Delete          │
└────────────────────┘
```

### 7.3 Multi-Select Operations

- Drag rectangle to select multiple nodes
- Shift+click to add to selection
- Batch operations: delete, duplicate, group

---

## 8. Collaboration Features

### 8.1 Live Cursors

Show other users viewing the workflow:
```
     ┌─ 👤 Alice (viewing)
     │
[Node]──────[Node]
                │
                └─ 👤 Bob (editing)
```

### 8.2 Execution History

```
┌─────────────────────────────────────┐
│ Execution History                   │
├─────────────────────────────────────┤
│ ✓ Jan 24, 14:30  Success  4m 23s   │
│ ✓ Jan 24, 12:15  Success  5m 01s   │
│ ✗ Jan 24, 10:00  Failed   2m 45s   │
│ ✓ Jan 23, 16:45  Success  4m 12s   │
└─────────────────────────────────────┘
```

Click to replay any execution with timeline scrubber.

---

## 9. Mobile/Responsive Considerations

### 9.1 Compact Node View

On smaller screens, show minimal nodes:
```
┌──────┐     ┌──────┐
│ 🏗️ A │────▶│ 💻 I │
└──────┘     └──────┘
```

### 9.2 Touch Gestures

- Pinch to zoom
- Two-finger pan
- Long-press for context menu
- Double-tap to expand node

---

## 10. Implementation Priority

### Phase 1: Core Enhancements (High Impact)
1. ✅ Live data flow edges with message indicators
2. ✅ Rich agent node cards with mini-terminal
3. ✅ Keyboard shortcuts
4. ✅ Gantt-style timeline view

### Phase 2: Advanced Features
5. Workflow templates gallery
6. Performance metrics dashboard
7. Message flow sidebar
8. Auto-layout algorithms

### Phase 3: Collaboration
9. Execution history and replay
10. Live cursors and presence
11. Shared workflow editing

---

## Technical Implementation Notes

### Dependencies to Add
```json
{
  "dagre": "^0.8.5",
  "@dagrejs/dagre": "^1.0.4",
  "elkjs": "^0.9.3",
  "d3-hierarchy": "^3.1.2",
  "react-virtualized-auto-sizer": "^1.0.24"
}
```

### New Components Structure
```
src/components/
├── Workflow/
│   ├── WorkflowCanvas.tsx (enhanced)
│   ├── AgentNode/
│   │   ├── AgentNode.tsx
│   │   ├── AgentNodeExpanded.tsx
│   │   ├── MiniTerminal.tsx
│   │   └── NodeControls.tsx
│   ├── Edges/
│   │   ├── DataFlowEdge.tsx
│   │   ├── MessageIndicator.tsx
│   │   └── EdgeLabel.tsx
│   ├── Timeline/
│   │   ├── ExecutionTimeline.tsx
│   │   ├── TimelineTrack.tsx
│   │   └── TimelineScrubber.tsx
│   ├── Sidebar/
│   │   ├── MessagePanel.tsx
│   │   ├── MessageInspector.tsx
│   │   └── AgentDetails.tsx
│   ├── Templates/
│   │   ├── TemplateGallery.tsx
│   │   └── TemplateCard.tsx
│   └── Analytics/
│       ├── MetricsDashboard.tsx
│       ├── PerformanceChart.tsx
│       └── BottleneckAlert.tsx
```

### State Management Extensions
```typescript
// workflowStore.ts additions
interface WorkflowState {
  // ... existing

  // Timeline state
  executionHistory: ExecutionRecord[];
  currentTimestamp: number;
  isReplaying: boolean;

  // Message tracking
  messages: AgentMessage[];
  selectedMessage: string | null;

  // Layout
  layoutAlgorithm: 'dagre' | 'force' | 'timeline' | 'circular';

  // Collaboration
  activeUsers: User[];
  cursorPositions: Map<string, Position>;
}
```

---

## References

- [React Flow Documentation](https://reactflow.dev)
- [Anthropic Multi-Agent Research System](https://www.anthropic.com/engineering/multi-agent-research-system)
- [Azure AI Agent Design Patterns](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns)
- [n8n Multi-Agent Systems](https://blog.n8n.io/multi-agent-systems/)
