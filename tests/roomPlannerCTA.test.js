/**
 * Tests for CF-uits: Room Planner S6 — Product Page CTA integration.
 * Covers: buildPlannerUrl, parsePlannerParams, shouldShowPlannerCTA,
 * initRoomPlannerCTA.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PLANNER_PATH,
  buildPlannerUrl,
  parsePlannerParams,
  shouldShowPlannerCTA,
  initRoomPlannerCTA,
} from '../src/public/roomPlannerCTA.js';

function makeProduct(overrides = {}) {
  return { _id: 'prod-1', name: 'Full Futon Frame', width: 82, depth: 38, ...overrides };
}

function make$w() {
  const map = new Map();
  return (sel) => {
    if (!map.has(sel)) {
      map.set(sel, {
        onClick: vi.fn(),
        collapse: vi.fn(),
        expand: vi.fn(),
      });
    }
    return map.get(sel);
  };
}

// ── buildPlannerUrl ────────────────────────────────────────────────────

describe('buildPlannerUrl', () => {
  it('returns base path for null product', () => {
    expect(buildPlannerUrl(null)).toBe(PLANNER_PATH);
  });

  it('returns base path for product without _id', () => {
    expect(buildPlannerUrl({ name: 'Futon' })).toBe(PLANNER_PATH);
  });

  it('includes productId in URL', () => {
    const url = buildPlannerUrl(makeProduct());
    expect(url).toContain('productId=prod-1');
  });

  it('includes productName in URL', () => {
    const url = buildPlannerUrl(makeProduct());
    expect(url).toContain('productName=Full+Futon+Frame');
  });

  it('includes width and depth in URL', () => {
    const url = buildPlannerUrl(makeProduct({ width: 82, depth: 38 }));
    expect(url).toContain('width=82');
    expect(url).toContain('depth=38');
  });

  it('prefers plannerWidth/plannerDepth over width/depth', () => {
    const url = buildPlannerUrl(makeProduct({ width: 82, depth: 38, plannerWidth: 80, plannerDepth: 36 }));
    expect(url).toContain('width=80');
    expect(url).toContain('depth=36');
  });

  it('omits width/depth when both are absent', () => {
    const product = { _id: 'p1', name: 'Test' };
    const url = buildPlannerUrl(product);
    expect(url).not.toContain('width=');
    expect(url).not.toContain('depth=');
  });

  it('rounds fractional dimensions', () => {
    const url = buildPlannerUrl(makeProduct({ width: 82.7, depth: 37.3 }));
    expect(url).toContain('width=83');
    expect(url).toContain('depth=37');
  });

  it('uses custom baseUrl', () => {
    const url = buildPlannerUrl(makeProduct(), '/my-planner');
    expect(url).toContain('/my-planner?');
  });

  it('returns a URL starting with base path', () => {
    const url = buildPlannerUrl(makeProduct());
    expect(url.startsWith(PLANNER_PATH + '?')).toBe(true);
  });
});

// ── parsePlannerParams ─────────────────────────────────────────────────

describe('parsePlannerParams', () => {
  it('parses all params from a buildPlannerUrl output', () => {
    const url = buildPlannerUrl(makeProduct());
    const search = '?' + url.split('?')[1];
    const result = parsePlannerParams(search);
    expect(result.productId).toBe('prod-1');
    expect(result.productName).toBe('Full Futon Frame');
    expect(result.width).toBe(82);
    expect(result.depth).toBe(38);
  });

  it('returns null fields for empty search', () => {
    const result = parsePlannerParams('');
    expect(result.productId).toBeNull();
    expect(result.productName).toBeNull();
    expect(result.width).toBeNull();
    expect(result.depth).toBeNull();
  });

  it('returns null width/depth when not in URL', () => {
    const result = parsePlannerParams('?productId=p1');
    expect(result.width).toBeNull();
    expect(result.depth).toBeNull();
  });

  it('converts width/depth to numbers', () => {
    const result = parsePlannerParams('?productId=p1&width=82&depth=38');
    expect(typeof result.width).toBe('number');
    expect(typeof result.depth).toBe('number');
  });

  it('handles malformed search gracefully', () => {
    const result = parsePlannerParams('not-a-search');
    expect(result.productId).toBeNull();
  });
});

// ── shouldShowPlannerCTA ───────────────────────────────────────────────

describe('shouldShowPlannerCTA', () => {
  it('returns true when product has width and depth', () => {
    expect(shouldShowPlannerCTA(makeProduct())).toBe(true);
  });

  it('returns true when product has plannerWidth/plannerDepth', () => {
    expect(shouldShowPlannerCTA({ _id: 'p1', plannerWidth: 80, plannerDepth: 36 })).toBe(true);
  });

  it('returns false when product is null', () => {
    expect(shouldShowPlannerCTA(null)).toBe(false);
  });

  it('returns false when product has no _id', () => {
    expect(shouldShowPlannerCTA({ width: 82, depth: 38 })).toBe(false);
  });

  it('returns false when width is null', () => {
    expect(shouldShowPlannerCTA({ _id: 'p1', depth: 38 })).toBe(false);
  });

  it('returns false when depth is null', () => {
    expect(shouldShowPlannerCTA({ _id: 'p1', width: 82 })).toBe(false);
  });

  it('returns false when width is zero', () => {
    expect(shouldShowPlannerCTA({ _id: 'p1', width: 0, depth: 38 })).toBe(false);
  });

  it('returns false when depth is zero', () => {
    expect(shouldShowPlannerCTA({ _id: 'p1', width: 82, depth: 0 })).toBe(false);
  });
});

// ── initRoomPlannerCTA ─────────────────────────────────────────────────

describe('initRoomPlannerCTA', () => {
  let $w;

  beforeEach(() => {
    vi.clearAllMocks();
    $w = make$w();
  });

  it('collapses #plannerCTASection when product is null', () => {
    initRoomPlannerCTA($w, { product: null });
    expect($w('#plannerCTASection').collapse).toHaveBeenCalled();
  });

  it('collapses #plannerCTASection when state is empty', () => {
    initRoomPlannerCTA($w, {});
    expect($w('#plannerCTASection').collapse).toHaveBeenCalled();
  });

  it('collapses #plannerCTASection when product lacks dimensions', () => {
    initRoomPlannerCTA($w, { product: { _id: 'p1', name: 'Mystery Product' } });
    expect($w('#plannerCTASection').collapse).toHaveBeenCalled();
  });

  it('expands #plannerCTASection when product has dimensions', () => {
    initRoomPlannerCTA($w, { product: makeProduct() });
    expect($w('#plannerCTASection').expand).toHaveBeenCalled();
  });

  it('does not expand when product has zero dimensions', () => {
    initRoomPlannerCTA($w, { product: makeProduct({ width: 0, depth: 0 }) });
    expect($w('#plannerCTASection').expand).not.toHaveBeenCalled();
    expect($w('#plannerCTASection').collapse).toHaveBeenCalled();
  });

  it('wires #plannerCTA onClick when product has dimensions', () => {
    initRoomPlannerCTA($w, { product: makeProduct() });
    expect($w('#plannerCTA').onClick).toHaveBeenCalled();
  });

  it('does not wire #plannerCTA onClick when product lacks dimensions', () => {
    initRoomPlannerCTA($w, { product: { _id: 'p1' } });
    expect($w('#plannerCTA').onClick).not.toHaveBeenCalled();
  });

  it('does not crash when #plannerCTA throws', () => {
    const badEl = { onClick: () => { throw new Error('missing'); }, collapse: vi.fn(), expand: vi.fn() };
    const $wBad = (sel) => {
      if (sel === '#plannerCTA') return badEl;
      return { onClick: vi.fn(), collapse: vi.fn(), expand: vi.fn() };
    };
    expect(() => initRoomPlannerCTA($wBad, { product: makeProduct() })).not.toThrow();
  });
});
