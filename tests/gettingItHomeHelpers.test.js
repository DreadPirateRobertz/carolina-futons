/**
 * @file gettingItHomeHelpers.test.js
 * @description TDD tests for Getting It Home page helpers (cf-z8sj).
 * Covers delivery options data, coverage zones, FAQ content, and CTA logic.
 */

import { describe, it, expect } from 'vitest';
import {
  DELIVERY_OPTIONS,
  COVERAGE_ZONES,
  WHITE_GLOVE_CHECKLIST,
  DELIVERY_FAQ,
  getDeliveryOptionByCode,
  getCoverageLabel,
  getCoverageDescription,
  isLocalZone,
  isRegionalZone,
  filterFaqsByZone,
  buildDeliveryComparisonRows,
  getSchedulingCtaUrl,
  getWhiteGloveBadgeText,
} from '../src/public/gettingItHomeHelpers.js';

// ── DELIVERY_OPTIONS data integrity ────────────────────────────────

describe('DELIVERY_OPTIONS', () => {
  it('has exactly 4 options', () => {
    expect(DELIVERY_OPTIONS).toHaveLength(4);
  });

  it('each option has required fields', () => {
    for (const opt of DELIVERY_OPTIONS) {
      expect(opt).toHaveProperty('code');
      expect(opt).toHaveProperty('name');
      expect(opt).toHaveProperty('price');
      expect(opt).toHaveProperty('details');
      expect(opt).toHaveProperty('timeframe');
    }
  });

  it('has correct codes', () => {
    const codes = DELIVERY_OPTIONS.map(o => o.code);
    expect(codes).toContain('standard');
    expect(codes).toContain('local');
    expect(codes).toContain('white-glove-local');
    expect(codes).toContain('white-glove-regional');
  });

  it('standard shipping is free on orders $500+', () => {
    const opt = DELIVERY_OPTIONS.find(o => o.code === 'standard');
    expect(opt.price).toBe(0);
    expect(opt.freeThreshold).toBe(500);
  });

  it('local delivery is $75', () => {
    const opt = DELIVERY_OPTIONS.find(o => o.code === 'local');
    expect(opt.price).toBe(75);
  });

  it('white glove local is $149', () => {
    const opt = DELIVERY_OPTIONS.find(o => o.code === 'white-glove-local');
    expect(opt.price).toBe(149);
  });

  it('white glove regional is $249', () => {
    const opt = DELIVERY_OPTIONS.find(o => o.code === 'white-glove-regional');
    expect(opt.price).toBe(249);
  });
});

// ── COVERAGE_ZONES ──────────────────────────────────────────────────

describe('COVERAGE_ZONES', () => {
  it('has local and regional zones', () => {
    expect(COVERAGE_ZONES).toHaveProperty('local');
    expect(COVERAGE_ZONES).toHaveProperty('regional');
  });

  it('local zone has radius and example cities', () => {
    expect(COVERAGE_ZONES.local.radiusMiles).toBe(25);
    expect(COVERAGE_ZONES.local.cities).toContain('Hendersonville');
  });

  it('regional zone has 25-100mi radius', () => {
    expect(COVERAGE_ZONES.regional.radiusMin).toBe(25);
    expect(COVERAGE_ZONES.regional.radiusMax).toBe(100);
    expect(COVERAGE_ZONES.regional.cities).toContain('Asheville');
    expect(COVERAGE_ZONES.regional.cities).toContain('Greenville');
  });
});

// ── WHITE_GLOVE_CHECKLIST ────────────────────────────────────────────

describe('WHITE_GLOVE_CHECKLIST', () => {
  it('has at least 4 items', () => {
    expect(WHITE_GLOVE_CHECKLIST.length).toBeGreaterThanOrEqual(4);
  });

  it('includes delivery and assembly', () => {
    const text = WHITE_GLOVE_CHECKLIST.map(i => i.toLowerCase()).join(' ');
    expect(text).toMatch(/deliver/);
    expect(text).toMatch(/assembl/);
  });

  it('mentions debris or removal', () => {
    const text = WHITE_GLOVE_CHECKLIST.join(' ').toLowerCase();
    expect(text).toMatch(/debris|removal|haul/);
  });
});

// ── DELIVERY_FAQ ────────────────────────────────────────────────────

describe('DELIVERY_FAQ', () => {
  it('has at least 3 FAQs', () => {
    expect(DELIVERY_FAQ.length).toBeGreaterThanOrEqual(3);
  });

  it('each FAQ has question and answer', () => {
    for (const faq of DELIVERY_FAQ) {
      expect(faq).toHaveProperty('q');
      expect(faq).toHaveProperty('a');
      expect(faq.q.length).toBeGreaterThan(5);
      expect(faq.a.length).toBeGreaterThan(10);
    }
  });

  it('covers apartment question', () => {
    const text = DELIVERY_FAQ.map(f => f.q + ' ' + f.a).join(' ').toLowerCase();
    expect(text).toMatch(/apartment|condo|floor/);
  });

  it('covers scheduling advance notice', () => {
    const text = DELIVERY_FAQ.map(f => f.q + ' ' + f.a).join(' ').toLowerCase();
    expect(text).toMatch(/advance|schedule|book/);
  });

  it('covers home requirement', () => {
    const text = DELIVERY_FAQ.map(f => f.q + ' ' + f.a).join(' ').toLowerCase();
    expect(text).toMatch(/home|present|someone/);
  });
});

// ── getDeliveryOptionByCode ──────────────────────────────────────────

describe('getDeliveryOptionByCode', () => {
  it('returns the correct option', () => {
    const opt = getDeliveryOptionByCode('white-glove-local');
    expect(opt.price).toBe(149);
    expect(opt.code).toBe('white-glove-local');
  });

  it('returns null for unknown code', () => {
    expect(getDeliveryOptionByCode('teleport')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(getDeliveryOptionByCode('')).toBeNull();
  });
});

// ── getCoverageLabel / getCoverageDescription ────────────────────────

describe('getCoverageLabel', () => {
  it('returns label for local zone', () => {
    const label = getCoverageLabel('local');
    expect(typeof label).toBe('string');
    expect(label.length).toBeGreaterThan(0);
  });

  it('returns label for regional zone', () => {
    const label = getCoverageLabel('regional');
    expect(typeof label).toBe('string');
    expect(label.length).toBeGreaterThan(0);
  });

  it('returns empty string for unknown zone', () => {
    expect(getCoverageLabel('orbit')).toBe('');
  });
});

describe('getCoverageDescription', () => {
  it('local description mentions Hendersonville', () => {
    const desc = getCoverageDescription('local');
    expect(desc.toLowerCase()).toMatch(/hendersonville/);
  });

  it('regional description mentions Asheville', () => {
    const desc = getCoverageDescription('regional');
    expect(desc.toLowerCase()).toMatch(/asheville/);
  });
});

// ── isLocalZone / isRegionalZone ─────────────────────────────────────

describe('isLocalZone', () => {
  it('returns true for local', () => {
    expect(isLocalZone('local')).toBe(true);
  });

  it('returns false for regional', () => {
    expect(isLocalZone('regional')).toBe(false);
  });

  it('returns false for unknown', () => {
    expect(isLocalZone('moon')).toBe(false);
  });
});

describe('isRegionalZone', () => {
  it('returns true for regional', () => {
    expect(isRegionalZone('regional')).toBe(true);
  });

  it('returns false for local', () => {
    expect(isRegionalZone('local')).toBe(false);
  });
});

// ── filterFaqsByZone ────────────────────────────────────────────────

describe('filterFaqsByZone', () => {
  it('returns all FAQs when zone is null', () => {
    const result = filterFaqsByZone(null);
    expect(result).toHaveLength(DELIVERY_FAQ.length);
  });

  it('returns only local-relevant FAQs for local zone', () => {
    const result = filterFaqsByZone('local');
    expect(result.length).toBeGreaterThan(0);
    // Must be a subset of all FAQs
    for (const faq of result) {
      expect(DELIVERY_FAQ).toContainEqual(faq);
    }
  });

  it('returns array for unknown zone', () => {
    const result = filterFaqsByZone('mars');
    expect(Array.isArray(result)).toBe(true);
  });
});

// ── buildDeliveryComparisonRows ─────────────────────────────────────

describe('buildDeliveryComparisonRows', () => {
  it('returns 4 rows (one per option)', () => {
    const rows = buildDeliveryComparisonRows();
    expect(rows).toHaveLength(4);
  });

  it('each row has option, priceLabel, and details columns', () => {
    const rows = buildDeliveryComparisonRows();
    for (const row of rows) {
      expect(row).toHaveProperty('option');
      expect(row).toHaveProperty('priceLabel');
      expect(row).toHaveProperty('details');
      expect(row).toHaveProperty('timeframe');
    }
  });

  it('standard row shows free threshold label', () => {
    const rows = buildDeliveryComparisonRows();
    const standard = rows.find(r => r.code === 'standard');
    expect(standard.priceLabel.toLowerCase()).toMatch(/free|500/);
  });

  it('rows are in correct order: standard, local, wg-local, wg-regional', () => {
    const rows = buildDeliveryComparisonRows();
    expect(rows[0].code).toBe('standard');
    expect(rows[1].code).toBe('local');
    expect(rows[2].code).toBe('white-glove-local');
    expect(rows[3].code).toBe('white-glove-regional');
  });
});

// ── getSchedulingCtaUrl ─────────────────────────────────────────────

describe('getSchedulingCtaUrl', () => {
  it('returns a non-empty string', () => {
    const url = getSchedulingCtaUrl();
    expect(typeof url).toBe('string');
    expect(url.length).toBeGreaterThan(0);
  });

  it('returns a relative path or starts with /', () => {
    const url = getSchedulingCtaUrl();
    // Must be internal navigation or an anchor
    expect(url.startsWith('/') || url.startsWith('#')).toBe(true);
  });

  it('includes contact or schedule keyword', () => {
    const url = getSchedulingCtaUrl().toLowerCase();
    expect(url).toMatch(/contact|schedul|book|form/);
  });
});

// ── getWhiteGloveBadgeText ──────────────────────────────────────────

describe('getWhiteGloveBadgeText', () => {
  it('returns a short label string', () => {
    const text = getWhiteGloveBadgeText();
    expect(typeof text).toBe('string');
    expect(text.length).toBeLessThan(40);
  });

  it('references white glove', () => {
    const text = getWhiteGloveBadgeText().toLowerCase();
    expect(text).toMatch(/white.?glove|delivery|available/);
  });
});
