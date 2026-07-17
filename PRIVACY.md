# Privacy Policy — Hana Network Utility

**Last updated: July 2026**

## What data Hana collects

None. Hana does not collect, transmit, store, or share any personal
data, usage data, telemetry, or analytics of any kind.

## Network requests

Hana makes outbound network requests only at the explicit direction
of the user:

- Ping and traceroute packets sent to user-specified hosts
- DNS queries sent to the resolver you choose (DNS Lookup module)
- TCP connection attempts to the host/ports you scan (Port Scanner module)
- Repeated TCP connection attempts, and an optional TLS handshake, to the
  single host:port you specify (TCP Ping module) — the TLS handshake, if
  enabled, is used only to measure whether it completes and how long it
  takes; no data is sent or received beyond the handshake itself, and the
  connection is closed immediately afterward
- IP geolocation lookups via ipinfo.io (IP Info module)
- WhoIs queries via public RDAP and WhoIs services (IP Info module)
- Public IP detection via api.ipify.org (IP Info module)
- Update checks and downloads via GitHub Releases (see **Automatic Updates**
  below) — **only when you click "Check for Updates," or if you have
  separately turned on the optional startup-check setting**

Separately, **Hana's Favs** (see below) opens a link in your default web
browser when you click one — this is not a request Hana itself makes; your
browser handles it independently, outside of Hana's process, the same as
clicking any link on a web page.

No data from any of these requests is stored or transmitted to the developer.

## Automatic Updates

Hana can check GitHub for a newer version from **About → Updates**.

- **This feature is a toggle, and it is OFF by default.** A fresh install
  of Hana never checks for updates on its own. The only way to check is to
  click the **Check for Updates** button yourself.
- There is a separate, optional setting — **"Automatically check for
  updates on startup"** — that you can turn on if you want Hana to check
  automatically each time it launches. It ships **unchecked**, and stays
  that way unless you deliberately enable it. Turning it on is fully
  reversible: uncheck it at any time to go back to manual-only checks.
- An update check is a request to GitHub's servers asking "what's the
  latest release?" — no personal data, hardware identifiers, or usage
  information is included or transmitted.
- The update source is pinned to this project's official GitHub repository
  and cannot be redirected elsewhere. Every downloaded update is verified
  by cryptographic hash (SHA-512) against the published release before
  installation, and Hana will never install an older or pre-release build
  over your current version.
- Nothing is ever downloaded or installed without you clicking **Download**
  and then **Install & Restart** yourself — a found update is only
  announced, never applied automatically.

## Hana's Favs

Hana's Favs is a static, built-in directory of free third-party network and
security tools (SSL/TLS testers, MAC address lookup, BGP/routing lookup,
uptime checkers, and breach-check tools) — credited to their operators on
each card.

- The list is fixed at build time. It is not downloaded, fetched, or
  updated remotely, and nothing in it is user-editable.
- Clicking a card opens that site in your default web browser. Hana does
  not send any data to these sites, does not track which links you click,
  and does not contact any of them on its own — the only network activity
  is your browser's, after you've explicitly clicked.
- These are independent services, not affiliated with or endorsed by Hana.
  Once you leave to their site, their own privacy policy applies.

## Third party services

Hana's modules use these services only when you use the corresponding
feature:

- **api.ipify.org** — to detect your public IP address (IP Info module)
- **ipinfo.io** — for IP geolocation data (IP Info module)
- **rdap.org** — for WhoIs domain records (IP Info module)
- **api.whois.vu** — for raw WhoIs data (IP Info module)
- **github.com** — to check for and download app updates, only when you
  trigger a check as described above

Hana's Favs links to (only when you click a card):

- **ssllabs.com** (Qualys SSL Labs) — SSL/TLS server configuration testing
- **crt.sh** (Sectigo) — Certificate Transparency log search
- **macvendors.com** (MacVendors) — MAC address to manufacturer lookup
- **bgp.he.net** (Hurricane Electric) — BGP/ASN routing lookup
- **downforeveryoneorjustme.com** — site availability checker
- **speedtest.net** (Ookla) — internet connection speed test
- **haveibeenpwned.com** (Troy Hunt) — data breach lookup

Please review their respective privacy policies for information on
how they handle queries.
