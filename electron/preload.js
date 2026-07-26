const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Streaming ping (fixed count, results arrive line by line)
  startPing:          (opts) => ipcRenderer.send('ping-start', opts),
  stopPing:           ()     => ipcRenderer.send('ping-stop'),
  onPingLine:         (cb)   => ipcRenderer.on('ping-line',  (_, d) => cb(d)),
  onPingDone:         (cb)   => ipcRenderer.on('ping-done',  (_, d) => cb(d)),
  onPingError:        (cb)   => ipcRenderer.on('ping-error', (_, d) => cb(d)),
  removePingListeners: ()    => {
    ipcRenderer.removeAllListeners('ping-line');
    ipcRenderer.removeAllListeners('ping-done');
    ipcRenderer.removeAllListeners('ping-error');
  },

  // Continuous ping (single host)
  startContinuousPing:           (opts) => ipcRenderer.send('ping-continuous-start', opts),
  stopContinuousPing:            ()     => ipcRenderer.send('ping-continuous-stop'),
  onContinuousPingResult:        (cb)   => ipcRenderer.on('ping-continuous-result',  (_, d) => cb(d)),
  onContinuousPingStopped:       (cb)   => ipcRenderer.on('ping-continuous-stopped', ()     => cb()),
  onContinuousPingError:         (cb)   => ipcRenderer.on('ping-continuous-error',   (_, d) => cb(d)),
  removeContinuousPingListeners: ()     => {
    ipcRenderer.removeAllListeners('ping-continuous-result');
    ipcRenderer.removeAllListeners('ping-continuous-stopped');
    ipcRenderer.removeAllListeners('ping-continuous-error');
  },

  // Multi-ping (multiple independent hosts)
  startMultiPing:  (opts) => ipcRenderer.send('multi-ping-start', opts),
  stopMultiPing:   (opts) => ipcRenderer.send('multi-ping-stop',  opts),
  onMultiPingResult:  (cb) => ipcRenderer.on('multi-ping-result',  (_, d) => cb(d)),
  onMultiPingStopped: (cb) => ipcRenderer.on('multi-ping-stopped', (_, d) => cb(d)),
  onMultiPingError:   (cb) => ipcRenderer.on('multi-ping-error',   (_, d) => cb(d)),
  removeMultiPingListeners: () => {
    ipcRenderer.removeAllListeners('multi-ping-result');
    ipcRenderer.removeAllListeners('multi-ping-stopped');
    ipcRenderer.removeAllListeners('multi-ping-error');
  },

  // Traceroute
  startTraceroute:           (opts) => ipcRenderer.send('traceroute-start', opts),
  stopTraceroute:            ()     => ipcRenderer.send('traceroute-stop'),
  onTracerouteData:          (cb)   => ipcRenderer.on('traceroute-data',  (_, d) => cb(d)),
  onTracerouteDone:          (cb)   => ipcRenderer.on('traceroute-done',  (_, d) => cb(d)),
  onTracerouteError:         (cb)   => ipcRenderer.on('traceroute-error', (_, d) => cb(d)),
  removeTracerouteListeners: ()     => {
    ipcRenderer.removeAllListeners('traceroute-data');
    ipcRenderer.removeAllListeners('traceroute-done');
    ipcRenderer.removeAllListeners('traceroute-error');
  },

  // Subnet sweep
  startSubnetSweep:     (opts) => ipcRenderer.send('subnet-sweep-start', opts),
  startSubnetSweepList: (opts) => ipcRenderer.send('subnet-sweep-list-start', opts),
  stopSubnetSweep:      ()     => ipcRenderer.send('subnet-sweep-stop'),
  onSweepStopped:       (cb)   => ipcRenderer.on('sweep-stopped', (_, d) => cb(d)),
  onSweepResult:        (cb)   => ipcRenderer.on('sweep-result', (_, d) => cb(d)),
  onSweepDone:          (cb)   => ipcRenderer.on('sweep-done',   (_, d) => cb(d)),
  onSweepError:         (cb)   => ipcRenderer.on('sweep-error',  (_, d) => cb(d)),
  removeSweepListeners: ()     => {
    ipcRenderer.removeAllListeners('sweep-result');
    ipcRenderer.removeAllListeners('sweep-done');
    ipcRenderer.removeAllListeners('sweep-error');
    ipcRenderer.removeAllListeners('sweep-stopped');
  },

  // Auto-updater
  checkForUpdate:     ()  => ipcRenderer.send('update-check'),
  downloadUpdate:     ()  => ipcRenderer.send('update-download'),
  installUpdate:      ()  => ipcRenderer.send('update-install'),
  getUpdateState:     ()  => ipcRenderer.invoke('update-get-state'),
  setUpdateAutoCheck: (v) => ipcRenderer.invoke('update-set-auto-check', v),
  onUpdateChecking:     (cb) => ipcRenderer.on('update-checking',          ()     => cb()),
  onUpdateAvailable:    (cb) => ipcRenderer.on('update-available',         (_, d) => cb(d)),
  onUpdateNotAvailable: (cb) => ipcRenderer.on('update-not-available',     (_, d) => cb(d)),
  onUpdateProgress:     (cb) => ipcRenderer.on('update-download-progress', (_, d) => cb(d)),
  onUpdateDownloaded:   (cb) => ipcRenderer.on('update-downloaded',        (_, d) => cb(d)),
  onUpdateError:        (cb) => ipcRenderer.on('update-error',             (_, d) => cb(d)),
  removeUpdateListeners: () => {
    ipcRenderer.removeAllListeners('update-checking');
    ipcRenderer.removeAllListeners('update-available');
    ipcRenderer.removeAllListeners('update-not-available');
    ipcRenderer.removeAllListeners('update-download-progress');
    ipcRenderer.removeAllListeners('update-downloaded');
    ipcRenderer.removeAllListeners('update-error');
  },

  // System info
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),

  // Local network interfaces
  getLocalInterfaces: () => ipcRenderer.invoke('get-local-interfaces'),

  // Open external URL in default browser
  openExternal: (url) => ipcRenderer.send('open-external', url),

  // DNS Lookup
  dnsLookup: (opts) => ipcRenderer.invoke('dns-lookup', opts),

  // Port Scanner
  startPortScan:          (opts) => ipcRenderer.send('portscan-start', opts),
  stopPortScan:           ()     => ipcRenderer.send('portscan-stop'),
  onPortScanResult:       (cb)   => ipcRenderer.on('portscan-result', (_, d) => cb(d)),
  onPortScanDone:         (cb)   => ipcRenderer.on('portscan-done',   (_, d) => cb(d)),
  onPortScanError:        (cb)   => ipcRenderer.on('portscan-error',  (_, d) => cb(d)),
  removePortScanListeners: ()    => {
    ipcRenderer.removeAllListeners('portscan-result');
    ipcRenderer.removeAllListeners('portscan-done');
    ipcRenderer.removeAllListeners('portscan-error');
  },

  // TCP Ping
  startTcpPing:          (opts) => ipcRenderer.send('tcpping-start', opts),
  stopTcpPing:           ()     => ipcRenderer.send('tcpping-stop'),
  onTcpPingResult:       (cb)   => ipcRenderer.on('tcpping-result',  (_, d) => cb(d)),
  onTcpPingDone:         (cb)   => ipcRenderer.on('tcpping-done',    (_, d) => cb(d)),
  onTcpPingStopped:      (cb)   => ipcRenderer.on('tcpping-stopped', ()     => cb()),
  onTcpPingError:        (cb)   => ipcRenderer.on('tcpping-error',   (_, d) => cb(d)),
  removeTcpPingListeners: ()    => {
    ipcRenderer.removeAllListeners('tcpping-result');
    ipcRenderer.removeAllListeners('tcpping-done');
    ipcRenderer.removeAllListeners('tcpping-stopped');
    ipcRenderer.removeAllListeners('tcpping-error');
  },
});
