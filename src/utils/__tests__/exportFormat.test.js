import { describe, it, expect } from 'vitest';
import {
  buildSweepReport, csvCell,
  icsEscapeText, icsFoldLine, buildCertReminderIcs,
} from '../export.js';

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

describe('csvCell — CSV formula injection + delimiter safety', () => {
  it('neutralizes a leading = formula by prefixing an apostrophe', () => {
    // WhoIs/DNS/ISP fields are attacker-influenceable; a raw =... cell executes
    // as a formula when the exported CSV is opened in Excel/Sheets.
    expect(csvCell('=HYPERLINK("http://evil","x")'))
      .toBe(`"'=HYPERLINK(""http://evil"",""x"")"`);
  });

  it('neutralizes the other dangerous leading characters (+ - @)', () => {
    expect(csvCell('+1+1')).toBe(`"'+1+1"`);
    expect(csvCell('@SUM(A1)')).toBe(`"'@SUM(A1)"`);
    expect(csvCell('-2+3+cmd')).toBe(`"'-2+3+cmd"`);
  });

  it('neutralizes a DDE-style payload starting with a control character', () => {
    expect(csvCell('\t=cmd|calc')).toBe(`"'\t=cmd|calc"`);
  });

  it('leaves plain numbers — including negatives — untouched so they stay numeric', () => {
    expect(csvCell('-77.7953')).toBe(`"-77.7953"`);
    expect(csvCell('443')).toBe(`"443"`);
    expect(csvCell(22)).toBe(`"22"`);
  });

  it('doubles embedded quotes so a value cannot break out of its column', () => {
    expect(csvCell('AS15169 "Google" LLC')).toBe(`"AS15169 ""Google"" LLC"`);
  });

  it('keeps commas and newlines contained within the quoted cell', () => {
    expect(csvCell('a,b\nc')).toBe(`"a,b\nc"`);
  });

  it('renders null/undefined as an empty quoted cell', () => {
    expect(csvCell(null)).toBe('""');
    expect(csvCell(undefined)).toBe('""');
  });

  it('does not prefix an ordinary hostname/value', () => {
    expect(csvCell('dns.google')).toBe(`"dns.google"`);
    expect(csvCell('Open')).toBe(`"Open"`);
  });
});

// ── iCalendar (.ics) certificate expiry reminders ─────────────────────────────
//
// Same threat model as the csvCell block above — certificate CNs and SAN
// entries are attacker-influenceable — but iCalendar needs a different
// escaping model, so this is a separate surface with its own hardening tests.

/** Reverse RFC 5545 line folding, so tests can assert on structural lines. */
function unfold(ics) {
  return ics.replace(/\r\n /g, '');
}
function structuralLines(ics) {
  return unfold(ics).split('\r\n');
}
function octets(s) {
  return new TextEncoder().encode(s).length;
}

const NOW = new Date('2027-01-01T00:00:00Z');
/** An expiry timestamp exactly n days after NOW, at 23:59 UTC. */
function expiryInDays(n) {
  const d = new Date(Date.UTC(2027, 0, 1, 23, 59, 0));
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString();
}
function build(overrides = {}) {
  return buildCertReminderIcs({
    host: 'db01.internal',
    certValidTo: expiryInDays(60),
    certSubjectCN: 'db01.internal',
    certIssuerCN: 'Example CA',
    now: NOW,
    ...overrides,
  });
}
const startsOf = (r) =>
  structuralLines(r.ics).filter(l => l.startsWith('DTSTART')).map(l => l.split(':')[1]);

describe('icsEscapeText — iCalendar injection + delimiter safety', () => {
  it('escapes backslash FIRST so later escapes are not double-escaped', () => {
    expect(icsEscapeText(String.raw`a\,b`)).toBe(String.raw`a\\\,b`);
  });

  it('escapes semicolons and commas', () => {
    expect(icsEscapeText('a;b,c')).toBe(String.raw`a\;b\,c`);
  });

  it('converts a newline to a literal backslash-n sequence', () => {
    expect(icsEscapeText('line1\nline2')).toBe(String.raw`line1\nline2`);
  });

  it('normalizes CRLF and a lone CR — never leaves a raw CR in the output', () => {
    expect(icsEscapeText('a\r\nb')).toBe(String.raw`a\nb`);
    expect(icsEscapeText('a\rb')).toBe(String.raw`a\nb`);
    expect(icsEscapeText('a\r\nb')).not.toContain('\r');
  });

  it('strips other control characters but keeps HTAB', () => {
    expect(icsEscapeText('a\x00b\x07c\x1Fd')).toBe('abcd');
    expect(icsEscapeText('a\tb')).toBe('a\tb');
  });

  it('leaves colons and double quotes alone (not escapable in iCalendar TEXT)', () => {
    expect(icsEscapeText('https://example.com "x"')).toBe('https://example.com "x"');
  });

  it('returns an empty string for null/undefined', () => {
    expect(icsEscapeText(null)).toBe('');
    expect(icsEscapeText(undefined)).toBe('');
  });
});

describe('icsFoldLine — RFC 5545 §3.1 octet folding', () => {
  it('leaves a line of exactly 75 octets unfolded', () => {
    const line = 'a'.repeat(75);
    expect(icsFoldLine(line)).toBe(line);
  });

  it('folds at 76 octets, continuing with a single space', () => {
    expect(icsFoldLine('a'.repeat(76))).toBe('a'.repeat(75) + '\r\n a');
  });

  it('keeps every emitted line within 75 octets including the continuation space', () => {
    const lines = icsFoldLine('x'.repeat(300)).split('\r\n');
    expect(lines.length).toBeGreaterThan(3);
    lines.forEach(l => expect(octets(l)).toBeLessThanOrEqual(75));
  });

  it('never splits a multi-byte codepoint, and round-trips when unfolded', () => {
    for (const ch of ['é', '😀', '中']) {
      const line = ch.repeat(80);
      const folded = icsFoldLine(line);
      expect(folded.replace(/\r\n /g, '')).toBe(line);
      folded.split('\r\n').forEach(l => expect(octets(l)).toBeLessThanOrEqual(75));
    }
  });

  it('does not end a segment mid-escape-sequence', () => {
    const folded = icsFoldLine('a'.repeat(74) + String.raw`\,`);
    folded.split('\r\n').forEach(seg => {
      const body = seg.startsWith(' ') ? seg.slice(1) : seg;
      expect(/\\*$/.exec(body)[0].length % 2).toBe(0);
    });
  });
});

describe('buildCertReminderIcs — structure', () => {
  it('emits a well-formed VCALENDAR with the required properties', () => {
    const lines = structuralLines(build().ics);
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines).toContain('VERSION:2.0');
    expect(lines).toContain('PRODID:-//Proxy-IT//Hana Network Utility//EN');
    expect(lines).toContain('CALSCALE:GREGORIAN');
    expect(lines).toContain('METHOD:PUBLISH');
    expect(lines).toContain('END:VCALENDAR');
  });

  it('uses CRLF line endings throughout, including a trailing one', () => {
    const { ics } = build();
    expect(ics.endsWith('\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('gives every event a UID, DTSTAMP, and DATE-typed DTSTART/DTEND', () => {
    const lines = structuralLines(build().ics);
    expect(lines.filter(l => l.startsWith('UID:')).length).toBe(4);
    expect(lines.filter(l => l.startsWith('DTSTAMP:')).length).toBe(4);
    expect(lines.filter(l => l.startsWith('DTSTART;VALUE=DATE:')).length).toBe(4);
    expect(lines.filter(l => l.startsWith('DTEND;VALUE=DATE:')).length).toBe(4);
  });

  it('sets DTEND to the day after DTSTART (non-inclusive end, per Outlook)', () => {
    const lines = structuralLines(build().ics);
    const starts = lines.filter(l => l.startsWith('DTSTART')).map(l => l.split(':')[1]);
    const ends   = lines.filter(l => l.startsWith('DTEND')).map(l => l.split(':')[1]);
    starts.forEach((s, i) => {
      const d = new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)));
      d.setUTCDate(d.getUTCDate() + 1);
      const pad = (n) => String(n).padStart(2, '0');
      expect(ends[i]).toBe(`${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`);
    });
  });

  it('emits events chronologically, longest lead time first', () => {
    expect(build().leadDays).toEqual([45, 30, 10, 3]);
  });

  it('separates the attribution from the factual body with a blank line', () => {
    const desc = structuralLines(build().ics).find(l => l.startsWith('DESCRIPTION:'));
    expect(desc).toContain(String.raw`\n\nScheduled by Hana`);
  });

  it('includes the SAN list when present, truncating long ones', () => {
    const many = Array.from({ length: 25 }, (_, i) => `DNS:h${i}.example.com`).join(', ');
    const desc = structuralLines(build({ certSubjectAltName: many }).ics)
      .find(l => l.startsWith('DESCRIPTION:'));
    expect(desc).toContain('DNS:h0.example.com');
    expect(desc).toContain('and 15 more');
    expect(desc).not.toContain('DNS:h20.example.com');
  });
});

describe('buildCertReminderIcs — injection hardening', () => {
  it('cannot be broken out of via CRLF in an attacker-influenced issuer CN', () => {
    const { ics } = build({
      certIssuerCN: 'Evil\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nSUMMARY:pwned',
    });
    const lines = structuralLines(ics);
    // Exactly the 4 real events — the injected text stays inside DESCRIPTION
    // as literal escaped content rather than becoming structural lines.
    expect(lines.filter(l => l === 'BEGIN:VEVENT').length).toBe(4);
    expect(lines.filter(l => l === 'END:VEVENT').length).toBe(4);
    expect(lines.filter(l => l === 'SUMMARY:pwned').length).toBe(0);
  });

  it('neutralizes semicolons and commas in a certificate subject', () => {
    const desc = structuralLines(build({ certSubjectCN: 'evil;DTSTART:20200101,x' }).ics)
      .find(l => l.startsWith('DESCRIPTION:'));
    expect(desc).toContain(String.raw`evil\;DTSTART:20200101\,x`);
  });
});

describe('buildCertReminderIcs — UTC calendar date math', () => {
  it('handles a leap year (2028-03-01 minus 3 days = 2028-02-27)', () => {
    expect(startsOf(build({
      certValidTo: '2028-03-01T23:59:00Z', now: new Date('2028-02-01T00:00:00Z'),
    }))).toContain('20280227');
  });

  it('handles a month boundary (2027-06-01 minus 3 days = 2027-05-29)', () => {
    expect(startsOf(build({ certValidTo: '2027-06-01T23:59:00Z' }))).toContain('20270529');
  });

  it('handles a year boundary (2027-01-15 minus 45 days = 2026-12-01)', () => {
    expect(startsOf(build({
      certValidTo: '2027-01-15T23:59:00Z', now: new Date('2026-11-01T00:00:00Z'),
    }))).toContain('20261201');
  });

  it('is unaffected by a DST transition inside the subtraction window', () => {
    // US DST begins 2027-03-14; 2027-04-20 minus 45 days spans it.
    expect(startsOf(build({
      certValidTo: '2027-04-20T23:59:00Z', now: new Date('2027-03-01T00:00:00Z'),
    }))).toContain('20270306');
  });
});

describe('buildCertReminderIcs — future-date filtering', () => {
  it('emits all four reminders when the cert expires in 60 days', () => {
    const r = build({ certValidTo: expiryInDays(60) });
    expect(r.count).toBe(4);
    expect(structuralLines(r.ics).filter(l => l === 'BEGIN:VEVENT').length).toBe(4);
  });

  it('skips reminders whose date already passed (20 days out leaves 10d and 3d)', () => {
    const r = build({ certValidTo: expiryInDays(20) });
    expect(r.count).toBe(2);
    expect(r.leadDays).toEqual([10, 3]);
  });

  it('emits a single same-day reminder at exactly 3 days out', () => {
    const r = build({ certValidTo: expiryInDays(3) });
    expect(r.count).toBe(1);
    expect(r.leadDays).toEqual([3]);
  });

  it('emits nothing under 3 days — urgency belongs in the UI, not a calendar', () => {
    const r = build({ certValidTo: expiryInDays(2) });
    expect(r.count).toBe(0);
    expect(r.ics).toBeNull();
    expect(r.reason).toBe('expired');
  });

  it('emits nothing when the cert expires today or has already expired', () => {
    expect(build({ certValidTo: expiryInDays(0) }).count).toBe(0);
    const past = build({ certValidTo: expiryInDays(-10) });
    expect(past.count).toBe(0);
    expect(past.reason).toBe('expired');
  });

  it('reports an unreadable expiry date distinctly from an expired one', () => {
    const r = build({ certValidTo: 'not a date' });
    expect(r.count).toBe(0);
    expect(r.ics).toBeNull();
    expect(r.reason).toBe('unparseable');
    expect(buildCertReminderIcs({ host: 'h', certValidTo: null }).reason).toBe('unparseable');
  });
});

describe('buildCertReminderIcs — determinism', () => {
  it('produces byte-identical output for identical inputs and clock', () => {
    expect(build().ics).toBe(build().ics);
  });

  it('produces stable, unique UIDs so re-importing dedupes instead of duplicating', () => {
    const uids = structuralLines(build().ics).filter(l => l.startsWith('UID:'));
    expect(uids).toEqual(structuralLines(build().ics).filter(l => l.startsWith('UID:')));
    expect(new Set(uids).size).toBe(4);
    uids.forEach(u => expect(u).toContain('@hana.proxy-it.co'));
  });
});
