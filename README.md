# NetPulse — Network Utility App

A lightweight cross-platform network utility built with Electron + React.

## Features
- **Ping** — Test host reachability with RTT stats and bar chart
- **Traceroute** — Live hop-by-hop path tracing with RTT coloring
- **Subnet Sweep** — Ping-sweep a range to discover live hosts
- **Subnet Calculator** — Full CIDR breakdown with binary view
- **Latency Guide** — Reference tiers and per-use-case thresholds

---

## Setup (First Time)

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or later
- npm (comes with Node.js)

### Install & Run

```bash
# 1. Navigate into the project folder
cd netpulse

# 2. Install dependencies
npm install

# 3. Start the app (opens Electron window)
npm start
```

The first `npm install` takes ~1–2 minutes. After that, `npm start` launches in seconds.

---

## Build a Distributable

```bash
# Build for current platform (Mac → .dmg, Windows → .exe installer)
npm run build
```

Output goes to the `dist/` folder.

---

## Project Structure

```
netpulse/
├── electron/
│   ├── main.js        ← Electron main process (IPC, system calls)
│   └── preload.js     ← Secure bridge between Electron and React
├── src/
│   ├── App.js         ← Root component, tab routing
│   ├── index.js       ← React entry point
│   ├── index.css      ← Design tokens and global styles
│   ├── components/
│   │   ├── Sidebar.js
│   │   ├── PingTool.js
│   │   ├── Traceroute.js
│   │   ├── SubnetSweep.js
│   │   ├── SubnetCalc.js
│   │   └── LatencyGuide.js
│   └── utils/
│       ├── subnet.js   ← Pure subnet math (no system calls)
│       ├── latency.js  ← Latency tier data and classifier
│       └── parsers.js  ← Ping/traceroute output parsers
├── public/
│   └── index.html
└── package.json
```

---

## Notes

- **Traceroute on Mac** requires `traceroute` (pre-installed on macOS).
- **Traceroute on Windows** uses `tracert` (built-in).
- **Subnet Sweep** uses parallel pings — sweeping large ranges (e.g. /16) will be slow.
- **iOS**: This app targets Mac/Windows desktop. iOS sandboxing prevents raw ICMP/system calls.

---

## Extending the App

Each tool is a self-contained React component in `src/components/`. To add a new tool:
1. Create `src/components/MyTool.js`
2. Add it to the `VIEWS` map in `App.js`
3. Add a nav entry to the `TABS` array in `Sidebar.js`
4. If it needs system access, add an IPC handler in `electron/main.js` and expose it in `preload.js`
