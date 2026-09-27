#!/usr/bin/env node
/**
 * UpgradeGuard report merger -- the SINGLE source of truth for
 * reports/risk-report.json.
 *
 * Deterministically assembles the dashboard's data from four canonical
 * inputs, none of which are ever edited directly:
 *   reports/rehearsal/<name>.json        (written by scripts/rehearse.js)
 *   reports/usage/<name>.json            (written by Bob's Usage Analyst)
 *   reports/breaking-changes/<name>.json (written by Bob's Breaking-Change Analyst)
 *   reports/fixes/<name>.json            (written by Bob's Fix Agent)
 *
 * Safe to run any number of times, in any order relative to
 * scripts/rehearse.js -- it never invents data, only recombines whatever
 * source files currently exist on disk. Nothing else writes
 * risk-report.json, so this can never be silently clobbered again.
 *
 * Usage: node scripts/merge-reports.js
 */

const fs = require('fs');
const path = require('path');

const REPORTS_DIR = path.join(__dirname, '..', 'reports');

function readJsonIfExists(p) {
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function listNames(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''));
}

// Matches the shape Bob's Usage Analyst actually produced:
// { dependency, generatedAt, locations: [{file, line, snippet, tag, reason}] }
function buildUsage(usageDoc) {
  if (!usageDoc || !Array.isArray(usageDoc.locations)) {
    return { count: 0, files: [] };
  }
  return {
    count: usageDoc.locations.length,
    files: usageDoc.locations.map((loc) => ({
      file: loc.line ? `${loc.file}:${loc.line}` : loc.file,
      tag: loc.tag || 'MEDIUM',
    })),
  };
}

// Matches the shape Bob's Breaking-Change Analyst actually produced:
// { dependency, from, to, generatedAt, breakingChanges: [{id, severity,
//   summary, detail, affectedFiles, affectsThisCodebase, migrationAction}],
//   primaryCrashCause }
// Only changes that actually affect this codebase are shown on the
// dashboard -- the others (e.g. removed-app-del, not used here) are real
// findings but not relevant evidence for THIS upgrade decision.
function buildBreakingChanges(breakingDoc) {
  if (!breakingDoc || !Array.isArray(breakingDoc.breakingChanges)) return [];
  return breakingDoc.breakingChanges
    .filter((bc) => bc.affectsThisCodebase !== false)
    .map((bc) => `[${bc.severity}] ${bc.summary}`);
}

// Matches the shape Bob's Fix Agent actually produced:
// { dependency, from, to, generatedAt, worktree, branch, installOk,
//   changes: [{file, description, diff}],
//   verification: {testsBefore, testsTotal, testsAfterFix, allTestsPass,
//                  failedTests, verifiedAt, rawSummary} }
function buildFix(fixDoc) {
  if (!fixDoc) return { applied: false, diffSummary: null };
  const verified = !!(fixDoc.verification && fixDoc.verification.allTestsPass);
  const diffSummary = Array.isArray(fixDoc.changes)
    ? fixDoc.changes.map((c) => `${c.file}\n${c.diff}`).join('\n\n')
    : null;
  return { applied: verified, diffSummary };
}

function main() {
  const rehearsalDir = path.join(REPORTS_DIR, 'rehearsal');
  const usageDir = path.join(REPORTS_DIR, 'usage');
  const breakingDir = path.join(REPORTS_DIR, 'breaking-changes');
  const fixesDir = path.join(REPORTS_DIR, 'fixes');

  const names = listNames(rehearsalDir);
  if (!names.length) {
    console.log('No reports/rehearsal/*.json found. Run `node scripts/rehearse.js` first.');
    return;
  }

  const dependencies = [];

  for (const name of names) {
    const base = readJsonIfExists(path.join(rehearsalDir, `${name}.json`));
    if (!base) continue;

    const usageDoc = readJsonIfExists(path.join(usageDir, `${name}.json`));
    const breakingDoc = readJsonIfExists(path.join(breakingDir, `${name}.json`));
    const fixDoc = readJsonIfExists(path.join(fixesDir, `${name}.json`));

    const usage = buildUsage(usageDoc);
    const breakingChanges = buildBreakingChanges(breakingDoc);
    const fix = buildFix(fixDoc);

    const rehearsal = Object.assign({}, base.rehearsal);
    if (fixDoc && fixDoc.verification && typeof fixDoc.verification.testsAfterFix === 'number') {
      rehearsal.testsAfterFix = fixDoc.verification.testsAfterFix;
    }

    const wasRisky = /^RISKY|^DO NOT TOUCH/.test(base.recommendation || '');
    let recommendation = base.recommendation;
    if (wasRisky && fix.applied) {
      recommendation = 'READY AFTER MIGRATION PATCH';
    } else if (!wasRisky) {
      recommendation = 'SAFE';
    }

    dependencies.push({
      name: base.name,
      current: base.current,
      target: base.target,
      bump: base.bump,
      riskTier: base.riskTier,
      installOk: base.installOk,
      usage,
      breakingChanges,
      rehearsal,
      fix,
      recommendation,
      error: base.error,
    });
  }

  fs.writeFileSync(
    path.join(REPORTS_DIR, 'risk-report.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), dependencies }, null, 2)
  );

  console.log(`Wrote reports/risk-report.json (${dependencies.length} dependencies)`);
  for (const d of dependencies) {
    console.log(`  ${d.name}: ${d.recommendation}`);
  }
}

main();
