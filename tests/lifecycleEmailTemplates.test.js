/**
 * Tests for src/backend/lifecycleEmailTemplates.js
 *
 * Verifies that each lifecycle email template function:
 *   - Returns a non-empty HTML string
 *   - Includes the recipient's name
 *   - Includes the product name
 *   - Includes expected content markers for that email type
 *   - Year 1 anniversary includes ANNIVERSARY15 discount code
 */
import { describe, it, expect } from 'vitest';
import {
  generateDay7CareGuide,
  generateMonth1CheckIn,
  generateYear1Anniversary,
} from '../src/backend/lifecycleEmailTemplates.js';

const PARAMS = {
  name: 'Sandra',
  productName: 'Java Full XL Futon Frame',
  orderDate: '2025-03-01',
};

// ── generateDay7CareGuide ────────────────────────────────────────────

describe('generateDay7CareGuide', () => {
  it('returns a non-empty string', () => {
    const html = generateDay7CareGuide(PARAMS);
    expect(typeof html).toBe('string');
    expect(html.length).toBeGreaterThan(100);
  });

  it('includes recipient name', () => {
    const html = generateDay7CareGuide(PARAMS);
    expect(html).toContain('Sandra');
  });

  it('includes product name', () => {
    const html = generateDay7CareGuide(PARAMS);
    expect(html).toContain('Java Full XL Futon Frame');
  });

  it('includes flipping/rotating care instructions', () => {
    const html = generateDay7CareGuide(PARAMS);
    const lower = html.toLowerCase();
    expect(lower.includes('flip') || lower.includes('rotat')).toBe(true);
  });

  it('is valid HTML (has html and body tags)', () => {
    const html = generateDay7CareGuide(PARAMS);
    expect(html).toContain('<html');
    expect(html).toContain('<body');
  });

  it('includes Carolina Futons branding', () => {
    const html = generateDay7CareGuide(PARAMS);
    expect(html).toContain('Carolina Futons');
  });
});

// ── generateMonth1CheckIn ────────────────────────────────────────────

describe('generateMonth1CheckIn', () => {
  it('returns a non-empty string', () => {
    const html = generateMonth1CheckIn(PARAMS);
    expect(typeof html).toBe('string');
    expect(html.length).toBeGreaterThan(100);
  });

  it('includes recipient name', () => {
    const html = generateMonth1CheckIn(PARAMS);
    expect(html).toContain('Sandra');
  });

  it('includes product name', () => {
    const html = generateMonth1CheckIn(PARAMS);
    expect(html).toContain('Java Full XL Futon Frame');
  });

  it('includes care tips content', () => {
    const html = generateMonth1CheckIn(PARAMS);
    const lower = html.toLowerCase();
    expect(lower.includes('care') || lower.includes('tip') || lower.includes('maintain')).toBe(true);
  });

  it('encourages leaving a review', () => {
    const html = generateMonth1CheckIn(PARAMS);
    const lower = html.toLowerCase();
    expect(lower.includes('review') || lower.includes('feedback') || lower.includes('share')).toBe(true);
  });

  it('is valid HTML (has html and body tags)', () => {
    const html = generateMonth1CheckIn(PARAMS);
    expect(html).toContain('<html');
    expect(html).toContain('<body');
  });
});

// ── generateYear1Anniversary ─────────────────────────────────────────

describe('generateYear1Anniversary', () => {
  it('returns a non-empty string', () => {
    const html = generateYear1Anniversary(PARAMS);
    expect(typeof html).toBe('string');
    expect(html.length).toBeGreaterThan(100);
  });

  it('includes recipient name', () => {
    const html = generateYear1Anniversary(PARAMS);
    expect(html).toContain('Sandra');
  });

  it('includes product name', () => {
    const html = generateYear1Anniversary(PARAMS);
    expect(html).toContain('Java Full XL Futon Frame');
  });

  it('includes ANNIVERSARY15 discount code', () => {
    const html = generateYear1Anniversary(PARAMS);
    expect(html).toContain('ANNIVERSARY15');
  });

  it('mentions 15% discount', () => {
    const html = generateYear1Anniversary(PARAMS);
    expect(html).toContain('15%');
  });

  it('includes thank you messaging', () => {
    const html = generateYear1Anniversary(PARAMS);
    const lower = html.toLowerCase();
    expect(lower.includes('thank') || lower.includes('anniversary') || lower.includes('celebrat')).toBe(true);
  });

  it('is valid HTML (has html and body tags)', () => {
    const html = generateYear1Anniversary(PARAMS);
    expect(html).toContain('<html');
    expect(html).toContain('<body');
  });
});

// ── Edge cases ────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('handles name with special characters without throwing', () => {
    const html = generateYear1Anniversary({ name: "O'Brien", productName: 'Zen Sofa', orderDate: '2025-01-01' });
    expect(typeof html).toBe('string');
    expect(html.length).toBeGreaterThan(0);
  });

  it('all three functions accept same params shape', () => {
    const params = { name: 'Test', productName: 'Test Futon', orderDate: '2025-06-01' };
    expect(() => generateDay7CareGuide(params)).not.toThrow();
    expect(() => generateMonth1CheckIn(params)).not.toThrow();
    expect(() => generateYear1Anniversary(params)).not.toThrow();
  });
});
