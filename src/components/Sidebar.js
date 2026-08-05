import React from 'react';

// Grouped so an eleven-item list reads as four short ones. Three of these
// modules have "Ping" in the name and a new user can't tell them apart from a
// flat list; the headers give them a shared context instead.
//
// Subnet Sweep and Subnet Calc are deliberately in DIFFERENT groups — they
// were adjacent and near-identically named, which is the other pair people
// confuse. One scans a range, the other does arithmetic.
const TAB_GROUPS = [
  {
    title: 'Connectivity',
    tabs: [
      { id: 'ping',      label: 'Ping',          icon: '◎' },
      { id: 'multiping', label: 'Multi-Ping',    icon: '⊛' },
      { id: 'tcpping',   label: 'TCP Ping',      icon: '⇄' },
      { id: 'tracert',   label: 'Traceroute',    icon: '⤵' },
    ],
  },
  {
    title: 'Discovery',
    tabs: [
      { id: 'ports',     label: 'Port Scanner',  icon: '⊘' },
      { id: 'sweep',     label: 'Subnet Sweep',  icon: '⊞' },
    ],
  },
  {
    title: 'Lookup',
    tabs: [
      { id: 'dns',       label: 'DNS Lookup',    icon: '◈' },
      { id: 'ipinfo',    label: 'IP Info',       icon: '⊕' },
    ],
  },
  {
    title: 'Reference',
    tabs: [
      { id: 'subnet',    label: 'Subnet Calc',   icon: '⊟' },
      { id: 'latency',   label: 'Latency Guide', icon: '≋' },
      { id: 'links',     label: "Hana's Favs",   icon: '↗' },
    ],
  },
];

export default function Sidebar({ active, onSelect, sysInfo }) {
  const [imgError, setImgError] = React.useState(false);

  return (
    <aside style={s.sidebar}>
      {/* Brand */}
      <div style={s.brand}>
        <div style={s.logoWrap}>
          {!imgError ? (
            <img
              src="icon.png"
              alt="Hana"
              style={s.logoImg}
              onError={() => setImgError(true)}
            />
          ) : (
            // Fallback pulse dot if no icon yet
            <div style={s.logoFallback}>
              <span style={s.pulseRing} />
              <span style={s.pulseDot} />
            </div>
          )}
        </div>
        <div style={s.brandText}>
          <div style={s.brandName}>Hana</div>
          <div style={s.brandSub}>Network Utility</div>
        </div>
      </div>

      <div style={s.divider} />

      {/* Nav */}
      <nav style={s.nav}>
        {TAB_GROUPS.map(group => (
          <React.Fragment key={group.title}>
            <div style={s.navGroupLabel}>{group.title}</div>
            {group.tabs.map(tab => (
              <button key={tab.id}
                style={{ ...s.navItem, ...(active === tab.id ? s.navItemActive : {}) }}
                onClick={() => onSelect(tab.id)}>
                <span style={s.navIcon}>{tab.icon}</span>
                <span style={s.navLabel}>{tab.label}</span>
                {active === tab.id && <span style={s.navIndicator} />}
              </button>
            ))}
          </React.Fragment>
        ))}
      </nav>

      {/* Bottom */}
      <div style={s.bottom}>
        <div style={s.divider} />

        {/* About link */}
        <button
          style={{ ...s.navItem, ...s.aboutBtn, ...(active === 'about' ? s.navItemActive : {}) }}
          onClick={() => onSelect('about')}>
          <span style={s.navIcon}>ℹ</span>
          <span style={s.navLabel}>About</span>
          {active === 'about' && <span style={s.navIndicator} />}
        </button>

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
          <span style={s.versionNum}>v{__APP_VERSION__}</span>
        </div>
      </div>
    </aside>
  );
}

const s = {
  sidebar: { width: 210, minWidth: 210, background: '#0D1525', borderRight: '1px solid #1E2D45', display: 'flex', flexDirection: 'column', userSelect: 'none', WebkitAppRegion: 'drag' },
  brand: { display: 'flex', alignItems: 'center', gap: 12, padding: '18px 16px 16px', WebkitAppRegion: 'drag' },

  logoWrap: { width: 38, height: 38, flexShrink: 0, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  logoImg: { width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid rgba(0,212,255,0.3)', position: 'relative', zIndex: 1 },
  logoFallback: { position: 'relative', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  pulseRing: { position: 'absolute', width: 24, height: 24, borderRadius: '50%', border: '1.5px solid #00D4FF', animation: 'pulse-ring 2s ease-out infinite' },
  pulseDot: { width: 9, height: 9, borderRadius: '50%', background: '#00D4FF', boxShadow: '0 0 8px rgba(0,212,255,0.6)', animation: 'pulse-dot 2s ease-in-out infinite', zIndex: 1 },

  brandText: { display: 'flex', flexDirection: 'column', gap: 2 },
  brandName: { fontSize: 16, fontWeight: 600, color: '#E8EDF5', letterSpacing: '-0.02em', lineHeight: 1 },
  brandSub: { fontSize: 9, color: '#3D4D65', textTransform: 'uppercase', letterSpacing: '0.1em', lineHeight: 1 },

  divider: { height: 1, background: '#1E2D45', margin: '0 14px' },
  // minHeight/overflowY guard against the group headers pushing the lower
  // items — and the About button below the nav — out of reach on a short window.
  nav: { flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: '10px 8px', gap: 2, WebkitAppRegion: 'no-drag' },
  // Matches the app's canonical small-uppercase label (brandSub, sysLabel, and
  // every module's field/section labels).
  navGroupLabel: { fontSize: 10, color: '#3D4D65', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 500, padding: '10px 10px 4px' },

  navItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 6, border: 'none', background: 'transparent', color: '#8892A4', cursor: 'pointer', fontSize: 13, fontFamily: 'Inter, sans-serif', textAlign: 'left', position: 'relative', WebkitAppRegion: 'no-drag', transition: 'all 0.15s ease' },
  navItemActive: { background: 'rgba(0,212,255,0.08)', color: '#00D4FF', fontWeight: 500 },
  navIcon: { fontSize: 15, width: 18, textAlign: 'center', flexShrink: 0 },
  navLabel: { flex: 1 },
  navIndicator: { width: 3, height: 16, background: '#00D4FF', borderRadius: 2, position: 'absolute', right: 6, boxShadow: '0 0 8px rgba(0,212,255,0.5)' },

  aboutBtn: { margin: '6px 8px 4px' },

  bottom: { paddingBottom: 16 },
  sysBlock: { padding: '8px 0 4px' },
  sysRow: { display: 'flex', justifyContent: 'space-between', padding: '3px 18px', fontSize: 11 },
  sysLabel: { color: '#3D4D65', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 500 },
  sysVal: { color: '#8892A4', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis' },
  versionRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 18px 0' },
  versionName: { fontSize: 10, color: '#3D4D65', fontStyle: 'italic', letterSpacing: '0.03em' },
  versionNum: { fontSize: 10, color: '#3D4D65', fontFamily: 'JetBrains Mono, monospace' },
};
