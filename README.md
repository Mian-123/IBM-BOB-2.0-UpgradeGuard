# UpgradeGuard Demo Project

A small seeded Express app for the IBM Bob 2.0 UpgradeGuard hackathon build.

## Setup

```bash
npm install
cp .env.example .env
npm test          # confirm everything passes before you touch Bob
npm outdated      # confirm it shows express/axios/dotenv as behind
git init
git add .
git commit -m "Initial UpgradeGuard demo project"
```

Once `npm test` is green and `npm outdated` shows real version drift, open
this folder in Bob IDE and start with Prompt 1 (`/init`) from Phase 1 of the
UpgradeGuard Complete Build Guide.

## Seeded dependency scenarios

| Package | Pinned version | Scenario |
|---|---|---|
| express | 4.18.2 | Major upgrade available (5.x) — the breaking-change demo |
| axios | 1.6.0 | Minor upgrade available |
| dotenv | 16.3.1 | Safe patch upgrade available |
| body-parser | 1.20.1 | Standalone package now redundant with Express's built-in parser — deprecated-package scenario |

## Project structure

```
src/
  server.js              entry point, wires up middleware + routes
  middleware/auth.js      bearer-token auth + error handler
  routes/users.js         uses axios to call an external API
  routes/orders.js        in-memory CRUD, no external calls
tests/
  api.test.js             covers health check, auth, orders, users
```
