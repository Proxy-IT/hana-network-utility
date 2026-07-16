// Shared "open an external link safely" helper.
//
// In Electron, this hands off to the main process's `open-external` IPC
// handler, which independently re-validates the URL is http(s) before ever
// calling shell.openExternal (electron/main.js).
//
// In the browser-preview fallback (no window.electronAPI), window.open is
// used directly since there is no privileged process to hand off to — so
// this function does its own http(s)-only check here too, rather than
// relying solely on the Electron-side validation. Without this, the two
// code paths would silently diverge: safe in the packaged app, unchecked
// in the browser-preview fallback.
//
// Kept in one place — rather than duplicated per component — specifically
// because it's the gate for every outbound link the user clicks; a single
// reviewed copy is safer than several that can drift apart.
export function openLink(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return; // malformed URL — refuse silently, same as the main-process handler
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return;

  if (window.electronAPI?.openExternal) {
    window.electronAPI.openExternal(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
