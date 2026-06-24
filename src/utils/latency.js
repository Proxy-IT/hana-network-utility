export const LATENCY_TIERS = [
  {
    range: '< 1 ms',
    label: 'Local Loopback',
    color: '#00FF9C',
    description: 'Same machine (127.0.0.1). Essentially zero network delay.',
  },
  {
    range: '1–5 ms',
    label: 'Local LAN',
    color: '#00FF9C',
    description: 'Devices on the same switch/router. Wired gigabit Ethernet.',
  },
  {
    range: '5–20 ms',
    label: 'Regional Network',
    color: '#00D4FF',
    description: 'Same city or metro area. Typical home-to-ISP gateway.',
  },
  {
    range: '20–50 ms',
    label: 'National (US)',
    color: '#00D4FF',
    description: 'Cross-country US or similar continent. Good broadband.',
  },
  {
    range: '50–100 ms',
    label: 'Intercontinental',
    color: '#FFB020',
    description: 'US↔Europe or equivalent distance. VoIP begins to degrade.',
  },
  {
    range: '100–150 ms',
    label: 'Transoceanic',
    color: '#FFB020',
    description: 'US↔Asia Pacific. Noticeable lag in real-time applications.',
  },
  {
    range: '150–300 ms',
    label: 'Poor / Satellite (LEO)',
    color: '#FF8C42',
    description: 'Starlink/LEO satellite. Playable gaming but video calls struggle.',
  },
  {
    range: '300–700 ms',
    label: 'Satellite (GEO)',
    color: '#FF4B6A',
    description: 'Traditional geostationary satellite. Major delay noticeable in all real-time use.',
  },
  {
    range: '> 700 ms',
    label: 'Critical / Congestion',
    color: '#FF4B6A',
    description: 'Severe congestion, packet loss likely. Application timeouts expected.',
  },
];

export const USE_CASE_THRESHOLDS = [
  { use: 'Online Gaming (FPS)', ideal: '< 20 ms', acceptable: '< 60 ms', poor: '> 100 ms' },
  { use: 'Video Conferencing', ideal: '< 50 ms', acceptable: '< 150 ms', poor: '> 300 ms' },
  { use: 'VoIP Calls',         ideal: '< 20 ms', acceptable: '< 100 ms', poor: '> 150 ms' },
  { use: 'Web Browsing',       ideal: '< 50 ms', acceptable: '< 200 ms', poor: '> 500 ms' },
  { use: 'File Transfer',      ideal: 'Any',     acceptable: 'Any',       poor: '> 1000 ms (TCP retransmit)' },
  { use: 'Database Queries',   ideal: '< 5 ms',  acceptable: '< 20 ms',  poor: '> 50 ms' },
  { use: 'CDN / Static Assets',ideal: '< 30 ms', acceptable: '< 100 ms', poor: '> 250 ms' },
];

export function classifyLatency(ms) {
  if (ms < 1)   return { tier: 'Loopback',      color: '#00FF9C', emoji: '⚡' };
  if (ms < 5)   return { tier: 'Excellent',     color: '#00FF9C', emoji: '✓' };
  if (ms < 20)  return { tier: 'Good',          color: '#00D4FF', emoji: '✓' };
  if (ms < 50)  return { tier: 'Acceptable',    color: '#00D4FF', emoji: '~' };
  if (ms < 100) return { tier: 'Fair',          color: '#FFB020', emoji: '!' };
  if (ms < 200) return { tier: 'Poor',          color: '#FF8C42', emoji: '!!' };
  return              { tier: 'Critical',        color: '#FF4B6A', emoji: '✗' };
}
