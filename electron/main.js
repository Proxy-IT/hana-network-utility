const { app, BrowserWindow, ipcMain } = require('electron');
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
  win.on('ready-to-show', () => win.show());
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isWin = process.platform === 'win32';

// Always resolve system32 commands by full path on Windows so they work
// inside a packaged app where PATH may be minimal
function sysCmd(name) {
  if (!isWin) return name;
  const sys32 = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', name);
  return sys32;
}

// execShell: wraps exec so it uses cmd.exe on Windows (needed for PATH & shell builtins)
function execShell(cmd, opts, cb) {
  const options = {
    timeout: opts.timeout || 10000,
    env: { ...process.env },   // restore full environment
    shell: isWin ? 'cmd.exe' : '/bin/sh',
    ...opts,
  };
  return exec(cmd, options, cb);
}

// ─── PING (one-shot) ─────────────────────────────────────────────────────────
ipcMain.handle('ping', async (event, { host, count }) => {
  return new Promise((resolve) => {
    const cmd = isWin
      ? `"${sysCmd('ping.exe')}" -n ${count} ${host}`
      : `ping -c ${count} ${host}`;

    execShell(cmd, { timeout: 30000 }, (err, stdout, stderr) => {
      if (err && !stdout) resolve({ success: false, output: stderr || err.message });
      else resolve({ success: true, output: stdout });
    });
  });
});

// ─── CONTINUOUS PING ─────────────────────────────────────────────────────────
const continuousProcs = new Map();

ipcMain.on('ping-continuous-start', (event, { host }) => {
  const cmd     = isWin ? sysCmd('ping.exe') : 'ping';
  const args    = isWin ? ['-t', host] : [host];
  const options = { env: { ...process.env } };

  const proc = spawn(cmd, args, options);
  continuousProcs.set(event.sender.id, proc);

  proc.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach(line => {
      if (!line.trim()) return;
      let rtt = null;
      const winMatch  = line.match(/time[<=]([\d.]+)ms/i);
      const unixMatch = line.match(/time[<=]([\d.]+)\s*ms/i);
      if (winMatch)       rtt = parseFloat(winMatch[1]);
      else if (unixMatch) rtt = parseFloat(unixMatch[1]);
      const timeout = /request timed out|no answer/i.test(line);
      if (rtt !== null || timeout) {
        event.sender.send('ping-continuous-result', { rtt, timeout, line });
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
    if (isWin) {
      // On Windows, kill the whole process tree so ping.exe actually stops
      exec(`taskkill /pid ${proc.pid} /T /F`, { shell: 'cmd.exe' });
    } else {
      proc.kill();
    }
    continuousProcs.delete(event.sender.id);
  }
});

// ─── TRACEROUTE (streaming) ───────────────────────────────────────────────────
ipcMain.on('traceroute-start', (event, { host }) => {
  const cmd     = isWin ? sysCmd('tracert.exe') : 'traceroute';
  // -d skips reverse DNS lookups on Windows — much faster
  const args    = isWin ? ['-d', host] : ['-m', '30', host];
  const options = {
    env: { ...process.env },
    // tracert needs stdio piped; also set encoding
  };

  const proc = spawn(cmd, args, options);

  let buffer = '';

  proc.stdout.on('data', (data) => {
    // tracert on Windows outputs in the system OEM codepage (often cp850/cp1252).
    // Convert buffer to string and stream line-by-line.
    buffer += data.toString('binary');
    const lines = buffer.split('\n');
    buffer = lines.pop(); // keep incomplete last line
    lines.forEach(line => {
      if (line.trim()) {
        event.sender.send('traceroute-data', { line: line + '\n' });
      }
    });
  });

  proc.stderr.on('data', (data) => {
    event.sender.send('traceroute-data', { line: data.toString(), isErr: true });
  });

  proc.on('close', (code) => {
    // flush remaining buffer
    if (buffer.trim()) {
      event.sender.send('traceroute-data', { line: buffer });
    }
    event.sender.send('traceroute-done', { code });
  });

  // Store so we can kill it if needed
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

// ─── SUBNET SWEEP ────────────────────────────────────────────────────────────
ipcMain.on('subnet-sweep-start', (event, { baseIp, start, end }) => {
  let completed = 0;
  const total   = end - start + 1;

  // Concurrency limiter — don't fire 254 pings simultaneously
  const BATCH = 20;
  let nextIdx  = start;

  function pingOne(i) {
    const ip = `${baseIp}.${i}`;

    // Windows: -n 1 packet, -w 1500ms wait (generous for slower hosts)
    // Unix:    -c 1 packet, -W 2 seconds wait
    const cmd = isWin
      ? `"${sysCmd('ping.exe')}" -n 1 -w 1500 ${ip}`
      : `ping -c 1 -W 2 ${ip}`;

    execShell(cmd, { timeout: 5000 }, (err, stdout) => {
      let alive = false;

      if (!err && stdout) {
        if (isWin) {
          // Windows success patterns:
          // "Reply from x.x.x.x: bytes=32 time=1ms TTL=64"
          // "Reply from x.x.x.x: bytes=32 time<1ms TTL=64"
          alive = /Reply from/i.test(stdout) && !/unreachable/i.test(stdout);
        } else {
          alive = /bytes from/i.test(stdout) || /ttl=/i.test(stdout);
        }
      }

      event.sender.send('sweep-result', { ip, alive });
      completed++;

      // Dispatch next IP in queue
      if (nextIdx <= end) {
        pingOne(nextIdx++);
      }

      if (completed === total) {
        event.sender.send('sweep-done', {});
      }
    });
  }

  // Kick off initial batch
  for (let i = 0; i < BATCH && nextIdx <= end; i++) {
    pingOne(nextIdx++);
  }
});

// ─── SYSTEM INFO ─────────────────────────────────────────────────────────────
ipcMain.handle('get-system-info', async () => ({
  platform: process.platform,
  hostname: os.hostname(),
  networkInterfaces: os.networkInterfaces(),
}));
