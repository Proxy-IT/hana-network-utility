export function parsePingOutput(raw) {
  const lines = raw.split('\n').filter(Boolean);
  const rtts = [];
  for (const line of lines) {
    const unixMatch = line.match(/time[<=]([\d.]+)\s*ms/i);
    if (unixMatch) { rtts.push(parseFloat(unixMatch[1])); continue; }
    const winMatch = line.match(/time[<=]([\d.]+)ms/i);
    if (winMatch) rtts.push(parseFloat(winMatch[1]));
  }
  let packetLoss = null;
  const lossMatch = raw.match(/([\d.]+)%\s*packet loss/i) || raw.match(/\(([\d.]+)%\s*loss\)/i);
  if (lossMatch) packetLoss = parseFloat(lossMatch[1]);
  const min = rtts.length ? Math.min(...rtts) : null;
  const max = rtts.length ? Math.max(...rtts) : null;
  const avg = rtts.length ? rtts.reduce((a, b) => a + b, 0) / rtts.length : null;
  return { rtts, min, max, avg: avg ? parseFloat(avg.toFixed(2)) : null, packetLoss };
}
export function parseTracerouteLines(raw) {
  return raw.split('\n').filter(Boolean).map((line) => {
    const hopMatch = line.match(/^\s*(\d+)\s+(.+)/);
    if (!hopMatch) return { raw: line };
    const hop = parseInt(hopMatch[1], 10);
    const rest = hopMatch[2];
    const rtts = [...rest.matchAll(/([\d.]+)\s*ms/gi)].map(m => parseFloat(m[1]));
    const ipMatch = rest.match(/\(?([\d]{1,3}\.[\d]{1,3}\.[\d]{1,3}\.[\d]{1,3})\)?/);
    const ip = ipMatch ? ipMatch[1] : null;
    const hostMatch = rest.match(/^([^\s(]+)\s*(?:\(|[\d])/);
    const host = hostMatch && hostMatch[1] !== '*' ? hostMatch[1] : null;
    const timeout = rest.includes('*') && rtts.length === 0;
    return { hop, ip, host, rtts, timeout, raw: line };
  });
}
