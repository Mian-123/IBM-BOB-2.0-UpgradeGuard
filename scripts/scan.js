#!/usr/bin/env node
/**
 * UpgradeGuard fallback dependency scanner.
 *
 * Works completely standalone -- zero Bob/IBM involvement -- using only
 * Node's built-in modules plus the installed npm CLI. This exists so the
 * "Dependency Health Scanner" (MUST-HAVE #1) has a guaranteed-working
 * result even before Bob touches anything. Bob's job is to go deeper --
 * usage analysis, breaking-change reasoning, rehearsal, fixes -- not to
 * replace this baseline scan.
 *
 * Requires Node 18+ (uses the built-in global fetch).
 *
 * Usage:  node scripts/scan.js
 * Output: reports/dependency-health.json (and a printed summary)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const LOCK_PATH = path.join(ROOT, 'package-lock.json');
const REPORTS_DIR = path.join(ROOT, 'reports');

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

function getOutdated() {
  let raw = '';
  try {
    raw = execSync('npm outdated --json', { cwd: ROOT, encoding: 'utf8' });
  } catch (err) {
    // npm outdated exits with code 1 when it finds outdated packages --
    // that is expected, not a real failure. The JSON is still on stdout.
    raw = err.stdout ? err.stdout.toString() : '{}';
  }
  if (!raw || !raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function getAudit() {
  let raw = '';
  try {
    raw = execSync('npm audit --json', { cwd: ROOT, encoding: 'utf8' });
  } catch (err) {
    raw = err.stdout ? err.stdout.toString() : '{}';
  }
  try {
    return JSON.parse(raw);
  } catch {
    return { vulnerabilities: {} };
  }
}

async function isDeprecated(pkgName, version) {
  try {
    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkgName)}`);
    if (!res.ok) return false;
    const data = await res.json();
    const versionData = data.versions && data.versions[version];
    return !!(versionData && versionData.deprecated);
  } catch {
    return false; // no network / registry unreachable -- fail safe, not fatal
  }
}

function checkLockfileDrift(pkgName, wantedRange, currentVersion) {
  if (!fs.existsSync(LOCK_PATH)) return null;
  const lock = readJson(LOCK_PATH);
  const resolved =
    (lock.packages && lock.packages[`node_modules/${pkgName}`] && lock.packages[`node_modules/${pkgName}`].version) ||
    (lock.dependencies && lock.dependencies[pkgName] && lock.dependencies[pkgName].version);
  if (!resolved) return null;
  if (resolved === currentVersion) return null; // no drift
  return { wantedRange, resolved };
}

async function main() {
  const outdated = getOutdated();
  const audit = getAudit();
  const names = Object.keys(outdated);

  const results = [];
  for (const name of names) {
    const info = outdated[name];
    const bump = classifyBump(info.current, info.latest);
    const deprecated = await isDeprecated(name, info.current);
    const drift = checkLockfileDrift(name, info.wanted, info.current);
    const vuln = audit.vulnerabilities && audit.vulnerabilities[name];

    results.push({
      name,
      current: info.current,
      wanted: info.wanted,
      latest: info.latest,
      bump,
      deprecated,
      lockfileDrift: drift,
      vulnerability: vuln
        ? { severity: vuln.severity, via: (vuln.via || []).map((v) => (typeof v === 'string' ? v : v.title)) }
        : null,
    });
  }

  const counts = {
    total: results.length,
    major: results.filter((r) => r.bump === 'major').length,
    minor: results.filter((r) => r.bump === 'minor').length,
    patch: results.filter((r) => r.bump === 'patch').length,
    deprecated: results.filter((r) => r.deprecated).length,
    vulnerable: results.filter((r) => r.vulnerability).length,
    lockfileDrift: results.filter((r) => r.lockfileDrift).length,
  };

  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(REPORTS_DIR, 'dependency-health.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), counts, dependencies: results }, null, 2)
  );

  console.log('\nDEPENDENCY HEALTH');
  console.log('------------------------------');
  console.log(`${counts.total} dependencies detected`);
  console.log(`Major upgrades: ${counts.major}   Minor upgrades: ${counts.minor}   Patch upgrades: ${counts.patch}`);
  console.log(
    `Deprecated packages: ${counts.deprecated}   Vulnerable packages: ${counts.vulnerable}   Lockfile drift: ${counts.lockfileDrift}`
  );
  console.log('\nDetail:');
  for (const r of results) {
    const flags = [
      r.bump.toUpperCase(),
      r.deprecated ? 'DEPRECATED' : null,
      r.vulnerability ? `VULN:${r.vulnerability.severity}` : null,
      r.lockfileDrift ? 'LOCKFILE DRIFT' : null,
    ]
      .filter(Boolean)
      .join(', ');
    console.log(`  ${r.name}: ${r.current} -> ${r.latest}  [${flags}]`);
  }
  console.log('\nWrote reports/dependency-health.json');
}

main().catch((err) => {
  console.error('Scan failed:', err);
  process.exit(1);
});
