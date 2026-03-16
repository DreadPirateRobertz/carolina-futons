import { describe, it, expect, vi } from 'vitest';
import {
  enableSwipe,
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

// ── enableSwipe ─────────────────────────────────────────────────────

describe('enableSwipe', () => {
  function mockElement() {
    const listeners = {};
    return {
      addEventListener: vi.fn((event, handler) => { listeners[event] = handler; }),
      removeEventListener: vi.fn(),
      _listeners: listeners,
    };
  }

  it('returns no-op cleanup for null element', () => {
    const cleanup = enableSwipe(null, vi.fn());
    expect(typeof cleanup).toBe('function');
    cleanup(); // should not throw
  });

  it('returns no-op cleanup when onSwipe is not a function', () => {
    const el = mockElement();
    const cleanup = enableSwipe(el, 'not-a-function');
    expect(typeof cleanup).toBe('function');
    expect(el.addEventListener).not.toHaveBeenCalled();
  });

  it('registers touchstart and touchend listeners', () => {
    const el = mockElement();
    enableSwipe(el, vi.fn());
    expect(el.addEventListener).toHaveBeenCalledWith('touchstart', expect.any(Function), { passive: true });
    expect(el.addEventListener).toHaveBeenCalledWith('touchend', expect.any(Function), { passive: true });
  });

  it('fires right swipe when dx > threshold within time', () => {
    const el = mockElement();
    const onSwipe = vi.fn();
    enableSwipe(el, onSwipe);

    // Simulate touchstart then touchend
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValueOnce(now).mockReturnValueOnce(now + 100);

    el._listeners.touchstart({ touches: [{ clientX: 100, clientY: 200 }] });
    el._listeners.touchend({ changedTouches: [{ clientX: 200, clientY: 200 }] });

    expect(onSwipe).toHaveBeenCalledWith('right');
    vi.restoreAllMocks();
  });

  it('fires left swipe', () => {
    const el = mockElement();
    const onSwipe = vi.fn();
    enableSwipe(el, onSwipe);

    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValueOnce(now).mockReturnValueOnce(now + 100);

    el._listeners.touchstart({ touches: [{ clientX: 200, clientY: 200 }] });
    el._listeners.touchend({ changedTouches: [{ clientX: 100, clientY: 200 }] });

    expect(onSwipe).toHaveBeenCalledWith('left');
    vi.restoreAllMocks();
  });

  it('fires down swipe when dy > dx', () => {
    const el = mockElement();
    const onSwipe = vi.fn();
    enableSwipe(el, onSwipe);

    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValueOnce(now).mockReturnValueOnce(now + 100);

    el._listeners.touchstart({ touches: [{ clientX: 200, clientY: 100 }] });
    el._listeners.touchend({ changedTouches: [{ clientX: 200, clientY: 200 }] });

    expect(onSwipe).toHaveBeenCalledWith('down');
    vi.restoreAllMocks();
  });

  it('fires up swipe when dy < -threshold', () => {
    const el = mockElement();
    const onSwipe = vi.fn();
    enableSwipe(el, onSwipe);

    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValueOnce(now).mockReturnValueOnce(now + 100);

    el._listeners.touchstart({ touches: [{ clientX: 200, clientY: 200 }] });
    el._listeners.touchend({ changedTouches: [{ clientX: 200, clientY: 100 }] });

    expect(onSwipe).toHaveBeenCalledWith('up');
    vi.restoreAllMocks();
  });

  it('does not fire when elapsed time exceeds maxTime', () => {
    const el = mockElement();
    const onSwipe = vi.fn();
    enableSwipe(el, onSwipe, { maxTime: 200 });

    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValueOnce(now).mockReturnValueOnce(now + 500);

    el._listeners.touchstart({ touches: [{ clientX: 100, clientY: 200 }] });
    el._listeners.touchend({ changedTouches: [{ clientX: 200, clientY: 200 }] });

    expect(onSwipe).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('does not fire when movement is below threshold', () => {
    const el = mockElement();
    const onSwipe = vi.fn();
    enableSwipe(el, onSwipe);

    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValueOnce(now).mockReturnValueOnce(now + 100);

    el._listeners.touchstart({ touches: [{ clientX: 100, clientY: 100 }] });
    el._listeners.touchend({ changedTouches: [{ clientX: 110, clientY: 105 }] });

    expect(onSwipe).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('uses custom threshold', () => {
    const el = mockElement();
    const onSwipe = vi.fn();
    enableSwipe(el, onSwipe, { threshold: 20 });

    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValueOnce(now).mockReturnValueOnce(now + 100);

    el._listeners.touchstart({ touches: [{ clientX: 100, clientY: 100 }] });
    el._listeners.touchend({ changedTouches: [{ clientX: 130, clientY: 100 }] });

    expect(onSwipe).toHaveBeenCalledWith('right');
    vi.restoreAllMocks();
  });

  it('cleanup function removes listeners', () => {
    const el = mockElement();
    const cleanup = enableSwipe(el, vi.fn());
    cleanup();
    expect(el.removeEventListener).toHaveBeenCalledTimes(2);
    expect(el.removeEventListener).toHaveBeenCalledWith('touchstart', expect.any(Function));
    expect(el.removeEventListener).toHaveBeenCalledWith('touchend', expect.any(Function));
  });
});

// ── detectSwipeDirection edge cases ──────────────────────────────────

describe('detectSwipeDirection — edge cases', () => {
  it('returns null when dx and dy are both zero', () => {
    expect(detectSwipeDirection(100, 100, 100, 100)).toBeNull();
  });

  it('prefers horizontal when dx === dy and both >= threshold', () => {
    // dx = 60, dy = 60 → absDx > absDy is false, goes to vertical
    expect(detectSwipeDirection(100, 100, 160, 160)).toBe('down');
  });

  it('detects right at exact threshold boundary (not strictly less)', () => {
    // absDx === threshold → condition `absDx < threshold` is false → swipe detected
    expect(detectSwipeDirection(100, 100, 150, 100, 50)).toBe('right');
    // absDx = 49, just below threshold → no swipe
    expect(detectSwipeDirection(100, 100, 149, 100, 50)).toBeNull();
  });
});

// ── calculatePinchScale edge cases ───────────────────────────────────

describe('calculatePinchScale — edge cases', () => {
  it('returns 1 for null startDistance', () => {
    expect(calculatePinchScale(null, 100)).toBe(1);
  });

  it('returns 1 for undefined startDistance', () => {
    expect(calculatePinchScale(undefined, 100)).toBe(1);
  });

  it('handles very small pinch', () => {
    expect(calculatePinchScale(100, 101)).toBeCloseTo(1.01, 2);
  });
});

// ── getTouchDistance edge cases ───────────────────────────────────────

describe('getTouchDistance — edge cases', () => {
  it('returns 0 for undefined touch1', () => {
    expect(getTouchDistance(undefined, { clientX: 0, clientY: 0 })).toBe(0);
  });

  it('handles negative coordinates', () => {
    const d = getTouchDistance({ clientX: -3, clientY: -4 }, { clientX: 0, clientY: 0 });
    expect(d).toBe(5);
  });
});
