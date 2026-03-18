/**
 * showroomService.test.js — CF-4cls: S1-S4 Showroom / Physical-Digital Bridge
 * Tests: isShowroomEligible, isQrMode, buildStoreModeText, formatShowroomHours,
 *        getShowroomBookingUrl, getShowroomEligibleIds, getShowroomSectionData
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isShowroomEligible,
  isQrMode,
  buildStoreModeText,
  formatShowroomHours,
  getShowroomBookingUrl,
  getShowroomEligibleIds,
  getShowroomSectionData,
  SHOWROOM_SERVICE_SLUG,
  SHOWROOM_TAG,
  SHOWROOM_INFO,
} from '../src/backend/showroomService.web.js';

// ── Constants ─────────────────────────────────────────────────────────────────

describe('showroomService constants', () => {
  it('exports SHOWROOM_SERVICE_SLUG as string', () => {
    expect(typeof SHOWROOM_SERVICE_SLUG).toBe('string');
    expect(SHOWROOM_SERVICE_SLUG.length).toBeGreaterThan(0);
  });

  it('exports SHOWROOM_TAG as string', () => {
    expect(typeof SHOWROOM_TAG).toBe('string');
  });

  it('exports SHOWROOM_INFO with required fields', () => {
    expect(SHOWROOM_INFO).toMatchObject({
      address: expect.any(String),
      city: expect.any(String),
      state: expect.any(String),
      zip: expect.any(String),
      phone: expect.any(String),
      email: expect.any(String),
    });
  });

  it('SHOWROOM_INFO.hours is non-empty array', () => {
    expect(Array.isArray(SHOWROOM_INFO.hours)).toBe(true);
    expect(SHOWROOM_INFO.hours.length).toBeGreaterThan(0);
  });

  it('SHOWROOM_INFO.hours entries have days and hours fields', () => {
    for (const h of SHOWROOM_INFO.hours) {
      expect(h).toHaveProperty('days');
      expect(h).toHaveProperty('hours');
    }
  });
});

// ── S2: isShowroomEligible ────────────────────────────────────────────────────

describe('isShowroomEligible', () => {
  it('returns false for null product', () => {
    expect(isShowroomEligible(null)).toBe(false);
  });

  it('returns false for undefined product', () => {
    expect(isShowroomEligible(undefined)).toBe(false);
  });

  it('returns false for product with no customFields', () => {
    expect(isShowroomEligible({ ribbons: [] })).toBe(false);
  });

  it('returns true when customFields.showroomEligible is true (boolean)', () => {
    expect(isShowroomEligible({
      ribbons: [],
      customFields: { showroomEligible: true },
    })).toBe(true);
  });

  it('returns true when customFields.showroomEligible is "true" (string)', () => {
    expect(isShowroomEligible({
      ribbons: [],
      customFields: { showroomEligible: 'true' },
    })).toBe(true);
  });

  it('returns false when customFields.showroomEligible is false', () => {
    expect(isShowroomEligible({
      ribbons: [],
      customFields: { showroomEligible: false },
    })).toBe(false);
  });

  it('returns true when ribbon text matches SHOWROOM_TAG', () => {
    expect(isShowroomEligible({
      ribbons: [{ text: SHOWROOM_TAG }],
    })).toBe(true);
  });

  it('is case-insensitive for ribbon tag match', () => {
    expect(isShowroomEligible({
      ribbons: [{ text: SHOWROOM_TAG.toUpperCase() }],
    })).toBe(true);
  });

  it('returns false when ribbon text does not match', () => {
    expect(isShowroomEligible({
      ribbons: [{ text: 'bestseller' }],
    })).toBe(false);
  });

  it('returns false when ribbons is not an array', () => {
    expect(isShowroomEligible({ ribbons: null })).toBe(false);
  });

  it('returns false for product with empty ribbons and no customFields', () => {
    expect(isShowroomEligible({ ribbons: [] })).toBe(false);
  });
});

// ── S3: isQrMode ──────────────────────────────────────────────────────────────

describe('isQrMode', () => {
  it('returns true for qr=1 (string)', () => {
    expect(isQrMode({ qr: '1' })).toBe(true);
  });

  it('returns true for qr=1 (number)', () => {
    expect(isQrMode({ qr: 1 })).toBe(true);
  });

  it('returns false for qr=0', () => {
    expect(isQrMode({ qr: '0' })).toBe(false);
  });

  it('returns false for qr absent', () => {
    expect(isQrMode({})).toBe(false);
  });

  it('returns false for null query', () => {
    expect(isQrMode(null)).toBe(false);
  });

  it('returns false for undefined query', () => {
    expect(isQrMode(undefined)).toBe(false);
  });

  it('returns false for qr=true (non-1 truthy)', () => {
    expect(isQrMode({ qr: 'true' })).toBe(false);
  });
});

// ── S3: buildStoreModeText ────────────────────────────────────────────────────

describe('buildStoreModeText', () => {
  it('returns a non-empty string', () => {
    const text = buildStoreModeText();
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
  });

  it('contains store-mode indicator', () => {
    const text = buildStoreModeText();
    expect(text.toLowerCase()).toContain('store');
  });

  it('returns consistent result on multiple calls', () => {
    expect(buildStoreModeText()).toBe(buildStoreModeText());
  });
});

// ── S4: formatShowroomHours ───────────────────────────────────────────────────

describe('formatShowroomHours', () => {
  it('returns empty string for null input', () => {
    expect(formatShowroomHours(null)).toBe('');
  });

  it('returns empty string for non-array input', () => {
    expect(formatShowroomHours('invalid')).toBe('');
  });

  it('returns empty string for empty array', () => {
    expect(formatShowroomHours([])).toBe('');
  });

  it('formats a single entry as "days: hours"', () => {
    const result = formatShowroomHours([{ days: 'Monday', hours: '9–5' }]);
    expect(result).toBe('Monday: 9–5');
  });

  it('joins multiple entries with newline', () => {
    const result = formatShowroomHours([
      { days: 'Mon–Fri', hours: '9–5' },
      { days: 'Saturday', hours: '10–4' },
    ]);
    expect(result).toContain('\n');
    expect(result).toContain('Mon–Fri: 9–5');
    expect(result).toContain('Saturday: 10–4');
  });

  it('formats SHOWROOM_INFO.hours without error', () => {
    const result = formatShowroomHours(SHOWROOM_INFO.hours);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

// ── S1: getShowroomBookingUrl ─────────────────────────────────────────────────

describe('getShowroomBookingUrl', () => {
  it('returns an object with url and serviceName', async () => {
    const result = await getShowroomBookingUrl();
    expect(result).toHaveProperty('url');
    expect(result).toHaveProperty('serviceName');
  });

  it('url starts with /booking-calendar/', async () => {
    const result = await getShowroomBookingUrl();
    expect(result.url).toMatch(/^\/booking-calendar\//);
  });

  it('url includes SHOWROOM_SERVICE_SLUG', async () => {
    const result = await getShowroomBookingUrl();
    expect(result.url).toContain(SHOWROOM_SERVICE_SLUG);
  });

  it('serviceName is a non-empty string', async () => {
    const result = await getShowroomBookingUrl();
    expect(typeof result.serviceName).toBe('string');
    expect(result.serviceName.length).toBeGreaterThan(0);
  });

  it('does not return error on normal call', async () => {
    const result = await getShowroomBookingUrl();
    expect(result.error).toBeUndefined();
  });
});

// ── S2: getShowroomEligibleIds ────────────────────────────────────────────────

describe('getShowroomEligibleIds', () => {
  it('returns empty array for empty input', async () => {
    const result = await getShowroomEligibleIds([]);
    expect(result).toEqual([]);
  });

  it('returns empty array for null input', async () => {
    const result = await getShowroomEligibleIds(null);
    expect(result).toEqual([]);
  });

  it('returns empty array for non-array input', async () => {
    const result = await getShowroomEligibleIds('not-array');
    expect(result).toEqual([]);
  });

  it('returns array type', async () => {
    // With no wix-stores-backend mock, falls back gracefully
    const result = await getShowroomEligibleIds(['some-id']);
    expect(Array.isArray(result)).toBe(true);
  });
});

// ── S4: getShowroomSectionData ────────────────────────────────────────────────

describe('getShowroomSectionData', () => {
  it('returns info object', async () => {
    const result = await getShowroomSectionData();
    expect(result).toHaveProperty('info');
  });

  it('returns bookingUrl string', async () => {
    const result = await getShowroomSectionData();
    expect(typeof result.bookingUrl).toBe('string');
    expect(result.bookingUrl).toContain(SHOWROOM_SERVICE_SLUG);
  });

  it('returns mapUrl string', async () => {
    const result = await getShowroomSectionData();
    expect(typeof result.mapUrl).toBe('string');
    expect(result.mapUrl).toContain('google.com/maps');
  });

  it('info matches SHOWROOM_INFO structure', async () => {
    const result = await getShowroomSectionData();
    expect(result.info.address).toBe(SHOWROOM_INFO.address);
    expect(result.info.city).toBe(SHOWROOM_INFO.city);
    expect(result.info.phone).toBe(SHOWROOM_INFO.phone);
  });

  it('does not return error on normal call', async () => {
    const result = await getShowroomSectionData();
    expect(result.error).toBeUndefined();
  });

  it('mapUrl is properly encoded (no raw spaces)', async () => {
    const result = await getShowroomSectionData();
    expect(result.mapUrl).not.toContain(' ');
  });
});
