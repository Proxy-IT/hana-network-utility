# 🌸 Hana — Network Utility

> ⚠️ **Legal Notice:** Hana is intended for use only on networks you own or have explicit
> permission to test. Unauthorized network scanning may be illegal in your jurisdiction.
> The developer accepts no responsibility for misuse. See [TERMS.md](TERMS.md) for full terms of use.

<div align="center">

**Fast, clean, and lightweight network diagnostics for Windows and macOS.**
*No command prompt. No dependencies. No bloat.*

[Download Latest Release](../../releases/latest) · [Report a Bug](../../issues) · [Request a Feature](../../issues)

</div>

---

## What is Hana?

Hana is a free desktop network utility built for IT professionals, network
administrators, and technically curious users who need fast, reliable network
diagnostics without the overhead of heavy enterprise tools.

The name Hana (ханa) means "flower" in Bosnian — something small, purposeful,
and built with care. That philosophy carries through to every part of the app:
lightweight installer, clean interface, instant results.

It ships ten modules in a single window, runs on Windows and macOS, collects
no data, and can keep itself up to date.

---

## Modules

### ◎ Ping
Test whether a host is reachable and measure round-trip time with precision.

- **Fixed mode** — send 1, 2, 4, 8, or 16 packets and get a clean min/avg/max summary
- **Continuous mode** — run an infinite ping with a live scrolling RTT graph,
  real-time packet loss counter, and color-coded latency classification
- Correctly detects "destination host unreachable" replies as failures
- Export results as `.txt` or `.csv`

### ⊛ Multi-Ping
Monitor up to 5 hosts simultaneously on a single screen.

- Each host gets its own live status card — green when responding, red when down
- Sparkline bar chart shows the last 20 ping results per host at a glance
- Global status bar shows total up vs down count instantly
- Hosts keep pinging in the background while you use other modules
- Designed for watching devices come back online after a reboot or failover

### ⤵ Traceroute
Trace the exact network path your traffic takes to reach any destination.

- Live hop-by-hop streaming — results appear as they arrive
- Color-coded RTT per hop — green through red shows latency at a glance
- Identifies unresponsive hops without stalling the trace
- Export full hop table as `.txt` or `.csv`

### ⊞ Subnet Sweep
Discover every host on a subnet without touching the command line.

- **Range mode** — enter the first three octets and a start/end host range
- **CIDR mode** — sweep an entire subnet from `/16` through `/30` by notation,
  with a live host-count and range preview
- Parallel ping sweep with a live progress bar
- **Stop Scan** cancels a running sweep instantly and preserves partial results
- Results paginate (first 254 shown, live hosts bubble to the top) so large
  sweeps stay responsive; export always includes every result
- Export full results as `.txt` or `.csv`

### ⊟ Subnet Calculator
Instant CIDR subnet math — no mental arithmetic required.

- Enter any IP address and drag the prefix slider
- Instantly calculates network address, broadcast address, first and last
  usable host, subnet mask, wildcard mask, total hosts, IP class, and
  whether the address is private or public
- Binary representation with network bits highlighted
- Updates in real time as you adjust the prefix

### ⊕ IP Info & WhoIs
Three tools in one tab — no browser required.

- **Your Public IP** — auto-detected on load with ISP, location, ASN,
  timezone, and coordinate details
- **IP Lookup** — enter any IP address to see its full geolocation
  and network information
- **WhoIs** — look up registration records for any domain or IP,
  including registrar, creation and expiry dates, and name servers
- All three sections export to `.txt` and `.csv`

### ◈ DNS Lookup
Resolve DNS records for any hostname or IP address.

- Supports A, AAAA, CNAME, MX, TXT, NS, and PTR records — or **ALL** at once
- Choose a resolver: Google (8.8.8.8), Cloudflare (1.1.1.1), or a custom server
- Automatic reverse (PTR) lookup when you enter an IP address
- Color-coded record badges with TTL and MX priority
- Each request uses an isolated resolver — no global DNS state is mutated
- Export results as `.txt` or `.csv`

### ⊘ Port Scanner
Check which TCP ports are open, closed, or filtered on a host.

- 24 common ports as selectable chips, plus Web / Remote / Mail / Database /
  Network group presets and a custom-port field
- Open (green), Closed (gray), and Filtered (amber) results with service names
- **Stop** cancels a running scan at any time
- A mandatory authorization checkbox must be confirmed before scanning is enabled
- Export results as `.txt` or `.csv`

### ≋ Latency Guide
A built-in reference for understanding what your ping results actually mean.

- Latency tier table from loopback (< 1ms) through satellite (> 700ms)
- Per-application thresholds for gaming, VoIP, video conferencing,
  web browsing, database queries, and CDN delivery
- Live classifier — type any ms value to instantly see its rating

### ↗ Hana's Favs
A curated, credited directory of free third-party network and security tools.

- Grouped by category: SSL/TLS, MAC/hardware, BGP/routing,
  availability/performance, and security
- Each card is a static, built-in link — nothing here is fetched or
  editable — credited to its operator (e.g. Qualys SSL Labs, Ookla)
- Clicking opens the site in your default browser; Hana never contacts
  these services on its own

---

## Why Hana instead of the command line?

| Task | Command line | Hana |
|---|---|---|
| Continuous ping with graph | `ping -t 8.8.8.8` + mental math | One click, live graph |
| Monitor multiple hosts | Multiple windows | Multi-Ping, one screen |
| Subnet sweep (range or CIDR) | Script or third-party tool | Built in, visual results |
| Subnet calculation | RFC lookup + manual math | Instant, with binary view |
| Traceroute | `tracert -d hostname` | Streaming, color-coded |
| DNS records | `nslookup -type=MX ...` | All record types, any resolver |
| TCP port check | `Test-NetConnection` / `nc` loop | Presets + custom, cancellable |
| Public IP / WhoIs lookup | Open browser, google it | Built in, exportable |
| Export results | Copy/paste from terminal | One click `.txt` or `.csv` |

---

## Installation

### Windows

1. Go to the [Releases page](../../releases/latest)
2. Download `Hana-NetworkUtility-Setup-<version>.exe`
3. Run the installer and follow the prompts
4. Launch Hana from the Start Menu

> **Windows SmartScreen warning:** If you see "Windows protected your PC",
> click **More info** then **Run anyway**. This appears because the Windows
> build is not yet code signed (planned for a future release). The installer
> is safe, and downloads delivered by the in-app updater are additionally
> verified by SHA-512 hash.

### macOS

1. On the [Releases page](../../releases/latest), download the `.dmg` for your chip:
   - **Apple Silicon (M1–M4)** → the file ending in `arm64.dmg`
   - **Intel** → the standard `x64.dmg`
2. Open the DMG and drag **Hana - Network Utility** onto the Applications folder
3. Launch it from Applications

> The macOS build is **signed and notarized by Apple**, so it opens normally
> with no Gatekeeper warning.

---

## Staying up to date

Hana can update itself from **About → Updates**:

- Click **Check for Updates**. If a newer version exists, choose **Download**,
  then **Install & Restart**.
- Nothing happens automatically by default. An opt-in **"Automatically check
  for updates on startup"** toggle is available and defaults **off**, so the
  app makes no update request unless you ask it to.

Update security:

- The update feed is **pinned** to this GitHub repository — the app never
  follows an arbitrary or network-supplied URL.
- Every download is **integrity-checked (SHA-512)** against the signed release
  metadata before it is installed; on macOS the update must also carry a valid
  Apple signature.
- **Downgrade-protected** — the updater will never replace your build with an
  older or pre-release version.

---

## Privacy & Security

Hana collects **no data** of any kind and makes **no background network
connections**. Outbound requests happen only when you explicitly trigger them:

- Ping and traceroute packets to hosts you specify
- DNS queries to the resolver you choose (DNS Lookup)
- TCP connection attempts to hosts/ports you scan (Port Scanner)
- IP geolocation via [ipinfo.io](https://ipinfo.io) and public-IP detection via
  [ipify.org](https://api.ipify.org) (IP Info)
- WhoIs queries via public RDAP ([rdap.org](https://rdap.org)) and WhoIs services
- Update checks to GitHub Releases — only when you click **Check for Updates**,
  or if you enable the opt-in startup check (off by default)

See [PRIVACY.md](PRIVACY.md) for the full privacy policy and
[SECURITY.md](SECURITY.md) for how to report vulnerabilities.

---

## Acceptable Use

Hana is provided for legitimate network administration, troubleshooting,
and educational use only. You must have permission to scan any network
you test. See [TERMS.md](TERMS.md) for the full terms of use.

---

## Building from Source

```bash
# Prerequisites: Node.js v22 or later
git clone https://github.com/Proxy-IT/hana-network-utility.git
cd hana-network-utility
npm install
npm start              # run in development mode (Vite + Electron)
npm test               # run the Vitest suite
npm run check:ipc      # verify the renderer ↔ preload ↔ main IPC contract
npm run build          # produce an installer in dist/
```

---

## Version History

| Version | Highlights |
|---|---|
| v1.10.0 | Hana's Favs — a curated, credited directory of free SSL/TLS, MAC, BGP, and security lookup tools |
| v1.9.2 | Fixed macOS auto-update (electron-updater requires a `.zip` release asset; the mac build previously only produced a `.dmg`) |
| v1.9.1 | Subnet Sweep now defaults to CIDR mode (was Range); added a persistent "Patch notes" link in About → Updates |
| v1.9.0 | In-app auto-updater — manual check plus opt-in startup check (off by default); downloads are SHA-512-verified, feed-pinned to GitHub, and downgrade-protected |
| v1.8.2 | Security & reliability hardening — CSV formula-injection protection, unified CSV escaping, Port Scanner cancellation, Traceroute/Port Scanner cleanup on tab switch, dead-code removal |
| v1.8.1 | Real branding — app icons (Windows & macOS), in-app logo, favicon, and landing-page assets |
| v1.8.0 | Migrated build toolchain from Create React App to Vite; added a unit test suite; tightened production CSP; Node.js requirement raised to v22 |
| v1.7.2 | In-app feedback channel (Report a Bug / Request a Feature); macOS code signing & notarization; hardened the open-external handler |
| v1.7.0 | Electron 42 upgrade; main-process input validation across every module; per-request DNS resolver isolation; subnet-sweep reliability fixes |
| v1.6.5 | DNS Lookup and Port Scanner modules; CIDR subnet sweep; shell-injection fix; Clear buttons |
| v1.5.0 | Persistent module state, real-time ping results, accurate unreachable detection |
| v1.3.0 | Multi-Ping monitor for up to 5 hosts; IP Info & WhoIs module with full export |
| v1.2.0 | Rebranded to Hana; CSV/TXT export on all tools; redesigned subnet sweep results |
| v1.1.0 | Continuous ping with live RTT graph; in-app instructions; Windows path fixes |
| v1.0.0 | Initial release |

See [CHANGELOG.md](CHANGELOG.md) for full patch notes.

---

## License

This project is licensed under the **GNU General Public License v3.0**.
See [LICENSE](LICENSE) for details.

---

<div align="center">
<sub>Built with care. Named with meaning. 🌸</sub>
</div>
