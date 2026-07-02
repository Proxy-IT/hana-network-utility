// Pure subnet math — no system calls needed

export function ipToInt(ip) {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

export function intToIp(int) {
  return [
    (int >>> 24) & 255,
    (int >>> 16) & 255,
    (int >>> 8)  & 255,
     int         & 255,
  ].join('.');
}

export function cidrToMask(cidr) {
  const mask = cidr === 0 ? 0 : (0xFFFFFFFF << (32 - cidr)) >>> 0;
  return intToIp(mask);
}

export function calculateSubnet(ip, cidr) {
  const ipInt      = ipToInt(ip);
  const maskInt    = cidrToMask(cidr) ? ipToInt(cidrToMask(cidr)) : 0;
  const networkInt = (ipInt & maskInt) >>> 0;
  const broadInt   = (networkInt | ~maskInt) >>> 0;
  const firstHost  = cidr < 31 ? networkInt + 1 : networkInt;
  const lastHost   = cidr < 31 ? broadInt   - 1 : broadInt;
  const totalHosts = cidr >= 31 ? Math.pow(2, 32 - cidr) : Math.pow(2, 32 - cidr) - 2;

  return {
    ip,
    cidr,
    subnetMask:    cidrToMask(cidr),
    networkAddress:intToIp(networkInt),
    broadcastAddr: cidr < 31 ? intToIp(broadInt) : 'N/A (point-to-point)',
    firstHost:     intToIp(firstHost),
    lastHost:      intToIp(lastHost),
    totalHosts:    Math.max(0, totalHosts),
    wildcardMask:  intToIp(~maskInt >>> 0),
    ipClass:       getIpClass(ip),
    isPrivate:     isPrivateIp(ip),
    binaryIp:      ipToBinary(ip),
    binaryMask:    ipToBinary(cidrToMask(cidr)),
  };
}

function getIpClass(ip) {
  const first = parseInt(ip.split('.')[0], 10);
  if (first < 128)  return 'A';
  if (first < 192)  return 'B';
  if (first < 224)  return 'C';
  if (first < 240)  return 'D (Multicast)';
  return 'E (Reserved)';
}

function isPrivateIp(ip) {
  const int = ipToInt(ip);
  const ranges = [
    [ipToInt('10.0.0.0'),    ipToInt('10.255.255.255')],
    [ipToInt('172.16.0.0'),  ipToInt('172.31.255.255')],
    [ipToInt('192.168.0.0'), ipToInt('192.168.255.255')],
    [ipToInt('127.0.0.0'),   ipToInt('127.255.255.255')],
  ];
  return ranges.some(([s, e]) => int >= s && int <= e);
}

function ipToBinary(ip) {
  return ip.split('.').map(o => parseInt(o, 10).toString(2).padStart(8, '0')).join('.');
}

export function validateIp(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  return parts.every(p => {
    const n = parseInt(p, 10);
    return !isNaN(n) && n >= 0 && n <= 255 && String(n) === p;
  });
}

/**
 * Parses a combined CIDR notation string (e.g. "192.168.1.0/24") into its
 * network components. This was previously a local, unexported function
 * living inside SubnetSweep.js — extracted here so it's shared and testable.
 * Logic is unchanged from the original; only the ipToInt/intToIp calls now
 * reference this file's own (behaviorally identical) versions instead of
 * SubnetSweep.js's local duplicates, which have been removed.
 *
 * Distinct from calculateSubnet() above: that function takes a separate
 * ip + cidr-number pair (used by the Subnet Calculator module); this one
 * takes a single combined "ip/prefix" string (used by Subnet Sweep, which
 * needs to parse a CIDR the user typed directly into one field).
 *
 * @param {string} cidr — e.g. "192.168.1.0/24"
 * @returns {{
 *   network: string, broadcast: string, firstHost: string, lastHost: string,
 *   firstInt: number, lastInt: number, totalHosts: number, prefix: number
 * } | null}
 */
export function parseCidrNotation(cidr) {
  if (!cidr || typeof cidr !== 'string') return null;
  const parts = cidr.trim().split('/');
  if (parts.length !== 2) return null;
  const ip     = parts[0].trim();
  const prefix = parseInt(parts[1], 10);
  if (isNaN(prefix) || prefix < 1 || prefix > 32) return null;
  const ipParts = ip.split('.');
  if (ipParts.length !== 4) return null;
  if (!ipParts.every(p => /^\d{1,3}$/.test(p) && parseInt(p, 10) <= 255)) return null;
  const ipInt      = ipToInt(ip);
  const maskInt    = prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0;
  const networkInt = (ipInt & maskInt) >>> 0;
  const broadInt   = (networkInt | ~maskInt) >>> 0;
  const firstHost  = prefix < 31 ? networkInt + 1 : networkInt;
  const lastHost   = prefix < 31 ? broadInt   - 1 : broadInt;
  const totalHosts = prefix >= 31 ? Math.pow(2, 32 - prefix) : Math.pow(2, 32 - prefix) - 2;
  return {
    network:    intToIp(networkInt),
    broadcast:  intToIp(broadInt),
    firstHost:  intToIp(firstHost),
    lastHost:   intToIp(lastHost),
    firstInt:   firstHost,
    lastInt:    lastHost,
    totalHosts: Math.max(0, totalHosts),
    prefix,
  };
}
