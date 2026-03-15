import { describe, it, expect } from 'vitest';

import {
  roomToCanvas,
  canvasToRoom,
  getProductBounds,
  checkFit,
  hitTestProduct,
  buildRenderState,
  CANVAS_PADDING,
} from '../src/public/roomPlannerCanvas.js';

// ── roomToCanvas ──────────────────────────────────────────────────────

describe('roomToCanvas', () => {
  it('converts room inches to canvas pixels at scale 1', () => {
    const result = roomToCanvas(10, 20, 1);
    expect(result.x).toBe(CANVAS_PADDING + 10);
    expect(result.y).toBe(CANVAS_PADDING + 20);
  });

  it('applies scale factor', () => {
    const result = roomToCanvas(10, 20, 3);
    expect(result.x).toBe(CANVAS_PADDING + 30);
    expect(result.y).toBe(CANVAS_PADDING + 60);
  });

  it('handles zero coordinates', () => {
    const result = roomToCanvas(0, 0, 2);
    expect(result.x).toBe(CANVAS_PADDING);
    expect(result.y).toBe(CANVAS_PADDING);
  });
});

// ── canvasToRoom ──────────────────────────────────────────────────────

describe('canvasToRoom', () => {
  it('converts canvas pixels back to room inches', () => {
    const result = canvasToRoom(CANVAS_PADDING + 30, CANVAS_PADDING + 60, 3);
    expect(result.x).toBeCloseTo(10);
    expect(result.y).toBeCloseTo(20);
  });

  it('is inverse of roomToCanvas', () => {
    const scale = 2.5;
    const forward = roomToCanvas(50, 75, scale);
    const back = canvasToRoom(forward.x, forward.y, scale);
    expect(back.x).toBeCloseTo(50);
    expect(back.y).toBeCloseTo(75);
  });

  it('clamps negative room coordinates to zero', () => {
    const result = canvasToRoom(0, 0, 2);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });
});

// ── getProductBounds ──────────────────────────────────────────────────

describe('getProductBounds', () => {
  const product = {
    x: 10, y: 20, width: 82, depth: 38, depthBed: 54,
    rotation: 0, isBedMode: false,
  };

  it('returns bounding rect in room coordinates', () => {
    const bounds = getProductBounds(product);
    expect(bounds.x).toBe(10);
    expect(bounds.y).toBe(20);
    expect(bounds.w).toBe(82);
    expect(bounds.h).toBe(38);
  });

  it('uses depthBed when in bed mode', () => {
    const bedProduct = { ...product, isBedMode: true };
    const bounds = getProductBounds(bedProduct);
    expect(bounds.h).toBe(54);
  });

  it('swaps width/depth on 90° rotation', () => {
    const rotated = { ...product, rotation: 90 };
    const bounds = getProductBounds(rotated);
    expect(bounds.w).toBe(38);
    expect(bounds.h).toBe(82);
  });

  it('swaps width/depth on 270° rotation', () => {
    const rotated = { ...product, rotation: 270 };
    const bounds = getProductBounds(rotated);
    expect(bounds.w).toBe(38);
    expect(bounds.h).toBe(82);
  });

  it('keeps width/depth on 180° rotation', () => {
    const rotated = { ...product, rotation: 180 };
    const bounds = getProductBounds(rotated);
    expect(bounds.w).toBe(82);
    expect(bounds.h).toBe(38);
  });

  it('combines bed mode and rotation', () => {
    const combo = { ...product, isBedMode: true, rotation: 90 };
    const bounds = getProductBounds(combo);
    // Bed mode: depth becomes 54, rotation 90: swap → w=54, h=82
    expect(bounds.w).toBe(54);
    expect(bounds.h).toBe(82);
  });
});

// ── checkFit ──────────────────────────────────────────────────────────

describe('checkFit', () => {
  it('returns true when product fits inside room', () => {
    const product = { x: 10, y: 10, width: 82, depth: 38, depthBed: 54, rotation: 0, isBedMode: false };
    expect(checkFit(product, 200, 200)).toBe(true);
  });

  it('returns false when product extends beyond room width', () => {
    const product = { x: 150, y: 10, width: 82, depth: 38, depthBed: 54, rotation: 0, isBedMode: false };
    // 150 + 82 = 232 > 200
    expect(checkFit(product, 200, 200)).toBe(false);
  });

  it('returns false when product extends beyond room length', () => {
    const product = { x: 10, y: 180, width: 82, depth: 38, depthBed: 54, rotation: 0, isBedMode: false };
    // 180 + 38 = 218 > 200
    expect(checkFit(product, 200, 200)).toBe(false);
  });

  it('accounts for rotation when checking fit', () => {
    // 90° rotation swaps: w=38, h=82
    const product = { x: 10, y: 10, width: 82, depth: 38, depthBed: 54, rotation: 90, isBedMode: false };
    // w=38, h=82 → 10+38=48 fits, 10+82=92 fits in 200
    expect(checkFit(product, 200, 200)).toBe(true);
  });

  it('accounts for bed mode when checking fit', () => {
    const product = { x: 10, y: 160, width: 82, depth: 38, depthBed: 54, rotation: 0, isBedMode: true };
    // 160 + 54 = 214 > 200
    expect(checkFit(product, 200, 200)).toBe(false);
  });

  it('returns false when product has negative position', () => {
    const product = { x: -5, y: 10, width: 82, depth: 38, depthBed: 54, rotation: 0, isBedMode: false };
    expect(checkFit(product, 200, 200)).toBe(false);
  });

  it('returns true when product exactly fills room', () => {
    const product = { x: 0, y: 0, width: 200, depth: 200, depthBed: 200, rotation: 0, isBedMode: false };
    expect(checkFit(product, 200, 200)).toBe(true);
  });
});

// ── hitTestProduct ────────────────────────────────────────────────────

describe('hitTestProduct', () => {
  const products = [
    { id: 'p1', x: 10, y: 10, width: 40, depth: 30, depthBed: 30, rotation: 0, isBedMode: false },
    { id: 'p2', x: 100, y: 100, width: 50, depth: 50, depthBed: 50, rotation: 0, isBedMode: false },
  ];
  const scale = 2;

  it('returns product when click is inside its bounds', () => {
    // Product p1 at room (10,10) size 40x30 → canvas (pad+20, pad+20) to (pad+100, pad+80)
    const canvasX = CANVAS_PADDING + 30;
    const canvasY = CANVAS_PADDING + 30;
    const hit = hitTestProduct(canvasX, canvasY, products, scale);
    expect(hit).not.toBeNull();
    expect(hit.id).toBe('p1');
  });

  it('returns null when click is outside all products', () => {
    const canvasX = CANVAS_PADDING + 160;
    const canvasY = CANVAS_PADDING + 10;
    const hit = hitTestProduct(canvasX, canvasY, products, scale);
    expect(hit).toBeNull();
  });

  it('returns last (topmost) product when overlapping', () => {
    const overlapping = [
      { id: 'a', x: 10, y: 10, width: 80, depth: 80, depthBed: 80, rotation: 0, isBedMode: false },
      { id: 'b', x: 10, y: 10, width: 80, depth: 80, depthBed: 80, rotation: 0, isBedMode: false },
    ];
    const canvasX = CANVAS_PADDING + 40;
    const canvasY = CANVAS_PADDING + 40;
    const hit = hitTestProduct(canvasX, canvasY, overlapping, scale);
    expect(hit.id).toBe('b');
  });

  it('handles empty products array', () => {
    const hit = hitTestProduct(100, 100, [], scale);
    expect(hit).toBeNull();
  });
});

// ── buildRenderState ──────────────────────────────────────────────────

describe('buildRenderState', () => {
  it('computes scale, room rect, and product rects', () => {
    const room = { width: 120, length: 144 };
    const products = [
      { id: 'p1', x: 10, y: 10, width: 82, depth: 38, depthBed: 54, rotation: 0, isBedMode: false, label: 'Futon' },
    ];
    const state = buildRenderState(room, products, 600, 400);

    expect(state).toHaveProperty('scale');
    expect(state.scale).toBeGreaterThan(0);
    expect(state).toHaveProperty('roomRect');
    expect(state.roomRect).toHaveProperty('x');
    expect(state.roomRect).toHaveProperty('y');
    expect(state.roomRect).toHaveProperty('w');
    expect(state.roomRect).toHaveProperty('h');
    expect(state).toHaveProperty('productRects');
    expect(state.productRects).toHaveLength(1);
  });

  it('room rect starts at padding offset', () => {
    const state = buildRenderState({ width: 100, length: 100 }, [], 600, 400);
    expect(state.roomRect.x).toBe(CANVAS_PADDING);
    expect(state.roomRect.y).toBe(CANVAS_PADDING);
  });

  it('room rect is scaled to container', () => {
    const state = buildRenderState({ width: 120, length: 144 }, [], 600, 400);
    // Scale = min((600-2*pad)/120, (400-2*pad)/144)
    const availW = 600 - 2 * CANVAS_PADDING;
    const availH = 400 - 2 * CANVAS_PADDING;
    const expectedScale = Math.min(availW / 120, availH / 144);
    expect(state.scale).toBeCloseTo(expectedScale);
    expect(state.roomRect.w).toBeCloseTo(120 * expectedScale);
    expect(state.roomRect.h).toBeCloseTo(144 * expectedScale);
  });

  it('each product rect has canvas coords and fit status', () => {
    const room = { width: 200, length: 200 };
    const products = [
      { id: 'p1', x: 10, y: 10, width: 82, depth: 38, depthBed: 54, rotation: 0, isBedMode: false, label: 'Futon' },
      { id: 'p2', x: 180, y: 180, width: 50, depth: 50, depthBed: 50, rotation: 0, isBedMode: false, label: 'Table' },
    ];
    const state = buildRenderState(room, products, 600, 400);

    expect(state.productRects[0].fits).toBe(true);
    expect(state.productRects[1].fits).toBe(false); // 180+50=230 > 200
    expect(state.productRects[0]).toHaveProperty('canvasX');
    expect(state.productRects[0]).toHaveProperty('canvasY');
    expect(state.productRects[0]).toHaveProperty('canvasW');
    expect(state.productRects[0]).toHaveProperty('canvasH');
    expect(state.productRects[0]).toHaveProperty('label');
  });

  it('handles empty products', () => {
    const state = buildRenderState({ width: 100, length: 100 }, [], 600, 400);
    expect(state.productRects).toEqual([]);
  });

  it('handles zero room dimensions gracefully', () => {
    const state = buildRenderState({ width: 0, length: 0 }, [], 600, 400);
    expect(state.scale).toBe(1);
  });
});
