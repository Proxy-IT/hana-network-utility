import React, { useState, useRef } from 'react';
import Instructions from './Instructions';
import ExportBar from './ExportBar';

const isBrowser = !window.electronAPI;

// Common port definitions
const COMMON_PORTS = [
  { port: 21,   service: 'FTP',           group: 'remote'   },
  { port: 22,   service: 'SSH',           group: 'remote'   },
  { port: 23,   service: 'Telnet',        group: 'remote'   },
  { port: 25,   service: 'SMTP',          group: 'mail'     },
  { port: 53,   service: 'DNS',           group: 'network'  },
  { port: 80,   service: 'HTTP',          group: 'web'      },
  { port: 110,  service: 'POP3',          group: 'mail'     },
  { port: 143,  service: 'IMAP',          group: 'mail'     },
  { port: 443,  service: 'HTTPS',         group: 'web'      },
  { port: 445,  service: 'SMB',           group: 'network'  },
  { port: 465,  service: 'SMTPS',         group: 'mail'     },
  { port: 587,  service: 'SMTP (TLS)',    group: 'mail'     },
  { port: 993,  service: 'IMAPS',         group: 'mail'     },
  { port: 995,  service: 'POP3S',         group: 'mail'     },
  { port: 1433, service: 'MSSQL',         group: 'database' },
  { port: 1521, service: 'Oracle DB',     group: 'database' },
  { port: 3306, service: 'MySQL',         group: 'database' },
  { port: 3389, service: 'RDP',           group: 'remote'   },
  { port: 5432, service: 'PostgreSQL',    group: 'database' },
  { port: 5900, service: 'VNC',           group: 'remote'   },
  { port: 6379, service: 'Redis',         group: 'database' },
  { port: 8080, service: 'HTTP Alt',      group: 'web'      },
  { port: 8443, service: 'HTTPS Alt',     group: 'web'      },
  { port: 27017,service: 'MongoDB',       group: 'database' },
];

const PORT_GROUPS = [
  { id: 'web',      label: 'Web',         ports: [80, 443, 8080, 8443] },
  { id: 'remote',   label: 'Remote',      ports: [22, 23, 3389, 5900, 21] },
  { id: 'mail',     label: 'Mail',        ports: [25, 110, 143, 465, 587, 993, 995] },
  { id: 'database', label: 'Database',    ports: [1433, 1521, 3306, 3389, 5432, 6379, 27017] },
  { id: 'network',  label: 'Network',     ports: [53, 445] },
];

// Default checked ports
const DEFAULT_PORTS = [22, 80, 443, 3389];

const INSTRUCTIONS = {
  title: 'How to use Port Scanner',
  items: [
    { label: 'Enter the target host or IP', detail: 'Type the hostname or IP address of the device you want to scan. Only scan hosts on networks you own or have explicit permission to test.', example: '192.168.1.1 or server.local' },
    { label: 'Select ports to scan', detail: 'Common ports are pre-selected. Use the group buttons to add entire categories at once, or type custom ports in the Custom Ports field.' },
    { label: 'Add custom ports', detail: 'Enter any additional port numbers separated by commas. These are added to your selection.', example: '8080, 9090, 27017' },
    { label: 'Press Start Scan', detail: 'Each port is tested with a TCP connection. Open ports respond, closed ports refuse the connection, filtered ports time out.' },
    { label: 'Read the results', detail: 'Green = Open (service is listening), Gray = Closed (port refused connection), Amber = Filtered (no response, likely firewalled).' },
  ],
  notes: 'Scanning only works on TCP ports. UDP scanning is not supported. Results may vary depending on firewalls between you and the target host.',
};

function getService(port) {
  return COMMON_PORTS.find(p => p.port === port)?.service || 'Unknown';
}

function exportScanTxt({ host, results }) {
  const ts   = new Date().toLocaleString();
  const open = results.filter(r => r.status === 'open');
  const lines = [
    '========================================',
    '  Hana - Network Utility',
    '  Port Scan Report',
    '========================================',
    `Target    : ${host}`,
    `Timestamp : ${ts}`,
    `Scanned   : ${results.length} ports`,
    `Open      : ${open.length}`,
    '',
    '--- Results ---',
    'PORT     SERVICE          STATUS',
    '-------- ---------------- ----------',
    ...results.sort((a,b) => a.port - b.port).map(r =>
      `${String(r.port).padEnd(8)} ${(r.service || 'Unknown').padEnd(16)} ${r.status.toUpperCase()}`
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `portscan_${host}_${Date.now()}.txt`;
  a.click();
}

function exportScanCsv({ host, results }) {
  const ts  = new Date().toLocaleString();
  const rows = [
    ['Port', 'Service', 'Status', 'Host', 'Timestamp'],
    ...results.sort((a,b) => a.port - b.port).map(r => [r.port, r.service || 'Unknown', r.status, host, ts]),
  ];
  const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `portscan_${host}_${Date.now()}.csv`;
  a.click();
}

export default function PortScanner() {
  const [host, setHost]             = useState('');
  const [selected, setSelected]     = useState(new Set(DEFAULT_PORTS));
  const [customPorts, setCustomPorts] = useState('');
  const [running, setRunning]       = useState(false);
  const [results, setResults]       = useState([]);
  const [done, setDone]             = useState(false);
  const [progress, setProgress]     = useState(0);
  const [disclaimer, setDisclaimer] = useState(false);
  const [errorMsg, setErrorMsg]     = useState(null);
  const totalRef = useRef(0);

  function togglePort(port) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(port) ? next.delete(port) : next.add(port);
      return next;
    });
  }

  function toggleGroup(groupPorts) {
    setSelected(prev => {
      const next   = new Set(prev);
      const allOn  = groupPorts.every(p => next.has(p));
      groupPorts.forEach(p => allOn ? next.delete(p) : next.add(p));
      return next;
    });
  }

  function getCustomPortList() {
    if (!customPorts.trim()) return [];
    return customPorts.split(',')
      .map(p => parseInt(p.trim(), 10))
      .filter(p => !isNaN(p) && p > 0 && p <= 65535);
  }

  function getAllPorts() {
    // Ensure everything is a proper integer — no strings, no NaN
    const all = new Set([
      ...[...selected].map(p => parseInt(p, 10)).filter(p => !isNaN(p)),
      ...getCustomPortList(),
    ]);
    return [...all].sort((a, b) => a - b);
  }

  function startScan() {
    if (!host.trim()) return;
    if (!disclaimer) return;
    const ve = validateHostInput(host);
    if (ve) { setErrorMsg(ve); return; }

    const ports = getAllPorts();
    if (ports.length === 0) return;

    setResults([]); setRunning(true); setDone(false); setProgress(0); setErrorMsg(null);
    totalRef.current = ports.length;
    let completed = 0;

    if (isBrowser) {
      // Demo — simulate results
      const delay = Math.min(60, 2000 / ports.length);
      let i = 0;
      function drip() {
        if (i >= ports.length) { setRunning(false); setDone(true); return; }
        const port   = ports[i];
        const status = [22,80,443,3389].includes(port) ? 'open' : Math.random() < 0.15 ? 'open' : Math.random() < 0.4 ? 'filtered' : 'closed';
        setResults(prev => [...prev, { port, service: getService(port), status }]);
        completed++;
        setProgress(Math.round((completed / ports.length) * 100));
        i++;
        setTimeout(drip, delay);
      }
      drip();
      return;
    }

    window.electronAPI.removePortScanListeners();
    window.electronAPI.onPortScanResult(({ port, status }) => {
      setResults(prev => [...prev, { port, service: getService(port), status }]);
      completed++;
      setProgress(Math.round((completed / totalRef.current) * 100));
    });
    window.electronAPI.onPortScanDone(() => {
      setRunning(false); setDone(true);
      window.electronAPI.removePortScanListeners();
    });
    window.electronAPI.onPortScanError?.(({ message }) => {
      setRunning(false); setDone(false); setErrorMsg(message);
      window.electronAPI.removePortScanListeners();
    });
    window.electronAPI.startPortScan({ host: host.trim(), ports });
  }

  function clearScan() {
    setResults([]); setDone(false); setProgress(0);
    setHost(''); setCustomPorts(''); setErrorMsg(null);
    setSelected(new Set(DEFAULT_PORTS));
  }

  function validateHostInput(host) {
    const trimmed = (host || '').trim();
    if (!trimmed) return 'Please enter a hostname or IP address.';
    if (trimmed.length > 253) return 'Hostname is too long (max 253 characters).';
    if (!/^[a-zA-Z0-9._:\-]+$/.test(trimmed)) return `"${trimmed}" is not a valid hostname or IP address.`;
    return null;
  }


  const sortedResults = [...results].sort((a, b) => a.port - b.port);
  const openPorts     = results.filter(r => r.status === 'open');
  const closedPorts   = results.filter(r => r.status === 'closed');
  const filteredPorts = results.filter(r => r.status === 'filtered');
  const allPorts      = getAllPorts();

  return (
    <div style={s.wrap}>
      <h2 style={s.title}>Port Scanner</h2>
      <p style={s.sub}>Test which TCP ports are open, closed, or filtered on a host</p>

      {/* ── LEGAL DISCLAIMER ── */}
      <div style={s.disclaimerBox}>
        <div style={s.disclaimerHeader}>
          <span style={s.disclaimerIcon}>⚠</span>
          <span style={s.disclaimerTitle}>Legal Notice — Read Before Scanning</span>
        </div>
        <p style={s.disclaimerText}>
          Port scanning a host without authorization may be illegal under the Computer Fraud
          and Abuse Act (CFAA), the UK Computer Misuse Act, and equivalent laws worldwide.
          Only scan hosts on networks you own or have <strong style={{ color: '#FFB020' }}>explicit written permission</strong> to test.
          Scanning internet-facing IP addresses you do not own — including servers, routers,
          or any device belonging to another person or organization — is unauthorized access
          and may result in criminal prosecution. The developer of Hana accepts no liability
          for misuse of this tool.
        </p>
        <label style={s.disclaimerCheck}>
          <input
            type="checkbox"
            checked={disclaimer}
            onChange={e => setDisclaimer(e.target.checked)}
            style={{ accentColor: '#FFB020', cursor: 'pointer' }}
          />
          <span style={{ fontSize: 12, color: '#E8EDF5', marginLeft: 8 }}>
            I confirm I have authorization to scan the target host
          </span>
        </label>
      </div>

      <Instructions {...INSTRUCTIONS} />

      {/* Controls */}
      <div style={s.controls}>
        <div style={s.fg}>
          <label style={s.label}>TARGET HOST / IP</label>
          <input style={{ ...s.input, width: 240 }} value={host}
            onChange={e => setHost(e.target.value)}
            placeholder="hostname or IP address"
            spellCheck={false} disabled={running} />
        </div>
        <button
          style={{ ...s.btn, ...(running || !disclaimer ? s.btnOff : {}), alignSelf: 'flex-end' }}
          onClick={startScan} disabled={running || !disclaimer}
          title={!disclaimer ? 'You must confirm authorization before scanning' : ''}>
          {running ? <><span style={s.spinner} /> Scanning…</> : '⊞  Start Scan'}
        </button>
      </div>

      {/* Port selector */}
      <div style={s.portSection}>
        <div style={s.portSectionHeader}>
          <span style={s.sectionLabel}>PORT SELECTION ({allPorts.length} ports)</span>
          <div style={s.groupBtns}>
            {PORT_GROUPS.map(g => {
              const allOn = g.ports.every(p => selected.has(p));
              return (
                <button key={g.id}
                  style={{ ...s.groupBtn, ...(allOn ? s.groupBtnActive : {}) }}
                  onClick={() => toggleGroup(g.ports)} disabled={running}>
                  {g.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Port grid */}
        <div style={s.portGrid}>
          {COMMON_PORTS.map(({ port, service }) => {
            const on = selected.has(port);
            return (
              <button key={port}
                style={{ ...s.portChip, ...(on ? s.portChipOn : s.portChipOff) }}
                onClick={() => !running && togglePort(port)}>
                <span style={s.portNum}>{port}</span>
                <span style={s.portSvc}>{service}</span>
              </button>
            );
          })}
        </div>

        {/* Custom ports */}
        <div style={s.customRow}>
          <label style={s.label}>CUSTOM PORTS</label>
          <input style={{ ...s.input, flex: 1 }} value={customPorts}
            onChange={e => setCustomPorts(e.target.value)}
            placeholder="e.g. 8080, 9090, 27017"
            spellCheck={false} disabled={running} />
        </div>
      </div>

      {errorMsg && (
        <div style={s.errorBanner}>
          <span style={s.errorBannerIcon}>⚠</span>
          <span style={s.errorBannerMsg}>{errorMsg}</span>
          <button style={s.errorBannerClose} onClick={() => setErrorMsg(null)}>✕</button>
        </div>
      )}
      {/* Export and Clear */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <ExportBar
          disabled={results.length === 0}
          onExportTxt={() => exportScanTxt({ host, results: sortedResults })}
          onExportCsv={() => exportScanCsv({ host, results: sortedResults })}
        />
        {results.length > 0 && !running && (
          <button style={s.clearBtn} onClick={clearScan} title="Clear results and reset">
            ✕ Clear
          </button>
        )}
      </div>

      {/* Progress */}
      {(running || done) && results.length > 0 && (
        <div style={s.progressWrap}>
          <div style={s.progressTrack}>
            <div style={{ ...s.progressFill, width: `${progress}%` }} />
          </div>
          <span style={s.progressLabel}>{progress}%</span>
        </div>
      )}

      {/* Summary stats */}
      {results.length > 0 && (
        <div style={s.statsRow}>
          <StatCard label="Scanned"  value={results.length}       color="#8892A4" />
          <StatCard label="Open"     value={openPorts.length}     color="#00FF9C" />
          <StatCard label="Closed"   value={closedPorts.length}   color="#3D4D65" />
          <StatCard label="Filtered" value={filteredPorts.length} color="#FFB020" />
        </div>
      )}

      {/* Results table */}
      {sortedResults.length > 0 && (
        <div style={s.section}>
          <span style={s.sectionLabel}>RESULTS</span>
          <div style={s.table}>
            <div style={s.tableHeader}>
              <span style={{ width: 70 }}>PORT</span>
              <span style={{ flex: 1 }}>SERVICE</span>
              <span style={{ width: 100 }}>STATUS</span>
            </div>
            {sortedResults.map((r, i) => {
              const color = r.status === 'open' ? '#00FF9C' : r.status === 'filtered' ? '#FFB020' : '#3D4D65';
              return (
                <div key={i} style={{ ...s.row, ...(r.status === 'open' ? s.rowOpen : {}) }}>
                  <span style={{ width: 70, fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: r.status === 'open' ? 600 : 400, color: r.status === 'open' ? '#E8EDF5' : '#3D4D65' }}>
                    {r.port}
                  </span>
                  <span style={{ flex: 1, fontSize: 12, color: r.status === 'open' ? '#E8EDF5' : '#3D4D65', fontFamily: 'JetBrains Mono, monospace' }}>
                    {r.service}
                  </span>
                  <span style={{ width: 100 }}>
                    <span style={{ ...s.statusBadge, color, borderColor: color + '44', background: color + '11' }}>
                      {r.status === 'open' ? '● Open' : r.status === 'filtered' ? '◐ Filtered' : '○ Closed'}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {done && openPorts.length === 0 && (
        <div style={s.placeholder}>No open ports found on {host}</div>
      )}
      {!running && results.length === 0 && !done && (
        <div style={s.placeholder}>Configure your target and ports above then press Start Scan</div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={s.card}>
      <div style={s.cardLabel}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', color }}>{value}</div>
    </div>
  );
}

const s = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 18, animation: 'fadeIn 0.2s ease' },
  title: { fontSize: 22, fontWeight: 600, color: '#E8EDF5', marginBottom: 4 },
  sub: { color: '#8892A4', fontSize: 13, marginBottom: 4 },

  disclaimerBox: { background: 'rgba(255,176,32,0.06)', border: '1px solid rgba(255,176,32,0.3)', borderRadius: 8, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 },
  disclaimerHeader: { display: 'flex', alignItems: 'center', gap: 10 },
  disclaimerIcon: { fontSize: 18, color: '#FFB020', flexShrink: 0 },
  disclaimerTitle: { fontSize: 13, fontWeight: 600, color: '#FFB020' },
  disclaimerText: { fontSize: 12, color: '#8892A4', lineHeight: 1.7 },
  disclaimerCheck: { display: 'flex', alignItems: 'center', cursor: 'pointer', marginTop: 4 },

  controls: { display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', background: '#111827', border: '1px solid #1E2D45', borderRadius: 8, padding: '16px 20px' },
  fg: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 10, fontWeight: 500, color: '#3D4D65', textTransform: 'uppercase', letterSpacing: '0.1em' },
  input: { background: '#0D1525', border: '1px solid #1E2D45', borderRadius: 6, color: '#E8EDF5', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, padding: '8px 12px', outline: 'none' },
  btn: { background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)', color: '#00D4FF', borderRadius: 6, padding: '8px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 },
  btnOff: { opacity: 0.4, cursor: 'not-allowed' },
  spinner: { width: 10, height: 10, borderRadius: '50%', border: '2px solid rgba(0,212,255,0.3)', borderTopColor: '#00D4FF', display: 'inline-block', animation: 'spin 0.7s linear infinite' },

  portSection: { background: '#111827', border: '1px solid #1E2D45', borderRadius: 8, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 },
  portSectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
  groupBtns: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  groupBtn: { background: '#0D1525', border: '1px solid #1E2D45', color: '#8892A4', borderRadius: 5, padding: '4px 12px', fontSize: 11, cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 500 },
  groupBtnActive: { background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)', color: '#00D4FF' },
  portGrid: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  portChip: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, padding: '6px 10px', borderRadius: 6, cursor: 'pointer', border: '1px solid', minWidth: 70, transition: 'all 0.15s' },
  portChipOn: { background: 'rgba(0,212,255,0.1)', borderColor: 'rgba(0,212,255,0.35)', color: '#00D4FF' },
  portChipOff: { background: '#0D1525', borderColor: '#1E2D45', color: '#3D4D65' },
  portNum: { fontSize: 13, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' },
  portSvc: { fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' },
  customRow: { display: 'flex', alignItems: 'center', gap: 12 },

  progressWrap: { display: 'flex', alignItems: 'center', gap: 12 },
  progressTrack: { flex: 1, height: 4, background: '#1A2235', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', background: '#00D4FF', borderRadius: 2, transition: 'width 0.2s ease', boxShadow: '0 0 8px rgba(0,212,255,0.4)' },
  progressLabel: { fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#8892A4', width: 36 },

  statsRow: { display: 'flex', gap: 12 },
  card: { flex: 1, background: '#111827', border: '1px solid #1E2D45', borderRadius: 8, padding: '14px 18px' },
  cardLabel: { fontSize: 10, color: '#3D4D65', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 },

  section: { display: 'flex', flexDirection: 'column', gap: 8 },
  sectionLabel: { fontSize: 10, color: '#3D4D65', textTransform: 'uppercase', letterSpacing: '0.1em' },
  table: { background: '#080D18', border: '1px solid #1E2D45', borderRadius: 8, overflow: 'hidden' },
  tableHeader: { display: 'flex', gap: 8, padding: '10px 16px', background: '#111827', borderBottom: '1px solid #1E2D45', fontSize: 10, color: '#3D4D65', textTransform: 'uppercase', letterSpacing: '0.08em' },
  row: { display: 'flex', gap: 8, padding: '9px 16px', borderBottom: '1px solid rgba(30,45,69,0.5)', alignItems: 'center', animation: 'fadeIn 0.1s ease' },
  rowOpen: { background: 'rgba(0,255,156,0.03)' },
  statusBadge: { padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500, border: '1px solid', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap' },

  placeholder: { textAlign: 'center', color: '#3D4D65', padding: '60px 0', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 },
  errorBanner: { display:'flex', alignItems:'center', gap:10, padding:'12px 16px', background:'rgba(255,75,106,0.08)', border:'1px solid rgba(255,75,106,0.3)', borderRadius:8, animation:'fadeIn 0.2s ease' },
  errorBannerIcon: { fontSize:16, color:'#FF4B6A', flexShrink:0 },
  errorBannerMsg: { flex:1, fontSize:12, color:'#FF4B6A', fontFamily:'JetBrains Mono, monospace' },
  errorBannerClose: { background:'transparent', border:'none', color:'#FF4B6A', cursor:'pointer', fontSize:14, padding:'0 4px', fontFamily:'Inter, sans-serif' },
  clearBtn: {
    background: 'rgba(255,75,106,0.08)', border: '1px solid rgba(255,75,106,0.25)',
    color: '#FF4B6A', borderRadius: 6, padding: '6px 14px',
    fontSize: 11, fontWeight: 500, cursor: 'pointer',
    fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap',
  },
};
