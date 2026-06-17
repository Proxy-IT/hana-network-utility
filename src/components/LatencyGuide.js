import React, { useState } from 'react';
import { LATENCY_TIERS, USE_CASE_THRESHOLDS, classifyLatency } from '../utils/latency';
import Instructions from './Instructions';

export default function LatencyGuide() {
  const [testMs, setTestMs] = useState('');
  const classification = testMs && !isNaN(parseFloat(testMs))
    ? classifyLatency(parseFloat(testMs))
    : null;

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.title}>Latency Reference</h2>
        <p style={s.sub}>What different round-trip times mean for real-world network performance</p>

      <Instructions
        title="How to use the Latency Guide"
        items={[
          { label: 'Use the classifier to evaluate a specific value', detail: 'Type any millisecond value into the input box to instantly see how it rates — from Loopback through Excellent, Good, Fair, Poor, to Critical.' },
          { label: 'Reference the Latency Tiers table', detail: 'This table shows what different RTT ranges typically indicate in the real world, from local LAN through intercontinental and satellite links.' },
          { label: 'Check the Use Case Thresholds table', detail: 'Different applications have very different latency requirements. Gaming and VoIP are far more sensitive than file transfers. Use this table to understand whether your measured latency is acceptable for a specific use.' },
          { label: 'Cross-reference with Ping results', detail: 'Run a ping test from the Ping tab, then come back here and enter your average RTT to see how it compares to real-world expectations.' },
        ]}
        notes="Latency values vary by time of day, network load, and routing. A single measurement may not represent typical performance — use Continuous Ping over several minutes for a more accurate picture."
      />
      </div>

      {/* Quick classifier */}
      <div style={s.classifier}>
        <div style={s.classifierLeft}>
          <div style={s.label}>CLASSIFY A LATENCY VALUE</div>
          <div style={s.classifierRow}>
            <input
              style={s.input}
              type="number"
              min="0"
              value={testMs}
              onChange={e => setTestMs(e.target.value)}
              placeholder="Enter ms value…"
            />
            <span style={s.msLabel}>ms</span>
          </div>
        </div>
        {classification && (
          <div style={{
            ...s.classResult,
            borderColor: classification.color + '55',
            background: classification.color + '0D',
          }}>
            <div style={{ fontSize: 28, color: classification.color, fontWeight: 700,
              fontFamily: 'JetBrains Mono, monospace' }}>
              {testMs} ms
            </div>
            <div style={{ fontSize: 16, color: classification.color, fontWeight: 600, marginTop: 4 }}>
              {classification.tier}
            </div>
          </div>
        )}
      </div>

      {/* Tier table */}
      <div style={s.section}>
        <h3 style={s.sectionLabel}>LATENCY TIERS</h3>
        <div style={s.tierTable}>
          {LATENCY_TIERS.map((tier, i) => (
            <div key={i} style={s.tierRow}>
              <div style={{ ...s.tierBar, background: tier.color + '22', borderLeft: `3px solid ${tier.color}` }}>
                <span style={{ ...s.tierRange, color: tier.color }}>{tier.range}</span>
              </div>
              <div style={s.tierLabel}>{tier.label}</div>
              <div style={s.tierDesc}>{tier.description}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Use case table */}
      <div style={s.section}>
        <h3 style={s.sectionLabel}>USE CASE THRESHOLDS</h3>
        <div style={s.useCaseTable}>
          <div style={s.ucHeader}>
            <span style={{ flex: 1.4 }}>APPLICATION</span>
            <span style={{ flex: 1, color: '#00FF9C' }}>IDEAL</span>
            <span style={{ flex: 1, color: '#FFB020' }}>ACCEPTABLE</span>
            <span style={{ flex: 1, color: '#FF4B6A' }}>POOR</span>
          </div>
          {USE_CASE_THRESHOLDS.map((uc, i) => (
            <div key={i} style={s.ucRow}>
              <span style={{ flex: 1.4, color: '#E8EDF5' }}>{uc.use}</span>
              <span style={{ flex: 1, color: '#00FF9C' }}>{uc.ideal}</span>
              <span style={{ flex: 1, color: '#FFB020' }}>{uc.acceptable}</span>
              <span style={{ flex: 1, color: '#FF4B6A' }}>{uc.poor}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const s = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 24, animation: 'fadeIn 0.2s ease' },
  header: { marginBottom: 4 },
  title: { fontSize: 22, fontWeight: 600, color: '#E8EDF5', marginBottom: 4 },
  sub: { color: '#8892A4', fontSize: 13 },
  classifier: {
    background: '#111827', border: '1px solid #1E2D45', borderRadius: 8,
    padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 24,
  },
  classifierLeft: { display: 'flex', flexDirection: 'column', gap: 8 },
  label: { fontSize: 10, fontWeight: 500, color: '#3D4D65', textTransform: 'uppercase', letterSpacing: '0.1em' },
  classifierRow: { display: 'flex', alignItems: 'center', gap: 8 },
  input: {
    background: '#0D1525', border: '1px solid #1E2D45', borderRadius: 6,
    color: '#E8EDF5', fontFamily: 'JetBrains Mono, monospace',
    fontSize: 14, padding: '8px 12px', outline: 'none', width: 140,
  },
  msLabel: { color: '#8892A4', fontSize: 13, fontFamily: 'JetBrains Mono, monospace' },
  classResult: {
    border: '1px solid', borderRadius: 8, padding: '14px 24px',
    textAlign: 'center', minWidth: 160,
  },
  section: { display: 'flex', flexDirection: 'column', gap: 10 },
  sectionLabel: { fontSize: 10, color: '#3D4D65', textTransform: 'uppercase', letterSpacing: '0.1em' },
  tierTable: {
    background: '#080D18', border: '1px solid #1E2D45', borderRadius: 8,
    overflow: 'hidden',
  },
  tierRow: {
    display: 'flex', alignItems: 'center', gap: 16,
    borderBottom: '1px solid rgba(30,45,69,0.5)', padding: '10px 16px',
  },
  tierBar: {
    width: 90, padding: '4px 8px', borderRadius: '0 4px 4px 0', flexShrink: 0,
  },
  tierRange: { fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 500 },
  tierLabel: { width: 170, fontSize: 12, color: '#E8EDF5', flexShrink: 0 },
  tierDesc: { flex: 1, fontSize: 11, color: '#8892A4', lineHeight: 1.5 },
  useCaseTable: {
    background: '#080D18', border: '1px solid #1E2D45', borderRadius: 8,
    overflow: 'hidden',
  },
  ucHeader: {
    display: 'flex', gap: 8, padding: '10px 16px',
    background: '#111827', borderBottom: '1px solid #1E2D45',
    fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em',
    color: '#3D4D65', fontFamily: 'Inter, sans-serif',
  },
  ucRow: {
    display: 'flex', gap: 8, padding: '10px 16px',
    borderBottom: '1px solid rgba(30,45,69,0.5)',
    fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
    alignItems: 'center',
  },
};
