import React from 'react';

const TABS = [
  { id: 'ping',    label: 'Ping',          icon: '◎' },
  { id: 'tracert', label: 'Traceroute',    icon: '⤵' },
  { id: 'sweep',   label: 'Subnet Sweep',  icon: '⊞' },
  { id: 'subnet',  label: 'Subnet Calc',   icon: '⊟' },
  { id: 'latency', label: 'Latency Guide', icon: '≋' },
];

export default function Sidebar({ active, onSelect, sysInfo }) {
  return (
    <aside style={s.sidebar}>
      <div style={s.brand}>
        <div style={s.logoWrap}>
          <div style={s.logoOuter}>
            <span style={s.pulseRing} />
            <span style={s.pulseDot} />
          </div>
        </div>
        <div style={s.brandText}>
          <div style={s.brandName}>Hana</div>
          <div style={s.brandSub}>Network Utility</div>
        </div>
      </div>

      <div style={s.divider} />

      <nav style={s.nav}>
        {TABS.map(tab => (
          <button key={tab.id}
            style={{ ...s.navItem, ...(active === tab.id ? s.navItemActive : {}) }}
            onClick={() => onSelect(tab.id)}>
            <span style={s.navIcon}>{tab.icon}</span>
            <span style={s.navLabel}>{tab.label}</span>
            {active === tab.id && <span style={s.navIndicator} />}
          </button>
        ))}
      </nav>

      <div style={s.bottom}>
        <div style={s.divider} />
        {sysInfo && (
          <div style={s.sysBlock}>
            <div style={s.sysRow}>
              <span style={s.sysLabel}>HOST</span>
              <span style={s.sysVal}>{sysInfo.hostname}</span>
            </div>
            <div style={s.sysRow}>
              <span style={s.sysLabel}>OS</span>
              <span style={s.sysVal}>{sysInfo.platform}</span>
            </div>
          </div>
        )}
        <div style={s.versionRow}>
          <span style={s.versionName}>Hana</span>
          <span style={s.versionNum}>v1.2.0</span>
        </div>
      </div>
    </aside>
  );
}

const s = {
  sidebar: {
    width: 210, minWidth: 210,
    background: '#0D1525',
    borderRight: '1px solid #1E2D45',
    display: 'flex', flexDirection: 'column',
    userSelect: 'none',
    WebkitAppRegion: 'drag',
  },
  brand: {
    display: 'flex', alignItems: 'center', gap: 14,
    padding: '22px 18px 18px',
    WebkitAppRegion: 'drag',
  },
  logoWrap: {
    position: 'relative', width: 28, height: 28,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  logoOuter: {
    position: 'relative', width: 24, height: 24,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute', width: 20, height: 20,
    borderRadius: '50%',
    border: '1.5px solid #00D4FF',
    animation: 'pulse-ring 2s ease-out infinite',
  },
  pulseDot: {
    width: 8, height: 8, borderRadius: '50%',
    background: '#00D4FF',
    boxShadow: '0 0 8px rgba(0,212,255,0.6)',
    animation: 'pulse-dot 2s ease-in-out infinite',
    zIndex: 1,
  },
  brandText: { display: 'flex', flexDirection: 'column', gap: 2 },
  brandName: {
    fontSize: 18, fontWeight: 600,
    color: '#E8EDF5', letterSpacing: '-0.02em',
    lineHeight: 1,
  },
  brandSub: {
    fontSize: 9, color: '#3D4D65',
    textTransform: 'uppercase', letterSpacing: '0.1em',
    lineHeight: 1,
  },
  divider: { height: 1, background: '#1E2D45', margin: '0 16px' },
  nav: {
    flex: 1, display: 'flex', flexDirection: 'column',
    padding: '12px 10px', gap: 2,
    WebkitAppRegion: 'no-drag',
  },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '9px 10px', borderRadius: 6,
    border: 'none', background: 'transparent',
    color: '#8892A4', cursor: 'pointer',
    fontSize: 13, fontFamily: 'Inter, sans-serif',
    textAlign: 'left', position: 'relative',
    WebkitAppRegion: 'no-drag',
    transition: 'all 0.15s ease',
  },
  navItemActive: {
    background: 'rgba(0,212,255,0.08)',
    color: '#00D4FF', fontWeight: 500,
  },
  navIcon: { fontSize: 15, width: 18, textAlign: 'center', flexShrink: 0 },
  navLabel: { flex: 1 },
  navIndicator: {
    width: 3, height: 16, background: '#00D4FF',
    borderRadius: 2, position: 'absolute', right: 6,
    boxShadow: '0 0 8px rgba(0,212,255,0.5)',
  },
  bottom: { padding: '12px 0 16px' },
  sysBlock: { padding: '10px 0 6px' },
  sysRow: {
    display: 'flex', justifyContent: 'space-between',
    padding: '3px 20px', fontSize: 11,
  },
  sysLabel: {
    color: '#3D4D65', textTransform: 'uppercase',
    letterSpacing: '0.07em', fontWeight: 500,
  },
  sysVal: {
    color: '#8892A4',
    fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
    maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis',
  },
  versionRow: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', padding: '8px 20px 0',
  },
  versionName: {
    fontSize: 10, color: '#3D4D65',
    fontStyle: 'italic', letterSpacing: '0.03em',
  },
  versionNum: {
    fontSize: 10, color: '#3D4D65',
    fontFamily: 'JetBrains Mono, monospace',
  },
};
