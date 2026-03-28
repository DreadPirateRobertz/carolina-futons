/**
 * @file customEvents.test.js
 * @description Tests for the custom event taxonomy and tracking module (cf-w62s).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __getInserted } from './__mocks__/wix-data.js';
import {
  CUSTOM_EVENTS,
  normalizeEventName,
  trackCustomEvent,
  getEventTaxonomy,
} from '../src/backend/customEvents.web.js';

beforeEach(() => {
  __reset();
});

// ── Event Taxonomy ───────────────────────────────────────────────────

describe('CUSTOM_EVENTS taxonomy', () => {
  it('defines exactly 25 events', () => {
    expect(Object.keys(CUSTOM_EVENTS)).toHaveLength(25);
  });

  it('every event has category and description', () => {
    for (const [name, def] of Object.entries(CUSTOM_EVENTS)) {
      expect(def.category, `${name} missing category`).toBeTruthy();
      expect(def.description, `${name} missing description`).toBeTruthy();
    }
  });

  it('all event names are lowercase with underscores only', () => {
    for (const name of Object.keys(CUSTOM_EVENTS)) {
      expect(name).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it('covers all 12 feature categories', () => {
    const categories = new Set(Object.values(CUSTOM_EVENTS).map(d => d.category));
    expect(categories).toEqual(new Set([
      'quiz', 'swatch', 'bundle', 'loyalty', 'spin',
      'referral', 'review', 'financing', 'compare',
      'room_planner', 'shipping', 'consultation',
    ]));
  });
});

// ── Event Name Normalization ────────────────────────────────────────

describe('normalizeEventName', () => {
  it('maps organic quiz_start to quiz_started', () => {
    expect(normalizeEventName('quiz_start')).toBe('quiz_started');
  });

  it('maps quiz_complete to quiz_completed', () => {
    expect(normalizeEventName('quiz_complete')).toBe('quiz_completed');
  });

  it('maps email_captured to quiz_lead_captured', () => {
    expect(normalizeEventName('email_captured')).toBe('quiz_lead_captured');
  });

  it('maps financing_calculate to financing_calculated', () => {
    expect(normalizeEventName('financing_calculate')).toBe('financing_calculated');
  });

  it('maps spin_wheel to spin_played', () => {
    expect(normalizeEventName('spin_wheel')).toBe('spin_played');
  });

  it('passes through already-canonical names', () => {
    expect(normalizeEventName('quiz_started')).toBe('quiz_started');
    expect(normalizeEventName('review_submitted')).toBe('review_submitted');
  });

  it('passes through unknown names unchanged', () => {
    expect(normalizeEventName('custom_thing')).toBe('custom_thing');
  });

  it('returns empty string for falsy input', () => {
    expect(normalizeEventName('')).toBe('');
    expect(normalizeEventName(null)).toBe('');
    expect(normalizeEventName(undefined)).toBe('');
  });

  it('converts hyphens to underscores and strips other special chars', () => {
    expect(normalizeEventName('quiz-start')).toBe('quiz_started');
    expect(normalizeEventName('quiz--start!')).toBe('quiz_started');
  });
});

// ── trackCustomEvent ────────────────────────────────────────────────

describe('trackCustomEvent', () => {
  it('writes event to AnalyticsEvents collection', async () => {
    const result = await trackCustomEvent('quiz_started', { memberId: 'mem-1' });
    expect(result.success).toBe(true);

    const inserted = __getInserted('AnalyticsEvents');
    expect(inserted).toHaveLength(1);
    expect(inserted[0].eventType).toBe('quiz_started');
    expect(inserted[0].source).toBe('quiz');
    expect(inserted[0].memberId).toBe('mem-1');
  });

  it('normalizes organic event names before writing', async () => {
    await trackCustomEvent('quiz_start');
    const inserted = __getInserted('AnalyticsEvents');
    expect(inserted[0].eventType).toBe('quiz_started');
  });

  it('auto-detects source from event category', async () => {
    await trackCustomEvent('financing_calculated');
    const inserted = __getInserted('AnalyticsEvents');
    expect(inserted[0].source).toBe('financing');
  });

  it('allows source override', async () => {
    await trackCustomEvent('quiz_started', { source: 'homepage_widget' });
    const inserted = __getInserted('AnalyticsEvents');
    expect(inserted[0].source).toBe('homepage_widget');
  });

  it('returns failure for empty event name', async () => {
    const result = await trackCustomEvent('');
    expect(result.success).toBe(false);
  });

  it('returns failure for null event name', async () => {
    const result = await trackCustomEvent(null);
    expect(result.success).toBe(false);
  });

  it('stores original event name when normalized', async () => {
    await trackCustomEvent('quiz_start', { memberId: 'mem-2' });
    const inserted = __getInserted('AnalyticsEvents');
    const payload = JSON.parse(inserted[0].payload);
    expect(payload.originalEventName).toBe('quiz_start');
  });

  it('omits originalEventName when already canonical', async () => {
    await trackCustomEvent('quiz_started');
    const inserted = __getInserted('AnalyticsEvents');
    const payload = JSON.parse(inserted[0].payload);
    expect(payload.originalEventName).toBeUndefined();
  });
});

// ── getEventTaxonomy ────────────────────────────────────────────────

describe('getEventTaxonomy', () => {
  it('returns array of all 24 event names', () => {
    const taxonomy = getEventTaxonomy();
    expect(taxonomy).toHaveLength(25);
    expect(taxonomy).toContain('quiz_started');
    expect(taxonomy).toContain('consultation_booked');
  });
});
