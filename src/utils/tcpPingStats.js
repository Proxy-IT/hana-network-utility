// ── TCP Ping stats ─────────────────────────────────────────────────────────────
//
// Pure functions over a TCP Ping attempts array (see src/components/TcpPing.js
// for the shape: { seq, status, dnsMs, connectMs, tlsMs, totalMs, error }).
// Deliberately NOT a useRef-based incremental accumulator like PingTool.js's
// continuous-mode stats — computed fresh from the full attempts array so it's
// pure and independently testable. Tests live in
// src/utils/__tests__/tcpPingStats.test.js.
//
// Callers should keep the full attempts array (not just the last N shown on
// screen) so these stats stay "since Start" for the whole session — only the
// graph/live-list should slice down to a display window.

function successfulRtts(attempts) {
  return attempts.filter(a => a.status === 'success' && a.totalMs != null).map(a => a.totalMs);
}

function jitterFromRtts(rtts) {
  if (rtts.length < 2) return null;
  let sum = 0;
  for (let i = 1; i < rtts.length; i++) sum += Math.abs(rtts[i] - rtts[i - 1]);
  return parseFloat((sum / (rtts.length - 1)).toFixed(2));
}

/**
 * Mean absolute difference between consecutive successful attempts' totalMs.
 * Returns null if fewer than 2 successful attempts exist.
 * @param {Array<{status: string, totalMs: number|null}>} attempts
 * @returns {number|null}
 */
export function computeJitter(attempts) {
  return jitterFromRtts(successfulRtts(attempts));
}

/**
 * Longest consecutive run of non-success attempts.
 * @param {Array<{status: string}>} attempts
 * @returns {number}
 */
export function longestFailureStreak(attempts) {
  let longest = 0;
  let current = 0;
  for (const a of attempts) {
    if (a.status !== 'success') {
      current++;
      if (current > longest) longest = current;
    } else {
      current = 0;
    }
  }
  return longest;
}

/**
 * Full summary stats for a TCP Ping session.
 * @param {Array<{status: string, totalMs: number|null}>} attempts
 * @returns {{min: number|null, max: number|null, avg: number|null, sent: number,
 *   lost: number, loss: number, jitter: number|null, longestFailStreak: number}}
 */
export function computeTcpPingStats(attempts) {
  const rtts = successfulRtts(attempts);
  const sent = attempts.length;
  const lost = sent - rtts.length;
  return {
    min:  rtts.length ? Math.min(...rtts) : null,
    max:  rtts.length ? Math.max(...rtts) : null,
    avg:  rtts.length ? parseFloat((rtts.reduce((a, b) => a + b, 0) / rtts.length).toFixed(2)) : null,
    sent,
    lost,
    loss: sent > 0 ? parseFloat(((lost / sent) * 100).toFixed(1)) : 0,
    jitter: jitterFromRtts(rtts),
    longestFailStreak: longestFailureStreak(attempts),
  };
}
