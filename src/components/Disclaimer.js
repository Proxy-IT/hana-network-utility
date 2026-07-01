import React, { useState } from 'react';

/**
 * First-launch disclaimer modal.
 * Shows once, stores acceptance in localStorage.
 * Parent checks hasAccepted() before rendering the app.
 */

const STORAGE_KEY = 'hana_terms_accepted_v1';

export function hasAccepted() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markAccepted() {
  try {
    localStorage.setItem(STORAGE_KEY, 'true');
  } catch {}
}

export default function Disclaimer({ onAccept }) {
  const [checked, setChecked] = useState(false);

  function handleAccept() {
    if (!checked) return;
    markAccepted();
    onAccept();
  }

  return (
    <div style={s.overlay}>
      <div style={s.modal}>

        {/* Logo area */}
        <div style={s.logoWrap}>
          <div style={s.logoCircle}>
            <img
              src="icon.png"
              alt="Hana"
              style={s.logoImg}
              onError={e => { e.target.style.display = 'none'; }}
            />
            <span style={s.logoPulse} />
          </div>
        </div>

        {/* Title */}
        <div style={s.titleWrap}>
          <h1 style={s.title}>Hana</h1>
          <p style={s.subtitle}>Network Utility · v1.7.2</p>
        </div>

        {/* Disclaimer text */}
        <div style={s.body}>
          <div style={s.section}>
            <div style={s.sectionTitle}>⚠ Acceptable Use</div>
            <p style={s.text}>
              Hana is a network diagnostic tool intended exclusively for use on
              networks you own or have explicit written permission to test.
              Unauthorized network scanning, probing, or reconnaissance is
              illegal in most jurisdictions and may result in criminal prosecution.
            </p>
          </div>

          <div style={s.section}>
            <div style={s.sectionTitle}>🔒 Privacy</div>
            <p style={s.text}>
              Hana collects no personal data, telemetry, or usage information
              of any kind. Outbound network requests are made only when you
              explicitly trigger them within the app.
            </p>
          </div>

          <div style={s.section}>
            <div style={s.sectionTitle}>⚖ Liability</div>
            <p style={s.text}>
              This software is provided "as is" without warranty of any kind.
              The developer accepts no liability for damages arising from
              use or misuse of this tool.
            </p>
          </div>
        </div>

        {/* Checkbox */}
        <label style={s.checkLabel}>
          <input
            type="checkbox"
            checked={checked}
            onChange={e => setChecked(e.target.checked)}
            style={s.checkbox}
          />
          <span style={s.checkText}>
            I understand and agree to use Hana only on networks I own or
            have permission to test
          </span>
        </label>

        {/* Buttons */}
        <div style={s.btnRow}>
          <button
            style={{ ...s.btn, ...(checked ? s.btnActive : s.btnDisabled) }}
            onClick={handleAccept}
            disabled={!checked}
          >
            Accept & Continue
          </button>
        </div>

        <p style={s.footer}>
          Full terms at{' '}
          <span
            style={s.link}
            onClick={() => window.open && window.open('https://github.com/Proxy-IT/hana-network-utility/blob/main/TERMS.md')}
          >
            TERMS.md
          </span>
        </p>

      </div>
    </div>
  );
}

const s = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(5, 8, 18, 0.96)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 9999,
    animation: 'fadeIn 0.3s ease',
  },
  modal: {
    background: '#111827',
    border: '1px solid #1E2D45',
    borderRadius: 14,
    padding: '36px 40px',
    maxWidth: 520,
    width: '90%',
    display: 'flex', flexDirection: 'column', gap: 20,
    boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
  },
  logoWrap: { display: 'flex', justifyContent: 'center' },
  logoCircle: {
    width: 80, height: 80, borderRadius: '50%',
    border: '2px solid rgba(0,212,255,0.3)',
    background: '#0D1525',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    position: 'relative', overflow: 'hidden',
  },
  logoImg: { width: 60, height: 60, objectFit: 'contain', borderRadius: '50%' },
  logoPulse: {
    position: 'absolute', inset: 0,
    borderRadius: '50%',
    border: '2px solid #00D4FF',
    animation: 'pulse-ring 2s ease-out infinite',
  },
  titleWrap: { textAlign: 'center' },
  title: {
    fontSize: 28, fontWeight: 700, color: '#E8EDF5',
    letterSpacing: '-0.02em', marginBottom: 4,
  },
  subtitle: { fontSize: 12, color: '#3D4D65', fontFamily: 'JetBrains Mono, monospace' },
  body: {
    background: '#0D1525', border: '1px solid #1E2D45',
    borderRadius: 8, padding: '18px 20px',
    display: 'flex', flexDirection: 'column', gap: 14,
    maxHeight: 220, overflowY: 'auto',
  },
  section: { display: 'flex', flexDirection: 'column', gap: 6 },
  sectionTitle: {
    fontSize: 11, fontWeight: 600, color: '#00D4FF',
    textTransform: 'uppercase', letterSpacing: '0.08em',
  },
  text: { fontSize: 12, color: '#8892A4', lineHeight: 1.7 },
  checkLabel: {
    display: 'flex', alignItems: 'flex-start', gap: 12,
    cursor: 'pointer',
  },
  checkbox: { marginTop: 2, accentColor: '#00D4FF', flexShrink: 0, cursor: 'pointer' },
  checkText: { fontSize: 12, color: '#E8EDF5', lineHeight: 1.6 },
  btnRow: { display: 'flex', justifyContent: 'center' },
  btn: {
    padding: '11px 40px', borderRadius: 8,
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
    fontFamily: 'Inter, sans-serif', border: 'none',
    transition: 'all 0.15s',
  },
  btnActive: {
    background: 'rgba(0,212,255,0.15)',
    border: '1px solid rgba(0,212,255,0.4)',
    color: '#00D4FF',
    boxShadow: '0 0 20px rgba(0,212,255,0.15)',
  },
  btnDisabled: {
    background: '#1A2235', color: '#3D4D65',
    cursor: 'not-allowed', border: '1px solid #1E2D45',
  },
  footer: { textAlign: 'center', fontSize: 10, color: '#3D4D65' },
  link: { color: '#00D4FF', cursor: 'pointer', textDecoration: 'underline' },
};
