import React from 'react';
import Instructions from './Instructions';
import { openLink } from '../utils/openLink';
import { LINK_CATEGORIES } from '../utils/usefulLinks';

const INSTRUCTIONS = {
  title: "How to use Hana's Favs",
  items: [
    { label: 'Browse by category', detail: 'Tools are grouped by what they help you check — SSL/TLS, MAC addresses, BGP routing, availability/performance, and security.' },
    { label: 'Click a card to open it', detail: 'Each link opens in your default web browser, not inside Hana — the domain shown on each card is where you\'ll land.' },
    { label: 'These are third-party sites', detail: 'Hana does not operate, control, or send any data to these services. They are independent tools, credited to their operators below.' },
  ],
  notes: 'Hana only opens a link when you click it — nothing here is fetched or contacted automatically.',
};

export default function UsefulLinks() {
  return (
    <div style={s.wrap}>
      <h2 style={s.title}>Hana's Favs</h2>
      <p style={s.sub}>Free, well-known tools for network and security diagnostics — credited to their operators</p>

      <Instructions {...INSTRUCTIONS} />

      {LINK_CATEGORIES.map(group => (
        <div key={group.category} style={s.section}>
          <div style={s.sectionLabel}>{group.category}</div>
          <div style={s.grid}>
            {group.links.map(link => (
              <button
                key={link.url}
                style={s.card}
                onClick={() => openLink(link.url)}
                title={link.url}
              >
                <div style={s.cardHeader}>
                  <span style={s.cardName}>{link.name}</span>
                  <span style={s.cardArrow}>↗</span>
                </div>
                <p style={s.cardDesc}>{link.desc}</p>
                <div style={s.cardFooter}>
                  <span style={s.cardDomain}>{link.domain}</span>
                  <span style={s.cardProvider}>by {link.provider}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}

      <div style={s.privacyNote}>
        <span style={s.privacyIcon}>🔒</span>
        <span>
          These are independent, third-party websites — not affiliated with or
          operated by Hana. Clicking a card opens it in your default browser;
          Hana never contacts these services on its own. See{' '}
          <button style={s.inlineLink} onClick={() => openLink('https://github.com/Proxy-IT/hana-network-utility/blob/main/PRIVACY.md')}>
            PRIVACY.md
          </button>{' '}
          for details.
        </span>
      </div>
    </div>
  );
}

const s = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 24, animation: 'fadeIn 0.2s ease' },
  title: { fontSize: 22, fontWeight: 600, color: '#E8EDF5', marginBottom: 4 },
  sub: { color: '#8892A4', fontSize: 13, marginBottom: 4 },

  section: { display: 'flex', flexDirection: 'column', gap: 10 },
  sectionLabel: { fontSize: 10, color: '#3D4D65', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 500 },

  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 },
  card: {
    display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left',
    background: '#111827', border: '1px solid #1E2D45', borderRadius: 8,
    padding: '14px 16px', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
  },
  cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  cardName: { fontSize: 13, fontWeight: 600, color: '#E8EDF5' },
  cardArrow: { fontSize: 13, color: '#00D4FF', flexShrink: 0 },
  cardDesc: { fontSize: 11.5, color: '#8892A4', lineHeight: 1.5, margin: 0 },
  cardFooter: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  cardDomain: { fontSize: 10.5, color: '#00D4FF', fontFamily: 'JetBrains Mono, monospace' },
  cardProvider: { fontSize: 10.5, color: '#3D4D65' },

  privacyNote: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    padding: '12px 16px', background: 'rgba(0,212,255,0.05)',
    border: '1px solid rgba(0,212,255,0.15)', borderRadius: 8,
    fontSize: 12, color: '#8892A4', lineHeight: 1.6,
  },
  privacyIcon: { fontSize: 14, flexShrink: 0 },
  inlineLink: {
    background: 'transparent', border: 'none', color: '#00D4FF',
    cursor: 'pointer', fontSize: 12, padding: 0, textDecoration: 'underline',
    fontFamily: 'Inter, sans-serif',
  },
};
