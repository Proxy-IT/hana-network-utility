import { describe, it, expect } from 'vitest';
import { buildSweepReport } from '../export.js';

/**
 * Export format regression tests.
 *
 * These guard against the "Look Look Network Utility Tools" branding bug
 * that shipped in an early release — the wrong brand name appeared in every
 * exported .txt report.
 *
 * IMPORTANT: this test imports `buildSweepReport` directly from the REAL
 * src/utils/export.js — it is not a reimplementation. This required a small
 * refactor of export.js: the pure string-building logic was extracted out of
 * `exportSweepTxt` (which also calls browser-only download APIs — Blob,
 * URL.createObjectURL — that don't exist in a Vitest/Node environment) into
 * its own exported, side-effect-free function. `exportSweepTxt` now just
 * calls `buildSweepReport` and passes the result to the download step.
 *
 * This means a regression in the actual shipped report-building code will
 * be caught here — earlier versions of this test file tested a copy of the
 * logic living only inside the test, which provided no real protection.
 */

const CORRECT_BRAND = 'Hana - Network Utility';
const OLD_BRAND      = 'Look Look Network Utility Tools';

describe('buildSweepReport (real production code from src/utils/export.js)', () => {
  it('uses the current brand name — never the old one', () => {
    const report = buildSweepReport({
      mode: 'range', baseIp: '192.168.1', start: 1, end: 10,
      results: [{ ip: '192.168.1.1', alive: true }, { ip: '192.168.1.2', alive: false }],
    });
    expect(report).toContain(CORRECT_BRAND);
    expect(report).not.toContain(OLD_BRAND);   // the exact regression that shipped
  });

  it('labels Range mode correctly and shows the host range', () => {
    const report = buildSweepReport({
      mode: 'range', baseIp: '10.0.0', start: 1, end: 50,
      results: [],
    });
    expect(report).toContain('Range');
    expect(report).toContain('10.0.0.1 → 10.0.0.50');
  });

  it('labels CIDR mode and includes the notation plus first/last host', () => {
    const report = buildSweepReport({
      mode: 'cidr', cidr: '10.0.0.0/22',
      results: [
        { ip: '10.0.0.1',   alive: true },
        { ip: '10.0.3.254', alive: false },
      ],
    });
    expect(report).toContain('CIDR');
    expect(report).toContain('10.0.0.0/22');
    expect(report).toContain('10.0.0.1');    // first host in the range display
    expect(report).toContain('10.0.3.254');  // last host in the range display
  });

  it('counts live and no-response hosts correctly', () => {
    const results = [
      { ip: '10.0.0.1', alive: true  },
      { ip: '10.0.0.2', alive: false },
      { ip: '10.0.0.3', alive: false },
      { ip: '10.0.0.4', alive: true  },
    ];
    const report = buildSweepReport({ mode: 'range', baseIp: '10.0.0', start: 1, end: 4, results });
    expect(report).toContain('Live       : 2');
    expect(report).toContain('No Response: 2');
    expect(report).toContain('Scanned    : 4');
  });

  it('lists live hosts under "Live Hosts" and dead hosts under "No Response"', () => {
    const results = [
      { ip: '10.0.0.1', alive: true  },
      { ip: '10.0.0.2', alive: false },
    ];
    const report = buildSweepReport({ mode: 'range', baseIp: '10.0.0', start: 1, end: 2, results });
    const liveSection = report.split('--- Live Hosts ---')[1].split('--- No Response ---')[0];
    const deadSection = report.split('--- No Response ---')[1];
    expect(liveSection).toContain('10.0.0.1');
    expect(liveSection).not.toContain('10.0.0.2');
    expect(deadSection).toContain('10.0.0.2');
    expect(deadSection).not.toContain('10.0.0.1');
  });

  it('handles an empty results array without throwing', () => {
    expect(() => buildSweepReport({
      mode: 'range', baseIp: '10.0.0', start: 1, end: 0, results: [],
    })).not.toThrow();
  });
});
