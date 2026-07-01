/**
 * Hana - Network Utility — macOS notarization hook
 *
 * electron-builder calls this automatically after code-signing the app,
 * as configured via "afterSign" in package.json's build config.
 *
 * It submits the signed .app to Apple's notarization service and waits
 * for approval. Apple then "staples" a notarization ticket to the app,
 * which is what lets it open on a user's Mac without a Gatekeeper warning.
 *
 * Requires these environment variables (set as GitHub Secrets in CI):
 *   APPLE_ID                     — the Apple ID email on the developer account
 *   APPLE_APP_SPECIFIC_PASSWORD  — an app-specific password (not the main Apple ID password)
 *   APPLE_TEAM_ID                — the 10-character Developer Team ID
 *
 * On a local build without these variables set, notarization is skipped
 * and a message is logged — the app will still build, just unsigned/unnotarized,
 * which is expected for local development builds.
 */

const { notarize } = require('@electron/notarize');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  // Only macOS builds need notarization
  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appleId       = process.env.APPLE_ID;
  const appleIdPass   = process.env.APPLE_APP_SPECIFIC_PASSWORD;
  const teamId         = process.env.APPLE_TEAM_ID;

  if (!appleId || !appleIdPass || !teamId) {
    console.log('[notarize] Skipping — APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID not set.');
    console.log('[notarize] This is expected for local builds. CI builds will notarize automatically.');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;

  console.log(`[notarize] Submitting ${appName}.app to Apple for notarization — this can take a few minutes...`);

  await notarize({
    appPath,
    appleId,
    appleIdPassword: appleIdPass,
    teamId,
  });

  console.log('[notarize] Notarization complete.');
};
