// Parse traceroute output from macOS/Linux and Windows into structured hop data
//
// NOTE: this file previously also contained a `parsePingOutput` function.
// It was removed during the v1.8.0 migration — confirmed to have zero
// callers anywhere in the project (Hana's actual ping parsing lives in
// src/components/PingTool.js and, for the shared/tested version, in
// src/lib/pingParse.js — see mainValidatorParity.test.js and
// pingToolParity.test.js for why those two haven't been unified yet).

export function parseTracerouteLines(raw) {
  const lines = raw.split('\n').filter(Boolean);
  return lines.map((line, i) => {
    // Try to pull hop number, host/ip, and rtt values
    const hopMatch = line.match(/^\s*(\d+)\s+(.+)/);
    if (!hopMatch) return { raw: line };

    const hop = parseInt(hopMatch[1], 10);
    const rest = hopMatch[2];

    // Pull all ms values from the line
    const rtts = [...rest.matchAll(/([\d.]+)\s*ms/gi)].map(m => parseFloat(m[1]));

    // Pull IP address if present
    const ipMatch = rest.match(/\(?([\d]{1,3}\.[\d]{1,3}\.[\d]{1,3}\.[\d]{1,3})\)?/);
    const ip = ipMatch ? ipMatch[1] : null;

    // Pull hostname (word before ip or parens)
    const hostMatch = rest.match(/^([^\s(]+)\s*(?:\(|[\d])/);
    const host = hostMatch && hostMatch[1] !== '*' ? hostMatch[1] : null;

    const timeout = rest.includes('*') && rtts.length === 0;

    return { hop, ip, host, rtts, timeout, raw: line };
  });
}
