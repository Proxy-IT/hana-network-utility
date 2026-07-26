/**
 * Hana — Network interface classification parsers
 *
 * Pure functions that parse platform-specific network-adapter listings into
 * a normalized { name, type } shape, where type is 'wired' | 'wifi' | 'other'.
 * No side effects, no imports. Fully testable.
 *
 * electron/main.js hand-copies equivalent logic inline into its
 * get-local-interfaces handler — see src/lib/__tests__/mainValidatorParity.test.js
 * for why main.js doesn't require() these ESM functions directly (CommonJS/
 * ESM boundary; deliberately deferred unification). Keep the two in sync.
 *
 * Tests live in src/lib/__tests__/networkInterfaceParse.test.js
 */

/**
 * Classifies a Windows PhysicalMediaType string into an interface type.
 * @param {string} physicalMediaType
 * @returns {'wired'|'wifi'|'other'}
 */
function classifyWindowsMedia(physicalMediaType) {
  const v = (physicalMediaType || '').trim();
  if (v === '802.3') return 'wired';
  if (v === 'Native 802.11' || v === 'Wireless LAN') return 'wifi';
  return 'other';
}

/**
 * Parses the JSON output of:
 *   Get-NetAdapter | Select-Object Name,PhysicalMediaType,Status | ConvertTo-Json
 *
 * PowerShell's ConvertTo-Json returns a bare object (not an array) when
 * there's exactly one adapter — normalized here before mapping.
 * @param {string} jsonText
 * @returns {Array<{name: string, type: 'wired'|'wifi'|'other'}>}
 */
export function parseWindowsAdapterJson(jsonText) {
  if (!jsonText || !jsonText.trim()) return [];
  const parsed = JSON.parse(jsonText);
  const list = Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);
  return list.map(a => ({ name: a.Name, type: classifyWindowsMedia(a.PhysicalMediaType) }));
}

/**
 * Classifies a macOS hardware port name into an interface type.
 * @param {string} hardwarePortName
 * @returns {'wired'|'wifi'|'other'}
 */
function classifyMacHardwarePort(hardwarePortName) {
  const v = hardwarePortName || '';
  if (/Wi-Fi/i.test(v)) return 'wifi';
  if (/Ethernet/i.test(v)) return 'wired'; // covers "Ethernet" and "Thunderbolt Ethernet"
  return 'other';
}

/**
 * Parses the output of: networksetup -listallhardwareports
 *
 * Repeating blocks of:
 *   Hardware Port: <name>
 *   Device: <enN>
 *   Ethernet Address: <mac>
 * (blocks separated by a blank line). Returns one entry per block that has
 * both a Hardware Port and a Device line.
 * @param {string} rawText
 * @returns {Array<{name: string, type: 'wired'|'wifi'|'other'}>}
 */
export function parseMacHardwarePorts(rawText) {
  if (!rawText || !rawText.trim()) return [];
  const results = [];
  const blocks = rawText.split(/\r?\n\r?\n/);
  for (const block of blocks) {
    const portMatch   = block.match(/^Hardware Port:\s*(.+)$/m);
    const deviceMatch = block.match(/^Device:\s*(.+)$/m);
    if (portMatch && deviceMatch) {
      results.push({ name: deviceMatch[1].trim(), type: classifyMacHardwarePort(portMatch[1].trim()) });
    }
  }
  return results;
}
