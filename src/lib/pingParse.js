/**
 * Hana — Ping output parsers
 *
 * Pure functions that parse raw ping stdout lines.
 * No side effects, no imports. Fully testable.
 *
 * Tests live in src/lib/__tests__/pingParse.test.js
 */

/**
 * Extracts RTT in milliseconds from a ping reply line.
 * Handles both Windows (time=14ms) and Unix (time=14.2 ms) formats.
 * @param {string} line
 * @returns {number|null}
 */
export function parseRtt(line) {
  const winMatch  = line.match(/time[<=]([\d.]+)ms/i);
  const unixMatch = line.match(/time[<=]([\d.]+)\s*ms/i);
  if (winMatch)  return parseFloat(winMatch[1]);
  if (unixMatch) return parseFloat(unixMatch[1]);
  return null;
}

/**
 * Returns true if the line indicates a timeout or unreachable condition
 * (no genuine reply from the target).
 *
 * NOTE: this intentionally also matches "unreachable" and "could not find
 * host" phrasing, not just literal timeout messages — this matches the
 * actual regex used by the live PingTool.js component (verified via a
 * side-by-side equivalence check during the v1.8.0 migration; an earlier
 * version of this function only matched "request timed out" style phrasing
 * and would have silently changed behavior if it had been wired in as-is).
 * @param {string} line
 * @returns {boolean}
 */
export function parseTimeout(line) {
  return /request timed out|no answer|100% packet loss|destination host unreachable|host unreachable|unreachable|could not find host/i.test(line);
}

/**
 * Returns true if the line is a "Destination host unreachable" reply
 * from an intermediate router — NOT a genuine reply from the target.
 *
 * This was the source of false-positive "host is alive" results in early
 * Hana versions. Windows returns:
 *   "Reply from 10.0.3.10: Destination host unreachable."
 * which looks like a reply but means the target is not reachable.
 * @param {string} line
 * @returns {boolean}
 */
export function isUnreachable(line) {
  return /destination host unreachable|host unreachable|unreachable/i.test(line);
}

/**
 * Returns true if the line is a fatal DNS resolution failure.
 * These come through stdout (not stderr) and should be shown as errors,
 * not as ping result lines.
 * @param {string} line
 * @returns {boolean}
 */
export function isFatalError(line) {
  return /could not find host|unknown host|name or service not known|cannot resolve|bad address/i.test(line);
}

/**
 * Parses the complete ping output to extract summary statistics.
 * Handles the case where all replies are "unreachable" (router returns
 * ICMP unreachable — Windows reports 0% packet loss but no RTTs).
 *
 * @param {string} output - complete stdout from ping process
 * @returns {{
 *   min: number|null,
 *   max: number|null,
 *   avg: number|null,
 *   packetLoss: number|null,
 *   allUnreachable: boolean,
 *   rtts: number[]
 * }}
 */
export function parseSummary(output) {
  const lines = output.split('\n');
  const rtts  = [];
  let unreachableCount = 0;
  let totalCount       = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (isUnreachable(trimmed)) {
      unreachableCount++;
      totalCount++;
      continue;
    }
    if (/request timed out/i.test(trimmed)) {
      totalCount++;
      continue;
    }
    const rtt = parseRtt(trimmed);
    if (rtt !== null) {
      rtts.push(rtt);
      totalCount++;
    }
  }

  // If all replies came from a router reporting unreachable, report 100% loss
  let packetLoss = null;
  if (unreachableCount > 0 && totalCount > 0) {
    packetLoss = parseFloat(((unreachableCount / totalCount) * 100).toFixed(1));
  } else {
    const lossMatch =
      output.match(/([\d.]+)%\s*packet loss/i) ||
      output.match(/\(([\d.]+)%\s*loss\)/i);
    if (lossMatch) packetLoss = parseFloat(lossMatch[1]);
  }

  const min = rtts.length ? Math.min(...rtts)                                          : null;
  const max = rtts.length ? Math.max(...rtts)                                          : null;
  const avg = rtts.length ? parseFloat((rtts.reduce((a, b) => a + b, 0) / rtts.length).toFixed(2)) : null;

  return {
    min,
    max,
    avg,
    packetLoss,
    allUnreachable: unreachableCount > 0 && rtts.length === 0,
    rtts,
  };
}
