/**
 * Hana — auto-update controller (main process)
 *
 * Wraps electron-updater and forwards its lifecycle to the renderer over IPC.
 * The renderer drives everything; nothing here reaches the network unless the
 * user explicitly asks (a manual "Check for Updates", or the opt-in
 * "check on startup" preference which defaults OFF). This preserves the app's
 * stated promise that outbound requests only happen when the user triggers them.
 *
 * Flow: check → (update-available) → download → (update-downloaded) → install.
 * autoDownload / autoInstallOnAppQuit are both off so each step is user-consented.
 *
 * The actual ipcMain.on/handle registrations live in main.js (thin delegators to
 * the functions exported here) so the IPC contract checker can see the channels.
 */
const { app, BrowserWindow } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');

// Dev-only escape hatch: `HANA_DEV_UPDATE=1 npm start` lets the update flow run
// against the real GitHub feed without a packaged build, for manual testing.
// Never set in production, so a normal `npm start` never touches the network.
const DEV_FORCE = process.env.HANA_DEV_UPDATE === '1';

// The update feed is pinned to this exact GitHub repo at build time by the
// `publish` config in package.json (which generates the packaged app-update.yml).
// We re-verify that pin at runtime and never call setFeedURL with a dynamic
// value, so updates can only ever originate from this source — there is no code
// path that lets an arbitrary or network-supplied URL become the update feed.
const EXPECTED_FEED = { provider: 'github', owner: 'Proxy-IT', repo: 'hana-network-utility' };

let initialized  = false;
let feedVerified = false;

function broadcast(channel, payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }
}

function prefsPath() {
  return path.join(app.getPath('userData'), 'update-prefs.json');
}

function readPrefs() {
  try {
    return { autoCheckOnStartup: false, ...JSON.parse(fs.readFileSync(prefsPath(), 'utf8')) };
  } catch {
    return { autoCheckOnStartup: false };
  }
}

function writePrefs(patch) {
  const next = { ...readPrefs(), ...patch };
  try {
    fs.writeFileSync(prefsPath(), JSON.stringify(next, null, 2));
  } catch { /* userData not writable — setting simply won't persist */ }
  return next;
}

// Confirms the active update config still pins our exact GitHub repo, so a
// tampered app-update.yml can't silently redirect the updater to another source.
function verifyFeedSource() {
  try {
    const cfgPath = app.isPackaged
      ? path.join(process.resourcesPath, 'app-update.yml')
      : path.join(app.getAppPath(), 'dev-app-update.yml');
    const text = fs.readFileSync(cfgPath, 'utf8');
    return (
      new RegExp(`provider:\\s*${EXPECTED_FEED.provider}\\b`, 'i').test(text) &&
      new RegExp(`owner:\\s*${EXPECTED_FEED.owner}\\b`, 'i').test(text) &&
      new RegExp(`repo:\\s*${EXPECTED_FEED.repo}\\b`, 'i').test(text)
    );
  } catch {
    return false;
  }
}

// Updates only work from an installed build. In dev they no-op with a clear
// message unless the dev override is set.
function isSupported() {
  return app.isPackaged || DEV_FORCE;
}

function init() {
  if (initialized) return;
  initialized = true;

  // Notify-only by default: a found update is surfaced to the user, never
  // downloaded or installed on its own. Each step (check → download → install)
  // requires an explicit user action.
  autoUpdater.autoDownload         = false;
  autoUpdater.autoInstallOnAppQuit = false;
  // Downgrade prevention: never replace the installed build with an older or
  // pre-release one, even if such a release is published or the feed is rolled back.
  autoUpdater.allowDowngrade  = false;
  autoUpdater.allowPrerelease = false;
  // Integrity: electron-updater verifies each download's SHA-512 against the
  // release metadata before 'update-downloaded' fires, and we never disable that
  // check. On macOS the update must also carry a valid Apple signature (the builds
  // are notarized). Windows gains Authenticode verification once EV signing lands;
  // until then the SHA-512 hash + HTTPS-pinned GitHub feed is the integrity guarantee.

  feedVerified = verifyFeedSource();

  if (DEV_FORCE) {
    autoUpdater.forceDevUpdateConfig = true;
    // Override the reported version for testing (e.g. pretend to be older so the
    // feed reports an update, or newer to exercise downgrade prevention). Must be
    // parsed by the SAME semver instance electron-updater uses internally, or its
    // instanceof checks reject the object — the top-level semver is a different major.
    if (process.env.HANA_DEV_UPDATE_VERSION) {
      const euSemver = require(require.resolve('semver', { paths: [require.resolve('electron-updater')] }));
      autoUpdater.currentVersion = euSemver.parse(process.env.HANA_DEV_UPDATE_VERSION);
    }
  }

  autoUpdater.on('checking-for-update', () => broadcast('update-checking'));
  autoUpdater.on('update-available', (info) => broadcast('update-available', {
    version: info.version,
    releaseDate: info.releaseDate,
    releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : null,
  }));
  autoUpdater.on('update-not-available', (info) => broadcast('update-not-available', {
    version: info && info.version,
  }));
  autoUpdater.on('download-progress', (p) => broadcast('update-download-progress', {
    percent: p.percent,
    transferred: p.transferred,
    total: p.total,
    bytesPerSecond: p.bytesPerSecond,
  }));
  autoUpdater.on('update-downloaded', (info) => broadcast('update-downloaded', {
    version: info.version,
  }));
  autoUpdater.on('error', (err) => broadcast('update-error', {
    message: err == null ? 'Unknown update error.' : (err.message || String(err)),
  }));
}

function checkForUpdates() {
  if (!isSupported()) {
    broadcast('update-error', { message: 'Updates are only available in the installed app.' });
    return;
  }
  if (!feedVerified) {
    broadcast('update-error', { message: 'Update source could not be verified — updates are disabled.' });
    return;
  }
  autoUpdater.checkForUpdates().catch((err) => {
    broadcast('update-error', { message: err && err.message ? err.message : 'Update check failed.' });
  });
}

function downloadUpdate() {
  if (!isSupported() || !feedVerified) return;
  autoUpdater.downloadUpdate().catch((err) => {
    broadcast('update-error', { message: err && err.message ? err.message : 'Update download failed.' });
  });
}

function quitAndInstall() {
  if (!isSupported()) return;
  // Defer so the IPC reply flushes before the app tears down.
  setImmediate(() => autoUpdater.quitAndInstall());
}

function getState() {
  return {
    supported: isSupported(),
    currentVersion: app.getVersion(),
    autoCheckOnStartup: readPrefs().autoCheckOnStartup,
  };
}

function setAutoCheck(value) {
  return writePrefs({ autoCheckOnStartup: !!value }).autoCheckOnStartup;
}

// Called once on app ready. Honors the opt-in preference (default off).
function maybeRunStartupCheck() {
  if (isSupported() && readPrefs().autoCheckOnStartup) {
    checkForUpdates();
  }
}

module.exports = {
  init,
  checkForUpdates,
  downloadUpdate,
  quitAndInstall,
  getState,
  setAutoCheck,
  maybeRunStartupCheck,
};
