/**
 * Hana — dev launcher
 *
 * Waits for the Vite dev server (port 5173) then launches Electron.
 * Uses a TCP connection check rather than an HTTP request or the `wait-on`
 * package, because `wait-on` was unreliable on Windows in earlier testing.
 * Works identically on Windows and macOS.
 */
const { spawn } = require('child_process');
const net        = require('net');

const VITE_PORT    = 5173;
const POLL_DELAY   = 1000;   // ms between checks
const MAX_RETRIES  = 30;     // 30 seconds max wait
const INITIAL_WAIT = 2000;   // give Vite a moment to start before polling

function checkPort(port, host, callback) {
  const socket = new net.Socket();
  socket.setTimeout(1000);
  socket.on('connect', () => { socket.destroy(); callback(true);  });
  socket.on('error',   () => { socket.destroy(); callback(false); });
  socket.on('timeout', () => { socket.destroy(); callback(false); });
  socket.connect(port, host);
}

function waitAndLaunch(retries) {
  checkPort(VITE_PORT, '127.0.0.1', (ready) => {
    if (ready) {
      console.log(`[electron-start] Port ${VITE_PORT} ready — launching Electron...`);
      const proc = spawn('electron', ['.'], {
        stdio: 'inherit',
        shell: true,
        cwd:   __dirname,
      });
      proc.on('close', (code) => process.exit(code || 0));
    } else {
      if (retries <= 0) {
        console.error('[electron-start] Timed out waiting for the Vite dev server.');
        console.error(`[electron-start] Is "npm run dev" running on port ${VITE_PORT}?`);
        process.exit(1);
      }
      process.stdout.write('.');
      setTimeout(() => waitAndLaunch(retries - 1), POLL_DELAY);
    }
  });
}

console.log(`[electron-start] Waiting for Vite dev server on port ${VITE_PORT}...`);
setTimeout(() => waitAndLaunch(MAX_RETRIES), INITIAL_WAIT);
