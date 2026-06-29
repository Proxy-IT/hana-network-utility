const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { exec, spawn } = require('child_process');
const os = require('os');

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0A0E1A',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  const isDev = !app.isPackaged;
  if (isDev) {
    win.loadURL('http://localhost:3000');
  } else {
    win.loadFile(path.join(__dirname, '../build/index.html'));
  }
  // Allow HTTP requests to ip-api.com and other API endpoints
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
          "font-src 'self' https://fonts.gstatic.com; " +
          "connect-src 'self' https: http://ip-api.com https://api.ipify.org https://rdap.org https://api.whois.vu;"
        ],
      },
    });
  });

  win.on('ready-to-show', () => win.show());
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// ── Helpers ───────────────────────────────────────────────────────────────────
const isWin = process.platform === 'win32';

function sysCmd(name) {
  if (!isWin) return name;
  return path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', name);
}

function execShell(cmd, opts, cb) {
  return exec(cmd, {
    timeout: opts.timeout || 10000,
    env: { ...process.env },
    shell: isWin ? 'cmd.exe' : '/bin/sh',
    ...opts,
  }, cb);
}

// ── PING (streaming, line by line) ───────────────────────────────────────────
ipcMain.on('ping-start', (event, { host, count }) => {
  // Validate inputs
  if (!isValidHost(host)) {
    event.sender.send('ping-error', { message: 'Invalid hostname or IP address.' });
    return;
  }
  const countInt = parseInt(count, 10);
  if (isNaN(countInt) || countInt < 1 || countInt > 100) {
    event.sender.send('ping-error', { message: 'Packet count must be between 1 and 100.' });
    return;
  }

  const cmd  = isWin ? sysCmd('ping.exe') : 'ping';
  const args = isWin ? ['-n', String(countInt), host.trim()] : ['-c', String(countInt), host.trim()];
  const proc = spawn(cmd, args, { env: { ...process.env } });
  let fullOutput = '';

  proc.stdout.on('data', (data) => {
    const text = data.toString();
    fullOutput += text;
    // Print raw output directly to the terminal running npm start
    process.stdout.write('=== PING RAW ===\n' + JSON.stringify(text) + '\n');

    text.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Detect unreachable — Windows returns "Reply from X.X.X.X: Destination host unreachable."
      // The reply comes FROM the router, not the target — treat as failure
      const unreachable = /unreachable/i.test(trimmed);

      // Extract RTT — only valid if NOT unreachable
      let rtt = null;
      if (!unreachable) {
        const winMatch  = trimmed.match(/time[<=]([\d.]+)ms/i);
        const unixMatch = trimmed.match(/time[<=]([\d.]+)\s*ms/i);
        if (winMatch)       rtt = parseFloat(winMatch[1]);
        else if (unixMatch) rtt = parseFloat(unixMatch[1]);
      }

      const timeout = /request timed out|no answer/i.test(trimmed);

      // Only send lines that are actual ping results
      const isResult = rtt !== null || timeout || unreachable ||
                       /bytes from|reply from/i.test(trimmed);

      if (isResult) {
        event.sender.send('ping-line', {
          line: trimmed,
          rtt,
          timeout: timeout || unreachable,
          unreachable,
          isErr: false,
        });
      } else if (trimmed && !/^pinging|^ping statistics|^---/i.test(trimmed)) {
        // Send summary/other lines (packet stats etc)
        event.sender.send('ping-line', { line: trimmed, rtt: null, timeout: false, unreachable: false, isErr: false });
      }
    });
  });

  proc.stderr.on('data', (data) => {
    event.sender.send('ping-line', { line: data.toString().trim(), rtt: null, timeout: false, unreachable: false, isErr: true });
  });

  proc.on('close', (code) => {
    event.sender.send('ping-done', { output: fullOutput, code });
  });

  continuousProcs.set('ping-' + event.sender.id, proc);
});

ipcMain.on('ping-stop', (event) => {
  const key  = 'ping-' + event.sender.id;
  const proc = continuousProcs.get(key);
  if (proc) {
    if (isWin) exec(`taskkill /pid ${proc.pid} /T /F`, { shell: 'cmd.exe' });
    else proc.kill();
    continuousProcs.delete(key);
  }
});

// ── CONTINUOUS PING (single host) ─────────────────────────────────────────────
const continuousProcs = new Map();

ipcMain.on('ping-continuous-start', (event, { host }) => {
  if (!isValidHost(host)) {
    event.sender.send('ping-continuous-error', { message: 'Invalid hostname or IP address.' });
    return;
  }
  const cmd  = isWin ? sysCmd('ping.exe') : 'ping';
  const args = isWin ? ['-t', host] : [host];
  const proc = spawn(cmd, args, { env: { ...process.env } });
  continuousProcs.set(event.sender.id, proc);

  proc.stdout.on('data', (data) => {
    data.toString().split('\n').forEach(line => {
      if (!line.trim()) return;
      let rtt = null;
      const winMatch  = line.match(/time[<=]([\d.]+)ms/i);
      const unixMatch = line.match(/time[<=]([\d.]+)\s*ms/i);
      if (winMatch)       rtt = parseFloat(winMatch[1]);
      else if (unixMatch) rtt = parseFloat(unixMatch[1]);
      const timeout     = /request timed out|no answer/i.test(line);
      const unreachable = /destination host unreachable|host unreachable|unreachable/i.test(line);
      if (rtt !== null || timeout || unreachable) {
        event.sender.send('ping-continuous-result', {
          rtt: unreachable ? null : rtt,
          timeout: timeout || unreachable,
          unreachable,
          line,
        });
      }
    });
  });

  proc.stderr.on('data', (data) => {
    event.sender.send('ping-continuous-result', { error: data.toString() });
  });

  proc.on('close', () => {
    continuousProcs.delete(event.sender.id);
    event.sender.send('ping-continuous-stopped');
  });
});

ipcMain.on('ping-continuous-stop', (event) => {
  const proc = continuousProcs.get(event.sender.id);
  if (proc) {
    if (isWin) exec(`taskkill /pid ${proc.pid} /T /F`, { shell: 'cmd.exe' });
    else proc.kill();
    continuousProcs.delete(event.sender.id);
  }
});

// ── MULTI-PING (multiple independent hosts) ───────────────────────────────────
// Each host gets its own process keyed by slotId
const multiPingProcs = new Map();

ipcMain.on('multi-ping-start', (event, { slotId, host }) => {
  if (!isValidHost(host)) {
    event.sender.send('multi-ping-error', { slotId, message: 'Invalid hostname or IP address.' });
    return;
  }
  // Kill existing proc for this slot if any
  if (multiPingProcs.has(slotId)) {
    const old = multiPingProcs.get(slotId);
    if (isWin) exec(`taskkill /pid ${old.pid} /T /F`, { shell: 'cmd.exe' });
    else old.kill();
    multiPingProcs.delete(slotId);
  }

  const cmd  = isWin ? sysCmd('ping.exe') : 'ping';
  const args = isWin ? ['-t', host] : [host];
  const proc = spawn(cmd, args, { env: { ...process.env } });
  multiPingProcs.set(slotId, proc);

  proc.stdout.on('data', (data) => {
    data.toString().split('\n').forEach(line => {
      if (!line.trim()) return;
      let rtt = null;
      const winMatch  = line.match(/time[<=]([\d.]+)ms/i);
      const unixMatch = line.match(/time[<=]([\d.]+)\s*ms/i);
      if (winMatch)       rtt = parseFloat(winMatch[1]);
      else if (unixMatch) rtt = parseFloat(unixMatch[1]);
      const timeout     = /request timed out|no answer/i.test(line);
      const unreachable = /destination host unreachable|host unreachable|unreachable/i.test(line);
      // If unreachable, ignore any rtt — it came from the router, not the target
      if (rtt !== null || timeout || unreachable) {
        event.sender.send('multi-ping-result', {
          slotId,
          rtt: unreachable ? null : rtt,
          timeout: timeout || unreachable,
          unreachable,
        });
      }
    });
  });

  proc.on('close', () => {
    multiPingProcs.delete(slotId);
    event.sender.send('multi-ping-stopped', { slotId });
  });
});

ipcMain.on('multi-ping-stop', (event, { slotId }) => {
  if (slotId === 'all') {
    multiPingProcs.forEach((proc, id) => {
      if (isWin) exec(`taskkill /pid ${proc.pid} /T /F`, { shell: 'cmd.exe' });
      else proc.kill();
    });
    multiPingProcs.clear();
  } else {
    const proc = multiPingProcs.get(slotId);
    if (proc) {
      if (isWin) exec(`taskkill /pid ${proc.pid} /T /F`, { shell: 'cmd.exe' });
      else proc.kill();
      multiPingProcs.delete(slotId);
    }
  }
});

// ── TRACEROUTE ────────────────────────────────────────────────────────────────
ipcMain.on('traceroute-start', (event, { host }) => {
  if (!isValidHost(host)) {
    event.sender.send('traceroute-error', { message: 'Invalid hostname or IP address.' });
    return;
  }
  const cmd     = isWin ? sysCmd('tracert.exe') : 'traceroute';
  const cmdArgs = isWin ? ['-d', host] : ['-m', '30', host];
  const proc    = spawn(cmd, cmdArgs, { env: { ...process.env } });
  let buffer = '';

  proc.stdout.on('data', (data) => {
    buffer += data.toString('binary');
    const lines = buffer.split('\n');
    buffer = lines.pop();
    lines.forEach(line => {
      if (line.trim()) event.sender.send('traceroute-data', { line: line + '\n' });
    });
  });
  proc.stderr.on('data', (data) => {
    event.sender.send('traceroute-data', { line: data.toString(), isErr: true });
  });
  proc.on('close', (code) => {
    if (buffer.trim()) event.sender.send('traceroute-data', { line: buffer });
    event.sender.send('traceroute-done', { code });
  });
  continuousProcs.set('tracert-' + event.sender.id, proc);
});

ipcMain.on('traceroute-stop', (event) => {
  const key  = 'tracert-' + event.sender.id;
  const proc = continuousProcs.get(key);
  if (proc) {
    if (isWin) exec(`taskkill /pid ${proc.pid} /T /F`, { shell: 'cmd.exe' });
    else proc.kill();
    continuousProcs.delete(key);
  }
});

// ── SUBNET SWEEP ─────────────────────────────────────────────────────────────
ipcMain.on('subnet-sweep-start', (event, { baseIp, start, end }) => {

  // ── Security: validate all inputs server-side before use ──────────────────
  // Strictly validate base IP — must be exactly three octets of 0-255
  const baseIpRegex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const baseIpMatch = baseIpRegex.exec(baseIp);
  if (!baseIpMatch) {
    event.sender.send('sweep-error', { message: 'Invalid base IP address format.' });
    return;
  }
  // Each octet must be 0-255
  const octets = [baseIpMatch[1], baseIpMatch[2], baseIpMatch[3]];
  if (octets.some(o => parseInt(o, 10) > 255)) {
    event.sender.send('sweep-error', { message: 'Invalid base IP address — octet out of range.' });
    return;
  }
  // Validate start/end are integers in range
  const startInt = parseInt(start, 10);
  const endInt   = parseInt(end, 10);
  if (isNaN(startInt) || isNaN(endInt) || startInt < 1 || endInt > 254 || startInt > endInt) {
    event.sender.send('sweep-error', { message: 'Invalid scan range.' });
    return;
  }

  // Reconstruct clean base IP from validated parts — never use raw user input
  const safeBase = `${parseInt(octets[0],10)}.${parseInt(octets[1],10)}.${parseInt(octets[2],10)}`;

  let completed = 0;
  const total   = endInt - startInt + 1;
  const BATCH   = 20;
  let nextIdx   = startInt;

  sweepActive = true;

  function pingOne(i) {
    if (!sweepActive) return;

    const ip   = `${safeBase}.${i}`;
    const cmd  = isWin ? sysCmd('ping.exe') : 'ping';
    const args = isWin
      ? ['-n', '1', '-w', '1500', ip]
      : ['-c', '1', '-W', '2', ip];

    const proc = spawn(cmd, args, { env: { ...process.env } });
    activeSweepProcs.add(proc);
    let stdout = '';

    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.on('close', () => {
      activeSweepProcs.delete(proc);
      if (!sweepActive) return;

      let alive = false;
      if (stdout) {
        alive = isWin
          ? /Reply from/i.test(stdout) && !/unreachable/i.test(stdout)
          : /bytes from/i.test(stdout) || /ttl=/i.test(stdout);
      }
      event.sender.send('sweep-result', { ip, alive });
      completed++;
      if (nextIdx <= endInt) pingOne(nextIdx++);
      if (completed === total) {
        sweepActive = false;
        event.sender.send('sweep-done', {});
      }
    });

    setTimeout(() => { try { proc.kill(); } catch {} }, 5000);
  }

  for (let i = 0; i < BATCH && nextIdx <= endInt; i++) pingOne(nextIdx++);
});

// ── INPUT VALIDATION HELPERS ─────────────────────────────────────────────────
function isValidHost(host) {
  if (!host || typeof host !== 'string') return false;
  const trimmed = host.trim();
  if (trimmed.length === 0 || trimmed.length > 253) return false;
  // Block shell metacharacters and characters invalid in hostnames/IPs
  if (/[;&|`$<>\(\)\[\]{}'"\\@!#%^*=+,~]/.test(trimmed)) return false;
  // Must contain only valid hostname/IP characters
  if (!/^[a-zA-Z0-9._:\-]+$/.test(trimmed)) return false;
  return true;
}

function isValidIpv4(ip) {
  if (!ip || typeof ip !== 'string') return false;
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return false;
  return parts.every(p => /^\d{1,3}$/.test(p) && parseInt(p, 10) <= 255);
}

function isValidIpv6(ip) {
  if (!ip || typeof ip !== 'string') return false;
  return /^[0-9a-fA-F:]+$/.test(ip.trim()) && ip.includes(':');
}

const VALID_DNS_TYPES = new Set(['A','AAAA','CNAME','MX','TXT','NS','PTR','ALL']);

// ── OPEN EXTERNAL LINKS ──────────────────────────────────────────────────────
ipcMain.on('open-external', (event, url) => {
  shell.openExternal(url);
});

// ── DNS LOOKUP ───────────────────────────────────────────────────────────────
ipcMain.handle('dns-lookup', async (event, { host, type, server }) => {
  // Validate host
  if (!isValidHost(host)) {
    return { success: false, results: [], errors: [{ type: 'ERROR', message: 'Invalid hostname or IP address.' }] };
  }
  // Validate record type against allowlist
  if (!VALID_DNS_TYPES.has(type)) {
    return { success: false, results: [], errors: [{ type: 'ERROR', message: `Invalid record type: ${type}` }] };
  }
  // Validate DNS server if custom
  if (server && server !== '8.8.8.8' && server !== '1.1.1.1') {
    if (!isValidIpv4(server) && !isValidIpv6(server)) {
      return { success: false, results: [], errors: [{ type: 'ERROR', message: 'Invalid DNS server address.' }] };
    }
  }

  return new Promise((resolve) => {
    const dns = require('dns');
    // Use per-request resolver for isolation — never mutate global dns settings
    const resolver = new dns.Resolver();
    if (server) resolver.setServers([server.trim()]);

    const results = [];
    const errors  = [];
    const types   = type === 'ALL' ? ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'PTR'] : [type];
    let pending   = types.length;

    function done() {
      pending--;
      if (pending === 0) {
        resolve({ success: true, results, errors });
      }
    }

    // Detect if input is an IP for reverse lookup
    const isIp = /^[\d.]+$/.test(host) || /^[0-9a-fA-F:]+$/.test(host);

    types.forEach(t => {
      if (t === 'PTR' && !isIp) { pending--; if (pending === 0) resolve({ success: true, results, errors }); return; }
      if (t === 'A' && isIp)    { pending--; if (pending === 0) resolve({ success: true, results, errors }); return; }

      try {
        if (t === 'A') {
          resolver.resolve4(host.trim(), { ttl: true }, (err, addrs) => {
            if (!err && addrs) addrs.forEach(a => results.push({ type: 'A', value: a.address, ttl: a.ttl }));
            else if (err) errors.push({ type: 'A', message: err.message });
            done();
          });
        } else if (t === 'AAAA') {
          resolver.resolve6(host.trim(), { ttl: true }, (err, addrs) => {
            if (!err && addrs) addrs.forEach(a => results.push({ type: 'AAAA', value: a.address, ttl: a.ttl }));
            else if (err) errors.push({ type: 'AAAA', message: err.message });
            done();
          });
        } else if (t === 'CNAME') {
          resolver.resolveCname(host.trim(), (err, addrs) => {
            if (!err && addrs) addrs.forEach(a => results.push({ type: 'CNAME', value: a, ttl: null }));
            else if (err) errors.push({ type: 'CNAME', message: err.message });
            done();
          });
        } else if (t === 'MX') {
          resolver.resolveMx(host.trim(), (err, addrs) => {
            if (!err && addrs) addrs.forEach(a => results.push({ type: 'MX', value: a.exchange, priority: a.priority, ttl: null }));
            else if (err) errors.push({ type: 'MX', message: err.message });
            done();
          });
        } else if (t === 'TXT') {
          resolver.resolveTxt(host.trim(), (err, addrs) => {
            if (!err && addrs) addrs.forEach(a => results.push({ type: 'TXT', value: a.join(' '), ttl: null }));
            else if (err) errors.push({ type: 'TXT', message: err.message });
            done();
          });
        } else if (t === 'NS') {
          resolver.resolveNs(host.trim(), (err, addrs) => {
            if (!err && addrs) addrs.forEach(a => results.push({ type: 'NS', value: a, ttl: null }));
            else if (err) errors.push({ type: 'NS', message: err.message });
            done();
          });
        } else if (t === 'PTR') {
          resolver.reverse(host.trim(), (err, addrs) => {
            if (!err && addrs) addrs.forEach(a => results.push({ type: 'PTR', value: a, ttl: null }));
            else if (err) errors.push({ type: 'PTR', message: err.message });
            done();
          });
        } else {
          done();
        }
      } catch (e) {
        errors.push({ type: t, message: e.message });
        done();
      }
    });
  });
});

// ── PORT SCANNER ──────────────────────────────────────────────────────────────
ipcMain.on('portscan-start', (event, { host, ports }) => {
  // Validate host
  if (!isValidHost(host)) {
    event.sender.send('portscan-error', { message: 'Invalid hostname or IP address.' });
    return;
  }
  // Validate ports array
  if (!Array.isArray(ports) || ports.length === 0) {
    event.sender.send('portscan-error', { message: 'No ports specified.' });
    return;
  }
  if (ports.length > 500) {
    event.sender.send('portscan-error', { message: 'Too many ports — maximum is 500.' });
    return;
  }
  const invalidPort = ports.find(p => !Number.isInteger(p) || p < 1 || p > 65535);
  if (invalidPort !== undefined) {
    event.sender.send('portscan-error', { message: `Invalid port: ${invalidPort}. Ports must be integers between 1 and 65535.` });
    return;
  }

  const net      = require('net');
  const total    = ports.length;
  let completed  = 0;
  const TIMEOUT  = 2000;
  const BATCH    = 20; // max concurrent connections
  let nextIdx    = 0;

  function scanPort(port) {
    const socket = new net.Socket();
    let status   = 'filtered';

    socket.setTimeout(TIMEOUT);

    socket.on('connect', () => {
      status = 'open';
      socket.destroy();
    });

    socket.on('timeout', () => {
      status = 'filtered';
      socket.destroy();
    });

    socket.on('error', (err) => {
      if (err.code === 'ECONNREFUSED') {
        status = 'closed';
      } else {
        status = 'filtered';
      }
      socket.destroy();
    });

    socket.on('close', () => {
      event.sender.send('portscan-result', { port, status });
      completed++;

      // Dispatch next port in queue
      if (nextIdx < ports.length) {
        scanPort(ports[nextIdx++]);
      }

      if (completed === total) {
        event.sender.send('portscan-done', {});
      }
    });

    socket.connect(port, host);
  }

  // Kick off initial batch
  const initialBatch = Math.min(BATCH, ports.length);
  nextIdx = initialBatch;
  for (let i = 0; i < initialBatch; i++) {
    scanPort(ports[i]);
  }
});

// ── SUBNET SWEEP STOP ────────────────────────────────────────────────────────
// Separate active flag from process set — fixes taskkill /pid undefined bug
let sweepActive = false;
const activeSweepProcs = new Set(); // contains ONLY process objects

ipcMain.on('subnet-sweep-stop', (event) => {
  sweepActive = false;
  activeSweepProcs.forEach(proc => {
    try {
      if (isWin) exec(`taskkill /pid ${proc.pid} /T /F`, { shell: 'cmd.exe' });
      else proc.kill();
    } catch {}
  });
  activeSweepProcs.clear();
  event.sender.send('sweep-stopped', {});
});

// ── SUBNET SWEEP (CIDR mode — list of IPs) ───────────────────────────────────
ipcMain.on('subnet-sweep-list-start', (event, { ips }) => {
  if (!Array.isArray(ips) || ips.length === 0) {
    event.sender.send('sweep-error', { message: 'No IPs to scan.' });
    return;
  }
  if (ips.length > 65534) {
    event.sender.send('sweep-error', { message: 'Too many hosts — maximum is 65,534.' });
    return;
  }

  // Validate every IP in the list
  const ipRegex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  for (const ip of ips) {
    const m = ipRegex.exec(ip);
    if (!m || m.slice(1).some(o => parseInt(o,10) > 255)) {
      event.sender.send('sweep-error', { message: `Invalid IP in list: ${ip}` });
      return;
    }
  }

  let completed = 0;
  const total   = ips.length;
  const BATCH   = 30;
  let nextIdx   = BATCH;

  function pingIp(ip) {
    if (!sweepActive) return;

    const cmd  = isWin ? sysCmd('ping.exe') : 'ping';
    const args = isWin ? ['-n','1','-w','1500',ip] : ['-c','1','-W','2',ip];
    const proc = spawn(cmd, args, { env: { ...process.env } });
    activeSweepProcs.add(proc);
    let stdout  = '';

    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.on('close', () => {
      activeSweepProcs.delete(proc);
      if (!sweepActive) return;

      const alive = isWin
        ? /Reply from/i.test(stdout) && !/unreachable/i.test(stdout)
        : /bytes from/i.test(stdout) || /ttl=/i.test(stdout);

      event.sender.send('sweep-result', { ip, alive });
      completed++;
      if (nextIdx < ips.length) pingIp(ips[nextIdx++]);
      if (completed === total) {
        sweepActive = false;
        event.sender.send('sweep-done', {});
      }
    });

    setTimeout(() => { try { proc.kill(); } catch {} }, 5000);
  }

  sweepActive = true;

  for (let i = 0; i < Math.min(BATCH, ips.length); i++) {
    pingIp(ips[i]);
  }
});

// ── SYSTEM INFO ───────────────────────────────────────────────────────────────
ipcMain.handle('get-system-info', async () => ({
  platform: process.platform,
  hostname: os.hostname(),
  networkInterfaces: os.networkInterfaces(),
}));
