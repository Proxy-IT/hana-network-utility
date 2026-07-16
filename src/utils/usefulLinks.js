// ── Useful Links — curated, static directory of free network/security tools ──
//
// This list is a hardcoded constant, not fetched from any remote source and
// not user-editable. That's a deliberate security property: every URL here
// was reviewed by hand, and there is no code path by which it could be
// altered at runtime (e.g. by a compromised dependency or a malformed
// server response). If you add an entry, keep it that way.
//
// Every url MUST use https:// — enforced by src/utils/__tests__/usefulLinks.test.js.
// Hana never contacts these services itself; a click hands off to the user's
// default browser via openExternal (see src/utils/openLink.js), so nothing
// here is a network request Hana makes on its own.
//
// Attribution is intentionally neutral ("by <Provider>") — it names the
// operator of each tool without implying endorsement of Hana by them.

export const LINK_CATEGORIES = [
  {
    category: 'SSL / TLS',
    links: [
      {
        name: 'SSL Server Test',
        provider: 'Qualys SSL Labs',
        url: 'https://www.ssllabs.com/ssltest/',
        domain: 'ssllabs.com',
        desc: 'Deep analysis of a server’s SSL/TLS configuration — protocol support, cipher suites, and a letter grade.',
      },
      {
        name: 'crt.sh',
        provider: 'Sectigo',
        url: 'https://crt.sh/',
        domain: 'crt.sh',
        desc: 'Search Certificate Transparency logs to see every certificate ever issued for a domain.',
      },
    ],
  },
  {
    category: 'MAC / Hardware',
    links: [
      {
        name: 'MAC Address Lookup',
        provider: 'MacVendors',
        url: 'https://macvendors.com/',
        domain: 'macvendors.com',
        desc: 'Resolve a MAC address to its hardware manufacturer from the OUI prefix.',
      },
    ],
  },
  {
    category: 'BGP / Routing',
    links: [
      {
        name: 'BGP Toolkit',
        provider: 'Hurricane Electric',
        url: 'https://bgp.he.net/',
        domain: 'bgp.he.net',
        desc: 'ASN, peering, and route-origin (BGP) lookups for any IP, prefix, or AS number.',
      },
    ],
  },
  {
    category: 'Availability / Performance',
    links: [
      {
        name: 'Down for Everyone or Just Me',
        provider: 'downforeveryoneorjustme.com',
        url: 'https://downforeveryoneorjustme.com/',
        domain: 'downforeveryoneorjustme.com',
        desc: 'Quickly check whether a site is down for everyone, or just you.',
      },
      {
        name: 'Speedtest',
        provider: 'Ookla',
        url: 'https://www.speedtest.net/',
        domain: 'speedtest.net',
        desc: 'Measure your connection’s download/upload speed and latency to a nearby server.',
      },
    ],
  },
  {
    category: 'Security',
    links: [
      {
        name: 'Have I Been Pwned',
        provider: 'Troy Hunt',
        url: 'https://haveibeenpwned.com/',
        domain: 'haveibeenpwned.com',
        desc: 'Check whether an email address or domain has appeared in a known data breach.',
      },
    ],
  },
];
