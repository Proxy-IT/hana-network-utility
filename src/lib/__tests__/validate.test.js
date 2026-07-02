import { describe, it, expect } from 'vitest';
import {
  validateHost,
  isValidIpv4,
  isValidIpv6,
  VALID_DNS_TYPES,
  validatePorts,
  validatePingCount,
} from '../validate.js';

// ── validateHost ──────────────────────────────────────────────────────────────

describe('validateHost', () => {
  it('accepts standard hostnames', () => {
    expect(validateHost('google.com')).toBeNull();
    expect(validateHost('server.local')).toBeNull();
    expect(validateHost('sub.domain.example.com')).toBeNull();
  });

  it('accepts valid IPv4 addresses', () => {
    expect(validateHost('8.8.8.8')).toBeNull();
    expect(validateHost('192.168.1.1')).toBeNull();
    expect(validateHost('10.0.0.1')).toBeNull();
  });

  it('accepts valid IPv6 addresses', () => {
    expect(validateHost('2001:db8::1')).toBeNull();
    expect(validateHost('::1')).toBeNull();
  });

  it('rejects empty input', () => {
    expect(validateHost('')).not.toBeNull();
    expect(validateHost('   ')).not.toBeNull();
    expect(validateHost(null)).not.toBeNull();
    expect(validateHost(undefined)).not.toBeNull();
  });

  it('rejects hostnames over 253 characters', () => {
    expect(validateHost('a'.repeat(254))).not.toBeNull();
    expect(validateHost('a'.repeat(253))).toBeNull(); // exactly 253 is fine
  });

  it('rejects shell metacharacters — injection guard', () => {
    expect(validateHost('host && calc')).not.toBeNull();
    expect(validateHost('host; rm -rf ~')).not.toBeNull();
    expect(validateHost('$(whoami)')).not.toBeNull();
    expect(validateHost('`id`')).not.toBeNull();
    expect(validateHost('host | cat /etc/passwd')).not.toBeNull();
    expect(validateHost('host > /tmp/out')).not.toBeNull();
  });

  it('rejects characters invalid in hostnames (@, !, #, %)', () => {
    expect(validateHost('not@a!host')).not.toBeNull();  // the real-world case that broke earlier
    expect(validateHost('user@domain.com')).not.toBeNull();
    expect(validateHost('host#name')).not.toBeNull();
    expect(validateHost('host%name')).not.toBeNull();
  });
});

// ── isValidIpv4 ───────────────────────────────────────────────────────────────

describe('isValidIpv4', () => {
  it('accepts valid addresses', () => {
    expect(isValidIpv4('0.0.0.0')).toBe(true);
    expect(isValidIpv4('192.168.1.1')).toBe(true);
    expect(isValidIpv4('255.255.255.255')).toBe(true);
  });

  it('rejects out-of-range octets', () => {
    expect(isValidIpv4('256.1.1.1')).toBe(false);
    expect(isValidIpv4('192.168.1.256')).toBe(false);
  });

  it('rejects wrong number of octets', () => {
    expect(isValidIpv4('1.2.3')).toBe(false);
    expect(isValidIpv4('1.2.3.4.5')).toBe(false);
  });

  it('rejects non-numeric values', () => {
    expect(isValidIpv4('a.b.c.d')).toBe(false);
    expect(isValidIpv4('')).toBe(false);
    expect(isValidIpv4(null)).toBe(false);
  });
});

// ── VALID_DNS_TYPES ───────────────────────────────────────────────────────────

describe('VALID_DNS_TYPES allowlist', () => {
  it('contains all supported record types', () => {
    for (const t of ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'PTR', 'ALL']) {
      expect(VALID_DNS_TYPES.has(t)).toBe(true);
    }
  });

  it('rejects unsupported and injection-style types', () => {
    expect(VALID_DNS_TYPES.has('ANY')).toBe(false);        // deprecated, not supported
    expect(VALID_DNS_TYPES.has('INVALID')).toBe(false);
    expect(VALID_DNS_TYPES.has('')).toBe(false);
    expect(VALID_DNS_TYPES.has('A; DROP')).toBe(false);
  });

  it('is case-sensitive — lowercase is rejected', () => {
    expect(VALID_DNS_TYPES.has('a')).toBe(false);
    expect(VALID_DNS_TYPES.has('mx')).toBe(false);
  });
});

// ── validatePorts ─────────────────────────────────────────────────────────────

describe('validatePorts', () => {
  it('accepts a clean integer array in valid range', () => {
    const result = validatePorts([22, 80, 443, 3389]);
    expect(result.ok).toBe(true);
    expect(result.ports).toEqual([22, 80, 443, 3389]);
  });

  it('coerces numeric strings to integers', () => {
    const result = validatePorts(['22', '80', '443']);
    expect(result.ok).toBe(true);
    expect(result.ports).toEqual([22, 80, 443]);
  });

  it('rejects port 0', () => {
    expect(validatePorts([0]).ok).toBe(false);
  });

  it('rejects port above 65535', () => {
    expect(validatePorts([65536]).ok).toBe(false);
    expect(validatePorts([70000]).ok).toBe(false);
  });

  it('rejects non-numeric entries', () => {
    expect(validatePorts([22, 'eighty', 443]).ok).toBe(false);
    expect(validatePorts([22, NaN, 443]).ok).toBe(false);
  });

  it('rejects empty array', () => {
    expect(validatePorts([]).ok).toBe(false);
  });

  it('rejects arrays over 500 ports', () => {
    const big = Array.from({ length: 501 }, (_, i) => i + 1);
    expect(validatePorts(big).ok).toBe(false);
  });

  it('accepts exactly 500 ports', () => {
    const max = Array.from({ length: 500 }, (_, i) => i + 1);
    expect(validatePorts(max).ok).toBe(true);
  });
});

// ── validatePingCount ─────────────────────────────────────────────────────────

describe('validatePingCount', () => {
  it('accepts valid counts', () => {
    expect(validatePingCount(1)).toBeNull();
    expect(validatePingCount(4)).toBeNull();
    expect(validatePingCount(100)).toBeNull();
    expect(validatePingCount('8')).toBeNull();  // string form from <select>
  });

  it('rejects 0 and negatives', () => {
    expect(validatePingCount(0)).not.toBeNull();
    expect(validatePingCount(-1)).not.toBeNull();
  });

  it('rejects above 100', () => {
    expect(validatePingCount(101)).not.toBeNull();
    expect(validatePingCount(9999)).not.toBeNull();
  });

  it('rejects non-numeric', () => {
    expect(validatePingCount('many')).not.toBeNull();
    expect(validatePingCount(NaN)).not.toBeNull();
  });
});
