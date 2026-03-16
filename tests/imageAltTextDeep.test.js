import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

let mod;
beforeEach(async () => {
  vi.resetModules();
  mod = await import('../src/backend/imageAltText.web.js');
});

describe('getProductAltText', () => {
  it('returns fallback for null product', async () => {
    const r = await mod.getProductAltText(null);
    expect(r).toBe('Product image');
  });

  it('generates alt with brand prefix', async () => {
    const r = await mod.getProductAltText({ name: 'Nomad Bed', brand: 'KD Frames' }, 0);
    expect(r).toContain('KD Frames');
    expect(r).toContain('Nomad Bed');
    expect(r).toContain('Main Product Image');
  });

  it('skips brand when name starts with brand', async () => {
    const r = await mod.getProductAltText({ name: 'KD Frames Nomad', brand: 'KD Frames' }, 0);
    expect(r).not.toMatch(/^KD Frames KD Frames/);
  });

  it('appends category label', async () => {
    const r = await mod.getProductAltText({ name: 'Classic', collections: ['murphy-cabinet-beds'] }, 0);
    expect(r).toContain('Murphy Cabinet Bed');
  });

  it('appends variant info', async () => {
    const r = await mod.getProductAltText({
      name: 'Frame', options: { finish: 'Walnut', size: 'Queen' },
    }, 0);
    expect(r).toContain('in Walnut, Queen');
  });

  it('uses position labels for indices 0-3', async () => {
    const r0 = await mod.getProductAltText({ name: 'Futon' }, 0);
    const r1 = await mod.getProductAltText({ name: 'Futon' }, 1);
    const r2 = await mod.getProductAltText({ name: 'Futon' }, 2);
    expect(r0).toContain('Main Product Image');
    expect(r1).toContain('Alternate View');
    expect(r2).toContain('Detail View');
  });

  it('uses View N for high indices', async () => {
    const r = await mod.getProductAltText({ name: 'Futon' }, 10);
    expect(r).toContain('View 11');
  });

  it('detects lifestyle context from URL', async () => {
    const r = await mod.getProductAltText({ name: 'Futon' }, 0, 'https://cdn.com/lifestyle-room.jpg');
    expect(r).toContain('Lifestyle Room Setting');
  });

  it('detects dimension context from URL', async () => {
    const r = await mod.getProductAltText({ name: 'Futon' }, 0, 'https://cdn.com/dimension-spec.jpg');
    expect(r).toContain('Dimensions Diagram');
  });
});

describe('getBatchAltText', () => {
  it('returns empty for null product', async () => {
    const r = await mod.getBatchAltText(null);
    expect(r).toEqual([]);
  });

  it('generates alt for each media item', async () => {
    const r = await mod.getBatchAltText({
      name: 'Classic Frame',
      brand: 'Night & Day',
      mediaItems: [
        { src: 'https://cdn.com/main.jpg' },
        { src: 'https://cdn.com/detail-closeup.jpg' },
      ],
    });
    expect(r).toHaveLength(2);
    expect(r[0]).toContain('Main Product Image');
    expect(r[1]).toContain('Detail Close-up');
  });
});

describe('detectImageContext', () => {
  it('returns null for empty URL', () => {
    expect(mod.detectImageContext('')).toBeNull();
  });

  it('detects storage context', () => {
    expect(mod.detectImageContext('https://cdn.com/trundle-option.jpg')).toBe('With Storage Option');
  });

  it('detects assembly context', () => {
    expect(mod.detectImageContext('https://cdn.com/assembly-guide.jpg')).toBe('Assembly Reference');
  });

  it('detects front/side/back views', () => {
    expect(mod.detectImageContext('https://cdn.com/front-view.jpg')).toBe('Front View');
    expect(mod.detectImageContext('https://cdn.com/side-angle.jpg')).toBe('Side View');
    expect(mod.detectImageContext('https://cdn.com/back-panel.jpg')).toBe('Back View');
  });
});
