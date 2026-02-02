# ORIGINAL BRIEF

> **THIS DOCUMENT IS IMMUTABLE**
> Once created, this file must never be modified. It is the anchor that prevents drift.
> If requirements change, create a CHANGE_ORDER.md file instead.

---

## Project Metadata

| Field | Value |
|-------|-------|
| **Project ID** | `store-ai-poc` |
| **Project Name** | Computer Connection Local AI Server POC |
| **Created** | 2026-01-25 |
| **Created By** | Zach |
| **Status** | `active` |

---

## The Problem

### What problem are we solving?

Computer Connection currently runs on manual processes, spreadsheets, and disconnected systems. There's no central intelligence that can answer questions about store operations, provide SOPs to staff, or give insights from business data. Staff have to dig through files or ask Zach directly for information that should be instantly accessible.

Additionally, Zach wants to offer AI solutions to local SMBs, but needs a working proof of concept to demonstrate the value and refine the offering before selling to clients.

### Why does this matter?

- **For the store**: Reduces Zach's bottleneck, empowers staff, surfaces insights from data
- **For the business**: Creates a demonstrable product to sell to other local businesses
- **For clients**: Privacy-first local AI that doesn't send their data to the cloud

### Why now?

- Debt nearly paid off, ready to invest in growth
- AI capabilities have reached the point where local deployment is viable
- First-mover advantage in OKC market for local AI solutions
- Store is the perfect testing ground before selling to clients

---

## The Solution

### What are we building?

A locally hosted AI server at the Computer Connection store that:
1. Answers questions about store operations using local data
2. Provides store SOPs to staff on demand
3. Monitors and reports on business metrics
4. Integrates with existing POS and bookkeeping systems
5. Runs entirely on-premises with no cloud dependencies

This is the **proof of concept** - minimal viable product to validate the approach before productizing for clients.

### How will we know it works?

**Success Criteria:**
- [ ] AI can answer basic questions about store operations ("What were sales last week?")
- [ ] AI can retrieve and explain store SOPs ("How do we handle a return?")
- [ ] System runs entirely locally with no external API calls for inference
- [ ] Staff can interact with AI through simple interface (web or chat)
- [ ] System stays running reliably for 1 week without intervention
- [ ] Zach can demo this to a potential client

### Who is this for?

- **Primary User**: Computer Connection staff (for daily use)
- **Secondary Users**: Zach (for monitoring, demo purposes)
- **Future Users**: Local SMB clients (after POC validated)

---

## Scope

### In Scope (MUST have for POC)

- [ ] Local LLM deployment (Ollama or similar)
- [ ] Simple web interface for chat interaction
- [ ] Document ingestion for SOPs (PDF/markdown)
- [ ] Basic RAG (retrieval augmented generation) for SOP queries
- [ ] Read-only integration with one data source (POS export or bookkeeping CSV)
- [ ] Basic reporting ("What were sales for X period?")
- [ ] Health monitoring / uptime dashboard
- [ ] Single-user or simple auth (not multi-tenant)

### Out of Scope (NOT building in POC)

- [x] Multi-tenant architecture (that's for client version)
- [x] Real-time POS integration (read from exports for now)
- [x] Foot traffic tracking / cameras (phase 2)
- [x] Complex analytics or dashboards
- [x] Mobile app
- [x] Voice interface
- [x] Fine-tuning custom models
- [x] Automated actions (AI just reads/reports, doesn't modify)
- [x] Integration with multiple data sources simultaneously
- [x] Production hardening / HA / redundancy
- [x] Client billing or subscription management
- [x] Ubiquiti network integration (future)
- [x] PoE deployment (future - POC runs on existing hardware)

### Future Phases (Later, not now)

| Phase | Features | When |
|-------|----------|------|
| Phase 2 | Foot traffic tracking, real-time POS integration, multiple data sources | After POC validated |
| Phase 3 | Multi-tenant for clients, Ubiquiti network integration, PoE devices | When selling to clients |
| Phase 4 | Mobile app, voice interface, automated actions | Based on demand |

---

## Constraints

### Technical Constraints

- [x] **Must**: Run entirely on local hardware (no cloud inference)
- [x] **Must**: Work on existing store network
- [x] **Must**: Run on Linux (development environment)
- [x] **Must**: Be deployable to Windows (for future clients)
- [x] **Must NOT**: Send any business data to external services
- [x] **Must NOT**: Require internet connection for core functionality

### Hardware Constraints

- [x] **Available**: Consumer GPU (RTX 30/40 series) for inference
- [x] **Available**: Server/workstation hardware
- [ ] **Budget**: Use existing hardware for POC, minimize new purchases

### Business Constraints

- [ ] **Timeline**: Working POC within 6 months (by July 2026)
- [ ] **Resources**: Zach + AI assistance (no dedicated dev team)
- [ ] **Budget**: Bootstrap - minimize costs until POC proves value

### Security/Privacy Constraints

- [x] All data stays on-premises
- [x] No client/business data sent to external APIs
- [x] Basic auth to prevent unauthorized access
- [x] Audit log of queries (who asked what, when)

---

## Context

### Background

Computer Connection is the #1 PC store in OKC, running since the 1990s. Zach took over in 2020 and has grown the business through IT support and hardware sales. The next growth vector is AI-powered software solutions for local businesses.

This POC serves dual purposes:
1. Improve Computer Connection's own operations
2. Create a demonstrable product to sell to local SMBs

The target client profile for future sales: local businesses with privacy concerns (legal, medical, accounting firms) who want AI capabilities but can't/won't use cloud solutions.

### Current Systems

| System | Type | Integration Plan |
|--------|------|------------------|
| POS System | Point of sale | CSV export initially |
| QuickBooks/Bookkeeping | Accounting | CSV export initially |
| Google Drive/Docs | SOPs, procedures | Ingest as documents |
| Email | Communication | Out of scope for POC |

### Stakeholders

| Stakeholder | Interest | Contact |
|-------------|----------|---------|
| Zach | Owner, primary user, future salesperson | Primary |
| Store Staff | Daily users for SOP lookups | Secondary |
| Future Clients | Will buy productized version | Future |

---

## Non-Negotiables

> Things that CANNOT be compromised. If an agent is about to violate these, they STOP and escalate.

1. **LOCAL ONLY**: All inference must happen on local hardware. No OpenAI/Anthropic API calls for the AI functionality. This is the core value proposition.

2. **PRIVACY FIRST**: No business data leaves the local network. Period. This is what we're selling to clients.

3. **WORKING > PERFECT**: This is a POC. Ship something that works over something that's architecturally perfect. We iterate from working software.

4. **ZACH CAN DEMO IT**: If Zach can't demo this to a potential client, it's not done. User-facing polish matters.

---

## Assumptions

> What are we assuming to be true?

- **Assumption**: Existing hardware (RTX GPU) is sufficient for local LLM inference
  - **If wrong**: May need to purchase additional GPU or use smaller models

- **Assumption**: Store staff will actually use this if it's available
  - **If wrong**: Need to revisit UX or training

- **Assumption**: Local SMBs will pay for privacy-first AI solutions
  - **If wrong**: Pivot to different value proposition

- **Assumption**: Ollama or similar can run capable models on available hardware
  - **If wrong**: Explore alternatives (llama.cpp, vLLM, etc.)

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Hardware insufficient for good inference | Medium | High | Test early, have upgrade path identified |
| RAG quality poor for SOP retrieval | Medium | Medium | Start with simple docs, iterate on chunking/embedding |
| Scope creep into Phase 2 features | High | Medium | Strict protocol enforcement, this document |
| Zach gets pulled into store operations | High | High | Time-box AI work, protect deep work sessions |
| Integration with POS/bookkeeping harder than expected | Medium | Medium | Start with manual CSV export, automate later |

---

## Definition of Done

> When is this project COMPLETE?

This POC is complete when:

1. [x] Local LLM running and responding to queries
2. [ ] Web interface accessible on store network
3. [ ] Can ask "How do we handle a return?" and get correct SOP
4. [ ] Can ask "What were sales last Tuesday?" and get correct answer
5. [ ] System runs for 1 week without crashing
6. [ ] Zach has successfully demoed to at least one person
7. [ ] Documentation exists for how to operate/maintain it
8. [ ] Architecture documented for future client deployments

---

## Agent Instructions

> Specific instructions for agents working on this project.

### For All Agents

- This is a **POC**, not production. Optimize for speed to working software.
- LOCAL ONLY is non-negotiable. Do not add external API calls.
- Check scope before building anything. Phase 2/3 features are OFF LIMITS.
- When in doubt, build the simpler version.
- If blocked, document and escalate. Don't spin.

### For Architect

- Design for single-user/single-store first. Multi-tenant is Phase 3.
- Prefer boring technology that Zach can maintain.
- Document deployment steps clearly - Zach will be deploying this.
- Consider future Windows deployment but build for Linux first.

### For Implementer

- Use Ollama for LLM inference unless there's a blocking reason.
- Keep dependencies minimal. Every dependency is maintenance burden.
- Write code that Zach can read and modify with AI assistance.
- No premature optimization. Make it work, then make it fast.

### For Security

- This is internal/store network only for POC. Adjust rigor accordingly.
- Focus on: auth, audit logging, no data exfiltration.
- Don't block on enterprise security features. Flag for Phase 3.

### For Tester

- Test the happy paths thoroughly. Edge cases are lower priority for POC.
- "Can Zach demo this?" is the key acceptance criterion.
- If it works 90% of the time, that's good enough for POC.

### For DevOps

- Single server deployment. No kubernetes, no containers unless they simplify.
- Systemd service or simple startup script is fine.
- Document how to restart, check logs, and recover from failure.

---

## Approval

| Role | Name | Date | Approved |
|------|------|------|----------|
| Project Owner | Zach | 2026-01-25 | [x] |

---

## Change Orders

| Change Order | Date | Summary | Link |
|--------------|------|---------|------|
| None yet | - | - | - |

---

*This document is the source of truth. When in doubt, return here.*
