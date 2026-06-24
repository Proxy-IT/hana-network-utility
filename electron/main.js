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
  const cmd  = isWin ? sysCmd('ping.exe') : 'ping';
  const args = isWin ? ['-n', String(count), host] : ['-c', String(count), host];
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
  let completed = 0;
  const total   = end - start + 1;
  const BATCH   = 20;
  let nextIdx   = start;

  function pingOne(i) {
    const ip  = `${baseIp}.${i}`;
    const cmd = isWin
      ? `"${sysCmd('ping.exe')}" -n 1 -w 1500 ${ip}`
      : `ping -c 1 -W 2 ${ip}`;
    execShell(cmd, { timeout: 5000 }, (err, stdout) => {
      let alive = false;
      if (!err && stdout) {
        alive = isWin
          ? /Reply from/i.test(stdout) && !/unreachable/i.test(stdout)
          : /bytes from/i.test(stdout) || /ttl=/i.test(stdout);
      }
      event.sender.send('sweep-result', { ip, alive });
      completed++;
      if (nextIdx <= end) pingOne(nextIdx++);
      if (completed === total) event.sender.send('sweep-done', {});
    });
  }
  for (let i = 0; i < BATCH && nextIdx <= end; i++) pingOne(nextIdx++);
});

// ── OPEN EXTERNAL LINKS ──────────────────────────────────────────────────────
ipcMain.on('open-external', (event, url) => {
  shell.openExternal(url);
});

// ── SYSTEM INFO ───────────────────────────────────────────────────────────────
ipcMain.handle('get-system-info', async () => ({
  platform: process.platform,
  hostname: os.hostname(),
  networkInterfaces: os.networkInterfaces(),
}));
