# Express 4 → 5 Migration Plan

## Overview

Only one dependency is RISKY: **express** (`4.18.2 → 5.2.1`).

The rehearsal recorded a complete crash: 0 of 10 tests ran after the upgrade.
This means the app failed at `require()` time — it never even started. The
root cause is already visible in the codebase: `src/routes/orders.js` uses a
bare `*` wildcard route (`router.get('/legacy/*', ...)`), which Express 5's
updated path-to-regexp (v8) rejects at route-registration time. This is a
documented Express 5 breaking change.

Work is split into four sequential sub-tasks that follow the structure
requested: usage → breaking-changes → fix → verify. Each sub-task writes its
own output file; `reports/risk-report.json` is NOT touched.

---

## Sub-Task 1 — Usage Analysis

**Status:** [ ] pending

### Intent
Find every file in the codebase that imports or requires `express` and
classify each usage as HIGH / MEDIUM / LOW based on how central it is to
request/response handling.

### Relevance Classification Rules
- **HIGH** — middleware registration, error-handler, route registration,
  any code that directly touches Express app/router APIs at startup.
- **MEDIUM** — route handlers that use `req`/`res` but don't configure
  the router itself.
- **LOW** — one-off utility or config usage isolated from the main
  request lifecycle.

### Todo List
- [ ] `grep` the entire `src/` tree for `require('express')` and
  `require("express")`.
- [ ] For each matching file, read the relevant lines and assign a
  HIGH / MEDIUM / LOW tag with a one-line reason.
- [ ] Write `reports/usage/express.json` in this shape:
  ```json
  {
    "dependency": "express",
    "generatedAt": "<ISO timestamp>",
    "locations": [
      {
        "file": "src/server.js",
        "line": 8,
        "snippet": "const express = require('express');",
        "tag": "HIGH",
        "reason": "Creates the app instance, registers all middleware and routers"
      }
    ]
  }
  ```

### Relevant Files
- `src/server.js` — app entry point; mounts all middleware and routers
- `src/routes/orders.js` — contains the problematic wildcard route
- `src/routes/users.js` — async route handlers
- `src/middleware/auth.js` — error-handler (Express 5 changed how async
  errors propagate through error-handling middleware)

---

## Sub-Task 2 — Breaking-Change Research

**Status:** [ ] pending

### Intent
Fetch the Express 5 changelog / migration guide and identify the specific
documented breaking changes that explain the crash recorded in
`reports/rehearsal/express.json` (0 tests ran, app crashed at require-time).

### Todo List
- [ ] Fetch the Express 5 migration guide from the Express.js website:
  `https://expressjs.com/en/guide/migrating-5.html`
- [ ] Fetch the Express GitHub release notes for `5.x`:
  `https://github.com/expressjs/express/releases` (filter to 5.0.0+)
- [ ] Identify the breaking change that causes a route-registration crash
  when a bare `*` wildcard is used (path-to-regexp v8 constraint).
- [ ] Identify any other relevant breaking changes that affect:
  - Error-handling middleware with async route handlers
  - `req.params[0]` behaviour on wildcard routes
  - Any `body-parser` / middleware API changes absorbed into Express 5
    (since body-parser is also a dependency here)
- [ ] Write `reports/breaking-changes/express.json` in this shape:
  ```json
  {
    "dependency": "express",
    "from": "4.18.2",
    "to": "5.2.1",
    "generatedAt": "<ISO timestamp>",
    "breakingChanges": [
      {
        "id": "wildcard-route-syntax",
        "severity": "CRASH",
        "summary": "Bare * wildcard no longer accepted by path-to-regexp v8",
        "detail": "<full explanation>",
        "affectedFiles": ["src/routes/orders.js"],
        "migrationAction": "Rename /legacy/* to /legacy/*splat and access via req.params.splat"
      }
    ]
  }
  ```

### Relevant Context
- The crash symptom is in `reports/rehearsal/express.json`:
  `"error": "Expected 10 tests, only 0 ran"` — zero test output means a
  `require()` or module-load failure, not a runtime test failure.
- The problematic line is `src/routes/orders.js:40`:
  `router.get('/legacy/*', (req, res) => { res.json({ wildcardPath: req.params[0] }); });`
- Express 5 uses path-to-regexp v8 which requires named parameters.

---

## Sub-Task 3 — Apply Fix in Isolated Worktree

**Status:** [ ] pending

### Intent
Apply the migration fix inside an isolated git worktree (never on the main
branch), then write a record of what was changed.

### Todo List
- [ ] Confirm or create a git worktree at `.worktrees/dep-express/` on
  branch `upgrade/express` (following the same pattern as
  `scripts/rehearse.js:ensureWorktree`). If one already exists from the
  earlier rehearsal run, remove and recreate it to get a clean state.
- [ ] Inside the worktree only:
  - Run `npm install express@5.2.1 --no-audit --no-fund` to install the
    target version.
  - Apply the fix to `src/routes/orders.js`:
    - Change `router.get('/legacy/*', ...)` to `router.get('/legacy/*splat', ...)`
    - Change `req.params[0]` to `req.params.splat`
  - Check whether any other breaking changes from Sub-Task 2 require
    additional edits (e.g. async error propagation in `src/middleware/auth.js`
    or `src/routes/users.js`); apply those too if needed.
- [ ] Write `reports/fixes/express.json` in this shape:
  ```json
  {
    "dependency": "express",
    "generatedAt": "<ISO timestamp>",
    "worktree": ".worktrees/dep-express",
    "branch": "upgrade/express",
    "installOk": true,
    "changes": [
      {
        "file": "src/routes/orders.js",
        "description": "Renamed bare wildcard route and updated param access",
        "diff": "- router.get('/legacy/*', ...)\n+ router.get('/legacy/*splat', ...)\n- req.params[0]\n+ req.params.splat"
      }
    ]
  }
  ```
- [ ] Do NOT clean up the worktree — Sub-Task 4 needs it to run tests.

### Relevant Context
- The rehearsal engine script creates worktrees with
  `git worktree add -b <branch> "<dir>" HEAD`, then copies `node_modules`.
  Follow the same pattern.
- `src/routes/orders.js:40` is the only line that must change to resolve
  the crash. Other changes are needed only if Sub-Task 2 surfaces
  additional breaking changes.
- The test for the wildcard route is
  `tests/api.test.js:58` —
  `'GET /api/orders/legacy/:wildcard resolves the old-style wildcard route'`
  — and it asserts `res.body.wildcardPath === 'foo/bar'`, so the param
  name change must be reflected in the route handler response.

---

## Sub-Task 4 — Verify Fix

**Status:** [ ] pending

### Intent
Re-run the rehearsal script for express inside the worktree created in
Sub-Task 3 to confirm the fix restores all 10 tests. Never claim success
without this step.

### Todo List
- [ ] From the project root, run:
  `node scripts/rehearse.js express`
  This will create a fresh worktree, install Express 5, and apply... wait —
  the rehearsal script does NOT apply the fix automatically. The correct
  approach is:
  - Run Jest directly inside the **already-patched** worktree from
    Sub-Task 3: `npx jest` from `.worktrees/dep-express/`
  - Record the before count (10/10 from baseline) and the after count.
- [ ] Confirm all 10 tests pass. If any fail, diagnose, return to Sub-Task 3
  to extend the fix, and re-verify.
- [ ] Update `reports/fixes/express.json` with the verification result:
  ```json
  {
    ...existing fields...,
    "verification": {
      "testsBefore": 10,
      "testsTotal": 10,
      "testsAfterFix": 10,
      "allTestsPass": true,
      "verifiedAt": "<ISO timestamp>"
    }
  }
  ```
- [ ] Clean up the worktree after successful verification:
  `git worktree remove --force .worktrees/dep-express`
  `git branch -D upgrade/express`

### Success Criteria
- `testsAfterFix === 10` (all tests pass)
- `allTestsPass: true` in `reports/fixes/express.json`
- The fix diff in `reports/fixes/express.json` matches what was applied

---

## Output Files Summary

| File | Written by | Content |
|---|---|---|
| `reports/usage/express.json` | Sub-Task 1 | Usage locations with HIGH/MEDIUM/LOW tags |
| `reports/breaking-changes/express.json` | Sub-Task 2 | Breaking changes from changelog/migration guide |
| `reports/fixes/express.json` | Sub-Tasks 3 + 4 | Applied diff + verification result |
| `reports/risk-report.json` | **Not touched** | Merged by user in a later step |

---

## Notes for Implementation

- Sub-Tasks 1 and 2 are independent and can be done in either order.
- Sub-Task 3 depends on Sub-Task 2 (needs breaking-change list to know
  what else might need fixing beyond the obvious wildcard).
- Sub-Task 4 depends on Sub-Task 3 (needs the patched worktree).
- The fix in Sub-Task 3 must be applied inside `.worktrees/dep-express/`,
  NOT in the main working directory. The main `src/routes/orders.js` stays
  unchanged (it is the intentional demo scenario).
