import { describe, it, expect } from 'vitest';

const {
  generateAltText,
  generateManufacturerAltText,
  findManufacturerMatch,
  deduplicateImages,
  extractMediaId,
  normalizeForMatch,
  CATEGORY_LABELS,
} = require('../scripts/enrichProductImages');

// ── normalizeForMatch ───────────────────────────────────────────────

describe('normalizeForMatch', () => {
  it('lowercases and strips special chars', () => {
    expect(normalizeForMatch('Nomad Platform Bed')).toBe('nomad platform bed');
  });

  it('collapses whitespace', () => {
    expect(normalizeForMatch('  Nomad   Plus  ')).toBe('nomad plus');
  });

  it('handles empty/null', () => {
    expect(normalizeForMatch('')).toBe('');
    expect(normalizeForMatch(null)).toBe('');
    expect(normalizeForMatch(undefined)).toBe('');
  });

  it('strips punctuation', () => {
    expect(normalizeForMatch("Night & Day's Frame")).toBe('night day s frame');
  });
});

// ── findManufacturerMatch ───────────────────────────────────────────

describe('findManufacturerMatch', () => {
  const catalogs = {
    'nomad-plus-platform-bed': {
      name: 'Nomad Platform Bed',
      images: ['img1.jpg', 'img2.jpg'],
      manufacturer: 'KD Frames',
    },
    'charleston-platform-bed': {
      name: 'Charleston Platform Bed',
      images: ['img3.jpg'],
      manufacturer: 'KD Frames',
    },
    'kd-lounger-futon': {
      name: 'KD Lounger Futon',
      images: ['img4.jpg', 'img5.jpg'],
      manufacturer: 'KD Frames',
    },
  };

  it('matches by exact name containment', () => {
    const match = findManufacturerMatch('Nomad Platform Bed', catalogs);
    expect(match).not.toBeNull();
    expect(match.slug).toBe('nomad-plus-platform-bed');
  });

  it('matches when Wix name contains catalog name', () => {
    const match = findManufacturerMatch('KD Lounger Futon Frame', catalogs);
    expect(match).not.toBeNull();
    expect(match.slug).toBe('kd-lounger-futon');
  });

  it('matches by partial word overlap', () => {
    const match = findManufacturerMatch('Charleston Platform Bed Frame', catalogs);
    expect(match).not.toBeNull();
    expect(match.slug).toBe('charleston-platform-bed');
  });

  it('returns null for no match', () => {
    const match = findManufacturerMatch('Murphy Express Cabinet Bed', catalogs);
    expect(match).toBeNull();
  });
});

// ── extractMediaId ──────────────────────────────────────────────────

describe('extractMediaId', () => {
  it('extracts Wix media ID', () => {
    const url = 'https://static.wixstatic.com/media/ed8a72_abc123~mv2.png/v1/fit/w_1200/file.png';
    expect(extractMediaId(url)).toBe('ed8a72_abc123~mv2.png');
  });

  it('extracts filename from Shopify CDN', () => {
    const url = 'https://cdn.shopify.com/s/files/1/1773/2151/products/Nomad_Plus_1024x1024.jpg?v=123';
    expect(extractMediaId(url)).toBe('Nomad_Plus_1024x1024.jpg');
  });

  it('handles simple URLs', () => {
    const url = 'https://example.com/images/product.jpg';
    expect(extractMediaId(url)).toBe('product.jpg');
  });
});

// ── deduplicateImages ───────────────────────────────────────────────

describe('deduplicateImages', () => {
  it('filters out images already in existing media', () => {
    const existing = [
      { url: 'https://static.wixstatic.com/media/ed8a72_abc123~mv2.png' },
    ];
    const newUrls = [
      'https://static.wixstatic.com/media/ed8a72_abc123~mv2.png/v1/fit/w_800/file.png',
      'https://cdn.shopify.com/new_image.jpg',
    ];
    const result = deduplicateImages(existing, newUrls);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('new_image.jpg');
  });

  it('deduplicates within new URLs', () => {
    const existing = [];
    const newUrls = [
      'https://example.com/img.jpg',
      'https://example.com/img.jpg',
    ];
    const result = deduplicateImages(existing, newUrls);
    expect(result).toHaveLength(1);
  });

  it('returns all when no overlap', () => {
    const existing = [{ url: 'https://example.com/old.jpg' }];
    const newUrls = ['https://example.com/new1.jpg', 'https://example.com/new2.jpg'];
    const result = deduplicateImages(existing, newUrls);
    expect(result).toHaveLength(2);
  });

  it('handles empty inputs', () => {
    expect(deduplicateImages([], [])).toHaveLength(0);
    expect(deduplicateImages([], ['a.jpg'])).toHaveLength(1);
  });
});

// ── generateAltText ─────────────────────────────────────────────────

describe('generateAltText', () => {
  it('generates main image alt text', () => {
    const product = {
      name: 'Nomad Platform Bed',
      brand: 'KD Frames',
      collectionIds: ['platform-beds'],
    };
    const alt = generateAltText(product, 0);
    expect(alt).toContain('KD Frames');
    expect(alt).toContain('Nomad Platform Bed');
    expect(alt).toContain('Main Product Image');
  });

  it('generates alternate view for second image', () => {
    const product = { name: 'Test', brand: '', collectionIds: [] };
    const alt = generateAltText(product, 1);
    expect(alt).toContain('Alternate View');
  });

  it('generates numbered view for later images', () => {
    const product = { name: 'Test', brand: '', collectionIds: [] };
    const alt = generateAltText(product, 5);
    expect(alt).toContain('View 6');
  });

  it('detects lifestyle images from URL', () => {
    const product = { name: 'Test', brand: '', collectionIds: [] };
    const alt = generateAltText(product, 1, { url: 'https://example.com/lifestyle.jpg' });
    expect(alt).toContain('Lifestyle Room Setting');
  });

  it('detects drawer/trundle images from URL', () => {
    const product = { name: 'Test', brand: '', collectionIds: [] };
    const alt = generateAltText(product, 1, { url: 'https://example.com/with_trundle.jpg' });
    expect(alt).toContain('With Storage Option');
  });

  it('appends category label when not in name', () => {
    const product = { name: 'Haley 110', brand: '', collectionIds: ['mattresses'] };
    const alt = generateAltText(product, 0);
    expect(alt).toContain('Futon Mattress');
  });
});

// ── generateManufacturerAltText ─────────────────────────────────────

describe('generateManufacturerAltText', () => {
  it('generates main image alt for first image', () => {
    const alt = generateManufacturerAltText('Nomad', 'https://example.com/main.jpg', 0, 'KD Frames');
    expect(alt).toBe('KD Frames Nomad - Main Product Image');
  });

  it('generates trundle alt for trundle URL', () => {
    const alt = generateManufacturerAltText('Nomad', 'https://example.com/trundle_front.jpg', 1, 'KD Frames');
    expect(alt).toBe('KD Frames Nomad - With Storage Option');
  });

  it('generates front view alt', () => {
    const alt = generateManufacturerAltText('Nomad', 'https://example.com/nomad_front.jpg', 2, 'KD Frames');
    expect(alt).toBe('KD Frames Nomad - Front View');
  });

  it('generates side view alt', () => {
    const alt = generateManufacturerAltText('Nomad', 'https://example.com/side_view.jpg', 1, 'KD Frames');
    expect(alt).toBe('KD Frames Nomad - Side View');
  });

  it('generates numbered view for generic URLs', () => {
    const alt = generateManufacturerAltText('Nomad', 'https://example.com/abc123.jpg', 3, 'KD Frames');
    expect(alt).toBe('KD Frames Nomad - View 4');
  });
});

// ── CATEGORY_LABELS ─────────────────────────────────────────────────

describe('CATEGORY_LABELS', () => {
  it('has labels for all main categories', () => {
    expect(CATEGORY_LABELS['futon-frames']).toBe('Futon Frame');
    expect(CATEGORY_LABELS['mattresses']).toBe('Futon Mattress');
    expect(CATEGORY_LABELS['murphy-cabinet-beds']).toBe('Murphy Cabinet Bed');
    expect(CATEGORY_LABELS['platform-beds']).toBe('Platform Bed');
    expect(CATEGORY_LABELS['casegoods-accessories']).toBe('Furniture Accessory');
    expect(CATEGORY_LABELS['wall-hugger-frames']).toBe('Wall Hugger Futon Frame');
    expect(CATEGORY_LABELS['front-loading-nesting']).toBe('Front-Loading Futon Frame');
  });
});
