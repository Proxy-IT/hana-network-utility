# Hana - Network Utility — Changelog

---

## v1.5.0 — June 2026

### Highlights
This release focuses on stability, accuracy, and a significantly improved user
experience. The biggest change is persistent module state — your work is now
preserved when switching between tools.

### New Features

#### Persistent Module State
Hana now remembers your results when you switch between modules. Previously,
navigating away from Ping, Multi-Ping, or Subnet Sweep would clear all results.
Now your data stays exactly where you left it until you start a new session or
run a new test.

- **Ping** — host, mode, packet count, all results, live graph, and continuous
  ping session all persist when switching tabs
- **Multi-Ping** — all host slots, running status, card results, sparklines,
  and statistics survive tab switches. Hosts continue pinging in the background
  while you use other modules
- **Subnet Sweep** — base IP, range settings, progress, and full results grid
  persist across tab switches

#### Real-Time Ping Results
Fixed mode ping now paints each result as it arrives rather than waiting for
all packets to complete. Each reply appears immediately with a green RTT badge
or a red timeout indicator, giving instant feedback especially useful on slow
or unreliable hosts.

#### Accurate Unreachable Detection
Resolved a significant accuracy issue where "Destination host unreachable"
replies from routers were incorrectly treated as successful responses.

- Hosts that return `Reply from X.X.X.X: Destination host unreachable` are
  now correctly shown as failures in all three ping modules
- Ping module shows `✗ Unreachable` in red with 100% loss
- Multi-Ping cards correctly show red / Not Responding for unreachable hosts
- Subnet Sweep correctly marks unreachable hosts as No Response

### Bug Fixes

- Fixed `npm start` opening in browser instead of Electron window
- Fixed subnet sweep results not painting correctly when many results arrive
  simultaneously
- Fixed loss percentage showing 0% for hosts that return unreachable replies
- Fixed stale results from previous ping session briefly showing when starting
  a new ping
- Fixed Electron binary install failure under Node.js v24 — project now
  requires Node.js v18 LTS

### Technical Changes

- Upgraded Electron from v27 to v33 for Node.js v18 compatibility
- Replaced `wait-on` startup with a reliable TCP port checker (`start-electron.js`)
- Ping module switched from `exec` (one-shot) to `spawn` (streaming) for
  real-time line-by-line output
- Added `BROWSER=none` flag to prevent React dev server from opening a browser
  tab during development
- State for Ping, Multi-Ping, and Subnet Sweep lifted to App.js for persistence

---

## v1.4.0 — June 2026

### New Features
- **First-launch disclaimer** — terms acceptance modal on first open, never
  shown again after accepted
- **About page** — version info, full module list, links to GitHub, Terms,
  and Privacy Policy
- **Sidebar logo** — displays app icon image when `public/icon.png` is present,
  falls back to animated pulse dot
- **openExternal** — links in the About page open in the system default browser

### Bug Fixes
- Fixed IP Info module failing in packaged builds with "Unexpected token" error
- Switched IP geolocation from ipapi.co to ip-api.com for reliable packaged
  app support
- Added Content Security Policy headers to allow outbound API calls

---

## v1.3.0 — June 2026

### New Features
- **Multi-Ping** — monitor up to 5 hosts simultaneously with live status cards,
  sparkline history, and global up/down counter
- **IP Info & WhoIs** — auto-detect public IP, look up any IP geolocation,
  and query WhoIs/RDAP for any domain or IP
- Export added to IP Info module (all three sections export to .txt and .csv)

### Bug Fixes
- Fixed traceroute not showing results in packaged builds — switched to full
  system path (`C:\Windows\System32\tracert.exe`) and added `-d` flag
- Fixed subnet sweep missing hosts — increased timeout from 500ms to 1500ms
  and improved Windows reply detection
- Fixed packaged app blank screen — switched from `process.env.NODE_ENV` to
  `app.isPackaged` for reliable dev/prod detection

---

## v1.2.0 — June 2026

### Changes
- Rebranded from "Look Look Network Utility Tools" to **Hana - Network Utility**
- Added CSV and TXT export to Ping, Traceroute, and Subnet Sweep
- Redesigned Subnet Sweep results — two-column list showing all IPs, green
  for live, gray for no response
- Added in-app instructions to all modules
- Version bumped to reflect new identity

---

## v1.1.0 — June 2026

### New Features
- **Continuous Ping** — infinite ping mode with live scrolling RTT graph,
  real-time packet loss counter, and color-coded latency classification
- In-app collapsible instructions added to every module
- Fixed traceroute and subnet sweep in packaged Windows builds

### Bug Fixes
- Fixed traceroute using relative command path — fails in packaged Electron
- Fixed subnet sweep false negatives — short timeout was missing valid hosts

---

## v1.0.0 — June 2026

### Initial Release
- **Ping** — fixed mode with min/avg/max RTT and packet loss
- **Traceroute** — live hop-by-hop streaming with RTT per hop
- **Subnet Sweep** — parallel ping sweep to discover live hosts
- **Subnet Calculator** — full CIDR breakdown with binary view
- **Latency Guide** — reference tiers and per-application thresholds
