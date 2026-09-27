# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Key Context for Answering Questions

- The "bugs" in this codebase are **intentional demo scenarios**, not mistakes. The bare `router.get('/legacy/*', ...)` wildcard and the standalone `body-parser` import exist on purpose.
- The UpgradeGuard skill lives at `.bob/skills/upgrade-rehearsal/SKILL.md` — it defines the exact verdict format and workflow Bob should follow when rehearsing upgrades.
- `dashboard.html` consumes `reports/risk-report.json` directly as static JSON — the shape of that file is the contract between the rehearsal engine and the UI.
- Users tests call an external API (`jsonplaceholder.typicode.com`) — tests for `users` routes have a 10 s timeout and may fail offline.
- Authentication token for all API calls: `Bearer demo-secret-token` (from `.env.example`).
