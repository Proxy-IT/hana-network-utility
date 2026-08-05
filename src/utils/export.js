// ── Export utilities ──────────────────────────────────────────────────────────

/**
 * Serialize one value into a safe CSV cell.
 *
 * Two protections, since exported data includes untrusted third-party strings
 * (WhoIs registrar/registrant/org fields, raw WhoIs text, ISP names, reverse-DNS
 * PTR hostnames, traceroute hostnames):
 *
 *  1. Formula injection — a cell beginning with = + - @ or a control character
 *     is executed as a formula by Excel/Sheets/LibreOffice. Prefix such values
 *     with an apostrophe so they render as literal text. Plain numbers (including
 *     negative coordinates / UTC offsets) are left untouched so they stay numeric.
 *  2. Delimiter breakage — embedded double-quotes are doubled and the whole value
 *     is wrapped in quotes, so commas, quotes, and newlines can't shift columns.
 */
export function csvCell(value) {
  let s = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) {
    s = "'" + s;
  }
  return `"${s.replace(/"/g, '""')}"`;
}

function toCsv(rows) {
  return rows.map(r => r.map(csvCell).join(',')).join('\n');
}

function downloadFile(filename, content, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function timestamp() {
  const d = new Date();
  return d.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

// ── PING exports ──────────────────────────────────────────────────────────────

export function exportPingTxt({ host, output, rawOutput, samples, liveStats, continuous }) {
  const ts = new Date().toLocaleString();
  let lines = [
    '========================================',
    '  Hana - Network Utility',
    '  Ping Report',
    '========================================',
    `Host       : ${host}`,
    `Mode       : ${continuous ? 'Continuous' : 'Fixed'}`,
    `Timestamp  : ${ts}`,
    '',
  ];

  if (continuous && liveStats) {
    lines.push('--- Summary ---');
    lines.push(`Packets Sent : ${liveStats.sent}`);
    lines.push(`Packets Lost : ${liveStats.lost}`);
    lines.push(`Packet Loss  : ${liveStats.loss}%`);
    lines.push(`Min RTT      : ${liveStats.min != null ? liveStats.min + ' ms' : 'N/A'}`);
    lines.push(`Avg RTT      : ${liveStats.avg != null ? liveStats.avg + ' ms' : 'N/A'}`);
    lines.push(`Max RTT      : ${liveStats.max != null ? liveStats.max + ' ms' : 'N/A'}`);
    lines.push('');
    lines.push('--- Sample Log ---');
    lines.push('Seq    RTT (ms)   Status');
    lines.push('------ ---------- -----------');
    samples.forEach(s => {
      const seq    = String(s.seq).padEnd(6);
      const rtt    = s.timeout ? 'timeout'.padEnd(10) : String(s.rtt + ' ms').padEnd(10);
      const status = s.timeout ? 'No response' : 'OK';
      lines.push(`${seq} ${rtt} ${status}`);
    });
  } else if (output && !output.error) {
    lines.push('--- Summary ---');
    lines.push(`Min RTT      : ${output.min != null ? output.min + ' ms' : 'N/A'}`);
    lines.push(`Avg RTT      : ${output.avg != null ? output.avg + ' ms' : 'N/A'}`);
    lines.push(`Max RTT      : ${output.max != null ? output.max + ' ms' : 'N/A'}`);
    lines.push(`Packet Loss  : ${output.packetLoss != null ? output.packetLoss + '%' : 'N/A'}`);
    lines.push('');
    lines.push('--- Raw Output ---');
    lines.push(rawOutput || '');
  }

  downloadFile(`ping_${host}_${timestamp()}.txt`, lines.join('\n'));
}

export function exportPingCsv({ host, output, samples, liveStats, continuous }) {
  let rows = [];
  if (continuous && samples.length > 0) {
    rows.push(['Seq', 'RTT_ms', 'Status', 'Host', 'Timestamp']);
    const ts = new Date().toLocaleString();
    samples.forEach(s => {
      rows.push([s.seq, s.timeout ? '' : s.rtt, s.timeout ? 'Timeout' : 'OK', host, ts]);
    });
    if (liveStats) {
      rows.push([]);
      rows.push(['Summary', '', '', '', '']);
      rows.push(['Sent', liveStats.sent, '', '', '']);
      rows.push(['Lost', liveStats.lost, '', '', '']);
      rows.push(['Loss_%', liveStats.loss, '', '', '']);
      rows.push(['Min_ms', liveStats.min ?? '', '', '', '']);
      rows.push(['Avg_ms', liveStats.avg ?? '', '', '', '']);
      rows.push(['Max_ms', liveStats.max ?? '', '', '', '']);
    }
  } else if (output && !output.error) {
    rows.push(['Packet', 'RTT_ms', 'Host']);
    (output.rtts || []).forEach((rtt, i) => rows.push([i + 1, rtt, host]));
    rows.push([]);
    rows.push(['Metric', 'Value', '']);
    rows.push(['Min_ms',  output.min  ?? '', '']);
    rows.push(['Avg_ms',  output.avg  ?? '', '']);
    rows.push(['Max_ms',  output.max  ?? '', '']);
    rows.push(['Loss_%',  output.packetLoss ?? '', '']);
  }
  const csv = toCsv(rows);
  downloadFile(`ping_${host}_${timestamp()}.csv`, csv, 'text/csv');
}

// ── TCP PING exports ──────────────────────────────────────────────────────────

export function exportTcpPingTxt({ host, port, useTls, attempts, stats }) {
  const ts = new Date().toLocaleString();
  const lines = [
    '========================================',
    '  Hana - Network Utility',
    '  TCP Ping Report',
    '========================================',
    `Host       : ${host}`,
    `Port       : ${port}`,
    `TLS        : ${useTls ? 'Yes' : 'No'}`,
    `Timestamp  : ${ts}`,
    '',
  ];

  if (stats) {
    lines.push('--- Summary ---');
    lines.push(`Attempts Sent      : ${stats.sent}`);
    lines.push(`Attempts Failed    : ${stats.lost}`);
    lines.push(`Loss               : ${stats.loss}%`);
    lines.push(`Min RTT            : ${stats.min != null ? stats.min + ' ms' : 'N/A'}`);
    lines.push(`Avg RTT            : ${stats.avg != null ? stats.avg + ' ms' : 'N/A'}`);
    lines.push(`Max RTT            : ${stats.max != null ? stats.max + ' ms' : 'N/A'}`);
    lines.push(`Jitter             : ${stats.jitter != null ? stats.jitter + ' ms' : 'N/A'}`);
    lines.push(`Longest Fail Streak: ${stats.longestFailStreak}`);
    lines.push('');
  }

  // Cert columns appended at the end, after Error — inserting them earlier
  // would shift Error's column position for anyone parsing this fixed-width
  // report by column, and existing TCP Ping exports from before v1.11.5 had
  // Error as the last field.
  lines.push('--- Attempt Log ---');
  lines.push('Seq    Status       DNS_ms     Connect_ms TLS_ms     Total_ms   Error       Cert_Days  Cert_Valid_To              Cert_Subject_CN                Cert_Issuer_CN');
  lines.push('------ ------------ ---------- ---------- ---------- ---------- ----------- ---------- -------------------------- ------------------------------ ------------------------------');
  attempts.forEach(a => {
    const seq   = String(a.seq).padEnd(6);
    const stat  = String(a.status).padEnd(12);
    const dns   = (a.dnsMs             != null ? String(a.dnsMs)             : '-').padEnd(10);
    const conn  = (a.connectMs         != null ? String(a.connectMs)        : '-').padEnd(10);
    const tls   = (a.tlsMs             != null ? String(a.tlsMs)            : '-').padEnd(10);
    const tot   = (a.totalMs           != null ? String(a.totalMs)          : '-').padEnd(10);
    const err   = (a.error || '').padEnd(11);
    const cdays = (a.certDaysRemaining != null ? String(a.certDaysRemaining): '-').padEnd(10);
    const cval  = (a.certValidTo   || '-').padEnd(26);
    const csub  = (a.certSubjectCN || '-').padEnd(30);
    const ciss  = a.certIssuerCN   || '-';
    lines.push(`${seq} ${stat} ${dns} ${conn} ${tls} ${tot} ${err} ${cdays} ${cval} ${csub} ${ciss}`);
  });

  downloadFile(`tcpping_${host}_${port}_${timestamp()}.txt`, lines.join('\n'));
}

export function exportTcpPingCsv({ host, port, useTls, attempts, stats }) {
  const ts = new Date().toLocaleString();
  // Cert columns appended at the end — inserting them before Error/Host/Port
  // would shift those existing columns' positions for anyone parsing this
  // CSV by fixed index (existing TCP Ping exports from before v1.11.5 ended
  // at Timestamp).
  const rows = [['Seq', 'Status', 'DNS_ms', 'Connect_ms', 'TLS_ms', 'Total_ms', 'Error', 'Host', 'Port', 'Timestamp', 'Cert_Days_Remaining', 'Cert_Valid_To', 'Cert_Subject_CN', 'Cert_Issuer_CN']];
  attempts.forEach(a => {
    rows.push([a.seq, a.status, a.dnsMs ?? '', a.connectMs ?? '', a.tlsMs ?? '', a.totalMs ?? '', a.error || '', host, port, ts, a.certDaysRemaining ?? '', a.certValidTo ?? '', a.certSubjectCN ?? '', a.certIssuerCN ?? '']);
  });
  if (stats) {
    rows.push([]);
    rows.push(['Summary']);
    rows.push(['TLS', useTls ? 'Yes' : 'No']);
    rows.push(['Sent', stats.sent]);
    rows.push(['Lost', stats.lost]);
    rows.push(['Loss_%', stats.loss]);
    rows.push(['Min_ms', stats.min ?? '']);
    rows.push(['Avg_ms', stats.avg ?? '']);
    rows.push(['Max_ms', stats.max ?? '']);
    rows.push(['Jitter_ms', stats.jitter ?? '']);
    rows.push(['Longest_Fail_Streak', stats.longestFailStreak]);
  }
  downloadFile(`tcpping_${host}_${port}_${timestamp()}.csv`, toCsv(rows), 'text/csv');
}

// ── MULTI-PING exports ────────────────────────────────────────────────────────

/**
 * Pure report builder, extracted from the download path for the same reason as
 * buildSweepReport — Blob/URL.createObjectURL don't exist in the Node test
 * environment, so the string-building has to be testable on its own.
 *
 * Iterates `slots`, not `results`: a slot can be removed while its results
 * entry lingers, and reporting on a host that is no longer being monitored
 * would be misleading.
 */
export function buildMultiPingReport({ slots, results }) {
  const ts = new Date().toLocaleString();
  const rows = (slots || []).filter(sl => sl.host && sl.host.trim());

  const lines = [
    '========================================',
    '  Hana - Network Utility',
    '  Multi-Ping Report',
    '========================================',
    `Timestamp  : ${ts}`,
    `Hosts      : ${rows.length}`,
    '',
    'Host                           Status        RTT        Sent   Lost   Loss %   Last Seen',
    '------------------------------ ------------- ---------- ------ ------ -------- -----------',
  ];

  rows.forEach(sl => {
    const r = (results || {})[sl.id] || {};
    const loss = r.sent > 0 ? ((r.lost / r.sent) * 100).toFixed(1) : '—';
    lines.push(
      [
        String(sl.host).padEnd(30).slice(0, 30),
        String(r.status || 'not started').padEnd(13),
        (r.rtt != null ? `${r.rtt} ms` : '—').padEnd(10),
        String(r.sent ?? 0).padEnd(6),
        String(r.lost ?? 0).padEnd(6),
        String(loss).padEnd(8),
        r.lastSeen || '—',
      ].join(' '),
    );
    if (r.errorMessage) lines.push(`  └ ${r.errorMessage}`);
  });

  return lines.join('\n');
}

export function exportMultiPingTxt({ slots, results }) {
  downloadFile(`multiping_${timestamp()}.txt`, buildMultiPingReport({ slots, results }));
}

export function exportMultiPingCsv({ slots, results }) {
  const ts = new Date().toLocaleString();
  const rows = [['Host', 'Status', 'RTT_ms', 'Sent', 'Lost', 'Loss_%', 'Last_Seen', 'Error', 'Timestamp']];
  (slots || []).filter(sl => sl.host && sl.host.trim()).forEach(sl => {
    const r = (results || {})[sl.id] || {};
    rows.push([
      sl.host,
      r.status || 'not started',
      r.rtt ?? '',
      r.sent ?? 0,
      r.lost ?? 0,
      r.sent > 0 ? ((r.lost / r.sent) * 100).toFixed(1) : '',
      r.lastSeen || '',
      r.errorMessage || '',
      ts,
    ]);
  });
  downloadFile(`multiping_${timestamp()}.csv`, toCsv(rows), 'text/csv');
}

// ── TLS CERT EXPIRY CALENDAR REMINDERS (.ics) ─────────────────────────────────
//
// Generates one iCalendar file holding up to four all-day reminder events
// ahead of a certificate's expiry. Hand-rolled against RFC 5545 rather than
// pulling a dependency, same as the CSV/TXT builders above.
//
// The pure builder is exported separately from the download wrapper for the
// same reason buildSweepReport is: Blob/URL.createObjectURL don't exist in the
// Node test environment, so the string-building has to be testable on its own.

export const ICS_LEAD_DAYS = [45, 30, 10, 3];
const ICS_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const ICS_MAX_SAN_SHOWN = 10;
// Relative to DTSTART, which for an all-day event is midnight — so this
// fires at noon on the preceding day. ICS_ALARM_LEAD_MS must stay in step
// with the trigger string: it's what decides whether an alarm would already
// have elapsed, in which case it's omitted rather than emitted dead.
export const ICS_ALARM_TRIGGER = '-PT12H';
const ICS_ALARM_LEAD_MS = 12 * 60 * 60 * 1000;

// Splits a Node `subjectaltname` string on entry boundaries only. A plain
// split(',') shears entries whose value legitimately contains a comma —
// `DirName:/C=US, O=Example` — into two fragments, each of which then reads
// like an independent hostname. The lookahead requires the next token to
// look like an entry prefix (`DNS:`, `IP Address:`, `DirName:`), which
// `O=Example` does not.
const SAN_ENTRY_BOUNDARY = /,\s*(?=[A-Za-z][A-Za-z0-9 .-]*:)/;

/**
 * Escape a value for an iCalendar TEXT property (RFC 5545 §3.3.11).
 *
 * Certificate CNs and SAN entries are attacker-influenceable — the same threat
 * class that motivated csvCell's formula-injection defense — but iCalendar
 * needs a completely different escaping model, so csvCell is not reusable here:
 * it wraps in quotes, ICS backslash-escapes.
 *
 * Order matters twice over:
 *  1. Line breaks are normalized BEFORE escaping. Escaping only "\n" would
 *     leave a lone CR sitting raw inside a content line — §3.1's TSAFE-CHAR
 *     excludes control characters, and a stray CR corrupts folding. Remaining
 *     control characters are stripped for the same reason (HTAB is legal, so
 *     it stays).
 *  2. Backslash is escaped FIRST, or every backslash introduced by the
 *     escapes below would itself get escaped again.
 *
 * The injection this blocks: a newline in an issuer CN would otherwise end
 * the DESCRIPTION property and let arbitrary iCalendar properties — or a
 * whole extra VEVENT — be written into the file.
 */
export function icsEscapeText(value) {
  if (value == null) return '';
  return String(value)
    .replace(/\r\n|\r/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Fold a content line to 75 octets per RFC 5545 §3.1.
 *
 * Octets, not characters — so this walks code points and measures their UTF-8
 * byte length, because splitting mid-codepoint would put an invalid UTF-8
 * sequence after the continuation space. Continuation lines begin with a
 * single space which itself counts against the 75, hence the 74 budget after
 * the first segment.
 *
 * Always call this AFTER escaping, on the fully assembled property line.
 */
export function icsFoldLine(line) {
  const chars = Array.from(String(line));
  const segments = [];
  let cur = [];
  let bytes = 0;
  let limit = 75;

  for (const ch of chars) {
    // Derived arithmetically rather than via TextEncoder.encode(ch).length,
    // which allocated a Uint8Array per character — ~13x slower over a whole
    // document. Array.from gives whole code points, so codePointAt(0) is the
    // full character and these four ranges are the complete UTF-8 encoding.
    const cp = ch.codePointAt(0);
    const chBytes = cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
    if (bytes + chBytes > limit) {
      // Don't end a segment mid-escape-sequence. An odd run of trailing
      // backslashes means the last one opens an escape whose partner would
      // land on the next line. Compliant parsers unfold before parsing values
      // so this is legal either way, but not every real-world parser does.
      let trail = 0;
      while (trail < cur.length && cur[cur.length - 1 - trail] === '\\') trail++;
      const carry = (trail % 2 === 1 && cur.length > 1) ? cur.pop() : null;

      segments.push(cur.join(''));
      cur = carry ? [carry] : [];
      bytes = carry ? 1 : 0;
      limit = 74;
    }
    cur.push(ch);
    bytes += chBytes;
  }
  segments.push(cur.join(''));
  return segments.join('\r\n ');
}

function icsDate(d) {
  // The year is padded too: a certificate whose notAfter parses to a year
  // below 1000 would otherwise emit a 6-digit DATE like `500101`, which is
  // malformed — and importers typically reject the whole VCALENDAR rather
  // than the one bad event.
  return String(d.getUTCFullYear()).padStart(4, '0')
    + String(d.getUTCMonth() + 1).padStart(2, '0')
    + String(d.getUTCDate()).padStart(2, '0');
}

function icsDateTimeUtc(d) {
  return icsDate(d) + 'T'
    + String(d.getUTCHours()).padStart(2, '0')
    + String(d.getUTCMinutes()).padStart(2, '0')
    + String(d.getUTCSeconds()).padStart(2, '0') + 'Z';
}

// Hand-formatted rather than toLocaleString so output is deterministic and
// doesn't depend on the runtime's ICU data being present.
function formatExpiryDisplay(d) {
  let h = d.getUTCHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  return `${ICS_MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}, ${h}:${min} ${ampm} UTC`;
}

// SAN is unbounded and attacker-controlled (shared certs can list hundreds of
// names), so only the first few reach the description.
function formatSanList(raw) {
  if (!raw) return null;
  const entries = String(raw).split(SAN_ENTRY_BOUNDARY).map(s => s.trim()).filter(Boolean);
  if (entries.length === 0) return null;
  const shown = entries.slice(0, ICS_MAX_SAN_SHOWN);
  const extra = entries.length - shown.length;
  return shown.join(', ') + (extra > 0 ? `, and ${extra} more` : '');
}

/**
 * Which reminders are still worth scheduling, and why not if none are.
 *
 * Shared by countCertReminders and buildCertReminderIcs so the number the UI
 * shows can never disagree with the number of events in the file.
 *
 * reason is one of:
 *   'unparseable' — the certificate's valid_to string couldn't be read
 *   'expired'     — the certificate has already lapsed
 *   'too-soon'    — still valid, but every lead time is already behind us
 *   null          — there is at least one reminder to schedule
 */
function computeReminderDates(certValidTo, now) {
  const expiryMs = certValidTo ? Date.parse(certValidTo) : NaN;
  if (isNaN(expiryMs)) return { events: [], reason: 'unparseable', expiry: null };

  const expiry = new Date(expiryMs);

  // Anchor everything on UTC calendar days. UTC has no DST, so subtracting
  // days here is exact; reading the parsed date with local getters would shift
  // it a day for anyone west of UTC.
  const expiryDay = Date.UTC(expiry.getUTCFullYear(), expiry.getUTCMonth(), expiry.getUTCDate());
  const todayDay  = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  // ICS_LEAD_DAYS runs longest-first, so events come out chronologically.
  const events = [];
  for (const lead of ICS_LEAD_DAYS) {
    const d = new Date(expiryDay);
    d.setUTCDate(d.getUTCDate() - lead);
    if (d.getTime() >= todayDay) events.push({ lead, date: d });
  }

  const reason = events.length > 0
    ? null
    : (expiryMs <= now.getTime() ? 'expired' : 'too-soon');

  return { events, reason, expiry };
}

/**
 * How many reminders a certificate would produce, without building the file.
 *
 * The UI drives its button label and enabled state off this rather than off a
 * days-remaining figure computed when the probe ran — that number can disagree
 * by a day at boundaries, which would let the label promise a different number
 * of events than the download actually contains.
 */
export function countCertReminders({ certValidTo, now = new Date() } = {}) {
  const { events, reason } = computeReminderDates(certValidTo, now);
  return { count: events.length, leadDays: events.map(e => e.lead), reason };
}

/**
 * Build the .ics payload for a certificate's expiry reminders.
 *
 * Returns { ics, count, leadDays, reason }; `ics` is null when there is
 * nothing worth scheduling and `reason` says why (see computeReminderDates).
 *
 * `now` is injectable so DTSTAMP, the future-date filter, and the alarm
 * elapsed-check are all testable.
 */
export function buildCertReminderIcs({
  host, certValidTo, certSubjectCN, certIssuerCN, certSubjectAltName,
  now = new Date(),
} = {}) {
  const { events, reason, expiry } = computeReminderDates(certValidTo, now);
  if (events.length === 0) {
    return { ics: null, count: 0, leadDays: [], reason };
  }

  const titleHost    = host || certSubjectCN || 'unknown host';
  const certName     = certSubjectCN || host || 'unknown';
  const sanList      = formatSanList(certSubjectAltName);
  const expiryText   = formatExpiryDisplay(expiry);
  const dtstamp      = icsDateTimeUtc(now);
  const expiryStamp  = icsDate(expiry);
  const uidHost      = String(host || 'unknown').replace(/[^a-zA-Z0-9._-]/g, '_');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Proxy-IT//Hana Network Utility//EN',
    'CALSCALE:GREGORIAN',
    // Outlook's desktop import path keys off METHOD; omitting it is legal but
    // is one of the ways a file that Google accepts misbehaves in Outlook.
    'METHOD:PUBLISH',
  ];

  for (const ev of events) {
    // DTEND is non-inclusive (§3.8.2.2) so a one-day event ends the next day.
    // It's spelled out rather than omitted because Outlook does not honour the
    // spec's "DATE-valued DTSTART with no DTEND lasts one day" allowance, and
    // §3.6.1 requires DTEND's value type to match DTSTART's.
    const end = new Date(ev.date.getTime());
    end.setUTCDate(end.getUTCDate() + 1);

    const desc = [
      `Certificate: ${certName}`,
      `Issuer: ${certIssuerCN || 'Unknown'}`,
      `Expires: ${expiryText}`,
    ];
    if (sanList) desc.push(`SAN: ${sanList}`);
    desc.push('', 'Scheduled by Hana');

    const summary = `Certificate expiring in ${ev.lead} days: ${titleHost}`;

    lines.push(
      'BEGIN:VEVENT',
      `UID:${icsEscapeText(`hana-cert-${ev.lead}d-${uidHost}-${expiryStamp}@hana.proxy-it.co`)}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${icsDate(ev.date)}`,
      `DTEND;VALUE=DATE:${icsDate(end)}`,
      `SUMMARY:${icsEscapeText(summary)}`,
      `DESCRIPTION:${icsEscapeText(desc.join('\n'))}`,
    );

    // Without a VALARM, whether the user is notified at all is left to each
    // calendar client's default for all-day events — which is commonly no
    // notification. TRIGGER is relative to DTSTART (§3.8.6.3), and all-day
    // events start at midnight, so -PT12H fires at noon the day before.
    //
    // But an event dated today would put that alarm at noon YESTERDAY, and
    // clients discard already-elapsed alarms on import — which silently killed
    // the notification on the single most urgent reminder. When the alarm
    // would already have passed, the event still goes on the calendar; it just
    // doesn't carry a dead alarm. The instant is approximated in UTC, and the
    // comparison deliberately errs toward omitting: a missing popup is visible,
    // whereas one the client silently drops is not.
    if (ev.date.getTime() - ICS_ALARM_LEAD_MS > now.getTime()) {
      lines.push(
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `TRIGGER:${ICS_ALARM_TRIGGER}`,
        `DESCRIPTION:${icsEscapeText(summary)}`,
        'END:VALARM',
      );
    }

    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');

  return {
    ics: lines.map(icsFoldLine).join('\r\n') + '\r\n',
    count: events.length,
    leadDays: events.map(e => e.lead),
    reason, // null on success — keeps the shape identical across both paths
  };
}

export function exportCertRemindersIcs(args) {
  const result = buildCertReminderIcs(args);
  if (!result.ics) return result;
  const safeHost = String(args?.host || 'cert').replace(/[^a-zA-Z0-9.-]/g, '_');
  downloadFile(
    `cert_reminders_${safeHost}_${timestamp()}.ics`,
    result.ics,
    'text/calendar;charset=utf-8',
  );
  return result;
}

// ── TRACEROUTE exports ────────────────────────────────────────────────────────

export function exportTraceTxt({ host, hops }) {
  const ts = new Date().toLocaleString();
  const lines = [
    '========================================',
    '  Hana - Network Utility',
    '  Traceroute Report',
    '========================================',
    `Destination : ${host}`,
    `Timestamp   : ${ts}`,
    `Total Hops  : ${hops.filter(h => h.hop).length}`,
    '',
    'Hop    IP Address        Host                           RTT 1      RTT 2      RTT 3',
    '------ ----------------- ------------------------------ ---------- ---------- ----------',
  ];

  hops.forEach(hop => {
    if (!hop.hop) return;
    const hopN = String(hop.hop).padEnd(6);
    const ip   = (hop.ip   || '—').padEnd(17);
    const host2 = (hop.host || (hop.timeout ? '* * *' : '—')).padEnd(30).slice(0, 30);
    const rtts = [0,1,2].map(j =>
      hop.rtts?.[j] != null ? (hop.rtts[j] + ' ms').padEnd(10) : '*'.padEnd(10)
    );
    lines.push(`${hopN} ${ip} ${host2} ${rtts.join(' ')}`);
  });

  downloadFile(`traceroute_${host}_${timestamp()}.txt`, lines.join('\n'));
}

export function exportTraceCsv({ host, hops }) {
  const ts = new Date().toLocaleString();
  const rows = [
    ['Hop', 'IP_Address', 'Hostname', 'RTT1_ms', 'RTT2_ms', 'RTT3_ms', 'Avg_ms', 'Timeout', 'Destination', 'Timestamp'],
  ];
  hops.forEach(hop => {
    if (!hop.hop) return;
    const avg = hop.rtts?.length
      ? (hop.rtts.reduce((a,b) => a+b, 0) / hop.rtts.length).toFixed(1)
      : '';
    rows.push([
      hop.hop,
      hop.ip   || '',
      hop.host || '',
      hop.rtts?.[0] ?? '',
      hop.rtts?.[1] ?? '',
      hop.rtts?.[2] ?? '',
      avg,
      hop.timeout ? 'Yes' : 'No',
      host,
      ts,
    ]);
  });
  const csv = toCsv(rows);
  downloadFile(`traceroute_${host}_${timestamp()}.csv`, csv, 'text/csv');
}

// ── DNS LOOKUP exports ────────────────────────────────────────────────────────

// These lived inside DnsLookup.js until they were moved here. That copy built its
// CSV with `r.map(v => `"${v}"`)`, which neither escaped embedded quotes nor
// guarded against formula injection — the exact flaw csvCell exists to prevent.
// It matters most here: DNS record values are supplied by whoever controls the
// zone, and TXT records (SPF/DKIM) routinely contain literal double-quotes.

export function buildDnsReport({ host, type, server, results }) {
  const ts = new Date().toLocaleString();
  return [
    '========================================',
    '  Hana - Network Utility',
    '  DNS Lookup Report',
    '========================================',
    `Host       : ${host}`,
    `Record Type: ${type}`,
    `DNS Server : ${server}`,
    `Timestamp  : ${ts}`,
    '',
    '--- Results ---',
    ...(results || []).map(r =>
      `${String(r.type).padEnd(6)} ${r.value}${r.priority != null ? ` (priority: ${r.priority})` : ''}${r.ttl != null ? ` TTL: ${r.ttl}s` : ''}`
    ),
  ].join('\n');
}

// Exported separately from exportDnsCsv so the injection-sensitive row assembly
// is unit-testable without Blob/URL.createObjectURL.
export function buildDnsCsvRows({ host, type, server, results }) {
  const ts = new Date().toLocaleString();
  return [
    ['Type', 'Value', 'Priority', 'TTL', 'Host', 'DNS_Server', 'Timestamp'],
    ...(results || []).map(r => [r.type, r.value, r.priority ?? '', r.ttl ?? '', host, server, ts]),
  ];
}

export function exportDnsTxt({ host, type, server, results }) {
  downloadFile(`dns_${host}_${timestamp()}.txt`, buildDnsReport({ host, type, server, results }));
}

export function exportDnsCsv({ host, type, server, results }) {
  const csv = toCsv(buildDnsCsvRows({ host, type, server, results }));
  downloadFile(`dns_${host}_${timestamp()}.csv`, csv, 'text/csv');
}

// ── PORT SCANNER exports ──────────────────────────────────────────────────────

// Moved out of PortScanner.js. That copy already used csvCell, so it was safe
// against injection, but it hand-rolled the Blob/anchor download (leaking every
// object URL) and sorted `results` — a React state array — in place.

function sortedPorts(results) {
  return [...(results || [])].sort((a, b) => a.port - b.port);
}

export function buildPortScanReport({ host, results }) {
  const ts   = new Date().toLocaleString();
  const all  = sortedPorts(results);
  const open = all.filter(r => r.status === 'open');
  return [
    '========================================',
    '  Hana - Network Utility',
    '  Port Scan Report',
    '========================================',
    `Target    : ${host}`,
    `Timestamp : ${ts}`,
    `Scanned   : ${all.length} ports`,
    `Open      : ${open.length}`,
    '',
    '--- Results ---',
    'PORT     SERVICE          STATUS',
    '-------- ---------------- ----------',
    ...all.map(r =>
      `${String(r.port).padEnd(8)} ${(r.service || 'Unknown').padEnd(16)} ${String(r.status).toUpperCase()}`
    ),
  ].join('\n');
}

export function buildPortScanCsvRows({ host, results }) {
  const ts = new Date().toLocaleString();
  return [
    ['Port', 'Service', 'Status', 'Host', 'Timestamp'],
    ...sortedPorts(results).map(r => [r.port, r.service || 'Unknown', r.status, host, ts]),
  ];
}

export function exportScanTxt({ host, results }) {
  downloadFile(`portscan_${host}_${timestamp()}.txt`, buildPortScanReport({ host, results }));
}

export function exportScanCsv({ host, results }) {
  const csv = toCsv(buildPortScanCsvRows({ host, results }));
  downloadFile(`portscan_${host}_${timestamp()}.csv`, csv, 'text/csv');
}

// ── SUBNET SWEEP exports ──────────────────────────────────────────────────────

// Pure string-builder, extracted from exportSweepTxt so it can be unit tested
// without needing browser download APIs (Blob, URL.createObjectURL) that don't
// exist in a Node test environment. This is what src/lib/__tests__/exportFormat.test.js
// actually imports and tests — no more reimplementing the logic inside the test file.
export function buildSweepReport({ baseIp, start, end, cidr, mode, results }) {
  const ts    = new Date().toLocaleString();
  const alive = results.filter(r => r.alive);
  const dead  = results.filter(r => !r.alive);

  const sortedIps = [...results].sort((a, b) => {
    const aParts = a.ip.split('.').map(Number);
    const bParts = b.ip.split('.').map(Number);
    for (let i = 0; i < 4; i++) {
      if (aParts[i] !== bParts[i]) return aParts[i] - bParts[i];
    }
    return 0;
  });
  const firstIp = sortedIps.length ? sortedIps[0].ip : '';
  const lastIp  = sortedIps.length ? sortedIps[sortedIps.length - 1].ip : '';
  const rangeStr = mode === 'cidr'
    ? `${cidr} (${firstIp} → ${lastIp})`
    : `${baseIp}.${start} → ${baseIp}.${end}`;

  const lines = [
    '========================================',
    '  Hana - Network Utility',
    '  Subnet Sweep Report',
    '========================================',
    `Mode       : ${mode === 'cidr' ? 'CIDR' : 'Range'}`,
    `Range      : ${rangeStr}`,
    `Timestamp  : ${ts}`,
    `Scanned    : ${results.length}`,
    `Live       : ${alive.length}`,
    `No Response: ${dead.length}`,
    '',
    '--- Live Hosts ---',
    ...alive.map(r => `  ${r.ip}`),
    '',
    '--- No Response ---',
    ...dead.map(r => `  ${r.ip}`),
  ];

  return lines.join('\n');
}

export function exportSweepTxt({ baseIp, start, end, cidr, mode, results }) {
  const text = buildSweepReport({ baseIp, start, end, cidr, mode, results });
  const filename = mode === 'cidr'
    ? `sweep_${cidr.replace('/', '-')}_${timestamp()}.txt`
    : `sweep_${baseIp}_${timestamp()}.txt`;
  downloadFile(filename, text);
}

export function exportSweepCsv({ baseIp, start, end, cidr, mode, results }) {
  const ts = new Date().toLocaleString();
  const rangeStr = mode === 'cidr' ? cidr : `${baseIp}.${start}-${end}`;

  const rows = [
    ['IP_Address', 'Status', 'Mode', 'Range', 'Timestamp'],
    ...results
      .sort((a, b) => {
        const aParts = a.ip.split('.').map(Number);
        const bParts = b.ip.split('.').map(Number);
        for (let i = 0; i < 4; i++) {
          if (aParts[i] !== bParts[i]) return aParts[i] - bParts[i];
        }
        return 0;
      })
      .map(r => [r.ip, r.alive ? 'Live' : 'No Response', mode === 'cidr' ? 'CIDR' : 'Range', rangeStr, ts]),
  ];

  const csv = toCsv(rows);
  const filename = mode === 'cidr'
    ? `sweep_${cidr.replace('/', '-')}_${timestamp()}.csv`
    : `sweep_${baseIp}_${timestamp()}.csv`;
  downloadFile(filename, csv, 'text/csv');
}

// ── IP INFO exports ───────────────────────────────────────────────────────────

export function exportMyIpTxt(data) {
  const ts = new Date().toLocaleString();
  const lines = [
    '========================================',
    '  Hana - Network Utility',
    '  My Public IP Report',
    '========================================',
    `Timestamp  : ${ts}`,
    '',
    '--- Public IP Details ---',
    `IP Address : ${data.ip || '—'}`,
    `ISP / Org  : ${data.isp || '—'}`,
    `ASN        : ${data.asn || '—'}`,
    `Country    : ${data.country || '—'} (${data.countryCode || '—'})`,
    `Region     : ${data.region || '—'} (${data.regionCode || '—'})`,
    `City       : ${data.city || '—'}`,
    `Postal     : ${data.postal || '—'}`,
    `Timezone   : ${data.timezone || '—'}`,
    `UTC Offset : ${data.utcOffset || '—'}`,
    `Latitude   : ${data.latitude || '—'}`,
    `Longitude  : ${data.longitude || '—'}`,
  ];
  downloadFile(`my_public_ip_${timestamp()}.txt`, lines.join('\n'));
}

export function exportMyIpCsv(data) {
  const ts = new Date().toLocaleString();
  const rows = [
    ['Field', 'Value', 'Timestamp'],
    ['IP Address',  data.ip          || '', ts],
    ['ISP / Org',   data.isp         || '', ''],
    ['ASN',         data.asn         || '', ''],
    ['Country',     data.country     || '', ''],
    ['Country Code',data.countryCode || '', ''],
    ['Region',      data.region      || '', ''],
    ['Region Code', data.regionCode  || '', ''],
    ['City',        data.city        || '', ''],
    ['Postal',      data.postal      || '', ''],
    ['Timezone',    data.timezone    || '', ''],
    ['UTC Offset',  data.utcOffset   || '', ''],
    ['Latitude',    data.latitude    || '', ''],
    ['Longitude',   data.longitude   || '', ''],
  ];
  const csv = toCsv(rows);
  downloadFile(`my_public_ip_${timestamp()}.csv`, csv, 'text/csv');
}

export function exportLocalInterfaceTxt(iface) {
  const ts = new Date().toLocaleString();
  const ipv4 = iface.addresses.find(a => a.family === 'IPv4');
  const ipv6 = iface.addresses.find(a => a.family === 'IPv6');
  const lines = [
    '========================================',
    '  Hana - Network Utility',
    '  Local Network Interface Report',
    '========================================',
    `Timestamp  : ${ts}`,
    '',
    '--- Interface Details ---',
    `Interface  : ${iface.name || '—'}`,
    `Type       : ${iface.type || '—'}`,
    `IPv4       : ${ipv4 ? ipv4.address : '—'}`,
    `Subnet     : ${ipv4 ? ipv4.cidr : '—'}`,
    `IPv6       : ${ipv6 ? ipv6.address : '—'}`,
    `MAC        : ${iface.mac || '—'}`,
  ];
  downloadFile(`local_interface_${iface.name}_${timestamp()}.txt`, lines.join('\n'));
}

export function exportLocalInterfaceCsv(iface) {
  const ts = new Date().toLocaleString();
  const ipv4 = iface.addresses.find(a => a.family === 'IPv4');
  const ipv6 = iface.addresses.find(a => a.family === 'IPv6');
  const rows = [
    ['Field', 'Value', 'Timestamp'],
    ['Interface', iface.name || '', ts],
    ['Type',      iface.type || '', ''],
    ['IPv4',      ipv4 ? ipv4.address : '', ''],
    ['Subnet',    ipv4 ? ipv4.cidr : '', ''],
    ['IPv6',      ipv6 ? ipv6.address : '', ''],
    ['MAC',       iface.mac || '', ''],
  ];
  const csv = toCsv(rows);
  downloadFile(`local_interface_${iface.name}_${timestamp()}.csv`, csv, 'text/csv');
}

export function exportIpLookupTxt(data) {
  const ts = new Date().toLocaleString();
  const lines = [
    '========================================',
    '  Hana - Network Utility',
    '  IP Lookup Report',
    '========================================',
    `Timestamp  : ${ts}`,
    '',
    '--- Lookup Results ---',
    `IP Address : ${data.ip          || '—'}`,
    `ISP / Org  : ${data.isp         || '—'}`,
    `ASN        : ${data.asn         || '—'}`,
    `Country    : ${data.country     || '—'} (${data.countryCode || '—'})`,
    `Region     : ${data.region      || '—'} (${data.regionCode  || '—'})`,
    `City       : ${data.city        || '—'}`,
    `Postal     : ${data.postal      || '—'}`,
    `Timezone   : ${data.timezone    || '—'}`,
    `UTC Offset : ${data.utcOffset   || '—'}`,
    `Latitude   : ${data.latitude    || '—'}`,
    `Longitude  : ${data.longitude   || '—'}`,
  ];
  downloadFile(`ip_lookup_${data.ip}_${timestamp()}.txt`, lines.join('\n'));
}

export function exportIpLookupCsv(data) {
  const ts = new Date().toLocaleString();
  const rows = [
    ['Field', 'Value', 'Timestamp'],
    ['IP Address',  data.ip          || '', ts],
    ['ISP / Org',   data.isp         || '', ''],
    ['ASN',         data.asn         || '', ''],
    ['Country',     data.country     || '', ''],
    ['Country Code',data.countryCode || '', ''],
    ['Region',      data.region      || '', ''],
    ['Region Code', data.regionCode  || '', ''],
    ['City',        data.city        || '', ''],
    ['Postal',      data.postal      || '', ''],
    ['Timezone',    data.timezone    || '', ''],
    ['UTC Offset',  data.utcOffset   || '', ''],
    ['Latitude',    data.latitude    || '', ''],
    ['Longitude',   data.longitude   || '', ''],
  ];
  const csv = toCsv(rows);
  downloadFile(`ip_lookup_${data.ip}_${timestamp()}.csv`, csv, 'text/csv');
}

export function exportWhoisTxt({ query, data }) {
  const ts = new Date().toLocaleString();
  const lines = [
    '========================================',
    '  Hana - Network Utility',
    '  WhoIs Report',
    '========================================',
    `Query      : ${query}`,
    `Timestamp  : ${ts}`,
    `Source     : ${data.source || 'unknown'}`,
    '',
  ];

  if (data.rdap) {
    const d = data.rdap;
    const events = d.events || [];
    const getEvent = (type) => events.find(e => e.eventAction === type)?.eventDate;
    const nameservers = (d.nameservers || []).map(ns => ns.ldhName).join(', ');
    const entities = d.entities || [];
    const registrar  = entities.find(e => e.roles?.includes('registrar'));
    const registrant = entities.find(e => e.roles?.includes('registrant'));

    lines.push('--- WhoIs Details (RDAP) ---');
    lines.push(`Domain      : ${d.ldhName || query}`);
    lines.push(`Status      : ${(d.status || []).join(', ')}`);
    lines.push(`Registrar   : ${registrar?.vcardArray?.[1]?.find(v => v[0] === 'fn')?.[3] || registrar?.handle || '—'}`);
    lines.push(`Created     : ${getEvent('registration') ? new Date(getEvent('registration')).toLocaleDateString() : '—'}`);
    lines.push(`Updated     : ${getEvent('last changed')  ? new Date(getEvent('last changed')).toLocaleDateString()  : '—'}`);
    lines.push(`Expires     : ${getEvent('expiration')    ? new Date(getEvent('expiration')).toLocaleDateString()    : '—'}`);
    lines.push(`Name Servers: ${nameservers || '—'}`);
    lines.push(`Registrant  : ${registrant?.vcardArray?.[1]?.find(v => v[0] === 'fn')?.[3] || '—'}`);
  } else if (data.raw) {
    lines.push('--- Raw WhoIs Output ---');
    lines.push(data.raw);
  }

  downloadFile(`whois_${query.replace(/[^a-zA-Z0-9.-]/g, '_')}_${timestamp()}.txt`, lines.join('\n'));
}

export function exportWhoisCsv({ query, data }) {
  const ts = new Date().toLocaleString();
  let rows = [['Field', 'Value', 'Query', 'Timestamp']];

  if (data.rdap) {
    const d = data.rdap;
    const events = d.events || [];
    const getEvent = (type) => events.find(e => e.eventAction === type)?.eventDate;
    const nameservers = (d.nameservers || []).map(ns => ns.ldhName).join(', ');
    const entities = d.entities || [];
    const registrar  = entities.find(e => e.roles?.includes('registrar'));
    const registrant = entities.find(e => e.roles?.includes('registrant'));

    rows = rows.concat([
      ['Domain',       d.ldhName || query,  query, ts],
      ['Status',       (d.status || []).join(', '), '', ''],
      ['Registrar',    registrar?.vcardArray?.[1]?.find(v => v[0] === 'fn')?.[3] || '', '', ''],
      ['Created',      getEvent('registration') ? new Date(getEvent('registration')).toLocaleDateString() : '', '', ''],
      ['Updated',      getEvent('last changed')  ? new Date(getEvent('last changed')).toLocaleDateString()  : '', '', ''],
      ['Expires',      getEvent('expiration')    ? new Date(getEvent('expiration')).toLocaleDateString()    : '', '', ''],
      ['Name Servers', nameservers, '', ''],
      ['Registrant',   registrant?.vcardArray?.[1]?.find(v => v[0] === 'fn')?.[3] || '', '', ''],
    ]);
  } else if (data.raw) {
    // Parse key fields from raw WhoIs
    const extract = (patterns) => {
      for (const pattern of patterns) {
        const match = data.raw.match(new RegExp(`${pattern}:\\s*(.+)`, 'im'));
        if (match && match[1].trim() && match[1].trim() !== 'REDACTED FOR PRIVACY') {
          return match[1].trim();
        }
      }
      return '';
    };
    rows = rows.concat([
      ['Domain Name',       extract(['Domain Name', 'domain']),                          query, ts],
      ['Registrar',         extract(['Registrar', 'registrar']),                         '', ''],
      ['Created',           extract(['Creation Date', 'Created On', 'created']),         '', ''],
      ['Updated',           extract(['Updated Date', 'Last Modified', 'changed']),       '', ''],
      ['Expires',           extract(['Registry Expiry Date', 'Expiration Date', 'expires']), '', ''],
      ['Status',            extract(['Domain Status', 'Status', 'status']),              '', ''],
      ['Name Servers',      extract(['Name Server', 'nserver']),                         '', ''],
      ['Registrant Org',    extract(['Registrant Organization', 'Registrant']),          '', ''],
      ['Registrant Country',extract(['Registrant Country']),                             '', ''],
      ['DNSSEC',            extract(['DNSSEC']),                                         '', ''],
    ]);
  }

  const csv = toCsv(rows);
  downloadFile(`whois_${query.replace(/[^a-zA-Z0-9.-]/g, '_')}_${timestamp()}.csv`, csv, 'text/csv');
}
