import { describe, it, expect } from 'vitest';
import { parseRtt, parseTimeout, isUnreachable, isFatalError, parseSummary } from '../pingParse.js';

/**
 * IMPORTANT — read before editing either file.
 *
 * src/components/PingTool.js has its OWN separate, hand-maintained copies of
 * parseRtt, parseTimeout, isUnreachable, isFatalError (inline), and
 * parseSummary — it does NOT import them from this pingParse.js module.
 * Same pattern as electron/main.js vs src/lib/validate.js (see
 * mainValidatorParity.test.js) and SubnetSweep.js's local parseCidr (which
 * WAS successfully extracted and unified during this same migration — see
 * src/utils/subnet.js's parseCidrNotation).
 *
 * Unlike the main.js case, unifying PingTool.js with this module is NOT
 * blocked by a Node-version/CJS-vs-ESM concern — both files are bundled by
 * Vite as ES modules, so importing pingParse.js into PingTool.js is exactly
 * as safe as any other component-to-component import. It was still
 * deliberately deferred in this pass because:
 *
 *   1. PingTool.js is the most fragile file in the project — parseSummary
 *      specifically is the exact function behind the "Destination host
 *      unreachable" false-positive bug that shipped once already.
 *   2. A real semantic difference was found and fixed during this migration:
 *      PingTool.js's live parseTimeout also matches "unreachable" and
 *      "could not find host", which this module's parseTimeout originally
 *      did not. Swapping it in blindly would have silently changed which
 *      lines get flagged as timeout in the browser-preview demo path.
 *   3. Touching this file's live logic in the same pass as a dozen other
 *      changes is exactly the compounding-risk pattern that produced two
 *      real production incidents already this cycle.
 *
 * Every function below was verified byte-for-byte or behaviorally identical
 * against PingTool.js's live implementation via a standalone equivalence
 * script — including replaying the exact historical regression scenario
 * (all replies are router "unreachable" messages) — before this parity test
 * was written. parseRtt, isUnreachable, and isFatalError are byte-identical.
 * parseTimeout was corrected in pingParse.js to match the live (broader)
 * regex. parseSummary's logic differs in inline-regex-vs-function-call style
 * only, confirmed value-equivalent across 8 realistic outputs.
 *
 * If you're reading this because it failed: check whether PingTool.js and
 * pingParse.js have drifted apart, and either resync them or (better) do
 * the actual unification — importing this module into PingTool.js in its
 * own dedicated, carefully-tested change — and delete this file.
 */

// ── Pinned snapshot of PingTool.js's current logic ──────────────────────────
// Source: src/components/PingTool.js, function parseRtt
function parseRtt_LIVE_SNAPSHOT(line) {
  const winMatch  = line.match(/time[<=]([\d.]+)ms/i);
  const unixMatch = line.match(/time[<=]([\d.]+)\s*ms/i);
  if (winMatch)  return parseFloat(winMatch[1]);
  if (unixMatch) return parseFloat(unixMatch[1]);
  return null;
}
// Source: src/components/PingTool.js, function isUnreachable
function isUnreachable_LIVE_SNAPSHOT(line) {
  return /destination host unreachable|host unreachable|unreachable/i.test(line);
}
// Source: src/components/PingTool.js, inline isFatalError check (line ~171)
function isFatalError_LIVE_SNAPSHOT(line) {
  return /could not find host|unknown host|name or service not known|cannot resolve|bad address/i.test(line);
}
// Source: src/components/PingTool.js, function parseSummary
function parseSummary_LIVE_SNAPSHOT(output) {
  const lines = output.split('\n');
  const rtts  = [];
  let unreachableCount = 0;
  let totalCount = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/unreachable/i.test(trimmed)) { unreachableCount++; totalCount++; continue; }
    if (/request timed out/i.test(trimmed)) { totalCount++; continue; }
    const rtt = parseRtt_LIVE_SNAPSHOT(trimmed);
    if (rtt !== null) { rtts.push(rtt); totalCount++; }
  }
  let packetLoss = null;
  if (unreachableCount > 0 && totalCount > 0) {
    packetLoss = parseFloat(((unreachableCount / totalCount) * 100).toFixed(1));
  } else {
    const lossMatch = output.match(/([\d.]+)%\s*packet loss/i) || output.match(/\(([\d.]+)%\s*loss\)/i);
    if (lossMatch) packetLoss = parseFloat(lossMatch[1]);
  }
  const min = rtts.length ? Math.min(...rtts) : null;
  const max = rtts.length ? Math.max(...rtts) : null;
  const avg = rtts.length ? parseFloat((rtts.reduce((a, b) => a + b, 0) / rtts.length).toFixed(2)) : null;
  return { min, max, avg, packetLoss, rtts, allUnreachable: unreachableCount > 0 && rtts.length === 0 };
}

const RTT_TEST_LINES = [
  'Reply from 8.8.8.8: bytes=32 time=14ms TTL=118',
  'Reply from 192.168.1.1: bytes=32 time<1ms TTL=64',
  '64 bytes from 8.8.8.8: icmp_seq=0 ttl=118 time=14.2 ms',
  '64 bytes from 1.1.1.1: icmp_seq=1 ttl=57 time=0.521 ms',
  'Pinging 8.8.8.8 with 32 bytes of data:',
];

const UNREACHABLE_TEST_LINES = [
  'Reply from 10.0.3.10: Destination host unreachable.',
  'From 192.168.1.1: Host Unreachable',
  'Network unreachable',
  'Reply from 8.8.8.8: bytes=32 time=14ms TTL=118',
  'Request timed out.',
];

const FATAL_ERROR_TEST_LINES = [
  'Ping request could not find host x. Please check the name and try again.',
  'ping: unknown host badhost.local',
  'ping: badhost.x: Name or service not known',
  'Reply from 8.8.8.8: bytes=32 time=14ms TTL=118',
];

const SUMMARY_TEST_OUTPUTS = [
  // The exact historical regression: all replies are router "unreachable"
  ['Reply from 10.0.3.10: Destination host unreachable.', 'Reply from 10.0.3.10: Destination host unreachable.',
   'Reply from 10.0.3.10: Destination host unreachable.', 'Reply from 10.0.3.10: Destination host unreachable.'].join('\n'),
  ['64 bytes from 8.8.8.8: icmp_seq=0 ttl=118 time=10 ms', '64 bytes from 8.8.8.8: icmp_seq=1 ttl=118 time=20 ms',
   '64 bytes from 8.8.8.8: icmp_seq=2 ttl=118 time=30 ms'].join('\n'),
  ['Reply from 8.8.8.8: bytes=32 time=10ms TTL=118', 'Reply from 10.0.0.1: Destination host unreachable.'].join('\n'),
  ['Reply from 8.8.8.8: bytes=32 time=10ms TTL=118', 'Request timed out.',
   'Packets: Sent = 2, Received = 1, Lost = 1 (50% loss),'].join('\n'),
  '',
  'Reply from 192.168.1.1: bytes=32 time<1ms TTL=64',
  '64 bytes from 1.1.1.1: icmp_seq=1 ttl=57 time=0.521 ms',
  'From 192.168.1.1: Host Unreachable',
];

describe('PingTool.js / pingParse.js parity (stopgap until unified)', () => {
  it('parseRtt: shared module agrees with the live component snapshot', () => {
    for (const line of RTT_TEST_LINES) {
      expect(parseRtt(line)).toBe(parseRtt_LIVE_SNAPSHOT(line));
    }
  });

  it('isUnreachable: shared module agrees with the live component snapshot', () => {
    for (const line of UNREACHABLE_TEST_LINES) {
      expect(isUnreachable(line)).toBe(isUnreachable_LIVE_SNAPSHOT(line));
    }
  });

  it('isFatalError: shared module agrees with the live component\'s inline check', () => {
    for (const line of FATAL_ERROR_TEST_LINES) {
      expect(isFatalError(line)).toBe(isFatalError_LIVE_SNAPSHOT(line));
    }
  });

  it('parseSummary: shared module agrees with the live component across realistic outputs, including the historical regression case', () => {
    for (const output of SUMMARY_TEST_OUTPUTS) {
      expect(parseSummary(output)).toEqual(parseSummary_LIVE_SNAPSHOT(output));
    }
  });

  it('parseTimeout: shared module matches the live component\'s BROADER regex (also matches unreachable/could-not-find-host, not just literal timeout phrasing)', () => {
    expect(parseTimeout('Request timed out.')).toBe(true);
    expect(parseTimeout('Destination host unreachable.')).toBe(true);
    expect(parseTimeout('Ping request could not find host x.')).toBe(true);
    expect(parseTimeout('Reply from 8.8.8.8: bytes=32 time=14ms TTL=118')).toBe(false);
  });
});
