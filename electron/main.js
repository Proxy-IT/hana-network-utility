const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { exec, spawn } = require('child_process');
const os = require('os');
const updater = require('./updater');

function createWindow() {
  const isDev = !app.isPackaged;
  // The favicon.ico copy in public/ (dev) or build/ (packaged, copied there by
  // Vite) doubles as the window/taskbar icon — avoids shipping build-resources/
  // in the packaged app just for this.
  const iconPath = isDev
    ? path.join(__dirname, '../public/favicon.ico')
    : path.join(__dirname, '../build/favicon.ico');

  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0A0E1A',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '../build/index.html'));
  }

  // ── Content Security Policy ─────────────────────────────────────────────────
  // Production CSP is locked to the exact domains Hana calls (verified by a
  // fresh grep of every fetch() in src/ as of this migration — see the v1.8.0
  // migration notes for the scan). No 'unsafe-eval', no wildcard connect-src.
  //
  // Development CSP is slightly looser: it needs 'unsafe-eval' and a websocket
  // connection for Vite's dev server / HMR, neither of which exist in the
  // packaged app.
  //
  // NOTE: 'unsafe-inline' remains in style-src because every Hana component
  // uses React inline style objects (style={s.xxx}) throughout, which the
  // browser treats as inline styles requiring this directive. Removing it
  // requires a full CSS-modules refactor, which is intentionally scoped out
  // of this migration — it's a separate, larger project (see engineering
  // backlog: CSP Hardening Phase 2).
  const isProd = app.isPackaged;

  const ALLOWED_CONNECT = [
    "'self'",
    "https://ipinfo.io",             // IP Info — geolocation (HTTPS; replaces the old http://ip-api.com)
    "https://api.ipify.org",         // IP Info — public IP detection
    "https://rdap.org",              // IP Info — WhoIs / RDAP (domain + IP lookups)
    "https://api.whois.vu",          // IP Info — raw WhoIs fallback
    "https://fonts.googleapis.com",  // Google Fonts stylesheet
    "https://fonts.gstatic.com",     // Google Fonts font files
  ].join(' ');

  const CSP_PROD = [
    "default-src 'none'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    `connect-src ${ALLOWED_CONNECT}`,
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join('; ');

  const CSP_DEV = [
    "default-src 'none'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",   // eval needed for Vite HMR
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    `connect-src 'self' ws://localhost:5173 ${ALLOWED_CONNECT}`,
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join('; ');

  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [ isProd ? CSP_PROD : CSP_DEV ],
      },
    });
  });

  win.on('ready-to-show', () => win.show());
}

app.whenReady().then(() => {
  createWindow();
  updater.init();
  updater.maybeRunStartupCheck();  // no-op unless the user opted in (default off)
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// ── AUTO-UPDATER IPC ─────────────────────────────────────────────────────────
// Thin delegators to electron/updater.js. Registered here (not in the module)
// so the IPC contract checker, which scans main.js, sees these channels.
ipcMain.on('update-check',    () => updater.checkForUpdates());
ipcMain.on('update-download', () => updater.downloadUpdate());
ipcMain.on('update-install',  () => updater.quitAndInstall());
ipcMain.handle('update-get-state',      () => updater.getState());
ipcMain.handle('update-set-auto-check', (event, value) => updater.setAutoCheck(value));

// ── Helpers ───────────────────────────────────────────────────────────────────
const isWin = process.platform === 'win32';

function sysCmd(name) {
  if (!isWin) return name;
  return path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', name);
}

// powershell.exe doesn't live directly under System32 like ping.exe/tracert.exe
// do, so it gets its own resolver rather than overloading sysCmd().
function sysPowershell() {
  return path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
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

// Single-port bounds check, shared by Port Scanner (per-element, after
// normalizing its ports array) and TCP Ping (single port field).
function isValidPort(port) {
  const n = parseInt(port, 10);
  return !isNaN(n) && n >= 1 && n <= 65535;
}

function isValidTcpPingTimeout(ms) {
  const n = parseInt(ms, 10);
  return !isNaN(n) && n >= 200 && n <= 10000;
}

const VALID_DNS_TYPES = new Set(['A','AAAA','CNAME','MX','TXT','NS','PTR','ALL']);

// ── OPEN EXTERNAL LINKS ──────────────────────────────────────────────────────
ipcMain.on('open-external', (event, url) => {
  // Only allow http(s) URLs — never file://, smb://, or other protocol handlers.
  // This prevents a compromised renderer from invoking arbitrary OS protocol
  // handlers via shell.openExternal.
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      shell.openExternal(url);
    }
  } catch {
    // Malformed URL — ignore silently
  }
});

// ── SYSTEM INFO ───────────────────────────────────────────────────────────────
// Provides hostname and platform for the sidebar footer display.
ipcMain.handle('get-system-info', async () => ({
  platform: process.platform,
  hostname: os.hostname(),
  networkInterfaces: os.networkInterfaces(),
}));

// ── LOCAL NETWORK INTERFACES ──────────────────────────────────────────────────
// Classifies each active network interface as wired/wifi/other for IP Info's
// local-interface selector. Node's os.networkInterfaces() has no concept of
// interface type, so this shells out to a platform command — no user input
// reaches either command, the simplest handler in this file from an
// injection-safety standpoint — and merges the classification in. If the
// platform command fails or produces unparseable output, falls back to
// returning every interface tagged 'unknown' rather than erroring out.
//
// The four functions below are hand-copied, parity-tested twins of
// src/lib/networkInterfaceParse.js — see
// src/lib/__tests__/mainValidatorParity.test.js for why main.js doesn't
// require() the ESM lib files directly (CommonJS/ESM boundary; deliberately
// deferred unification). Keep them in sync.
function classifyWindowsMedia(physicalMediaType) {
  const v = (physicalMediaType || '').trim();
  if (v === '802.3') return 'wired';
  if (v === 'Native 802.11' || v === 'Wireless LAN') return 'wifi';
  return 'other';
}
function parseWindowsAdapterJson(jsonText) {
  if (!jsonText || !jsonText.trim()) return [];
  const parsed = JSON.parse(jsonText);
  const list = Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);
  return list.map(a => ({ name: a.Name, type: classifyWindowsMedia(a.PhysicalMediaType) }));
}
function classifyMacHardwarePort(hardwarePortName) {
  const v = hardwarePortName || '';
  if (/Wi-Fi/i.test(v)) return 'wifi';
  if (/Ethernet/i.test(v)) return 'wired';
  return 'other';
}
function parseMacHardwarePorts(rawText) {
  if (!rawText || !rawText.trim()) return [];
  const results = [];
  const blocks = rawText.split(/\r?\n\r?\n/);
  for (const block of blocks) {
    const portMatch   = block.match(/^Hardware Port:\s*(.+)$/m);
    const deviceMatch = block.match(/^Device:\s*(.+)$/m);
    if (portMatch && deviceMatch) {
      results.push({ name: deviceMatch[1].trim(), type: classifyMacHardwarePort(portMatch[1].trim()) });
    }
  }
  return results;
}

ipcMain.handle('get-local-interfaces', async () => {
  const rawIfaces = os.networkInterfaces();

  // Run the platform command and classify adapter types. Any failure here
  // (spawn error, non-zero exit, unparseable output, or a 5s hang — matching
  // the timeout convention every other one-shot spawn() in this file uses,
  // e.g. ping-start/subnet-sweep's pingOne()) leaves typeByName empty and
  // sets classificationFailed, so every interface below falls back to
  // 'unknown' rather than the whole handler erroring out or hanging forever.
  let typeByName = new Map();
  let classificationFailed = false;
  try {
    const output = await new Promise((resolve, reject) => {
      const cmd  = isWin ? sysPowershell() : 'networksetup';
      const args = isWin
        ? ['-NoProfile', '-NonInteractive', '-Command', 'Get-NetAdapter | Select-Object Name,PhysicalMediaType,Status | ConvertTo-Json']
        : ['-listallhardwareports'];
      const proc = spawn(cmd, args);
      let stdout = '', stderr = '', settled = false;
      const killTimer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try { proc.kill(); } catch {}
        reject(new Error('Timed out waiting for interface classification command.'));
      }, 5000);
      proc.stdout.on('data', d => { stdout += d.toString(); });
      proc.stderr.on('data', d => { stderr += d.toString(); });
      proc.on('error', err => {
        if (settled) return;
        settled = true;
        clearTimeout(killTimer);
        reject(err);
      });
      proc.on('close', code => {
        if (settled) return;
        settled = true;
        clearTimeout(killTimer);
        if (code !== 0) reject(new Error(stderr || `exited with code ${code}`));
        else resolve(stdout);
      });
    });
    const classified = isWin ? parseWindowsAdapterJson(output) : parseMacHardwarePorts(output);
    typeByName = new Map(classified.map(c => [c.name, c.type]));
  } catch {
    // Graceful degradation — typeByName stays empty, every interface below
    // falls back to 'unknown', and classificationFailed lets the renderer
    // explain WHY rather than silently defaulting to whatever interface
    // os.networkInterfaces() happens to enumerate first.
    classificationFailed = true;
  }

  const interfaces = Object.entries(rawIfaces).map(([name, addresses]) => ({
    name,
    type: typeByName.get(name) || 'unknown',
    addresses: (addresses || []).map(a => ({ family: a.family, address: a.address, cidr: a.cidr })),
    mac: addresses && addresses[0] ? addresses[0].mac : null,
    internal: addresses && addresses[0] ? addresses[0].internal : true,
  }));

  // Default selection: first active (non-internal, has a real IPv4 address)
  // wired interface; else first such wifi; else first available non-internal
  // interface of any type; else null. os.networkInterfaces() does not
  // reliably omit every disabled/addressless adapter across all platforms,
  // so the "has ≥1 address" filter is explicit here, not assumed free.
  const active = interfaces.filter(i => !i.internal && i.addresses.some(a => a.family === 'IPv4'));
  const defaultIface =
    active.find(i => i.type === 'wired') ||
    active.find(i => i.type === 'wifi') ||
    active[0] ||
    null;

  return { interfaces, defaultName: defaultIface ? defaultIface.name : null, classificationFailed };
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
// Single active scan at a time (the app is single-window). The flag halts the
// queue and the socket set lets a stop request tear down in-flight connections.
let portScanActive = false;
const activeScanSockets = new Set();

ipcMain.on('portscan-stop', () => {
  portScanActive = false;
  activeScanSockets.forEach(sock => { try { sock.destroy(); } catch {} });
  activeScanSockets.clear();
});

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
  // Defensively coerce to integers — IPC serialization can sometimes convert
  // numbers to strings; parseInt ensures consistent integer types
  const normalizedPorts = ports.map(p => parseInt(p, 10));
  if (normalizedPorts.length > 500) {
    event.sender.send('portscan-error', { message: 'Too many ports — maximum is 500.' });
    return;
  }
  const invalidPort = normalizedPorts.find(p => !isValidPort(p));
  if (invalidPort !== undefined) {
    event.sender.send('portscan-error', { message: `Invalid port: ${invalidPort}. Ports must be integers between 1 and 65535.` });
    return;
  }
  ports = normalizedPorts; // use the normalized array from here on

  // Fresh scan — clear any lingering state from a previous run
  portScanActive = false;
  activeScanSockets.forEach(sock => { try { sock.destroy(); } catch {} });
  activeScanSockets.clear();
  portScanActive = true;

  const net      = require('net');
  const total    = ports.length;
  let completed  = 0;
  const TIMEOUT  = 2000;
  const BATCH    = 20; // max concurrent connections
  let nextIdx    = 0;

  function scanPort(port) {
    const socket = new net.Socket();
    let status   = 'filtered';
    activeScanSockets.add(socket);

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
      activeScanSockets.delete(socket);
      // A stop request cancelled the scan — don't emit results or dispatch more
      if (!portScanActive) return;

      event.sender.send('portscan-result', { port, status });
      completed++;

      // Dispatch next port in queue
      if (nextIdx < ports.length) {
        scanPort(ports[nextIdx++]);
      }

      if (completed === total) {
        portScanActive = false;
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

// ── TCP PING ──────────────────────────────────────────────────────────────────
// Repeated TCP-connect probing of a single host:port, with per-phase timing
// (DNS resolution, TCP connect, optional TLS handshake) and explicit failure
// classification. Unlike Port Scanner (many ports, batched concurrently) this
// targets ONE endpoint repeatedly, so it's a serial loop — one attempt in
// flight at a time, next attempt scheduled once the current one settles.
//
// classifyTcpError below is a hand-copied, parity-tested twin of
// src/lib/tcpPingClassify.js's classifyTcpError — see
// src/lib/__tests__/mainValidatorParity.test.js for why main.js doesn't
// require() the ESM lib files directly (CommonJS/ESM boundary; deliberately
// deferred unification). Keep the two in sync.
function classifyTcpError(err) {
  const code = err && err.code;
  if (code === 'ECONNREFUSED') return 'refused';
  if (code === 'ECONNRESET')   return 'reset';
  if (code === 'EHOSTUNREACH' || code === 'ENETUNREACH' || code === 'EHOSTDOWN') return 'unreachable';
  return 'error';
}

let tcpPingActive     = false;
let tcpPingTimer      = null;
let tcpPingSocket     = null; // raw net.Socket OR tls.TLSSocket, whichever is currently open
let tcpPingGeneration = 0;    // bumped on every stop/restart so a stale async callback from a
                              // torn-down session can never be mistaken for the current one,
                              // even after tcpPingActive has already flipped back to true for
                              // a brand-new session (dns.lookup/socket events can't be cancelled)

function tcpPingTeardown() {
  tcpPingGeneration++;
  tcpPingActive = false;
  if (tcpPingTimer)  { clearTimeout(tcpPingTimer); tcpPingTimer = null; }
  if (tcpPingSocket) { try { tcpPingSocket.destroy(); } catch {} tcpPingSocket = null; }
}

ipcMain.on('tcpping-stop', (event) => {
  tcpPingTeardown();
  event.sender.send('tcpping-stopped');
});

ipcMain.on('tcpping-start', (event, { host, port, count, timeoutMs, tls: useTls }) => {
  if (!isValidHost(host)) {
    event.sender.send('tcpping-error', { message: 'Invalid hostname or IP address.' });
    return;
  }
  if (!isValidPort(port)) {
    event.sender.send('tcpping-error', { message: 'Invalid port. Port must be an integer between 1 and 65535.' });
    return;
  }
  if (!isValidTcpPingTimeout(timeoutMs)) {
    event.sender.send('tcpping-error', { message: 'Timeout must be between 200 and 10000 ms.' });
    return;
  }
  const hasCount = count !== undefined && count !== null;
  const countInt = hasCount ? parseInt(count, 10) : null;
  if (hasCount && (isNaN(countInt) || countInt < 1 || countInt > 100)) {
    event.sender.send('tcpping-error', { message: 'Attempt count must be between 1 and 100.' });
    return;
  }

  // Fresh session — tear down any lingering state from a previous run, then
  // fix this session's identity so every closure below can tell a stale
  // callback (from whatever session existed before this teardown) apart from
  // its own.
  tcpPingTeardown();
  tcpPingActive = true;
  const myGeneration = tcpPingGeneration;

  const dns     = require('dns');
  const net     = require('net');
  const tls     = require('tls');
  const portInt = parseInt(port, 10);
  const timeout = parseInt(timeoutMs, 10);
  const INTERVAL = 1000;
  let seq = 0;

  function isCurrent() {
    return tcpPingActive && tcpPingGeneration === myGeneration;
  }

  function scheduleNext() {
    if (!isCurrent()) return;
    if (countInt && seq >= countInt) {
      tcpPingActive = false;
      event.sender.send('tcpping-done', {});
      return;
    }
    tcpPingTimer = setTimeout(attempt, INTERVAL);
  }

  // Builds the failure-shaped result payload — every failure branch shares
  // this shape (only status/error/connectMs vary; tlsMs and totalMs are
  // always null on failure).
  function fail(status, error, extra = {}) {
    return { status, connectMs: null, tlsMs: null, totalMs: null, error, ...extra };
  }

  function attempt() {
    if (!isCurrent()) return;
    seq++;
    const currentSeq = seq;
    const dnsStart = process.hrtime.bigint();
    let dnsSettled = false;

    function emit(dnsMs, payload) {
      event.sender.send('tcpping-result', { seq: currentSeq, dnsMs: dnsMs != null ? parseFloat(dnsMs.toFixed(2)) : null, ...payload });
      scheduleNext();
    }

    // dns.lookup() has no built-in timeout and can't be cancelled — this
    // timer polyfills one so a hanging/black-holed resolver still respects
    // the configured timeout instead of stalling the whole probe loop
    // indefinitely. If the real lookup eventually does return, dnsSettled
    // makes it a no-op.
    const dnsTimer = setTimeout(() => {
      if (dnsSettled) return;
      dnsSettled = true;
      if (!isCurrent()) return;
      const dnsMs = Number(process.hrtime.bigint() - dnsStart) / 1e6;
      emit(dnsMs, fail('dns-timeout', 'DNS lookup timed out'));
    }, timeout);

    dns.lookup(host, (dnsErr, address) => {
      if (dnsSettled) return;
      dnsSettled = true;
      clearTimeout(dnsTimer);
      if (!isCurrent()) return;
      const dnsMs = Number(process.hrtime.bigint() - dnsStart) / 1e6;

      if (dnsErr) {
        emit(dnsMs, fail('dns-error', dnsErr.message));
        return;
      }

      const socket = new net.Socket();
      tcpPingSocket = socket;
      let settled = false;
      const connectStart = process.hrtime.bigint();

      function finish(payload) {
        if (settled || !isCurrent()) return;
        settled = true;
        emit(dnsMs, payload);
      }

      socket.setTimeout(timeout);

      socket.on('connect', () => {
        if (!isCurrent()) { socket.destroy(); return; }
        const connectMs = Number(process.hrtime.bigint() - connectStart) / 1e6;

        if (!useTls) {
          finish({
            status: 'success', connectMs: parseFloat(connectMs.toFixed(2)), tlsMs: null,
            totalMs: parseFloat((dnsMs + connectMs).toFixed(2)), error: null,
          });
          socket.destroy();
          return;
        }

        // Hand off to TLS on the SAME already-open socket (not a second
        // connection) — disarm the raw socket's timeout first so it can't
        // fire mid-handshake alongside the TLS socket's own timeout.
        socket.setTimeout(0);
        const tlsStart = process.hrtime.bigint();
        let tlsSocket;
        try {
          tlsSocket = tls.connect({ socket, servername: host, rejectUnauthorized: false });
        } catch (e) {
          finish(fail('tls-error', e.message, { connectMs: parseFloat(connectMs.toFixed(2)) }));
          socket.destroy();
          return;
        }
        tcpPingSocket = tlsSocket;
        tlsSocket.setTimeout(timeout);

        tlsSocket.once('secureConnect', () => {
          const tlsMs = Number(process.hrtime.bigint() - tlsStart) / 1e6;

          // Read peer certificate details BEFORE destroy() — cert data is
          // gone once the socket closes. Read-only inspection: this never
          // feeds into any trust decision (rejectUnauthorized stays false,
          // unchanged), it's informational display only, same spirit as
          // the TLS timing itself.
          let certValidTo = null, certDaysRemaining = null, certSubjectCN = null,
              certIssuerCN = null, certSubjectAltName = null;
          try {
            const cert = tlsSocket.getPeerCertificate();
            if (cert && cert.valid_to) {
              certValidTo = cert.valid_to;
              const validToMs = Date.parse(cert.valid_to);
              if (!isNaN(validToMs)) {
                certDaysRemaining = Math.floor((validToMs - Date.now()) / 86400000);
              }
              certSubjectCN = cert.subject?.CN ?? null;
              certIssuerCN  = cert.issuer?.CN ?? null;
              // Raw SAN string, e.g. "DNS:example.com, DNS:www.example.com".
              // Attacker-controlled and unbounded (shared certs can carry
              // hundreds of entries), so it is capped here rather than trusted
              // to be small; consumers escape it again before rendering.
              //
              // The cap is trimmed back to the last complete entry: cutting at
              // a fixed offset can leave a fragment like "DNS:parti", which
              // then renders in the UI and in calendar reminders as though it
              // were a real hostname.
              if (typeof cert.subjectaltname === 'string') {
                let san = cert.subjectaltname;
                if (san.length > 4096) {
                  san = san.slice(0, 4096);
                  const lastBoundary = san.lastIndexOf(',');
                  if (lastBoundary > 0) san = san.slice(0, lastBoundary);
                }
                certSubjectAltName = san;
              }
            }
          } catch {
            // Defensive only — getPeerCertificate() shouldn't throw post-handshake.
          }

          finish({
            status: 'success', connectMs: parseFloat(connectMs.toFixed(2)), tlsMs: parseFloat(tlsMs.toFixed(2)),
            totalMs: parseFloat((dnsMs + connectMs + tlsMs).toFixed(2)), error: null,
            certValidTo, certDaysRemaining, certSubjectCN, certIssuerCN, certSubjectAltName,
          });
          tlsSocket.destroy();
        });
        tlsSocket.on('timeout', () => {
          finish(fail('tls-timeout', 'TLS handshake timed out', { connectMs: parseFloat(connectMs.toFixed(2)) }));
          tlsSocket.destroy();
        });
        tlsSocket.on('error', (e) => {
          finish(fail('tls-error', e.message, { connectMs: parseFloat(connectMs.toFixed(2)) }));
          tlsSocket.destroy();
        });
      });

      socket.on('timeout', () => {
        finish(fail('timeout', 'Connection timed out'));
        socket.destroy();
      });

      socket.on('error', (err) => {
        finish(fail(classifyTcpError(err), err.message));
        socket.destroy();
      });

      socket.connect(portInt, address);
    });
  }

  attempt();
});

