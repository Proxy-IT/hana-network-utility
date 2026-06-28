import React, { useState } from 'react';
import Instructions from './Instructions';
import ExportBar from './ExportBar';

const isBrowser = !window.electronAPI;

const DNS_SERVERS = [
  { label: 'Google',      value: '8.8.8.8',  badge: '8.8.8.8'  },
  { label: 'Cloudflare',  value: '1.1.1.1',  badge: '1.1.1.1'  },
  { label: 'Custom',      value: 'custom',   badge: 'Custom'   },
];

const RECORD_TYPES = ['ALL', 'A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'PTR'];

const TYPE_COLORS = {
  A:     '#00D4FF',
  AAAA:  '#00D4FF',
  CNAME: '#FFB020',
  MX:    '#00FF9C',
  TXT:   '#8892A4',
  NS:    '#FF8C42',
  PTR:   '#C084FC',
};

const INSTRUCTIONS = {
  title: 'How to use DNS Lookup',
  items: [
    { label: 'Enter a hostname or IP address', detail: 'For forward lookup enter a domain name. For reverse lookup enter an IP address and select PTR as the record type.', example: 'google.com or 8.8.8.8' },
    { label: 'Select a record type', detail: 'ALL returns every available record type. Choose a specific type to narrow results — A for IPv4, AAAA for IPv6, MX for mail servers, TXT for SPF/DMARC records, NS for nameservers, CNAME for aliases, PTR for reverse lookup.' },
    { label: 'Choose a DNS server', detail: 'Google (8.8.8.8) and Cloudflare (1.1.1.1) are public DNS servers. Use Custom to query an internal DNS server on your network — useful for resolving internal hostnames.' },
    { label: 'Press Look Up', detail: 'Results show the record type, value, and TTL (time to live in seconds). Multiple records of the same type are shown as separate rows.' },
    { label: 'Export results', detail: 'Save results as .txt or .csv for documentation or troubleshooting records.' },
  ],
  notes: 'Tip: Use MX records to verify mail server configuration. Use TXT records to check SPF and DMARC policies. Use PTR to verify that an IP reverse-resolves to the hostname you expect.',
};

// Demo data for browser mode
const DEMO_RESULTS = [
  { type: 'A',  value: '142.250.80.46',  ttl: 299 },
  { type: 'A',  value: '142.250.80.78',  ttl: 299 },
  { type: 'NS', value: 'ns1.google.com', ttl: 21599 },
  { type: 'NS', value: 'ns2.google.com', ttl: 21599 },
  { type: 'MX', value: 'smtp.google.com', priority: 10, ttl: null },
  { type: 'TXT', value: 'v=spf1 include:_spf.google.com ~all', ttl: null },
];

export function exportDnsTxt({ host, type, server, results }) {
  const ts = new Date().toLocaleString();
  const lines = [
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
    ...results.map(r =>
      `${r.type.padEnd(6)} ${r.value}${r.priority != null ? ` (priority: ${r.priority})` : ''}${r.ttl != null ? ` TTL: ${r.ttl}s` : ''}`
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `dns_${host}_${Date.now()}.txt`;
  a.click();
}

export function exportDnsCsv({ host, type, server, results }) {
  const ts = new Date().toLocaleString();
  const rows = [
    ['Type', 'Value', 'Priority', 'TTL', 'Host', 'DNS_Server', 'Timestamp'],
    ...results.map(r => [r.type, r.value, r.priority ?? '', r.ttl ?? '', host, server, ts]),
  ];
  const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `dns_${host}_${Date.now()}.csv`;
  a.click();
}

export default function DnsLookup() {
  const [host, setHost]           = useState('');
  const [recordType, setRecordType] = useState('ALL');
  const [serverChoice, setServerChoice] = useState('8.8.8.8');
  const [customServer, setCustomServer] = useState('');
  const [running, setRunning]     = useState(false);
  const [results, setResults]     = useState([]);
  const [errors, setErrors]       = useState([]);
  const [queried, setQueried]     = useState(null);

  const effectiveServer = serverChoice === 'custom' ? customServer : serverChoice;

  function clearLookup() {
    setResults([]); setErrors([]); setQueried(null);
    setHost('');
  }

  async function runLookup() {
    if (!host.trim()) return;
    setRunning(true); setResults([]); setErrors([]);
    setQueried({ host: host.trim(), type: recordType, server: effectiveServer });

    if (isBrowser) {
      await new Promise(r => setTimeout(r, 800));
      setResults(DEMO_RESULTS);
      setRunning(false);
      return;
    }

    try {
      const res = await window.electronAPI.dnsLookup({
        host:   host.trim(),
        type:   recordType,
        server: effectiveServer || '8.8.8.8',
      });
      setResults(res.results || []);
      setErrors(res.errors   || []);
    } catch (e) {
      setErrors([{ type: 'ERROR', message: e.message }]);
    }
    setRunning(false);
  }

  const hasResults = results.length > 0;

  return (
    <div style={s.wrap}>
      <h2 style={s.title}>DNS Lookup</h2>
      <p style={s.sub}>Resolve DNS records for any hostname or IP address</p>

      <Instructions {...INSTRUCTIONS} />

      {/* Controls */}
      <div style={s.controls}>
        {/* Host input */}
        <div style={s.fg}>
          <label style={s.label}>HOSTNAME / IP</label>
          <input style={{ ...s.input, width: 220 }} value={host}
            onChange={e => setHost(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !running && runLookup()}
            placeholder="e.g. google.com or 8.8.8.8"
            spellCheck={false} disabled={running} />
        </div>

        {/* Record type */}
        <div style={s.fg}>
          <label style={s.label}>RECORD TYPE</label>
          <select style={s.select} value={recordType}
            onChange={e => setRecordType(e.target.value)} disabled={running}>
            {RECORD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* DNS Server */}
        <div style={s.fg}>
          <label style={s.label}>DNS SERVER</label>
          <div style={s.serverToggle}>
            {DNS_SERVERS.map(srv => (
              <button key={srv.value}
                style={{ ...s.serverBtn, ...(serverChoice === srv.value ? s.serverBtnActive : {}) }}
                onClick={() => setServerChoice(srv.value)}
                disabled={running}>
                {srv.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom server input */}
        {serverChoice === 'custom' && (
          <div style={s.fg}>
            <label style={s.label}>CUSTOM DNS IP</label>
            <input style={{ ...s.input, width: 160 }} value={customServer}
              onChange={e => setCustomServer(e.target.value)}
              placeholder="e.g. 192.168.1.1"
              spellCheck={false} disabled={running} />
          </div>
        )}

        <button style={{ ...s.btn, ...(running ? s.btnOff : {}), alignSelf: 'flex-end' }}
          onClick={runLookup} disabled={running}>
          {running ? <><span style={s.spinner} /> Looking up…</> : '⌕  Look Up'}
        </button>
      </div>

      {/* Server badge */}
      {queried && (
        <div style={s.queryMeta}>
          <span style={s.metaItem}>
            <span style={s.metaLabel}>QUERIED</span>
            <span style={s.metaVal}>{queried.host}</span>
          </span>
          <span style={s.metaDot}>·</span>
          <span style={s.metaItem}>
            <span style={s.metaLabel}>TYPE</span>
            <span style={s.metaVal}>{queried.type}</span>
          </span>
          <span style={s.metaDot}>·</span>
          <span style={s.metaItem}>
            <span style={s.metaLabel}>SERVER</span>
            <span style={s.metaVal}>{queried.server}</span>
          </span>
        </div>
      )}

      {/* Export bar */}
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <ExportBar
          disabled={!hasResults}
          onExportTxt={() => exportDnsTxt({ host: queried?.host, type: queried?.type, server: queried?.server, results })}
          onExportCsv={() => exportDnsCsv({ host: queried?.host, type: queried?.type, server: queried?.server, results })}
        />
        {(hasResults || errors.length > 0) && !running && (
          <button style={s.clearBtn} onClick={clearLookup}>✕ Clear</button>
        )}
      </div>

      {/* Results table */}
      {hasResults && (
        <div style={s.section}>
          <div style={s.sectionRow}>
            <span style={s.sectionLabel}>RESULTS ({results.length} record{results.length !== 1 ? 's' : ''})</span>
          </div>
          <div style={s.table}>
            <div style={s.tableHeader}>
              <span style={{ width: 60 }}>TYPE</span>
              <span style={{ flex: 1 }}>VALUE</span>
              <span style={{ width: 80 }}>PRIORITY</span>
              <span style={{ width: 80, textAlign: 'right' }}>TTL</span>
            </div>
            {results.map((r, i) => (
              <div key={i} style={s.row}>
                <span style={{ width: 60 }}>
                  <span style={{ ...s.typeBadge, background: (TYPE_COLORS[r.type] || '#8892A4') + '18', color: TYPE_COLORS[r.type] || '#8892A4', border: `1px solid ${TYPE_COLORS[r.type] || '#8892A4'}44` }}>
                    {r.type}
                  </span>
                </span>
                <span style={{ flex: 1, color: '#E8EDF5', wordBreak: 'break-all', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{r.value}</span>
                <span style={{ width: 80, color: '#8892A4', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
                  {r.priority != null ? r.priority : '—'}
                </span>
                <span style={{ width: 80, textAlign: 'right', color: '#3D4D65', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
                  {r.ttl != null ? `${r.ttl}s` : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div style={s.section}>
          <span style={s.sectionLabel}>NO RECORDS FOUND</span>
          <div style={s.errorList}>
            {errors.map((e, i) => (
              <div key={i} style={s.errorRow}>
                <span style={s.errorType}>{e.type}</span>
                <span style={s.errorMsg}>{e.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasResults && !running && !queried && (
        <div style={s.placeholder}>Enter a hostname and press Look Up to resolve DNS records</div>
      )}
      {!hasResults && !running && queried && errors.length === 0 && (
        <div style={s.placeholder}>No records found for {queried.host}</div>
      )}
    </div>
  );
}

const s = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 18, animation: 'fadeIn 0.2s ease' },
  title: { fontSize: 22, fontWeight: 600, color: '#E8EDF5', marginBottom: 4 },
  sub: { color: '#8892A4', fontSize: 13, marginBottom: 4 },
  controls: { display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', background: '#111827', border: '1px solid #1E2D45', borderRadius: 8, padding: '16px 20px' },
  fg: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 10, fontWeight: 500, color: '#3D4D65', textTransform: 'uppercase', letterSpacing: '0.1em' },
  input: { background: '#0D1525', border: '1px solid #1E2D45', borderRadius: 6, color: '#E8EDF5', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, padding: '8px 12px', outline: 'none' },
  select: { background: '#0D1525', border: '1px solid #1E2D45', borderRadius: 6, color: '#E8EDF5', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, padding: '8px 12px', outline: 'none', width: 100 },
  serverToggle: { display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid #1E2D45' },
  serverBtn: { background: '#0D1525', border: 'none', color: '#8892A4', padding: '8px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 500, whiteSpace: 'nowrap' },
  serverBtnActive: { background: 'rgba(0,212,255,0.12)', color: '#00D4FF' },
  btn: { background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)', color: '#00D4FF', borderRadius: 6, padding: '8px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 },
  btnOff: { opacity: 0.5, cursor: 'not-allowed' },
  spinner: { width: 10, height: 10, borderRadius: '50%', border: '2px solid rgba(0,212,255,0.3)', borderTopColor: '#00D4FF', display: 'inline-block', animation: 'spin 0.7s linear infinite' },
  queryMeta: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: '#080D18', border: '1px solid #1E2D45', borderRadius: 6 },
  metaItem: { display: 'flex', alignItems: 'center', gap: 6 },
  metaLabel: { fontSize: 9, color: '#3D4D65', textTransform: 'uppercase', letterSpacing: '0.1em' },
  metaVal: { fontSize: 11, color: '#00D4FF', fontFamily: 'JetBrains Mono, monospace' },
  metaDot: { color: '#1E2D45', fontSize: 16 },
  section: { display: 'flex', flexDirection: 'column', gap: 8 },
  sectionRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: { fontSize: 10, color: '#3D4D65', textTransform: 'uppercase', letterSpacing: '0.1em' },
  table: { background: '#080D18', border: '1px solid #1E2D45', borderRadius: 8, overflow: 'hidden' },
  tableHeader: { display: 'flex', gap: 8, padding: '10px 16px', background: '#111827', borderBottom: '1px solid #1E2D45', fontSize: 10, color: '#3D4D65', textTransform: 'uppercase', letterSpacing: '0.08em' },
  row: { display: 'flex', gap: 8, padding: '10px 16px', borderBottom: '1px solid rgba(30,45,69,0.5)', alignItems: 'center', animation: 'fadeIn 0.15s ease' },
  typeBadge: { padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' },
  errorList: { background: '#080D18', border: '1px solid rgba(255,75,106,0.2)', borderRadius: 8, overflow: 'hidden' },
  errorRow: { display: 'flex', gap: 12, padding: '9px 16px', borderBottom: '1px solid rgba(30,45,69,0.3)', alignItems: 'center' },
  errorType: { fontSize: 10, fontWeight: 600, color: '#3D4D65', fontFamily: 'JetBrains Mono, monospace', width: 50 },
  errorMsg: { fontSize: 11, color: '#3D4D65', fontFamily: 'JetBrains Mono, monospace' },
  placeholder: { textAlign: 'center', color: '#3D4D65', padding: '60px 0', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 },
  clearBtn: { background:'rgba(255,75,106,0.08)', border:'1px solid rgba(255,75,106,0.25)', color:'#FF4B6A', borderRadius:6, padding:'6px 14px', fontSize:11, fontWeight:500, cursor:'pointer', fontFamily:'Inter, sans-serif', whiteSpace:'nowrap' },
};
