# 🌸 Hana — Network Utility

> ⚠️ **Legal Notice:** Hana is intended for use only on networks you own or have explicit
> permission to test. Unauthorized network scanning may be illegal in your jurisdiction.
> The developer accepts no responsibility for misuse. See [TERMS.md](TERMS.md) for full terms of use.

<div align="center">

**Fast, clean, and lightweight network diagnostics for Windows.**
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

---

## Modules

### ◎ Ping
Test whether a host is reachable and measure round-trip time with precision.

- **Fixed mode** — send 1 to 16 packets and get a clean min/avg/max summary
- **Continuous mode** — run an infinite ping with a live scrolling RTT graph,
  real-time packet loss counter, and color-coded latency classification
- Export results as `.txt` or `.csv`

### ⊛ Multi-Ping
Monitor up to 5 hosts simultaneously on a single screen.

- Each host gets its own live status card — green when responding, red when down
- Sparkline bar chart shows the last 20 ping results per host at a glance
- Global status bar shows total up vs down count instantly
- Designed for watching devices come back online after a reboot or failover
  without switching windows

### ⤵ Traceroute
Trace the exact network path your traffic takes to reach any destination.

- Live hop-by-hop streaming — results appear as they arrive
- Color-coded RTT per hop — green through red shows latency at a glance
- Identifies unresponsive hops without stalling the trace
- Export full hop table as `.txt` or `.csv`

### ⊞ Subnet Sweep
Discover every host on a subnet without touching the command line.

- Enter the first three octets of your subnet and a scan range
- Parallel ping sweep with live progress bar
- Two-column results table — green for live hosts, gray for no response
- Sorted numerically so results are immediately readable
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

### ≋ Latency Guide
A built-in reference for understanding what your ping results actually mean.

- Latency tier table from loopback (< 1ms) through satellite (> 700ms)
- Per-application thresholds for gaming, VoIP, video conferencing,
  web browsing, database queries, and CDN delivery
- Live classifier — type any ms value to instantly see its rating

---

## Why Hana instead of the command line?

| Task | Command line | Hana |
|---|---|---|
| Continuous ping with graph | `ping -t 8.8.8.8` + mental math | One click, live graph |
| Monitor multiple hosts | Multiple windows | Multi-Ping, one screen |
| Subnet sweep | Script or third-party tool | Built in, visual results |
| Subnet calculation | RFC lookup + manual math | Instant, with binary view |
| Traceroute | `tracert -d hostname` | Streaming, color-coded |
| Public IP lookup | Open browser, google it | Built in, instant |
| WhoIs lookup | Command line tool or website | Built in, exportable |
| Export results | Copy/paste from terminal | One click `.txt` or `.csv` |

---

## Installation

### Windows

1. Go to the [Releases page](../../releases/latest)
2. Download `Hana - Network Utility Setup 1.7.0.exe`
3. Run the installer and follow the prompts
4. Launch Hana from the Start Menu

> **Windows SmartScreen warning:** If you see "Windows protected your PC",
> click **More info** then **Run anyway**. This appears because Hana is not
> yet code signed. It is completely safe to install.

---

### Mac

**Step 1 — Download the correct version for your Mac**

Click the Apple menu → **About This Mac** to check your chip:
- **Apple M1 / M2 / M3 / M4** → download the file ending in `arm64.dmg`
- **Intel** → download the standard `.dmg` file

**Step 2 — Open the DMG**

Double-click the downloaded `.dmg` file. A window appears showing the
Hana icon and an Applications folder shortcut.

**Step 3 — Drag to Applications**

Drag the Hana icon onto the Applications folder.

**Step 4 — First launch (important)**

Because Hana is not yet notarized with Apple, macOS will block it on
first launch. Here is how to open it:

**Method A — Right-click (easiest):**
1. Open **Finder → Applications**
2. Find **Hana - Network Utility**
3. **Right-click** it → click **Open**
4. Click **Open** in the dialog that appears
5. Hana will launch and remember your choice permanently

**Method B — Privacy & Security settings:**
1. Try to open Hana normally — macOS will show a warning
2. Go to **Apple menu → System Settings → Privacy & Security**
3. Scroll down to find the message about Hana being blocked
4. Click **Open Anyway**
5. Enter your Mac password if prompted

> **Why does this happen?** macOS Gatekeeper requires apps to be notarized
> with an Apple Developer certificate. Hana is a free open source tool and
> notarization is being added in a future release. The app is completely
> safe — you can inspect the full source code on this page.

---

---

## Privacy & Security

Hana collects **no data** of any kind. It makes outbound network requests
only when you explicitly trigger them:

- Ping and traceroute packets to hosts you specify
- IP geolocation queries via [ip-api.com](http://ip-api.com) (IP Info module)
- WhoIs queries via public RDAP and WhoIs services
- Public IP detection via [ipify.org](https://api.ipify.org)

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
# Prerequisites: Node.js v18 or later
git clone https://github.com/Proxy-IT/hana-network-utility.git
cd hana-network-utility
npm install
npm start            # run in development mode
npm run build        # produce installer in dist/
```

---

## Version History

| Version | Highlights |
|---|---|
| v1.7.0 | Persistent module state, real-time ping results, accurate unreachable detection, npm start fix |
| v1.4.0 | First-launch disclaimer, About page, sidebar logo, openExternal links |
| v1.3.0 | Multi-Ping monitor for up to 5 hosts, IP Info & WhoIs module with full export |
| v1.2.0 | Rebranded to Hana, CSV/TXT export on all tools, redesigned subnet sweep results |
| v1.1.0 | Continuous ping with live RTT graph, in-app instructions, Windows path fixes |
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
