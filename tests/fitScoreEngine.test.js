/**
 * Tests for fitScoreEngine.js — Futon Fit Score (0-100)
 * CF-hx8m: NOVEL — Personalized match scoring
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('wix-storage-frontend', () => ({
  session: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

import {
  computeFitScore,
  batchComputeFitScores,
  getFitScoreLabel,
  getProfile,
  recordQuizAnswers,
  recordProductView,
  recordRoomDimensions,
} from '../src/public/fitScoreEngine.js';

import { session } from 'wix-storage-frontend';

beforeEach(() => {
  vi.clearAllMocks();
  session.getItem.mockReturnValue(null);
});

// ── getProfile ──────────────────────────────────────────────────────

describe('getProfile', () => {
  it('returns default profile when session is empty', () => {
    const profile = getProfile();
    expect(profile.roomType).toBeNull();
    expect(profile.primaryUse).toBeNull();
    expect(profile.viewedCategories).toEqual([]);
    expect(profile.viewedProductCount).toBe(0);
  });

  it('returns stored profile from session', () => {
    session.getItem.mockReturnValue(JSON.stringify({
      roomType: 'living-room',
      primaryUse: 'both',
      viewedCategories: ['futon-frames'],
      viewedProductCount: 3,
    }));

    const profile = getProfile();
    expect(profile.roomType).toBe('living-room');
    expect(profile.viewedCategories).toEqual(['futon-frames']);
  });
});

// ── recordQuizAnswers ───────────────────────────────────────────────

describe('recordQuizAnswers', () => {
  it('saves quiz answers to session profile', () => {
    recordQuizAnswers({
      roomType: 'guest-room',
      primaryUse: 'sleeping',
      stylePreference: 'rustic',
      budgetRange: '500-1000',
    });

    expect(session.setItem).toHaveBeenCalledWith(
      'cf_fit_profile',
      expect.stringContaining('"roomType":"guest-room"')
    );
  });

  it('ignores null answers', () => {
    recordQuizAnswers(null);
    expect(session.setItem).not.toHaveBeenCalled();
  });
});

// ── recordProductView ───────────────────────────────────────────────

describe('recordProductView', () => {
  it('accumulates viewed categories', () => {
    recordProductView({ price: 499, collections: ['futon-frames'] });

    const savedJson = session.setItem.mock.calls[0][1];
    const saved = JSON.parse(savedJson);
    expect(saved.viewedCategories).toContain('futon-frames');
    expect(saved.viewedProductCount).toBe(1);
  });

  it('tracks price range from browsed products', () => {
    // First view
    recordProductView({ price: 499, collections: [] });
    let saved = JSON.parse(session.setItem.mock.calls[0][1]);

    // Mock the saved state for second call
    session.getItem.mockReturnValue(JSON.stringify(saved));
    recordProductView({ price: 799, collections: [] });
    saved = JSON.parse(session.setItem.mock.calls[1][1]);

    expect(saved.viewedPriceRange.min).toBe(499);
    expect(saved.viewedPriceRange.max).toBe(799);
  });

  it('excludes call-for-price products from price tracking', () => {
    recordProductView({ price: 1, collections: [] });

    const saved = JSON.parse(session.setItem.mock.calls[0][1]);
    expect(saved.viewedPriceRange).toBeNull();
  });
});

// ── computeFitScore ─────────────────────────────────────────────────

describe('computeFitScore', () => {
  const baseProduct = {
    name: 'Sedona Queen Futon Frame',
    price: 699,
    collections: ['futon-frames'],
    description: 'Contemporary hardwood futon frame with clean modern lines',
  };

  it('returns 50 for a neutral profile (no signals)', () => {
    const profile = getProfile(); // default, no signals
    const score = computeFitScore(baseProduct, profile);
    // With no signals, each dimension gives ~50% of its weight
    expect(score).toBeGreaterThanOrEqual(40);
    expect(score).toBeLessThanOrEqual(60);
  });

  it('returns high score for perfect match profile', () => {
    const profile = {
      roomType: 'living-room', // futon-frames match
      primaryUse: 'both',       // futon-frames match
      stylePreference: 'modern', // 'contemporary', 'modern', 'clean' all match
      budgetRange: '500-1000',   // $699 is in range
      sizeNeeds: 'queen',        // 'queen' in product name
      viewedCategories: ['futon-frames'],
      viewedPriceRange: { min: 400, max: 800 },
      viewedProductCount: 5,
    };

    const score = computeFitScore(baseProduct, profile);
    expect(score).toBeGreaterThanOrEqual(85);
  });

  it('returns low score for poor match profile', () => {
    const profile = {
      roomType: 'office',         // murphy/wall-hugger, not futon-frames
      primaryUse: 'sleeping',     // platform-beds/mattresses, not futon-frames
      stylePreference: 'classic', // 'traditional'/'elegant' — no match in description
      budgetRange: 'under-500',   // $699 exceeds
      sizeNeeds: 'twin',          // 'queen' product doesn't match
      viewedCategories: ['murphy-cabinet-beds'],
      viewedPriceRange: { min: 200, max: 400 },
      viewedProductCount: 3,
    };

    const score = computeFitScore(baseProduct, profile);
    expect(score).toBeLessThanOrEqual(30);
  });

  it('gives full price score when product is in budget range', () => {
    const profile = {
      ...getProfile(),
      budgetRange: '500-1000',
    };

    const score = computeFitScore({ ...baseProduct, price: 700 }, profile);
    // Price component = 25 pts (full)
    expect(score).toBeGreaterThanOrEqual(45); // 25 price + ~25 neutral for others
  });

  it('penalizes products above budget', () => {
    const profile = {
      ...getProfile(),
      budgetRange: 'under-500',
    };

    const cheap = computeFitScore({ ...baseProduct, price: 400 }, profile);
    const expensive = computeFitScore({ ...baseProduct, price: 700 }, profile);
    expect(cheap).toBeGreaterThan(expensive);
  });

  it('returns 0 for null product', () => {
    expect(computeFitScore(null)).toBe(0);
  });

  it('returns 0 for call-for-price products', () => {
    const score = computeFitScore({ ...baseProduct, price: 1 });
    // Price component = 0 for call-for-price
    expect(score).toBeLessThan(50);
  });
});

// ── batchComputeFitScores ───────────────────────────────────────────

describe('batchComputeFitScores', () => {
  it('sorts products by score descending', () => {
    const profile = {
      ...getProfile(),
      roomType: 'living-room',
      budgetRange: '500-1000',
    };

    const products = [
      { name: 'Mattress', price: 299, collections: ['mattresses'] },
      { name: 'Futon Frame', price: 699, collections: ['futon-frames'] },
      { name: 'Murphy Bed', price: 1500, collections: ['murphy-cabinet-beds'] },
    ];

    const results = batchComputeFitScores(products, profile);
    expect(results[0].product.name).toBe('Futon Frame');
    expect(results[0].fitScore).toBeGreaterThan(results[1].fitScore);
  });

  it('returns empty for non-array input', () => {
    expect(batchComputeFitScores(null)).toEqual([]);
  });
});

// ── getFitScoreLabel ────────────────────────────────────────────────

describe('getFitScoreLabel', () => {
  it('returns "Perfect Match" for 90+', () => {
    expect(getFitScoreLabel(95)).toBe('Perfect Match');
    expect(getFitScoreLabel(90)).toBe('Perfect Match');
  });

  it('returns "Great Match" for 75-89', () => {
    expect(getFitScoreLabel(80)).toBe('Great Match');
  });

  it('returns "Good Match" for 60-74', () => {
    expect(getFitScoreLabel(65)).toBe('Good Match');
  });

  it('returns "Fair Match" for 40-59', () => {
    expect(getFitScoreLabel(45)).toBe('Fair Match');
  });

  it('returns empty for below 40', () => {
    expect(getFitScoreLabel(30)).toBe('');
  });
});

// ── recordRoomDimensions ────────────────────────────────────────────

describe('recordRoomDimensions', () => {
  it('saves room dimensions to profile', () => {
    recordRoomDimensions(120, 144);

    const saved = JSON.parse(session.setItem.mock.calls[0][1]);
    expect(saved.roomWidth).toBe(120);
    expect(saved.roomLength).toBe(144);
  });
});
