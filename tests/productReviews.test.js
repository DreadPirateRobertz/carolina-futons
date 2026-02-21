import { describe, it, expect, vi } from 'vitest';
import { initProductReviews } from '../src/public/ProductReviews.js';
import { futonFrame } from './fixtures/products.js';

function createMockElement() {
  return {
    text: '', collapse: vi.fn(), expand: vi.fn(),
    show: vi.fn(() => Promise.resolve()), hide: vi.fn(() => Promise.resolve()),
  };
}

function create$w() {
  const els = new Map();
  return (sel) => { if (!els.has(sel)) els.set(sel, createMockElement()); return els.get(sel); };
}

describe('ProductReviews', () => {
  it('collapses reviews section (stub)', () => {
    const $w = create$w();
    const state = { product: { ...futonFrame } };
    initProductReviews($w, state);
    expect($w('#reviewsSection').collapse).toHaveBeenCalled();
  });

  it('handles missing reviews section gracefully', () => {
    const $w = () => null;
    const state = { product: { ...futonFrame } };
    expect(() => initProductReviews($w, state)).not.toThrow();
  });
});
