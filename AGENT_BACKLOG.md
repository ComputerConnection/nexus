# NEXUS Agent Backlog

> Auto-generated task backlog for AI agents. Tasks are prioritized and assignable.

---

## Critical Priority

### CRIT-001: Enable Database Persistence
- **Status:** Open
- **Assignee:** Unassigned
- **Files:** `src-tauri/src/lib.rs`, `src-tauri/src/commands/*.rs`
- **Description:** All data (projects, workflows, agents) is stored in-memory DashMaps. App restart loses everything. Need to wire up the existing database layer.
- **Acceptance Criteria:**
  - Projects persist to PostgreSQL
  - Workflows persist to PostgreSQL
  - Agent history persists to PostgreSQL

### CRIT-002: Fix Hardcoded Working Directory
- **Status:** COMPLETED
- **Assignee:** Claude
- **Files:** `src/pages/CommandCenter.tsx`
- **Description:** All agents spawn with `/tmp` as working directory, ignoring project context.
- **Resolution:** Added project selector dropdown in Command Center. Agents now use selected project's working directory.

### CRIT-003: Implement Agent Pause/Resume
- **Status:** COMPLETED
- **Assignee:** Claude
- **Files:** `src-tauri/src/commands/agent.rs`, `src-tauri/src/process/registry.rs`, `src/pages/AgentGrid.tsx`
- **Description:** Pause/Resume buttons in UI do nothing. Need SIGSTOP/SIGCONT implementation.
- **Resolution:**
  - Added `pause_agent` and `resume_agent` backend commands with SIGSTOP/SIGCONT
  - Added `restartAgent` command
  - Wired up UI dropdown buttons to call these commands
  - Status updates emitted via events

### CRIT-004: Implement Workflow Save/Load
- **Status:** COMPLETED
- **Assignee:** Claude
- **Files:** `src/pages/EnhancedWorkflowEditor.tsx`, `src/stores/workflowStore.ts`
- **Description:** Save/Load buttons just console.log(). Need actual persistence.
- **Resolution:**
  - Added `saveCurrentWorkflow`, `updateWorkflow`, `deleteWorkflow` to workflowStore
  - Implemented Save dialog with name/description inputs
  - Implemented Load dialog with workflow list and delete option
  - Added toast notifications for save/load/delete operations
  - Workflows persist in-memory (full database persistence pending CRIT-001)

### CRIT-005: Fix Progress Tracking
- **Status:** COMPLETED
- **Assignee:** Claude
- **Files:** `src-tauri/src/process/manager.rs`, `src/stores/agentStore.ts`
- **Description:** Progress always shows 0%. Need mechanism to report/estimate progress.
- **Resolution:**
  - Added progress event emission on agent start (5%)
  - Added progress event emission on agent completion (100%)
  - UI listens to `agent-progress` events and updates progress bars
  - AppState agent progress updated on completion

### CRIT-006: Implement Activity Logging
- **Status:** COMPLETED
- **Assignee:** Claude
- **Files:** `src/stores/activityStore.ts`, `src/pages/CommandCenter.tsx`
- **Description:** "Recent Activity" section is hardcoded placeholder.
- **Resolution:**
  - Created activityStore with activity types and logging helpers
  - Integrated logging into agentStore (spawn, kill, complete, fail)
  - Integrated logging into projectStore (create, delete)
  - Integrated logging into workflowStore (start, complete, fail)
  - CommandCenter displays real activities with icons and relative timestamps

---

## High Priority

### HIGH-001: Fix Project Tab Filtering
- **Status:** COMPLETED
- **Assignee:** Claude
- **Files:** `src/pages/ProjectHub.tsx`
- **Description:** All/Active/Completed tabs show same projects regardless of selection.
- **Resolution:**
  - Added `activeTab` state
  - Filter logic now respects tab selection
  - Counts displayed on each tab

### HIGH-002: Implement Project Dropdown Actions
- **Status:** COMPLETED
- **Assignee:** Claude
- **Files:** `src/pages/ProjectHub.tsx`
- **Description:** Launch, Edit, Open Directory buttons have no handlers.
- **Resolution:**
  - Launch: Selects project and navigates to Command Center
  - Edit: Prompts for new name and updates project
  - Open Directory: Opens file manager via Tauri shell plugin

### HIGH-003: Add Input Validation
- **Status:** COMPLETED
- **Assignee:** Claude
- **Files:** `src-tauri/src/commands/project.rs`
- **Description:** No validation on project names, paths, or descriptions.
- **Resolution:**
  - Project name: 1-100 chars, no filesystem-unsafe characters
  - Working directory: Must be absolute path with existing parent
  - Description: Max 500 chars
  - Status: Must be one of active/completed/paused/archived

### HIGH-004: Replace Mock Workflow Data
- **Status:** COMPLETED
- **Assignee:** Claude
- **Files:** `src/pages/EnhancedWorkflowEditor.tsx`, `src/stores/workflowStore.ts`
- **Description:** Timeline and messages use random/hardcoded mock data.
- **Resolution:**
  - Added WorkflowMessage type to track inter-agent communication
  - Added executionStartTime tracking for timeline synchronization
  - Timeline now shows actual node execution times with start/complete timestamps
  - Messages panel shows real execution events (agent started, completed, failed)
  - Status changes automatically generate messages for visibility

### HIGH-005: Implement Command Palette Actions
- **Status:** COMPLETED
- **Assignee:** Claude
- **Files:** `src/components/ui/CommandPalette.tsx`
- **Description:** 8+ actions are console.log() stubs.
- **Resolution:**
  - Navigation commands already worked (Go to Command Center, Agents, Workflows, Projects)
  - Spawn Agent navigates to Agents page with toast guidance
  - New Project navigates to Projects page with toast guidance
  - New Workflow clears canvas and navigates to Workflows
  - Pause All pauses running agents via SIGSTOP
  - Kill All terminates active agents
  - Settings shows "coming soon" toast (pending MED-005)

---

## Medium Priority

### MED-001: Add Agent Restart to UI
- **Status:** COMPLETED
- **Assignee:** Claude
- **Files:** `src/pages/AgentGrid.tsx`, `src/services/tauri.ts`
- **Description:** `restart_agent` backend command exists but no UI button.
- **Resolution:** Added Restart button to agent dropdown menu, wired up to backend command with toast notifications

### MED-002: Implement Voice Input
- **Status:** Open
- **Assignee:** Unassigned
- **Files:** `src/pages/CommandCenter.tsx`, `src/hooks/useSpeechRecognition.ts`
- **Description:** Mic button renders but has no functionality.
- **Acceptance Criteria:**
  - Click mic starts speech recognition
  - Transcription fills task input
  - Visual feedback during listening

### MED-003: Virtualize Terminal Output
- **Status:** Open
- **Assignee:** Unassigned
- **Files:** `src/pages/AgentGrid.tsx:306-315`
- **Description:** 1000 lines rendered as separate DOM nodes causes lag.
- **Acceptance Criteria:**
  - Use react-window or similar for virtualization
  - Smooth scrolling with 10k+ lines
  - Auto-scroll to bottom maintained

### MED-004: Add Terminal Syntax Highlighting
- **Status:** COMPLETED
- **Assignee:** Claude
- **Files:** `src/pages/AgentGrid.tsx`
- **Description:** All output is plain text, no color coding.
- **Resolution:**
  - Added TerminalLine component with smart syntax highlighting
  - Errors (error, failed, fatal, exception) shown in red
  - Warnings (warning, warn) shown in yellow
  - Success messages (success, completed, passed, done) shown in green
  - System messages (emoji, brackets) shown in cyan
  - Code keywords (def, function, class, etc.) shown in purple
  - File paths shown in blue

### MED-005: Create Settings Panel
- **Status:** Open
- **Assignee:** Unassigned
- **Files:** New component needed
- **Description:** No settings UI exists.
- **Acceptance Criteria:**
  - Database connection settings
  - Default working directory
  - Theme selection
  - API configuration

### MED-006: Add Workflow Validation
- **Status:** COMPLETED
- **Assignee:** Claude
- **Files:** `src-tauri/src/commands/workflow.rs`, `src/stores/workflowStore.ts`, `src/services/tauri.ts`
- **Description:** Can create invalid workflows (cycles, disconnected nodes).
- **Resolution:**
  - Added `validate_workflow` backend command
  - Detects cycles using topological sort (existing in graph.rs)
  - Identifies disconnected nodes (no incoming or outgoing edges)
  - Reports root nodes, leaf nodes, execution levels
  - Added frontend binding and store action for validation

---

## Low Priority

### LOW-001: Add Project Templates
- **Status:** Open
- **Assignee:** Unassigned
- **Description:** Quick-start templates for common project types.

### LOW-002: Add Workflow Templates
- **Status:** Open
- **Assignee:** Unassigned
- **Description:** Pre-built workflows for common tasks (code review, testing, etc.)

### LOW-003: Export/Import Workflows
- **Status:** Open
- **Assignee:** Unassigned
- **Description:** Share workflows as JSON files.

### LOW-004: Agent Communication Persistence
- **Status:** Open
- **Assignee:** Unassigned
- **Description:** Store inter-agent messages for replay/debugging.

### LOW-005: Advanced Search/Filter
- **Status:** Open
- **Assignee:** Unassigned
- **Description:** Filter agents by status, projects by date, etc.

---

## Completed

- **ORCH-001:** Enhanced Agent Orchestration - Complete overhaul with inter-agent data flow, retry logic, conditional execution, checkpointing, and adaptive planning

- **CRIT-002:** Fix Hardcoded Working Directory - Added project selector to Command Center
- **CRIT-003:** Implement Agent Pause/Resume - SIGSTOP/SIGCONT with UI integration
- **CRIT-004:** Implement Workflow Save/Load - Save/Load dialogs with in-memory persistence
- **CRIT-005:** Fix Progress Tracking - Progress events on start (5%) and completion (100%)
- **CRIT-006:** Implement Activity Logging - Activity store with logging for agents, projects, workflows
- **HIGH-001:** Fix Project Tab Filtering - Tabs now filter correctly with counts
- **HIGH-002:** Implement Project Dropdown Actions - Launch, Edit, Open Directory working
- **HIGH-003:** Add Input Validation - Backend validation for projects
- **HIGH-005:** Implement Command Palette Actions - All commands now functional
- **MED-001:** Add Agent Restart to UI - Restart button in agent dropdown
- **MED-004:** Add Terminal Syntax Highlighting - Color-coded output by type
- **NEW-001:** AgentGrid Spawn Uses Project Context - Prompts for working directory

---

---

## Discovered Issues (New)

### NEW-001: AgentGrid Spawn Still Uses /tmp
- **Status:** COMPLETED
- **Assignee:** Claude
- **Files:** `src/pages/AgentGrid.tsx`
- **Description:** The "Spawn Agent" button in AgentGrid hardcodes `/tmp`. Should use project context or prompt.
- **Resolution:** Updated to prompt user for working directory with default suggestion

### NEW-002: TypeScript `any` Types in Components
- **Status:** Open
- **Assignee:** Unassigned
- **Files:** `src/pages/AgentGrid.tsx:232`, `src/pages/ProjectHub.tsx:171`
- **Description:** Several components use `any` type for agent/project props. Should use proper types.

### NEW-003: No Error Boundary in App
- **Status:** Open
- **Assignee:** Unassigned
- **Description:** App has no React error boundary. Uncaught errors crash the whole app.

### NEW-004: Agent Output Not Persisted
- **Status:** Open
- **Assignee:** Unassigned
- **Description:** Agent terminal output only kept in memory (last 1000 lines). No way to retrieve full history.

---

## Notes

- Tasks prefixed with priority level (CRIT/HIGH/MED/LOW)
- Update status to "In Progress" when starting
- Move to "Completed" section when done
- Add new tasks as discovered
