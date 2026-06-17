import React, { useState } from 'react';
import { exportSweepTxt, exportSweepCsv } from '../utils/export';
import Instructions from './Instructions';
import ExportBar from './ExportBar';

const isBrowser = !window.electronAPI;

const INSTRUCTIONS = {
  title: 'How to use Subnet Sweep',
  items: [
    { label: 'Enter the Base IP — the first three octets of your subnet', detail: 'An IP address has four sections (octets) separated by dots. Enter only the first three here. This defines which subnet you are scanning.', example: '192.168.1' },
    { label: 'Set the FROM value — the last octet to start scanning from', detail: 'This is the fourth octet of the first IP address you want to check. Valid values are 1 through 254.', example: '1  →  scans from 192.168.1.1' },
    { label: 'Set the TO value — the last octet to stop scanning at', detail: 'This is the fourth octet of the last IP address you want to check. Must be greater than or equal to FROM. To scan a full subnet use 1 to 254.', example: '50  →  scans up to 192.168.1.50' },
    { label: 'Press Start Sweep', detail: 'The tool sends a ping to each IP in the range and reports which hosts respond. Results appear as they come in — green for live, gray for no response.' },
    { label: 'Export your results', detail: 'Use the Export bar to save results as a formatted text report or CSV spreadsheet once the sweep is complete.' },
  ],
  notes: 'Tip: If you expect more live hosts than shown, check that ICMP ping is not blocked by Windows Firewall or endpoint security software on the target machines.',
};

function generateFakeSweep(s, e) {
  const alive = new Set();
  for (let i = s; i <= e; i++) { if (Math.random() < 0.25) alive.add(i); }
  return alive;
}

export default function SubnetSweep() {
  const [baseIp, setBaseIp]     = useState('192.168.1');
  const [start, setStart]       = useState('1');
  const [end, setEnd]           = useState('50');
  const [running, setRunning]   = useState(false);
  const [results, setResults]   = useState([]);  // { ip, alive }
  const [done, setDone]         = useState(false);
  const [progress, setProgress] = useState(0);

  function startSweep() {
    const s = parseInt(start, 10);
    const e = parseInt(end, 10);
    if (isNaN(s) || isNaN(e) || s > e || s < 1 || e > 254) return;
    setResults([]); setRunning(true); setDone(false); setProgress(0);
    const total = e - s + 1;

    if (isBrowser) {
      const aliveSet = generateFakeSweep(s, e);
      const delay = Math.min(40, 1500 / total);
      let i = s;
      function drip() {
        if (i > e) { setRunning(false); setDone(true); return; }
        setResults(prev => [...prev, { ip: `${baseIp}.${i}`, alive: aliveSet.has(i) }]);
        setProgress(Math.round(((i - s + 1) / total) * 100));
        i++; setTimeout(drip, delay);
      }
      drip(); return;
    }

    let completed = 0;
    window.electronAPI.removeSweepListeners();
    window.electronAPI.onSweepResult(({ ip, alive }) => {
      setResults(prev => [...prev, { ip, alive }]);
      completed++;
      setProgress(Math.round((completed / total) * 100));
    });
    window.electronAPI.onSweepDone(() => {
      setRunning(false); setDone(true);
      window.electronAPI.removeSweepListeners();
    });
    window.electronAPI.startSubnetSweep({ baseIp, start: s, end: e });
  }

  // Sort results by last octet numerically for display
  const sorted = [...results].sort((a, b) => {
    const aL = parseInt(a.ip.split('.').pop(), 10);
    const bL = parseInt(b.ip.split('.').pop(), 10);
    return aL - bL;
  });

  const alive = results.filter(r => r.alive);
  const dead  = results.filter(r => !r.alive);
  const hostCount = Math.max(0, parseInt(end || 0) - parseInt(start || 0) + 1);

  return (
    <div style={s.wrap}>
      <h2 style={s.title}>Subnet Sweep</h2>
      <p style={s.sub}>Ping-sweep a range of IPs to discover live hosts on your network</p>

      <Instructions {...INSTRUCTIONS} />

      {/* Controls */}
      <div style={s.controls}>
        <div style={s.fg}>
          <label style={s.label}>BASE IP (first 3 octets)</label>
          <div style={s.inputAnnotated}>
            <input style={{ ...s.input, width:148 }} value={baseIp}
              onChange={e => setBaseIp(e.target.value)}
              placeholder="192.168.1" spellCheck={false} disabled={running} />
            <span style={s.dot}>.</span>
          </div>
          <span style={s.hint}>e.g. 192.168.1</span>
        </div>
        <div style={s.fg}>
          <label style={s.label}>FROM (4th octet)</label>
          <input style={{ ...s.input, width:72 }} type="number" min="1" max="254"
            value={start} onChange={e => setStart(e.target.value)} disabled={running} />
          <span style={s.hint}>1 – 254</span>
        </div>
        <div style={{ alignSelf:'center', color:'#3D4D65', fontSize:18, paddingTop:6 }}>→</div>
        <div style={s.fg}>
          <label style={s.label}>TO (4th octet)</label>
          <input style={{ ...s.input, width:72 }} type="number" min="1" max="254"
            value={end} onChange={e => setEnd(e.target.value)} disabled={running} />
          <span style={s.hint}>1 – 254</span>
        </div>
        <div style={{ alignSelf:'center', paddingTop:6 }}>
          <div style={s.countBadge}>{hostCount} hosts</div>
        </div>
        <button style={{ ...s.btn, ...(running ? s.btnOff : {}), alignSelf:'flex-end' }}
          onClick={startSweep} disabled={running}>
          {running ? '⊞  Sweeping…' : '⊞  Start Sweep'}
        </button>
      </div>

      {/* IP preview */}
      {baseIp && start && end && !running && !done && (
        <div style={s.preview}>
          Will scan <code style={s.previewCode}>{baseIp}.{start}</code>
          <span style={{ color:'#3D4D65', margin:'0 8px' }}>→</span>
          <code style={s.previewCode}>{baseIp}.{end}</code>
        </div>
      )}

      {/* Export bar */}
      <ExportBar
        disabled={results.length === 0}
        onExportTxt={() => exportSweepTxt({ baseIp, start, end, results })}
        onExportCsv={() => exportSweepCsv({ baseIp, start, end, results })}
      />

      {/* Progress */}
      {(running || done) && results.length > 0 && (
        <div style={s.progressWrap}>
          <div style={s.progressTrack}>
            <div style={{ ...s.progressFill, width:`${progress}%` }} />
          </div>
          <span style={s.progressLabel}>{progress}%</span>
        </div>
      )}

      {/* Summary stats */}
      {results.length > 0 && (
        <div style={s.statsRow}>
          <StatCard label="Scanned"     value={results.length} color="#8892A4" />
          <StatCard label="Live"        value={alive.length}   color="#00FF9C" />
          <StatCard label="No Response" value={dead.length}    color="#3D4D65" />
        </div>
      )}

      {/* Results table — two columns, all IPs shown */}
      {sorted.length > 0 && (
        <div style={s.section}>
          <div style={s.sectionHeader}>
            <span style={s.sectionLabel}>SCAN RESULTS</span>
            <div style={s.legend}>
              <span style={s.legendDot('#00FF9C')} />
              <span style={s.legendText}>Live</span>
              <span style={s.legendDot('#3D4D65')} />
              <span style={s.legendText}>No response</span>
            </div>
          </div>
          <div style={s.resultGrid}>
            {sorted.map(r => (
              <div key={r.ip} style={{ ...s.resultRow, ...(r.alive ? s.resultRowAlive : s.resultRowDead) }}>
                <span style={{ ...s.resultDot, background: r.alive ? '#00FF9C' : '#2A3A50', boxShadow: r.alive ? '0 0 5px rgba(0,255,156,0.4)' : 'none' }} />
                <span style={{ ...s.resultIp, color: r.alive ? '#00FF9C' : '#3D4D65' }}>
                  {r.ip}
                </span>
                <span style={{ ...s.resultStatus, color: r.alive ? '#00FF9C' : '#2A3A50' }}>
                  {r.alive ? 'Live' : 'No response'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {done && alive.length === 0 && results.length > 0 && (
        <div style={s.placeholder}>No live hosts responded in that range</div>
      )}
      {!running && results.length === 0 && !done && (
        <div style={s.placeholder}>Configure a range above and press Start Sweep</div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={s.card}>
      <div style={s.cardLabel}>{label}</div>
      <div style={{ fontSize:28, fontWeight:600, fontFamily:'JetBrains Mono, monospace', color }}>{value}</div>
    </div>
  );
}

const s = {
  wrap: { display:'flex', flexDirection:'column', gap:18, animation:'fadeIn 0.2s ease' },
  title: { fontSize:22, fontWeight:600, color:'#E8EDF5', marginBottom:4 },
  sub: { color:'#8892A4', fontSize:13, marginBottom:4 },
  controls: { display:'flex', alignItems:'flex-start', gap:12, flexWrap:'wrap', background:'#111827', border:'1px solid #1E2D45', borderRadius:8, padding:'16px 20px' },
  fg: { display:'flex', flexDirection:'column', gap:4 },
  label: { fontSize:10, fontWeight:500, color:'#3D4D65', textTransform:'uppercase', letterSpacing:'0.1em' },
  hint: { fontSize:10, color:'#3D4D65', fontFamily:'JetBrains Mono, monospace' },
  inputAnnotated: { display:'flex', alignItems:'center' },
  dot: { fontSize:18, color:'#00D4FF', marginLeft:2, fontFamily:'JetBrains Mono, monospace', fontWeight:600 },
  input: { background:'#0D1525', border:'1px solid #1E2D45', borderRadius:6, color:'#E8EDF5', fontFamily:'JetBrains Mono, monospace', fontSize:13, padding:'8px 12px', outline:'none' },
  btn: { background:'rgba(0,212,255,0.1)', border:'1px solid rgba(0,212,255,0.3)', color:'#00D4FF', borderRadius:6, padding:'8px 20px', fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'Inter, sans-serif', whiteSpace:'nowrap' },
  btnOff: { opacity:0.5, cursor:'not-allowed' },
  countBadge: { background:'rgba(0,212,255,0.08)', border:'1px solid rgba(0,212,255,0.2)', borderRadius:20, padding:'4px 12px', fontSize:11, color:'#00D4FF', fontFamily:'JetBrains Mono, monospace', whiteSpace:'nowrap' },
  preview: { fontSize:12, color:'#8892A4', fontFamily:'JetBrains Mono, monospace', padding:'8px 14px', background:'#080D18', border:'1px solid #1E2D45', borderRadius:6 },
  previewCode: { color:'#00D4FF', fontFamily:'JetBrains Mono, monospace', background:'none', border:'none', padding:0 },
  progressWrap: { display:'flex', alignItems:'center', gap:12 },
  progressTrack: { flex:1, height:4, background:'#1A2235', borderRadius:2, overflow:'hidden' },
  progressFill: { height:'100%', background:'#00D4FF', borderRadius:2, transition:'width 0.2s ease', boxShadow:'0 0 8px rgba(0,212,255,0.4)' },
  progressLabel: { fontSize:11, fontFamily:'JetBrains Mono, monospace', color:'#8892A4', width:36 },
  statsRow: { display:'flex', gap:12 },
  card: { flex:1, background:'#111827', border:'1px solid #1E2D45', borderRadius:8, padding:'14px 18px' },
  cardLabel: { fontSize:10, color:'#3D4D65', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 },
  section: { display:'flex', flexDirection:'column', gap:10 },
  sectionHeader: { display:'flex', alignItems:'center', justifyContent:'space-between' },
  sectionLabel: { fontSize:10, color:'#3D4D65', textTransform:'uppercase', letterSpacing:'0.1em' },
  legend: { display:'flex', alignItems:'center', gap:8 },
  legendDot: (color) => ({ width:7, height:7, borderRadius:'50%', background:color, display:'inline-block', flexShrink:0 }),
  legendText: { fontSize:10, color:'#3D4D65', fontFamily:'JetBrains Mono, monospace' },
  // Two-column grid
  resultGrid: {
    display:'grid', gridTemplateColumns:'1fr 1fr',
    gap:1, background:'#1E2D45',
    border:'1px solid #1E2D45', borderRadius:8, overflow:'hidden',
  },
  resultRow: {
    display:'flex', alignItems:'center', gap:10,
    padding:'8px 14px', background:'#080D18',
    fontFamily:'JetBrains Mono, monospace', fontSize:12,
    animation:'fadeIn 0.15s ease',
  },
  resultRowAlive: { background:'rgba(0,255,156,0.03)' },
  resultRowDead:  { background:'#080D18' },
  resultDot: { width:7, height:7, borderRadius:'50%', flexShrink:0, transition:'background 0.2s' },
  resultIp: { flex:1, fontWeight:500, fontSize:12 },
  resultStatus: { fontSize:10, textTransform:'uppercase', letterSpacing:'0.06em', flexShrink:0 },
  placeholder: { textAlign:'center', color:'#3D4D65', padding:'60px 0', fontFamily:'JetBrains Mono, monospace', fontSize:12 },
};
