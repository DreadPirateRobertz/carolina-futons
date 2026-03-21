/**
 * @module roomPlannerHistory
 * @description Undo/redo history and canvas-clear logic for the Room Planner.
 *
 * Implements a 10-step undo stack for canvas state snapshots.
 * State snapshots are deep-cloned to prevent mutation across history entries.
 *
 * CF-a9l5: Room Planner S4 — Undo and clear
 */

export const MAX_HISTORY_STEPS = 10;

/**
 * Create a new history manager.
 * @returns {HistoryManager}
 */
export function createHistoryManager() {
  let _past = [];   // states before current (oldest first)
  let _future = []; // states after current (newest first)

  return {
    /**
     * Push a new state snapshot onto the history stack.
     * Clears the redo stack and caps history at MAX_HISTORY_STEPS.
     * @param {Object} state - Current canvas state to record.
     */
    push(state) {
      _past.push(deepClone(state));
      if (_past.length > MAX_HISTORY_STEPS) {
        _past.shift(); // drop oldest
      }
      _future = []; // new action invalidates redo stack
    },

    /**
     * Undo: return the previous state and move current forward to redo stack.
     * @param {Object} currentState - The current canvas state to save in redo.
     * @returns {Object|null} Previous state, or null if nothing to undo.
     */
    undo(currentState) {
      if (_past.length === 0) return null;
      _future.push(deepClone(currentState));
      return deepClone(_past.pop());
    },

    /**
     * Redo: return the next state and push current back onto undo stack.
     * @param {Object} currentState - The current canvas state to save in undo.
     * @returns {Object|null} Next state, or null if nothing to redo.
     */
    redo(currentState) {
      if (_future.length === 0) return null;
      _past.push(deepClone(currentState));
      if (_past.length > MAX_HISTORY_STEPS) _past.shift();
      return deepClone(_future.pop());
    },

    /** @returns {boolean} true if there are states to undo */
    canUndo() { return _past.length > 0; },

    /** @returns {boolean} true if there are states to redo */
    canRedo() { return _future.length > 0; },

    /** @returns {number} number of undo steps available */
    undoDepth() { return _past.length; },

    /** @returns {number} number of redo steps available */
    redoDepth() { return _future.length; },

    /** Reset history to empty (e.g. on canvas clear or room change). */
    reset() {
      _past = [];
      _future = [];
    },
  };
}

/**
 * Build a cleared canvas state: same room dimensions, no products placed.
 * @param {Object} canvasState - Current canvas state.
 * @returns {Object} New state with empty products array.
 */
export function buildClearState(canvasState) {
  return {
    ...deepClone(canvasState),
    products: [],
    selectedProductId: null,
  };
}

/**
 * Determine if a clear-canvas action should be confirmed by the user.
 * Requires confirmation when the canvas has 1 or more products.
 * @param {Object} canvasState - Current canvas state.
 * @returns {boolean}
 */
export function requiresClearConfirmation(canvasState) {
  return Array.isArray(canvasState?.products) && canvasState.products.length > 0;
}

/**
 * Deep-clone a value using JSON round-trip (sufficient for plain objects/arrays).
 * @param {*} value
 * @returns {*}
 */
function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}
