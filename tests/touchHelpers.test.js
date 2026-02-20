import { describe, it, expect } from 'vitest';
import {
  detectSwipeDirection,
  calculatePinchScale,
  getTouchDistance,
  clampScale,
} from '../src/public/touchHelpers.js';

// ── detectSwipeDirection ────────────────────────────────────────────

describe('detectSwipeDirection', () => {
  it('detects left swipe', () => {
    expect(detectSwipeDirection(200, 100, 100, 100)).toBe('left');
  });

  it('detects right swipe', () => {
    expect(detectSwipeDirection(100, 100, 200, 100)).toBe('right');
  });

  it('detects up swipe', () => {
    expect(detectSwipeDirection(100, 200, 100, 100)).toBe('up');
  });

  it('detects down swipe', () => {
    expect(detectSwipeDirection(100, 100, 100, 200)).toBe('down');
  });

  it('returns null when movement is below threshold', () => {
    expect(detectSwipeDirection(100, 100, 120, 110)).toBeNull();
  });

  it('respects custom threshold', () => {
    // 30px movement with 20px threshold → should detect
    expect(detectSwipeDirection(100, 100, 130, 100, 20)).toBe('right');
    // 30px movement with 50px threshold → should not detect
    expect(detectSwipeDirection(100, 100, 130, 100, 50)).toBeNull();
  });

  it('prefers horizontal when dx > dy', () => {
    expect(detectSwipeDirection(100, 100, 200, 130)).toBe('right');
  });

  it('prefers vertical when dy > dx', () => {
    expect(detectSwipeDirection(100, 100, 130, 200)).toBe('down');
  });
});

// ── calculatePinchScale ─────────────────────────────────────────────

describe('calculatePinchScale', () => {
  it('returns 1 for equal distances (no zoom)', () => {
    expect(calculatePinchScale(100, 100)).toBe(1);
  });

  it('returns >1 for zoom in (fingers spread apart)', () => {
    expect(calculatePinchScale(100, 200)).toBe(2);
  });

  it('returns <1 for zoom out (fingers pinch together)', () => {
    expect(calculatePinchScale(200, 100)).toBe(0.5);
  });

  it('returns 1 for zero start distance (safety)', () => {
    expect(calculatePinchScale(0, 100)).toBe(1);
  });
});

// ── getTouchDistance ────────────────────────────────────────────────

describe('getTouchDistance', () => {
  it('calculates distance between two touch points', () => {
    const t1 = { clientX: 0, clientY: 0 };
    const t2 = { clientX: 3, clientY: 4 };
    expect(getTouchDistance(t1, t2)).toBe(5); // 3-4-5 triangle
  });

  it('returns 0 for identical points', () => {
    const t1 = { clientX: 100, clientY: 100 };
    expect(getTouchDistance(t1, t1)).toBe(0);
  });

  it('returns 0 for null touches', () => {
    expect(getTouchDistance(null, null)).toBe(0);
    expect(getTouchDistance({ clientX: 0, clientY: 0 }, null)).toBe(0);
  });
});

// ── clampScale ──────────────────────────────────────────────────────

describe('clampScale', () => {
  it('clamps below min', () => {
    expect(clampScale(0.5)).toBe(1);
  });

  it('clamps above max', () => {
    expect(clampScale(5)).toBe(3);
  });

  it('passes through values within range', () => {
    expect(clampScale(2)).toBe(2);
  });

  it('respects custom min and max', () => {
    expect(clampScale(0.3, 0.5, 4)).toBe(0.5);
    expect(clampScale(5, 0.5, 4)).toBe(4);
  });
});
