import { describe, it, expect } from 'vitest';
import { parseRtt, parseTimeout, isUnreachable, isFatalError, parseSummary } from '../pingParse.js';

// ── parseRtt ──────────────────────────────────────────────────────────────────

describe('parseRtt', () => {
  it('extracts RTT from Windows reply (time=14ms, no space)', () => {
    expect(parseRtt('Reply from 8.8.8.8: bytes=32 time=14ms TTL=118')).toBe(14);
  });

  it('extracts RTT from Windows reply (time<1ms)', () => {
    expect(parseRtt('Reply from 192.168.1.1: bytes=32 time<1ms TTL=64')).toBe(1);
  });

  it('extracts RTT from Unix reply (time=14.2 ms, with space)', () => {
    expect(parseRtt('64 bytes from 8.8.8.8: icmp_seq=0 ttl=118 time=14.2 ms')).toBe(14.2);
  });

  it('extracts fractional RTT correctly', () => {
    expect(parseRtt('64 bytes from 1.1.1.1: icmp_seq=1 ttl=57 time=0.521 ms')).toBe(0.521);
  });

  it('returns null for lines with no time field', () => {
    expect(parseRtt('Pinging 8.8.8.8 with 32 bytes of data:')).toBeNull();
    expect(parseRtt('Ping statistics for 8.8.8.8:')).toBeNull();
    expect(parseRtt('')).toBeNull();
  });
});

// ── isUnreachable ─────────────────────────────────────────────────────────────

describe('isUnreachable — the false-positive bug guard', () => {
  // This exact line caused false "host is alive" results in early Hana.
  // Windows returns a reply FROM the router, not the target, with an RTT.
  // Without unreachable detection, it looks like the target responded.
  it('flags Windows "Destination host unreachable" replies', () => {
    expect(isUnreachable('Reply from 10.0.3.10: Destination host unreachable.')).toBe(true);
  });

  it('flags generic "host unreachable"', () => {
    expect(isUnreachable('From 192.168.1.1: Host Unreachable')).toBe(true);
  });

  it('flags bare "unreachable"', () => {
    expect(isUnreachable('Network unreachable')).toBe(true);
  });

  it('does NOT flag normal successful replies', () => {
    expect(isUnreachable('Reply from 8.8.8.8: bytes=32 time=14ms TTL=118')).toBe(false);
    expect(isUnreachable('64 bytes from 8.8.8.8: icmp_seq=0 ttl=118 time=14.2 ms')).toBe(false);
  });

  it('does NOT flag timeout lines', () => {
    expect(isUnreachable('Request timed out.')).toBe(false);
  });
});

// ── isFatalError ──────────────────────────────────────────────────────────────

describe('isFatalError', () => {
  it('detects Windows "could not find host"', () => {
    expect(isFatalError('Ping request could not find host not@a!host. Please check the name and try again.')).toBe(true);
  });

  it('detects Unix "unknown host"', () => {
    expect(isFatalError('ping: unknown host badhost.local')).toBe(true);
  });

  it('detects "Name or service not known"', () => {
    expect(isFatalError('ping: badhost.x: Name or service not known')).toBe(true);
  });

  it('does not flag normal output', () => {
    expect(isFatalError('Reply from 8.8.8.8: bytes=32 time=14ms TTL=118')).toBe(false);
    expect(isFatalError('64 bytes from 8.8.8.8: icmp_seq=0 ttl=118 time=14.2 ms')).toBe(false);
  });
});

// ── parseSummary ──────────────────────────────────────────────────────────────

describe('parseSummary', () => {
  it('computes min/avg/max for genuine replies', () => {
    const output = [
      '64 bytes from 8.8.8.8: icmp_seq=0 ttl=118 time=10 ms',
      '64 bytes from 8.8.8.8: icmp_seq=1 ttl=118 time=20 ms',
      '64 bytes from 8.8.8.8: icmp_seq=2 ttl=118 time=30 ms',
    ].join('\n');
    const s = parseSummary(output);
    expect(s.min).toBe(10);
    expect(s.max).toBe(30);
    expect(s.avg).toBe(20);
    expect(s.allUnreachable).toBe(false);
  });

  it('reports 100% loss and allUnreachable=true when all replies are unreachable', () => {
    // This is the exact regression — Windows reports 0% packet loss but
    // every reply is "Destination host unreachable" from the router.
    const output = [
      'Reply from 10.0.3.10: Destination host unreachable.',
      'Reply from 10.0.3.10: Destination host unreachable.',
      'Reply from 10.0.3.10: Destination host unreachable.',
      'Reply from 10.0.3.10: Destination host unreachable.',
    ].join('\n');
    const s = parseSummary(output);
    expect(s.avg).toBeNull();
    expect(s.min).toBeNull();
    expect(s.max).toBeNull();
    expect(s.allUnreachable).toBe(true);
    expect(s.packetLoss).toBe(100);
  });

  it('handles mixed replies (some real, some unreachable)', () => {
    const output = [
      'Reply from 8.8.8.8: bytes=32 time=10ms TTL=118',
      'Reply from 10.0.0.1: Destination host unreachable.',
    ].join('\n');
    const s = parseSummary(output);
    expect(s.rtts).toEqual([10]);
    expect(s.allUnreachable).toBe(false); // there was at least one real reply
    expect(s.packetLoss).toBe(50);        // 1 of 2 was unreachable
  });

  it('handles Windows packet loss percentage in summary line', () => {
    const output = [
      'Reply from 8.8.8.8: bytes=32 time=10ms TTL=118',
      'Request timed out.',
      'Packets: Sent = 2, Received = 1, Lost = 1 (50% loss),',
    ].join('\n');
    const s = parseSummary(output);
    expect(s.packetLoss).toBe(50);
  });

  it('returns all nulls for empty output', () => {
    const s = parseSummary('');
    expect(s.min).toBeNull();
    expect(s.max).toBeNull();
    expect(s.avg).toBeNull();
    expect(s.allUnreachable).toBe(false);
  });
});
