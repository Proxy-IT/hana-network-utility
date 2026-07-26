import { describe, it, expect } from 'vitest';
import { parseWindowsAdapterJson, parseMacHardwarePorts } from '../networkInterfaceParse.js';

describe('parseWindowsAdapterJson', () => {
  it('parses a single adapter (PowerShell returns a bare object, not an array)', () => {
    const json = '{"Name":"Ethernet","PhysicalMediaType":"802.3","Status":"Up"}';
    expect(parseWindowsAdapterJson(json)).toEqual([{ name: 'Ethernet', type: 'wired' }]);
  });

  it('parses multiple adapters (array form)', () => {
    const json = JSON.stringify([
      { Name: 'Ethernet', PhysicalMediaType: '802.3', Status: 'Up' },
      { Name: 'Wi-Fi', PhysicalMediaType: 'Native 802.11', Status: 'Up' },
      { Name: 'vEthernet (Default Switch)', PhysicalMediaType: '', Status: 'Up' },
    ]);
    expect(parseWindowsAdapterJson(json)).toEqual([
      { name: 'Ethernet', type: 'wired' },
      { name: 'Wi-Fi', type: 'wifi' },
      { name: 'vEthernet (Default Switch)', type: 'other' },
    ]);
  });

  it('classifies "Wireless LAN" as wifi', () => {
    const json = '{"Name":"WLAN","PhysicalMediaType":"Wireless LAN","Status":"Up"}';
    expect(parseWindowsAdapterJson(json)).toEqual([{ name: 'WLAN', type: 'wifi' }]);
  });

  it('classifies a blank or missing PhysicalMediaType as other', () => {
    expect(parseWindowsAdapterJson('{"Name":"Loopback","PhysicalMediaType":null}'))
      .toEqual([{ name: 'Loopback', type: 'other' }]);
  });

  it('returns [] for empty/whitespace input', () => {
    expect(parseWindowsAdapterJson('')).toEqual([]);
    expect(parseWindowsAdapterJson('   ')).toEqual([]);
  });

  it('returns [] when ConvertTo-Json emits the literal "null" (zero adapters found)', () => {
    expect(parseWindowsAdapterJson('null')).toEqual([]);
  });

  it('throws on malformed JSON (caller is responsible for catching)', () => {
    expect(() => parseWindowsAdapterJson('{not valid json')).toThrow();
  });
});

describe('parseMacHardwarePorts', () => {
  it('parses a realistic multi-block networksetup -listallhardwareports sample', () => {
    const raw = [
      'Hardware Port: Wi-Fi',
      'Device: en0',
      'Ethernet Address: aa:bb:cc:dd:ee:ff',
      '',
      'Hardware Port: Thunderbolt Ethernet',
      'Device: en5',
      'Ethernet Address: aa:bb:cc:dd:ee:00',
      '',
      'Hardware Port: Bluetooth PAN',
      'Device: en6',
      'Ethernet Address: aa:bb:cc:dd:ee:11',
      '',
    ].join('\n');
    expect(parseMacHardwarePorts(raw)).toEqual([
      { name: 'en0', type: 'wifi' },
      { name: 'en5', type: 'wired' },
      { name: 'en6', type: 'other' },
    ]);
  });

  it('classifies plain "Ethernet" (not just Thunderbolt Ethernet) as wired', () => {
    const raw = 'Hardware Port: Ethernet\nDevice: en1\nEthernet Address: 00:00:00:00:00:00\n';
    expect(parseMacHardwarePorts(raw)).toEqual([{ name: 'en1', type: 'wired' }]);
  });

  it('ignores blocks with no Device line (e.g. a trailing VLAN section)', () => {
    const raw = [
      'Hardware Port: Wi-Fi',
      'Device: en0',
      'Ethernet Address: aa:bb:cc:dd:ee:ff',
      '',
      'VLAN Configurations',
      '===================',
    ].join('\n');
    expect(parseMacHardwarePorts(raw)).toEqual([{ name: 'en0', type: 'wifi' }]);
  });

  it('returns [] for empty/whitespace input', () => {
    expect(parseMacHardwarePorts('')).toEqual([]);
    expect(parseMacHardwarePorts('   ')).toEqual([]);
  });
});
