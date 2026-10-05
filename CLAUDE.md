# Open Shuttle

Read [AGENTS.md](AGENTS.md) for repository rules and [README.md](README.md) for setup, API routes, ingestion, and deployment. Preserve source attribution and external IDs. Use the authenticated admin endpoints to inspect ingestion status and register tournament URLs; never put credentials in source or logs.

## Agent skills

### Issue tracker

Issues and PRDs are local markdown files under `.scratch/<feature>/`; there is no external tracker or PR surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`, recorded as a `Status:` line in each issue file. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
