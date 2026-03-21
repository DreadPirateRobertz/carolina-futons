/**
 * @module roomPlannerSaveShare
 * @description Save, load, share, and export for the Room Planner.
 *
 * Covers:
 * - localStorage persistence (save/load/clear named layouts)
 * - Shareable URL encoding (canvas state → base64 query param)
 * - PNG export (canvas element → download link)
 *
 * All pure functions take explicit state / DOM args — no globals.
 *
 * CF-8s8a: Room Planner S5 — Save and share
 */

// ── Constants ─────────────────────────────────────────────────────────

/** localStorage key prefix for saved layouts */
export const STORAGE_KEY_PREFIX = 'cf_room_planner_';

/** URL query param for shared layout */
export const SHARE_PARAM = 'layout';

/** Maximum number of saved layouts per browser */
export const MAX_SAVED_LAYOUTS = 10;

// ── LocalStorage persistence ──────────────────────────────────────────

/**
 * Save a canvas state to localStorage under a given name.
 * Overwrites if a layout with that name already exists.
 * Enforces MAX_SAVED_LAYOUTS (drops the oldest if at capacity).
 *
 * @param {Object} canvasState - Room planner canvas state
 * @param {string} name - User-supplied layout name
 * @param {Object} [storage=localStorage] - Injectable for testing
 * @returns {{ ok: boolean, error?: string }}
 */
export function saveLayout(canvasState, name, storage = globalThis.localStorage) {
  try {
    if (!name || typeof name !== 'string' || !name.trim()) {
      return { ok: false, error: 'Layout name is required.' };
    }
    const safeName = name.trim().slice(0, 64);
    const key = STORAGE_KEY_PREFIX + safeName;

    const index = loadLayoutIndex(storage);

    // Enforce capacity (evict oldest if at max and name is new)
    if (!index.includes(safeName) && index.length >= MAX_SAVED_LAYOUTS) {
      const oldest = index[0];
      storage.removeItem(STORAGE_KEY_PREFIX + oldest);
      index.shift();
    }

    // Add name to index if not already there
    if (!index.includes(safeName)) index.push(safeName);

    const record = {
      name: safeName,
      state: canvasState,
      savedAt: Date.now(),
    };

    storage.setItem(key, JSON.stringify(record));
    storage.setItem(STORAGE_KEY_PREFIX + '__index', JSON.stringify(index));
    return { ok: true };
  } catch (e) {
    console.error('[roomPlannerSaveShare] saveLayout:', e);
    return { ok: false, error: 'Failed to save layout.' };
  }
}

/**
 * Load a saved layout by name.
 * @param {string} name
 * @param {Object} [storage=localStorage]
 * @returns {{ ok: boolean, state?: Object, savedAt?: number, error?: string }}
 */
export function loadLayout(name, storage = globalThis.localStorage) {
  try {
    const key = STORAGE_KEY_PREFIX + name.trim();
    const raw = storage.getItem(key);
    if (!raw) return { ok: false, error: 'Layout not found.' };
    const record = JSON.parse(raw);
    return { ok: true, state: record.state, savedAt: record.savedAt };
  } catch (e) {
    console.error('[roomPlannerSaveShare] loadLayout:', e);
    return { ok: false, error: 'Failed to load layout.' };
  }
}

/**
 * Delete a saved layout by name.
 * @param {string} name
 * @param {Object} [storage=localStorage]
 * @returns {{ ok: boolean }}
 */
export function deleteLayout(name, storage = globalThis.localStorage) {
  try {
    const safeName = name.trim();
    const key = STORAGE_KEY_PREFIX + safeName;
    storage.removeItem(key);
    const index = loadLayoutIndex(storage).filter(n => n !== safeName);
    storage.setItem(STORAGE_KEY_PREFIX + '__index', JSON.stringify(index));
    return { ok: true };
  } catch (e) {
    console.error('[roomPlannerSaveShare] deleteLayout:', e);
    return { ok: false };
  }
}

/**
 * List all saved layout names, oldest first.
 * @param {Object} [storage=localStorage]
 * @returns {string[]}
 */
export function listLayouts(storage = globalThis.localStorage) {
  return loadLayoutIndex(storage);
}

/** @private */
function loadLayoutIndex(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY_PREFIX + '__index');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

// ── Shareable URL encoding ─────────────────────────────────────────────

/**
 * Encode a canvas state into a shareable URL query string.
 * Uses base64-encoded JSON with a lightweight lossy compression:
 * strips render-only fields (selectedProductId).
 *
 * @param {Object} canvasState
 * @param {string} [baseUrl=''] - Base URL to prepend (e.g. window.location.href)
 * @returns {string} Full shareable URL
 */
export function encodeShareUrl(canvasState, baseUrl = '') {
  const payload = {
    room: canvasState.room ?? {},
    products: (canvasState.products ?? []).map(p => ({
      _id: p._id,
      type: p.type,
      x: p.x,
      y: p.y,
      width: p.width,
      depth: p.depth,
      rotation: p.rotation ?? 0,
    })),
  };

  const encoded = btoa(JSON.stringify(payload));
  const sep = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${sep}${SHARE_PARAM}=${encoded}`;
}

/**
 * Decode a layout from a share URL query param.
 * @param {string} encodedParam - Raw value of the `layout` query param
 * @returns {{ ok: boolean, state?: Object, error?: string }}
 */
export function decodeShareUrl(encodedParam) {
  try {
    if (!encodedParam) return { ok: false, error: 'No layout param.' };
    const json = atob(encodedParam);
    const payload = JSON.parse(json);
    if (!payload.room || !Array.isArray(payload.products)) {
      return { ok: false, error: 'Invalid layout data.' };
    }
    return {
      ok: true,
      state: {
        room: payload.room,
        products: payload.products,
        selectedProductId: null,
      },
    };
  } catch (e) {
    console.error('[roomPlannerSaveShare] decodeShareUrl:', e);
    return { ok: false, error: 'Failed to decode layout.' };
  }
}

/**
 * Extract the layout param from a URL string (or window.location.search).
 * @param {string} search - URL query string (e.g. '?layout=abc&foo=bar')
 * @returns {string|null}
 */
export function getShareParamFromSearch(search) {
  try {
    const params = new URLSearchParams(search);
    return params.get(SHARE_PARAM) ?? null;
  } catch (_) {
    return null;
  }
}

// ── PNG export ────────────────────────────────────────────────────────

/**
 * Trigger a PNG download from a canvas element.
 * Returns the data URL (for testing); side-effect is the download.
 *
 * @param {HTMLCanvasElement} canvasEl - The room planner canvas DOM element
 * @param {string} [filename='room-layout.png']
 * @param {Object} [dom] - Injectable document for testing
 * @returns {{ ok: boolean, dataUrl?: string, error?: string }}
 */
export function exportToPng(canvasEl, filename = 'room-layout.png', dom = globalThis.document) {
  try {
    if (!canvasEl || typeof canvasEl.toDataURL !== 'function') {
      return { ok: false, error: 'No canvas element.' };
    }
    const dataUrl = canvasEl.toDataURL('image/png');
    if (dom) {
      const link = dom.createElement('a');
      link.href = dataUrl;
      link.download = filename;
      dom.body.appendChild(link);
      link.click();
      dom.body.removeChild(link);
    }
    return { ok: true, dataUrl };
  } catch (e) {
    console.error('[roomPlannerSaveShare] exportToPng:', e);
    return { ok: false, error: 'Failed to export PNG.' };
  }
}

/**
 * Build a filename for the PNG export based on room dimensions.
 * @param {Object} room - { width, depth } in inches
 * @returns {string}
 */
export function buildExportFilename(room) {
  if (!room || !room.width || !room.depth) return 'room-layout.png';
  const ft = (in_) => Math.round(in_ / 12);
  return `room-${ft(room.width)}x${ft(room.depth)}ft.png`;
}
