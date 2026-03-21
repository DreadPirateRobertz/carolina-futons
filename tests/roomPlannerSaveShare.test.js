/**
 * Tests for CF-8s8a: Room Planner S5 — Save and share.
 * Covers: saveLayout, loadLayout, deleteLayout, listLayouts,
 * encodeShareUrl, decodeShareUrl, getShareParamFromSearch, exportToPng,
 * buildExportFilename.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  STORAGE_KEY_PREFIX,
  SHARE_PARAM,
  MAX_SAVED_LAYOUTS,
  saveLayout,
  loadLayout,
  deleteLayout,
  listLayouts,
  encodeShareUrl,
  decodeShareUrl,
  getShareParamFromSearch,
  exportToPng,
  buildExportFilename,
} from '../src/public/roomPlannerSaveShare.js';

// ── Storage mock ───────────────────────────────────────────────────────

function makeStorage() {
  const store = new Map();
  return {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    _store: store,
  };
}

function makeState(overrides = {}) {
  return {
    room: { width: 180, depth: 144 },
    products: [{ _id: 'p1', type: 'futon-frame-full', x: 10, y: 20, width: 82, depth: 38, rotation: 0 }],
    selectedProductId: null,
    ...overrides,
  };
}

// ── Constants ──────────────────────────────────────────────────────────

describe('constants', () => {
  it('STORAGE_KEY_PREFIX starts with cf_', () => expect(STORAGE_KEY_PREFIX).toMatch(/^cf_/));
  it('SHARE_PARAM is a non-empty string', () => expect(typeof SHARE_PARAM).toBe('string'));
  it('MAX_SAVED_LAYOUTS is positive', () => expect(MAX_SAVED_LAYOUTS).toBeGreaterThan(0));
});

// ── saveLayout ─────────────────────────────────────────────────────────

describe('saveLayout', () => {
  let storage;
  beforeEach(() => { storage = makeStorage(); });

  it('returns ok:true on successful save', () => {
    expect(saveLayout(makeState(), 'My Room', storage).ok).toBe(true);
  });

  it('persists state to storage', () => {
    saveLayout(makeState(), 'Living Room', storage);
    const result = loadLayout('Living Room', storage);
    expect(result.ok).toBe(true);
    expect(result.state.room.width).toBe(180);
  });

  it('returns ok:false for empty name', () => {
    expect(saveLayout(makeState(), '', storage).ok).toBe(false);
  });

  it('returns ok:false for whitespace-only name', () => {
    expect(saveLayout(makeState(), '   ', storage).ok).toBe(false);
  });

  it('overwrites existing layout with same name', () => {
    const state1 = makeState({ room: { width: 120, depth: 100 } });
    const state2 = makeState({ room: { width: 200, depth: 150 } });
    saveLayout(state1, 'Room', storage);
    saveLayout(state2, 'Room', storage);
    const result = loadLayout('Room', storage);
    expect(result.state.room.width).toBe(200);
  });

  it('adds savedAt timestamp', () => {
    saveLayout(makeState(), 'Room', storage);
    const result = loadLayout('Room', storage);
    expect(typeof result.savedAt).toBe('number');
    expect(result.savedAt).toBeGreaterThan(0);
  });

  it('truncates name to 64 chars', () => {
    const longName = 'A'.repeat(100);
    saveLayout(makeState(), longName, storage);
    const list = listLayouts(storage);
    expect(list[0].length).toBe(64);
  });

  it('appends to layout index', () => {
    saveLayout(makeState(), 'Room A', storage);
    saveLayout(makeState(), 'Room B', storage);
    expect(listLayouts(storage)).toContain('Room A');
    expect(listLayouts(storage)).toContain('Room B');
  });

  it('does not duplicate index entry when overwriting', () => {
    saveLayout(makeState(), 'Room', storage);
    saveLayout(makeState(), 'Room', storage);
    expect(listLayouts(storage).filter(n => n === 'Room')).toHaveLength(1);
  });

  it(`evicts oldest layout when at MAX_SAVED_LAYOUTS capacity`, () => {
    for (let i = 0; i < MAX_SAVED_LAYOUTS; i++) {
      saveLayout(makeState(), `Room ${i}`, storage);
    }
    saveLayout(makeState(), 'New Room', storage);
    const list = listLayouts(storage);
    expect(list).toHaveLength(MAX_SAVED_LAYOUTS);
    expect(list).not.toContain('Room 0');
    expect(list).toContain('New Room');
  });
});

// ── loadLayout ─────────────────────────────────────────────────────────

describe('loadLayout', () => {
  let storage;
  beforeEach(() => { storage = makeStorage(); });

  it('returns ok:false for non-existent layout', () => {
    expect(loadLayout('Ghost', storage).ok).toBe(false);
  });

  it('returns ok:true and state for existing layout', () => {
    saveLayout(makeState(), 'Room', storage);
    const result = loadLayout('Room', storage);
    expect(result.ok).toBe(true);
    expect(result.state).toBeDefined();
  });

  it('restores products array', () => {
    const state = makeState();
    saveLayout(state, 'Room', storage);
    const result = loadLayout('Room', storage);
    expect(result.state.products).toHaveLength(1);
    expect(result.state.products[0]._id).toBe('p1');
  });
});

// ── deleteLayout ───────────────────────────────────────────────────────

describe('deleteLayout', () => {
  let storage;
  beforeEach(() => { storage = makeStorage(); });

  it('removes layout from storage', () => {
    saveLayout(makeState(), 'Room', storage);
    deleteLayout('Room', storage);
    expect(loadLayout('Room', storage).ok).toBe(false);
  });

  it('removes layout from index', () => {
    saveLayout(makeState(), 'Room A', storage);
    saveLayout(makeState(), 'Room B', storage);
    deleteLayout('Room A', storage);
    expect(listLayouts(storage)).not.toContain('Room A');
    expect(listLayouts(storage)).toContain('Room B');
  });

  it('returns ok:true even for non-existent layout (idempotent)', () => {
    expect(deleteLayout('Ghost', storage).ok).toBe(true);
  });
});

// ── listLayouts ────────────────────────────────────────────────────────

describe('listLayouts', () => {
  let storage;
  beforeEach(() => { storage = makeStorage(); });

  it('returns empty array when no layouts saved', () => {
    expect(listLayouts(storage)).toEqual([]);
  });

  it('lists all saved layouts in insertion order', () => {
    saveLayout(makeState(), 'Alpha', storage);
    saveLayout(makeState(), 'Beta', storage);
    saveLayout(makeState(), 'Gamma', storage);
    const list = listLayouts(storage);
    expect(list).toEqual(['Alpha', 'Beta', 'Gamma']);
  });
});

// ── encodeShareUrl ─────────────────────────────────────────────────────

describe('encodeShareUrl', () => {
  it('returns a URL containing the share param', () => {
    const url = encodeShareUrl(makeState(), 'https://example.com/room-planner');
    expect(url).toContain(`${SHARE_PARAM}=`);
  });

  it('appends param with ? when no existing query', () => {
    const url = encodeShareUrl(makeState(), 'https://example.com/room-planner');
    expect(url).toContain('?');
  });

  it('appends param with & when query already exists', () => {
    const url = encodeShareUrl(makeState(), 'https://example.com/room-planner?foo=bar');
    expect(url).toContain('&' + SHARE_PARAM + '=');
  });

  it('excludes selectedProductId from payload', () => {
    const state = makeState({ selectedProductId: 'p1' });
    const url = encodeShareUrl(state, '');
    const param = url.split(`${SHARE_PARAM}=`)[1];
    const decoded = JSON.parse(atob(param));
    expect(decoded.selectedProductId).toBeUndefined();
  });

  it('includes room dimensions in encoded payload', () => {
    const url = encodeShareUrl(makeState(), '');
    const param = url.split(`${SHARE_PARAM}=`)[1];
    const decoded = JSON.parse(atob(param));
    expect(decoded.room.width).toBe(180);
  });

  it('round-trips products through encode→decode', () => {
    const state = makeState();
    const url = encodeShareUrl(state, '');
    const param = url.split(`${SHARE_PARAM}=`)[1];
    const result = decodeShareUrl(param);
    expect(result.ok).toBe(true);
    expect(result.state.products[0]._id).toBe('p1');
  });
});

// ── decodeShareUrl ─────────────────────────────────────────────────────

describe('decodeShareUrl', () => {
  it('returns ok:false for empty string', () => {
    expect(decodeShareUrl('').ok).toBe(false);
  });

  it('returns ok:false for invalid base64', () => {
    expect(decodeShareUrl('not-base64!!!').ok).toBe(false);
  });

  it('returns ok:false for valid base64 but missing room', () => {
    const bad = btoa(JSON.stringify({ products: [] }));
    expect(decodeShareUrl(bad).ok).toBe(false);
  });

  it('sets selectedProductId to null in decoded state', () => {
    const url = encodeShareUrl(makeState({ selectedProductId: 'p1' }), '');
    const param = url.split(`${SHARE_PARAM}=`)[1];
    const result = decodeShareUrl(param);
    expect(result.state.selectedProductId).toBeNull();
  });

  it('restores all product fields', () => {
    const url = encodeShareUrl(makeState(), '');
    const param = url.split(`${SHARE_PARAM}=`)[1];
    const result = decodeShareUrl(param);
    const p = result.state.products[0];
    expect(p).toMatchObject({ _id: 'p1', x: 10, y: 20, width: 82, rotation: 0 });
  });
});

// ── getShareParamFromSearch ────────────────────────────────────────────

describe('getShareParamFromSearch', () => {
  it('extracts layout param from query string', () => {
    expect(getShareParamFromSearch(`?${SHARE_PARAM}=abc123`)).toBe('abc123');
  });

  it('returns null when param is absent', () => {
    expect(getShareParamFromSearch('?foo=bar')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(getShareParamFromSearch('')).toBeNull();
  });

  it('handles multiple params', () => {
    expect(getShareParamFromSearch(`?foo=bar&${SHARE_PARAM}=xyz&baz=qux`)).toBe('xyz');
  });
});

// ── exportToPng ────────────────────────────────────────────────────────

describe('exportToPng', () => {
  function makeCanvas(dataUrl = 'data:image/png;base64,abc') {
    return {
      toDataURL: () => dataUrl,
    };
  }

  function makeDom() {
    const links = [];
    const clicks = [];
    return {
      createElement: (tag) => {
        if (tag === 'a') {
          const link = { href: '', download: '', click: () => clicks.push(link) };
          links.push(link);
          return link;
        }
      },
      body: {
        appendChild: () => {},
        removeChild: () => {},
      },
      _links: links,
      _clicks: clicks,
    };
  }

  it('returns ok:true with dataUrl when canvas provided', () => {
    const result = exportToPng(makeCanvas(), 'test.png', makeDom());
    expect(result.ok).toBe(true);
    expect(result.dataUrl).toContain('data:image/png');
  });

  it('returns ok:false when canvas is null', () => {
    expect(exportToPng(null, 'test.png', makeDom()).ok).toBe(false);
  });

  it('returns ok:false when canvas lacks toDataURL', () => {
    expect(exportToPng({}, 'test.png', makeDom()).ok).toBe(false);
  });

  it('creates and clicks a download link', () => {
    const dom = makeDom();
    exportToPng(makeCanvas(), 'room.png', dom);
    expect(dom._clicks).toHaveLength(1);
    expect(dom._clicks[0].download).toBe('room.png');
  });

  it('sets link href to data URL', () => {
    const dataUrl = 'data:image/png;base64,xyz';
    const dom = makeDom();
    exportToPng(makeCanvas(dataUrl), 'room.png', dom);
    expect(dom._links[0].href).toBe(dataUrl);
  });
});

// ── buildExportFilename ────────────────────────────────────────────────

describe('buildExportFilename', () => {
  it('returns room-layout.png for missing room', () => {
    expect(buildExportFilename(null)).toBe('room-layout.png');
    expect(buildExportFilename(undefined)).toBe('room-layout.png');
    expect(buildExportFilename({})).toBe('room-layout.png');
  });

  it('formats dimensions in feet', () => {
    // 180in = 15ft, 144in = 12ft
    expect(buildExportFilename({ width: 180, depth: 144 })).toBe('room-15x12ft.png');
  });

  it('rounds to nearest foot', () => {
    // 125in ≈ 10.4ft → rounds to 10
    expect(buildExportFilename({ width: 125, depth: 100 })).toBe('room-10x8ft.png');
  });
});
