import React, { useState, useRef, useCallback, useEffect } from 'react';
import { classifyLatency } from '../utils/latency';
import Instructions from './Instructions';

const isBrowser = !window.electronAPI;

// ── Default state — exported so App.js can initialise it ─────────────────────
export const defaultMultiPingState = {
  slots: [
    { id: 1, host: '' },
    { id: 2, host: '' },
  ],
  running: false,
  results: {},
};
const MAX_HISTORY = 20; // sparkline samples per host

const INSTRUCTIONS = {
  title: 'How to use Multi-Ping',
  items: [
    {
      label: 'Add up to 5 hosts to monitor simultaneously',
      detail: 'Enter a hostname or IP address in each slot. Click "+ Add Host" to add more slots up to a maximum of 5.',
      example: '192.168.1.1, 8.8.8.8, google.com',
    },
    {
      label: 'Press Start All to begin monitoring',
      detail: 'All hosts are pinged continuously and independently. Each card updates in real time as responses arrive.',
    },
    {
      label: 'Read the status cards',
      detail: 'Green means the host is responding. Red means it is down or not responding. Simple as that.',
    },
    {
      label: 'Use the sparkline for recent history',
      detail: 'The small bar chart on each card shows the last 20 ping results. Green bars are successful replies, red gaps are timeouts — giving you a quick visual history at a glance.',
    },
    {
      label: 'Monitor a reboot or failover',
      detail: 'Add all the devices you are watching, press Start All, then reboot your equipment. You can see exactly which devices come back online and when without switching windows.',
    },
  ],
  notes: 'Tip: A host showing red may still be partially reachable — some devices block ICMP ping while still passing other traffic. Use Traceroute to investigate further.',
};

let demoIntervals = {};

function makeDemoResult(host) {
  const down = Math.random() < 0.08;
  return {
    rtt: down ? null : parseFloat((5 + Math.random() * 60).toFixed(1)),
    timeout: down,
  };
}

export default function MultiPing({ state, setState }) {
  const slots   = state.slots;
  const running = state.running;
  const results = state.results;
  const nextId  = useRef(Math.max(...state.slots.map(s => s.id), 2) + 1);
  const procsRef = useRef({});

  function setSlots(fn)   { setState(prev => ({ ...prev, slots:   typeof fn === 'function' ? fn(prev.slots)   : fn })); }
  function setRunning(fn) { setState(prev => ({ ...prev, running: typeof fn === 'function' ? fn(prev.running) : fn })); }
  function setResults(fn) { setState(prev => ({ ...prev, results: typeof fn === 'function' ? fn(prev.results) : fn })); }

  // Clean up on unmount
  useEffect(() => {
    return () => stopAll(true);
  }, []);

  function addSlot() {
    if (slots.length >= 5) return;
    setSlots(prev => [...prev, { id: nextId.current++, host: '' }]);
  }

  function removeSlot(id) {
    stopHost(id);
    setSlots(prev => prev.filter(s => s.id !== id));
    setResults(prev => { const n = { ...prev }; delete n[id]; return n; });
  }

  function updateHost(id, value) {
    setSlots(prev => prev.map(s => s.id === id ? { ...s, host: value } : s));
  }

  // ── Per-host result updater ───────────────────────────────────────────────
  const addResult = useCallback((id, { rtt, timeout }) => {
    setResults(prev => {
      const existing = prev[id] || {
        history: [], sent: 0, lost: 0, lastSeen: null, consecutiveLost: 0,
      };
      const history = [...existing.history, { rtt, timeout, ts: Date.now() }];
      if (history.length > MAX_HISTORY) history.shift();

      const sent     = existing.sent + 1;
      const lost     = existing.lost + (timeout ? 1 : 0);
      const lastSeen = timeout ? existing.lastSeen : new Date().toLocaleTimeString();
      const consecLost = timeout ? existing.consecutiveLost + 1 : 0;

      // Status: down if any consecutive loss, up otherwise
      const status = consecLost >= 1 ? 'down' : 'up';

      return {
        ...prev,
        [id]: { history, sent, lost, lastSeen, consecutiveLost: consecLost, status, rtt },
      };
    });
  }, []);

  // ── Start a single host ───────────────────────────────────────────────────
  function startHost(id, host) {
    if (!host.trim()) return;

    if (isBrowser) {
      demoIntervals[id] = setInterval(() => {
        addResult(id, makeDemoResult(host));
      }, 1000 + Math.random() * 200);
      return;
    }

    window.electronAPI.startMultiPing({ slotId: id, host: host.trim() });
  }

  // ── Stop a single host ────────────────────────────────────────────────────
  function stopHost(id) {
    if (isBrowser) {
      clearInterval(demoIntervals[id]);
      delete demoIntervals[id];
      return;
    }
    window.electronAPI.stopMultiPing({ slotId: id });
  }

  // ── Start / stop all ─────────────────────────────────────────────────────
  function startAll() {
    const activeSlots = slots.filter(s => s.host.trim());
    if (activeSlots.length === 0) return;

    setResults({});
    setRunning(true);

    if (isBrowser) {
      activeSlots.forEach(s => {
        setTimeout(() => startHost(s.id, s.host), Math.random() * 300);
      });
      return;
    }

    // Wire up shared result listener — results include slotId to route correctly
    window.electronAPI.removeMultiPingListeners();
    window.electronAPI.onMultiPingResult(({ slotId, rtt, timeout, unreachable }) => {
      addResult(slotId, { rtt: rtt ?? null, timeout: !!timeout || !!unreachable });
    });

    activeSlots.forEach(s => startHost(s.id, s.host));
  }

  function stopAll(silent = false) {
    Object.keys(demoIntervals).forEach(id => {
      clearInterval(demoIntervals[id]);
      delete demoIntervals[id];
    });
    if (window.electronAPI) {
      window.electronAPI.stopMultiPing({ slotId: 'all' });
      window.electronAPI.removeMultiPingListeners();
    }
    procsRef.current = {};
    if (!silent) setRunning(false);
  }

  const activeSlots   = slots.filter(s => s.host.trim());
  const upCount   = activeSlots.filter(s => results[s.id]?.status === 'up').length;
  const downCount = activeSlots.filter(s => results[s.id]?.status === 'down').length;
  const hasAnyResults = Object.keys(results).length > 0;

  return (
    <div style={s.wrap}>
      <h2 style={s.title}>Multi-Ping</h2>
      <p style={s.sub}>Monitor up to 5 hosts simultaneously — see what's up and what's down at a glance</p>

      <Instructions {...INSTRUCTIONS} />

      {/* Global status bar */}
      {running && hasAnyResults && (
        <div style={s.globalBar}>
          <StatusPill count={upCount}   label="Up"   color="#00FF9C" />
          <StatusPill count={downCount} label="Down" color="#FF4B6A" />
          <div style={{ flex: 1 }} />
          <div style={s.globalPulse}>
            <span style={s.globalDot} />
            Monitoring {activeSlots.length} host{activeSlots.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Host input slots */}
      <div style={s.slotsWrap}>
        {slots.map((slot, idx) => (
          <div key={slot.id} style={s.slotRow}>
            <div style={s.slotNum}>{idx + 1}</div>
            <input
              style={{ ...s.slotInput, ...(running ? s.slotInputDisabled : {}) }}
              value={slot.host}
              onChange={e => updateHost(slot.id, e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !running && startAll()}
              placeholder="hostname or IP address"
              spellCheck={false}
              disabled={running}
            />
            {slots.length > 1 && !running && (
              <button style={s.removeBtn} onClick={() => removeSlot(slot.id)} title="Remove">✕</button>
            )}
          </div>
        ))}

        <div style={s.slotActions}>
          {slots.length < 5 && !running && (
            <button style={s.addBtn} onClick={addSlot}>+ Add Host</button>
          )}
          <div style={{ flex: 1 }} />
          {!running
            ? <button style={s.startBtn} onClick={startAll}
                disabled={activeSlots.length === 0}>
                ▶  Start All
              </button>
            : <button style={{ ...s.startBtn, ...s.stopBtn }} onClick={() => stopAll()}>
                ■  Stop All
              </button>
          }
        </div>
      </div>

      {/* Result cards */}
      {hasAnyResults && (
        <div style={s.cardsGrid}>
          {slots.filter(s => s.host.trim()).map(slot => (
            <HostCard
              key={slot.id}
              host={slot.host}
              data={results[slot.id]}
              running={running}
            />
          ))}
        </div>
      )}

      {!running && !hasAnyResults && (
        <div style={s.placeholder}>
          Enter hosts above and press Start All to begin monitoring
        </div>
      )}
    </div>
  );
}

// ── Host Card ─────────────────────────────────────────────────────────────────
function HostCard({ host, data, running }) {
  if (!data) {
    return (
      <div style={{ ...s.card, ...s.cardWaiting }}>
        <div style={s.cardHost}>{host}</div>
        <div style={s.cardWaitLabel}>
          <span style={s.waitSpinner} /> Waiting…
        </div>
      </div>
    );
  }

  const { status, rtt, history, sent, lost, lastSeen, consecutiveLost } = data;
  const loss = sent > 0 ? ((lost / sent) * 100).toFixed(1) : 0;
  const latInfo = rtt ? classifyLatency(rtt) : null;

  const cardColor = status === 'up'
    ? { border: 'rgba(0,255,156,0.3)', bg: 'rgba(0,255,156,0.04)', dot: '#00FF9C', text: '#00FF9C' }
    : { border: 'rgba(255,75,106,0.3)', bg: 'rgba(255,75,106,0.04)', dot: '#FF4B6A', text: '#FF4B6A' };

  const statusLabel = status === 'up' ? 'Responding' : 'Not Responding';

  return (
    <div style={{
      ...s.card,
      border: `1px solid ${cardColor.border}`,
      background: cardColor.bg,
    }}>
      {/* Card header */}
      <div style={s.cardHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ ...s.statusDot, background: cardColor.dot,
            boxShadow: `0 0 8px ${cardColor.dot}66`,
            animation: status === 'up' ? 'pulse-dot 2s ease-in-out infinite' : 'none',
            transition: 'background 0.3s, box-shadow 0.3s',
          }} />
          <span style={s.cardHost}>{host}</span>
        </div>
        <span style={{ ...s.statusLabel, color: cardColor.text }}>{statusLabel}</span>
      </div>

      {/* Main RTT display */}
      <div style={s.cardMain}>
        {status === 'down'
          ? <span style={{ fontSize: 32, fontWeight: 700, color: '#FF4B6A', fontFamily: 'JetBrains Mono, monospace' }}>✗ Down</span>
          : <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 32, fontWeight: 700, color: latInfo?.color || '#E8EDF5', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1 }}>
                {rtt != null ? rtt : '—'}
              </span>
              <span style={{ fontSize: 14, color: '#8892A4', fontFamily: 'JetBrains Mono, monospace' }}>ms</span>
              {latInfo && <span style={{ fontSize: 11, color: latInfo.color, fontWeight: 500, marginLeft: 4 }}>{latInfo.tier}</span>}
            </div>
        }
      </div>

      {/* Sparkline */}
      <Sparkline history={history} />

      {/* Footer stats */}
      <div style={s.cardFooter}>
        <div style={s.cardStat}>
          <span style={s.cardStatLabel}>Sent</span>
          <span style={s.cardStatVal}>{sent}</span>
        </div>
        <div style={s.cardStat}>
          <span style={s.cardStatLabel}>Lost</span>
          <span style={{ ...s.cardStatVal, color: lost > 0 ? '#FF4B6A' : '#8892A4' }}>{lost}</span>
        </div>
        <div style={s.cardStat}>
          <span style={s.cardStatLabel}>Loss</span>
          <span style={{ ...s.cardStatVal, color: parseFloat(loss) > 0 ? '#FF4B6A' : '#8892A4' }}>{loss}%</span>
        </div>
        <div style={s.cardStat}>
          <span style={s.cardStatLabel}>Last seen</span>
          <span style={s.cardStatVal}>{lastSeen || '—'}</span>
        </div>
      </div>
    </div>
  );
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ history }) {
  if (!history || history.length === 0) return null;
  const W = 260, H = 36, BAR_W = 10, GAP = 2;
  const validRtts = history.filter(h => !h.timeout && h.rtt != null).map(h => h.rtt);
  const maxRtt = validRtts.length ? Math.max(...validRtts, 1) : 100;

  return (
    <div style={s.sparkWrap}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
        {history.map((h, i) => {
          const x = i * (BAR_W + GAP);
          if (h.timeout) {
            return (
              <g key={i}>
                <rect x={x} y={0} width={BAR_W} height={H} fill="rgba(255,75,106,0.08)" rx="1" />
                <line x1={x + BAR_W / 2} y1={4} x2={x + BAR_W / 2} y2={H - 4}
                  stroke="#FF4B6A" strokeWidth="1.5" strokeDasharray="2 2" />
              </g>
            );
          }
          const barH = Math.max(3, (h.rtt / maxRtt) * (H - 4));
          const color = classifyLatency(h.rtt).color;
          return (
            <rect key={i} x={x} y={H - barH} width={BAR_W} height={barH}
              fill={color} opacity="0.7" rx="1" />
          );
        })}
      </svg>
      <div style={s.sparkLegend}>
        <span style={{ color: '#00FF9C', fontSize: 9 }}>▮ Reply</span>
        <span style={{ color: '#FF4B6A', fontSize: 9 }}>| Timeout</span>
      </div>
    </div>
  );
}

// ── Status Pill ───────────────────────────────────────────────────────────────
function StatusPill({ count, label, color }) {
  return (
    <div style={{ ...s.pill, borderColor: color + '44', background: color + '11' }}>
      <span style={{ ...s.pillCount, color }}>{count}</span>
      <span style={{ ...s.pillLabel, color }}>{label}</span>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 18, animation: 'fadeIn 0.2s ease' },
  title: { fontSize: 22, fontWeight: 600, color: '#E8EDF5', marginBottom: 4 },
  sub: { color: '#8892A4', fontSize: 13, marginBottom: 4 },

  globalBar: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: '#111827', border: '1px solid #1E2D45',
    borderRadius: 8, padding: '10px 16px',
  },
  pill: {
    display: 'flex', alignItems: 'center', gap: 6,
    border: '1px solid', borderRadius: 20, padding: '4px 12px',
  },
  pillCount: { fontSize: 16, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1 },
  pillLabel: { fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' },
  globalPulse: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#8892A4', fontFamily: 'JetBrains Mono, monospace' },
  globalDot: { width: 7, height: 7, borderRadius: '50%', background: '#00D4FF', display: 'inline-block', animation: 'pulse-dot 1.5s ease-in-out infinite' },

  slotsWrap: {
    background: '#111827', border: '1px solid #1E2D45',
    borderRadius: 8, padding: '16px 20px',
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  slotRow: { display: 'flex', alignItems: 'center', gap: 10 },
  slotNum: {
    width: 22, height: 22, borderRadius: '50%',
    background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)',
    color: '#00D4FF', fontSize: 11, fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  slotInput: {
    flex: 1, background: '#0D1525', border: '1px solid #1E2D45',
    borderRadius: 6, color: '#E8EDF5',
    fontFamily: 'JetBrains Mono, monospace', fontSize: 13,
    padding: '8px 12px', outline: 'none',
  },
  slotInputDisabled: { opacity: 0.6, cursor: 'not-allowed' },
  removeBtn: {
    background: 'transparent', border: 'none',
    color: '#3D4D65', cursor: 'pointer', fontSize: 13,
    padding: '4px 8px', borderRadius: 4,
    fontFamily: 'Inter, sans-serif',
  },
  slotActions: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 },
  addBtn: {
    background: 'transparent', border: '1px dashed #1E2D45',
    color: '#3D4D65', borderRadius: 6, padding: '6px 14px',
    fontSize: 12, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
  },
  startBtn: {
    background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)',
    color: '#00D4FF', borderRadius: 6, padding: '8px 24px',
    fontSize: 13, fontWeight: 500, cursor: 'pointer',
    fontFamily: 'Inter, sans-serif',
  },
  stopBtn: {
    background: 'rgba(255,75,106,0.1)', border: '1px solid rgba(255,75,106,0.3)',
    color: '#FF4B6A',
  },

  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 14,
  },
  card: {
    background: '#111827', border: '1px solid #1E2D45',
    borderRadius: 10, padding: '16px 18px',
    display: 'flex', flexDirection: 'column', gap: 12,
    animation: 'fadeIn 0.2s ease',
  },
  cardWaiting: { opacity: 0.6 },
  cardWaitLabel: {
    display: 'flex', alignItems: 'center', gap: 8,
    color: '#3D4D65', fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
  },
  waitSpinner: {
    width: 10, height: 10, borderRadius: '50%',
    border: '2px solid rgba(0,212,255,0.2)', borderTopColor: '#00D4FF',
    display: 'inline-block', animation: 'spin 0.8s linear infinite',
  },
  cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  statusDot: { width: 9, height: 9, borderRadius: '50%', flexShrink: 0 },
  cardHost: { fontSize: 14, fontWeight: 600, color: '#E8EDF5', fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 },
  statusLabel: { fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 },
  cardMain: { minHeight: 44, display: 'flex', alignItems: 'center' },

  sparkWrap: {
    background: '#080D18', borderRadius: 6,
    padding: '8px 10px 4px',
    border: '1px solid rgba(30,45,69,0.8)',
  },
  sparkLegend: { display: 'flex', gap: 10, marginTop: 4, paddingLeft: 2 },

  cardFooter: {
    display: 'flex', gap: 0,
    borderTop: '1px solid #1A2235', paddingTop: 10,
  },
  cardStat: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' },
  cardStatLabel: { fontSize: 9, color: '#3D4D65', textTransform: 'uppercase', letterSpacing: '0.08em' },
  cardStatVal: { fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: '#8892A4', fontWeight: 500 },

  placeholder: {
    textAlign: 'center', color: '#3D4D65',
    padding: '60px 0', fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
  },
};
