#!/usr/bin/env node
/**
 * UpgradeGuard standalone rehearsal engine.
 *
 * Runs the real "Detect -> Rehearse -> Verify" loop with ZERO Bob
 * involvement -- only git, npm, and Node's built-ins. This guarantees
 * MUST-HAVE #4 (Upgrade Rehearsal) works even before Bob touches anything.
 * Bob's job (later, in Bob IDE) is to add what this script CANNOT do:
 * explain *why* something broke in plain English, and write + apply the
 * actual code fix when tests fail. This script can tell you SAFE vs RISKY
 * with real evidence; it cannot repair broken code.
 *
 * Requires Node 18+ and git.
 *
 * Usage:
 *   node scripts/rehearse.js            rehearse every outdated dependency
 *   node scripts/rehearse.js express    rehearse just one dependency
 *
 * Output:
 *   reports/rehearsal/<name>.json   per-dependency raw result
 *   reports/risk-report.json        aggregated, in the exact shape dashboard.html expects
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const WORKTREES_DIR = path.join(ROOT, '.worktrees');
const REPORTS_DIR = path.join(ROOT, 'reports');
const REHEARSAL_DIR = path.join(REPORTS_DIR, 'rehearsal');

function shSafe(cmd, cwd) {
  try {
    return { ok: true, out: execSync(cmd, { cwd: cwd || ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }) };
  } catch (err) {
    return { ok: false, out: (err.stdout || '').toString() + (err.stderr || '').toString(), error: err.message };
  }
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function classifyBump(current, latest) {
  const clean = (v) => v.replace(/^[\^~]/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const c = clean(current);
  const l = clean(latest);
  if (l[0] > c[0]) return 'major';
  if (l[1] > c[1]) return 'minor';
  return 'patch';
}

function riskTierFromBump(bump) {
  if (bump === 'major') return 'HIGH';
  if (bump === 'minor') return 'MEDIUM';
  return 'LOW';
}

function getOutdated() {
  const result = shSafe('npm outdated --json');
  const raw = result.out;
  if (!raw || !raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function runJestJson(cwd) {
  const outFile = path.join(cwd, '.jest-result.json');
  const run = shSafe(`npx jest --json --outputFile=${JSON.stringify(outFile)}`, cwd);
  if (!fs.existsSync(outFile)) {
    // Jest never even produced a result file -- the app almost certainly
    // crashed at require-time (e.g. an invalid route pattern under a new
    // Express major version). This is a catastrophic failure, not "no
    // tests to report" -- callers must treat total === 0 as a crash, never
    // as "nothing broke".
    return { total: 0, passed: 0, failed: 0, failedNames: [], crashed: true, rawOutput: run.out.slice(-800) };
  }
  let data;
  try {
    data = readJson(outFile);
  } catch {
    return { total: 0, passed: 0, failed: 0, failedNames: [], crashed: true, rawOutput: run.out.slice(-800) };
  }
  fs.rmSync(outFile, { force: true });
  return {
    total: data.numTotalTests,
    passed: data.numPassedTests,
    failed: data.numFailedTests,
    failedNames: (data.testResults || [])
      .flatMap((r) => r.testResults || [])
      .filter((t) => t.status === 'failed')
      .map((t) => t.fullName),
    crashed: false,
  };
}

function ensureWorktree(name) {
  fs.mkdirSync(WORKTREES_DIR, { recursive: true });
  const safeName = name.replace(/[^a-z0-9-]/gi, '_');
  const dir = path.join(WORKTREES_DIR, `dep-${safeName}`);
  const branch = `upgrade/${safeName}`;

  if (fs.existsSync(dir)) shSafe(`git worktree remove --force "${dir}"`);
  shSafe(`git branch -D ${branch}`); // fine if it doesn't exist yet

  const add = shSafe(`git worktree add -b ${branch} "${dir}" HEAD`);
  if (!add.ok) throw new Error(`Could not create worktree for ${name}: ${add.out}`);

  const srcModules = path.join(ROOT, 'node_modules');
  const dstModules = path.join(dir, 'node_modules');
  if (fs.existsSync(srcModules)) {
    fs.cpSync(srcModules, dstModules, { recursive: true });
  }
  return { dir, branch };
}

function cleanupWorktree(dir, branch) {
  shSafe(`git worktree remove --force "${dir}"`);
  shSafe(`git branch -D ${branch}`);
}

function rehearseOne(name, info, baseline) {
  console.log(`\n=== Rehearsing ${name}: ${info.current} -> ${info.latest} ===`);
  const bump = classifyBump(info.current, info.latest);
  const { dir, branch } = ensureWorktree(name);

  const result = {
    name,
    current: info.current,
    target: info.latest,
    bump,
    riskTier: riskTierFromBump(bump),
    installOk: false,
    usage: { count: 0, files: [] },
    breakingChanges: [],
    rehearsal: {
      testsBefore: baseline ? baseline.passed : null,
      testsTotal: baseline ? baseline.total : null,
      testsAfterUpgrade: null,
      testsAfterFix: null,
      buildPass: null,
      typecheckPass: null,
    },
    fix: { applied: false, diffSummary: null },
    recommendation: null,
    error: null,
  };

  try {
    const install = shSafe(`npm install ${name}@${info.latest} --no-audit --no-fund`, dir);
    result.installOk = install.ok;
    if (!install.ok) {
      result.recommendation = 'DO NOT TOUCH';
      result.error = 'npm install failed: ' + install.out.slice(-400);
      return result;
    }

    const afterTests = runJestJson(dir);
    if (afterTests) {
      result.rehearsal.testsAfterUpgrade = afterTests.passed;
      result.rehearsal.testsTotal = afterTests.total;
      result.failedTestNames = afterTests.failedNames;
    }

    const pkg = readJson(path.join(dir, 'package.json'));
    if (pkg.scripts && pkg.scripts.build) {
      result.rehearsal.buildPass = shSafe('npm run build', dir).ok;
    }
    if (pkg.scripts && (pkg.scripts.typecheck || pkg.scripts.lint)) {
      const cmd = pkg.scripts.typecheck ? 'npm run typecheck' : 'npm run lint';
      result.rehearsal.typecheckPass = shSafe(cmd, dir).ok;
    }

    if (afterTests && afterTests.crashed) {
      // Total crash (e.g. the app failed to even start / require a route
      // file). This is the worst outcome -- must never be reported SAFE.
      result.recommendation = 'DO NOT TOUCH -- the application crashed and produced zero test results';
      result.error = 'Test run crashed: ' + (afterTests.rawOutput || 'no diagnostic output captured');
      return result;
    }
    if (baseline && baseline.total > 0 && afterTests && afterTests.total < baseline.total) {
      // Fewer tests ran than before -- some test file likely failed to
      // even load. Treat as risky, not safe, even if 0 explicit failures.
      result.recommendation = 'RISKY -- fewer tests ran after the upgrade than before (a test file may have failed to load)';
      result.error = `Expected ${baseline.total} tests, only ${afterTests.total} ran`;
      return result;
    }

    // Compare against baseline by NAME, not by raw failure count -- a test
    // that was already failing before the upgrade (e.g. an environment
    // issue, unrelated to this dependency) must not be blamed on it.
    const baselineFailedNames = new Set((baseline && baseline.failedNames) || []);
    const newFailures = afterTests
      ? afterTests.failedNames.filter((n) => !baselineFailedNames.has(n))
      : [];
    result.newlyFailedTests = newFailures;
    const noRegressions = newFailures.length === 0;
    result.recommendation = noRegressions
      ? 'SAFE'
      : 'RISKY -- needs a migration fix (open Bob and run the Fix Agent prompts on this dependency)';
  } catch (err) {
    result.error = err.message;
    result.recommendation = 'DO NOT TOUCH';
  } finally {
    cleanupWorktree(dir, branch);
  }

  return result;
}

function main() {
  const target = process.argv[2];
  const outdated = getOutdated();
  const names = target ? [target] : Object.keys(outdated);

  if (!names.length || (target && !outdated[target])) {
    console.log('Nothing to rehearse. Run `npm outdated` to check, or pass a valid package name.');
    return;
  }

  console.log('Establishing baseline (current branch, before any upgrade)...');
  const baseline = runJestJson(ROOT);
  if (baseline) {
    console.log(`Baseline: ${baseline.passed}/${baseline.total} tests passing`);
  } else {
    console.log('Warning: could not read a baseline test result -- continuing anyway.');
  }

  fs.mkdirSync(REHEARSAL_DIR, { recursive: true });
  const allResults = [];

  for (const name of names) {
    const info = outdated[name];
    if (!info) continue;
    const result = rehearseOne(name, info, baseline);
    fs.writeFileSync(path.join(REHEARSAL_DIR, `${name}.json`), JSON.stringify(result, null, 2));
    allResults.push(result);
    console.log(`  -> ${result.recommendation}`);
  }

  // Merge with any existing risk-report.json (e.g. usage/breaking-change/fix
  // data Bob has already added) instead of overwriting it.
  const riskReportPath = path.join(REPORTS_DIR, 'risk-report.json');
  let existing = { dependencies: [] };
  if (fs.existsSync(riskReportPath)) {
    try {
      existing = readJson(riskReportPath);
    } catch {
      existing = { dependencies: [] };
    }
  }
  const byName = Object.fromEntries((existing.dependencies || []).map((d) => [d.name, d]));
  for (const r of allResults) {
    byName[r.name] = Object.assign({}, byName[r.name] || {}, r);
  }

  fs.writeFileSync(
    riskReportPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), dependencies: Object.values(byName) }, null, 2)
  );

  console.log(`\nWrote reports/risk-report.json (${allResults.length} dependenc${allResults.length === 1 ? 'y' : 'ies'} rehearsed)`);
}

main();
