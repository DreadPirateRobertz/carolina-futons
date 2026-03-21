/**
 * CF-4poq: Local SEO S3 — Map embed and directions tests
 *
 * Validates mapEmbedUrl format, directionsUrl, and that the service
 * exposes both fields correctly for each city page.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone' },
  webMethod: vi.fn((_, fn) => fn),
}));

import { getLocalPage, getAllLocalSlugs } from '../src/backend/localSeoService.web.js';
import { STORE_DIRECTIONS_URL } from '../src/backend/utils/localSeoData.js';

// ── Shared page data ────────────────────────────────────────────────────

let asheville;
let hendersonville;
let greenville;

beforeAll(async () => {
  const [a, h, g] = await Promise.all([
    getLocalPage('asheville-nc'),
    getLocalPage('hendersonville-nc'),
    getLocalPage('greenville-sc'),
  ]);
  asheville = a.page;
  hendersonville = h.page;
  greenville = g.page;
});

// ── mapEmbedUrl ────────────────────────────────────────────────────────

describe('getLocalPage — mapEmbedUrl', () => {
  it('asheville has a mapEmbedUrl', () => {
    expect(asheville.mapEmbedUrl).toBeTruthy();
  });

  it('mapEmbedUrl uses Google Maps embed domain', () => {
    expect(asheville.mapEmbedUrl).toContain('google.com/maps/embed');
  });

  it('mapEmbedUrl uses https', () => {
    expect(asheville.mapEmbedUrl).toMatch(/^https:\/\//);
  });

  it('home city (Hendersonville) has a mapEmbedUrl', () => {
    expect(hendersonville.mapEmbedUrl).toBeTruthy();
  });

  it('out-of-state city (Greenville SC) has a mapEmbedUrl', () => {
    expect(greenville.mapEmbedUrl).toBeTruthy();
  });

  it('all defined cities have a non-empty mapEmbedUrl', async () => {
    const { slugs } = await getAllLocalSlugs();
    await Promise.all(slugs.map(async (slug) => {
      const { page } = await getLocalPage(slug);
      expect(page.mapEmbedUrl).toBeTruthy();
    }));
  });
});

// ── directionsUrl ──────────────────────────────────────────────────────

describe('getLocalPage — directionsUrl', () => {
  it('asheville page includes directionsUrl', () => {
    expect(asheville.directionsUrl).toBeTruthy();
  });

  it('directionsUrl uses Google Maps', () => {
    expect(asheville.directionsUrl).toContain('maps.google.com');
  });

  it('directionsUrl points to Carolina Futons Hendersonville', () => {
    expect(asheville.directionsUrl).toContain('carolina+futons+hendersonville');
  });

  it('directionsUrl is identical across all cities (static destination)', () => {
    expect(asheville.directionsUrl).toBe(hendersonville.directionsUrl);
    expect(asheville.directionsUrl).toBe(greenville.directionsUrl);
  });

  it('directionsUrl matches STORE_DIRECTIONS_URL constant', () => {
    expect(asheville.directionsUrl).toBe(STORE_DIRECTIONS_URL);
  });

  it('STORE_DIRECTIONS_URL uses https', () => {
    expect(STORE_DIRECTIONS_URL).toMatch(/^https:\/\//);
  });

  it('all defined cities have the same directionsUrl', async () => {
    const { slugs } = await getAllLocalSlugs();
    const urls = await Promise.all(slugs.map(async (slug) => {
      const { page } = await getLocalPage(slug);
      return page.directionsUrl;
    }));
    const unique = new Set(urls);
    expect(unique.size).toBe(1);
    expect([...unique][0]).toBe(STORE_DIRECTIONS_URL);
  });
});

// ── directionsUrl vs mapEmbedUrl are distinct ──────────────────────────

describe('getLocalPage — map embed vs directions URL separation', () => {
  it('mapEmbedUrl and directionsUrl are different fields', () => {
    expect(asheville.mapEmbedUrl).not.toBe(asheville.directionsUrl);
  });

  it('mapEmbedUrl is city-specific (varies by city)', () => {
    expect(asheville.mapEmbedUrl).not.toBe(hendersonville.mapEmbedUrl);
  });

  it('directionsUrl is static (same for all cities)', () => {
    expect(asheville.directionsUrl).toBe(hendersonville.directionsUrl);
  });
});

// ── directions text ────────────────────────────────────────────────────

describe('getLocalPage — directions text', () => {
  it('asheville directions text is non-empty', () => {
    expect(asheville.directions).toBeTruthy();
  });

  it('asheville directions mentions Hendersonville', () => {
    expect(asheville.directions).toContain('Hendersonville');
  });

  it('home city directions text is non-empty', () => {
    expect(hendersonville.directions).toBeTruthy();
  });
});
