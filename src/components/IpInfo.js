import React, { useState, useEffect } from 'react';
import Instructions from './Instructions';
import ExportBar from './ExportBar';
import {
  exportMyIpTxt, exportMyIpCsv,
  exportIpLookupTxt, exportIpLookupCsv,
  exportWhoisTxt, exportWhoisCsv,
} from '../utils/export';

const INSTRUCTIONS = {
  title: 'How to use IP Info & WhoIs',
  items: [
    {
      label: 'Your public IP loads automatically',
      detail: 'When you open this tab, Hana fetches your current public IP address and displays your ISP, location, and network information. This is the IP address the internet sees when you connect.',
    },
    {
      label: 'Look up any IP address',
      detail: 'Enter any IPv4 or IPv6 address in the IP Lookup section to see its geolocation, ISP, organization, timezone, and whether it is associated with a VPN, proxy, or hosting provider.',
      example: '8.8.8.8 or 1.1.1.1',
    },
    {
      label: 'Look up WhoIs for a domain or IP',
      detail: 'Enter a domain name or IP address in the WhoIs section to see registration details including registrar, creation date, expiry date, name servers, and registrant information where available.',
      example: 'google.com or 8.8.8.8',
    },
  ],
  notes: 'Note: WhoIs data depends on public registry records. Some registrants use privacy protection services which will hide personal contact details. This is normal and expected for many domains.',
};

// ── API helpers ───────────────────────────────────────────────────────────────

// Shared fetch wrapper with explicit headers to avoid HTML error responses
async function apiFetch(url) {
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  });
  const text = await res.text();
  // Guard against HTML error pages
  if (text.trim().startsWith('<')) {
    throw new Error('API returned an unexpected response. Check your internet connection.');
  }
  return JSON.parse(text);
}

async function fetchPublicIp() {
  // Step 1: get raw IP as plain text — most reliable across environments
  const ipRes  = await fetch('https://api.ipify.org?format=json', {
    headers: { 'Accept': 'application/json' },
  });
  const ipText = await ipRes.text();
  if (ipText.trim().startsWith('<')) {
    throw new Error('Could not reach ipify.org. Check your internet connection.');
  }
  const { ip } = JSON.parse(ipText);
  // Step 2: get full details for that IP
  const details = await fetchIpDetails(ip);
  return { ip, ...details };
}

async function fetchIpDetails(ip) {
  // ip-api.com — reliable, no API key, works in packaged Electron apps
  const data = await apiFetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query`);
  if (data.status === 'fail') throw new Error(data.message || 'IP lookup failed');
  return {
    ip:          data.query,
    city:        data.city,
    region:      data.regionName,
    regionCode:  data.region,
    country:     data.country,
    countryCode: data.countryCode,
    postal:      data.zip,
    latitude:    data.lat,
    longitude:   data.lon,
    timezone:    data.timezone,
    utcOffset:   null,
    isp:         data.isp,
    asn:         data.as,
    org:         data.org,
  };
}

async function fetchWhois(query) {
  // Try RDAP first — works for domains, structured JSON response
  const isDomain = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(query) && !/^\d+\.\d+\.\d+\.\d+$/.test(query);
  if (isDomain) {
    try {
      const tld = query.split('.').pop().toLowerCase();
      const rdapRes = await fetch(`https://rdap.org/domain/${encodeURIComponent(query)}`, {
        headers: { 'Accept': 'application/json' },
      });
      const rdapText = await rdapRes.text();
      if (!rdapText.trim().startsWith('<')) {
        const data = JSON.parse(rdapText);
        return { rdap: data, source: 'rdap' };
      }
    } catch (e) {
      // fall through to raw whois
    }
  }

  // Fallback: raw WhoIs via whois.vu
  try {
    const res  = await fetch(`https://api.whois.vu/?q=${encodeURIComponent(query)}`);
    const text = await res.text();
    if (text && !text.trim().startsWith('<') && text.length > 50) {
      return { raw: text, source: 'whois.vu' };
    }
  } catch (e) {}

  // Last resort: RDAP for IPs
  try {
    const res  = await fetch(`https://rdap.org/ip/${encodeURIComponent(query)}`, {
      headers: { 'Accept': 'application/json' },
    });
    const text = await res.text();
    if (!text.trim().startsWith('<')) {
      return { rdap: JSON.parse(text), source: 'rdap-ip' };
    }
  } catch (e) {}

  throw new Error('WhoIs lookup failed — the domain or IP may not have public records available.');
}

// ── Main component ────────────────────────────────────────────────────────────

export default function IpInfo() {
  const [myIp, setMyIp]         = useState(null);
  const [myIpLoading, setMyIpLoading] = useState(true);
  const [myIpError, setMyIpError]     = useState(null);

  const [lookupIp, setLookupIp]         = useState('');
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError]   = useState(null);

  const [whoisQuery, setWhoisQuery]   = useState('');
  const [whoisResult, setWhoisResult] = useState(null);
  const [whoisLoading, setWhoisLoading] = useState(false);
  const [whoisError, setWhoisError]   = useState(null);

  // Auto-fetch public IP on mount
  useEffect(() => {
    fetchPublicIp()
      .then(data => { setMyIp(data); setMyIpLoading(false); })
      .catch(e  => { setMyIpError(e.message); setMyIpLoading(false); });
  }, []);

  async function runIpLookup() {
    if (!lookupIp.trim()) return;
    setLookupLoading(true); setLookupResult(null); setLookupError(null);
    try {
      const data = await fetchIpDetails(lookupIp.trim());
      setLookupResult(data);
    } catch (e) {
      setLookupError(e.message);
    }
    setLookupLoading(false);
  }

  async function runWhois() {
    if (!whoisQuery.trim()) return;
    setWhoisLoading(true); setWhoisResult(null); setWhoisError(null);
    try {
      const data = await fetchWhois(whoisQuery.trim());
      setWhoisResult(data);
    } catch (e) {
      setWhoisError(e.message || 'WhoIs lookup failed');
    }
    setWhoisLoading(false);
  }

  return (
    <div style={s.wrap}>
      <h2 style={s.title}>IP Info & WhoIs</h2>
      <p style={s.sub}>Look up public IP details, geolocation, ISP info, and domain registration records</p>

      <Instructions {...INSTRUCTIONS} />

      {/* ── MY PUBLIC IP ── */}
      <div style={s.section}>
        <div style={s.sectionHeader}>
          <span style={s.sectionLabel}>YOUR PUBLIC IP ADDRESS</span>
          <button style={s.refreshBtn} onClick={() => {
            setMyIpLoading(true); setMyIpError(null); setMyIp(null);
            fetchPublicIp()
              .then(data => { setMyIp(data); setMyIpLoading(false); })
              .catch(e  => { setMyIpError(e.message); setMyIpLoading(false); });
          }}>↻ Refresh</button>
        </div>

        {myIpLoading && <LoadingBar label="Detecting your public IP…" />}
        {myIpError   && <ErrorBox message={myIpError} />}
        {myIp && (
          <>
            <div style={s.myIpCard}>
              {/* Big IP display */}
              <div style={s.myIpMain}>
                <div style={s.myIpAddress}>{myIp.ip}</div>
                <div style={s.myIpLocation}>
                  {[myIp.city, myIp.region, myIp.country].filter(Boolean).join(', ')}
                </div>
              </div>
              {/* Detail grid */}
              <div style={s.detailGrid}>
                <DetailRow label="ISP / Org"   value={myIp.isp} />
                <DetailRow label="ASN"         value={myIp.asn} />
                <DetailRow label="Country"     value={`${myIp.country} (${myIp.countryCode})`} />
                <DetailRow label="Region"      value={`${myIp.region} (${myIp.regionCode})`} />
                <DetailRow label="City"        value={myIp.city} />
                <DetailRow label="Postal"      value={myIp.postal} />
                <DetailRow label="Timezone"    value={myIp.timezone} />
                <DetailRow label="UTC Offset"  value={myIp.utcOffset} />
                <DetailRow label="Coordinates" value={myIp.latitude && myIp.longitude ? `${myIp.latitude}, ${myIp.longitude}` : null} />
              </div>
            </div>
            <ExportBar
              disabled={false}
              onExportTxt={() => exportMyIpTxt(myIp)}
              onExportCsv={() => exportMyIpCsv(myIp)}
            />
          </>
        )}
      </div>

      {/* ── IP LOOKUP ── */}
      <div style={s.section}>
        <span style={s.sectionLabel}>IP ADDRESS LOOKUP</span>
        <div style={s.inputRow}>
          <input
            style={s.input}
            value={lookupIp}
            onChange={e => setLookupIp(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !lookupLoading && runIpLookup()}
            placeholder="Enter any IP address"
            spellCheck={false}
            disabled={lookupLoading}
          />
          <button
            style={{ ...s.btn, ...(lookupLoading ? s.btnOff : {}) }}
            onClick={runIpLookup} disabled={lookupLoading}>
            {lookupLoading ? <><span style={s.spinner} /> Looking up…</> : '⌕  Look Up'}
          </button>
        </div>

        {lookupError  && <ErrorBox message={lookupError} />}
        {lookupResult && (
          <>
            <div style={s.resultCard}>
              <div style={s.resultIpHeader}>
                <span style={s.resultIp}>{lookupResult.ip}</span>
                <span style={s.resultCountryBadge}>{lookupResult.countryCode}</span>
              </div>
              <div style={s.detailGrid}>
                <DetailRow label="ISP / Org"   value={lookupResult.isp} />
                <DetailRow label="ASN"         value={lookupResult.asn} />
                <DetailRow label="Country"     value={`${lookupResult.country} (${lookupResult.countryCode})`} />
                <DetailRow label="Region"      value={`${lookupResult.region} (${lookupResult.regionCode})`} />
                <DetailRow label="City"        value={lookupResult.city} />
                <DetailRow label="Postal"      value={lookupResult.postal} />
                <DetailRow label="Timezone"    value={lookupResult.timezone} />
                <DetailRow label="UTC Offset"  value={lookupResult.utcOffset} />
                <DetailRow label="Coordinates" value={lookupResult.latitude && lookupResult.longitude ? `${lookupResult.latitude}, ${lookupResult.longitude}` : null} />
              </div>
            </div>
            <ExportBar
              disabled={false}
              onExportTxt={() => exportIpLookupTxt(lookupResult)}
              onExportCsv={() => exportIpLookupCsv(lookupResult)}
            />
          </>
        )}
      </div>

      {/* ── WHOIS ── */}
      <div style={s.section}>
        <span style={s.sectionLabel}>WHOIS LOOKUP</span>
        <div style={s.inputRow}>
          <input
            style={s.input}
            value={whoisQuery}
            onChange={e => setWhoisQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !whoisLoading && runWhois()}
            placeholder="Enter domain or IP address"
            spellCheck={false}
            disabled={whoisLoading}
          />
          <button
            style={{ ...s.btn, ...(whoisLoading ? s.btnOff : {}) }}
            onClick={runWhois} disabled={whoisLoading}>
            {whoisLoading ? <><span style={s.spinner} /> Querying…</> : '⌕  WhoIs'}
          </button>
        </div>

        {whoisError  && <ErrorBox message={whoisError} />}
        {whoisResult && (
          <>
            <WhoisResult data={whoisResult} query={whoisQuery} />
            <ExportBar
              disabled={false}
              onExportTxt={() => exportWhoisTxt({ query: whoisQuery, data: whoisResult })}
              onExportCsv={() => exportWhoisCsv({ query: whoisQuery, data: whoisResult })}
            />
          </>
        )}
      </div>
    </div>
  );
}

// ── WhoIs result renderer ─────────────────────────────────────────────────────
function WhoisResult({ data, query }) {
  const [showRaw, setShowRaw] = useState(false);

  if (data.rdap) {
    const d = data.rdap;
    const events = d.events || [];
    const getEvent = (type) => events.find(e => e.eventAction === type)?.eventDate;
    const nameservers = (d.nameservers || []).map(ns => ns.ldhName).join(', ');
    const entities = d.entities || [];
    const registrar = entities.find(e => e.roles?.includes('registrar'));
    const registrant = entities.find(e => e.roles?.includes('registrant'));

    return (
      <div style={s.resultCard}>
        <div style={s.resultIpHeader}>
          <span style={s.resultIp}>{d.ldhName || query}</span>
          <span style={s.whoisBadge}>RDAP</span>
        </div>
        <div style={s.detailGrid}>
          <DetailRow label="Status"      value={(d.status || []).join(', ')} />
          <DetailRow label="Registrar"   value={registrar?.vcardArray?.[1]?.find(v => v[0] === 'fn')?.[3] || registrar?.handle} />
          <DetailRow label="Created"     value={getEvent('registration') ? new Date(getEvent('registration')).toLocaleDateString() : null} />
          <DetailRow label="Updated"     value={getEvent('last changed')  ? new Date(getEvent('last changed')).toLocaleDateString()  : null} />
          <DetailRow label="Expires"     value={getEvent('expiration')    ? new Date(getEvent('expiration')).toLocaleDateString()    : null} />
          <DetailRow label="Name Servers" value={nameservers || null} />
          <DetailRow label="Registrant"  value={registrant?.vcardArray?.[1]?.find(v => v[0] === 'fn')?.[3]} />
        </div>
      </div>
    );
  }

  if (data.raw) {
    // Parse key fields from raw WhoIs text
    const raw = data.raw;
    const extract = (patterns) => {
      for (const pattern of patterns) {
        const match = raw.match(new RegExp(`${pattern}:\\s*(.+)`, 'im'));
        if (match && match[1].trim() && match[1].trim() !== 'REDACTED FOR PRIVACY') {
          return match[1].trim();
        }
      }
      return null;
    };

    const parsed = {
      'Domain Name':    extract(['Domain Name', 'domain']),
      'Registrar':      extract(['Registrar', 'registrar']),
      'Created':        extract(['Creation Date', 'Created On', 'created']),
      'Updated':        extract(['Updated Date', 'Last Modified', 'changed']),
      'Expires':        extract(['Registry Expiry Date', 'Expiration Date', 'expires']),
      'Status':         extract(['Domain Status', 'Status', 'status']),
      'Name Servers':   extract(['Name Server', 'nserver']),
      'Registrant Org': extract(['Registrant Organization', 'Registrant']),
      'Registrant Country': extract(['Registrant Country']),
      'DNSSEC':         extract(['DNSSEC']),
    };

    const hasFields = Object.values(parsed).some(v => v);

    return (
      <div style={s.resultCard}>
        <div style={s.resultIpHeader}>
          <span style={s.resultIp}>{query}</span>
          <span style={s.whoisBadge}>WhoIs</span>
        </div>
        {hasFields && (
          <div style={s.detailGrid}>
            {Object.entries(parsed).map(([label, value]) =>
              value ? <DetailRow key={label} label={label} value={value} /> : null
            )}
          </div>
        )}
        <button style={s.rawToggle} onClick={() => setShowRaw(r => !r)}>
          {showRaw ? '▾ Hide raw output' : '▸ Show raw WhoIs output'}
        </button>
        {showRaw && <pre style={s.rawOutput}>{raw}</pre>}
      </div>
    );
  }

  return <ErrorBox message="No data returned from WhoIs query." />;
}

// ── Sub-components ────────────────────────────────────────────────────────────
function DetailRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={s.detailRow}>
      <span style={s.detailLabel}>{label}</span>
      <span style={s.detailValue}>{value}</span>
    </div>
  );
}

function LoadingBar({ label }) {
  return (
    <div style={s.loadingBar}>
      <span style={s.spinner} />
      <span style={{ color: '#8892A4', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}>{label}</span>
    </div>
  );
}

function ErrorBox({ message }) {
  return (
    <div style={s.errorBox}>
      <span style={{ color: '#FF4B6A', marginRight: 8, flexShrink: 0 }}>✗</span>
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{message}</span>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 24, animation: 'fadeIn 0.2s ease' },
  title: { fontSize: 22, fontWeight: 600, color: '#E8EDF5', marginBottom: 4 },
  sub: { color: '#8892A4', fontSize: 13, marginBottom: 4 },

  section: { display: 'flex', flexDirection: 'column', gap: 12 },
  sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: { fontSize: 10, color: '#3D4D65', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 500 },
  refreshBtn: {
    background: 'transparent', border: '1px solid #1E2D45',
    color: '#8892A4', borderRadius: 5, padding: '4px 10px',
    fontSize: 11, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
  },

  myIpCard: {
    background: '#111827', border: '1px solid rgba(0,212,255,0.2)',
    borderRadius: 10, overflow: 'hidden',
  },
  myIpMain: {
    background: 'rgba(0,212,255,0.05)', borderBottom: '1px solid #1E2D45',
    padding: '20px 24px',
  },
  myIpAddress: {
    fontSize: 32, fontWeight: 700, color: '#00D4FF',
    fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.02em',
    lineHeight: 1, marginBottom: 6,
  },
  myIpLocation: { fontSize: 13, color: '#8892A4' },

  inputRow: { display: 'flex', gap: 10 },
  input: {
    flex: 1, background: '#0D1525', border: '1px solid #1E2D45',
    borderRadius: 6, color: '#E8EDF5',
    fontFamily: 'JetBrains Mono, monospace', fontSize: 13,
    padding: '8px 12px', outline: 'none',
  },
  btn: {
    background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)',
    color: '#00D4FF', borderRadius: 6, padding: '8px 20px',
    fontSize: 13, fontWeight: 500, cursor: 'pointer',
    fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap',
    display: 'flex', alignItems: 'center', gap: 6,
  },
  btnOff: { opacity: 0.5, cursor: 'not-allowed' },
  spinner: {
    width: 10, height: 10, borderRadius: '50%',
    border: '2px solid rgba(0,212,255,0.3)', borderTopColor: '#00D4FF',
    display: 'inline-block', animation: 'spin 0.7s linear infinite',
  },

  resultCard: {
    background: '#111827', border: '1px solid #1E2D45',
    borderRadius: 10, overflow: 'hidden',
  },
  resultIpHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 20px', background: '#0D1525',
    borderBottom: '1px solid #1E2D45',
  },
  resultIp: {
    fontSize: 18, fontWeight: 600, color: '#E8EDF5',
    fontFamily: 'JetBrains Mono, monospace',
  },
  resultCountryBadge: {
    background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.25)',
    color: '#00D4FF', borderRadius: 4, padding: '3px 10px',
    fontSize: 11, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace',
  },
  whoisBadge: {
    background: 'rgba(0,255,156,0.1)', border: '1px solid rgba(0,255,156,0.25)',
    color: '#00FF9C', borderRadius: 4, padding: '3px 10px',
    fontSize: 11, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace',
  },

  detailGrid: { padding: '4px 0' },
  detailRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '8px 20px', borderBottom: '1px solid rgba(30,45,69,0.5)',
    gap: 16,
  },
  detailLabel: { fontSize: 11, color: '#3D4D65', flexShrink: 0, width: 130, paddingTop: 1 },
  detailValue: {
    fontSize: 12, color: '#E8EDF5',
    fontFamily: 'JetBrains Mono, monospace',
    textAlign: 'right', wordBreak: 'break-all',
  },

  rawToggle: {
    background: 'transparent', border: 'none',
    color: '#3D4D65', cursor: 'pointer', fontSize: 11,
    fontFamily: 'Inter, sans-serif', padding: '10px 20px',
    textAlign: 'left', width: '100%',
  },
  rawOutput: {
    background: '#080D18', borderTop: '1px solid #1E2D45',
    padding: '14px 20px', fontFamily: 'JetBrains Mono, monospace',
    fontSize: 10, color: '#8892A4', lineHeight: 1.7,
    overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
    maxHeight: 300, overflowY: 'auto',
  },

  loadingBar: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '14px 16px', background: '#111827',
    border: '1px solid #1E2D45', borderRadius: 8,
  },
  errorBox: {
    background: 'rgba(255,75,106,0.06)', border: '1px solid rgba(255,75,106,0.2)',
    borderRadius: 8, padding: '12px 16px',
    display: 'flex', alignItems: 'flex-start',
  },
};
