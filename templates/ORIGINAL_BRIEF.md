# ORIGINAL BRIEF

> **THIS DOCUMENT IS IMMUTABLE**
> Once created, this file must never be modified. It is the anchor that prevents drift.
> If requirements change, create a CHANGE_ORDER.md file instead.

---

## Project Metadata

| Field | Value |
|-------|-------|
| **Project ID** | `PROJECT-XXX` |
| **Project Name** | [Name] |
| **Created** | [Date] |
| **Created By** | [Zach / Human] |
| **Status** | `active` |

---

## The Problem

### What problem are we solving?

> Write 2-3 sentences describing the problem. Be specific.
> Bad: "We need better authentication"
> Good: "Users currently have no way to securely access the store AI server. Anyone on the network can hit the API endpoints."

[PROBLEM STATEMENT HERE]

### Why does this matter?

> What's the impact of NOT solving this?
> Who is affected?

[IMPACT STATEMENT HERE]

### Why now?

> Why are we solving this now instead of later?

[URGENCY/TIMING HERE]

---

## The Solution

### What are we building?

> Describe the solution in plain language. No jargon.
> A non-technical person should understand this.

[SOLUTION DESCRIPTION HERE]

### How will we know it works?

> What does success look like? Be concrete.

**Success Criteria:**
- [ ] [Criterion 1 - measurable]
- [ ] [Criterion 2 - measurable]
- [ ] [Criterion 3 - measurable]

### Who is this for?

> Primary users/beneficiaries

- **Primary User**: [Who]
- **Secondary Users**: [Who else]

---

## Scope

### In Scope (MUST have)

> What MUST be included for this to be considered complete?
> These are non-negotiable deliverables.

- [ ] [Feature/Deliverable 1]
- [ ] [Feature/Deliverable 2]
- [ ] [Feature/Deliverable 3]

### Out of Scope (NOT building)

> What are we explicitly NOT building?
> This is critical for preventing scope creep.
> If an agent wants to add something, they check here first.

- [x] [Feature explicitly excluded]
- [x] [Feature explicitly excluded]
- [x] [Feature explicitly excluded]
- [x] [Feature for future phase]

### Future Phases (Later, not now)

> Features planned for later. Agents should NOT build these now.

| Phase | Features | When |
|-------|----------|------|
| Phase 2 | [Features] | [After MVP] |
| Phase 3 | [Features] | [Future] |

---

## Constraints

### Technical Constraints

> Hard technical requirements that cannot be violated.

- [ ] **Must**: [Constraint - e.g., "Must run on Linux"]
- [ ] **Must**: [Constraint - e.g., "Must work offline"]
- [ ] **Must NOT**: [Constraint - e.g., "Must NOT require external API calls"]

### Business Constraints

> Business requirements that shape the solution.

- [ ] **Budget**: [Budget constraint if any]
- [ ] **Timeline**: [Deadline if any]
- [ ] **Resources**: [Team/resource constraints]

### Security/Privacy Constraints

> Non-negotiable security requirements.

- [ ] [Constraint - e.g., "All data must stay on-premises"]
- [ ] [Constraint - e.g., "No client data sent to external services"]

---

## Context

### Background

> What context does someone need to understand this project?
> Include relevant history, previous attempts, related systems.

[BACKGROUND HERE]

### Related Systems

> What existing systems does this interact with?

| System | Interaction | Notes |
|--------|-------------|-------|
| [System] | [How it interacts] | [Notes] |

### Stakeholders

> Who cares about this project?

| Stakeholder | Interest | Contact |
|-------------|----------|---------|
| Zach | [Interest] | Primary |
| [Other] | [Interest] | [Role] |

---

## Non-Negotiables

> Things that CANNOT be compromised. If an agent is about to violate these, they STOP and escalate.

1. **[Non-negotiable 1]**: [Why this matters]
2. **[Non-negotiable 2]**: [Why this matters]
3. **[Non-negotiable 3]**: [Why this matters]

---

## Assumptions

> What are we assuming to be true?
> If these assumptions are wrong, the project may need to change.

- **Assumption**: [Assumption 1]
  - **If wrong**: [Impact]

- **Assumption**: [Assumption 2]
  - **If wrong**: [Impact]

---

## Risks

> Known risks and how we'll handle them.

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| [Risk] | Low/Med/High | Low/Med/High | [How we'll handle it] |

---

## Definition of Done

> When is this project COMPLETE? Be explicit.

This project is complete when:

1. [ ] All "In Scope" items are delivered
2. [ ] All success criteria are met
3. [ ] Security review passed
4. [ ] QA testing passed
5. [ ] Deployed to [environment]
6. [ ] [Any other completion criteria]

---

## Agent Instructions

> Specific instructions for agents working on this project.

### For All Agents

- Reference this document when unsure if you're drifting
- If your work doesn't serve the Problem and Solution above, STOP
- Out of Scope items are OFF LIMITS - do not build them
- Non-Negotiables cannot be compromised - escalate if conflicting

### For Architect

- Design for the constraints listed above
- Don't over-engineer - this is [MVP/POC/production]
- [Specific architecture guidance]

### For Implementer

- Follow architect's design unless you have a blocking reason
- Stay within scope - log "nice to haves" as technical debt
- [Specific implementation guidance]

### For Security

- Review against the security constraints above
- This is [internal/external]-facing - adjust rigor accordingly
- [Specific security focus areas]

### For Tester

- Test against the success criteria above
- Out of scope features are NOT bugs
- [Specific testing guidance]

### For DevOps

- Deploy to [environment] only
- [Specific deployment requirements]

---

## Approval

> Sign-off that this brief is complete and accurate.

| Role | Name | Date | Approved |
|------|------|------|----------|
| Project Owner | Zach | [Date] | [ ] |

---

## Change Orders

> If requirements change after this brief is created, document them here with links to CHANGE_ORDER files.

| Change Order | Date | Summary | Link |
|--------------|------|---------|------|
| None yet | - | - | - |

---

*This document is the source of truth. When in doubt, return here.*
