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

## Unreleased

### Calendar reminders now actually notify

The `.ics` events shipped in v1.11.6 carried no alarm, which left it to each
calendar client's default for all-day events whether the user was notified at
all — commonly that default is no notification, so the reminder only worked if
you happened to be looking at your calendar that day.

Each event now carries a `VALARM` (`ACTION:DISPLAY`) firing at **noon the day
before**. `TRIGGER` is relative to `DTSTART` and all-day events start at
midnight, so the offset is `-PT12H`; a zero offset would technically be "on
time" but would fire at midnight, which nobody sees.

Not released on its own — v1.11.6 was already published, and re-cutting the
same version number would leave anyone already on it permanently unable to
receive this, since the auto-updater identifies builds by version alone. This
rides along with the next release instead.

---

## v1.11.6 — July 2026

### Certificate expiry calendar reminders

TCP Ping can now export a `.ics` calendar file for an inspected certificate.
One file, up to four separate all-day events — 45, 30, 10, and 3 days before
expiry — so opening it once schedules every reminder at the same time.

Only future-dated reminders are written: a cert expiring in 20 days gets the
10-day and 3-day events, and one expiring in under 3 days gets none at all,
since a calendar reminder is useless for something already critical. That case
surfaces urgency directly in the app instead of downloading an empty file.

**Implementation notes:**
- Hand-rolled against RFC 5545 — no dependency added, matching how the CSV and
  TXT exporters are built. The pure builder is exported separately from the
  download step, following the same `buildSweepReport` pattern, so the whole
  format is unit-testable without browser APIs. `now` is an injectable
  parameter, which is what makes the date filtering testable at all.
- **Escaping** applies the same untrusted-string discipline as the v1.8.2 CSV
  hardening, but with iCalendar's rules rather than CSV's — `csvCell` is not
  reusable here (it wraps in quotes; iCalendar backslash-escapes). Certificate
  CNs and SAN entries are attacker-influenceable, and an unescaped newline in
  one would otherwise end the DESCRIPTION property and allow arbitrary
  iCalendar properties — or an entire extra event — to be injected.
- **Line folding** at 75 octets per §3.1, measured in bytes and walked by code
  point so a multi-byte character is never split across the fold.
- **Date math** is done entirely in UTC — extraction as well as arithmetic —
  so no DST transition can shift a reminder by a day, and reminders are derived
  from the certificate's absolute expiry rather than a days-remaining figure
  computed back when the probe ran.
- **Outlook compatibility:** `METHOD:PUBLISH` is emitted and `DTEND` is written
  explicitly as the following day. Outlook's importer keys off the former and
  does not honour the spec's "a DATE-valued DTSTART with no DTEND lasts one
  day" allowance — both are ways a file Google Calendar accepts can still
  misbehave in Outlook.
- UIDs are deterministic, so re-importing the same file updates the existing
  events instead of creating duplicates.

Also captures the certificate's SAN list (`subjectaltname`), which was the one
piece of certificate data v1.11.5 didn't read; it appears in the reminder body,
truncated when a shared certificate lists many names.

---

## v1.11.5 — July 2026

Three focused additions this release.

### TCP Ping — TLS certificate expiry

When TLS is enabled, a successful handshake now surfaces the peer
certificate's expiration: days remaining, color-coded green (>60 days),
amber (30–60 days), red (<30 days or already expired). Shown as a summary
stat card (tracking the most recent successful attempt — cert expiry is a
point-in-time server property, not something to average across attempts)
and appended to each per-attempt line in the recent-attempts log. Exported
in both `.txt` and `.csv`. Read-only: `getPeerCertificate()` is inspected
purely for display, the same `rejectUnauthorized: false` trust behavior
from v1.11.0 is unchanged — this never becomes a trust decision.

### IP Info — Local Network interface selector

A new first section in IP Info shows your active network interfaces, with
a dropdown defaulting to a wired ("hardline") connection if one is active,
falling back to WiFi if not. Shows IPv4/IPv6 address, subnet, MAC, and a
wired/WiFi/other type badge. Since Node has no built-in way to tell a wired
adapter from a WiFi one, this classifies interfaces via a local OS command
(`Get-NetAdapter` on Windows, `networksetup -listallhardwareports` on
macOS) — read-only, no user input reaches either command. If the OS command
fails or produces unparseable output, interfaces still display, just
tagged "Unknown" rather than the whole section erroring out.

### Subnet Sweep — pagination actually shipped, plus a live-only filter

**A confirmed, real gap**: README and this changelog have claimed since
v1.7.0 that Subnet Sweep results "paginate (first 254 shown, live hosts
bubble to the top)." They didn't. `displayLimit` state and the pagination
CSS existed but were never wired into the render path, and no alive-first
sort was ever implemented — a large sweep (up to 65,534 hosts for a /16)
rendered every single result unconditionally. Fixed properly this time:
alive hosts now genuinely sort to the top, the first 254 results show by
default with a "Show All" / "Show Less" toggle, and a new "Live hosts
only" checkbox lets you hide non-responding hosts entirely. Export always
includes every result regardless of what's currently visible or filtered.

### Found and fixed during review

Went through the same 8-angle multi-agent review used for v1.11.0's TCP
Ping module — this release adds a second `child_process.spawn` surface
(alongside TCP Ping's raw sockets) and reads TLS peer certificate data, so
the review was treated as mandatory. Two angles (reuse, conventions) came
back fully clean. Real issues found and fixed:
- **No timeout on the new `get-local-interfaces` spawn** — every other
  one-shot `spawn()` in `main.js` kills the process after 5s; this one
  didn't, so a hung `Get-NetAdapter`/`networksetup` call would leave IP
  Info stuck on "Detecting network interfaces…" forever and leak the
  process. Added the same 5s timeout-and-kill pattern used elsewhere.
- **A genuine bug in my own demo data**: `TcpPing.js`'s browser-mode
  `fakeAttempt()` generated `certDaysRemaining` and `certValidTo`
  independently, so ~2.5% of fake successful attempts could show
  "Expired" directly above an expiry date months in the future — a
  contradiction the real backend can't produce, since it always derives
  the day count from the same date. Fixed to derive one from the other.
- **Export column reordering risk**: the new TCP Ping cert columns were
  inserted before `Error`, shifting its position for anyone parsing the
  exported CSV/TXT by fixed index. Moved to the end of both formats.
- **Dead data**: `certSubjectCN`/`certIssuerCN` were captured on every
  handshake and even faked in demo mode, but never shown or exported —
  now surfaced as a hover tooltip on the cert stat card and per-attempt
  log line, and added as export columns.
- **Silent-failure gap**: when the OS classification command fails
  entirely, every interface fell back to "Unknown" with no indication
  the wired-preference logic didn't run — a user whose antivirus blocks
  the PowerShell call would be silently defaulted to whatever interface
  happened to enumerate first. Added an explicit `classificationFailed`
  signal from the backend and a warning banner in IP Info.
- **A stale, inaccurate doc comment**: `sortSweepResults`'s comment
  claimed it also governed export ordering — it doesn't; the export path
  has its own independent full-4-octet sort. Corrected.
- **Real inefficiency for large sweeps**: the sort/filter pipeline
  re-ran on every render regardless of whether `results` changed, and
  sorted before filtering rather than after — for a maxed /16 sweep
  (65,534 entries), this meant re-sorting the full array on every
  unrelated re-render, and sorting entries that were about to be thrown
  away by the "Live hosts only" filter. Now memoized and filters first.

Noted but deliberately not changed: `IpInfo.js`'s "Local Network" section
re-spawns the classification command on every tab visit rather than
caching — this exactly matches the pre-existing behavior of this file's
other two sections (`fetchPublicIp` also re-fetches on every mount, since
none of `IpInfo.js`'s state is lifted into `App.js`), so fixing it in
isolation for only the new section would be inconsistent rather than
correct. Also noted: this is the third time the hand-copy-into-`main.js`
parity-test pattern has been applied (`validate.js` at v1.8.0,
`tcpPingClassify.js` at v1.11.0, `networkInterfaceParse.js` now) — flagged
in `mainValidatorParity.test.js` as the point where the long-deferred
CJS/ESM unification should get an actual target release.

---

## v1.11.0 — July 2026

### New module — TCP Ping

An eleventh module: repeated TCP-connect probing of a single host:port —
the complement to ICMP ping for confirming a specific service is reachable
when ICMP itself is firewalled.

- Per-attempt phase timing: DNS resolution, TCP connect, and an optional
  TLS handshake (toggle, off by default), each measured and reported
  separately rather than folded into one number
- Explicit failure classification instead of a single pass/fail bit:
  `refused` (port closed), `timeout` (no answer), `unreachable`
  (network-level failure), `dns-error`, `tls-error`/`tls-timeout` (TCP
  succeeded, TLS didn't) — each shown with its own color, matching the
  app's existing Port Scanner color language (green/amber/gray/red)
- **Fixed mode** (5–100 attempts) or **Continuous mode** with a live
  timing graph, min/avg/max, packet loss, jitter (mean delta between
  consecutive successful attempts), and longest-failure-streak — the
  last two are new stats that didn't exist anywhere else in the app
- Export the full attempt log and summary as `.txt` or `.csv`

**Design notes:**
- One unified IPC channel (`tcpping-start`, with an optional `count`)
  rather than copying Ping's split fixed/continuous channel pair — Ping
  splits because it spawns two different OS `ping` invocations; TCP Ping
  has no OS process at all, it's a homegrown `setTimeout` loop, so there
  was no reason to carry that split over.
- `tls.connect({ rejectUnauthorized: false })` is intentional, not a
  weakened check: the goal is measuring whether a TLS handshake completes
  and how long it takes, not validating the peer's certificate chain — a
  self-signed or expired cert should still report a successful handshake
  with timing. No data is sent or received over the TLS socket beyond the
  handshake itself, and it's destroyed immediately after.
- DNS is resolved to a bare IP before `net.Socket.connect()` is called
  (rather than letting `connect()` resolve the hostname itself), so DNS
  time is measured as its own phase instead of silently folding into
  connect time.
- Reused the established validate.js ↔ main.js parity pattern (see
  `src/lib/__tests__/mainValidatorParity.test.js`) rather than trying to
  finally unify the two — main.js is CommonJS and doesn't `require()` the
  ESM `validate.js` today, a known, deliberately-deferred gap. New
  validators/classifiers were added to `validate.js` /
  `tcpPingClassify.js`, hand-copied into `main.js`, and pinned by new
  parity-test cases so the two can't silently drift.
- Jitter, failure-streak, and summary stats are pure, independently
  tested functions (`src/utils/tcpPingStats.js`) operating on the full
  attempt history, not an untested `useRef` accumulator — unlike the
  existing continuous-Ping stats, which have zero test coverage today.
- No CFAA/authorization disclaimer gate (unlike Port Scanner) — repeatedly
  probing one already-specified port is closer in character to Ping than
  to a port sweep.

### Sidebar reorganized

Module order regrouped by category: Ping, Multi-Ping, TCP Ping, Port
Scanner, Traceroute, Subnet Sweep, Subnet Calc, DNS Lookup, IP Info,
Hana's Favs, Latency Guide.

**Found and fixed during review** — this module (raw sockets, TLS, DNS,
new IPC surface — more security-relevant surface area than any single
release since the auto-updater) went through an 8-angle multi-agent
review before release. The cross-file-contract and conventions angles
came back fully clean (IPC channel names, payload shapes, and validator
call sites all traced correctly end to end; no CLAUDE.md exists in this
repo to check against). Two specific failure hypotheses raised going in —
an orphaned raw socket after a TLS-wrapped socket is destroyed, and a
double-emission race between a raw-socket and TLS-socket timeout/error
firing together — were directly tested against real Node behavior and
ruled out, not just assumed safe. Real issues found and fixed:
- **A stale-session race**: the module-level active/socket/timer state
  had no way to tell a callback from a torn-down session apart from a
  brand-new one if a user stopped and immediately restarted while a
  `dns.lookup()` or socket event was still in flight (neither can be
  cancelled once started) — the stale callback could emit a result into
  the new session's attempt log or clobber its socket/timer reference.
  Fixed with a generation counter: every stop/restart bumps it, and every
  async callback checks its own captured generation before doing anything.
- **`dns.lookup()` had no timeout**, unlike the connect and TLS phases —
  a hanging or black-holed resolver could stall the entire probe loop
  indefinitely regardless of the configured timeout. Fixed with a manual
  timer race (Node's `dns.lookup()` has no built-in timeout option or
  cancellation); added a distinct `dns-timeout` status (amber, matching
  the "reachable but didn't answer in time" semantic already used for
  TCP/TLS timeouts) rather than folding it into the generic `dns-error`.
- **The stats-backing array's cap was wrong by an order of magnitude**:
  documented as "hours of headroom at 1 attempt/sec" but set to 1,500
  entries — 25 minutes, not hours. A continuous session run longer than
  that would silently start reporting a rolling 25-minute window instead
  of true since-Start figures, contradicting both the code's own comment
  and the export/report's implicit promise. Raised to 86,400 (24 hours).
- Extracted `fail()`/`emit()` helpers in the main-process attempt loop to
  replace five near-identical inline failure-payload literals — needed
  anyway to carry the generation check in one place rather than five.
- `tcpPingStats.js`'s `computeJitter` and `computeTcpPingStats` each
  independently filtered/mapped the same successful-attempts list;
  factored into a shared internal helper so the two can't quietly
  disagree if the "what counts as a successful RTT" rule ever changes.
- A parity-test doc comment went stale the moment the Port Scanner port
  check was extracted into a shared `isValidPort()` — it still claimed to
  pin "inline" logic that no longer existed. Corrected to describe what
  it actually pins now.

Noted but deliberately not changed, as low-severity and consistent with
existing, already-tolerated patterns elsewhere in this codebase: the
same min/avg/max/loss formula now exists in three places (Ping's fixed
summary, its continuous accumulator, and TCP Ping's stats module) with
no shared helper between them; the low-level "socket + timeout + classify"
skeleton is hand-rolled a second time rather than factored out of Port
Scanner's `scanPort()`; and the 1–65535 port-bounds check now has three
independent copies. All three mirror this codebase's pre-existing,
documented convention of tolerating some duplication across modules
(e.g. every component already keeps its own local `StatCard`/`RttGraph`)
rather than introducing shared abstractions speculatively.

---

## v1.10.0 — July 2026

### New module — Hana's Favs

A tenth module: a curated, static directory of free third-party network and
security tools, grouped by category and credited to each operator.

- **SSL / TLS** — SSL Server Test (Qualys SSL Labs), crt.sh (Sectigo,
  Certificate Transparency log search)
- **MAC / Hardware** — MAC Address Lookup (MacVendors)
- **BGP / Routing** — BGP Toolkit (Hurricane Electric)
- **Availability / Performance** — Down for Everyone or Just Me, Speedtest
  (Ookla)
- **Security** — Have I Been Pwned (Troy Hunt)

**Security properties, by design:**
- The link list is a hardcoded, static array (`src/utils/usefulLinks.js`) —
  not fetched from any remote source, not user-editable, and not built from
  any dynamic or user-supplied input. Every URL was reviewed by hand.
- New automated tests (`usefulLinks.test.js`) permanently guard the data:
  every URL must be `https://`, must parse as a well-formed URL, the domain
  shown on each card must match the URL's actual hostname (so a card can't
  show one destination while linking to another), and no duplicate URLs.
- No new IPC surface — clicking a card reuses the existing `openExternal`
  channel (already hardened to http/https-only in `electron/main.js`), so
  the IPC contract and CSP are both unaffected.
- Extracted the "open link safely" helper (previously duplicated only in
  `About.js`) into a shared `src/utils/openLink.js`, used by both — a single
  reviewed copy for a security-relevant function instead of copies that can
  drift apart. Also added `noopener,noreferrer` to the browser-preview
  fallback path, which the original didn't have.
- Attribution is neutral ("by <Provider>") — names each tool's operator
  without implying their endorsement of Hana.
- `PRIVACY.md` updated with a dedicated section: clicking a card opens the
  user's default browser: this is not a request Hana itself makes, and
  Hana doesn't track which links are clicked.

**Found and fixed during review** — this module went through an 8-angle
multi-agent review (line-by-line, removed-behavior, cross-file, reuse,
simplification, efficiency, altitude, plus direct verification against the
real files) before release. Two angles came back clean on their own; one
finding was disproven by re-reading the actual code (a claimed "styles
object recreated every render" turned out to be module-level, like every
other component). Three real, low-severity items were found and fixed:
- `openLink.js` only re-validated the URL scheme on the Electron path — the
  browser-preview fallback (`window.open`) had no check of its own, so the
  two paths could silently diverge in safety. `openLink()` now validates
  the scheme itself (https/http only) before picking either transport, and
  gained its first unit test suite (`openLink.test.js`, 7 assertions, 100%
  branch coverage), closing a real test-coverage gap the review found.
- Removed a dead CSS transition on the link cards (`border-color`) that
  nothing ever triggered — verified against the app's global stylesheet.
- Removed a redundant `marginTop` that duplicated spacing already provided
  by the parent's flex `gap`.

---

## v1.9.2 — July 2026

### Fixed — macOS auto-update was broken

Real cross-platform testing of the v1.9.0 auto-updater surfaced a genuine
bug: checking for updates on macOS failed with `ZIP file not provided`.
electron-updater's macOS updater (`MacUpdater`) requires a `.zip` release
asset specifically — the `.dmg` alone (our only mac build target) isn't
enough, even though it's the correct format for a fresh manual install.
Added `zip` as a second mac build target (`x64` and `arm64`, alongside the
existing `dmg`), so both are published to each release going forward. No
CI workflow changes were needed — electron-builder auto-publishes whatever
targets are configured directly during the build step when running on a
tagged commit in CI (confirmed by reading `PublishManager.js`), the same
mechanism that already publishes `latest.yml`/`latest-mac.yml` today.

Mac users on v1.9.0 or v1.9.1 should update via a manual download this one
time; v1.9.2 onward will auto-update correctly on both platforms.

---

## v1.9.1 — July 2026

### Subnet Sweep — CIDR is now the default mode

Opening Subnet Sweep previously landed on **Range** mode, requiring a click
to switch to **CIDR** for anything beyond a plain host-range scan. CIDR now
loads first — both as the default state and as the first (left-most) option
in the mode toggle, with Range as the second option. Better usability for
the more commonly useful scan type.

### About page — persistent "Patch notes" link

Added a link next to the current version in **About → Updates** that opens
this project's GitHub Releases page, so patch notes can be checked at any
time — not just when an update has already been found.

---

## v1.9.0 — July 2026

### In-app auto-updater

Hana can now update itself. Previously every new version meant manually
re-finding the release, re-downloading, and re-clearing SmartScreen — so
security fixes reached users slowly, if at all.

- **About → Updates** has a **Check for Updates** button. If a newer version
  is published it offers **Download**, then **Install & Restart**. The
  download is integrity-checked (SHA-512, verified against the release
  metadata served over HTTPS from GitHub) before it's ever run.
- **Privacy preserved.** The checker never runs on its own. There's an
  opt-in **"Automatically check for updates on startup"** toggle that
  defaults **off**, so the app's promise — outbound requests only happen
  when you explicitly trigger them — holds unless you choose otherwise.
- Works on Windows and both Mac architectures. Note: until Windows EV code
  signing lands (planned for a later release), the updated Windows build can
  still trigger a SmartScreen prompt on first launch — the download itself
  is hash-verified regardless.

**Security properties**
- **Notify-only by default** — a found update is surfaced, never auto-downloaded
  or auto-installed. Each step requires an explicit click.
- **No arbitrary URLs** — the feed is pinned to this exact GitHub repo at build
  time and re-verified at runtime; the app never calls `setFeedURL` with a
  dynamic value, so an update can only ever come from the trusted source.
- **Cryptographic verification** — every download's SHA-512 is checked against
  the release metadata before install, and that check is never disabled. macOS
  updates must additionally carry a valid Apple (notarization) signature.
- **Downgrade prevention** — `allowDowngrade` and `allowPrerelease` are both
  off, so the updater will never move you to an older or pre-release build even
  if one is published or the feed is rolled back.

**Under the hood**
- Added `electron-updater`, wired to the GitHub Releases feed via an explicit
  `publish` config (electron-builder already generates the required
  `latest.yml` / `latest-mac.yml` with per-file hashes).
- Update logic lives in `electron/updater.js`; `autoDownload` and
  `autoInstallOnAppQuit` are both off so every step (check → download →
  install) is user-consented. The startup preference persists to a small
  JSON file in the app's userData directory.
- The CI "no dev-dependencies shipped" check was retargeted: it now matches
  dev-tooling package names specifically, since `electron-updater` is a
  legitimate runtime dependency that (correctly) ships inside `app.asar`.

**Documentation**
- Rewrote `PRIVACY.md` and the in-app Disclaimer/About privacy copy to
  explicitly name the startup-check toggle and state it ships **off by
  default** — previously this was only implied by general "explicit
  trigger" language. Also fixed a stale `ip-api.com` reference and added
  the DNS Lookup / Port Scanner network activity that was missing.
- Added `SECURITY.md` (linked from the README but never actually created)
  covering vulnerability reporting and, specifically, the security
  properties the auto-updater is expected to uphold.
- Rewrote `README.md` to match what's actually built: Windows + macOS
  (was Windows-only), all 9 modules (DNS Lookup and Port Scanner were
  missing), CIDR subnet sweep, signed/notarized macOS status, the
  `ipinfo.io` endpoint, and a new "Staying up to date" section.
- Fixed a placeholder `[your email]` in `TERMS.md`'s security-contact line.
- Fixed `package.json`'s `author` field (was the literal placeholder
  `"Your Name"`) and added an explicit `copyright` field — both show up in
  the packaged Windows exe's file properties (Company/Copyright), which
  previously displayed the placeholder instead of Proxy-IT LLC.

---

## v1.8.2 — July 2026

A security-and-reliability hardening pass from a full re-audit of the app.
No new features — every change closes a real gap found in the review.

### Security — CSV export hardening

Exported CSV files are opened in Excel / Google Sheets / LibreOffice by the
IT folks who use Hana, and they contain strings Hana does not control —
WhoIs registrar/registrant/org fields, raw WhoIs text, ISP names,
reverse-DNS PTR hostnames, and traceroute hostnames.

- **Formula injection (CWE-1236) fixed.** A cell whose value began with
  `=`, `+`, `-`, `@`, or a control character was executed as a formula on
  open — a value like `=HYPERLINK(...)` or a DDE payload sourced from a
  malicious WhoIs record could run when the user opened the export. All
  export cells now pass through a single `csvCell()` helper that prefixes
  such values with an apostrophe so they render as literal text. Plain
  numbers (including negative coordinates and UTC offsets) are left numeric.
- **Inconsistent quote escaping fixed.** Only the WhoIs CSV doubled embedded
  quotes; the ping, traceroute, sweep, IP-info, and port-scan exporters did
  not, so a value containing a `"` could shift or break columns. All six
  now share the same escaping path. Covered by 8 new unit tests.

### Reliability — Traceroute & Port Scanner no longer orphan backend work

`Traceroute`, `Port Scanner`, `DNS Lookup`, and `IP Info` are not kept alive
across tab switches (unlike Ping / Multi-Ping / Subnet Sweep). Previously,
switching tabs mid-run left backend work running with no cleanup.

- **Port Scanner can now be cancelled.** Added a real Stop button and a
  `portscan-stop` IPC path that tears down in-flight sockets and halts the
  queue. Previously a 500-port scan had no cancel control at all and ran to
  completion (~50s) no matter what.
- **Traceroute and Port Scanner now clean up on unmount.** Switching tabs
  mid-run stops the `tracert` process / open sockets and detaches IPC
  listeners, so nothing is orphaned and results never fire into an
  unmounted component.

### Cleanup — dead code removed

- Removed `src/utils/IpInfo.js`, a stale 490-line duplicate of the IP Info
  component that still called the old `ipapi.co` endpoint (which the
  production CSP no longer allows). Only `src/components/IpInfo.js` is used;
  the duplicate was an import-the-wrong-one landmine.
- Removed the unused `execShell()` helper from `electron/main.js` (no
  callers — every module uses `spawn` with argument arrays).
- Removed `build-resources/notarize.js`, the redundant notarization hook
  retired in v1.7.2 (electron-builder notarizes natively).

---

## v1.8.1 — July 2026

### Branding — real logo, everywhere

Every logo slot in the app was previously a placeholder — no `icon.png`
ever existed in `public/`, so the sidebar, About page, and first-launch
disclaimer all silently fell back to an animated pulse-dot, and both the
Windows and Mac builds shipped with Electron's default icon instead of
Hana's.

- Added the finalized Hana mark (outline style, transparent background)
  as `public/icon.png` — now renders correctly in the sidebar, About page,
  and Disclaimer modal at every size, including the 36px sidebar crop
  (verified the mark's ear tips don't clip against the circular mask)
- Added a proper Windows app/installer icon (`build-resources/icon.ico`)
  and Mac app icon (`build-resources/icon.icns`) — packaged builds no
  longer show Electron's default icon in the taskbar, title bar, or
  installer
- Added a browser-tab favicon (`favicon.ico`, 16px/32px PNGs, Apple
  touch icon) via `index.html` — previously there was none at all
- Landing page (hana.proxy-it.co): replaced the same pulse-dot
  placeholder in the nav bar and footer with the real mark, added a
  proper favicon/apple-touch-icon/PWA manifest, and added Open Graph +
  Twitter Card meta tags for link previews (previously none existed)

### Fixed — electron-builder / Vite build folder collision

`directories.buildResources` was never set, so electron-builder's default
lookup folder (`build/`) collided with Vite's own output directory of the
same name — anything placed there would have been silently wiped on the
next `npm run build` (`emptyOutDir: true`). Set
`directories.buildResources: "build-resources"` explicitly and moved both
platform icons there, so this can't bite a future asset drop the way it
almost did here.

---

## v1.8.0 — July 2026

### Build toolchain — CRA → Vite

Migrated the entire build toolchain from Create React App to Vite 6.
`react-scripts` and its ~40-vulnerability dependency chain are gone. Dev
server starts in under a second instead of 20-40s. No component logic
changed — this is a toolchain swap, not a rewrite.

- Removed `react-scripts`, `wait-on` (replaced by a TCP checker two releases
  ago, never removed), and `cross-env` (only existed to set `BROWSER=none`
  for CRA; Vite doesn't need it)
- Added `vite`, `@vitejs/plugin-react`, `vitest`, `@vitest/coverage-v8`
- Dev server moved from port 3000 to 5173 (`start-electron.js`, `main.js`,
  and the CSP's dev-mode `connect-src` all updated together)
- `index.html` moved from `public/` to the project root (Vite requirement)
- App version is now injected at build time from `package.json` via Vite's
  `define` config (`__APP_VERSION__`), instead of being hardcoded separately
  in About.js, Sidebar.js, and Disclaimer.js. This closes the exact class of
  bug that shipped twice: a version bump missing one of several hardcoded
  locations.

### Security — production CSP tightened

Re-derived the CSP allowlist from a fresh scan of every external call
actually made in the current codebase, rather than trusting the list from
an earlier draft (which had already drifted from reality once).

- Production `script-src` no longer includes `unsafe-eval` (development
  keeps it, since Vite's HMR needs it — packaged builds never see it)
- `connect-src` is now an explicit domain allowlist (ipinfo.io,
  api.ipify.org, rdap.org, api.whois.vu, plus the two Google Fonts domains)
  instead of a `https:` wildcard
- Removed `http://ip-api.com` from the CSP entirely — geolocation already
  runs over `ipinfo.io` (HTTPS)
- Added `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`
  as cheap, zero-risk defense-in-depth
- `style-src 'unsafe-inline'` remains — every component uses React inline
  style objects throughout. Removing this requires a full CSS-modules
  refactor, which is intentionally out of scope here (see engineering
  backlog: CSP Hardening Phase 2)

### Security — hardened the packaged installer

- Removed `node_modules/**/*` from the electron-builder `files` array.
  Nothing in `electron/main.js` or `preload.js` requires a third-party
  package at runtime (only Node/Electron built-ins: `path`, `child_process`,
  `os`, `dns`, `net`) — but the old config would have bundled Vite, Vitest,
  and every dev dependency straight into the shipped installer the moment
  they were added. CI now also explicitly verifies the packaged `app.asar`
  contains none of these before an installer is uploaded.

### Testing — unit test suite added

Added Vitest with 7 test files and 88 assertions covering the project's
pure logic (input validators, ping/traceroute output parsing, CIDR math,
latency classification, and the subnet-sweep export report format). Every
assertion was individually executed against the real, compiled source
during this migration — not just written and assumed correct.

Two real bugs were found and fixed in the process:
- `parseCidrNotation` (see below) threw a `TypeError` on `null` input
  instead of returning `null` gracefully
- The shared `pingParse.js` module's `parseTimeout` used a narrower regex
  than the live `PingTool.js` component — wiring it in as originally
  written would have silently changed which lines get flagged as timeout

**Also discovered:** three separate instances of "shared, testable module
built but never actually imported by the real component" — `validate.js`
vs. `main.js`'s own inline validators, `pingParse.js` vs. `PingTool.js`'s
own local parsing functions, and (already fixed, see below)
`SubnetSweep.js`'s own local CIDR parser. Where unifying was low-risk
(SubnetSweep), it was done. Where it touches more fragile code or crosses
a Node-version boundary (main.js, PingTool.js), it was deliberately
deferred and instead covered by a parity test that pins the live behavior
and fails if the two implementations drift apart — see
`mainValidatorParity.test.js` and `pingToolParity.test.js` for the full
reasoning.

### Refactor — CIDR parsing unified and hardened

`SubnetSweep.js` had its own local, unexported `parseCidr` (plus local
`ipToInt`/`intToIp` duplicating `utils/subnet.js`). Extracted to
`utils/subnet.js` as `parseCidrNotation`, verified behaviorally identical
across 15 inputs (including malformed and edge-case input) before the
component was updated to import it. Also added a defensive guard for
non-string input (previously threw on `null`/`undefined`; now returns
`null` like every other validator in the project).

### Cleanup

- Removed `parsePingOutput` from `src/utils/parsers.js` — confirmed zero
  callers anywhere in the project
- Removed a stale duplicate CSS property in the About page link styling
  (carried over from v1.7.2)

### CI — tests now gate every release

Added a `test` job to the GitHub Actions workflow that runs the IPC
contract checker (see below) and the full Vitest suite. Both
`build-windows` and `build-mac` now require it to pass first
(`needs: [test]`) — a failing test blocks the release entirely, rather than
being something that could theoretically be run locally and forgotten.
Also bumped `setup-node` to Node 22 in every job to match Electron 42's
actual requirement (see the Node upgrade note below).

### New tool — IPC contract checker

Added `scripts/check-ipc-contract.js`, run via `npm run check:ipc` and
wired into CI. It statically verifies that every `window.electronAPI.X`
call in the renderer has a matching export in `preload.js`, and that every
IPC channel `preload.js` sends/invokes has a matching handler in
`electron/main.js`. This exists because of two real incidents this
project has already had — a removed-but-still-called `getSystemInfo`
that white-screened the app, and three error-listener channels that
main.js sent but preload.js never relayed — neither of which any unit
test could have caught, since both are wiring bugs, not logic bugs. The
checker was verified against both incidents by deliberately reintroducing
each one and confirming it's caught before being fixed.

### Node.js version requirement raised to 22

Electron 42 actually requires Node ≥22.12.0 (previously surfaced only as
an `EBADENGINE` warning on Node 20). `package.json`'s `engines` field and
every CI job now reflect this. **Action required on your development
machine before this release**: upgrade from Node 20 to Node 22 LTS. See
the project README or ask for the step-by-step if needed — the process is
the same shape as the earlier Node 18→20 upgrade.

### Bugs found and fixed during pre-release smoke testing

The migration above was built and unit-tested before ever running against
a real Node 22 environment. Manually walking through all 9 modules in a
live dev build (and then the packaged installer) surfaced four issues no
automated check caught:

- **IP Info was completely broken.** `IpInfo.js` still called the old
  `http://ip-api.com` endpoint directly. The production CSP's `connect-src`
  had already been locked down to `https://ipinfo.io` (see above), so every
  request was silently blocked and the module always showed "Failed to
  fetch." Rewired `fetchIpDetails` to call `ipinfo.io` and remapped its
  response shape (it merges ASN + org into one field, and doesn't provide
  a region code or full country name the way the old endpoint did).
- **Subnet Sweep's invalid-CIDR error banner didn't render.** The
  `sweepError` state was set correctly and the `errorBanner` style existed,
  but the actual JSX block that displays it had been dropped somewhere in
  the `SubnetSweep.js` refactor. Entering `not-a-cidr` and pressing Start
  Sweep did nothing visible — no crash, no error, just silence. Restored
  the banner using the same pattern already used by `PingTool.js`,
  `Traceroute.js`, and `PortScanner.js`.
- **The packaged installer still bundled `node_modules`.** `react` and
  `react-dom` were left under `dependencies` instead of `devDependencies`.
  Vite already inlines both fully into the built JS bundle, and neither is
  ever touched by `electron/main.js`, but electron-builder bundles
  `node_modules` for anything listed under `dependencies` regardless of
  the `files` array. This directly contradicted this release's own stated
  goal (see "Security — hardened the packaged installer," above) — the new
  CI asar check would have caught it on the very first release build.
  Moved both to `devDependencies`; the packaged `app.asar` now contains
  only `build/`, `electron/`, and `package.json`, exactly as intended.
- **Dev server wouldn't start on this machine.** `vite.config.mjs` didn't
  pin `server.host`, so Vite bound only to IPv6 loopback (`[::1]`) under
  Node 22/24 here, while `start-electron.js` polls `127.0.0.1` (IPv4) and
  timed out waiting for it every time. Added `host: '127.0.0.1'` to force
  IPv4. Dev-only — never affected packaged builds.

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
