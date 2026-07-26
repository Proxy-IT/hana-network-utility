// ── TLS certificate expiry classifier ─────────────────────────────────────────
//
// Pure display-tier classifier, mirroring latency.js's classifyLatency — takes
// a number (days remaining until a TLS peer certificate expires) and returns
// a color/tier for display. No main.js twin: main.js only ships the raw
// certDaysRemaining number (computed in the TCP Ping secureConnect handler),
// all color/tier banding is a pure frontend concern, same as classifyLatency.

export function classifyCertExpiry(daysRemaining) {
  if (daysRemaining == null || isNaN(daysRemaining)) return null;
  if (daysRemaining < 30)  return { tier: 'Critical',      color: '#FF4B6A' };
  if (daysRemaining <= 60) return { tier: 'Expiring Soon', color: '#FFB020' };
  return                   { tier: 'Healthy',              color: '#00FF9C' };
}
