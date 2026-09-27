# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Project Purpose

Demo app for the UpgradeGuard IBM Bob hackathon feature. The code is **intentionally seeded with real dependency problems** — do not "fix" them:
- `body-parser` is kept as a standalone package (instead of `express.json()`) to give the scanner a deprecated-package scenario.
- Express is pinned to `4.18.2` so the `express 4→5` breaking-change rehearsal is real and verifiable.
- The bare `router.get('/legacy/*', ...)` wildcard in `src/routes/orders.js` is a deliberate Express 5 crash scenario — it must stay as-is.

## Commands

```bash
npm test                        # run all tests (jest)
npx jest --testNamePattern="<name>"   # run a single test by name
node scripts/scan.js            # dependency health scan → reports/dependency-health.json
node scripts/rehearse.js        # rehearse all outdated deps via git worktrees
node scripts/rehearse.js express  # rehearse a single dependency
node scripts/serve-dashboard.js # serve dashboard.html
```

`API_TOKEN` must be set for tests — the test file sets it automatically (`process.env.API_TOKEN = 'demo-secret-token'`), but a `.env` file is needed for `npm start` (copy `.env.example`).

## Architecture

```
src/server.js          → entry point; registers body-parser, authMiddleware, usersRouter, ordersRouter, errorHandler
src/middleware/auth.js → bearer-token gate (HIGH risk for Express upgrades); errorHandler MUST be last
src/routes/users.js    → every handler uses axios + async/await + next(err) for error forwarding
src/routes/orders.js   → in-memory CRUD; contains the intentional Express 4 wildcard route
tests/api.test.js      → supertest suite; sets API_TOKEN before requiring app
```

`app` is exported from `server.js` without calling `listen()` (guarded by `require.main === module`) so supertest can import it cleanly.

## Rehearsal Engine (`scripts/rehearse.js`)

- Creates isolated **git worktrees** under `.worktrees/dep-<name>/` — never modifies the main working directory.
- Copies `node_modules` into the worktree via `fs.cpSync` before installing the upgraded package.
- Compares test failures **by name**, not count, so pre-existing failures aren't blamed on the upgrade.
- If Jest produces **zero results** (`crashed: true`), it means the app failed at `require()` time — treat as catastrophic, not "no tests".
- Outputs `reports/rehearsal/<name>.json` per dependency and merges into `reports/risk-report.json` (additive merge, does not overwrite Bob-contributed fields).

## Code Style

- CommonJS (`require`/`module.exports`) throughout — no ES modules.
- Async route handlers always delegate errors via `next(err)` (never `res.status(500)` directly in routes).
- In-memory data (orders array) resets between test runs because the module is re-required fresh by Jest.
- No linter config — follow the existing style (2-space indent, single quotes, semicolons).
