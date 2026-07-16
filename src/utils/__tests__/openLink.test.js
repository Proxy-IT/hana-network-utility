import { describe, it, expect, vi, afterEach } from 'vitest';
import { openLink } from '../openLink.js';

/**
 * openLink is the gate every outbound link in the app passes through —
 * previously untested. The vitest environment here is 'node' (see
 * vitest.config.mjs), so `window` doesn't exist by default; each test
 * stubs exactly the shape it needs via vi.stubGlobal and restores it
 * afterward so state can't leak between tests.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('openLink', () => {
  it('routes an https:// URL through electronAPI.openExternal when present', () => {
    const openExternal = vi.fn();
    vi.stubGlobal('window', { electronAPI: { openExternal } });

    openLink('https://example.com/');

    expect(openExternal).toHaveBeenCalledWith('https://example.com/');
  });

  it('routes an http:// URL through electronAPI.openExternal (matches the main-process allowlist)', () => {
    const openExternal = vi.fn();
    vi.stubGlobal('window', { electronAPI: { openExternal } });

    openLink('http://example.com/');

    expect(openExternal).toHaveBeenCalledWith('http://example.com/');
  });

  it('falls back to window.open with noopener,noreferrer when electronAPI is absent', () => {
    const open = vi.fn();
    vi.stubGlobal('window', { open });

    openLink('https://example.com/');

    expect(open).toHaveBeenCalledWith('https://example.com/', '_blank', 'noopener,noreferrer');
  });

  it('refuses a javascript: URL — neither transport is called', () => {
    const openExternal = vi.fn();
    const open = vi.fn();
    vi.stubGlobal('window', { electronAPI: { openExternal }, open });

    openLink('javascript:alert(1)');

    expect(openExternal).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it('refuses a file:// URL — neither transport is called', () => {
    const openExternal = vi.fn();
    const open = vi.fn();
    vi.stubGlobal('window', { electronAPI: { openExternal }, open });

    openLink('file:///etc/passwd');

    expect(openExternal).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it('refuses a malformed URL without throwing', () => {
    const openExternal = vi.fn();
    vi.stubGlobal('window', { electronAPI: { openExternal } });

    expect(() => openLink('not a url')).not.toThrow();
    expect(openExternal).not.toHaveBeenCalled();
  });

  it('refuses the fallback path too — the check applies before picking a transport, not just on the Electron path', () => {
    const open = vi.fn();
    vi.stubGlobal('window', { open }); // no electronAPI — forces the fallback branch

    openLink('javascript:alert(1)');

    expect(open).not.toHaveBeenCalled();
  });
});
