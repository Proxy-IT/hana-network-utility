import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import PingTool,  { defaultPingState }      from './components/PingTool';
import MultiPing, { defaultMultiPingState } from './components/MultiPing';
import Traceroute from './components/Traceroute';
import SubnetSweep, { defaultSweepState } from './components/SubnetSweep';
import SubnetCalc from './components/SubnetCalc';
import LatencyGuide from './components/LatencyGuide';
import IpInfo from './components/IpInfo';
import About from './components/About';
import Disclaimer, { hasAccepted } from './components/Disclaimer';

const style = document.createElement('style');
style.textContent = `
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes pulse-ring { 0% { transform: scale(0.8); opacity: 1; } 80% { transform: scale(2.4); opacity: 0; } 100% { transform: scale(2.4); opacity: 0; } }
  @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
  input[type=range] { -webkit-appearance: none; height: 4px; border-radius: 2px; background: #1A2235; outline: none; }
  input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: #00D4FF; cursor: pointer; box-shadow: 0 0 8px rgba(0,212,255,0.4); }
  input:focus { border-color: rgba(0,212,255,0.4) !important; }
  button:hover:not(:disabled) { filter: brightness(1.15); }
  select:focus { border-color: rgba(0,212,255,0.4) !important; outline: none; }
`;
document.head.appendChild(style);

export default function App() {
  const [activeTab,  setActiveTab]  = useState('ping');
  const [sysInfo,    setSysInfo]    = useState(null);
  const [accepted,   setAccepted]   = useState(hasAccepted());

  // Persistent state for stateful modules
  const [pingState,      setPingState]      = useState(defaultPingState);
  const [multiPingState, setMultiPingState] = useState(defaultMultiPingState);
  const [sweepState,     setSweepState]     = useState(defaultSweepState);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getSystemInfo().then(setSysInfo).catch(() => {});
    } else {
      setSysInfo({ hostname: 'demo-machine', platform: 'browser', networkInterfaces: {} });
    }
  }, []);

  function renderView() {
    switch (activeTab) {
      case 'ping':      return <PingTool  state={pingState}      setState={setPingState} />;
      case 'multiping': return <MultiPing state={multiPingState} setState={setMultiPingState} />;
      case 'tracert':   return <Traceroute />;
      case 'sweep':     return <SubnetSweep state={sweepState} setState={setSweepState} />;
      case 'subnet':    return <SubnetCalc />;
      case 'ipinfo':    return <IpInfo />;
      case 'latency':   return <LatencyGuide />;
      case 'about':     return <About />;
      default:          return <PingTool state={pingState} setState={setPingState} />;
    }
  }

  return (
    <>
      {!accepted && <Disclaimer onAccept={() => setAccepted(true)} />}
      <div style={{ ...layout.app, filter: accepted ? 'none' : 'blur(4px)', pointerEvents: accepted ? 'auto' : 'none' }}>
        <Sidebar active={activeTab} onSelect={setActiveTab} sysInfo={sysInfo} />
        <main style={layout.main}>
          <div style={layout.content}>
            {renderView()}
          </div>
        </main>
      </div>
    </>
  );
}

const layout = {
  app:     { display: 'flex', height: '100vh', overflow: 'hidden', background: '#0A0E1A' },
  main:    { flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' },
  content: { flex: 1, padding: '32px 36px', maxWidth: 960 },
};
