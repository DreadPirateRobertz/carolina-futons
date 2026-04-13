/**
 * Tests for src/public/RatingsRollup.js — CF-356.
 * Aggregate star rating + review count widget for PDP.
 * Covers: collapse on missing state/error, zero-review fallback with CTA,
 * typical ratings, all-5, all-1, single review, star bar, average, count.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('public/StarRatingCard.js', () => ({
  generateStarString: vi.fn((avg) => `STARS(${avg})`),
}));

const { initRatingsRollup } = await import('../src/public/RatingsRollup.js');

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeEl() {
  return {
    text: '',
    _visible: true,
    show: vi.fn().mockImplementation(function () { this._visible = true; }),
    hide: vi.fn().mockImplementation(function () { this._visible = false; }),
    collapse: vi.fn(),
    expand: vi.fn(),
    onClick: vi.fn(),
  };
}

function make$w() {
  const els = {};
  const $w = vi.fn((id) => {
    if (!els[id]) els[id] = makeEl();
    return els[id];
  });
  $w._els = els;
  return $w;
}

function makeState(productOverrides = {}) {
  return {
    product: {
      _id: 'prod-001',
      ...productOverrides,
    },
  };
}

function makeRatingResult(overrides = {}) {
  return {
    average: 4.2,
    total: 8,
    breakdown: { 5: 4, 4: 2, 3: 1, 2: 1, 1: 0 },
    ...overrides,
  };
}

// ── Collapse paths ────────────────────────────────────────────────────────────

describe('initRatingsRollup — collapse paths', () => {
  let $w;

  beforeEach(() => { $w = make$w(); });

  it('collapses section when state is null', async () => {
    await initRatingsRollup($w, null);
    expect($w('#ratingsRollupSection').collapse).toHaveBeenCalled();
  });

  it('collapses section when product is missing', async () => {
    await initRatingsRollup($w, {});
    expect($w('#ratingsRollupSection').collapse).toHaveBeenCalled();
  });

  it('collapses section when product has no _id', async () => {
    await initRatingsRollup($w, { product: {} });
    expect($w('#ratingsRollupSection').collapse).toHaveBeenCalled();
  });

  it('collapses section when getAggregateRating throws', async () => {
    const getAggregateRating = vi.fn().mockRejectedValue(new Error('db error'));
    await initRatingsRollup($w, makeState(), { getAggregateRating });
    expect($w('#ratingsRollupSection').collapse).toHaveBeenCalled();
  });
});

// ── Zero-review state ─────────────────────────────────────────────────────────

describe('initRatingsRollup — zero reviews', () => {
  let $w;

  beforeEach(() => { $w = make$w(); });

  it('shows #ratingsNoReviews when total is 0', async () => {
    const getAggregateRating = vi.fn().mockResolvedValue(makeRatingResult({ average: 0, total: 0 }));
    await initRatingsRollup($w, makeState(), { getAggregateRating });
    expect($w('#ratingsNoReviews').show).toHaveBeenCalled();
  });

  it('hides #ratingsStarBar when total is 0', async () => {
    const getAggregateRating = vi.fn().mockResolvedValue(makeRatingResult({ average: 0, total: 0 }));
    await initRatingsRollup($w, makeState(), { getAggregateRating });
    expect($w('#ratingsStarBar').hide).toHaveBeenCalled();
  });

  it('hides #ratingsAverage when total is 0', async () => {
    const getAggregateRating = vi.fn().mockResolvedValue(makeRatingResult({ average: 0, total: 0 }));
    await initRatingsRollup($w, makeState(), { getAggregateRating });
    expect($w('#ratingsAverage').hide).toHaveBeenCalled();
  });

  it('still expands section for zero-review state (shows CTA)', async () => {
    const getAggregateRating = vi.fn().mockResolvedValue(makeRatingResult({ average: 0, total: 0 }));
    await initRatingsRollup($w, makeState(), { getAggregateRating });
    expect($w('#ratingsRollupSection').expand).toHaveBeenCalled();
  });
});

// ── Happy path ────────────────────────────────────────────────────────────────

describe('initRatingsRollup — happy path', () => {
  let $w;

  beforeEach(() => { $w = make$w(); });

  it('expands section when reviews are available', async () => {
    const getAggregateRating = vi.fn().mockResolvedValue(makeRatingResult());
    await initRatingsRollup($w, makeState(), { getAggregateRating });
    expect($w('#ratingsRollupSection').expand).toHaveBeenCalled();
  });

  it('passes productId to getAggregateRating', async () => {
    const getAggregateRating = vi.fn().mockResolvedValue(makeRatingResult());
    await initRatingsRollup($w, makeState({ _id: 'prod-xyz' }), { getAggregateRating });
    expect(getAggregateRating).toHaveBeenCalledWith('prod-xyz');
  });

  it('hides #ratingsNoReviews when reviews exist', async () => {
    const getAggregateRating = vi.fn().mockResolvedValue(makeRatingResult({ total: 5 }));
    await initRatingsRollup($w, makeState(), { getAggregateRating });
    expect($w('#ratingsNoReviews').hide).toHaveBeenCalled();
  });

  it('shows #ratingsStarBar when reviews exist', async () => {
    const getAggregateRating = vi.fn().mockResolvedValue(makeRatingResult({ total: 3 }));
    await initRatingsRollup($w, makeState(), { getAggregateRating });
    expect($w('#ratingsStarBar').show).toHaveBeenCalled();
  });

  it('shows #ratingsAverage when reviews exist', async () => {
    const getAggregateRating = vi.fn().mockResolvedValue(makeRatingResult({ total: 3 }));
    await initRatingsRollup($w, makeState(), { getAggregateRating });
    expect($w('#ratingsAverage').show).toHaveBeenCalled();
  });
});

// ── Rating display ────────────────────────────────────────────────────────────

describe('initRatingsRollup — rating display', () => {
  let $w;

  beforeEach(() => { $w = make$w(); });

  it('sets star bar text via generateStarString (typical rating)', async () => {
    const getAggregateRating = vi.fn().mockResolvedValue(makeRatingResult({ average: 3.7, total: 12 }));
    await initRatingsRollup($w, makeState(), { getAggregateRating });
    expect($w('#ratingsStarBar').text).toBe('STARS(3.7)');
  });

  it('sets star bar text for all-5 rating', async () => {
    const getAggregateRating = vi.fn().mockResolvedValue(makeRatingResult({ average: 5, total: 4 }));
    await initRatingsRollup($w, makeState(), { getAggregateRating });
    expect($w('#ratingsStarBar').text).toBe('STARS(5)');
  });

  it('sets star bar text for all-1 rating', async () => {
    const getAggregateRating = vi.fn().mockResolvedValue(makeRatingResult({ average: 1, total: 2 }));
    await initRatingsRollup($w, makeState(), { getAggregateRating });
    expect($w('#ratingsStarBar').text).toBe('STARS(1)');
  });

  it('sets numeric average text', async () => {
    const getAggregateRating = vi.fn().mockResolvedValue(makeRatingResult({ average: 4.2, total: 8 }));
    await initRatingsRollup($w, makeState(), { getAggregateRating });
    expect($w('#ratingsAverage').text).toBe('4.2');
  });

  it('sets plural count text', async () => {
    const getAggregateRating = vi.fn().mockResolvedValue(makeRatingResult({ average: 4.2, total: 8 }));
    await initRatingsRollup($w, makeState(), { getAggregateRating });
    expect($w('#ratingsCount').text).toBe('(8 reviews)');
  });

  it('sets singular count text for 1 review', async () => {
    const getAggregateRating = vi.fn().mockResolvedValue(makeRatingResult({ average: 4.0, total: 1 }));
    await initRatingsRollup($w, makeState(), { getAggregateRating });
    expect($w('#ratingsCount').text).toBe('(1 review)');
  });

  it('rounds average to 1 decimal place', async () => {
    const getAggregateRating = vi.fn().mockResolvedValue(makeRatingResult({ average: 4.25, total: 2 }));
    await initRatingsRollup($w, makeState(), { getAggregateRating });
    expect($w('#ratingsAverage').text).toBe('4.3');
  });

  it('treats missing average field as 0', async () => {
    const getAggregateRating = vi.fn().mockResolvedValue({ total: 3, breakdown: {} });
    await initRatingsRollup($w, makeState(), { getAggregateRating });
    expect($w('#ratingsAverage').text).toBe('0');
  });
});

// ── Error path exclusivity ────────────────────────────────────────────────────

describe('initRatingsRollup — error path exclusivity', () => {
  let $w;

  beforeEach(() => { $w = make$w(); });

  it('does not expand section when getAggregateRating throws', async () => {
    const getAggregateRating = vi.fn().mockRejectedValue(new Error('fail'));
    await initRatingsRollup($w, makeState(), { getAggregateRating });
    expect($w('#ratingsRollupSection').expand).not.toHaveBeenCalled();
  });

  it('shows zero-review CTA when getAggregateRating returns null', async () => {
    const getAggregateRating = vi.fn().mockResolvedValue(null);
    await initRatingsRollup($w, makeState(), { getAggregateRating });
    expect($w('#ratingsNoReviews').show).toHaveBeenCalled();
    expect($w('#ratingsRollupSection').expand).toHaveBeenCalled();
  });
});
