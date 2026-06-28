# Hana - Network Utility — Changelog

---

## v1.6.5 — June 2026

### Highlights
This release adds two new diagnostic modules, expands subnet sweep to support
CIDR notation, hardens the application against a shell injection vulnerability,
and adds Clear buttons across all result-bearing modules.

### Security Fix

#### Shell Injection Vulnerability — Subnet Sweep (CVE-class: Command Injection)
The subnet sweep module previously passed the base IP field directly into a
shell command string via `exec()`. A malicious value in the base IP field
containing shell metacharacters (e.g. `&&`, `;`, `|`) could have caused
arbitrary OS commands to be executed with the privileges of the Electron process.

**Fix:**
- Switched from `exec()` with shell string interpolation to `spawn()` with
  argument arrays for all ping subprocess calls — arguments are passed directly
  to the OS without shell interpretation, eliminating the entire injection surface
- Added strict server-side validation in `main.js` — base IP is validated against
  a strict regex and each octet is range-checked (0-255) before use
- IP is reconstructed from parsed integer values rather than the raw user string
- Added client-side validation in `SubnetSweep.js` for immediate user feedback
- Both layers validate independently (defense in depth)

Users on all prior versions are encouraged to update.

### New Modules

#### ◈ DNS Lookup
Resolve DNS records for any hostname or IP address.
- Supports A, AAAA, CNAME, MX, TXT, NS, and PTR record types
- Choose DNS server: Google (8.8.8.8), Cloudflare (1.1.1.1), or custom internal
- Color-coded record type badges with TTL and priority display
- Automatic reverse lookup detection when an IP is entered
- Export to .txt and .csv

#### ⊘ Port Scanner
Scan TCP ports on any host with pre-filled common ports and group presets.
- 24 common ports as selectable chips — 22, 80, 443, 3389 pre-selected by default
- Group presets: Web, Remote, Mail, Database, Network
- Custom port entry for any additional ports
- Results show Open (green), Closed (gray), Filtered (amber) with service names
- Mandatory legal disclaimer with authorization checkbox before scanning is enabled
- Export to .txt and .csv

### Subnet Sweep Enhancements

- **CIDR mode** — new Range / CIDR toggle above the controls. Enter any CIDR
  notation (e.g. `10.0.0.0/22`) to sweep subnets larger than /24. Supports
  /16 through /30. Live host count and range preview updates as you type
- **Stop Scan** button — cancel any running sweep immediately. Kills all active
  ping processes cleanly. Works for both Range and CIDR modes
- Results are preserved when stopping mid-sweep

### Clear Function

Added **✕ Clear** button to five modules — appears after results are available,
only while not actively running:

- **Ping** — clears results, graph, and live stats. Keeps host and settings
- **Traceroute** — clears hop table. Keeps host intact
- **DNS Lookup** — clears results and errors. Resets host field
- **Subnet Sweep** — clears results and progress. Keeps range settings
- **Port Scanner** — clears results and resets all fields to defaults

### Bug Fixes

- Fixed export reports showing "Look Look Network Utility Tools" instead of
  "Hana - Network Utility" in all report headers
- Fixed subnet sweep CSV export showing incorrect range when run in CIDR mode
- Fixed sweep export filename collision — CIDR sweeps now include the CIDR
  notation in the filename (e.g. `sweep_192.168.1.0-22_timestamp.csv`)
- Fixed `clearPing` not defined error when Clear button was clicked in Ping module
- Fixed subnet sweep results not sorting correctly across multiple octets in
  CIDR mode exports

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

### Known Issues

- **Mac — Gatekeeper warning:** macOS will show a "damaged" or "unidentified
  developer" warning on first launch because Hana is not yet notarized with
  an Apple Developer certificate. See the README for step-by-step instructions
  to bypass this. Apple Developer notarization is planned for a future release.

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
