import React, { useRef, useEffect, useCallback } from 'react';
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
    { label: 'Choose Fixed or Continuous mode', detail: 'Fixed sends a set number of packets and shows each result as it arrives. Continuous pings forever with a live graph until you press Stop.' },
    { label: 'In Fixed mode choose a packet count', detail: 'Select how many pings to send — results paint in real time as each response arrives.' },
    { label: 'Press Run Ping or Start', detail: 'Results appear immediately as each packet responds. Color coding goes green (fast) through amber to red (slow or timeout).' },
    { label: 'Export your results', detail: 'Use the Export bar to save results as a .txt report or .csv spreadsheet at any time.' },
  ],
  notes: 'A host that does not respond to ping may still be online — many firewalls block ICMP ping requests.',
};

// ── Default state shape — exported so App.js can initialise it ────────────────
export const defaultPingState = {
  host:       '8.8.8.8',
  count:      '4',
  continuous: false,
  running:    false,
  // Fixed mode
  lines:      [],   // { text, rtt, timeout, isErr }
  summary:    null, // { min, max, avg, packetLoss }
  // Continuous mode
  samples:    [],
  liveStats:  null,
};

export default function PingTool({ state, setState }) {
  const seqRef   = useRef(0);
  const statsRef = useRef({ min: Infinity, max: -Infinity, sum: 0, count: 0, lost: 0, sent: 0 });

  // Sync statsRef whenever liveStats resets (new continuous session)
  useEffect(() => {
    if (!state.liveStats) {
      statsRef.current = { min: Infinity, max: -Infinity, sum: 0, count: 0, lost: 0, sent: 0 };
      seqRef.current   = 0;
    }
  }, [state.liveStats]);

  // Clean up on unmount — stop processes AND mark as not running
  useEffect(() => {
    return () => {
      if (window.electronAPI) {
        window.electronAPI.stopPing?.();
        window.electronAPI.removePingListeners?.();
        window.electronAPI.stopContinuousPing?.();
        window.electronAPI.removeContinuousPingListeners?.();
      }
      // Reset running state so UI is accurate when returning to this tab
      setState(prev => ({ ...prev, running: false }));
    };
  }, [setState]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  function set(patch) { setState(prev => ({ ...prev, ...patch })); }

  function parseRtt(line) {
    const winMatch  = line.match(/time[<=]([\d.]+)ms/i);
    const unixMatch = line.match(/time[<=]([\d.]+)\s*ms/i);
    if (winMatch)       return parseFloat(winMatch[1]);
    if (unixMatch)      return parseFloat(unixMatch[1]);
    return null;
  }

  function parseTimeout(line) {
    return /request timed out|no answer|100% packet loss|destination host unreachable|host unreachable|unreachable|could not find host/i.test(line);
  }

  function isUnreachable(line) {
    return /destination host unreachable|host unreachable|unreachable/i.test(line);
  }

  function parseSummary(output) {
    const lines   = output.split('\n');
    const rtts    = [];
    let unreachableCount = 0;
    let totalCount = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (/unreachable/i.test(trimmed)) {
        unreachableCount++;
        totalCount++;
        continue;
      }
      if (/request timed out/i.test(trimmed)) {
        totalCount++;
        continue;
      }
      const rtt = parseRtt(trimmed);
      if (rtt !== null) {
        rtts.push(rtt);
        totalCount++;
      }
    }

    // If all replies were unreachable, report 100% loss
    let packetLoss = null;
    if (unreachableCount > 0 && totalCount > 0) {
      packetLoss = parseFloat(((unreachableCount / totalCount) * 100).toFixed(1));
    } else {
      const lossMatch = output.match(/([\d.]+)%\s*packet loss/i) || output.match(/\(([\d.]+)%\s*loss\)/i);
      if (lossMatch) packetLoss = parseFloat(lossMatch[1]);
    }

    const min = rtts.length ? Math.min(...rtts) : null;
    const max = rtts.length ? Math.max(...rtts) : null;
    const avg = rtts.length ? parseFloat((rtts.reduce((a, b) => a + b, 0) / rtts.length).toFixed(2)) : null;
    return { min, max, avg, packetLoss, rtts, allUnreachable: unreachableCount > 0 && rtts.length === 0 };
  }

  // ── Fixed ping (streaming) ─────────────────────────────────────────────────
  function runPing() {
    if (!state.host.trim()) return;
    // Clear immediately so no stale results show
    setState(prev => ({ ...prev, running: true, lines: [], summary: null }));

    if (isBrowser) {
      // Demo: drip fake lines
      const count = parseInt(state.count, 10);
      let i = 0;
      const fakeLines = Array.from({ length: count }, (_, idx) => {
        const rtt = parseFloat((8 + Math.random() * 30).toFixed(1));
        return `64 bytes from ${state.host}: icmp_seq=${idx} ttl=118 time=${rtt} ms`;
      });
      fakeLines.push('');
      fakeLines.push(`${count} packets transmitted, ${count} received, 0.0% packet loss`);

      const interval = setInterval(() => {
        const line = fakeLines[i++];
        if (line !== undefined) {
            const rtt         = parseRtt(line);
          const timeout     = parseTimeout(line);
          const unreachable = isUnreachable(line);
          setState(prev => ({
            ...prev,
            lines: [...prev.lines, { text: line, rtt: unreachable ? null : rtt, timeout, unreachable, isErr: false }],
          }));
        }
        if (i >= fakeLines.length) {
          clearInterval(interval);
          setState(prev => ({
            ...prev,
            running: false,
            summary: parseSummary(fakeLines.join('\n')),
          }));
        }
      }, 400);
      return;
    }

    window.electronAPI.removePingListeners();
    window.electronAPI.onPingLine(({ line, rtt, timeout, unreachable, isErr }) => {
      // Values are pre-parsed in main.js — trust them directly
      if (!line || !line.trim()) return;
      setState(prev => ({
        ...prev,
        lines: [...prev.lines, {
          text: line,
          rtt:         rtt         ?? null,
          timeout:     timeout     ?? false,
          unreachable: unreachable ?? false,
          isErr:       isErr       ?? false,
        }],
      }));
    });
    window.electronAPI.onPingDone(({ output }) => {
      setState(prev => ({
        ...prev,
        running: false,
        summary: parseSummary(output),
      }));
      window.electronAPI.removePingListeners();
    });
    window.electronAPI.startPing({ host: state.host.trim(), count: parseInt(state.count, 10) });
  }

  // ── Continuous ping ────────────────────────────────────────────────────────
  const addSample = useCallback(({ rtt, timeout }) => {
    const seq = ++seqRef.current;
    const st  = statsRef.current;
    st.sent++;
    if (timeout || rtt === null) { st.lost++; }
    else { st.count++; st.sum += rtt; if (rtt < st.min) st.min = rtt; if (rtt > st.max) st.max = rtt; }
    const newStats = {
      min:  st.min === Infinity ? null : st.min,
      max:  st.max === -Infinity ? null : st.max,
      avg:  st.count > 0 ? parseFloat((st.sum / st.count).toFixed(1)) : null,
      sent: st.sent, lost: st.lost,
      loss: st.sent > 0 ? parseFloat(((st.lost / st.sent) * 100).toFixed(1)) : 0,
    };
    setState(prev => {
      const next = [...prev.samples, { rtt, timeout, seq }];
      return {
        ...prev,
        liveStats: newStats,
        samples: next.length > MAX_SAMPLES ? next.slice(next.length - MAX_SAMPLES) : next,
      };
    });
  }, [setState]);

  function startContinuous() {
    if (!state.host.trim()) return;
    statsRef.current = { min: Infinity, max: -Infinity, sum: 0, count: 0, lost: 0, sent: 0 };
    seqRef.current   = 0;
    set({ running: true, samples: [], liveStats: null });

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
      set({ running: false });
      window.electronAPI.removeContinuousPingListeners();
    });
    window.electronAPI.startContinuousPing({ host: state.host.trim() });
  }

  function stopContinuous() {
    if (isBrowser) { clearInterval(seqRef._demoInterval); set({ running: false }); return; }
    window.electronAPI.stopContinuousPing();
    set({ running: false });
    window.electronAPI.removeContinuousPingListeners();
  }

  const latInfo = state.liveStats?.avg ? classifyLatency(state.liveStats.avg) :
                  state.summary?.avg   ? classifyLatency(state.summary.avg)   : null;

  const hasFixedData    = state.lines.length > 0;
  const hasContinuousData = state.samples.length > 0;

  return (
    <div style={s.wrap}>
      <h2 style={s.title}>Ping</h2>
      <p style={s.sub}>Test reachability and measure round-trip time to a host</p>

      <Instructions {...INSTRUCTIONS} />

      {/* Controls */}
      <div style={s.controls}>
        <div style={s.fg}>
          <label style={s.label}>HOST / IP</label>
          <input style={s.input} value={state.host}
            onChange={e => set({ host: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && !state.running && (state.continuous ? startContinuous() : runPing())}
            placeholder="hostname or IP address" spellCheck={false} disabled={state.running} />
        </div>
        <div style={s.fg}>
          <label style={s.label}>MODE</label>
          <div style={s.modeToggle}>
            <button style={{ ...s.modeBtn, ...(!state.continuous ? s.modeBtnActive : {}) }}
              onClick={() => !state.running && set({ continuous: false })} disabled={state.running}>Fixed</button>
            <button style={{ ...s.modeBtn, ...(state.continuous ? s.modeBtnActive : {}) }}
              onClick={() => !state.running && set({ continuous: true })} disabled={state.running}>∞ Continuous</button>
          </div>
        </div>
        {!state.continuous && (
          <div style={s.fg}>
            <label style={s.label}>PACKETS</label>
            <select style={s.select} value={state.count} onChange={e => set({ count: e.target.value })} disabled={state.running}>
              {[1,2,4,8,16].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        )}
        {!state.running
          ? <button style={s.btn} onClick={state.continuous ? startContinuous : runPing}>
              ▶  {state.continuous ? 'Start' : 'Run Ping'}
            </button>
          : <button style={{ ...s.btn, ...s.btnStop }}
              onClick={state.continuous ? stopContinuous : undefined}
              disabled={!state.continuous}>
              {state.continuous ? '■  Stop' : <><span style={s.spinner} /> Running…</>}
            </button>
        }
      </div>

      <ExportBar
        disabled={!hasFixedData && !hasContinuousData}
        onExportTxt={() => exportPingTxt({
          host: state.host, output: state.summary,
          rawOutput: state.lines.map(l => l.text).join('\n'),
          samples: state.samples, liveStats: state.liveStats,
          continuous: state.continuous,
        })}
        onExportCsv={() => exportPingCsv({
          host: state.host, output: state.summary,
          samples: state.samples, liveStats: state.liveStats,
          continuous: state.continuous,
        })}
      />

      {/* ── FIXED MODE ── */}
      {!state.continuous && (
        <>
          {/* Live result lines */}
          {state.lines.length > 0 && (
            <div style={s.liveLines}>
              {state.lines.map((line, i) => (
                <div key={i} style={s.liveLine}>
                  {line.rtt != null && !line.timeout && !line.unreachable && (
                    <span style={{ ...s.lineRtt, color: '#00FF9C' }}>
                      {line.rtt} ms
                    </span>
                  )}
                  {(line.timeout || line.unreachable) && (
                    <span style={{ color: '#FF4B6A', marginRight: 8, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, flexShrink: 0 }}>
                      ✗ {line.unreachable ? 'Unreachable' : 'Timeout'}
                    </span>
                  )}
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                    color: (line.isErr || line.timeout || line.unreachable) ? '#FF4B6A' : line.rtt != null ? '#8892A4' : '#3D4D65',
                    flex: 1,
                  }}>
                    {line.rtt != null && !line.timeout && !line.unreachable
                      ? line.text.replace(/\s*time[<=][\d.]+ ?ms/i, '').trimEnd()
                      : line.text}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Summary stats — shown after all packets returned */}
          {state.summary && (
            <div style={s.statsRow}>
              <StatCard label="Min RTT" value={state.summary.min != null ? `${state.summary.min} ms` : '—'} />
              <StatCard label="Avg RTT" value={state.summary.avg != null ? `${state.summary.avg} ms` : '—'}
                color={latInfo?.color} badge={latInfo?.tier} />
              <StatCard label="Max RTT" value={state.summary.max != null ? `${state.summary.max} ms` : '—'} />
              <StatCard label="Loss"
                value={state.summary.allUnreachable ? '100%' : state.summary.packetLoss != null ? `${state.summary.packetLoss}%` : '—'}
                color={state.summary.allUnreachable || state.summary.packetLoss > 0 ? '#FF4B6A' : '#00FF9C'} />
            </div>
          )}

          {!hasFixedData && !state.running && (
            <div style={s.placeholder}>Enter a host and press Run Ping to begin</div>
          )}
        </>
      )}

      {/* ── CONTINUOUS MODE ── */}
      {state.continuous && (
        <>
          {state.liveStats && (
            <div style={s.statsRow}>
              <StatCard label="Min RTT"     value={state.liveStats.min != null ? `${state.liveStats.min} ms` : '—'} color="#00FF9C" />
              <StatCard label="Avg RTT"     value={state.liveStats.avg != null ? `${state.liveStats.avg} ms` : '—'} color={latInfo?.color} badge={latInfo?.tier} />
              <StatCard label="Max RTT"     value={state.liveStats.max != null ? `${state.liveStats.max} ms` : '—'} color="#FFB020" />
              <StatCard label="Sent / Lost" value={`${state.liveStats.sent} / ${state.liveStats.lost}`}
                sub={`${state.liveStats.loss}% loss`}
                color={state.liveStats.lost > 0 ? '#FF4B6A' : '#00FF9C'} />
            </div>
          )}
          {state.samples.length > 0 && (
            <div style={s.section}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={s.sectionLabel}>LIVE RTT GRAPH</span>
                <span style={{ fontSize:10, color:'#3D4D65', fontFamily:'JetBrains Mono, monospace' }}>
                  last {state.samples.length}/{MAX_SAMPLES} samples
                </span>
              </div>
              <RttGraph samples={state.samples} />
            </div>
          )}
          {state.samples.length > 0 && (
            <div style={s.section}>
              <span style={s.sectionLabel}>RECENT RESULTS</span>
              <div style={s.liveLog}>
                {[...state.samples].reverse().slice(0, 12).map((s2, i) => (
                  <div key={s2.seq} style={{ ...s.logRow, opacity: Math.max(0.25, 1 - i * 0.07) }}>
                    <span style={s.logSeq}>#{s2.seq}</span>
                    {s2.timeout
                      ? <span style={{ color:'#FF4B6A' }}>Request timed out</span>
                      : <>
                          <span style={{ color: '#00FF9C', minWidth: 60 }}>{s2.rtt} ms</span>
                          <span style={s.logBar}>
                            <span style={{ ...s.logBarFill, width: Math.min(100,(s2.rtt/200)*100)+'%', background: '#00FF9C' }} />
                          </span>
                        </>
                    }
                  </div>
                ))}
              </div>
            </div>
          )}
          {!state.running && state.samples.length === 0 && (
            <div style={s.placeholder}>Enter a host and press Start to begin continuous ping</div>
          )}
          {state.running && state.samples.length === 0 && (
            <div style={s.placeholder}><span style={s.spinner} />&nbsp;Waiting for first response from {state.host}…</div>
          )}
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
          <line key={i} x1={PAD} y1={PAD+f*(H-PAD*2)} x2={W-PAD} y2={PAD+f*(H-PAD*2)}
            stroke="#1E2D45" strokeWidth="0.5" strokeDasharray="4 4" />
        ))}
        {pathD && firstValid && lastValid && (
          <path d={`${pathD} L ${lastValid.x} ${H-PAD} L ${firstValid.x} ${H-PAD} Z`}
            fill="rgba(0,212,255,0.06)" />
        )}
        {pathD && <path d={pathD} fill="none" stroke="#00D4FF" strokeWidth="1.5"
          strokeLinejoin="round" strokeLinecap="round" />}
        {points.map((p,i) => p.timeout
          ? <line key={i} x1={p.x} y1={PAD} x2={p.x} y2={H-PAD} stroke="#FF4B6A"
              strokeWidth="1" strokeDasharray="2 2" opacity="0.5" />
          : <circle key={i} cx={p.x} cy={p.y} r="2.5"
              fill="#00FF9C" opacity="0.9" />
        )}
        {[maxRtt,maxRtt/2,0].map((v,i) => (
          <text key={i} x={W-2} y={PAD+(i/2)*(H-PAD*2)+4} fontSize="9" fill="#3D4D65"
            fontFamily="JetBrains Mono, monospace" textAnchor="end">{Math.round(v)}ms</text>
        ))}
      </svg>
      <div style={{ display:'flex', gap:16, marginTop:6, paddingLeft:4 }}>
        <span style={{ color:'#00D4FF', fontSize:10 }}>— RTT</span>
        <span style={{ color:'#FF4B6A', fontSize:10 }}>| Timeout</span>
      </div>
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

  // Live fixed-mode lines
  liveLines: { background:'#080D18', border:'1px solid #1E2D45', borderRadius:8, padding:'10px 14px', display:'flex', flexDirection:'column', gap:3, maxHeight:260, overflowY:'auto' },
  liveLine: { display:'flex', alignItems:'baseline', gap:10, padding:'2px 0', borderBottom:'1px solid rgba(30,45,69,0.3)', animation:'fadeIn 0.15s ease' },
  lineRtt: { fontFamily:'JetBrains Mono, monospace', fontSize:12, fontWeight:600, minWidth:64, textAlign:'right', flexShrink:0 },

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
  placeholder: { textAlign:'center', color:'#3D4D65', padding:'60px 0', fontFamily:'JetBrains Mono, monospace', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center', gap:10 },
};
