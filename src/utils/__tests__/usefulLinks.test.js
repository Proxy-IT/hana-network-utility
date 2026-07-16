import { describe, it, expect } from 'vitest';
import { LINK_CATEGORIES } from '../usefulLinks.js';

/**
 * Useful Links is a hardcoded, static directory of third-party sites opened
 * via openExternal — there is no remote config and no user input involved in
 * building these URLs. These tests are a permanent guard-rail against a
 * future edit accidentally introducing something that shouldn't be here:
 * a non-HTTPS URL, a malformed entry, or a duplicate.
 */

const allLinks = LINK_CATEGORIES.flatMap(group => group.links);

describe('Useful Links data integrity', () => {
  it('has at least one category and at least one link', () => {
    expect(LINK_CATEGORIES.length).toBeGreaterThan(0);
    expect(allLinks.length).toBeGreaterThan(0);
  });

  it('every link uses https:// — never http:// or any other scheme', () => {
    allLinks.forEach(link => {
      expect(link.url.startsWith('https://')).toBe(true);
    });
  });

  it('every link is a well-formed, parseable URL', () => {
    allLinks.forEach(link => {
      expect(() => new URL(link.url)).not.toThrow();
    });
  });

  it('every link\'s displayed domain matches the actual URL hostname', () => {
    // Guards against a card showing one domain (what the user is told they'll
    // visit) while the url field actually points somewhere else.
    allLinks.forEach(link => {
      const hostname = new URL(link.url).hostname.replace(/^www\./, '');
      expect(hostname).toBe(link.domain.replace(/^www\./, ''));
    });
  });

  it('every link has a non-empty name, provider, description, and category', () => {
    LINK_CATEGORIES.forEach(group => {
      expect(group.category.trim().length).toBeGreaterThan(0);
      group.links.forEach(link => {
        expect(link.name.trim().length).toBeGreaterThan(0);
        expect(link.provider.trim().length).toBeGreaterThan(0);
        expect(link.desc.trim().length).toBeGreaterThan(0);
      });
    });
  });

  it('has no duplicate URLs across the whole list', () => {
    const urls = allLinks.map(l => l.url);
    expect(new Set(urls).size).toBe(urls.length);
  });
});
