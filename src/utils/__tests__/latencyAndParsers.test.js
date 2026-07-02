import { describe, it, expect } from 'vitest';
import { classifyLatency } from '../latency.js';
import { parseTracerouteLines } from '../parsers.js';

/**
 * classifyLatency is used by the Latency Guide and PingTool's live RTT
 * classification. parseTracerouteLines is used by the real, live
 * Traceroute.js component (via onTracerouteData) — unlike the parseCidr/
 * validate/pingParse cases found elsewhere in this migration, this one was
 * ALREADY correctly imported and wired up, not duplicated locally. Every
 * boundary value and sample line below was checked against the real
 * compiled function output before being written into an assertion.
 */

describe('classifyLatency', () => {
  it('classifies loopback (<1ms)', () => {
    expect(classifyLatency(0).tier).toBe('Loopback');
    expect(classifyLatency(0.5).tier).toBe('Loopback');
  });

  it('classifies excellent (1-4ms)', () => {
    expect(classifyLatency(1).tier).toBe('Excellent');
    expect(classifyLatency(4).tier).toBe('Excellent');
  });

  it('classifies good (5-19ms)', () => {
    expect(classifyLatency(5).tier).toBe('Good');
    expect(classifyLatency(19).tier).toBe('Good');
  });

  it('classifies acceptable (20-49ms)', () => {
    expect(classifyLatency(20).tier).toBe('Acceptable');
    expect(classifyLatency(49).tier).toBe('Acceptable');
  });

  it('classifies fair (50-99ms)', () => {
    expect(classifyLatency(50).tier).toBe('Fair');
    expect(classifyLatency(99).tier).toBe('Fair');
  });

  it('classifies poor (100-199ms)', () => {
    expect(classifyLatency(100).tier).toBe('Poor');
    expect(classifyLatency(199).tier).toBe('Poor');
  });

  it('classifies critical (200ms+)', () => {
    expect(classifyLatency(200).tier).toBe('Critical');
    expect(classifyLatency(500).tier).toBe('Critical');
  });

  it('returns a color and emoji alongside the tier', () => {
    const r = classifyLatency(10);
    expect(r.color).toBe('#00D4FF');
    expect(r.emoji).toBe('✓');
  });
});

describe('parseTracerouteLines', () => {
  it('parses a Windows-style hop line', () => {
    const result = parseTracerouteLines(' 1     1 ms     1 ms     1 ms  192.168.1.1');
    expect(result.length).toBe(1);
    expect(result[0].hop).toBe(1);
    expect(result[0].ip).toBe('192.168.1.1');
    expect(result[0].timeout).toBe(false);
    expect(result[0].rtts.length).toBe(3);
  });

  it('parses a Unix-style hop line with hostname and IP', () => {
    const result = parseTracerouteLines(' 2  10.0.0.1 (10.0.0.1)  5.123 ms  5.456 ms  5.789 ms');
    expect(result.length).toBe(1);
    expect(result[0].hop).toBe(2);
    expect(result[0].ip).toBe('10.0.0.1');
    expect(result[0].rtts).toEqual([5.123, 5.456, 5.789]);
  });

  it('flags a timeout hop (all asterisks) with no RTTs', () => {
    const result = parseTracerouteLines(' 3  * * *');
    expect(result.length).toBe(1);
    expect(result[0].hop).toBe(3);
    expect(result[0].timeout).toBe(true);
    expect(result[0].rtts.length).toBe(0);
  });

  it('parses multiple hops from multi-line input', () => {
    const input = ' 1     1 ms     1 ms     1 ms  192.168.1.1\n 3  * * *';
    const result = parseTracerouteLines(input);
    expect(result.length).toBe(2);
    expect(result[0].hop).toBe(1);
    expect(result[1].hop).toBe(3);
    expect(result[1].timeout).toBe(true);
  });

  it('does not throw on empty or malformed input', () => {
    expect(() => parseTracerouteLines('')).not.toThrow();
    expect(() => parseTracerouteLines('not a hop line at all')).not.toThrow();
    expect(parseTracerouteLines('').length).toBe(0);
  });
});
