# Decision Log: store-ai-poc

| Date | Agent | Decision | Rationale |
|------|-------|----------|----------|
| 2026-01-25 | architect | Use Ollama for local LLM inference | Simple to install, good model support, active community, runs well on consumer GPUs.
Zach can swap models easily without code changes.
 |
| 2026-01-25 | architect | Use FastAPI for backend API | Python is readable for Zach with AI assistance. FastAPI is simple,
well-documented, and has automatic OpenAPI docs. Easy to extend.
 |
| 2026-01-25 | architect | Simple HTML/JS frontend (no framework) | POC doesn't need React/Vue complexity. Plain HTML/JS is maintainable,
loads fast, and Zach can modify with AI help. Can upgrade to framework later.
 |
| 2026-01-25 | architect | ChromaDB for vector storage (RAG) | Simple Python API, embeds with the app, no separate server needed.
Good enough for POC document counts. SQLite backend is easy to backup.
 |
| 2026-01-25 | architect | SQLite for application data | Zero configuration, file-based, easy backup, good enough for single-user.
Can migrate to PostgreSQL in Phase 3 if needed for multi-tenant.
 |
| 2026-01-25 | architect | No Docker for POC deployment | Direct install is simpler to debug and understand. Zach can see what's running.
Docker adds a layer of abstraction that complicates troubleshooting.
Can containerize in Phase 3 for client deployments.
 |
