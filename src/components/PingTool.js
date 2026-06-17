import React, { useState, useRef, useEffect, useCallback } from 'react';
import { parsePingOutput } from '../utils/parsers';
import { classifyLatency } from '../utils/latency';
import { exportPingTxt, exportPingCsv } from '../utils/export';
import Instructions from './Instructions';
import ExportBar from './ExportBar';

const isBrowser = !window.electronAPI;
const MAX_SAMPLES = 60;

const INSTRUCTIONS = {
  title: 'How to use Ping',
  items: [
    { label: 'Enter a host or IP address', detail: 'Type a hostname (e.g. google.com) or an IP address (e.g. 8.8.8.8) into the Host field.', example: 'google.com or 8.8.8.8' },
    { label: 'Choose Fixed or Continuous mode', detail: 'Fixed sends a set number of packets and shows a summary. Continuous pings forever until you press Stop — useful for monitoring a connection over time.' },
    { label: 'In Fixed mode choose a packet count', detail: 'Select how many ping packets to send — 1 for a quick check, 4 for a standard test, up to 16 for a more thorough measurement.' },
    { label: 'Press Run Ping or Start', detail: 'Results appear immediately. Fixed mode shows min, avg, and max RTT plus packet loss. Continuous mode shows a live scrolling graph and running statistics.' },
    { label: 'Export your results', detail: 'Use the Export bar to save results as a .txt report or .csv spreadsheet at any time.' },
  ],
  notes: 'A host that does not respond to ping may still be online — many firewalls block ICMP ping requests.',
};

export default function PingTool() {
  const [host, setHost]             = useState('8.8.8.8');
  const [count, setCount]           = useState('4');
  const [continuous, setContinuous] = useState(false);
  const [running, setRunning]       = useState(false);
  const [output, setOutput]         = useState(null);
  const [rawOutput, setRaw]         = useState('');
  const [samples, setSamples]       = useState([]);
  const [liveStats, setLiveStats]   = useState(null);
  const seqRef   = useRef(0);
  const statsRef = useRef({ min: Infinity, max: -Infinity, sum: 0, count: 0, lost: 0, sent: 0 });

  useEffect(() => {
    return () => {
      if (window.electronAPI) {
        window.electronAPI.stopContinuousPing();
        window.electronAPI.removeContinuousPingListeners();
      }
    };
  }, []);

  async function runPing() {
    if (!host.trim()) return;
    setRunning(true); setOutput(null); setRaw('');
    if (isBrowser) {
      await new Promise(r => setTimeout(r, 1200));
      const fake = `PING ${host}\n64 bytes from ${host}: icmp_seq=0 ttl=118 time=12.3 ms\n64 bytes from ${host}: icmp_seq=1 ttl=118 time=11.8 ms\n64 bytes from ${host}: icmp_seq=2 ttl=118 time=13.1 ms\n64 bytes from ${host}: icmp_seq=3 ttl=118 time=12.0 ms\n\n4 packets transmitted, 4 received, 0.0% packet loss`;
      setRaw(fake); setOutput(parsePingOutput(fake)); setRunning(false); return;
    }
    try {
      const result = await window.electronAPI.ping({ host: host.trim(), count: parseInt(count, 10) });
      setRaw(result.output);
      setOutput(result.success ? parsePingOutput(result.output) : { error: result.output });
    } catch (e) { setOutput({ error: e.message }); }
    setRunning(false);
  }

  const addSample = useCallback(({ rtt, timeout }) => {
    const seq = ++seqRef.current;
    const st  = statsRef.current;
    st.sent++;
    if (timeout || rtt === null) { st.lost++; }
    else { st.count++; st.sum += rtt; if (rtt < st.min) st.min = rtt; if (rtt > st.max) st.max = rtt; }
    setLiveStats({
      min:  st.min === Infinity ? null : st.min,
      max:  st.max === -Infinity ? null : st.max,
      avg:  st.count > 0 ? parseFloat((st.sum / st.count).toFixed(1)) : null,
      sent: st.sent, lost: st.lost,
      loss: st.sent > 0 ? parseFloat(((st.lost / st.sent) * 100).toFixed(1)) : 0,
    });
    setSamples(prev => {
      const next = [...prev, { rtt, timeout, seq }];
      return next.length > MAX_SAMPLES ? next.slice(next.length - MAX_SAMPLES) : next;
    });
  }, []);

  function startContinuous() {
    if (!host.trim()) return;
    seqRef.current = 0;
    statsRef.current = { min: Infinity, max: -Infinity, sum: 0, count: 0, lost: 0, sent: 0 };
    setSamples([]); setLiveStats(null); setRunning(true);
    if (isBrowser) {
      const interval = setInterval(() => {
        const timeout = Math.random() < 0.05;
        const rtt = timeout ? null : parseFloat((10 + Math.random() * 40 + Math.sin(Date.now() / 3000) * 8).toFixed(1));
        addSample({ rtt, timeout });
      }, 1000);
      seqRef._demoInterval = interval;
      return;
    }
    window.electronAPI.removeContinuousPingListeners();
    window.electronAPI.onContinuousPingResult(({ rtt, timeout, error }) => {
      if (error) return;
      addSample({ rtt: rtt ?? null, timeout: !!timeout });
    });
    window.electronAPI.onContinuousPingStopped(() => {
      setRunning(false);
      window.electronAPI.removeContinuousPingListeners();
    });
    window.electronAPI.startContinuousPing({ host: host.trim() });
  }

  function stopContinuous() {
    if (isBrowser) { clearInterval(seqRef._demoInterval); setRunning(false); return; }
    window.electronAPI.stopContinuousPing();
    setRunning(false);
    window.electronAPI.removeContinuousPingListeners();
  }

  const hasData = continuous ? samples.length > 0 : (output && !output.error);
  const latInfo = liveStats?.avg ? classifyLatency(liveStats.avg) :
                  output?.avg    ? classifyLatency(output.avg)    : null;

  return (
    <div style={s.wrap}>
      <h2 style={s.title}>Ping</h2>
      <p style={s.sub}>Test reachability and measure round-trip time to a host</p>

      <Instructions {...INSTRUCTIONS} />

      <div style={s.controls}>
        <div style={s.fg}>
          <label style={s.label}>HOST / IP</label>
          <input style={s.input} value={host} onChange={e => setHost(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !running && (continuous ? startContinuous() : runPing())}
            placeholder="hostname or IP address" spellCheck={false} disabled={running} />
        </div>
        <div style={s.fg}>
          <label style={s.label}>MODE</label>
          <div style={s.modeToggle}>
            <button style={{ ...s.modeBtn, ...(!continuous ? s.modeBtnActive : {}) }}
              onClick={() => !running && setContinuous(false)} disabled={running}>Fixed</button>
            <button style={{ ...s.modeBtn, ...(continuous ? s.modeBtnActive : {}) }}
              onClick={() => !running && setContinuous(true)} disabled={running}>∞ Continuous</button>
          </div>
        </div>
        {!continuous && (
          <div style={s.fg}>
            <label style={s.label}>PACKETS</label>
            <select style={s.select} value={count} onChange={e => setCount(e.target.value)} disabled={running}>
              {[1,2,4,8,16].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        )}
        {!running
          ? <button style={s.btn} onClick={continuous ? startContinuous : runPing}>▶  {continuous ? 'Start' : 'Run Ping'}</button>
          : <button style={{ ...s.btn, ...s.btnStop }} onClick={continuous ? stopContinuous : undefined} disabled={!continuous}>
              {continuous ? '■  Stop' : <><span style={s.spinner} /> Running…</>}
            </button>
        }
      </div>

      {/* Export bar */}
      <ExportBar
        disabled={!hasData}
        onExportTxt={() => exportPingTxt({ host, output, rawOutput, samples, liveStats, continuous })}
        onExportCsv={() => exportPingCsv({ host, output, samples, liveStats, continuous })}
      />

      {continuous && (
        <>
          {liveStats && (
            <div style={s.statsRow}>
              <StatCard label="Min RTT"     value={liveStats.min != null ? `${liveStats.min} ms` : '—'} color="#00FF9C" />
              <StatCard label="Avg RTT"     value={liveStats.avg != null ? `${liveStats.avg} ms` : '—'} color={latInfo?.color} badge={latInfo?.tier} />
              <StatCard label="Max RTT"     value={liveStats.max != null ? `${liveStats.max} ms` : '—'} color="#FFB020" />
              <StatCard label="Sent / Lost" value={`${liveStats.sent} / ${liveStats.lost}`} sub={`${liveStats.loss}% loss`} color={liveStats.lost > 0 ? '#FF4B6A' : '#00FF9C'} />
            </div>
          )}
          {samples.length > 0 && (
            <div style={s.section}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={s.sectionLabel}>LIVE RTT GRAPH</span>
                <span style={{ fontSize:10, color:'#3D4D65', fontFamily:'JetBrains Mono, monospace' }}>last {samples.length}/{MAX_SAMPLES} samples</span>
              </div>
              <RttGraph samples={samples} />
            </div>
          )}
          {samples.length > 0 && (
            <div style={s.section}>
              <span style={s.sectionLabel}>RECENT RESULTS</span>
              <div style={s.liveLog}>
                {[...samples].reverse().slice(0, 12).map((s2, i) => (
                  <div key={s2.seq} style={{ ...s.logRow, opacity: Math.max(0.25, 1 - i * 0.07) }}>
                    <span style={s.logSeq}>#{s2.seq}</span>
                    {s2.timeout
                      ? <span style={{ color:'#FF4B6A' }}>Request timed out</span>
                      : <>
                          <span style={{ color: classifyLatency(s2.rtt).color, minWidth: 60 }}>{s2.rtt} ms</span>
                          <span style={s.logBar}>
                            <span style={{ ...s.logBarFill, width: Math.min(100,(s2.rtt/200)*100)+'%', background: classifyLatency(s2.rtt).color }} />
                          </span>
                        </>
                    }
                  </div>
                ))}
              </div>
            </div>
          )}
          {!running && samples.length === 0 && <div style={s.placeholder}>Enter a host and press Start to begin continuous ping</div>}
          {running && samples.length === 0 && <div style={s.placeholder}><span style={s.spinner} />&nbsp;Waiting for first response from {host}…</div>}
        </>
      )}

      {!continuous && (
        <>
          {output && !output.error && (
            <div style={s.statsRow}>
              <StatCard label="Min RTT" value={output.min != null ? `${output.min} ms` : '—'} />
              <StatCard label="Avg RTT" value={output.avg != null ? `${output.avg} ms` : '—'} color={latInfo?.color} badge={latInfo?.tier} />
              <StatCard label="Max RTT" value={output.max != null ? `${output.max} ms` : '—'} />
              <StatCard label="Loss"    value={output.packetLoss != null ? `${output.packetLoss}%` : '—'} color={output.packetLoss > 0 ? '#FF4B6A' : '#00FF9C'} />
            </div>
          )}
          {output?.rtts?.length > 0 && (
            <div style={s.section}>
              <span style={s.sectionLabel}>RTT PER PACKET</span>
              <RttBars rtts={output.rtts} />
            </div>
          )}
          {output?.error && (
            <div style={s.errorBox}>
              <span style={{ color:'#FF4B6A', marginRight:8 }}>✗</span>
              <span style={{ fontFamily:'JetBrains Mono, monospace', fontSize:12 }}>{output.error}</span>
            </div>
          )}
          {rawOutput && (
            <div style={s.section}>
              <span style={s.sectionLabel}>RAW OUTPUT</span>
              <pre style={s.terminal}>{rawOutput}</pre>
            </div>
          )}
          {!output && !running && <div style={s.placeholder}>Enter a host and press Run Ping to begin</div>}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, color, badge }) {
  return (
    <div style={s.card}>
      <div style={s.cardLabel}>{label}</div>
      <div style={{ ...s.cardValue, color: color || '#E8EDF5' }}>{value}</div>
      {sub   && <div style={{ fontSize:11, color:'#8892A4', marginTop:3 }}>{sub}</div>}
      {badge && <div style={{ fontSize:11, color, marginTop:3, fontWeight:500 }}>{badge}</div>}
    </div>
  );
}

function RttGraph({ samples }) {
  const W = 840, H = 120, PAD = 8;
  const validRtts = samples.map(s => s.rtt).filter(r => r !== null);
  const maxRtt = validRtts.length ? Math.max(...validRtts, 10) * 1.2 : 100;
  const xStep  = (W - PAD * 2) / Math.max(samples.length - 1, 1);
  const points = samples.map((s2, i) => ({
    x: PAD + i * xStep,
    y: s2.timeout || s2.rtt === null ? H - PAD : PAD + (1 - s2.rtt / maxRtt) * (H - PAD * 2),
    ...s2,
  }));
  let pathD = '';
  points.forEach((p) => {
    if (p.timeout) return;
    pathD += pathD === '' ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`;
  });
  const firstValid = points.find(p => !p.timeout);
  const lastValid  = [...points].reverse().find(p => !p.timeout);
  return (
    <div style={s.graphWrap}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display:'block' }}>
        {[0,0.5,1].map((f,i) => (
          <line key={i} x1={PAD} y1={PAD+f*(H-PAD*2)} x2={W-PAD} y2={PAD+f*(H-PAD*2)} stroke="#1E2D45" strokeWidth="0.5" strokeDasharray="4 4" />
        ))}
        {pathD && firstValid && lastValid && (
          <path d={`${pathD} L ${lastValid.x} ${H-PAD} L ${firstValid.x} ${H-PAD} Z`} fill="rgba(0,212,255,0.06)" />
        )}
        {pathD && <path d={pathD} fill="none" stroke="#00D4FF" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />}
        {points.map((p,i) => p.timeout
          ? <line key={i} x1={p.x} y1={PAD} x2={p.x} y2={H-PAD} stroke="#FF4B6A" strokeWidth="1" strokeDasharray="2 2" opacity="0.5" />
          : <circle key={i} cx={p.x} cy={p.y} r="2.5" fill={classifyLatency(p.rtt).color} opacity="0.9" />
        )}
        {[maxRtt,maxRtt/2,0].map((v,i) => (
          <text key={i} x={W-2} y={PAD+(i/2)*(H-PAD*2)+4} fontSize="9" fill="#3D4D65" fontFamily="JetBrains Mono, monospace" textAnchor="end">{Math.round(v)}ms</text>
        ))}
      </svg>
      <div style={{ display:'flex', gap:16, marginTop:6, paddingLeft:4 }}>
        <span style={{ color:'#00D4FF', fontSize:10 }}>— RTT</span>
        <span style={{ color:'#FF4B6A', fontSize:10 }}>| Timeout</span>
      </div>
    </div>
  );
}

function RttBars({ rtts }) {
  const max = Math.max(...rtts, 1);
  return (
    <div style={s.bars}>
      {rtts.map((rtt, i) => {
        const { color } = classifyLatency(rtt);
        return (
          <div key={i} style={s.barWrap}>
            <div style={s.barLabel}>{rtt} ms</div>
            <div style={s.barTrack}><div style={{ ...s.barFill, width:`${(rtt/max)*100}%`, background:color }} /></div>
            <div style={s.barNum}>#{i+1}</div>
          </div>
        );
      })}
    </div>
  );
}

const s = {
  wrap: { display:'flex', flexDirection:'column', gap:18, animation:'fadeIn 0.2s ease' },
  title: { fontSize:22, fontWeight:600, color:'#E8EDF5', marginBottom:4 },
  sub: { color:'#8892A4', fontSize:13, marginBottom:4 },
  controls: { display:'flex', alignItems:'flex-end', gap:12, flexWrap:'wrap', background:'#111827', border:'1px solid #1E2D45', borderRadius:8, padding:'16px 20px' },
  fg: { display:'flex', flexDirection:'column', gap:6 },
  label: { fontSize:10, fontWeight:500, color:'#3D4D65', textTransform:'uppercase', letterSpacing:'0.1em' },
  input: { background:'#0D1525', border:'1px solid #1E2D45', borderRadius:6, color:'#E8EDF5', fontFamily:'JetBrains Mono, monospace', fontSize:13, padding:'8px 12px', outline:'none', width:240 },
  select: { background:'#0D1525', border:'1px solid #1E2D45', borderRadius:6, color:'#E8EDF5', fontFamily:'JetBrains Mono, monospace', fontSize:13, padding:'8px 12px', outline:'none', width:90 },
  modeToggle: { display:'flex', borderRadius:6, overflow:'hidden', border:'1px solid #1E2D45' },
  modeBtn: { background:'#0D1525', border:'none', color:'#8892A4', padding:'8px 14px', fontSize:12, cursor:'pointer', fontFamily:'Inter, sans-serif', fontWeight:500, whiteSpace:'nowrap' },
  modeBtnActive: { background:'rgba(0,212,255,0.12)', color:'#00D4FF' },
  btn: { background:'rgba(0,212,255,0.1)', border:'1px solid rgba(0,212,255,0.3)', color:'#00D4FF', borderRadius:6, padding:'8px 20px', fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'Inter, sans-serif', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:6 },
  btnStop: { background:'rgba(255,75,106,0.1)', border:'1px solid rgba(255,75,106,0.3)', color:'#FF4B6A' },
  spinner: { width:10, height:10, borderRadius:'50%', border:'2px solid rgba(0,212,255,0.3)', borderTopColor:'#00D4FF', display:'inline-block', animation:'spin 0.7s linear infinite' },
  statsRow: { display:'flex', gap:12 },
  card: { flex:1, background:'#111827', border:'1px solid #1E2D45', borderRadius:8, padding:'14px 18px' },
  cardLabel: { fontSize:10, color:'#3D4D65', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 },
  cardValue: { fontSize:22, fontWeight:600, fontFamily:'JetBrains Mono, monospace', lineHeight:1 },
  section: { display:'flex', flexDirection:'column', gap:8 },
  sectionLabel: { fontSize:10, color:'#3D4D65', textTransform:'uppercase', letterSpacing:'0.1em' },
  graphWrap: { background:'#080D18', border:'1px solid #1E2D45', borderRadius:8, padding:'14px 16px 10px' },
  liveLog: { background:'#080D18', border:'1px solid #1E2D45', borderRadius:8, padding:'8px 14px', display:'flex', flexDirection:'column', gap:4, maxHeight:220, overflowY:'auto' },
  logRow: { display:'flex', alignItems:'center', gap:12, fontFamily:'JetBrains Mono, monospace', fontSize:12, padding:'3px 0', borderBottom:'1px solid rgba(30,45,69,0.4)' },
  logSeq: { color:'#3D4D65', fontSize:10, width:36, flexShrink:0 },
  logBar: { flex:1, height:4, background:'#1A2235', borderRadius:2, overflow:'hidden' },
  logBarFill: { height:'100%', borderRadius:2, transition:'width 0.3s ease' },
  bars: { display:'flex', flexDirection:'column', gap:6 },
  barWrap: { display:'flex', alignItems:'center', gap:10 },
  barLabel: { fontFamily:'JetBrains Mono, monospace', fontSize:11, color:'#8892A4', width:60, textAlign:'right' },
  barTrack: { flex:1, background:'#0D1525', borderRadius:3, height:6, overflow:'hidden' },
  barFill: { height:'100%', borderRadius:3, transition:'width 0.4s ease' },
  barNum: { fontSize:10, color:'#3D4D65', width:24 },
  errorBox: { background:'rgba(255,75,106,0.06)', border:'1px solid rgba(255,75,106,0.2)', borderRadius:8, padding:'14px 18px', display:'flex', alignItems:'flex-start' },
  terminal: { background:'#080D18', border:'1px solid #1E2D45', borderRadius:8, padding:'14px 16px', fontFamily:'JetBrains Mono, monospace', fontSize:11, color:'#8892A4', lineHeight:1.7, overflowX:'auto', whiteSpace:'pre-wrap', wordBreak:'break-all' },
  placeholder: { textAlign:'center', color:'#3D4D65', padding:'60px 0', fontFamily:'JetBrains Mono, monospace', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center', gap:10 },
};
