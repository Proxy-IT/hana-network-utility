import React, { useState, useRef, useEffect } from 'react';
import { parseTracerouteLines } from '../utils/parsers';
import { exportTraceTxt, exportTraceCsv } from '../utils/export';
import Instructions from './Instructions';
import ExportBar from './ExportBar';

const isBrowser = !window.electronAPI;
const FAKE = [
  { hop:1, ip:'192.168.1.1',  host:'router.local',    rtts:[0.8,0.9,0.7], timeout:false },
  { hop:2, ip:'10.0.0.1',     host:'isp-gateway',     rtts:[5.2,5.4,5.1], timeout:false },
  { hop:3, ip:'72.14.202.1',  host:'peer-1',          rtts:[8.3,8.1,8.5], timeout:false },
  { hop:4, ip:null,           host:null,              rtts:[],            timeout:true  },
  { hop:5, ip:'64.233.174.1', host:'google-backbone', rtts:[12.1,12.3,11.9], timeout:false },
  { hop:6, ip:'8.8.8.8',      host:'dns.google',      rtts:[13,13.2,12.8], timeout:false },
];

const INSTRUCTIONS = {
  title: 'How to use Traceroute',
  items: [
    { label: 'Enter the destination host or IP address', detail: 'This is the target you want to trace the route to. You can use a hostname or an IP address.', example: 'google.com or 8.8.8.8' },
    { label: 'Press Trace Route', detail: 'Results stream in live, one hop at a time. Each row represents a router your traffic passes through on the way to the destination.' },
    { label: 'Read the hop table', detail: "Each hop shows the router's hostname and IP address, plus three RTT measurements in milliseconds. RTT colors go green (fast) → amber → red (slow)." },
    { label: 'Understand * * * (no response) hops', detail: 'Some routers are configured not to respond to traceroute probes. A row of asterisks does not necessarily mean the route is broken — traffic may still be passing through.' },
    { label: 'Export your results', detail: 'Once the trace completes use the Export bar to save a formatted report (.txt) or spreadsheet (.csv).' },
  ],
  notes: 'Tip: A sudden jump in RTT between two hops usually indicates a slow link or geographic distance, not a problem with your local network.',
};

export default function Traceroute() {
  const [host, setHost]       = useState('8.8.8.8');
  const [hops, setHops]       = useState([]);
  const [running, setRunning] = useState(false);
  const [done, setDone]       = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [hops]);

  async function runTrace() {
    if (!host.trim() || running) return;
    setHops([]); setRunning(true); setDone(false);
    if (isBrowser) {
      for (let i = 0; i < FAKE.length; i++) {
        await new Promise(r => setTimeout(r, 400));
        setHops(prev => [...prev, FAKE[i]]);
      }
      setRunning(false); setDone(true); return;
    }
    window.electronAPI.removeTracerouteListeners();
    window.electronAPI.onTracerouteData(({ line }) => {
      parseTracerouteLines(line).forEach(p => { if (p.hop != null) setHops(prev => [...prev, p]); });
    });
    window.electronAPI.onTracerouteDone(() => {
      setRunning(false); setDone(true);
      window.electronAPI.removeTracerouteListeners();
    });
    window.electronAPI.startTraceroute({ host: host.trim() });
  }

  function stopTrace() {
    setRunning(false); setDone(true);
    if (window.electronAPI) {
      window.electronAPI.stopTraceroute();
      window.electronAPI.removeTracerouteListeners();
    }
  }

  return (
    <div style={s.wrap}>
      <h2 style={s.title}>Traceroute</h2>
      <p style={s.sub}>Trace the network path to a destination, hop by hop</p>

      <Instructions {...INSTRUCTIONS} />

      <div style={s.controls}>
        <div style={{ display:'flex', flexDirection:'column', gap:6, flex:1 }}>
          <label style={s.label}>DESTINATION HOST / IP</label>
          <input style={s.input} value={host} onChange={e => setHost(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !running && runTrace()}
            placeholder="hostname or IP address" spellCheck={false} disabled={running} />
        </div>
        {!running
          ? <button style={{ ...s.btn, alignSelf:'flex-end' }} onClick={runTrace}>▶  Trace Route</button>
          : <button style={{ ...s.btn, ...s.btnStop, alignSelf:'flex-end' }} onClick={stopTrace}>■  Stop</button>
        }
      </div>

      <ExportBar
        disabled={hops.length === 0}
        onExportTxt={() => exportTraceTxt({ host, hops })}
        onExportCsv={() => exportTraceCsv({ host, hops })}
      />

      {hops.length > 0 && (
        <div style={s.tableWrap}>
          <div style={s.tableHeader}>
            <span style={{ width:36 }}>HOP</span>
            <span style={{ flex:1 }}>HOST</span>
            <span style={{ width:130 }}>IP ADDRESS</span>
            <span style={{ width:80, textAlign:'right' }}>RTT 1</span>
            <span style={{ width:80, textAlign:'right' }}>RTT 2</span>
            <span style={{ width:80, textAlign:'right' }}>RTT 3</span>
          </div>
          {hops.map((hop, i) => <HopRow key={i} hop={hop} />)}
          <div ref={endRef} />
        </div>
      )}

      {running && (
        <div style={s.status}>
          <span style={s.statusDot} />
          Tracing route to <span style={{ color:'#00D4FF', marginLeft:6 }}>{host}</span>…
        </div>
      )}
      {done && hops.length > 0 && (
        <div style={{ color:'#00FF9C', fontSize:12, fontFamily:'JetBrains Mono, monospace' }}>
          ✓ Trace complete — {hops.filter(h => h.hop).length} hops
        </div>
      )}
      {!running && hops.length === 0 && (
        <div style={s.placeholder}>Enter a destination and press Trace Route to begin</div>
      )}
    </div>
  );
}

function HopRow({ hop }) {
  const avg = hop.rtts?.length ? hop.rtts.reduce((a,b)=>a+b,0)/hop.rtts.length : null;
  const color = avg ? (avg<20?'#00FF9C':avg<80?'#00D4FF':avg<150?'#FFB020':'#FF4B6A') : '#3D4D65';
  return (
    <div style={s.row}>
      <span style={{ width:36, color:'#3D4D65', fontSize:11 }}>{hop.hop}</span>
      <span style={{ flex:1, color:'#E8EDF5', overflow:'hidden', textOverflow:'ellipsis' }}>
        {hop.timeout ? <span style={{ color:'#3D4D65' }}>* * *  (no response)</span> : hop.host || <span style={{ color:'#3D4D65' }}>—</span>}
      </span>
      <span style={{ width:130, color:'#8892A4', fontSize:11 }}>{hop.ip || '—'}</span>
      {[0,1,2].map(j => (
        <span key={j} style={{ width:80, textAlign:'right', color, fontSize:11 }}>
          {hop.rtts?.[j] != null ? `${hop.rtts[j]} ms` : <span style={{ color:'#3D4D65' }}>*</span>}
        </span>
      ))}
    </div>
  );
}

const s = {
  wrap: { display:'flex', flexDirection:'column', gap:18, animation:'fadeIn 0.2s ease' },
  title: { fontSize:22, fontWeight:600, color:'#E8EDF5', marginBottom:4 },
  sub: { color:'#8892A4', fontSize:13, marginBottom:4 },
  controls: { display:'flex', alignItems:'flex-end', gap:12, background:'#111827', border:'1px solid #1E2D45', borderRadius:8, padding:'16px 20px' },
  label: { fontSize:10, fontWeight:500, color:'#3D4D65', textTransform:'uppercase', letterSpacing:'0.1em' },
  input: { background:'#0D1525', border:'1px solid #1E2D45', borderRadius:6, color:'#E8EDF5', fontFamily:'JetBrains Mono, monospace', fontSize:13, padding:'8px 12px', outline:'none', width:'100%' },
  btn: { background:'rgba(0,212,255,0.1)', border:'1px solid rgba(0,212,255,0.3)', color:'#00D4FF', borderRadius:6, padding:'8px 20px', fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'Inter, sans-serif', whiteSpace:'nowrap' },
  btnStop: { background:'rgba(255,75,106,0.1)', border:'1px solid rgba(255,75,106,0.3)', color:'#FF4B6A' },
  tableWrap: { background:'#080D18', border:'1px solid #1E2D45', borderRadius:8, overflow:'hidden' },
  tableHeader: { display:'flex', gap:8, padding:'10px 16px', background:'#111827', borderBottom:'1px solid #1E2D45', fontSize:10, color:'#3D4D65', textTransform:'uppercase', letterSpacing:'0.08em' },
  row: { display:'flex', gap:8, padding:'9px 16px', borderBottom:'1px solid rgba(30,45,69,0.5)', fontFamily:'JetBrains Mono, monospace', fontSize:12, color:'#8892A4', alignItems:'center', animation:'fadeIn 0.15s ease' },
  status: { display:'flex', alignItems:'center', gap:10, color:'#8892A4', fontSize:13, fontFamily:'JetBrains Mono, monospace' },
  statusDot: { width:8, height:8, borderRadius:'50%', background:'#00D4FF', animation:'pulse-dot 1s ease-in-out infinite' },
  placeholder: { textAlign:'center', color:'#3D4D65', padding:'60px 0', fontFamily:'JetBrains Mono, monospace', fontSize:12 },
};
