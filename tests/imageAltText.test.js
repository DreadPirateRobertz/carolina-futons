import { describe, it, expect, vi } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────
vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (perm, fn) => fn,
}));

import {
  getProductAltText,
  getBatchAltText,
  buildAltText,
  detectImageContext,
  CATEGORY_LABELS,
  POSITION_LABELS,
} from '../src/backend/imageAltText.web';

// ── buildAltText ────────────────────────────────────────────────────

describe('buildAltText', () => {
  const baseProduct = {
    name: 'Nomad Platform Bed',
    brand: 'KD Frames',
    collections: ['platform-beds'],
  };

  it('generates main image alt text with brand and name', () => {
    const alt = buildAltText(baseProduct, 0);
    expect(alt).toBe('KD Frames Nomad Platform Bed - Main Product Image');
  });

  it('generates alternate view alt text for second image', () => {
    const alt = buildAltText(baseProduct, 1);
    expect(alt).toBe('KD Frames Nomad Platform Bed - Alternate View');
  });

  it('generates numbered view for 5th+ images', () => {
    const alt = buildAltText(baseProduct, 4);
    expect(alt).toBe('KD Frames Nomad Platform Bed - View 5');
  });

  it('does not duplicate brand when name starts with brand', () => {
    const product = { name: 'KD Frames Lounger', brand: 'KD Frames', collections: [] };
    const alt = buildAltText(product, 0);
    expect(alt).toBe('KD Frames Lounger - Main Product Image');
    expect(alt).not.toContain('KD Frames KD Frames');
  });

  it('appends category label when not redundant with name', () => {
    const product = { name: 'Eureka', brand: '', collections: ['futon-frames'] };
    const alt = buildAltText(product, 0);
    expect(alt).toContain('Futon Frame');
  });

  it('omits category label when name already contains category word', () => {
    const product = { name: 'Nomad Platform Bed', brand: '', collections: ['platform-beds'] };
    const alt = buildAltText(product, 0);
    // "Platform" is in both name and category label, should not duplicate
    expect(alt).not.toContain('Platform Bed - Platform');
  });

  it('includes variant info when options present', () => {
    const product = {
      name: 'Eureka Futon Frame',
      brand: 'Night & Day',
      collections: [],
      options: { finish: 'Cherry', size: 'Queen' },
    };
    const alt = buildAltText(product, 0);
    expect(alt).toContain('in Cherry, Queen');
  });

  it('handles product with no brand', () => {
    const product = { name: 'Haley 110', collections: ['mattresses'] };
    const alt = buildAltText(product, 0);
    expect(alt).toBe('Haley 110 Futon Mattress - Main Product Image');
  });

  it('handles null product', () => {
    const alt = buildAltText(null, 0);
    expect(alt).toBe('Product image');
  });

  it('handles product with empty name', () => {
    const alt = buildAltText({ name: '' }, 0);
    expect(alt).toBe('Product image');
  });

  it('handles product with no collections', () => {
    const alt = buildAltText({ name: 'Test Product' }, 0);
    expect(alt).toContain('Test Product');
    expect(alt).toContain('Main Product Image');
  });
});

// ── detectImageContext ──────────────────────────────────────────────

describe('detectImageContext', () => {
  it('detects lifestyle images', () => {
    expect(detectImageContext('https://example.com/images/Nomad_Lifestyle_copy.jpg'))
      .toBe('Lifestyle Room Setting');
  });

  it('detects room setting images', () => {
    expect(detectImageContext('https://example.com/room_setting.jpg'))
      .toBe('Lifestyle Room Setting');
  });

  it('detects detail/closeup images', () => {
    expect(detectImageContext('https://example.com/detail_wood_grain.jpg'))
      .toBe('Detail Close-up');
  });

  it('detects dimension images', () => {
    expect(detectImageContext('https://example.com/Nomad_Dimensions.jpg'))
      .toBe('Dimensions Diagram');
  });

  it('detects trundle/drawer images', () => {
    expect(detectImageContext('https://example.com/Frame_Trundle_Front.png'))
      .toBe('With Storage Option');
  });

  it('detects front view', () => {
    expect(detectImageContext('https://example.com/bed_front.jpg'))
      .toBe('Front View');
  });

  it('detects side view', () => {
    expect(detectImageContext('https://example.com/product_side_view.jpg'))
      .toBe('Side View');
  });

  it('detects back view', () => {
    expect(detectImageContext('https://example.com/rear_panel.jpg'))
      .toBe('Back View');
  });

  it('detects assembly reference', () => {
    expect(detectImageContext('https://example.com/assembly_guide.jpg'))
      .toBe('Assembly Reference');
  });

  it('returns null for generic URLs', () => {
    expect(detectImageContext('https://example.com/ed8a72_abc123.png')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(detectImageContext('')).toBeNull();
    expect(detectImageContext(null)).toBeNull();
    expect(detectImageContext(undefined)).toBeNull();
  });
});

// ── URL context overrides position labels ───────────────────────────

describe('buildAltText with URL context', () => {
  const product = { name: 'Nomad', brand: 'KD Frames', collections: ['platform-beds'] };

  it('uses URL context instead of position label', () => {
    const alt = buildAltText(product, 2, 'https://example.com/Nomad_Lifestyle.jpg');
    expect(alt).toContain('Lifestyle Room Setting');
    expect(alt).not.toContain('Detail View');
  });

  it('uses position label when URL has no context', () => {
    const alt = buildAltText(product, 2, 'https://example.com/ed8a72_abc.jpg');
    expect(alt).toContain('Detail View');
  });

  it('uses storage context for trundle URLs', () => {
    const alt = buildAltText(product, 1, 'https://example.com/Nomad_Trundle_Front.png');
    expect(alt).toContain('With Storage Option');
  });
});

// ── getProductAltText (webMethod) ───────────────────────────────────

describe('getProductAltText', () => {
  it('returns alt text for a product', async () => {
    const result = await getProductAltText(
      { name: 'Haley 110', brand: 'Otis Bed', collections: ['mattresses'] },
      0
    );
    expect(result).toBe('Otis Bed Haley 110 Futon Mattress - Main Product Image');
  });

  it('handles null product gracefully', async () => {
    const result = await getProductAltText(null, 0);
    expect(result).toBe('Product image');
  });

  it('uses image URL for context when provided', async () => {
    const result = await getProductAltText(
      { name: 'Nomad', brand: 'KD Frames', collections: [] },
      1,
      'https://example.com/Nomad_Lifestyle.jpg'
    );
    expect(result).toContain('Lifestyle Room Setting');
  });
});

// ── getBatchAltText (webMethod) ─────────────────────────────────────

describe('getBatchAltText', () => {
  it('generates alt text for all media items', async () => {
    const product = {
      name: 'Eureka Futon Frame',
      brand: 'Night & Day',
      collections: ['futon-frames'],
      mediaItems: [
        { src: 'https://example.com/eureka_main.jpg' },
        { src: 'https://example.com/eureka_lifestyle.jpg' },
        { src: 'https://example.com/eureka_detail.jpg' },
      ],
    };
    const result = await getBatchAltText(product);
    expect(result).toHaveLength(3);
    expect(result[0]).toContain('Main Product Image');
    expect(result[1]).toContain('Lifestyle Room Setting');
    expect(result[2]).toContain('Detail Close-up');
  });

  it('handles product with media array instead of mediaItems', async () => {
    const product = {
      name: 'Test',
      media: [
        { url: 'https://example.com/test.jpg' },
      ],
    };
    const result = await getBatchAltText(product);
    expect(result).toHaveLength(1);
  });

  it('returns empty array for null product', async () => {
    const result = await getBatchAltText(null);
    expect(result).toEqual([]);
  });

  it('returns empty array for product with no media', async () => {
    const result = await getBatchAltText({ name: 'Test' });
    expect(result).toEqual([]);
  });
});

// ── Constants ───────────────────────────────────────────────────────

describe('constants', () => {
  it('has all expected category labels', () => {
    expect(CATEGORY_LABELS['futon-frames']).toBe('Futon Frame');
    expect(CATEGORY_LABELS['mattresses']).toBe('Futon Mattress');
    expect(CATEGORY_LABELS['murphy-cabinet-beds']).toBe('Murphy Cabinet Bed');
    expect(CATEGORY_LABELS['platform-beds']).toBe('Platform Bed');
    expect(CATEGORY_LABELS['casegoods-accessories']).toBe('Furniture Accessory');
  });

  it('has position labels', () => {
    expect(POSITION_LABELS).toHaveLength(4);
    expect(POSITION_LABELS[0]).toBe('Main Product Image');
  });
});
