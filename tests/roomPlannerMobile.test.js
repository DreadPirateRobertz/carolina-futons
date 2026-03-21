/**
 * Tests for CF-7f32: Room Planner S7 — Mobile experience.
 * Covers: isMobileViewport, getPinchState, computePinchScale,
 * touchToCanvasCoords, getMobileUIConfig, initMobileRoomPlanner.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MOBILE_BREAKPOINT,
  MIN_PINCH_SCALE,
  MAX_PINCH_SCALE,
  MIN_PINCH_DISTANCE,
  isMobileViewport,
  getPinchState,
  computePinchScale,
  touchToCanvasCoords,
  getMobileUIConfig,
  initMobileRoomPlanner,
} from '../src/public/roomPlannerMobile.js';

function make$w() {
  const map = new Map();
  return (sel) => {
    if (!map.has(sel)) {
      map.set(sel, {
        collapse: vi.fn(),
        expand: vi.fn(),
        postMessage: vi.fn(),
      });
    }
    return map.get(sel);
  };
}

// ── Constants ──────────────────────────────────────────────────────────

describe('constants', () => {
  it('MOBILE_BREAKPOINT is 768', () => {
    expect(MOBILE_BREAKPOINT).toBe(768);
  });

  it('MIN_PINCH_SCALE is 0.5', () => {
    expect(MIN_PINCH_SCALE).toBe(0.5);
  });

  it('MAX_PINCH_SCALE is 4.0', () => {
    expect(MAX_PINCH_SCALE).toBe(4.0);
  });

  it('MIN_PINCH_DISTANCE is positive', () => {
    expect(MIN_PINCH_DISTANCE).toBeGreaterThan(0);
  });
});

// ── isMobileViewport ───────────────────────────────────────────────────

describe('isMobileViewport', () => {
  it('returns true for width exactly at breakpoint', () => {
    expect(isMobileViewport(768)).toBe(true);
  });

  it('returns true for width below breakpoint', () => {
    expect(isMobileViewport(375)).toBe(true);
  });

  it('returns false for width above breakpoint', () => {
    expect(isMobileViewport(1024)).toBe(false);
  });

  it('returns false for width just above breakpoint', () => {
    expect(isMobileViewport(769)).toBe(false);
  });

  it('returns false for very large viewport', () => {
    expect(isMobileViewport(1920)).toBe(false);
  });

  it('returns true for zero width (0 <= MOBILE_BREAKPOINT)', () => {
    expect(isMobileViewport(0)).toBe(true);
  });

  it('returns false for non-number', () => {
    expect(isMobileViewport('375')).toBe(false);
  });
});

// ── getPinchState ──────────────────────────────────────────────────────

describe('getPinchState', () => {
  it('returns null for null touches', () => {
    expect(getPinchState(null)).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(getPinchState([])).toBeNull();
  });

  it('returns null for single touch', () => {
    expect(getPinchState([{ clientX: 10, clientY: 10 }])).toBeNull();
  });

  it('returns center point for two horizontal touches', () => {
    const state = getPinchState([
      { clientX: 100, clientY: 200 },
      { clientX: 200, clientY: 200 },
    ]);
    expect(state.centerX).toBe(150);
    expect(state.centerY).toBe(200);
  });

  it('returns correct distance for two horizontal touches', () => {
    const state = getPinchState([
      { clientX: 100, clientY: 200 },
      { clientX: 200, clientY: 200 },
    ]);
    expect(state.distance).toBe(100);
  });

  it('returns correct distance for diagonal touches', () => {
    const state = getPinchState([
      { clientX: 0, clientY: 0 },
      { clientX: 30, clientY: 40 },
    ]);
    expect(state.distance).toBe(50); // 3-4-5 triangle scaled
  });

  it('returns center point for diagonal touches', () => {
    const state = getPinchState([
      { clientX: 0, clientY: 0 },
      { clientX: 60, clientY: 80 },
    ]);
    expect(state.centerX).toBe(30);
    expect(state.centerY).toBe(40);
  });

  it('includes distance in result', () => {
    const state = getPinchState([
      { clientX: 0, clientY: 0 },
      { clientX: 100, clientY: 0 },
    ]);
    expect(state).toHaveProperty('distance');
  });

  it('works with three or more touches (uses first two)', () => {
    const state = getPinchState([
      { clientX: 0, clientY: 0 },
      { clientX: 100, clientY: 0 },
      { clientX: 200, clientY: 200 },
    ]);
    expect(state).not.toBeNull();
    expect(state.distance).toBe(100);
  });
});

// ── computePinchScale ──────────────────────────────────────────────────

describe('computePinchScale', () => {
  it('returns baseScale when start and current are equal', () => {
    expect(computePinchScale(100, 100, 1.0)).toBe(1.0);
  });

  it('scales up when pinch widens', () => {
    expect(computePinchScale(100, 200, 1.0)).toBe(2.0);
  });

  it('scales down when pinch narrows', () => {
    expect(computePinchScale(200, 100, 2.0)).toBe(1.0);
  });

  it('clamps to MAX_PINCH_SCALE', () => {
    expect(computePinchScale(10, 10000, 1.0)).toBe(MAX_PINCH_SCALE);
  });

  it('clamps to MIN_PINCH_SCALE', () => {
    expect(computePinchScale(10000, 1, 1.0)).toBe(MIN_PINCH_SCALE);
  });

  it('returns baseScale when startDistance is zero', () => {
    expect(computePinchScale(0, 100, 1.5)).toBe(1.5);
  });

  it('returns baseScale when currentDistance is zero', () => {
    expect(computePinchScale(100, 0, 1.5)).toBe(1.5);
  });

  it('scales proportionally with baseScale', () => {
    // 100→150 = 1.5× ratio; base 2.0 → 3.0
    expect(computePinchScale(100, 150, 2.0)).toBeCloseTo(3.0);
  });
});

// ── touchToCanvasCoords ────────────────────────────────────────────────

describe('touchToCanvasCoords', () => {
  it('returns canvas-relative coordinates', () => {
    const coords = touchToCanvasCoords(
      { clientX: 150, clientY: 250 },
      { left: 50, top: 100 },
    );
    expect(coords.x).toBe(100);
    expect(coords.y).toBe(150);
  });

  it('returns zero when touch equals canvas origin', () => {
    const coords = touchToCanvasCoords(
      { clientX: 50, clientY: 100 },
      { left: 50, top: 100 },
    );
    expect(coords.x).toBe(0);
    expect(coords.y).toBe(0);
  });

  it('can produce negative values when touch is outside canvas', () => {
    const coords = touchToCanvasCoords(
      { clientX: 10, clientY: 10 },
      { left: 50, top: 100 },
    );
    expect(coords.x).toBeLessThan(0);
    expect(coords.y).toBeLessThan(0);
  });
});

// ── getMobileUIConfig ──────────────────────────────────────────────────

describe('getMobileUIConfig', () => {
  it('collapses desktop sections on mobile', () => {
    const config = getMobileUIConfig(true);
    expect(config.collapseIds).toContain('#plannerInstructionsSection');
    expect(config.collapseIds).toContain('#roomPresetsSection');
    expect(config.collapseIds).toContain('#productPaletteSection');
  });

  it('expands mobile controls on mobile', () => {
    const config = getMobileUIConfig(true);
    expect(config.expandIds).toContain('#mobilePlannerControls');
  });

  it('collapses mobile controls on desktop', () => {
    const config = getMobileUIConfig(false);
    expect(config.collapseIds).toContain('#mobilePlannerControls');
  });

  it('expands desktop sections on desktop', () => {
    const config = getMobileUIConfig(false);
    expect(config.expandIds).toContain('#plannerInstructionsSection');
    expect(config.expandIds).toContain('#roomPresetsSection');
    expect(config.expandIds).toContain('#productPaletteSection');
  });

  it('mobile config has no overlap between collapse and expand ids', () => {
    const config = getMobileUIConfig(true);
    const overlap = config.collapseIds.filter((id) => config.expandIds.includes(id));
    expect(overlap).toHaveLength(0);
  });

  it('desktop config has no overlap between collapse and expand ids', () => {
    const config = getMobileUIConfig(false);
    const overlap = config.collapseIds.filter((id) => config.expandIds.includes(id));
    expect(overlap).toHaveLength(0);
  });
});

// ── initMobileRoomPlanner ──────────────────────────────────────────────

describe('initMobileRoomPlanner', () => {
  let $w;

  beforeEach(() => {
    vi.clearAllMocks();
    $w = make$w();
  });

  it('collapses desktop sections on mobile viewport', () => {
    initMobileRoomPlanner($w, { viewportWidth: 375 });
    expect($w('#plannerInstructionsSection').collapse).toHaveBeenCalled();
    expect($w('#roomPresetsSection').collapse).toHaveBeenCalled();
    expect($w('#productPaletteSection').collapse).toHaveBeenCalled();
  });

  it('expands mobile controls on mobile viewport', () => {
    initMobileRoomPlanner($w, { viewportWidth: 375 });
    expect($w('#mobilePlannerControls').expand).toHaveBeenCalled();
  });

  it('does not expand desktop sections on mobile', () => {
    initMobileRoomPlanner($w, { viewportWidth: 375 });
    expect($w('#plannerInstructionsSection').expand).not.toHaveBeenCalled();
  });

  it('collapses mobile controls on desktop viewport', () => {
    initMobileRoomPlanner($w, { viewportWidth: 1024 });
    expect($w('#mobilePlannerControls').collapse).toHaveBeenCalled();
  });

  it('expands desktop sections on desktop viewport', () => {
    initMobileRoomPlanner($w, { viewportWidth: 1024 });
    expect($w('#plannerInstructionsSection').expand).toHaveBeenCalled();
    expect($w('#roomPresetsSection').expand).toHaveBeenCalled();
    expect($w('#productPaletteSection').expand).toHaveBeenCalled();
  });

  it('sends setMobileMode true to canvas on mobile', () => {
    initMobileRoomPlanner($w, { viewportWidth: 375 });
    expect($w('#plannerCanvas').postMessage).toHaveBeenCalledWith({
      type: 'setMobileMode',
      enabled: true,
    });
  });

  it('sends setMobileMode false to canvas on desktop', () => {
    initMobileRoomPlanner($w, { viewportWidth: 1024 });
    expect($w('#plannerCanvas').postMessage).toHaveBeenCalledWith({
      type: 'setMobileMode',
      enabled: false,
    });
  });

  it('does not throw when canvas postMessage throws', () => {
    const $wBad = (sel) => {
      if (sel === '#plannerCanvas') throw new Error('no canvas');
      return { collapse: vi.fn(), expand: vi.fn(), postMessage: vi.fn() };
    };
    expect(() => initMobileRoomPlanner($wBad, { viewportWidth: 375 })).not.toThrow();
  });

  it('does not throw when a section element throws', () => {
    const $wBad = (sel) => {
      if (sel === '#plannerInstructionsSection') return { collapse: () => { throw new Error('missing'); }, expand: vi.fn(), postMessage: vi.fn() };
      return { collapse: vi.fn(), expand: vi.fn(), postMessage: vi.fn() };
    };
    expect(() => initMobileRoomPlanner($wBad, { viewportWidth: 375 })).not.toThrow();
  });

  it('uses breakpoint boundary — 768px is mobile', () => {
    initMobileRoomPlanner($w, { viewportWidth: 768 });
    expect($w('#mobilePlannerControls').expand).toHaveBeenCalled();
  });

  it('uses breakpoint boundary — 769px is desktop', () => {
    initMobileRoomPlanner($w, { viewportWidth: 769 });
    expect($w('#mobilePlannerControls').collapse).toHaveBeenCalled();
  });
});
