# CHANGE ORDER

> Use this template when requirements change AFTER the ORIGINAL_BRIEF is created.
> The brief stays immutable; changes are documented here.

---

## Change Order Metadata

| Field | Value |
|-------|-------|
| **Change Order ID** | `CO-XXX` |
| **Project ID** | `PROJECT-XXX` |
| **Date** | [Date] |
| **Requested By** | [Zach / Stakeholder] |
| **Status** | `proposed` / `approved` / `rejected` / `implemented` |

---

## The Change

### What is changing?

> Clear description of what's being added, removed, or modified.

[CHANGE DESCRIPTION]

### Why is this changing?

> What triggered this change? New information? User feedback? Technical discovery?

[REASON FOR CHANGE]

---

## Impact Assessment

### Scope Impact

| Original Scope | Changed To | Impact |
|----------------|------------|--------|
| [Original item] | [New state] | [Added/Removed/Modified] |

### What's Being Added

- [ ] [New feature/requirement]
- [ ] [New feature/requirement]

### What's Being Removed

- [x] [Removed feature/requirement]
- [x] [Removed feature/requirement]

### What's Being Modified

| Original | Modified To |
|----------|-------------|
| [Original] | [New] |

---

## Agent Impact

> Which agents need to know about this change?

| Agent | Impact | Action Required |
|-------|--------|-----------------|
| Architect | [Impact] | [Redesign X / No action] |
| Implementer | [Impact] | [Rebuild X / Modify Y] |
| Security | [Impact] | [Re-review X / No action] |
| Tester | [Impact] | [New tests for X] |
| DevOps | [Impact] | [Redeploy / Config change] |

---

## Risk Assessment

### Does this change any Non-Negotiables?

- [ ] No - Non-negotiables remain intact
- [ ] Yes - See justification below

**If yes, justification:**
> [Why is this acceptable?]

### New Risks Introduced

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| [Risk] | Low/Med/High | Low/Med/High | [Mitigation] |

### Constraints Affected

- [ ] No constraints affected
- [ ] Technical constraints affected: [Which]
- [ ] Business constraints affected: [Which]
- [ ] Security constraints affected: [Which]

---

## Effort Assessment

### Additional Work Required

| Agent | Additional Work | Estimate |
|-------|-----------------|----------|
| Architect | [Work] | [Effort] |
| Implementer | [Work] | [Effort] |
| Security | [Work] | [Effort] |
| Tester | [Work] | [Effort] |
| DevOps | [Work] | [Effort] |

### Work to Discard

> Work already done that's now invalid.

- [x] [Work that needs to be redone/discarded]

---

## Updated Success Criteria

> If success criteria change, document the new version here.

**Original Criteria:**
- [ ] [Original criterion]

**New Criteria:**
- [ ] [New/modified criterion]

---

## Updated Definition of Done

> If definition of done changes, document here.

**Changes to completion criteria:**
- [Change]

---

## Approval

| Role | Name | Date | Decision |
|------|------|------|----------|
| Project Owner | Zach | [Date] | Approved / Rejected |

**Approval Notes:**
> [Any notes on the approval decision]

---

## Implementation Tracking

### Implementation Status

- [ ] Architect notified and updated design
- [ ] Implementer notified and updated code
- [ ] Security notified and updated review
- [ ] Tester notified and updated tests
- [ ] DevOps notified and updated deployment

### Handoff References

> Link to handoffs that implement this change.

| Agent | Handoff | Date |
|-------|---------|------|
| [Agent] | [Handoff file] | [Date] |

---

*This change order supplements but does not replace the ORIGINAL_BRIEF.*
*Agents should read both documents.*
