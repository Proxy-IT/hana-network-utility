import React, { useRef, useEffect } from 'react';
import { classifyLatency } from '../utils/latency';
import { computeTcpPingStats } from '../utils/tcpPingStats';
import { exportTcpPingTxt, exportTcpPingCsv } from '../utils/export';
import { validateHost, validatePorts, validateTcpPingTimeout, validatePingCount } from '../lib/validate';
import Instructions from './Instructions';
import ExportBar from './ExportBar';

const isBrowser = !window.electronAPI;
const MAX_DISPLAY  = 60;    // graph/recent-results display window
const MAX_ATTEMPTS = 86400; // 24 hours of headroom at 1 attempt/sec before capping the stats-backing array

const STATUS_COLOR = {
  success: '#00FF9C',
  timeout: '#FFB020', 'tls-timeout': '#FFB020', 'dns-timeout': '#FFB020',
  refused: '#3D4D65',
  unreachable: '#FF4B6A', reset: '#FF4B6A', 'dns-error': '#FF4B6A', 'tls-error': '#FF4B6A', error: '#FF4B6A',
};
const STATUS_LABEL = {
  success: 'Success', timeout: 'Timeout', 'tls-timeout': 'TLS Timeout', 'dns-timeout': 'DNS Timeout', refused: 'Refused',
  unreachable: 'Unreachable', reset: 'Reset', 'dns-error': 'DNS Error', 'tls-error': 'TLS Error', error: 'Error',
};

const INSTRUCTIONS = {
  title: 'How to use TCP Ping',
  items: [
    { label: 'Enter a host and port', detail: 'The service you actually want to confirm is reachable — e.g. a web server on 443, or a mail server on 25.', example: 'example.com : 443' },
    { label: 'Toggle TLS if the port speaks TLS', detail: 'Adds a third phase — after DNS and TCP connect — timing the TLS handshake. Off by default; turn it on for 443/8443-style ports.' },
    { label: 'Choose Fixed or Continuous mode', detail: 'Fixed sends a set number of attempts. Continuous repeats once per second until you press Stop.' },
    { label: 'Read the per-attempt breakdown', detail: 'Each attempt reports DNS time, TCP connect time, and (if enabled) TLS time separately — plus an explicit reason when it fails: refused, timed out, unreachable, or DNS failure.' },
    { label: 'Export your results', detail: 'Use the Export bar to save the full attempt log plus summary stats as a .txt report or .csv spreadsheet.' },
  ],
  notes: 'Unlike ICMP ping, TCP Ping proves a specific service is reachable — useful when ICMP is blocked but the port you actually care about isn\'t.',
};

export const defaultTcpPingState = {
  host: '', port: '443', timeoutMs: '2000', useTls: false,
  continuous: false, count: '10',
  running: false, errorMsg: null,
  attempts: [], // { seq, status, dnsMs, connectMs, tlsMs, totalMs, error } — capped at MAX_ATTEMPTS
};

function capAttempts(arr) {
  return arr.length > MAX_ATTEMPTS ? arr.slice(arr.length - MAX_ATTEMPTS) : arr;
}

function fakeAttempt(seq, useTls) {
  const dnsMs = parseFloat((Math.random() * 6).toFixed(2));
  const r = Math.random();
  if (r < 0.82) {
    const connectMs = parseFloat((4 + Math.random() * 25).toFixed(2));
    const tlsMs     = useTls ? parseFloat((10 + Math.random() * 45).toFixed(2)) : null;
    const totalMs   = parseFloat((dnsMs + connectMs + (tlsMs || 0)).toFixed(2));
    return { seq, status: 'success', dnsMs, connectMs, tlsMs, totalMs, error: null };
  }
  if (r < 0.90) return { seq, status: 'timeout',     dnsMs, connectMs: null, tlsMs: null, totalMs: null, error: 'Connection timed out' };
  if (r < 0.96) return { seq, status: 'refused',     dnsMs, connectMs: null, tlsMs: null, totalMs: null, error: 'Connection refused' };
  return          { seq, status: 'unreachable', dnsMs, connectMs: null, tlsMs: null, totalMs: null, error: 'Host unreachable' };
}

export default function TcpPing({ state, setState }) {
  const demoIntervalRef = useRef(null);
  const demoSeqRef      = useRef(0);

  // Clean up on unmount — stop any in-flight session AND mark as not running
  useEffect(() => {
    return () => {
      if (window.electronAPI) {
        window.electronAPI.stopTcpPing?.();
        window.electronAPI.removeTcpPingListeners?.();
      }
      clearInterval(demoIntervalRef.current);
      setState(prev => ({ ...prev, running: false }));
    };
  }, [setState]);

  function set(patch) { setState(prev => ({ ...prev, ...patch })); }

  function start() {
    if (!state.host.trim()) return;
    const hostErr = validateHost(state.host);
    if (hostErr) { set({ errorMsg: hostErr }); return; }
    const portCheck = validatePorts([state.port]);
    if (!portCheck.ok) { set({ errorMsg: portCheck.message }); return; }
    const timeoutErr = validateTcpPingTimeout(state.timeoutMs);
    if (timeoutErr) { set({ errorMsg: timeoutErr }); return; }
    if (!state.continuous) {
      const countErr = validatePingCount(state.count);
      if (countErr) { set({ errorMsg: countErr }); return; }
    }

    setState(prev => ({ ...prev, running: true, attempts: [], errorMsg: null }));

    if (isBrowser) {
      demoSeqRef.current = 0;
      const targetCount = state.continuous ? null : parseInt(state.count, 10);
      const interval = setInterval(() => {
        demoSeqRef.current += 1;
        const attempt = fakeAttempt(demoSeqRef.current, state.useTls);
        setState(prev => ({ ...prev, attempts: capAttempts([...prev.attempts, attempt]) }));
        if (targetCount && demoSeqRef.current >= targetCount) {
          clearInterval(interval);
          setState(prev => ({ ...prev, running: false }));
        }
      }, 700);
      demoIntervalRef.current = interval;
      return;
    }

    window.electronAPI.removeTcpPingListeners();
    window.electronAPI.onTcpPingResult((attempt) => {
      setState(prev => ({ ...prev, attempts: capAttempts([...prev.attempts, attempt]) }));
    });
    window.electronAPI.onTcpPingDone(() => {
      setState(prev => ({ ...prev, running: false }));
      window.electronAPI.removeTcpPingListeners();
    });
    window.electronAPI.onTcpPingStopped(() => {
      setState(prev => ({ ...prev, running: false }));
      window.electronAPI.removeTcpPingListeners();
    });
    window.electronAPI.onTcpPingError(({ message }) => {
      setState(prev => ({ ...prev, running: false, errorMsg: message }));
      window.electronAPI.removeTcpPingListeners();
    });
    window.electronAPI.startTcpPing({
      host: state.host.trim(),
      port: parseInt(state.port, 10),
      timeoutMs: parseInt(state.timeoutMs, 10),
      tls: state.useTls,
      ...(state.continuous ? {} : { count: parseInt(state.count, 10) }),
    });
  }

  function stop() {
    if (isBrowser) {
      clearInterval(demoIntervalRef.current);
      set({ running: false });
      return;
    }
    window.electronAPI.stopTcpPing();
    set({ running: false });
    window.electronAPI.removeTcpPingListeners();
  }

  function clear() {
    setState(prev => ({ ...prev, attempts: [], errorMsg: null, running: false }));
  }

  const stats   = computeTcpPingStats(state.attempts);
  const latInfo = stats.avg != null ? classifyLatency(stats.avg) : null;
  const hasData = state.attempts.length > 0;

  return (
    <div style={s.wrap}>
      <h2 style={s.title}>TCP Ping</h2>
      <p style={s.sub}>Repeatedly test whether a specific host:port is reachable, with DNS/connect/TLS timing broken out</p>

      <Instructions {...INSTRUCTIONS} />

      {/* Controls */}
      <div style={s.controls}>
        <div style={s.fg}>
          <label style={s.label}>HOST / IP</label>
          <input style={s.input} value={state.host}
            onChange={e => set({ host: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && !state.running && start()}
            placeholder="hostname or IP address" spellCheck={false} disabled={state.running} />
        </div>
        <div style={s.fg}>
          <label style={s.label}>PORT</label>
          <input style={{ ...s.input, width: 90 }} value={state.port}
            onChange={e => set({ port: e.target.value.replace(/[^\d]/g, '') })}
            onKeyDown={e => e.key === 'Enter' && !state.running && start()}
            placeholder="443" disabled={state.running} />
        </div>
        <div style={s.fg}>
          <label style={s.label}>TIMEOUT</label>
          <select style={s.select} value={state.timeoutMs} onChange={e => set({ timeoutMs: e.target.value })} disabled={state.running}>
            {[500, 1000, 2000, 5000, 10000].map(n => <option key={n} value={n}>{n} ms</option>)}
          </select>
        </div>
        <div style={s.fg}>
          <label style={s.label}>TLS</label>
          <label style={s.checkboxRow}>
            <input type="checkbox" checked={state.useTls} disabled={state.running}
              onChange={e => set({ useTls: e.target.checked })} style={{ accentColor: '#00D4FF', cursor: 'pointer' }} />
            <span style={{ fontSize: 12, color: '#8892A4' }}>Time TLS handshake</span>
          </label>
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
            <label style={s.label}>ATTEMPTS</label>
            <select style={s.select} value={state.count} onChange={e => set({ count: e.target.value })} disabled={state.running}>
              {[5, 10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        )}
        {!state.running
          ? <button style={s.btn} onClick={start}>▶ {state.continuous ? 'Start' : 'Run'}</button>
          : <button style={{ ...s.btn, ...s.btnStop }} onClick={stop}>■ Stop</button>
        }
      </div>

      {/* Inline error banner */}
      {state.errorMsg && (
        <div style={s.errorBanner}>
          <span style={s.errorBannerIcon}>⚠</span>
          <span style={s.errorBannerMsg}>{state.errorMsg}</span>
          <button style={s.errorBannerClose} onClick={() => set({ errorMsg: null })}>✕</button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <ExportBar
          disabled={!hasData}
          onExportTxt={() => exportTcpPingTxt({ host: state.host, port: state.port, useTls: state.useTls, attempts: state.attempts, stats })}
          onExportCsv={() => exportTcpPingCsv({ host: state.host, port: state.port, useTls: state.useTls, attempts: state.attempts, stats })}
        />
        {hasData && !state.running && (
          <button style={s.clearBtn} onClick={clear}>✕ Clear</button>
        )}
      </div>

      {hasData && (
        <div style={s.statsRow}>
          <StatCard label="Min" value={stats.min != null ? `${stats.min} ms` : '—'} />
          <StatCard label="Avg" value={stats.avg != null ? `${stats.avg} ms` : '—'} color={latInfo?.color} badge={latInfo?.tier} />
          <StatCard label="Max" value={stats.max != null ? `${stats.max} ms` : '—'} />
          <StatCard label="Jitter" value={stats.jitter != null ? `${stats.jitter} ms` : '—'} />
          <StatCard label="Sent / Lost" value={`${stats.sent} / ${stats.lost}`} sub={`${stats.loss}% loss`} color={stats.lost > 0 ? '#FF4B6A' : '#00FF9C'} />
          <StatCard label="Longest Fail Streak" value={stats.longestFailStreak} color={stats.longestFailStreak > 0 ? '#FFB020' : '#00FF9C'} />
        </div>
      )}

      {hasData && (
        <div style={s.section}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={s.sectionLabel}>LIVE TIMING GRAPH</span>
            <span style={{ fontSize: 10, color: '#3D4D65', fontFamily: 'JetBrains Mono, monospace' }}>
              last {Math.min(state.attempts.length, MAX_DISPLAY)}/{MAX_DISPLAY} shown
            </span>
          </div>
          <RttGraph samples={state.attempts.slice(-MAX_DISPLAY).map(a => ({ seq: a.seq, totalMs: a.totalMs, failed: a.status !== 'success' }))} />
        </div>
      )}

      {hasData && (
        <div style={s.section}>
          <span style={s.sectionLabel}>RECENT ATTEMPTS</span>
          <div style={s.liveLog}>
            {[...state.attempts].reverse().slice(0, 12).map((a, i) => (
              <div key={a.seq} style={{ ...s.logRow, opacity: Math.max(0.25, 1 - i * 0.07) }}>
                <span style={s.logSeq}>#{a.seq}</span>
                <span style={{ color: STATUS_COLOR[a.status], minWidth: 96 }}>{STATUS_LABEL[a.status]}</span>
                {a.status === 'success'
                  ? <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#8892A4' }}>
                      DNS {a.dnsMs}ms · Connect {a.connectMs}ms{a.tlsMs != null ? ` · TLS ${a.tlsMs}ms` : ''} · Total {a.totalMs}ms
                    </span>
                  : <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#3D4D65' }}>{a.error}</span>
                }
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasData && !state.running && (
        <div style={s.placeholder}>Enter a host and port and press Run to begin</div>
      )}
      {state.running && !hasData && (
        <div style={s.placeholder}><span style={s.spinner} />&nbsp;Waiting for first attempt against {state.host}:{state.port}…</div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, color, badge }) {
  return (
    <div style={s.card}>
      <div style={s.cardLabel}>{label}</div>
      <div style={{ ...s.cardValue, color: color || '#E8EDF5' }}>{value}</div>
      {sub   && <div style={{ fontSize: 11, color: '#8892A4', marginTop: 3 }}>{sub}</div>}
      {badge && <div style={{ fontSize: 11, color, marginTop: 3, fontWeight: 500 }}>{badge}</div>}
    </div>
  );
}

function RttGraph({ samples }) {
  const W = 840, H = 120, PAD = 8;
  const validMs = samples.map(s2 => s2.totalMs).filter(v => v !== null && v !== undefined);
  const maxMs  = validMs.length ? Math.max(...validMs, 10) * 1.2 : 100;
  const xStep  = (W - PAD * 2) / Math.max(samples.length - 1, 1);
  const points = samples.map((s2, i) => ({
    x: PAD + i * xStep,
    y: s2.failed || s2.totalMs == null ? H - PAD : PAD + (1 - s2.totalMs / maxMs) * (H - PAD * 2),
    ...s2,
  }));
  let pathD = '';
  points.forEach((p) => {
    if (p.failed) return;
    pathD += pathD === '' ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`;
  });
  const firstValid = points.find(p => !p.failed);
  const lastValid  = [...points].reverse().find(p => !p.failed);
  return (
    <div style={s.graphWrap}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
        {[0, 0.5, 1].map((f, i) => (
          <line key={i} x1={PAD} y1={PAD + f * (H - PAD * 2)} x2={W - PAD} y2={PAD + f * (H - PAD * 2)}
            stroke="#1E2D45" strokeWidth="0.5" strokeDasharray="4 4" />
        ))}
        {pathD && firstValid && lastValid && (
          <path d={`${pathD} L ${lastValid.x} ${H - PAD} L ${firstValid.x} ${H - PAD} Z`}
            fill="rgba(0,212,255,0.06)" />
        )}
        {pathD && <path d={pathD} fill="none" stroke="#00D4FF" strokeWidth="1.5"
          strokeLinejoin="round" strokeLinecap="round" />}
        {points.map((p, i) => p.failed
          ? <line key={i} x1={p.x} y1={PAD} x2={p.x} y2={H - PAD} stroke="#FF4B6A"
              strokeWidth="1" strokeDasharray="2 2" opacity="0.5" />
          : <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#00FF9C" opacity="0.9" />
        )}
        {[maxMs, maxMs / 2, 0].map((v, i) => (
          <text key={i} x={W - 2} y={PAD + (i / 2) * (H - PAD * 2) + 4} fontSize="9" fill="#3D4D65"
            fontFamily="JetBrains Mono, monospace" textAnchor="end">{Math.round(v)}ms</text>
        ))}
      </svg>
      <div style={{ display: 'flex', gap: 16, marginTop: 6, paddingLeft: 4 }}>
        <span style={{ color: '#00D4FF', fontSize: 10 }}>— Total time</span>
        <span style={{ color: '#FF4B6A', fontSize: 10 }}>| Failed</span>
      </div>
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
  input: { background: '#0D1525', border: '1px solid #1E2D45', borderRadius: 6, color: '#E8EDF5', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, padding: '8px 12px', outline: 'none', width: 220 },
  select: { background: '#0D1525', border: '1px solid #1E2D45', borderRadius: 6, color: '#E8EDF5', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, padding: '8px 12px', outline: 'none', width: 100 },
  checkboxRow: { display: 'flex', alignItems: 'center', gap: 6, height: 36 },
  modeToggle: { display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid #1E2D45' },
  modeBtn: { background: '#0D1525', border: 'none', color: '#8892A4', padding: '8px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 500, whiteSpace: 'nowrap' },
  modeBtnActive: { background: 'rgba(0,212,255,0.12)', color: '#00D4FF' },
  btn: { background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)', color: '#00D4FF', borderRadius: 6, padding: '8px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 },
  btnStop: { background: 'rgba(255,75,106,0.1)', border: '1px solid rgba(255,75,106,0.3)', color: '#FF4B6A' },
  spinner: { width: 10, height: 10, borderRadius: '50%', border: '2px solid rgba(0,212,255,0.3)', borderTopColor: '#00D4FF', display: 'inline-block', animation: 'spin 0.7s linear infinite' },

  statsRow: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  card: { flex: '1 1 120px', background: '#111827', border: '1px solid #1E2D45', borderRadius: 8, padding: '14px 18px' },
  cardLabel: { fontSize: 10, color: '#3D4D65', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 },
  cardValue: { fontSize: 22, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1 },
  section: { display: 'flex', flexDirection: 'column', gap: 8 },
  sectionLabel: { fontSize: 10, color: '#3D4D65', textTransform: 'uppercase', letterSpacing: '0.1em' },
  graphWrap: { background: '#080D18', border: '1px solid #1E2D45', borderRadius: 8, padding: '14px 16px 10px' },
  liveLog: { background: '#080D18', border: '1px solid #1E2D45', borderRadius: 8, padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 260, overflowY: 'auto' },
  logRow: { display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, padding: '3px 0', borderBottom: '1px solid rgba(30,45,69,0.4)' },
  logSeq: { color: '#3D4D65', fontSize: 10, width: 36, flexShrink: 0 },
  placeholder: { textAlign: 'center', color: '#3D4D65', padding: '60px 0', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 },
  errorBanner: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'rgba(255,75,106,0.08)', border: '1px solid rgba(255,75,106,0.3)', borderRadius: 8, animation: 'fadeIn 0.2s ease' },
  errorBannerIcon: { fontSize: 16, color: '#FF4B6A', flexShrink: 0 },
  errorBannerMsg: { flex: 1, fontSize: 12, color: '#FF4B6A', fontFamily: 'JetBrains Mono, monospace' },
  errorBannerClose: { background: 'transparent', border: 'none', color: '#FF4B6A', cursor: 'pointer', fontSize: 14, padding: '0 4px', fontFamily: 'Inter, sans-serif' },
  clearBtn: { background: 'rgba(255,75,106,0.08)', border: '1px solid rgba(255,75,106,0.25)', color: '#FF4B6A', borderRadius: 6, padding: '6px 14px', fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' },
};
