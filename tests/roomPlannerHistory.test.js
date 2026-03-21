/**
 * Tests for CF-a9l5: Room Planner S4 — Undo/clear history manager.
 * Covers: createHistoryManager (push/undo/redo/canUndo/canRedo/reset),
 * buildClearState, requiresClearConfirmation.
 */
import { describe, it, expect } from 'vitest';
import {
  createHistoryManager,
  buildClearState,
  requiresClearConfirmation,
  MAX_HISTORY_STEPS,
} from '../src/public/roomPlannerHistory.js';

function makeState(products = [], extra = {}) {
  return {
    room: { width: 144, length: 120 },
    products,
    selectedProductId: null,
    ...extra,
  };
}

// ── MAX_HISTORY_STEPS ────────────────────────────────────────────

describe('MAX_HISTORY_STEPS', () => {
  it('is 10', () => {
    expect(MAX_HISTORY_STEPS).toBe(10);
  });
});

// ── createHistoryManager — push ──────────────────────────────────

describe('HistoryManager.push', () => {
  it('canUndo returns false on fresh manager', () => {
    const h = createHistoryManager();
    expect(h.canUndo()).toBe(false);
  });

  it('canUndo returns true after push', () => {
    const h = createHistoryManager();
    h.push(makeState());
    expect(h.canUndo()).toBe(true);
  });

  it('undoDepth reflects number of pushed states', () => {
    const h = createHistoryManager();
    h.push(makeState([{ _id: 'a' }]));
    h.push(makeState([{ _id: 'a' }, { _id: 'b' }]));
    expect(h.undoDepth()).toBe(2);
  });

  it('caps history at MAX_HISTORY_STEPS', () => {
    const h = createHistoryManager();
    for (let i = 0; i < MAX_HISTORY_STEPS + 5; i++) {
      h.push(makeState([{ _id: `item-${i}` }]));
    }
    expect(h.undoDepth()).toBe(MAX_HISTORY_STEPS);
  });

  it('push clears redo stack', () => {
    const h = createHistoryManager();
    const s1 = makeState([{ _id: 'a' }]);
    const s2 = makeState([{ _id: 'a' }, { _id: 'b' }]);
    const s3 = makeState([{ _id: 'a' }, { _id: 'b' }, { _id: 'c' }]);
    h.push(s1);
    h.push(s2);
    h.undo(s2); // creates redo entry
    expect(h.canRedo()).toBe(true);
    h.push(s3); // new action clears redo
    expect(h.canRedo()).toBe(false);
  });

  it('stores deep clone (mutations to original do not affect history)', () => {
    const h = createHistoryManager();
    const s = makeState([{ _id: 'a', x: 10 }]);
    h.push(s);
    s.products[0].x = 999; // mutate original
    const prev = h.undo(makeState());
    expect(prev.products[0].x).toBe(10); // history is unaffected
  });
});

// ── createHistoryManager — undo ──────────────────────────────────

describe('HistoryManager.undo', () => {
  it('returns null when nothing to undo', () => {
    const h = createHistoryManager();
    expect(h.undo(makeState())).toBeNull();
  });

  it('returns the previously pushed state', () => {
    const h = createHistoryManager();
    const s1 = makeState([{ _id: 'a' }]);
    h.push(s1);
    const restored = h.undo(makeState([{ _id: 'a' }, { _id: 'b' }]));
    expect(restored.products).toHaveLength(1);
    expect(restored.products[0]._id).toBe('a');
  });

  it('decrements undoDepth', () => {
    const h = createHistoryManager();
    h.push(makeState([{ _id: 'a' }]));
    h.push(makeState([{ _id: 'a' }, { _id: 'b' }]));
    h.undo(makeState());
    expect(h.undoDepth()).toBe(1);
  });

  it('increments redoDepth', () => {
    const h = createHistoryManager();
    h.push(makeState([{ _id: 'a' }]));
    h.undo(makeState([{ _id: 'a' }, { _id: 'b' }]));
    expect(h.redoDepth()).toBe(1);
  });

  it('multiple undos restore states in LIFO order', () => {
    const h = createHistoryManager();
    const s1 = makeState([{ _id: 'a' }]);
    const s2 = makeState([{ _id: 'a' }, { _id: 'b' }]);
    const s3 = makeState([{ _id: 'a' }, { _id: 'b' }, { _id: 'c' }]);
    h.push(s1);
    h.push(s2);
    const r1 = h.undo(s3);
    expect(r1.products).toHaveLength(2);
    const r2 = h.undo(s2);
    expect(r2.products).toHaveLength(1);
  });
});

// ── createHistoryManager — redo ──────────────────────────────────

describe('HistoryManager.redo', () => {
  it('returns null when nothing to redo', () => {
    const h = createHistoryManager();
    expect(h.redo(makeState())).toBeNull();
  });

  it('redo restores the undone state', () => {
    const h = createHistoryManager();
    const s1 = makeState([{ _id: 'a' }]);
    const s2 = makeState([{ _id: 'a' }, { _id: 'b' }]);
    h.push(s1);
    h.undo(s2);
    const redone = h.redo(s1);
    expect(redone.products).toHaveLength(2);
  });

  it('redo decrements redoDepth', () => {
    const h = createHistoryManager();
    h.push(makeState([{ _id: 'a' }]));
    h.undo(makeState());
    h.redo(makeState());
    expect(h.redoDepth()).toBe(0);
  });

  it('redo pushes to undo stack', () => {
    const h = createHistoryManager();
    h.push(makeState([{ _id: 'a' }]));
    const s2 = makeState([{ _id: 'a' }, { _id: 'b' }]);
    h.undo(s2);
    const depthBefore = h.undoDepth();
    h.redo(makeState([{ _id: 'a' }]));
    expect(h.undoDepth()).toBe(depthBefore + 1);
  });
});

// ── createHistoryManager — reset ─────────────────────────────────

describe('HistoryManager.reset', () => {
  it('clears undo and redo stacks', () => {
    const h = createHistoryManager();
    h.push(makeState([{ _id: 'a' }]));
    h.undo(makeState());
    h.reset();
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(false);
  });

  it('undoDepth and redoDepth are 0 after reset', () => {
    const h = createHistoryManager();
    h.push(makeState([{ _id: 'a' }]));
    h.reset();
    expect(h.undoDepth()).toBe(0);
    expect(h.redoDepth()).toBe(0);
  });
});

// ── buildClearState ──────────────────────────────────────────────

describe('buildClearState', () => {
  it('returns state with empty products array', () => {
    const state = makeState([{ _id: 'a' }, { _id: 'b' }]);
    const cleared = buildClearState(state);
    expect(cleared.products).toHaveLength(0);
  });

  it('preserves room dimensions', () => {
    const state = makeState([], { room: { width: 200, length: 180 } });
    const cleared = buildClearState(state);
    expect(cleared.room.width).toBe(200);
    expect(cleared.room.length).toBe(180);
  });

  it('sets selectedProductId to null', () => {
    const state = makeState([{ _id: 'a' }], { selectedProductId: 'a' });
    const cleared = buildClearState(state);
    expect(cleared.selectedProductId).toBeNull();
  });

  it('does not mutate the input state', () => {
    const state = makeState([{ _id: 'a' }]);
    buildClearState(state);
    expect(state.products).toHaveLength(1);
  });
});

// ── requiresClearConfirmation ────────────────────────────────────

describe('requiresClearConfirmation', () => {
  it('returns true when canvas has products', () => {
    expect(requiresClearConfirmation(makeState([{ _id: 'a' }]))).toBe(true);
  });

  it('returns false when canvas is empty', () => {
    expect(requiresClearConfirmation(makeState([]))).toBe(false);
  });

  it('returns false for null state', () => {
    expect(requiresClearConfirmation(null)).toBe(false);
  });

  it('returns false for undefined state', () => {
    expect(requiresClearConfirmation(undefined)).toBe(false);
  });

  it('returns true for 2+ products', () => {
    expect(requiresClearConfirmation(makeState([{ _id: 'a' }, { _id: 'b' }]))).toBe(true);
  });
});
