# UpgradeGuard — Full Setup Commands (run in this order)

Requires Node.js 18+ (for the built-in `fetch` used by scripts/scan.js) and git.

## 1. Install and verify the seeded project

```bash
npm install
cp .env.example .env
npm test          # expect 10 total, 8 passing (2 fail only if you have no
                   # internet access to jsonplaceholder.typicode.com -- on
                   # a normal machine with internet, all 10 should pass)
npm outdated      # confirm it shows express / axios / dotenv / body-parser as behind
```

## 2. Put it under git (required — rehearse.js and Bob both use git worktrees)

```bash
git init
git add .
git commit -m "Initial UpgradeGuard demo project"
```

## 3. Run the standalone scanner (free, no Bob needed)

```bash
node scripts/scan.js
```

Writes `reports/dependency-health.json`. This alone proves MUST-HAVE #1
(Dependency Health Scanner) works completely independent of Bob.

## 4. Run the standalone rehearsal engine (free, no Bob needed)

```bash
node scripts/rehearse.js
```

This is the important one. For every outdated dependency, it creates an
isolated git worktree, actually installs the new version, actually runs
your real test suite, and reports SAFE or RISKY with real evidence — no
Bob involved. It writes `reports/risk-report.json`.

Expected result on the seeded project: 5 dependencies come back **SAFE**,
and **express** comes back **RISKY** — because this project deliberately
includes a legacy Express-4-style wildcard route (`src/routes/orders.js`)
that is a real, documented Express 5 breaking change. This is proof your
whole rehearsal pipeline actually works, using a genuine regression, not
an assumed one.

You can also rehearse just one dependency:
```bash
node scripts/rehearse.js express
```

## 5. View the dashboard

```bash
node scripts/serve-dashboard.js
```
Then open **http://localhost:8080/dashboard.html**. It will automatically
show the rich risk-report view now that `risk-report.json` exists. Re-run
`node scripts/rehearse.js` any time and reload the page to refresh it.

(Leave this server running in its own terminal tab.)

## 6. Set up Bob IDE

- Install Bob IDE (v2.0.2 or later).
- Sign in using your hackathon registration email.
- Settings -> General -> switch to `ibm-coding-challenge-uat` (region: us-east).
- Confirm your Bobcoins are showing.

## 7. Open this folder in Bob IDE and start the prompt sequence

Open the `upgradeguard-demo` folder as the workspace. The
`.bob/skills/upgrade-rehearsal/SKILL.md` file is already included.

Important -- the prompt sequence is now different from a plain
"ask Bob to do everything" approach. Because scripts/scan.js and
scripts/rehearse.js already did the expensive, deterministic part (install,
test, verify) for free, Bob's job is now only to add what a script cannot
do: explain *why* something breaks, find where it's used, and write the
actual fix -- and only for dependencies rehearse.js already flagged RISKY.
This uses far fewer Bobcoins than asking Bob to rehearse everything itself.

Follow the exact prompts in the companion PDF's Part D (Revised),
starting with:
```
/init
```

## 8. After the build: evidence + submission

- Bob IDE -> Tasks -> select each task -> screenshot the session summary ->
  save into `bob_sessions/` (`mkdir bob_sessions`).
- Record your demo video against `dashboard.html`.
- Fill in real benchmark numbers -- you already have real ones from step 4.
- Finalize both 500-word statements.
- Make the repository public before submitting.

## Quick reference -- every command in one block

```bash
npm install
cp .env.example .env
npm test
npm outdated
git init
git add .
git commit -m "Initial UpgradeGuard demo project"
node scripts/scan.js
node scripts/rehearse.js
node scripts/serve-dashboard.js
# open http://localhost:8080/dashboard.html
mkdir bob_sessions
```
