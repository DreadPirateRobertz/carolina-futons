// productSchema.test.js — Pure function tests for product schema helpers
// Tests: buildGridAlt, detectProductCategory, getCategoryFromCollections
import { describe, it, expect, vi } from 'vitest';

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin' },
  webMethod: (perm, fn) => fn,
}));

vi.mock('backend/seoHelpers.web', () => ({
  getProductSchema: vi.fn(),
  getBreadcrumbSchema: vi.fn(),
  getProductOgTags: vi.fn(),
  getProductFaqSchema: vi.fn(),
  getPageTitle: vi.fn(),
  getPageMetaDescription: vi.fn(),
  getCanonicalUrl: vi.fn(),
}));

vi.mock('backend/pinterestRichPins.web', () => ({
  getProductPinData: vi.fn(),
}));

vi.mock('public/productPageUtils.js', () => ({
  detectProductBrand: vi.fn((p) => {
    if (!p || !p.name) return '';
    if (p.name.toLowerCase().includes('kodiak')) return 'Kodiak';
    if (p.name.toLowerCase().includes('night & day')) return 'Night & Day';
    return '';
  }),
}));

import {
  buildGridAlt,
  detectProductCategory,
  getCategoryFromCollections,
} from '../src/public/product/productSchema.js';

// ── buildGridAlt ────────────────────────────────────────────────────

describe('buildGridAlt', () => {
  it('returns default for null product', () => {
    expect(buildGridAlt(null)).toBe('Carolina Futons');
  });

  it('returns default for undefined product', () => {
    expect(buildGridAlt(undefined)).toBe('Carolina Futons');
  });

  it('returns name with Carolina Futons suffix', () => {
    const alt = buildGridAlt({ name: 'Phoenix Frame' });
    expect(alt).toContain('Phoenix Frame');
    expect(alt).toContain('Carolina Futons');
  });

  it('includes detected brand', () => {
    const alt = buildGridAlt({ name: 'Kodiak Monterey' });
    expect(alt).toContain('Kodiak');
  });

  it('includes detected category', () => {
    const alt = buildGridAlt({ name: 'Test Futon', collections: ['futon-frames'] });
    expect(alt).toContain('Futon Frame');
  });

  it('truncates alt text exceeding 125 characters', () => {
    const longName = 'A'.repeat(130);
    const alt = buildGridAlt({ name: longName });
    expect(alt.length).toBeLessThanOrEqual(125);
    expect(alt).toMatch(/\.\.\.$/);
  });

  it('does not truncate alt text at 125 characters or less', () => {
    const alt = buildGridAlt({ name: 'Short Name' });
    expect(alt.length).toBeLessThanOrEqual(125);
    expect(alt).not.toMatch(/\.\.\.$/);
  });

  it('handles exactly 125 character alt text without truncation', () => {
    // Build a name that results in exactly 125 chars after joining with " - Carolina Futons"
    const suffix = ' - Carolina Futons'; // 18 chars
    const name = 'A'.repeat(125 - suffix.length);
    const alt = buildGridAlt({ name });
    expect(alt.length).toBe(125);
    expect(alt).not.toMatch(/\.\.\.$/);
  });

  it('joins parts with dash separator', () => {
    const alt = buildGridAlt({ name: 'Test Product' });
    expect(alt).toMatch(/Test Product - Carolina Futons/);
  });
});

// ── detectProductCategory ───────────────────────────────────────────

describe('detectProductCategory', () => {
  it('returns empty string for null product', () => {
    expect(detectProductCategory(null)).toBe('');
  });

  it('returns empty string for product without collections', () => {
    expect(detectProductCategory({ name: 'Test' })).toBe('');
  });

  it('detects Murphy Cabinet Bed', () => {
    expect(detectProductCategory({ collections: ['murphy-beds'] })).toBe('Murphy Cabinet Bed');
  });

  it('detects Platform Bed', () => {
    expect(detectProductCategory({ collections: ['platform-beds'] })).toBe('Platform Bed');
  });

  it('detects Futon Mattress', () => {
    expect(detectProductCategory({ collections: ['futon-mattress-covers'] })).toBe('Futon Mattress');
  });

  it('detects Wall Hugger Futon Frame', () => {
    expect(detectProductCategory({ collections: ['wall-hugger-frames'] })).toBe('Wall Hugger Futon Frame');
  });

  it('detects Futon Frame from futon collection', () => {
    expect(detectProductCategory({ collections: ['futon-frames'] })).toBe('Futon Frame');
  });

  it('detects Futon Frame from frame collection', () => {
    expect(detectProductCategory({ collections: ['wood-frame-collection'] })).toBe('Futon Frame');
  });

  it('detects Bedroom Furniture from casegood', () => {
    expect(detectProductCategory({ collections: ['casegoods'] })).toBe('Bedroom Furniture');
  });

  it('detects Bedroom Furniture from accessories', () => {
    expect(detectProductCategory({ collections: ['accessories-pillows'] })).toBe('Bedroom Furniture');
  });

  it('returns Furniture for unrecognized collections', () => {
    expect(detectProductCategory({ collections: ['new-arrivals'] })).toBe('Furniture');
  });

  it('handles non-array collections (string)', () => {
    expect(detectProductCategory({ collections: 'murphy-beds' })).toBe('Murphy Cabinet Bed');
  });

  it('prioritizes murphy over futon when both present', () => {
    expect(detectProductCategory({ collections: ['murphy-beds', 'futon-frames'] })).toBe('Murphy Cabinet Bed');
  });

  it('prioritizes wall-hugger over generic futon', () => {
    expect(detectProductCategory({ collections: ['wall-hugger-frames', 'futon-frames'] })).toBe('Wall Hugger Futon Frame');
  });

  it('handles null entries in collections array', () => {
    // .includes() on null throws — verify this throws or is handled
    expect(() => detectProductCategory({ collections: [null, 'futon-frames'] })).toThrow();
  });
});

// ── getCategoryFromCollections ──────────────────────────────────────

describe('getCategoryFromCollections', () => {
  it('returns Shop default for null', () => {
    const cat = getCategoryFromCollections(null);
    expect(cat.label).toBe('Shop');
    expect(cat.path).toBe('/shop-main');
  });

  it('returns Shop default for undefined', () => {
    const cat = getCategoryFromCollections(undefined);
    expect(cat.label).toBe('Shop');
    expect(cat.path).toBe('/shop-main');
  });

  it('maps murphy to Murphy Cabinet Beds', () => {
    const cat = getCategoryFromCollections(['murphy-beds']);
    expect(cat.label).toBe('Murphy Cabinet Beds');
    expect(cat.path).toBe('/murphy-cabinet-beds');
  });

  it('maps platform to Platform Beds', () => {
    const cat = getCategoryFromCollections(['platform-beds']);
    expect(cat.label).toBe('Platform Beds');
    expect(cat.path).toBe('/platform-beds');
  });

  it('maps mattress to Mattresses', () => {
    const cat = getCategoryFromCollections(['futon-mattresses']);
    expect(cat.label).toBe('Mattresses');
    expect(cat.path).toBe('/mattresses');
  });

  it('maps wall-hugger to Wall Hugger Frames', () => {
    const cat = getCategoryFromCollections(['wall-hugger-frames']);
    expect(cat.label).toBe('Wall Hugger Frames');
    expect(cat.path).toBe('/wall-huggers');
  });

  it('maps unfinished to Unfinished Wood', () => {
    const cat = getCategoryFromCollections(['unfinished-wood']);
    expect(cat.label).toBe('Unfinished Wood');
    expect(cat.path).toBe('/unfinished-wood');
  });

  it('maps casegood to Casegoods & Accessories', () => {
    const cat = getCategoryFromCollections(['casegoods']);
    expect(cat.label).toBe('Casegoods & Accessories');
    expect(cat.path).toBe('/casegoods-accessories');
  });

  it('maps accessories to Casegoods & Accessories', () => {
    const cat = getCategoryFromCollections(['accessories-pillows']);
    expect(cat.label).toBe('Casegoods & Accessories');
    expect(cat.path).toBe('/casegoods-accessories');
  });

  it('maps futon to Futon Frames', () => {
    const cat = getCategoryFromCollections(['futon-frames']);
    expect(cat.label).toBe('Futon Frames');
    expect(cat.path).toBe('/futon-frames');
  });

  it('returns Shop for unrecognized collection', () => {
    const cat = getCategoryFromCollections(['clearance-items']);
    expect(cat.label).toBe('Shop');
    expect(cat.path).toBe('/shop-main');
  });

  it('handles string input (non-array)', () => {
    const cat = getCategoryFromCollections('murphy-beds');
    expect(cat.label).toBe('Murphy Cabinet Beds');
  });

  it('prioritizes murphy over futon', () => {
    const cat = getCategoryFromCollections(['murphy-beds', 'futon-frames']);
    expect(cat.label).toBe('Murphy Cabinet Beds');
  });

  it('prioritizes platform over unfinished', () => {
    const cat = getCategoryFromCollections(['platform-beds', 'unfinished-wood']);
    expect(cat.label).toBe('Platform Beds');
  });
});
