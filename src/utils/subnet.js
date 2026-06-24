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
