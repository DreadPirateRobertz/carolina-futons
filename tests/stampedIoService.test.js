/**
 * Tests for stampedIoService.web.js — Stamped.io review integration
 * CF-gxn1: Epic 2A — Stamped.io review widget
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('wix-secrets-backend', () => ({
  getSecret: vi.fn((key) => {
    const secrets = {
      STAMPED_API_KEY: 'test-api-key',
      STAMPED_API_SECRET: 'test-api-secret',
      STAMPED_STORE_HASH: 'test-store-hash',
    };
    return Promise.resolve(secrets[key] || '');
  }),
}));

const mockFetch = vi.fn();
vi.mock('wix-fetch', () => ({
  fetch: (...args) => mockFetch(...args),
}));

import {
  getStampedRating,
  getStampedReviews,
  getBatchStampedRatings,
  getStampedWidgetConfig,
  _resetCache,
} from '../src/backend/stampedIoService.web.js';

// ── Setup ────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  _resetCache();
  mockFetch.mockReset();
});

// ── getStampedRating ─────────────────────────────────────────────────

describe('getStampedRating', () => {
  it('fetches rating summary from Stamped.io API', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ rating: 4.5, total: 23, distribution: { 5: 15, 4: 5, 3: 2, 2: 1 } }),
    });

    const result = await getStampedRating('prod-123');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('test-store-hash/reviews/summary'),
      expect.any(Object)
    );
    expect(result.average).toBe(4.5);
    expect(result.total).toBe(23);
  });

  it('returns zeros for invalid product ID', async () => {
    const result = await getStampedRating('');
    expect(result).toEqual({ average: 0, total: 0, distribution: {} });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('caches results for subsequent calls', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ rating: 4.0, total: 10, distribution: {} }),
    });

    await getStampedRating('prod-123');
    await getStampedRating('prod-123');

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('returns zeros on API error', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' });

    const result = await getStampedRating('prod-123');
    expect(result).toEqual({ average: 0, total: 0, distribution: {} });
  });
});

// ── getStampedReviews ────────────────────────────────────────────────

describe('getStampedReviews', () => {
  it('fetches and maps review data', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [
          {
            id: 'r1', author: 'Jane', reviewRating: 5,
            reviewTitle: 'Great!', reviewMessage: 'Love it',
            dateCreated: '2026-03-01', isVerifiedBuyer: true,
            reviewPhotos: [{ url: '/photo1.jpg' }], reviewVotesUp: 3,
          },
        ],
        total: 1,
        page: 1,
      }),
    });

    const result = await getStampedReviews('prod-123');

    expect(result.reviews).toHaveLength(1);
    expect(result.reviews[0]).toEqual({
      _id: 'r1',
      author: 'Jane',
      rating: 5,
      title: 'Great!',
      body: 'Love it',
      date: '2026-03-01',
      verifiedPurchase: true,
      photos: ['/photo1.jpg'],
      helpful: 3,
    });
    expect(result.total).toBe(1);
  });

  it('returns empty for invalid product ID', async () => {
    const result = await getStampedReviews(null);
    expect(result).toEqual({ reviews: [], total: 0, page: 1 });
  });

  it('handles API failure gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const result = await getStampedReviews('prod-123');
    expect(result).toEqual({ reviews: [], total: 0, page: 1 });
  });
});

// ── getBatchStampedRatings ───────────────────────────────────────────

describe('getBatchStampedRatings', () => {
  it('fetches ratings for multiple products', async () => {
    let callCount = 0;
    mockFetch.mockImplementation(() => {
      callCount++;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ rating: 4.0 + callCount * 0.1, total: callCount * 5 }),
      });
    });

    const result = await getBatchStampedRatings(['prod-1', 'prod-2']);

    expect(Object.keys(result)).toHaveLength(2);
    expect(result['prod-1'].total).toBeGreaterThan(0);
    expect(result['prod-2'].total).toBeGreaterThan(0);
  });

  it('returns empty object for empty array', async () => {
    const result = await getBatchStampedRatings([]);
    expect(result).toEqual({});
  });

  it('limits to 50 products', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ rating: 4.0, total: 5 }),
    });

    const ids = Array.from({ length: 60 }, (_, i) => `prod-${i}`);
    await getBatchStampedRatings(ids);

    // Max 50 products, fetched in batches of 5
    expect(mockFetch).toHaveBeenCalledTimes(50);
  });
});

// ── getStampedWidgetConfig ───────────────────────────────────────────

describe('getStampedWidgetConfig', () => {
  it('returns public config for client-side widget', async () => {
    const config = await getStampedWidgetConfig();

    expect(config.storeHash).toBe('test-store-hash');
    expect(config.apiKey).toBe('test-api-key');
  });
});
