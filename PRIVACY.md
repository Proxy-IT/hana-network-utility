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
- IP geolocation lookups via ipinfo.io (IP Info module)
- WhoIs queries via public RDAP and WhoIs services (IP Info module)
- Public IP detection via api.ipify.org (IP Info module)
- Update checks and downloads via GitHub Releases (see **Automatic Updates**
  below) — **only when you click "Check for Updates," or if you have
  separately turned on the optional startup-check setting**

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

## Third party services

Hana's modules use these services only when you use the corresponding
feature:

- **api.ipify.org** — to detect your public IP address (IP Info module)
- **ipinfo.io** — for IP geolocation data (IP Info module)
- **rdap.org** — for WhoIs domain records (IP Info module)
- **api.whois.vu** — for raw WhoIs data (IP Info module)
- **github.com** — to check for and download app updates, only when you
  trigger a check as described above

Please review their respective privacy policies for information on
how they handle queries.
