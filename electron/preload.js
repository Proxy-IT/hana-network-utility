const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // One-shot ping
  ping: (opts) => ipcRenderer.invoke('ping', opts),

  // Continuous ping
  startContinuousPing:           (opts) => ipcRenderer.send('ping-continuous-start', opts),
  stopContinuousPing:            ()     => ipcRenderer.send('ping-continuous-stop'),
  onContinuousPingResult:        (cb)   => ipcRenderer.on('ping-continuous-result',  (_, d) => cb(d)),
  onContinuousPingStopped:       (cb)   => ipcRenderer.on('ping-continuous-stopped', ()     => cb()),
  removeContinuousPingListeners: ()     => {
    ipcRenderer.removeAllListeners('ping-continuous-result');
    ipcRenderer.removeAllListeners('ping-continuous-stopped');
  },

  // Traceroute
  startTraceroute:           (opts) => ipcRenderer.send('traceroute-start', opts),
  stopTraceroute:            ()     => ipcRenderer.send('traceroute-stop'),
  onTracerouteData:          (cb)   => ipcRenderer.on('traceroute-data', (_, d) => cb(d)),
  onTracerouteDone:          (cb)   => ipcRenderer.on('traceroute-done', (_, d) => cb(d)),
  removeTracerouteListeners: ()     => {
    ipcRenderer.removeAllListeners('traceroute-data');
    ipcRenderer.removeAllListeners('traceroute-done');
  },

  // Subnet sweep
  startSubnetSweep:    (opts) => ipcRenderer.send('subnet-sweep-start', opts),
  onSweepResult:       (cb)   => ipcRenderer.on('sweep-result', (_, d) => cb(d)),
  onSweepDone:         (cb)   => ipcRenderer.on('sweep-done',   (_, d) => cb(d)),
  removeSweepListeners: ()    => {
    ipcRenderer.removeAllListeners('sweep-result');
    ipcRenderer.removeAllListeners('sweep-done');
  },

  // System info
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
});
