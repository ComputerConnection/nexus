# NEXUS Orchestrator

Central coordination system for NEXUS agent handoffs. Prevents drift, validates handoffs, and maintains project state.

## Installation

```bash
cd /home/zach-linux/nexus/orchestrator
pip install -r requirements.txt
```

## Quick Start

### CLI Usage

```bash
# Create a new project
python cli.py create-project store-ai-auth --brief ../templates/ORIGINAL_BRIEF.md

# List all projects
python cli.py list-projects

# Check project status
python cli.py project-status store-ai-auth

# Validate a handoff (without processing)
python cli.py validate-handoff my_handoff.yaml --from architect --to implementer

# Process a handoff (validate + apply)
python cli.py process-handoff store-ai-auth my_handoff.yaml --from architect

# Generate task prompt for an agent
python cli.py assign-task store-ai-auth --agent implementer --task "Build JWT authentication"

# Show template for an agent type
python cli.py show-template architect

# Show blocked projects needing human input
python cli.py blocked
```

### Python Usage

```python
from orchestrator import NexusOrchestrator, AgentInterface, AgentPromptBuilder

# Initialize orchestrator
orchestrator = NexusOrchestrator(project_dir="./projects")

# Create project
project = orchestrator.create_project(
    project_id="store-ai-auth",
    brief=open("ORIGINAL_BRIEF.md").read()
)

# Create agent interface
agent = AgentInterface(orchestrator, "implementer", "store-ai-auth")

# Get full context for task
context = agent.get_context()

# Build prompt for LLM agent
builder = AgentPromptBuilder(agent)
prompt = builder.build_task_prompt("Implement JWT authentication")

# ... agent does work ...

# Submit handoff
result = agent.submit_handoff(handoff_data)

if result['is_valid']:
    print(f"Handoff accepted: {result['handoff_id']}")
else:
    print(f"Handoff rejected: {result['errors']}")
```

## Components

### HandoffValidator
Validates handoff blocks against the protocol schema.

- Checks required fields
- Validates agent-specific sections
- Checks status-dependent fields
- Validates content quality (not just presence)

```python
from orchestrator import validate_handoff

result = validate_handoff(yaml_string, from_agent="architect")
print(result.is_valid, result.errors, result.warnings)
```

### NexusOrchestrator
Central coordinator for projects and handoffs.

- Creates and manages projects
- Processes and logs handoffs
- Tracks project state
- Detects drift against original brief

### AgentInterface
Interface for agents to interact with the orchestrator.

- Provides full task context
- Handles handoff submission
- Scope checking helpers
- Technical debt logging

### AgentPromptBuilder
Builds prompts for LLM-powered agents.

- Includes all context (brief, state, history)
- Agent-specific protocol reminders
- Anti-drift rules
- Handoff templates

## Project Structure

When you create a project, this structure is created:

```
projects/<project_id>/
├── ORIGINAL_BRIEF.md        # Immutable project anchor
├── CURRENT_STATE.yaml       # Latest handoff state
├── .state.yaml              # Project metadata
├── handoff_log/             # All handoffs (append-only)
│   ├── 001_architect_to_implementer.yaml
│   └── ...
├── decisions/
│   └── DECISION_LOG.md      # All decisions with rationale
├── artifacts/               # Files produced by agents
├── TECHNICAL_DEBT.md        # Logged technical debt
└── QUESTIONS_FOR_HUMAN.md   # Questions needing input
```

## Validation Rules

### Required for ALL Handoffs
- `handoff.from_agent`
- `handoff.to_agent`
- `handoff.task_id`
- `handoff.summary.what_was_done`
- `handoff.summary.decisions_made` (with rationale!)
- `handoff.summary.current_state`
- `handoff.context_for_next_agent.must_know`
- `handoff.context_for_next_agent.original_intent`
- `handoff.context_for_next_agent.scope_boundaries`
- `handoff.status.completion`
- `handoff.next_steps`
- `handoff.verification`

### Agent-Specific Requirements

**Architect:**
- `architecture.overview`
- `architecture.components`
- `next_steps.implementation_order`

**Implementer → Security:**
- `security_context.user_inputs`

**Implementer → Tester:**
- `testing_context.what_to_test`

**Security:**
- `summary.overall_assessment` (approved/needs_fixes/rejected)
- `summary.risk_level`

**Tester:**
- `test_results.summary`
- Bug `classification` (bug vs feature_request)

**DevOps:**
- `deployment.target`
- `rollback.plan`

### Status-Dependent Fields

If `status.completion` is `partial`:
- `if_partial.remaining_work`
- `if_partial.why_stopping`

If `status.completion` is `blocked`:
- `if_blocked.blocker`
- `if_blocked.needs_from`
- `if_blocked.unblock_criteria`

## Drift Detection

The orchestrator checks handoffs against the original brief to detect drift:

1. **Out of scope violations** - Working on items marked out of scope
2. **Missing original intent** - Not preserving the original intent
3. **Scope creep** - Adding features not in the brief

Drift issues become validation errors that block the handoff.

## Strict Mode

By default, the orchestrator runs in strict mode where warnings become errors. This prevents drift by catching quality issues early.

To run in non-strict mode:

```python
orchestrator = NexusOrchestrator(strict_mode=False)
```

## Anti-Drift Rules

These rules are enforced by the protocol:

1. **No Scope Creep** - Out of scope items are logged as tech debt, not built
2. **No "While I'm Here"** - Only modify what's required for the task
3. **Original Intent is Sacred** - Every handoff restates original_intent
4. **Explicit > Implicit** - Over-communicate in handoffs
5. **Questions Pause Work** - If unsure, stop and ask
6. **Verify Before Verify** - Confirm scope before working

## Integration with NEXUS Agents

To integrate with your LLM-powered agents:

1. Before agent starts: Use `AgentPromptBuilder.build_task_prompt()` to create the agent's input
2. After agent completes: Parse the agent's handoff output and call `agent.submit_handoff()`
3. Check `result['is_valid']` before proceeding to next agent

The prompt builder includes:
- Full project context
- Anti-drift rules
- Handoff template
- Agent-specific protocol reminders

---

*Part of NEXUS - Neural EXecution Unified System*
