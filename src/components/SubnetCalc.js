import React, { useState, useMemo } from 'react';
import { calculateSubnet, validateIp } from '../utils/subnet';
import Instructions from './Instructions';

export default function SubnetCalc() {
  const [ip, setIp]     = useState('192.168.1.100');
  const [cidr, setCidr] = useState(24);
  const [inputErr, setInputErr] = useState('');

  const result = useMemo(() => {
    if (!validateIp(ip)) return null;
    if (cidr < 0 || cidr > 32) return null;
    try { return calculateSubnet(ip, cidr); }
    catch { return null; }
  }, [ip, cidr]);

  function handleIpChange(val) {
    setIp(val);
    setInputErr(val && !validateIp(val) ? 'Invalid IP address' : '');
  }

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.title}>Subnet Calculator</h2>
        <p style={s.sub}>Compute network addresses, host ranges, and masks from CIDR notation</p>

      <Instructions
        title="How to use Subnet Calculator"
        items={[
          { label: 'Enter an IP address', detail: 'Type any valid IPv4 address in dotted decimal format. This can be a host address, network address, or any address within the subnet you want to calculate.', example: '192.168.10.50' },
          { label: 'Adjust the CIDR prefix length', detail: 'Drag the slider to set the subnet mask size. Common values: /24 = 254 hosts (class C), /16 = 65,534 hosts (class B), /8 = 16 million hosts (class A). Smaller numbers = larger subnets.', example: '/24 = 255.255.255.0 mask' },
          { label: 'Read the results', detail: 'The calculator instantly shows the network address, broadcast address, usable host range, subnet mask, wildcard mask, IP class, and whether the address is private or public.' },
          { label: 'Understand the binary view', detail: 'The binary display highlights the network portion (cyan) vs host portion (gray) of the address, making it easier to see how the mask divides the address space.' },
        ]}
        notes="CIDR stands for Classless Inter-Domain Routing. The prefix (e.g. /24) tells you how many bits are used for the network portion of the address."
      />
      </div>

      {/* Input row */}
      <div style={s.controls}>
        <div style={s.fieldGroup}>
          <label style={s.label}>IP ADDRESS</label>
          <input
            style={{ ...s.input, ...(inputErr ? s.inputErr : {}) }}
            value={ip}
            onChange={e => handleIpChange(e.target.value)}
            placeholder="e.g. 192.168.1.100"
            spellCheck={false}
          />
          {inputErr && <span style={s.errText}>{inputErr}</span>}
        </div>
        <div style={{ alignSelf: 'flex-end', paddingBottom: 9, color: '#3D4D65', fontSize: 20, fontFamily: 'JetBrains Mono, monospace' }}>/</div>
        <div style={s.fieldGroup}>
          <label style={s.label}>PREFIX (CIDR)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="range" min={0} max={32} value={cidr}
              onChange={e => setCidr(parseInt(e.target.value))}
              style={s.slider}
            />
            <span style={s.cidrBadge}>/{cidr}</span>
          </div>
        </div>
      </div>

      {/* Results */}
      {result && (
        <>
          {/* Key fields */}
          <div style={s.grid}>
            <ResultRow label="Network Address"  value={result.networkAddress}  highlight />
            <ResultRow label="Subnet Mask"      value={result.subnetMask} />
            <ResultRow label="Wildcard Mask"    value={result.wildcardMask} />
            <ResultRow label="Broadcast Address" value={result.broadcastAddr} />
            <ResultRow label="First Host"       value={result.firstHost}       color="#00FF9C" />
            <ResultRow label="Last Host"        value={result.lastHost}        color="#00FF9C" />
            <ResultRow label="Usable Hosts"     value={result.totalHosts.toLocaleString()} color="#00D4FF" large />
            <ResultRow label="IP Class"         value={`Class ${result.ipClass}`} />
            <ResultRow label="Scope"            value={result.isPrivate ? 'Private (RFC 1918)' : 'Public'}
              color={result.isPrivate ? '#FFB020' : '#00D4FF'} />
          </div>

          {/* Binary view */}
          <div style={s.section}>
            <h3 style={s.sectionLabel}>BINARY REPRESENTATION</h3>
            <div style={s.binaryWrap}>
              <BinaryRow label="IP"   binary={result.binaryIp}   cidr={cidr} />
              <BinaryRow label="Mask" binary={result.binaryMask} cidr={cidr} isMask />
            </div>
          </div>

          {/* Quick reference */}
          <div style={s.section}>
            <h3 style={s.sectionLabel}>HOST RANGE</h3>
            <div style={s.rangeBar}>
              <div style={s.rangeNetwork}>
                <span style={s.rangeLabel}>Network</span>
                <span style={s.rangeVal}>{result.networkAddress}</span>
              </div>
              <div style={s.rangeHosts}>
                <span style={s.rangeLabel}>{result.totalHosts.toLocaleString()} usable hosts</span>
                <span style={{ ...s.rangeVal, color: '#00FF9C' }}>
                  {result.firstHost} → {result.lastHost}
                </span>
              </div>
              {result.broadcastAddr !== 'N/A (point-to-point)' && (
                <div style={s.rangeBcast}>
                  <span style={s.rangeLabel}>Broadcast</span>
                  <span style={s.rangeVal}>{result.broadcastAddr}</span>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {!result && !inputErr && (
        <div style={s.placeholder}>Enter a valid IP and adjust the CIDR prefix to calculate</div>
      )}
    </div>
  );
}

function ResultRow({ label, value, highlight, color, large }) {
  return (
    <div style={{ ...s.resultRow, ...(highlight ? s.resultRowHL : {}) }}>
      <span style={s.resultLabel}>{label}</span>
      <span style={{
        ...s.resultValue,
        color: color || (highlight ? '#00D4FF' : '#E8EDF5'),
        fontSize: large ? 18 : 13,
      }}>
        {value}
      </span>
    </div>
  );
}

function BinaryRow({ label, binary, cidr, isMask }) {
  const octets = binary.split('.');
  return (
    <div style={s.binaryRow}>
      <span style={s.binaryLabel}>{label}</span>
      <div style={s.binaryOctets}>
        {octets.map((octet, oi) => (
          <span key={oi} style={s.binaryOctet}>
            {octet.split('').map((bit, bi) => {
              const pos = oi * 8 + bi;
              const isNet = pos < cidr;
              return (
                <span key={bi} style={{
                  color: isNet ? (isMask ? '#00FF9C' : '#00D4FF') : '#3D4D65',
                  fontWeight: isNet ? 500 : 400,
                }}>
                  {bit}
                </span>
              );
            })}
            {oi < 3 && <span style={{ color: '#3D4D65', margin: '0 4px' }}>.</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

const s = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeIn 0.2s ease' },
  header: { marginBottom: 4 },
  title: { fontSize: 22, fontWeight: 600, color: '#E8EDF5', marginBottom: 4 },
  sub: { color: '#8892A4', fontSize: 13 },
  controls: {
    display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap',
    background: '#111827', border: '1px solid #1E2D45',
    borderRadius: 8, padding: '16px 20px',
  },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 10, fontWeight: 500, color: '#3D4D65', textTransform: 'uppercase', letterSpacing: '0.1em' },
  input: {
    background: '#0D1525', border: '1px solid #1E2D45', borderRadius: 6,
    color: '#E8EDF5', fontFamily: 'JetBrains Mono, monospace',
    fontSize: 13, padding: '8px 12px', outline: 'none', width: 200,
  },
  inputErr: { borderColor: 'rgba(255,75,106,0.5)' },
  errText: { fontSize: 11, color: '#FF4B6A' },
  slider: { width: 160, accentColor: '#00D4FF' },
  cidrBadge: {
    fontFamily: 'JetBrains Mono, monospace', fontSize: 18, fontWeight: 600,
    color: '#00D4FF', minWidth: 36,
  },
  grid: {
    background: '#111827', border: '1px solid #1E2D45', borderRadius: 8,
    overflow: 'hidden',
  },
  resultRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 20px', borderBottom: '1px solid #1A2235',
  },
  resultRowHL: { background: 'rgba(0,212,255,0.04)' },
  resultLabel: { fontSize: 12, color: '#8892A4' },
  resultValue: { fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 500 },
  section: { display: 'flex', flexDirection: 'column', gap: 10 },
  sectionLabel: { fontSize: 10, color: '#3D4D65', textTransform: 'uppercase', letterSpacing: '0.1em' },
  binaryWrap: {
    background: '#080D18', border: '1px solid #1E2D45', borderRadius: 8,
    padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10,
  },
  binaryRow: { display: 'flex', alignItems: 'center', gap: 16 },
  binaryLabel: { fontSize: 10, color: '#3D4D65', textTransform: 'uppercase', letterSpacing: '0.08em', width: 36 },
  binaryOctets: { display: 'flex', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, letterSpacing: '0.05em' },
  binaryOctet: { display: 'inline-flex' },
  rangeBar: {
    display: 'flex', background: '#080D18', border: '1px solid #1E2D45',
    borderRadius: 8, overflow: 'hidden',
  },
  rangeNetwork: { padding: '12px 16px', borderRight: '1px solid #1E2D45', minWidth: 160 },
  rangeHosts: { flex: 1, padding: '12px 16px', borderRight: '1px solid #1E2D45' },
  rangeBcast: { padding: '12px 16px', minWidth: 160 },
  rangeLabel: { display: 'block', fontSize: 10, color: '#3D4D65', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 },
  rangeVal: { fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#8892A4' },
  placeholder: {
    textAlign: 'center', color: '#3D4D65', padding: '60px 0',
    fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
  },
};
