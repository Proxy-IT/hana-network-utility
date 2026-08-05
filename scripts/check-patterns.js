#!/usr/bin/env node
/**
 * Hana — Codebase Pattern Sweep
 *
 * This script exists because of a real incident:
 *
 *   v1.6.0 shipped DNS Lookup and Port Scanner in the SAME commit, and both
 *   built their CSV with `rows.map(r => r.map(v => `"${v}"`).join(','))` — no
 *   escaping of embedded double-quotes, no guard against formula injection.
 *   v1.8.2's hardening pass found that line, fixed it in PortScanner.js, and
 *   never checked whether the sibling module had the same one. It did. The flaw
 *   stayed in DnsLookup.js for another five weeks, on the module whose values
 *   are the most attacker-influenced in the whole app (DNS TXT records).
 *
 * Two lessons are encoded here:
 *
 *   1. Fixing a bug in the file you happen to have open is not the same as
 *      eliminating the pattern. The fix must be followed by a sweep.
 *   2. Diff-scoped review cannot find this class of bug by construction. Every
 *      review from v1.8.2 onward examined only what that release changed, so a
 *      flaw sitting in an untouched file was permanently out of scope.
 *
 * So this checker is deliberately WHOLE-TREE, not diff-scoped. It is cheap and
 * it is meant to stay cheap: it enforces structural invariants, not style.
 *
 * It checks:
 *   A. Browser download/serialization machinery appears ONLY in src/utils/export.js.
 *      That file is the single place with csvCell (injection + delimiter safety)
 *      and downloadFile (which revokes the object URL). Any component that
 *      reaches for Blob / createObjectURL / 'text/csv' / a.download directly is
 *      re-implementing that plumbing, and every previous time it did, it got the
 *      escaping wrong or leaked the URL.
 *   B. HTML/script injection sinks are absent everywhere. Currently zero hits,
 *      which makes this trivially enforceable from now on.
 *
 * Exit code 0 = clean. Exit code 1 = a real problem was found.
 * Run via `npm run check:patterns`. Wired into `npm run preflight`.
 */

const fs   = require('fs');
const path = require('path');

const ROOT        = path.join(__dirname, '..');
const SCAN_DIRS   = ['src', 'electron'];
const EXPORT_FILE = path.join('src', 'utils', 'export.js');

let exitCode = 0;
const errors   = [];
const warnings = [];

// ── Helpers ────────────────────────────────────────────────────────────────────

function readAllFiles(dir, extensions, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // __tests__ is excluded: tests legitimately mock Blob/createObjectURL in
      // order to assert that the real download helper was called correctly.
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
      readAllFiles(fullPath, extensions, results);
    } else if (extensions.some(ext => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

function collect() {
  const files = [];
  for (const d of SCAN_DIRS) readAllFiles(path.join(ROOT, d), ['.js', '.jsx'], files);
  return files.map(f => ({
    rel:   path.relative(ROOT, f).split(path.sep).join('/'),
    lines: fs.readFileSync(f, 'utf8').split('\n'),
  }));
}

function scan(files, pattern, onHit, { skip = () => false } = {}) {
  for (const file of files) {
    if (skip(file)) continue;
    file.lines.forEach((line, idx) => {
      // Skip single-line comments so the incident notes in this repo's own
      // source (which quote the bad patterns verbatim) don't trip the checker.
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      if (pattern.test(line)) onHit(file, idx + 1, line.trim());
    });
  }
}

// ── A. Download machinery belongs to src/utils/export.js ────────────────────────

const EXPORT_ONLY = [
  {
    pattern: /URL\.createObjectURL/,
    label:   'URL.createObjectURL',
    why:     'hand-rolled downloads have leaked the object URL every time; downloadFile() revokes it',
  },
  {
    pattern: /new Blob\s*\(/,
    label:   'new Blob(',
    why:     'building the payload outside export.js means bypassing csvCell/toCsv',
  },
  {
    pattern: /['"`]text\/csv['"`]/,
    label:   "'text/csv'",
    why:     'CSV assembly outside export.js is exactly how the v1.6.0 injection flaw survived',
  },
  {
    pattern: /\.download\s*=/,
    label:   'anchor.download =',
    why:     'filename construction is centralized in export.js so it stays consistent',
  },
];

function checkExportOnly(files) {
  const isExportFile = f => f.rel === EXPORT_FILE.split(path.sep).join('/');
  for (const rule of EXPORT_ONLY) {
    scan(files, rule.pattern, (file, line, text) => {
      errors.push(
        `[A] HAND-ROLLED EXPORT: '${rule.label}' at ${file.rel}:${line} — ` +
        `this belongs in ${EXPORT_FILE.split(path.sep).join('/')}, not here. ` +
        `Reason: ${rule.why}.\n      ${text}`
      );
    }, { skip: isExportFile });
  }
}

// ── B. Injection sinks ──────────────────────────────────────────────────────────

const BANNED_SINKS = [
  { pattern: /\.innerHTML\s*=/,          label: '.innerHTML =' },
  { pattern: /\.outerHTML\s*=/,          label: '.outerHTML =' },
  { pattern: /dangerouslySetInnerHTML/,  label: 'dangerouslySetInnerHTML' },
  { pattern: /(?<![\w.$])eval\s*\(/,     label: 'eval(' },
  { pattern: /new Function\s*\(/,        label: 'new Function(' },
];

function checkSinks(files) {
  for (const rule of BANNED_SINKS) {
    scan(files, rule.pattern, (file, line, text) => {
      errors.push(
        `[B] INJECTION SINK: '${rule.label}' at ${file.rel}:${line}. Hana renders ` +
        `network-derived strings (PTR hostnames, WhoIs fields, DNS TXT records, ` +
        `certificate subjects) — none of it may reach an HTML or script sink.\n      ${text}`
      );
    });
  }
}

// ── Run ─────────────────────────────────────────────────────────────────────────

console.log('Hana Codebase Pattern Sweep\n' + '─'.repeat(60));

const files = collect();
console.log(`Scanned ${files.length} files under ${SCAN_DIRS.join('/, ')}/\n`);

checkExportOnly(files);
checkSinks(files);

if (errors.length === 0 && warnings.length === 0) {
  console.log('✓ No banned patterns found.\n');
} else {
  if (errors.length > 0) {
    console.log(`\n✗ ${errors.length} ERROR(S):\n`);
    errors.forEach(e => console.log('  ' + e + '\n'));
    exitCode = 1;
  }
  if (warnings.length > 0) {
    console.log(`\n⚠ ${warnings.length} WARNING(S):\n`);
    warnings.forEach(w => console.log('  ' + w + '\n'));
  }
}

console.log('─'.repeat(60));
console.log(exitCode === 0 ? 'PASS' : 'FAIL');
process.exit(exitCode);
