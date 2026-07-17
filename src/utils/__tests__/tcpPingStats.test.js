import { describe, it, expect } from 'vitest';
import { computeJitter, longestFailureStreak, computeTcpPingStats } from '../tcpPingStats.js';

function ok(totalMs)  { return { status: 'success', totalMs }; }
function fail(status) { return { status, totalMs: null }; }

describe('computeJitter', () => {
  it('returns null with fewer than 2 successful attempts', () => {
    expect(computeJitter([])).toBeNull();
    expect(computeJitter([ok(10)])).toBeNull();
    expect(computeJitter([ok(10), fail('timeout')])).toBeNull();
  });

  it('computes mean absolute delta between consecutive successful RTTs', () => {
    // deltas: |15-10|=5, |12-15|=3 -> avg 4
    expect(computeJitter([ok(10), ok(15), ok(12)])).toBe(4);
  });

  it('ignores failed attempts when computing deltas (does not treat them as 0)', () => {
    // successful RTTs only: 10, 20 -> delta 10
    expect(computeJitter([ok(10), fail('timeout'), ok(20)])).toBe(10);
  });
});

describe('longestFailureStreak', () => {
  it('returns 0 when there are no failures', () => {
    expect(longestFailureStreak([ok(10), ok(12)])).toBe(0);
  });

  it('finds the longest run of consecutive non-success attempts', () => {
    const attempts = [
      ok(10), fail('timeout'), fail('timeout'), fail('refused'), ok(11), fail('timeout'),
    ];
    expect(longestFailureStreak(attempts)).toBe(3);
  });

  it('counts a trailing streak that runs to the end of the array', () => {
    const attempts = [ok(10), fail('timeout'), fail('timeout')];
    expect(longestFailureStreak(attempts)).toBe(2);
  });

  it('returns 0 for an empty array', () => {
    expect(longestFailureStreak([])).toBe(0);
  });
});

describe('computeTcpPingStats', () => {
  it('computes min/max/avg/sent/lost/loss over successful attempts only', () => {
    const attempts = [ok(10), ok(20), ok(30), fail('timeout')];
    const stats = computeTcpPingStats(attempts);
    expect(stats.min).toBe(10);
    expect(stats.max).toBe(30);
    expect(stats.avg).toBe(20);
    expect(stats.sent).toBe(4);
    expect(stats.lost).toBe(1);
    expect(stats.loss).toBe(25);
  });

  it('returns null min/max/avg and 0 loss for an empty attempts array', () => {
    const stats = computeTcpPingStats([]);
    expect(stats.min).toBeNull();
    expect(stats.max).toBeNull();
    expect(stats.avg).toBeNull();
    expect(stats.sent).toBe(0);
    expect(stats.lost).toBe(0);
    expect(stats.loss).toBe(0);
    expect(stats.jitter).toBeNull();
    expect(stats.longestFailStreak).toBe(0);
  });

  it('reports 100% loss when every attempt failed', () => {
    const attempts = [fail('timeout'), fail('refused')];
    const stats = computeTcpPingStats(attempts);
    expect(stats.loss).toBe(100);
    expect(stats.min).toBeNull();
  });

  it('includes jitter and longestFailStreak in the summary', () => {
    const attempts = [ok(10), ok(20), fail('timeout'), fail('timeout')];
    const stats = computeTcpPingStats(attempts);
    expect(stats.jitter).toBe(10);
    expect(stats.longestFailStreak).toBe(2);
  });
});
