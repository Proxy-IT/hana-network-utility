import { describe, it, expect } from 'vitest';
import { classifyCertExpiry } from '../certExpiry.js';

describe('classifyCertExpiry', () => {
  it('classifies >60 days as Healthy', () => {
    expect(classifyCertExpiry(61).tier).toBe('Healthy');
    expect(classifyCertExpiry(365).tier).toBe('Healthy');
  });

  it('classifies the 30-60 day boundary (inclusive both ends) as Expiring Soon', () => {
    expect(classifyCertExpiry(60).tier).toBe('Expiring Soon');
    expect(classifyCertExpiry(45).tier).toBe('Expiring Soon');
    expect(classifyCertExpiry(30).tier).toBe('Expiring Soon');
  });

  it('classifies <30 days as Critical', () => {
    expect(classifyCertExpiry(29).tier).toBe('Critical');
    expect(classifyCertExpiry(1).tier).toBe('Critical');
  });

  it('classifies an already-expired cert (0 or negative days) as Critical', () => {
    expect(classifyCertExpiry(0).tier).toBe('Critical');
    expect(classifyCertExpiry(-5).tier).toBe('Critical');
  });

  it('returns the correct colors', () => {
    expect(classifyCertExpiry(90).color).toBe('#00FF9C');
    expect(classifyCertExpiry(45).color).toBe('#FFB020');
    expect(classifyCertExpiry(10).color).toBe('#FF4B6A');
  });

  it('returns null for missing/unparseable input', () => {
    expect(classifyCertExpiry(null)).toBeNull();
    expect(classifyCertExpiry(undefined)).toBeNull();
    expect(classifyCertExpiry(NaN)).toBeNull();
  });
});
