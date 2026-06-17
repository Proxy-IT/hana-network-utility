// ── Export utilities ──────────────────────────────────────────────────────────

function downloadFile(filename, content, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function timestamp() {
  const d = new Date();
  return d.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

// ── PING exports ──────────────────────────────────────────────────────────────

export function exportPingTxt({ host, output, rawOutput, samples, liveStats, continuous }) {
  const ts = new Date().toLocaleString();
  let lines = [
    '========================================',
    '  Look Look Network Utility Tools',
    '  Ping Report',
    '========================================',
    `Host       : ${host}`,
    `Mode       : ${continuous ? 'Continuous' : 'Fixed'}`,
    `Timestamp  : ${ts}`,
    '',
  ];

  if (continuous && liveStats) {
    lines.push('--- Summary ---');
    lines.push(`Packets Sent : ${liveStats.sent}`);
    lines.push(`Packets Lost : ${liveStats.lost}`);
    lines.push(`Packet Loss  : ${liveStats.loss}%`);
    lines.push(`Min RTT      : ${liveStats.min != null ? liveStats.min + ' ms' : 'N/A'}`);
    lines.push(`Avg RTT      : ${liveStats.avg != null ? liveStats.avg + ' ms' : 'N/A'}`);
    lines.push(`Max RTT      : ${liveStats.max != null ? liveStats.max + ' ms' : 'N/A'}`);
    lines.push('');
    lines.push('--- Sample Log ---');
    lines.push('Seq    RTT (ms)   Status');
    lines.push('------ ---------- -----------');
    samples.forEach(s => {
      const seq    = String(s.seq).padEnd(6);
      const rtt    = s.timeout ? 'timeout'.padEnd(10) : String(s.rtt + ' ms').padEnd(10);
      const status = s.timeout ? 'No response' : 'OK';
      lines.push(`${seq} ${rtt} ${status}`);
    });
  } else if (output && !output.error) {
    lines.push('--- Summary ---');
    lines.push(`Min RTT      : ${output.min != null ? output.min + ' ms' : 'N/A'}`);
    lines.push(`Avg RTT      : ${output.avg != null ? output.avg + ' ms' : 'N/A'}`);
    lines.push(`Max RTT      : ${output.max != null ? output.max + ' ms' : 'N/A'}`);
    lines.push(`Packet Loss  : ${output.packetLoss != null ? output.packetLoss + '%' : 'N/A'}`);
    lines.push('');
    lines.push('--- Raw Output ---');
    lines.push(rawOutput || '');
  }

  downloadFile(`ping_${host}_${timestamp()}.txt`, lines.join('\n'));
}

export function exportPingCsv({ host, output, samples, liveStats, continuous }) {
  let rows = [];
  if (continuous && samples.length > 0) {
    rows.push(['Seq', 'RTT_ms', 'Status', 'Host', 'Timestamp']);
    const ts = new Date().toLocaleString();
    samples.forEach(s => {
      rows.push([s.seq, s.timeout ? '' : s.rtt, s.timeout ? 'Timeout' : 'OK', host, ts]);
    });
    if (liveStats) {
      rows.push([]);
      rows.push(['Summary', '', '', '', '']);
      rows.push(['Sent', liveStats.sent, '', '', '']);
      rows.push(['Lost', liveStats.lost, '', '', '']);
      rows.push(['Loss_%', liveStats.loss, '', '', '']);
      rows.push(['Min_ms', liveStats.min ?? '', '', '', '']);
      rows.push(['Avg_ms', liveStats.avg ?? '', '', '', '']);
      rows.push(['Max_ms', liveStats.max ?? '', '', '', '']);
    }
  } else if (output && !output.error) {
    rows.push(['Packet', 'RTT_ms', 'Host']);
    (output.rtts || []).forEach((rtt, i) => rows.push([i + 1, rtt, host]));
    rows.push([]);
    rows.push(['Metric', 'Value', '']);
    rows.push(['Min_ms',  output.min  ?? '', '']);
    rows.push(['Avg_ms',  output.avg  ?? '', '']);
    rows.push(['Max_ms',  output.max  ?? '', '']);
    rows.push(['Loss_%',  output.packetLoss ?? '', '']);
  }
  const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  downloadFile(`ping_${host}_${timestamp()}.csv`, csv, 'text/csv');
}

// ── TRACEROUTE exports ────────────────────────────────────────────────────────

export function exportTraceTxt({ host, hops }) {
  const ts = new Date().toLocaleString();
  const lines = [
    '========================================',
    '  Look Look Network Utility Tools',
    '  Traceroute Report',
    '========================================',
    `Destination : ${host}`,
    `Timestamp   : ${ts}`,
    `Total Hops  : ${hops.filter(h => h.hop).length}`,
    '',
    'Hop    IP Address        Host                           RTT 1      RTT 2      RTT 3',
    '------ ----------------- ------------------------------ ---------- ---------- ----------',
  ];

  hops.forEach(hop => {
    if (!hop.hop) return;
    const hopN = String(hop.hop).padEnd(6);
    const ip   = (hop.ip   || '—').padEnd(17);
    const host2 = (hop.host || (hop.timeout ? '* * *' : '—')).padEnd(30).slice(0, 30);
    const rtts = [0,1,2].map(j =>
      hop.rtts?.[j] != null ? (hop.rtts[j] + ' ms').padEnd(10) : '*'.padEnd(10)
    );
    lines.push(`${hopN} ${ip} ${host2} ${rtts.join(' ')}`);
  });

  downloadFile(`traceroute_${host}_${timestamp()}.txt`, lines.join('\n'));
}

export function exportTraceCsv({ host, hops }) {
  const ts = new Date().toLocaleString();
  const rows = [
    ['Hop', 'IP_Address', 'Hostname', 'RTT1_ms', 'RTT2_ms', 'RTT3_ms', 'Avg_ms', 'Timeout', 'Destination', 'Timestamp'],
  ];
  hops.forEach(hop => {
    if (!hop.hop) return;
    const avg = hop.rtts?.length
      ? (hop.rtts.reduce((a,b) => a+b, 0) / hop.rtts.length).toFixed(1)
      : '';
    rows.push([
      hop.hop,
      hop.ip   || '',
      hop.host || '',
      hop.rtts?.[0] ?? '',
      hop.rtts?.[1] ?? '',
      hop.rtts?.[2] ?? '',
      avg,
      hop.timeout ? 'Yes' : 'No',
      host,
      ts,
    ]);
  });
  const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  downloadFile(`traceroute_${host}_${timestamp()}.csv`, csv, 'text/csv');
}

// ── SUBNET SWEEP exports ──────────────────────────────────────────────────────

export function exportSweepTxt({ baseIp, start, end, results }) {
  const ts    = new Date().toLocaleString();
  const alive = results.filter(r => r.alive);
  const dead  = results.filter(r => !r.alive);
  const lines = [
    '========================================',
    '  Look Look Network Utility Tools',
    '  Subnet Sweep Report',
    '========================================',
    `Range      : ${baseIp}.${start} → ${baseIp}.${end}`,
    `Timestamp  : ${ts}`,
    `Scanned    : ${results.length}`,
    `Live       : ${alive.length}`,
    `No Response: ${dead.length}`,
    '',
    '--- Live Hosts ---',
    ...alive.map(r => `  ${r.ip}`),
    '',
    '--- No Response ---',
    ...dead.map(r => `  ${r.ip}`),
  ];
  downloadFile(`sweep_${baseIp}_${timestamp()}.txt`, lines.join('\n'));
}

export function exportSweepCsv({ baseIp, start, end, results }) {
  const ts   = new Date().toLocaleString();
  const rows = [
    ['IP_Address', 'Status', 'Range', 'Timestamp'],
    ...results
      .sort((a, b) => {
        const aLast = parseInt(a.ip.split('.').pop(), 10);
        const bLast = parseInt(b.ip.split('.').pop(), 10);
        return aLast - bLast;
      })
      .map(r => [r.ip, r.alive ? 'Live' : 'No Response', `${baseIp}.${start}-${end}`, ts]),
  ];
  const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  downloadFile(`sweep_${baseIp}_${timestamp()}.csv`, csv, 'text/csv');
}
