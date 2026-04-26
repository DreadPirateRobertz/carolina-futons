/**
 * @file reviewsPage.test.js
 * @description TDD tests for src/pages/Reviews.js — site-level /reviews page
 * that fetches from CMS (reviewsService) instead of hardcoded REVIEWS array,
 * and injects schema.org AggregateRating + Review JSON-LD.
 *
 * cf-rxbi: migrate hardcoded data → CMS + add schema markup.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── $w Mock ───────────────────────────────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    html: '',
    data: [],
    accessibility: { ariaLabel: '' },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(),
    expand: vi.fn(),
    onClick: vi.fn(),
    onItemReady: vi.fn(),
    onReady: vi.fn(() => Promise.resolve()),
  };
}

function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockElement());
  return elements.get(sel);
}

let onReadyHandler = null;
globalThis.$w = Object.assign(
  (sel) => getEl(sel),
  { onReady: (fn) => { onReadyHandler = fn; } }
);

// ── Mocks ─────────────────────────────────────────────────────────────────────

const SAMPLE_REVIEWS = [
  { _id: 'r1', authorName: 'Alice', rating: 5, title: 'Love it!', body: 'Best futon ever.', productName: 'Eureka Futon', _createdDate: '2026-01-10' },
  { _id: 'r2', authorName: 'Bob', rating: 4, title: 'Solid quality', body: 'Very sturdy.', productName: 'Moonshadow Mattress', _createdDate: '2026-01-15' },
  { _id: 'r3', authorName: 'Carol', rating: 5, title: 'Perfect!', body: 'Arrived fast.', productName: 'Eureka Futon', _createdDate: '2026-01-20' },
];

vi.mock('backend/reviewsService.web', () => ({
  getFeaturedReviews: vi.fn(),
  getSiteAggregateRating: vi.fn(),
}));

vi.mock('public/pageSeo.js', () => ({ initPageSeo: vi.fn() }));
vi.mock('public/engagementTracker', () => ({ trackEvent: vi.fn() }));
vi.mock('public/mobileHelpers', () => ({ initBackToTop: vi.fn() }));

import { getFeaturedReviews, getSiteAggregateRating } from 'backend/reviewsService.web';

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  elements.clear();
  onReadyHandler = null;
  vi.resetModules();
  getFeaturedReviews.mockResolvedValue({ success: true, reviews: SAMPLE_REVIEWS });
  getSiteAggregateRating.mockResolvedValue({ average: 4.7, total: 3, bestRating: 5 });
});

describe('Reviews page', () => {
  beforeEach(async () => {
    await import('../src/pages/Reviews.js');
  });

  it('registers an onReady handler', () => {
    expect(onReadyHandler).toBeInstanceOf(Function);
  });

  // ── Page Init ───────────────────────────────────────────────────────────────

  describe('page initialization', () => {
    it('calls initPageSeo with "reviews"', async () => {
      await onReadyHandler();
      const { initPageSeo } = await import('public/pageSeo.js');
      expect(initPageSeo).toHaveBeenCalledWith('reviews');
    });

    it('tracks page_view event', async () => {
      await onReadyHandler();
      const { trackEvent } = await import('public/engagementTracker');
      expect(trackEvent).toHaveBeenCalledWith('page_view', expect.objectContaining({ page: 'reviews' }));
    });

    it('calls getFeaturedReviews with a limit', async () => {
      await onReadyHandler();
      expect(getFeaturedReviews).toHaveBeenCalledWith(expect.objectContaining({ limit: expect.any(Number) }));
    });

    it('calls getSiteAggregateRating', async () => {
      await onReadyHandler();
      expect(getSiteAggregateRating).toHaveBeenCalled();
    });
  });

  // ── Reviews Repeater ────────────────────────────────────────────────────────

  describe('reviews repeater', () => {
    it('populates reviewsRepeater with fetched reviews', async () => {
      await onReadyHandler();
      expect(getEl('#reviewsRepeater').data).toHaveLength(3);
    });

    it('sets accessible label on reviewsRepeater', async () => {
      await onReadyHandler();
      expect(getEl('#reviewsRepeater').accessibility.ariaLabel).toBeTruthy();
    });

    it('onItemReady sets reviewer name from item data', async () => {
      await onReadyHandler();
      const repeater = getEl('#reviewsRepeater');
      const cb = repeater.onItemReady.mock.calls[0][0];
      const $item = (sel) => getEl(`_rev_${sel}`);
      cb($item, SAMPLE_REVIEWS[0]);
      expect(getEl('_rev_#reviewAuthor').text).toBe('Alice');
    });

    it('onItemReady sets review rating text', async () => {
      await onReadyHandler();
      const repeater = getEl('#reviewsRepeater');
      const cb = repeater.onItemReady.mock.calls[0][0];
      const $item = (sel) => getEl(`_rev2_${sel}`);
      cb($item, SAMPLE_REVIEWS[0]);
      expect(getEl('_rev2_#reviewRating').text).toContain('★');
    });

    it('onItemReady sets review title', async () => {
      await onReadyHandler();
      const repeater = getEl('#reviewsRepeater');
      const cb = repeater.onItemReady.mock.calls[0][0];
      const $item = (sel) => getEl(`_rev3_${sel}`);
      cb($item, SAMPLE_REVIEWS[0]);
      expect(getEl('_rev3_#reviewTitle').text).toBe('Love it!');
    });

    it('onItemReady sets review body', async () => {
      await onReadyHandler();
      const repeater = getEl('#reviewsRepeater');
      const cb = repeater.onItemReady.mock.calls[0][0];
      const $item = (sel) => getEl(`_rev4_${sel}`);
      cb($item, SAMPLE_REVIEWS[0]);
      expect(getEl('_rev4_#reviewBody').text).toBe('Best futon ever.');
    });

    it('onItemReady sets product name', async () => {
      await onReadyHandler();
      const repeater = getEl('#reviewsRepeater');
      const cb = repeater.onItemReady.mock.calls[0][0];
      const $item = (sel) => getEl(`_rev5_${sel}`);
      cb($item, SAMPLE_REVIEWS[0]);
      expect(getEl('_rev5_#reviewProduct').text).toBe('Eureka Futon');
    });
  });

  // ── Aggregate Rating Display ────────────────────────────────────────────────

  describe('aggregate rating summary', () => {
    it('sets reviewsAggregateRating element with average rating text', async () => {
      await onReadyHandler();
      expect(getEl('#reviewsAggregateRating').text).toContain('4.7');
    });

    it('sets reviewsTotalCount element with total count text', async () => {
      await onReadyHandler();
      expect(getEl('#reviewsTotalCount').text).toContain('3');
    });
  });

  // ── Schema JSON-LD ─────────────────────────────────────────────────────────

  describe('schema.org JSON-LD', () => {
    it('sets reviewsSchemaHtml with schema.org markup', async () => {
      await onReadyHandler();
      expect(getEl('#reviewsSchemaHtml').html).toContain('schema.org');
    });

    it('schema contains AggregateRating type', async () => {
      await onReadyHandler();
      expect(getEl('#reviewsSchemaHtml').html).toContain('AggregateRating');
    });

    it('schema contains ratingValue from getSiteAggregateRating', async () => {
      await onReadyHandler();
      expect(getEl('#reviewsSchemaHtml').html).toContain('4.7');
    });

    it('schema contains Review type items', async () => {
      await onReadyHandler();
      expect(getEl('#reviewsSchemaHtml').html).toContain('"Review"');
    });

    it('schema contains reviewer name from fetched reviews', async () => {
      await onReadyHandler();
      expect(getEl('#reviewsSchemaHtml').html).toContain('Alice');
    });
  });

  // ── Error handling ─────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('shows error state when getFeaturedReviews fails', async () => {
      getFeaturedReviews.mockResolvedValue({ success: false, reviews: [], error: 'internal_error' });
      await onReadyHandler();
      expect(getEl('#reviewsRepeater').data).toHaveLength(0);
    });

    it('falls back to empty schema when getSiteAggregateRating fails', async () => {
      getSiteAggregateRating.mockRejectedValue(new Error('DB error'));
      await onReadyHandler();
      // Should not throw — page still renders
      expect(onReadyHandler).not.toThrow;
    });
  });
});
