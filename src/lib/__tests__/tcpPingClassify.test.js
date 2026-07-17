import { describe, it, expect } from 'vitest';
import { classifyTcpError } from '../tcpPingClassify.js';

describe('classifyTcpError', () => {
  it('classifies ECONNREFUSED as refused', () => {
    expect(classifyTcpError({ code: 'ECONNREFUSED' })).toBe('refused');
  });

  it('classifies ECONNRESET as reset', () => {
    expect(classifyTcpError({ code: 'ECONNRESET' })).toBe('reset');
  });

  it('classifies EHOSTUNREACH as unreachable', () => {
    expect(classifyTcpError({ code: 'EHOSTUNREACH' })).toBe('unreachable');
  });

  it('classifies ENETUNREACH as unreachable', () => {
    expect(classifyTcpError({ code: 'ENETUNREACH' })).toBe('unreachable');
  });

  it('classifies EHOSTDOWN as unreachable', () => {
    expect(classifyTcpError({ code: 'EHOSTDOWN' })).toBe('unreachable');
  });

  it('classifies an unrecognized code as error', () => {
    expect(classifyTcpError({ code: 'EACCES' })).toBe('error');
  });

  it('classifies an error with no code as error', () => {
    expect(classifyTcpError({})).toBe('error');
  });

  it('does not throw on null/undefined input', () => {
    expect(() => classifyTcpError(null)).not.toThrow();
    expect(classifyTcpError(null)).toBe('error');
    expect(classifyTcpError(undefined)).toBe('error');
  });
});
