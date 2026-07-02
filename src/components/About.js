import React, { useState, useEffect } from 'react';

const isBrowser = !window.electronAPI;

// Single source of truth: injected at build time by vite.config.mjs's
// `define` config, which reads the version from package.json. This
// eliminates the class of bug where one of several hardcoded version
// strings gets missed on a release (has happened twice already).
const APP_VERSION = __APP_VERSION__;

const MODULES = [
  { icon: '◎', name: 'Ping',          desc: 'Fixed and continuous ping with live RTT graph and packet loss tracking' },
  { icon: '⊛', name: 'Multi-Ping',    desc: 'Monitor up to 5 hosts simultaneously — green when up, red when down' },
  { icon: '⤵', name: 'Traceroute',    desc: 'Live hop-by-hop path tracing with color-coded latency per hop' },
  { icon: '⊞', name: 'Subnet Sweep',  desc: 'Ping-sweep a range or CIDR subnet to discover live hosts — supports /16 to /30' },
  { icon: '⊟', name: 'Subnet Calc',   desc: 'Full CIDR breakdown with network, host range, and binary view' },
  { icon: '⊕', name: 'IP Info',       desc: 'Public IP, geolocation lookup, and WhoIs for any domain or IP' },
  { icon: '◈', name: 'DNS Lookup',    desc: 'Resolve A, AAAA, CNAME, MX, TXT, NS, PTR records using any DNS server' },
  { icon: '⊘', name: 'Port Scanner',  desc: 'TCP port scanner with common port presets and group selection' },
  { icon: '≋', name: 'Latency Guide', desc: 'Reference tiers and per-application latency thresholds' },
];

const LINKS = [
  { label: 'GitHub Repository', url: 'https://github.com/Proxy-IT/hana-network-utility' },
  { label: 'Latest Release',    url: 'https://github.com/Proxy-IT/hana-network-utility/releases/latest' },
  { label: 'Hana Website',      url: 'https://hana.proxy-it.co' },
  { label: 'Terms of Use',      url: 'https://github.com/Proxy-IT/hana-network-utility/blob/main/TERMS.md' },
  { label: 'Privacy Policy',    url: 'https://github.com/Proxy-IT/hana-network-utility/blob/main/PRIVACY.md' },
];

function openLink(url) {
  if (window.electronAPI?.openExternal) {
    window.electronAPI.openExternal(url);
  } else {
    window.open(url, '_blank');
  }
}

const REPO = 'https://github.com/Proxy-IT/hana-network-utility';

// Build a pre-filled GitHub issue URL using YAML issue-form field parameters.
// Issue forms let each field be populated by its `id` as a URL parameter, which
// avoids the template-vs-body conflict that plain markdown templates have.
// The `version` and `os` field ids match those defined in the .yml issue forms.
function buildIssueUrl(templateFile, fields) {
  const params = new URLSearchParams({ template: templateFile, ...fields });
  return `${REPO}/issues/new?${params.toString()}`;
}

function reportBug() {
  openLink(buildIssueUrl('bug_report.yml', {
    version: APP_VERSION,
    os:      getPlatform(),
  }));
}

function requestFeature() {
  openLink(buildIssueUrl('feature_request.yml', {
    version: APP_VERSION,
  }));
}

export default function About() {
  return (
    <div style={s.wrap}>

      {/* Hero */}
      <div style={s.hero}>
        <div style={s.logoWrap}>
          <img
            src="icon.png"
            alt="Hana"
            style={s.logoImg}
            onError={e => { e.target.style.display = 'none'; }}
          />
          <div style={s.logoPulse} />
        </div>
        <div style={s.heroText}>
          <h1 style={s.heroTitle}>Hana</h1>
          <p style={s.heroSub}>Network Utility</p>
          <div style={s.versionBadge}>v{APP_VERSION}</div>
        </div>
      </div>

      {/* Tagline */}
      <div style={s.tagline}>
        Fast, clean, and lightweight network diagnostics for Windows and Mac.
        No command prompt. No dependencies. No bloat.
      </div>

      {/* Modules */}
      <div style={s.section}>
        <div style={s.sectionLabel}>MODULES</div>
        <div style={s.moduleGrid}>
          {MODULES.map(m => (
            <div key={m.name} style={s.moduleRow}>
              <span style={s.moduleIcon}>{m.icon}</span>
              <div style={s.moduleBody}>
                <span style={s.moduleName}>{m.name}</span>
                <span style={s.moduleDesc}>{m.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Feedback */}
      <div style={s.section}>
        <div style={s.sectionLabel}>FEEDBACK</div>
        <div style={s.feedbackRow}>
          <button style={s.feedbackBtn} onClick={reportBug}>
            <span style={s.feedbackIcon}>🐛</span>
            <div style={s.feedbackText}>
              <span style={s.feedbackTitle}>Report a Bug</span>
              <span style={s.feedbackSub}>Something not working? Let us know.</span>
            </div>
          </button>
          <button style={s.feedbackBtn} onClick={requestFeature}>
            <span style={s.feedbackIcon}>💡</span>
            <div style={s.feedbackText}>
              <span style={s.feedbackTitle}>Request a Feature</span>
              <span style={s.feedbackSub}>Have an idea? We'd love to hear it.</span>
            </div>
          </button>
        </div>
      </div>

      {/* Updates */}
      <UpdatesSection />

      {/* Two column — Links + Details */}
      <div style={s.twoCol}>

        {/* Links */}
        <div style={s.section}>
          <div style={s.sectionLabel}>LINKS</div>
          <div style={s.linkCard}>
            {LINKS.map(l => (
              <button key={l.label} style={s.linkRow} onClick={() => openLink(l.url)}>
                <span style={s.linkLabel}>{l.label}</span>
                <span style={s.linkArrow}>↗</span>
              </button>
            ))}
          </div>
        </div>

        {/* Details */}
        <div style={s.section}>
          <div style={s.sectionLabel}>DETAILS</div>
          <div style={s.detailCard}>
            <DetailRow label="Version"   value={APP_VERSION} />
            <DetailRow label="Platform"  value={getPlatform()} />
            <DetailRow label="License"   value="GPL v3.0" />
            <DetailRow label="Author"    value="Proxy-IT" />
            <DetailRow label="Built with" value="Electron + React" />
            <DetailRow label="Released"  value="2026" />
          </div>
        </div>

      </div>

      {/* Privacy note */}
      <div style={s.privacyNote}>
        <span style={s.privacyIcon}>🔒</span>
        <span>
          Hana collects no data, no telemetry, and makes no background network
          connections. Outbound requests are made only when you explicitly
          trigger them within the app. The "check for updates on startup"
          option above is a toggle you must turn on yourself — it ships
          off by default, and Hana never checks for updates on its own
          unless you enable it.
        </span>
      </div>

      {/* Footer */}
      <div style={s.footer}>
        <span>A free tool by Proxy-IT LLC</span>
      </div>

    </div>
  );
}

// ── Updates ─────────────────────────────────────────────────────────────────
// Manual "Check for Updates" plus an opt-in "check on startup" toggle. Nothing
// here reaches the network unless the user clicks Check or has opted in — the
// app's privacy promise is that outbound requests only happen on explicit action.
function UpdatesSection() {
  const [supported, setSupported]   = useState(false);
  const [version, setVersion]       = useState('');
  const [autoCheck, setAutoCheck]   = useState(false);
  const [status, setStatus]         = useState('idle'); // idle|checking|available|downloading|downloaded|uptodate|error
  const [available, setAvailable]   = useState(null);   // { version }
  const [progress, setProgress]     = useState(0);
  const [error, setError]           = useState(null);

  useEffect(() => {
    if (isBrowser) return;
    const api = window.electronAPI;
    api.getUpdateState().then(st => {
      setSupported(st.supported);
      setVersion(st.currentVersion);
      setAutoCheck(st.autoCheckOnStartup);
    }).catch(() => {});

    api.onUpdateChecking(() => { setStatus('checking'); setError(null); });
    api.onUpdateAvailable(info => { setStatus('available'); setAvailable(info); });
    api.onUpdateNotAvailable(() => setStatus('uptodate'));
    api.onUpdateProgress(p => { setStatus('downloading'); setProgress(Math.round(p.percent || 0)); });
    api.onUpdateDownloaded(info => { setStatus('downloaded'); setAvailable(info); });
    api.onUpdateError(e => { setStatus('error'); setError(e.message); });

    return () => api.removeUpdateListeners();
  }, []);

  function toggleAuto() {
    if (isBrowser) return;
    const next = !autoCheck;
    setAutoCheck(next);
    window.electronAPI.setUpdateAutoCheck(next);
  }

  const busy = status === 'checking' || status === 'downloading';

  return (
    <div style={s.section}>
      <div style={s.sectionLabel}>UPDATES</div>
      <div style={us.card}>
        <div style={us.topRow}>
          <div style={us.verBlock}>
            <span style={us.verLabel}>Current version</span>
            <span style={us.verValue}>v{version || (isBrowser ? '—' : '…')}</span>
          </div>
          {status === 'available' ? (
            <button style={us.primaryBtn} onClick={() => window.electronAPI.downloadUpdate()}>
              ↓  Download v{available?.version}
            </button>
          ) : status === 'downloaded' ? (
            <button style={us.primaryBtn} onClick={() => window.electronAPI.installUpdate()}>
              ⟳  Install &amp; Restart
            </button>
          ) : (
            <button
              style={{ ...us.checkBtn, ...((!supported || busy) ? us.btnOff : {}) }}
              onClick={() => !busy && supported && window.electronAPI.checkForUpdate()}
              disabled={!supported || busy}>
              {status === 'checking' ? <><span style={us.spinner} /> Checking…</> : '⟳  Check for Updates'}
            </button>
          )}
        </div>

        {/* Status line */}
        {!supported && (
          <div style={us.note}>Updates are available in the installed app.</div>
        )}
        {supported && status === 'uptodate' && (
          <div style={{ ...us.note, color: '#00FF9C' }}>✓ You're on the latest version.</div>
        )}
        {supported && status === 'available' && (
          <div style={us.note}>
            Version <strong style={{ color: '#E8EDF5' }}>v{available?.version}</strong> is available.{' '}
            <button style={us.linkBtn} onClick={() => openLink(`${REPO}/releases/latest`)}>View release notes ↗</button>
          </div>
        )}
        {supported && status === 'downloading' && (
          <div style={us.progressWrap}>
            <div style={us.progressTrack}><div style={{ ...us.progressFill, width: `${progress}%` }} /></div>
            <span style={us.progressPct}>{progress}%</span>
          </div>
        )}
        {supported && status === 'downloaded' && (
          <div style={{ ...us.note, color: '#00FF9C' }}>
            ✓ Version v{available?.version} downloaded — restart to finish installing.
          </div>
        )}
        {supported && status === 'error' && (
          <div style={{ ...us.note, color: '#FF4B6A' }}>⚠ {error || 'Update check failed.'}</div>
        )}

        {/* Opt-in auto-check — ships unchecked; Hana never checks on its own unless enabled here */}
        {supported && (
          <div>
            <label style={us.autoRow}>
              <input type="checkbox" checked={autoCheck} onChange={toggleAuto} style={{ accentColor: '#00D4FF', cursor: 'pointer' }} />
              <span style={us.autoText}>Automatically check for updates on startup</span>
            </label>
            <div style={us.autoHint}>Off by default. Hana only checks for updates when you ask it to, unless you turn this on.</div>
          </div>
        )}
      </div>
    </div>
  );
}

const us = {
  card: { background: '#111827', border: '1px solid #1E2D45', borderRadius: 8, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 },
  topRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' },
  verBlock: { display: 'flex', flexDirection: 'column', gap: 3 },
  verLabel: { fontSize: 10, color: '#3D4D65', textTransform: 'uppercase', letterSpacing: '0.1em' },
  verValue: { fontSize: 18, fontWeight: 600, color: '#E8EDF5', fontFamily: 'JetBrains Mono, monospace' },
  checkBtn: { background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)', color: '#00D4FF', borderRadius: 6, padding: '8px 18px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 },
  primaryBtn: { background: 'rgba(0,255,156,0.12)', border: '1px solid rgba(0,255,156,0.35)', color: '#00FF9C', borderRadius: 6, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' },
  btnOff: { opacity: 0.4, cursor: 'not-allowed' },
  spinner: { width: 10, height: 10, borderRadius: '50%', border: '2px solid rgba(0,212,255,0.3)', borderTopColor: '#00D4FF', display: 'inline-block', animation: 'spin 0.7s linear infinite' },
  note: { fontSize: 12, color: '#8892A4', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.6 },
  linkBtn: { background: 'transparent', border: 'none', color: '#00D4FF', cursor: 'pointer', fontSize: 12, padding: 0, fontFamily: 'JetBrains Mono, monospace' },
  progressWrap: { display: 'flex', alignItems: 'center', gap: 12 },
  progressTrack: { flex: 1, height: 4, background: '#1A2235', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', background: '#00D4FF', borderRadius: 2, transition: 'width 0.2s ease', boxShadow: '0 0 8px rgba(0,212,255,0.4)' },
  progressPct: { fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#8892A4', width: 36, textAlign: 'right' },
  autoRow: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', borderTop: '1px solid rgba(30,45,69,0.5)', paddingTop: 12 },
  autoText: { fontSize: 12, color: '#8892A4' },
  autoHint: { fontSize: 11, color: '#3D4D65', marginTop: 4, marginLeft: 24 },
};

function DetailRow({ label, value }) {
  return (
    <div style={s.detailRow}>
      <span style={s.detailLabel}>{label}</span>
      <span style={s.detailValue}>{value}</span>
    </div>
  );
}

function getPlatform() {
  const p = navigator.platform || '';
  if (p.includes('Mac'))   return 'macOS';
  if (p.includes('Win'))   return 'Windows';
  if (p.includes('Linux')) return 'Linux';
  return p || 'Unknown';
}

const s = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 24, animation: 'fadeIn 0.2s ease' },

  hero: {
    display: 'flex', alignItems: 'center', gap: 24,
    background: '#111827', border: '1px solid #1E2D45',
    borderRadius: 12, padding: '24px 28px',
  },
  logoWrap: {
    position: 'relative', width: 90, height: 90,
    flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  logoImg: {
    width: 80, height: 80, borderRadius: '50%',
    objectFit: 'cover', border: '2px solid rgba(0,212,255,0.2)',
    position: 'relative', zIndex: 1,
  },
  logoPulse: {
    position: 'absolute', inset: 0, borderRadius: '50%',
    border: '2px solid #00D4FF',
    animation: 'pulse-ring 2.5s ease-out infinite',
  },
  heroText: { display: 'flex', flexDirection: 'column', gap: 4 },
  heroTitle: {
    fontSize: 36, fontWeight: 700, color: '#E8EDF5',
    letterSpacing: '-0.03em', lineHeight: 1, margin: 0,
  },
  heroSub: { fontSize: 13, color: '#8892A4', margin: 0 },
  versionBadge: {
    display: 'inline-block',
    background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.25)',
    color: '#00D4FF', borderRadius: 20, padding: '3px 12px',
    fontSize: 11, fontFamily: 'JetBrains Mono, monospace', fontWeight: 500,
    marginTop: 4, alignSelf: 'flex-start',
  },

  tagline: {
    fontSize: 13, color: '#8892A4', lineHeight: 1.7,
    padding: '14px 18px', background: '#080D18',
    border: '1px solid #1E2D45', borderRadius: 8,
    fontStyle: 'italic',
  },

  section: { display: 'flex', flexDirection: 'column', gap: 10 },
  sectionLabel: {
    fontSize: 10, color: '#3D4D65', textTransform: 'uppercase',
    letterSpacing: '0.1em', fontWeight: 500,
  },

  moduleGrid: {
    background: '#111827', border: '1px solid #1E2D45',
    borderRadius: 8, overflow: 'hidden',
  },
  moduleRow: {
    display: 'flex', alignItems: 'flex-start', gap: 14,
    padding: '10px 16px', borderBottom: '1px solid rgba(30,45,69,0.5)',
  },
  moduleIcon: { fontSize: 16, color: '#00D4FF', flexShrink: 0, marginTop: 1, width: 18, textAlign: 'center' },
  moduleBody: { display: 'flex', flexDirection: 'column', gap: 2 },
  moduleName: { fontSize: 12, fontWeight: 600, color: '#E8EDF5' },
  moduleDesc: { fontSize: 11, color: '#8892A4', lineHeight: 1.5 },

  twoCol: { display: 'flex', gap: 16 },

  linkCard: {
    background: '#111827', border: '1px solid #1E2D45',
    borderRadius: 8, overflow: 'hidden', flex: 1,
  },
  linkRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 16px',
    background: 'transparent', border: 'none',
    borderBottom: '1px solid rgba(30,45,69,0.5)',
    cursor: 'pointer', width: '100%', textAlign: 'left',
    color: '#00D4FF', fontFamily: 'Inter, sans-serif',
  },
  linkLabel: { fontSize: 12, color: '#00D4FF' },
  linkArrow: { fontSize: 12, color: '#3D4D65' },

  detailCard: {
    background: '#111827', border: '1px solid #1E2D45',
    borderRadius: 8, overflow: 'hidden',
  },
  detailRow: {
    display: 'flex', justifyContent: 'space-between',
    padding: '9px 16px', borderBottom: '1px solid rgba(30,45,69,0.5)',
  },
  detailLabel: { fontSize: 11, color: '#3D4D65' },
  detailValue: { fontSize: 11, color: '#E8EDF5', fontFamily: 'JetBrains Mono, monospace' },

  privacyNote: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    padding: '12px 16px',
    background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.15)',
    borderRadius: 8, fontSize: 11, color: '#8892A4', lineHeight: 1.6,
  },
  privacyIcon: { fontSize: 14, flexShrink: 0 },

  footer: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 8, fontSize: 11, color: '#3D4D65', fontStyle: 'italic',
    paddingTop: 4,
  },

  feedbackRow: { display: 'flex', gap: 12 },
  feedbackBtn: {
    display: 'flex', alignItems: 'center', gap: 14, flex: 1,
    padding: '14px 18px', textAlign: 'left',
    background: '#111827', border: '1px solid #1E2D45',
    borderRadius: 8, cursor: 'pointer',
    fontFamily: 'Inter, sans-serif',
    transition: 'border-color 0.15s, background 0.15s',
  },
  feedbackIcon: { fontSize: 22, flexShrink: 0 },
  feedbackText: { display: 'flex', flexDirection: 'column', gap: 2 },
  feedbackTitle: { fontSize: 13, fontWeight: 600, color: '#E8EDF5' },
  feedbackSub: { fontSize: 11, color: '#8892A4' },
};
