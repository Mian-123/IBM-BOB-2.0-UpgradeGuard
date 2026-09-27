# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Critical — Do Not "Fix" the Intentional Bugs

These are load-bearing demo scenarios:
- `src/routes/orders.js` `router.get('/legacy/*', ...)` — bare wildcard must stay; it crashes Express 5, which is the point.
- `body-parser` standalone package in `src/server.js` — must not be replaced with `express.json()`.
- All four dependencies pinned to old versions in `package.json` — do not update them.

## Making Changes

- All route handlers delegate errors with `next(err)` — never catch and `res.status(500)` inline in a route.
- `src/server.js` exports `app` without `listen()` (guarded by `require.main === module`) — keep this pattern so supertest tests work.
- The test file sets `process.env.API_TOKEN = 'demo-secret-token'` before `require('../src/server')` — if you add new test files, do the same.

## Rehearsal Worktrees

- `scripts/rehearse.js` creates/destroys git worktrees under `.worktrees/`. Never manually edit anything under `.worktrees/`.
- Reports are written to `reports/`. `risk-report.json` is additively merged — new rehearsal runs preserve Bob-contributed fields.
- Run a single-dependency rehearsal: `node scripts/rehearse.js <packageName>`.
