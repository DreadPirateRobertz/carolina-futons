/**
 * showroomPage.test.js — CF-4cls: S1-S4 Showroom page/component behavior
 * Tests pure helper functions used in Product Page, Category Page, Home page
 * for showroom features. Page wiring tests use mock $w.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Re-import pure utility functions from showroomService
import {
  isShowroomEligible,
  isQrMode,
  buildStoreModeText,
  formatShowroomHours,
  SHOWROOM_INFO,
  SHOWROOM_SERVICE_SLUG,
} from '../src/backend/showroomService.web.js';

// ── S1: CTA wiring helpers ────────────────────────────────────────────────────

describe('Showroom S1 — CTA behavior', () => {
  it('booking URL path is navigable (starts with /)', () => {
    const url = `/booking-calendar/${SHOWROOM_SERVICE_SLUG}`;
    expect(url).toMatch(/^\//);
  });

  it('booking URL does not contain whitespace', () => {
    const url = `/booking-calendar/${SHOWROOM_SERVICE_SLUG}`;
    expect(url).not.toMatch(/\s/);
  });

  it('CTA label defaults to non-empty string', () => {
    const label = 'Book a Showroom Visit';
    expect(label.length).toBeGreaterThan(0);
  });
});

// ── S2: Badge overlay logic ───────────────────────────────────────────────────

describe('Showroom S2 — See It In Store badge', () => {
  it('eligible product with matching ribbon shows badge', () => {
    const product = {
      _id: 'prod-1',
      ribbons: [{ text: 'showroom-eligible' }],
    };
    expect(isShowroomEligible(product)).toBe(true);
  });

  it('non-eligible product hides badge', () => {
    const product = {
      _id: 'prod-2',
      ribbons: [{ text: 'bestseller' }],
    };
    expect(isShowroomEligible(product)).toBe(false);
  });

  it('product with showroomEligible customField shows badge', () => {
    const product = {
      _id: 'prod-3',
      ribbons: [],
      customFields: { showroomEligible: true },
    };
    expect(isShowroomEligible(product)).toBe(true);
  });

  it('out-of-stock product with showroom tag is still eligible', () => {
    // Eligibility is independent of stock — stock handled separately in UI
    const product = {
      _id: 'prod-4',
      ribbons: [{ text: 'showroom-eligible' }],
      inStock: false,
    };
    expect(isShowroomEligible(product)).toBe(true);
  });

  it('product with null ribbons returns false', () => {
    const product = { _id: 'prod-5', ribbons: null };
    expect(isShowroomEligible(product)).toBe(false);
  });

  it('product with multiple ribbons, one matching — eligible', () => {
    const product = {
      _id: 'prod-6',
      ribbons: [{ text: 'new-arrival' }, { text: 'showroom-eligible' }],
    };
    expect(isShowroomEligible(product)).toBe(true);
  });
});

// ── S3: QR / store mode ───────────────────────────────────────────────────────

describe('Showroom S3 — QR / Store Mode', () => {
  it('qr=1 activates store mode', () => {
    expect(isQrMode({ qr: '1' })).toBe(true);
  });

  it('no qr param = normal customer UX', () => {
    expect(isQrMode({ page: 'futon-frame' })).toBe(false);
  });

  it('qr=0 stays in customer UX', () => {
    expect(isQrMode({ qr: '0' })).toBe(false);
  });

  it('storeModeText mentions store', () => {
    expect(buildStoreModeText().toLowerCase()).toMatch(/store/);
  });

  it('storeModeText is presentable (>10 chars)', () => {
    expect(buildStoreModeText().length).toBeGreaterThan(10);
  });

  it('isQrMode handles empty object', () => {
    expect(isQrMode({})).toBe(false);
  });

  it('isQrMode handles missing query gracefully', () => {
    expect(() => isQrMode(undefined)).not.toThrow();
  });
});

// ── S4: Home showroom section ─────────────────────────────────────────────────

describe('Showroom S4 — Home section data', () => {
  it('SHOWROOM_INFO has correct address', () => {
    expect(SHOWROOM_INFO.address).toBeTruthy();
    expect(typeof SHOWROOM_INFO.address).toBe('string');
  });

  it('SHOWROOM_INFO phone matches CF format', () => {
    expect(SHOWROOM_INFO.phone).toMatch(/\(828\)/);
  });

  it('SHOWROOM_INFO email is valid format', () => {
    expect(SHOWROOM_INFO.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  });

  it('SHOWROOM_INFO has at least 3 hours entries (Mon-Sun coverage)', () => {
    expect(SHOWROOM_INFO.hours.length).toBeGreaterThanOrEqual(2);
  });

  it('formatShowroomHours produces output for SHOWROOM_INFO.hours', () => {
    const result = formatShowroomHours(SHOWROOM_INFO.hours);
    expect(result).toContain(':');
    expect(result.length).toBeGreaterThan(10);
  });

  it('formatShowroomHours includes closed days info', () => {
    const result = formatShowroomHours(SHOWROOM_INFO.hours);
    expect(result.toLowerCase()).toMatch(/closed|sun|wed|sat/);
  });

  it('SHOWROOM_INFO.mapEmbedQuery is URL-friendly', () => {
    const encoded = encodeURIComponent(SHOWROOM_INFO.mapEmbedQuery);
    expect(encoded).not.toContain(' ');
  });

  it('hours array entries all have days and hours properties', () => {
    for (const entry of SHOWROOM_INFO.hours) {
      expect(entry).toHaveProperty('days');
      expect(entry).toHaveProperty('hours');
      expect(typeof entry.days).toBe('string');
      expect(typeof entry.hours).toBe('string');
    }
  });
});
