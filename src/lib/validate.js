/**
 * Hana — Input validators
 *
 * Pure functions with no side effects. Used by:
 *   - src/components/* (frontend — immediate user feedback)
 *   - electron/main.js  (backend — security guarantee, independently validates)
 *
 * Both layers import from here so validation logic is never duplicated.
 * Tests live in src/lib/__tests__/validate.test.js
 */

/**
 * Valid hostname/IP characters allowlist.
 * Blocks shell metacharacters, control characters, and anything
 * invalid in a DNS label or IP address literal.
 *
 * Allows: a-z A-Z 0-9 . - _ : (colon for IPv6)
 */
const HOST_RE = /^[a-zA-Z0-9._:\-]+$/;

/**
 * Returns null if host is valid, or an error string if not.
 * @param {string} host
 * @returns {string|null}
 */
export function validateHost(host) {
  const trimmed = (host || '').trim();
  if (!trimmed)           return 'Please enter a hostname or IP address.';
  if (trimmed.length > 253) return 'Hostname is too long (maximum 253 characters).';
  if (!HOST_RE.test(trimmed)) {
    return `"${trimmed}" is not a valid hostname or IP address.`;
  }
  return null;
}

/**
 * Returns true if the string is a valid dotted-decimal IPv4 address.
 * @param {string} ip
 * @returns {boolean}
 */
export function isValidIpv4(ip) {
  if (!ip || typeof ip !== 'string') return false;
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return false;
  return parts.every(p => /^\d{1,3}$/.test(p) && parseInt(p, 10) <= 255);
}

/**
 * Returns true if the string looks like an IPv6 address (contains colons).
 * @param {string} ip
 * @returns {boolean}
 */
export function isValidIpv6(ip) {
  if (!ip || typeof ip !== 'string') return false;
  return /^[0-9a-fA-F:]+$/.test(ip.trim()) && ip.includes(':');
}

/**
 * Allowlisted DNS record types. Anything not in this set is rejected.
 * Using a Set for O(1) lookup.
 */
export const VALID_DNS_TYPES = new Set(['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'PTR', 'ALL']);

/**
 * Validates a ports array for the port scanner.
 * Returns { ok: true } or { ok: false, message: string }.
 * @param {number[]} ports
 * @returns {{ ok: boolean, message?: string }}
 */
export function validatePorts(ports) {
  if (!Array.isArray(ports) || ports.length === 0) {
    return { ok: false, message: 'No ports specified.' };
  }
  if (ports.length > 500) {
    return { ok: false, message: 'Too many ports — maximum is 500.' };
  }
  const normalized = ports.map(p => parseInt(p, 10));
  const invalid = normalized.find(p => isNaN(p) || p < 1 || p > 65535);
  if (invalid !== undefined) {
    return { ok: false, message: `Invalid port: ${invalid}. Ports must be integers between 1 and 65535.` };
  }
  return { ok: true, ports: normalized };
}

/**
 * Validates a ping packet count.
 * @param {number|string} count
 * @returns {string|null} error message or null
 */
export function validatePingCount(count) {
  const n = parseInt(count, 10);
  if (isNaN(n) || n < 1 || n > 100) {
    return 'Packet count must be between 1 and 100.';
  }
  return null;
}

/**
 * Validates a TCP Ping connect/TLS-handshake timeout, in milliseconds.
 * @param {number|string} ms
 * @returns {string|null} error message or null
 */
export function validateTcpPingTimeout(ms) {
  const n = parseInt(ms, 10);
  if (isNaN(n) || n < 200 || n > 10000) {
    return 'Timeout must be between 200 and 10000 ms.';
  }
  return null;
}

// ── CommonJS re-export for electron/main.js (which uses require()) ────────────
// When imported via require() in main.js, module.exports is used.
// When imported via ES import in src/, the named exports above are used.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    validateHost,
    isValidIpv4,
    isValidIpv6,
    VALID_DNS_TYPES,
    validatePorts,
    validatePingCount,
    validateTcpPingTimeout,
  };
}
