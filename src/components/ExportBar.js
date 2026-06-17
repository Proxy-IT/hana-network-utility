import React, { useState } from 'react';

/**
 * ExportBar — compact export button group
 * Props:
 *   onExportTxt  — function to call for .txt export
 *   onExportCsv  — function to call for .csv export
 *   disabled     — bool, disables buttons when no data
 */
export default function ExportBar({ onExportTxt, onExportCsv, disabled }) {
  const [flash, setFlash] = useState(null);

  function handle(type, fn) {
    fn();
    setFlash(type);
    setTimeout(() => setFlash(null), 1500);
  }

  return (
    <div style={s.wrap}>
      <span style={s.label}>Export</span>
      <button
        style={{ ...s.btn, ...(disabled ? s.btnOff : {}), ...(flash === 'txt' ? s.btnFlash : {}) }}
        onClick={() => !disabled && handle('txt', onExportTxt)}
        disabled={disabled}
        title="Export as plain text"
      >
        {flash === 'txt' ? '✓ Saved' : '↓ .txt'}
      </button>
      <button
        style={{ ...s.btn, ...s.btnCsv, ...(disabled ? s.btnOff : {}), ...(flash === 'csv' ? s.btnFlash : {}) }}
        onClick={() => !disabled && handle('csv', onExportCsv)}
        disabled={disabled}
        title="Export as CSV spreadsheet"
      >
        {flash === 'csv' ? '✓ Saved' : '↓ .csv'}
      </button>
    </div>
  );
}

const s = {
  wrap: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 14px', background: '#080D18',
    border: '1px solid #1E2D45', borderRadius: 8,
  },
  label: {
    fontSize: 10, color: '#3D4D65', textTransform: 'uppercase',
    letterSpacing: '0.1em', fontWeight: 500, marginRight: 4,
  },
  btn: {
    background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.25)',
    color: '#00D4FF', borderRadius: 5, padding: '5px 14px',
    fontSize: 11, fontWeight: 500, cursor: 'pointer',
    fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap',
    transition: 'all 0.15s',
  },
  btnCsv: {
    background: 'rgba(0,255,156,0.08)', border: '1px solid rgba(0,255,156,0.25)',
    color: '#00FF9C',
  },
  btnOff: { opacity: 0.3, cursor: 'not-allowed' },
  btnFlash: { background: 'rgba(0,255,156,0.15)', color: '#00FF9C', borderColor: 'rgba(0,255,156,0.4)' },
};
