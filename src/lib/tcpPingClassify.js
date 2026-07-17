/**
 * Hana — TCP Ping error classifier
 *
 * Pure function that turns a raw Node socket/TLS error into one of TCP
 * Ping's status labels. No side effects, no imports. Fully testable.
 *
 * Tests live in src/lib/__tests__/tcpPingClassify.test.js
 *
 * electron/main.js hand-copies this same switch inline (see
 * src/lib/__tests__/mainValidatorParity.test.js for why validators/
 * classifiers are duplicated rather than require()'d into main.js) — keep
 * the two in sync.
 */

/**
 * Classifies a `net.Socket`/`tls.TLSSocket` 'error' event into a TCP Ping
 * status string.
 * @param {NodeJS.ErrnoException} err
 * @returns {'refused'|'reset'|'unreachable'|'error'}
 */
export function classifyTcpError(err) {
  const code = err && err.code;
  if (code === 'ECONNREFUSED') return 'refused';
  if (code === 'ECONNRESET')   return 'reset';
  if (code === 'EHOSTUNREACH' || code === 'ENETUNREACH' || code === 'EHOSTDOWN') return 'unreachable';
  return 'error';
}
