const { spawn } = require('child_process');
const net = require('net');

function checkPort(port, host, callback) {
  const socket = new net.Socket();
  socket.setTimeout(1000);
  socket.on('connect', () => {
    socket.destroy();
    callback(true);
  });
  socket.on('error', () => {
    socket.destroy();
    callback(false);
  });
  socket.on('timeout', () => {
    socket.destroy();
    callback(false);
  });
  socket.connect(port, host);
}

function waitAndLaunch(retries) {
  checkPort(3000, '127.0.0.1', (ready) => {
    if (ready) {
      console.log('[electron-start] Port 3000 ready — launching Electron...');
      const proc = spawn('electron', ['.'], {
        stdio: 'inherit',
        shell: true,
        cwd: __dirname,
      });
      proc.on('close', (code) => process.exit(code || 0));
    } else {
      if (retries <= 0) {
        console.error('[electron-start] Timed out waiting for React.');
        process.exit(1);
      }
      process.stdout.write('.');
      setTimeout(() => waitAndLaunch(retries - 1), 1000);
    }
  });
}

console.log('[electron-start] Waiting for port 3000...');
setTimeout(() => waitAndLaunch(30), 3000);
