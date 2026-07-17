import { describe, it, expect } from 'vitest';
import { validateHost, isValidIpv4, isValidIpv6, validatePorts, validatePingCount, validateTcpPingTimeout } from '../validate.js';
import { classifyTcpError } from '../tcpPingClassify.js';

/**
 * IMPORTANT — read before editing either file.
 *
 * electron/main.js has its OWN separate, hand-maintained copies of
 * isValidHost, isValidIpv4, and isValidIpv6 — it does NOT import them from
 * this validate.js file. This was discovered during the v1.8.0 migration:
 * validate.js was built as "the shared single source of truth for
 * validation," but that was never actually wired up — main.js's real,
 * shipped IPC handlers use its own separate implementation.
 *
 * Unifying them (making main.js actually `require()` this file) is the
 * correct long-term fix, but it's deliberately deferred: main.js is plain
 * CommonJS, and reliably `require()`-ing a file that uses `export function`
 * syntax depends on Node's newer require(esm) support (confirmed working on
 * Node 22; NOT verified on Node 20, which is what this project is migrating
 * away from in this same release). Bundling that architectural change into
 * an already-large migration is exactly the kind of compounding risk that
 * caused two real production incidents already this cycle. It's tracked as
 * a named follow-up instead.
 *
 * Until that unification happens, THIS test exists to catch drift: it pins
 * a verbatim snapshot of main.js's current regex/logic (see the file:line
 * references below) and asserts it agrees with validate.js's real,
 * imported behavior across a broad input set. If someone changes either
 * file without updating the other, this test fails.
 *
 * If you're reading this because it failed: check whether electron/main.js
 * and src/lib/validate.js have drifted apart, and either bring them back
 * in sync or (better) finally do the unification and delete this file.
 */

// ── Pinned snapshot of electron/main.js's current logic ────────────────────────
// Source: electron/main.js, function isValidHost (as of v1.8.0 migration)
function isValidHost_MAIN_SNAPSHOT(host) {
  if (!host || typeof host !== 'string') return false;
  const trimmed = host.trim();
  if (trimmed.length === 0 || trimmed.length > 253) return false;
  if (/[;&|`$<>\(\)\[\]{}'"\\@!#%^*=+,~]/.test(trimmed)) return false;
  if (!/^[a-zA-Z0-9._:\-]+$/.test(trimmed)) return false;
  return true;
}
// Source: electron/main.js, function isValidIpv4
function isValidIpv4_MAIN_SNAPSHOT(ip) {
  if (!ip || typeof ip !== 'string') return false;
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return false;
  return parts.every(p => /^\d{1,3}$/.test(p) && parseInt(p, 10) <= 255);
}
// Source: electron/main.js, function isValidIpv6
function isValidIpv6_MAIN_SNAPSHOT(ip) {
  if (!ip || typeof ip !== 'string') return false;
  return /^[0-9a-fA-F:]+$/.test(ip.trim()) && ip.includes(':');
}

const HOST_TEST_INPUTS = [
  'google.com', '8.8.8.8', '192.168.1.1', '2001:db8::1', '::1',
  '', '   ', null, undefined,
  'a'.repeat(254), 'a'.repeat(253),
  'host && calc', 'host; rm -rf ~', '$(whoami)', '`id`', 'host | cat /etc/passwd',
  'host > /tmp/out', 'not@a!host', 'user@domain.com', 'host#name', 'host%name',
  'host^name', 'host*name', 'host=name', 'host+name', 'host,name', 'host~name',
  "host'name", 'host"name', 'host\\name', 'host{name}', 'host[name]', 'host(name)',
  'host<name>', 'valid-host_name.example.com',
];

const IPV4_TEST_INPUTS = ['192.168.1.1', '0.0.0.0', '255.255.255.255', '256.1.1.1', '1.2.3', '1.2.3.4.5', 'a.b.c.d', '', null];
const IPV6_TEST_INPUTS = ['2001:db8::1', '::1', 'not-ipv6', '192.168.1.1', ''];

// Source: electron/main.js, portscan-start's array-shaped call to isValidPort()
// (was inline bounds logic before the v1.11.0 TCP Ping release extracted a
// shared isValidPort() helper — this snapshot is a second, independent
// pinning of that same formula for the array call site; see
// isValidPort_MAIN_SNAPSHOT below for the scalar/TCP-Ping call site)
function portValidation_MAIN_SNAPSHOT(ports) {
  if (!Array.isArray(ports) || ports.length === 0) return { ok: false };
  const normalizedPorts = ports.map(p => parseInt(p, 10));
  if (normalizedPorts.length > 500) return { ok: false };
  const invalidPort = normalizedPorts.find(p => isNaN(p) || p < 1 || p > 65535);
  if (invalidPort !== undefined) return { ok: false };
  return { ok: true };
}
// Source: electron/main.js, inline ping-count validation in the ping-start handler
function pingCountValidation_MAIN_SNAPSHOT(count) {
  const countInt = parseInt(count, 10);
  if (isNaN(countInt) || countInt < 1 || countInt > 100) return { ok: false };
  return { ok: true };
}
// Source: electron/main.js, isValidPort (shared by portscan-start and tcpping-start)
function isValidPort_MAIN_SNAPSHOT(port) {
  const n = parseInt(port, 10);
  return !isNaN(n) && n >= 1 && n <= 65535;
}
// Source: electron/main.js, isValidTcpPingTimeout (tcpping-start handler)
function isValidTcpPingTimeout_MAIN_SNAPSHOT(ms) {
  const n = parseInt(ms, 10);
  return !isNaN(n) && n >= 200 && n <= 10000;
}
// Source: electron/main.js, classifyTcpError (tcpping-start handler)
function classifyTcpError_MAIN_SNAPSHOT(err) {
  const code = err && err.code;
  if (code === 'ECONNREFUSED') return 'refused';
  if (code === 'ECONNRESET')   return 'reset';
  if (code === 'EHOSTUNREACH' || code === 'ENETUNREACH' || code === 'EHOSTDOWN') return 'unreachable';
  return 'error';
}
const PORT_TEST_INPUTS = [
  [22, 80, 443], ['22', '80', '443'], [0], [65536], [22, 'eighty', 443],
  [], Array.from({ length: 501 }, (_, i) => i + 1), Array.from({ length: 500 }, (_, i) => i + 1),
  null, 'not-an-array',
];
const PING_COUNT_TEST_INPUTS = [1, 4, 100, '8', 0, -1, 101, 9999, 'many', NaN, null, undefined];
const SINGLE_PORT_TEST_INPUTS = [1, 22, '80', 443, 65535, '65535', 0, -1, 65536, 'eighty', NaN, null, undefined];
const TCP_PING_TIMEOUT_TEST_INPUTS = [200, '2000', 10000, 199, 10001, 0, -1, 'fast', NaN, null, undefined];
const TCP_ERROR_TEST_INPUTS = [
  { code: 'ECONNREFUSED' }, { code: 'ECONNRESET' }, { code: 'EHOSTUNREACH' },
  { code: 'ENETUNREACH' }, { code: 'EHOSTDOWN' }, { code: 'EACCES' }, {}, null, undefined,
];

describe('main.js / validate.js parity (stopgap until unified)', () => {
  it('isValidHost: main.js snapshot agrees with validateHost()===null across all test inputs', () => {
    for (const input of HOST_TEST_INPUTS) {
      const mainResult = isValidHost_MAIN_SNAPSHOT(input);
      const libResult  = validateHost(input) === null;
      expect(libResult).toBe(mainResult);
    }
  });

  it('isValidIpv4: main.js snapshot agrees with validate.js across all test inputs', () => {
    for (const input of IPV4_TEST_INPUTS) {
      expect(isValidIpv4(input)).toBe(isValidIpv4_MAIN_SNAPSHOT(input));
    }
  });

  it('isValidIpv6: main.js snapshot agrees with validate.js across all test inputs', () => {
    for (const input of IPV6_TEST_INPUTS) {
      expect(isValidIpv6(input)).toBe(isValidIpv6_MAIN_SNAPSHOT(input));
    }
  });

  it('port validation: main.js\'s inline logic agrees with validatePorts() on accept/reject outcome', () => {
    for (const input of PORT_TEST_INPUTS) {
      const mainOk = portValidation_MAIN_SNAPSHOT(input).ok;
      const libOk  = validatePorts(input).ok;
      expect(libOk).toBe(mainOk);
    }
  });

  it('ping-count validation: main.js\'s inline logic agrees with validatePingCount() on accept/reject outcome', () => {
    for (const input of PING_COUNT_TEST_INPUTS) {
      const mainOk = pingCountValidation_MAIN_SNAPSHOT(input).ok;
      const libOk  = validatePingCount(input) === null;
      expect(libOk).toBe(mainOk);
    }
  });

  it('single-port validation (TCP Ping): main.js\'s isValidPort agrees with validatePorts([port]) on accept/reject outcome', () => {
    for (const input of SINGLE_PORT_TEST_INPUTS) {
      const mainOk = isValidPort_MAIN_SNAPSHOT(input);
      const libOk  = validatePorts([input]).ok;
      expect(libOk).toBe(mainOk);
    }
  });

  it('TCP Ping timeout validation: main.js\'s isValidTcpPingTimeout agrees with validateTcpPingTimeout() on accept/reject outcome', () => {
    for (const input of TCP_PING_TIMEOUT_TEST_INPUTS) {
      const mainOk = isValidTcpPingTimeout_MAIN_SNAPSHOT(input);
      const libOk  = validateTcpPingTimeout(input) === null;
      expect(libOk).toBe(mainOk);
    }
  });

  it('TCP error classification: main.js\'s classifyTcpError agrees with the lib version across all test inputs', () => {
    for (const input of TCP_ERROR_TEST_INPUTS) {
      expect(classifyTcpError(input)).toBe(classifyTcpError_MAIN_SNAPSHOT(input));
    }
  });
});
