# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Architectural Constraints

- **Worktree isolation is mandatory for rehearsals.** `scripts/rehearse.js` never upgrades on the main branch — always uses `git worktree add` with a fresh branch. Any planned rehearsal feature must preserve this constraint.
- **Additive report merging.** `reports/risk-report.json` is merged (not overwritten) so Bob-contributed fields (usage analysis, fix diffs) survive subsequent standalone script runs. New features must maintain this merge strategy.
- **Test crash detection.** When Jest produces zero test results after an upgrade (`crashed: true` in `runJestJson`), the rehearsal engine treats it as catastrophic rather than "nothing to report". This is the correct behaviour for Express 5's route-registration crash — do not simplify it away.
- **Baseline comparison by test name.** Failures are compared by full test name between baseline and post-upgrade runs to avoid falsely blaming pre-existing failures on the upgrade. Any new test-comparison logic must preserve name-based (not count-based) diffing.
- **No linter or TypeScript** — the project is plain CommonJS Node. Plans that introduce TypeScript, ESM, or a linter must be flagged as out-of-scope for the demo unless explicitly requested.
