# NEXUS Agent Handoff Protocol v1.0

## Purpose

Eliminate agent drift by enforcing structured handoffs between agents. Every agent must produce a standardized context block before completing. Every agent must consume the previous context block before starting.

No exceptions. No shortcuts. Drift dies here.

---

## The Core Rule

**An agent's work is not complete until it has written a valid handoff block.**

The orchestrator should reject any agent completion that doesn't include a properly formatted handoff.

---

## Handoff Block Schema

Every handoff must include these sections:

```yaml
handoff:
  from_agent: <agent_id>           # Who is handing off
  to_agent: <agent_id | "any">     # Specific next agent or open
  timestamp: <ISO 8601>
  task_id: <unique identifier>

  ## REQUIRED SECTIONS ##

  summary:
    what_was_done: |
      # 2-3 sentences max. What did this agent accomplish?

    decisions_made:
      - decision: <what was decided>
        rationale: <why - this prevents "why did we do this?" later>
        alternatives_rejected:
          - <option not taken and why>

    current_state:
      # Concrete description of where things stand RIGHT NOW
      files_modified: []
      files_created: []
      dependencies_added: []
      config_changes: []

  context_for_next_agent:
    must_know:
      # Critical context the next agent MUST understand
      # If they miss this, they WILL drift
      - <fact>
      - <constraint>
      - <assumption>

    original_intent: |
      # Restate the original goal. This is the anchor.
      # Drift happens when agents forget WHY they're doing something.

    scope_boundaries:
      in_scope:
        - <what is included>
      out_of_scope:
        - <what is explicitly NOT included - even if tempting>

  status:
    completion: <complete | partial | blocked>

    if_partial:
      remaining_work:
        - <specific task>
      why_stopping: |
        # Why hand off now instead of finishing?

    if_blocked:
      blocker: |
        # What's blocking progress?
      needs_from: <agent_id or "human">
      unblock_criteria: |
        # What needs to happen to unblock?

  next_steps:
    immediate:
      - <next action - be specific>
    suggested_approach: |
      # Optional: how the next agent might tackle this

    warnings:
      - <gotcha or trap to avoid>

  verification:
    how_to_verify: |
      # How can the next agent (or QA) verify this work is correct?
    test_commands: []
    expected_outcomes: []

  ## OPTIONAL SECTIONS ##

  technical_debt:
    - item: <what was deferred>
      reason: <why>
      severity: <low | medium | high>

  questions_for_human:
    - <question that needs Zach's input>

  links:
    - <relevant file paths, docs, external references>
```

---

## Agent-Specific Requirements

### System Architect → Full-Stack Developer

Architect MUST include:
- Component diagram or description
- API contracts / interfaces
- Data flow description
- Non-functional requirements (performance, security constraints)
- **Why this architecture** (prevents implementer from "improving" it)

Implementer MUST confirm:
- "I understand the architecture as: [restatement]"
- Any clarifying questions BEFORE coding

---

### Full-Stack Developer → Security Analyst

Developer MUST include:
- All external inputs and how they're handled
- Authentication/authorization approach
- Data storage and encryption details
- Third-party dependencies added
- Known security considerations

Security MUST NOT:
- Expand scope beyond security review
- Refactor for style/preference
- Add features

---

### Full-Stack Developer → QA Engineer

Developer MUST include:
- What to test (specific features/functions)
- How to test (setup, commands, expected results)
- Known limitations / edge cases
- What NOT to test (out of scope)

QA MUST NOT:
- File bugs for out-of-scope issues
- Request features disguised as bugs
- Expand test scope without explicit approval

---

### QA Engineer → Full-Stack Developer (Bug Loop)

QA MUST include:
- Reproduction steps (exact)
- Expected vs actual behavior
- Severity assessment
- **Is this a bug or a feature request?** (be honest)

Developer receiving bug:
- Fix the bug. Nothing else.
- If fix requires architecture change → escalate to Architect
- Do not "while I'm in here" other changes

---

### Security Analyst → Full-Stack Developer (Fix Loop)

Security MUST include:
- Specific vulnerability identified
- Severity (critical/high/medium/low)
- Remediation recommendation
- What constitutes "fixed"

Developer receiving security fix:
- Fix the specific issue
- Do not refactor surrounding code
- Security re-reviews the specific fix only

---

### Any Agent → DevOps Engineer

Handoff MUST include:
- What needs to be deployed/configured
- Environment requirements
- Secrets/config needed (not the values, just what's needed)
- Rollback criteria

DevOps MUST NOT:
- Modify application code
- Change architecture
- "Optimize" things not in scope

---

## Anti-Drift Rules

These are explicit rules to prevent the most common drift patterns:

### 1. No Scope Creep
If an agent notices something outside their current task, they:
- Log it in `technical_debt` or `questions_for_human`
- Do NOT fix it
- Continue with original task

### 2. No "While I'm Here" Changes
An agent may only modify what's required for their current task. Adjacent improvements are logged, not implemented.

### 3. Original Intent is Sacred
Every handoff restates `original_intent`. If an agent's work doesn't serve the original intent, they stop and escalate.

### 4. Explicit > Implicit
Never assume the next agent knows something. Over-communicate in handoffs. Redundancy is fine. Lost context is not.

### 5. Questions Pause Work
If an agent has a question that could change direction, they:
- STOP
- Document the question
- Hand off with `status: blocked`
- Wait for answer before continuing

### 6. Verify Before Verify
Before QA tests, they confirm with the developer: "I'm testing X, Y, Z - correct?" This prevents testing the wrong things.

---

## Orchestrator Enforcement

The central orchestrator should:

1. **Validate handoff schema** - Reject malformed handoffs
2. **Check required fields** - All REQUIRED sections must be present
3. **Log all handoffs** - Append-only log for debugging drift
4. **Alert on blocked status** - Notify Zach when human input needed
5. **Enforce agent boundaries** - Architect can't commit code, QA can't modify code, etc.

---

## Context File Structure

The shared context file should be structured as:

```
/nexus/projects/<project_id>/
├── CURRENT_STATE.yaml       # Latest handoff block (single source of truth)
├── ORIGINAL_BRIEF.md        # Never modified after creation
├── handoff_log/
│   ├── 001_architect_to_implementer.yaml
│   ├── 002_implementer_to_security.yaml
│   └── ...
├── decisions/
│   └── DECISION_LOG.md      # All decisions with rationale
└── artifacts/
    └── <files produced by agents>
```

**ORIGINAL_BRIEF.md** is immutable. It's the anchor. Any agent can reference it to check if they're drifting.

---

## Handoff Checklist (For Each Agent)

Before marking task complete:

- [ ] Wrote valid handoff block with all required sections
- [ ] Restated original intent (copy from brief or previous handoff)
- [ ] Listed all decisions with rationale
- [ ] Defined scope boundaries (in/out)
- [ ] Specified how to verify my work
- [ ] Flagged any blockers or questions
- [ ] Did NOT touch anything outside my task scope
- [ ] Logged any observed issues as technical debt (not fixed)

---

## Example Handoff

```yaml
handoff:
  from_agent: architect
  to_agent: implementer
  timestamp: 2026-01-25T19:30:00Z
  task_id: nexus-001-user-auth

  summary:
    what_was_done: |
      Designed authentication system for the store AI server.
      Chose JWT-based auth with refresh tokens, local user database.

    decisions_made:
      - decision: Use JWT instead of session cookies
        rationale: Stateless, works better for API-first design, easier to scale
        alternatives_rejected:
          - Session cookies: Would require session store, adds complexity
          - OAuth only: Overkill for local deployment, adds external dependency

      - decision: SQLite for user database
        rationale: Local deployment, no need for separate DB server, simple backup
        alternatives_rejected:
          - PostgreSQL: Overkill for expected user count (<50)

    current_state:
      files_modified: []
      files_created:
        - /docs/auth-architecture.md
        - /docs/api-contracts/auth-endpoints.yaml
      dependencies_added: []
      config_changes: []

  context_for_next_agent:
    must_know:
      - Auth is LOCAL only - no external identity providers
      - Max 50 users expected - don't over-engineer
      - Must work offline (no external API calls for auth)

    original_intent: |
      Build authentication for the store AI server POC.
      Simple, secure, local-only. No bells and whistles.

    scope_boundaries:
      in_scope:
        - User registration
        - Login/logout
        - JWT token generation and validation
        - Password hashing
      out_of_scope:
        - Role-based permissions (later phase)
        - OAuth/social login
        - Multi-factor authentication
        - Password reset via email

  status:
    completion: complete

  next_steps:
    immediate:
      - Implement /auth/register endpoint
      - Implement /auth/login endpoint
      - Implement JWT middleware
    suggested_approach: |
      Start with the JWT middleware so you can test auth on any endpoint.
      Then register, then login.
    warnings:
      - Don't add role checks yet - that's phase 2
      - Don't add email - we're offline-first

  verification:
    how_to_verify: |
      - Can register a user
      - Can login and receive JWT
      - Protected endpoints reject without valid JWT
      - Tokens expire correctly
    test_commands:
      - curl -X POST /auth/register -d '{"username":"test","password":"test123"}'
      - curl -X POST /auth/login -d '{"username":"test","password":"test123"}'
    expected_outcomes:
      - 201 on successful registration
      - 200 with JWT on successful login
      - 401 on protected endpoint without token
```

---

## Implementation Checklist for NEXUS

To implement this protocol:

- [ ] Add handoff schema validation to orchestrator
- [ ] Create project folder structure template
- [ ] Add ORIGINAL_BRIEF.md requirement for new projects
- [ ] Implement handoff logging (append-only)
- [ ] Add agent boundary enforcement
- [ ] Create handoff block templates for each agent type
- [ ] Test with a small project end-to-end

---

## Iteration

This is v1.0. After running a few projects through it:
- What's missing?
- What's annoying/overhead?
- Where does drift still happen?

Update the protocol. The goal is minimum viable structure that kills drift - not bureaucracy.

---

*Protocol created: 2026-01-25*
*For: NEXUS - Neural EXecution Unified System*
