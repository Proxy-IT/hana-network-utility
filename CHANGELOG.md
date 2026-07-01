# Hana - Network Utility — Changelog

---

## Backlog — Pending Security & Reliability Work

The following items are documented and ready to implement. None are
command-injection vulnerabilities (the critical class of issue fixed in
v1.6.5), but they represent important hardening and reliability improvements
targeted for v1.7.0.

---

### Item 1 — Electron Upgrade (v33 → v42)
**Priority: High**
Electron 33 is outside the supported three-version window and no longer
receives security patches. Upgrade to v42 (current latest stable).

Change in `package.json`:
```
"electron": "^42.0.0"
```
Low risk — no deprecated APIs in use. Test all modules after upgrading.

---

### Item 2 — Content Security Policy Hardening
**Priority: High**

Current CSP in `main.js` contains four weaknesses:

- `unsafe-eval` — allows `eval()`. Not needed in production builds.
- `unsafe-inline` — allows inline scripts and styles. Should be replaced
  with nonces or removed where possible.
- `connect-src https:` — allows connections to any HTTPS endpoint. Should
  be locked down to the specific domains Hana uses:
  `api.ipify.org`, `ip-api.com`, `rdap.org`, `api.whois.vu`
- `http://ip-api.com` — unencrypted HTTP geolocation endpoint. Switch to
  HTTPS alternative (ipapi.co or ipinfo.io both offer free HTTPS).

---

### Item 3 — Main Process Input Validation (Incomplete)
**Priority: Medium**

Ping Sweep now has strict server-side validation. The same model has not
been applied consistently to all other modules. These functions use safe
argument arrays (not shell strings) so there is no command-injection risk,
but the Electron main process should independently validate all input.

Specific items:
- **Ping / Continuous Ping** — hostname should have a length limit.
  Packet count should have a strict maximum (e.g. 1–100).
- **Multi-Ping** — same hostname length limit per slot.
- **Traceroute** — hostname length limit.
- **DNS Lookup** — record type should be allowlisted against a fixed set
  (A, AAAA, CNAME, MX, TXT, NS, PTR, ALL). DNS server field should be
  validated as a valid IPv4 or IPv6 address before use.
- **Port Scanner** — confirm `ports` is an array, every entry is an
  integer, and every value is in range 1–65535. Reject the request if
  any port fails validation.

---

### Item 4 — DNS Global Resolver Isolation
**Priority: Medium**

The DNS lookup handler currently calls:
```javascript
dns.setServers([server])
```
This changes the DNS configuration for the entire Node.js process. A query
against an internal DNS server can affect concurrent or subsequent queries
using a different server.

Fix — use a per-request resolver instance:
```javascript
const resolver = new dns.Resolver();
resolver.setServers([server]);
// use resolver.resolve4(), resolver.resolveMx() etc. instead of dns.*
```
This provides clean isolation between requests with no shared state.

---

### Item 5 — Stop Scan Process Tracking Bug
**Priority: Medium**

The active sweep process tracker uses a single `Set` to store both process
objects and a sentinel string `'active'`. When Stop Scan runs it iterates
the Set and calls `taskkill /pid` on every entry including the string, which
produces `taskkill /pid undefined` on Windows. This fails harmlessly but
indicates poor process-state management.

Fix — separate the active flag from the process Set:
```javascript
let sweepActive = false;
const activeSweepProcs = new Set(); // process objects only

// On start:
sweepActive = true;

// On stop:
sweepActive = false;
activeSweepProcs.forEach(proc => { try { proc.kill() } catch {} });
activeSweepProcs.clear();

// In pingIp — check flag, not Set membership:
if (!sweepActive) return;
```

---

### Item 6 — Sweep Listener Cleanup Bug
**Priority: Low**

`onSweepStopped` registers a listener for the `sweep-stopped` IPC event,
but `removeSweepListeners()` does not remove it. After multiple start/stop
cycles the listener accumulates, causing the stopped callback to fire
multiple times per stop event. Not dangerous but causes confusing state
changes and memory growth over a long session.

Fix — add `sweep-stopped` to the cleanup list in `preload.js`:
```javascript
removeSweepListeners: () => {
  ipcRenderer.removeAllListeners('sweep-result');
  ipcRenderer.removeAllListeners('sweep-done');
  ipcRenderer.removeAllListeners('sweep-error');
  ipcRenderer.removeAllListeners('sweep-stopped');  // ← add this
},
```

---



---

### Item 7 — Subnet Sweep Results Pagination
**Priority: Medium**
**Type: UX Improvement**

For large CIDR sweeps (e.g. /21, /20, /16) the results grid currently paints
every host as it arrives, which becomes slow and visually overwhelming for
thousands of entries.

**Proposed behaviour:**
- Show the first 254 results by default (one /24 worth)
- Display a count of hidden results: "Showing 254 of 1022 hosts"
- Show an **Expand** button below the visible results that reveals everything
- Live hosts always bubble to the top so they're visible regardless of pagination
- Export always includes all results regardless of what is expanded

**Implementation notes:**
- Add `displayLimit` state defaulting to 254
- Clicking Expand sets `displayLimit` to `Infinity`
- Sort results so live hosts always appear first within the visible set
- Show a summary line: "▼ Show all 1022 results" when collapsed
- Show "▲ Collapse" when expanded

---

## v1.7.2 — July 2026

### New

**In-app feedback channel**
The About page now has dedicated "Report a Bug" and "Request a Feature"
buttons. These open pre-filled GitHub issue templates with the app version
and operating system automatically attached, so reports arrive with the
environment details already included. Structured issue templates were added
for consistent, useful bug reports and feature requests.

### Fixed

- Wired up the error-banner IPC channels for Continuous Ping, Multi-Ping, and
  Traceroute. The main process was sending validation errors on these channels
  but the preload bridge did not relay them, so the error banners never showed.
  Client-side validation already caught most cases, but the backend error path
  is now fully connected as a backstop.

### Security

- Hardened the `open-external` IPC handler with an http(s) protocol allowlist.
  Previously it passed any URL straight to `shell.openExternal`, which could
  invoke arbitrary OS protocol handlers (file://, smb://, etc.). Now only
  http and https URLs are opened.

### Cleanup

- Removed a stale duplicate CSS property in the About page link styling.
- Removed the leftover decorative emoji from the About footer.
- Single-sourced the version number within the About component.

---

## v1.7.1 — June 2026

### Bug Fixes

**Subnet Sweep — CIDR input freeze**
Entering an invalid CIDR and dismissing the error dialog caused all
inputs to become unresponsive. Root cause: `setRunning(true)` was
called before validation, leaving the UI in a disabled state after
the `alert()` dialog cleared. Fixed by moving all validation before
any state changes, and replacing `alert()` with the inline error
banner already used by other modules.

**Port Scanner — custom ports not appearing in results**
Ports entered in the custom field were not returning scan results
when used alongside group presets. Fixed by adding explicit
`parseInt()` coercion in both the frontend `getAllPorts()` function
and the `main.js` IPC handler, ensuring all port values are clean
integers regardless of how React state serialises them across the
IPC bridge.

---

## v1.7.0 — June 2026

### Highlights
Security hardening, reliability fixes, Electron upgrade, and a UX improvement
to subnet sweep results for large CIDR scans.

### Electron Upgrade — v33 → v42
Upgraded from Electron 33 (end-of-life, outside the supported three-version
window) to Electron 42 (current latest stable, Chromium 148, Node 24 LTS).
This brings security patches from nine major Electron releases and ensures
Hana runs on a supported, maintained foundation.

### Security — Main Process Input Validation
All Electron IPC handlers now independently validate inputs before processing.
This applies the same defense-in-depth model introduced for Subnet Sweep in
v1.6.5 across every module.

- **Ping / Continuous Ping** — hostname validated for length (max 253 chars)
  and illegal shell characters. Packet count capped at 1-100.
- **Multi-Ping** — hostname validated per slot.
- **Traceroute** — hostname validated before spawning tracert/traceroute.
- **DNS Lookup** — record type validated against a strict allowlist
  (A, AAAA, CNAME, MX, TXT, NS, PTR, ALL). Custom DNS server validated as
  a valid IPv4 or IPv6 address before use.
- **Port Scanner** — ports array validated as integers only, each in range
  1-65535. Array length capped at 500. Request rejected if any entry is invalid.

### Security — DNS Global Resolver Isolation
The DNS lookup handler previously called `dns.setServers()` which mutates the
global Node.js DNS configuration. A query against an internal DNS server could
affect concurrent queries using a different server.

Fixed by using `new dns.Resolver()` per request. Each lookup now gets its own
isolated resolver instance with no shared state between requests.

### Reliability — Frontend Error Handling
All modules now correctly handle validation errors from the main process.
If a request is rejected by the backend validator, the frontend:
- Immediately resets `running` to false so the UI reflects the true state
- Cleans up all IPC listeners to prevent accumulation
- Displays the specific error message to the user
- Never leaves the module stuck in a "running" state

This prevents the ghost-running bug from returning regardless of what the
backend rejects.

### Reliability — Stop Scan Process Tracking Fix
The subnet sweep stop mechanism previously stored both process objects and a
sentinel string `'active'` in the same `Set`. When Stop Scan ran it attempted
`taskkill /pid` on every Set entry including the string, producing
`taskkill /pid undefined` on Windows.

Fixed by separating concerns:
- `sweepActive` — a plain boolean flag that controls whether new pings dispatch
- `activeSweepProcs` — a Set containing only process objects for cleanup
- Stop Scan sets `sweepActive = false` and kills only real process objects

### Reliability — Sweep Listener Cleanup Fix
`onSweepStopped` registered a listener for `sweep-stopped` but
`removeSweepListeners()` did not remove it. Repeated start/stop cycles
accumulated listeners, causing callbacks to fire multiple times per stop event.

Fixed — `sweep-stopped` is now included in `removeSweepListeners()` cleanup.

### UX — Subnet Sweep Results Pagination
Large CIDR sweeps (e.g. /20, /16) previously painted every result into the
grid as it arrived, which became slow and visually overwhelming for thousands
of entries.

New behaviour:
- First 254 results are shown by default (one /24 worth)
- Live hosts always bubble to the top regardless of pagination
- A pagination bar shows "Showing 254 of 1022 hosts" with the live host count
- "▼ Show all N results" expands to show everything
- "▲ Collapse to 254" returns to the default view
- Export always includes all results regardless of what is currently expanded
- Pagination resets to 254 on every new sweep and on Clear

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
