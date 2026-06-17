import React, { useState } from 'react';

/**
 * Collapsible inline instructions panel.
 * Usage:
 *   <Instructions title="How to use Ping" items={[...]} notes="..." />
 */
export default function Instructions({ title, items = [], notes }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={s.wrap}>
      <button style={s.toggle} onClick={() => setOpen(o => !o)}>
        <span style={s.toggleIcon}>{open ? '▾' : '▸'}</span>
        <span style={s.toggleLabel}>{open ? 'Hide' : 'Show'} instructions</span>
        {!open && <span style={s.toggleHint}>— {title}</span>}
      </button>

      {open && (
        <div style={s.panel}>
          <div style={s.panelTitle}>{title}</div>

          <ol style={s.list}>
            {items.map((item, i) => (
              <li key={i} style={s.item}>
                <span style={s.num}>{i + 1}</span>
                <div style={s.itemBody}>
                  {typeof item === 'string' ? (
                    <span style={s.itemText}>{item}</span>
                  ) : (
                    <>
                      <span style={s.itemLabel}>{item.label}</span>
                      {item.detail && <span style={s.itemDetail}>{item.detail}</span>}
                      {item.example && (
                        <div style={s.example}>
                          <span style={s.exampleLabel}>Example: </span>
                          <code style={s.code}>{item.example}</code>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </li>
            ))}
          </ol>

          {notes && (
            <div style={s.notes}>
              <span style={s.notesIcon}>ℹ</span>
              <span>{notes}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const s = {
  wrap: { borderRadius: 8, overflow: 'hidden' },
  toggle: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.15)',
    borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
    fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#00D4FF',
    width: '100%', textAlign: 'left',
  },
  toggleIcon: { fontSize: 11, flexShrink: 0 },
  toggleLabel: { fontWeight: 500 },
  toggleHint: { color: '#3D4D65', fontWeight: 400, fontSize: 11 },
  panel: {
    background: '#080D18', border: '1px solid rgba(0,212,255,0.12)',
    borderTop: 'none', borderRadius: '0 0 8px 8px',
    padding: '16px 20px', marginTop: -1,
  },
  panelTitle: {
    fontSize: 11, fontWeight: 600, color: '#00D4FF',
    textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14,
  },
  list: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 },
  item: { display: 'flex', gap: 12, alignItems: 'flex-start' },
  num: {
    width: 20, height: 20, borderRadius: '50%',
    background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.25)',
    color: '#00D4FF', fontSize: 10, fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    marginTop: 1,
  },
  itemBody: { display: 'flex', flexDirection: 'column', gap: 3, flex: 1 },
  itemText: { fontSize: 12, color: '#8892A4', lineHeight: 1.6 },
  itemLabel: { fontSize: 12, color: '#E8EDF5', fontWeight: 500, lineHeight: 1.5 },
  itemDetail: { fontSize: 11, color: '#8892A4', lineHeight: 1.6 },
  example: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 },
  exampleLabel: { fontSize: 10, color: '#3D4D65', textTransform: 'uppercase', letterSpacing: '0.06em' },
  code: {
    fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
    background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.15)',
    borderRadius: 4, padding: '1px 7px', color: '#00D4FF',
  },
  notes: {
    display: 'flex', gap: 8, alignItems: 'flex-start',
    marginTop: 14, padding: '10px 14px',
    background: 'rgba(255,176,32,0.06)', border: '1px solid rgba(255,176,32,0.2)',
    borderRadius: 6, fontSize: 11, color: '#FFB020', lineHeight: 1.6,
  },
  notesIcon: { fontSize: 13, flexShrink: 0, marginTop: 1 },
};
