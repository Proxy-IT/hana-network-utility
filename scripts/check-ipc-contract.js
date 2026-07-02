#!/usr/bin/env node
/**
 * Hana — IPC Contract Checker
 *
 * This script exists because of two real incidents:
 *   1. v1.7.2 shipped with `getSystemInfo` removed from preload.js while
 *      App.js still called it on every mount — white screen on launch.
 *   2. The same release briefly had three error channels (`onContinuousPingError`,
 *      `onMultiPingError`, `onTracerouteError`) sent by main.js but never
 *      exposed by preload.js — silently broken error banners, discovered
 *      only by manual code audit.
 *
 * Both bugs are invisible to unit tests, because they're WIRING bugs, not
 * logic bugs. This script statically verifies the three-layer IPC contract:
 *
 *   renderer (src/**)  --calls-->  preload.js  --relays-->  main.js
 *
 * It checks:
 *   A. Every `window.electronAPI.X` call in src/ has a matching export in preload.js
 *      (an unmatched call is a crash risk UNLESS it uses optional chaining `?.`)
 *   B. Every `ipcRenderer.send/invoke` channel in preload.js has a matching
 *      `ipcMain.on/handle` in main.js (an unmatched one is a silent no-op)
 *   C. Every `ipcMain.on/handle` channel in main.js is actually sent by preload.js
 *      (an unmatched one is dead code — not dangerous, but worth flagging)
 *
 * Exit code 0 = contract is clean. Exit code 1 = a real problem was found.
 * Run via `npm run check:ipc`. Wired into CI as a required check before build.
 */

const fs   = require('fs');
const path = require('path');

const SRC_DIR      = path.join(__dirname, '..', 'src');
const PRELOAD_PATH  = path.join(__dirname, '..', 'electron', 'preload.js');
const MAIN_PATH      = path.join(__dirname, '..', 'electron', 'main.js');

let exitCode = 0;
const warnings = [];
const errors   = [];

// ── Helpers ────────────────────────────────────────────────────────────────────

function readAllFiles(dir, extensions, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
      readAllFiles(fullPath, extensions, results);
    } else if (extensions.some(ext => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

function readFile(p) {
  return fs.readFileSync(p, 'utf8');
}

// ── A. Renderer calls vs preload exports ────────────────────────────────────────

function checkRendererToPreload() {
  const srcFiles = readAllFiles(SRC_DIR, ['.js', '.jsx']);
  const preloadContent = readFile(PRELOAD_PATH);

  // Every `X:` at the top level of the exposeInMainWorld object is an exported method
  const exposedMethods = new Set(
    [...preloadContent.matchAll(/^\s{2}([a-zA-Z][a-zA-Z0-9]*)\s*:/gm)].map(m => m[1])
  );

  const calledMethods = new Map(); // method -> { file, line, optional }

  for (const file of srcFiles) {
    const content = readFile(file);
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      const matches = [...line.matchAll(/electronAPI\.([a-zA-Z][a-zA-Z0-9]*)(\?\.)?/g)];
      for (const m of matches) {
        const [, method, optionalChain] = m;
        const isOptional = !!optionalChain;
        // Keep the "most dangerous" (non-optional) call if the method is called
        // both ways in different places — we want to know if ANY call is unsafe.
        const existing = calledMethods.get(method);
        if (!existing || (existing.optional && !isOptional)) {
          calledMethods.set(method, {
            file: path.relative(process.cwd(), file),
            line: idx + 1,
            optional: isOptional,
          });
        }
      }
    });
  }

  for (const [method, info] of calledMethods) {
    if (!exposedMethods.has(method)) {
      if (info.optional) {
        // NOTE: still an ERROR (fails CI), not just a warning. Hana's preload.js
        // and renderer always ship together in the same build — there is no
        // legitimate scenario where an optional-chained call is permanently
        // unmatched. This exact pattern (onContinuousPingError, onMultiPingError,
        // onTracerouteError) shipped broken in v1.7.2 precisely because a
        // warning-only check would not have blocked the release.
        errors.push(
          `[A] SILENTLY BROKEN: '${method}' is called with optional chaining (?.) at ` +
          `${info.file}:${info.line} but preload.js does not expose 'electronAPI.${method}'. ` +
          `This won't crash, but whatever it's wired to (usually an error handler) ` +
          `silently does nothing — this exact pattern shipped broken once already.`
        );
      } else {
        errors.push(
          `[A] CRASH RISK: '${method}' is called at ${info.file}:${info.line} without ` +
          `optional chaining, but preload.js does not expose 'electronAPI.${method}'. ` +
          `This will throw "is not a function" at runtime.`
        );
      }
    }
  }
}

// ── B & C. Preload channels vs main handlers ────────────────────────────────────

function checkPreloadToMain() {
  const preloadContent = readFile(PRELOAD_PATH);
  const mainContent    = readFile(MAIN_PATH);

  const preloadChannels = new Set(
    [...preloadContent.matchAll(/ipcRenderer\.(?:send|invoke)\(\s*'([^']+)'/g)].map(m => m[1])
  );
  const mainChannels = new Set(
    [...mainContent.matchAll(/ipcMain\.(?:on|handle)\(\s*'([^']+)'/g)].map(m => m[1])
  );

  for (const channel of preloadChannels) {
    if (!mainChannels.has(channel)) {
      errors.push(
        `[B] SILENT NO-OP: preload.js sends/invokes channel '${channel}' but ` +
        `main.js has no 'ipcMain.on' or 'ipcMain.handle' for it. Any call to this ` +
        `will silently do nothing (send) or hang forever (invoke).`
      );
    }
  }

  for (const channel of mainChannels) {
    if (!preloadChannels.has(channel)) {
      warnings.push(
        `[C] DEAD HANDLER: main.js handles channel '${channel}' but preload.js never ` +
        `sends/invokes it. Not dangerous, but likely leftover code — verify it's ` +
        `actually unreachable before assuming it's safe to remove (see the ` +
        `getSystemInfo incident: it looked orphaned but App.js called it directly).`
      );
    }
  }
}

// ── Run ──────────────────────────────────────────────────────────────────────────

console.log('Hana IPC Contract Checker\n' + '─'.repeat(60));

checkRendererToPreload();
checkPreloadToMain();

if (errors.length === 0 && warnings.length === 0) {
  console.log('✓ Contract is fully consistent — no issues found.\n');
} else {
  if (errors.length > 0) {
    console.log(`\n✗ ${errors.length} ERROR(S) — these will break the app:\n`);
    errors.forEach(e => console.log('  ' + e + '\n'));
    exitCode = 1;
  }
  if (warnings.length > 0) {
    console.log(`\n⚠ ${warnings.length} WARNING(S) — review before assuming these are safe:\n`);
    warnings.forEach(w => console.log('  ' + w + '\n'));
  }
}

console.log('─'.repeat(60));
console.log(exitCode === 0 ? 'PASS' : 'FAIL');
process.exit(exitCode);
