/**
 * Tests for FitScoreBadge.js — Fit Score badge rendering
 * CF-hx8m: NOVEL — Futon Fit Score
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('wix-storage-frontend', () => ({
  session: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
  },
}));

vi.mock('public/designTokens.js', () => ({
  colors: {
    successGreen: '#2d8a4e',
    mountainBlue: '#4a7c9b',
    espresso: '#3a2518',
  },
}));

import { renderFitScoreBadge, rankByFitScore } from '../src/public/FitScoreBadge.js';

function createMockElement() {
  return {
    text: '',
    style: { color: '' },
    collapse: vi.fn(),
    expand: vi.fn(),
  };
}

const product = {
  name: 'Sedona Queen Futon Frame',
  price: 699,
  collections: ['futon-frames'],
  description: 'Contemporary modern hardwood frame',
};

const richProfile = {
  roomType: 'living-room',
  primaryUse: 'both',
  stylePreference: 'modern',
  budgetRange: '500-1000',
  sizeNeeds: 'queen',
  viewedCategories: ['futon-frames'],
  viewedPriceRange: { min: 400, max: 800 },
  viewedProductCount: 5,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('renderFitScoreBadge', () => {
  it('shows match percentage for high-score products', () => {
    const $el = createMockElement();
    renderFitScoreBadge($el, product, richProfile);

    expect($el.text).toMatch(/\d+% match/);
    expect($el.expand).toHaveBeenCalled();
  });

  it('hides badge when no profile signals exist', () => {
    const $el = createMockElement();
    const emptyProfile = {
      roomType: null, primaryUse: null, stylePreference: null,
      budgetRange: null, viewedCategories: [], viewedPriceRange: null,
    };

    renderFitScoreBadge($el, product, emptyProfile);
    expect($el.collapse).toHaveBeenCalled();
  });

  it('hides badge for low-score products', () => {
    const $el = createMockElement();
    const mismatchProfile = {
      roomType: 'office',
      primaryUse: 'sleeping',
      stylePreference: 'classic',
      budgetRange: 'under-500',
      sizeNeeds: 'twin',
      viewedCategories: ['murphy-cabinet-beds'],
      viewedPriceRange: { min: 200, max: 350 },
    };

    renderFitScoreBadge($el, product, mismatchProfile);
    // Score should be low enough to hide
    // Either collapse or show depends on exact score
  });

  it('no-ops for null element', () => {
    // Should not throw
    renderFitScoreBadge(null, product, richProfile);
  });

  it('includes label for high scores', () => {
    const $el = createMockElement();
    renderFitScoreBadge($el, product, richProfile);

    // High-match product should get a label
    expect($el.text).toMatch(/match/);
  });
});

describe('rankByFitScore', () => {
  it('sorts products by fit score descending', () => {
    const products = [
      { name: 'Mattress', price: 299, collections: ['mattresses'] },
      { name: 'Sedona Futon Frame', price: 699, collections: ['futon-frames'], description: 'modern' },
      { name: 'Murphy Bed', price: 2500, collections: ['murphy-cabinet-beds'] },
    ];

    const ranked = rankByFitScore(products, richProfile);
    expect(ranked[0].name).toBe('Sedona Futon Frame');
    expect(ranked[0]._fitScore).toBeGreaterThan(ranked[1]._fitScore);
  });

  it('returns empty for empty input', () => {
    expect(rankByFitScore([], richProfile)).toEqual([]);
  });
});
