/**
 * Tests for room-planner-canvas.html postMessage protocol and interaction logic.
 *
 * Since the HtmlComponent runs in an iframe, we test the protocol contract:
 * - Messages the page sends IN → expected state changes
 * - Messages the canvas sends OUT → expected shape
 * - Interaction sequences (add, move, rotate, remove, export)
 *
 * These tests verify the same logic inlined in the HTML by reimplementing the
 * pure state functions and testing the message flow contract.
 */
import { describe, it, expect, beforeEach } from 'vitest';

// ── Inline logic mirror (matches room-planner-canvas.html) ──────────

function getProductBounds(p) {
  const depth = p.isBedMode ? (p.depthBed || p.depth) : p.depth;
  const isSwapped = p.rotation === 90 || p.rotation === 270;
  return {
    x: p.x, y: p.y,
    w: isSwapped ? depth : p.width,
    h: isSwapped ? p.width : depth,
  };
}

function checkFit(p, roomWidth, roomLength) {
  const b = getProductBounds(p);
  if (b.x < 0 || b.y < 0) return false;
  return (b.x + b.w <= roomWidth) && (b.y + b.h <= roomLength);
}

// ── Simulated Canvas State Machine ──────────────────────────────────

function createCanvasState() {
  let roomWidth = 0;
  let roomLength = 0;
  let products = [];
  let selectedId = null;
  const messages = [];

  function notifyParent() {
    const summary = products.map(p => ({
      id: p.id, x: p.x, y: p.y,
      fits: checkFit(p, roomWidth, roomLength),
      label: p.label || '',
    }));
    messages.push({ type: 'canvasUpdate', products: summary });
  }

  function handleMessage(data) {
    if (!data || !data.type) return;

    switch (data.type) {
      case 'updateRoom':
        roomWidth = Math.max(0, Number(data.roomWidth) || 0);
        roomLength = Math.max(0, Number(data.roomLength) || 0);
        notifyParent();
        break;

      case 'addProduct':
        if (data.product && data.product.id) {
          products.push({
            id: data.product.id,
            productType: data.product.productType || '',
            label: data.product.label || '',
            x: Number(data.product.x) || 0,
            y: Number(data.product.y) || 0,
            width: Number(data.product.width) || 20,
            depth: Number(data.product.depth) || 20,
            depthBed: Number(data.product.depthBed) || Number(data.product.depth) || 20,
            rotation: Number(data.product.rotation) || 0,
            isBedMode: Boolean(data.product.isBedMode),
          });
          selectedId = data.product.id;
          notifyParent();
        }
        break;

      case 'removeProduct':
        if (data.id) {
          products = products.filter(p => p.id !== data.id);
          if (selectedId === data.id) selectedId = null;
          notifyParent();
        }
        break;

      case 'exportImage':
        messages.push({ type: 'exportResult', dataUrl: 'data:image/png;base64,MOCK' });
        break;
    }
  }

  return {
    handleMessage,
    getState: () => ({ roomWidth, roomLength, products: [...products], selectedId }),
    getMessages: () => [...messages],
    clearMessages: () => { messages.length = 0; },
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe('Room Planner Canvas HTML — postMessage protocol', () => {
  let state;

  beforeEach(() => {
    state = createCanvasState();
  });

  // ── updateRoom ───────────��──────────────────────────────────────

  describe('updateRoom message', () => {
    it('sets room dimensions from message', () => {
      state.handleMessage({ type: 'updateRoom', roomWidth: 120, roomLength: 144 });
      const s = state.getState();
      expect(s.roomWidth).toBe(120);
      expect(s.roomLength).toBe(144);
    });

    it('clamps negative dimensions to zero', () => {
      state.handleMessage({ type: 'updateRoom', roomWidth: -10, roomLength: -5 });
      const s = state.getState();
      expect(s.roomWidth).toBe(0);
      expect(s.roomLength).toBe(0);
    });

    it('handles non-numeric dimensions', () => {
      state.handleMessage({ type: 'updateRoom', roomWidth: 'abc', roomLength: null });
      const s = state.getState();
      expect(s.roomWidth).toBe(0);
      expect(s.roomLength).toBe(0);
    });

    it('sends canvasUpdate after room update', () => {
      state.handleMessage({ type: 'updateRoom', roomWidth: 120, roomLength: 144 });
      const msgs = state.getMessages();
      expect(msgs).toHaveLength(1);
      expect(msgs[0].type).toBe('canvasUpdate');
      expect(msgs[0].products).toEqual([]);
    });
  });

  // ── addProduct ──────────────────────────────────────────────────

  describe('addProduct message', () => {
    it('adds a product to the state', () => {
      state.handleMessage({ type: 'updateRoom', roomWidth: 120, roomLength: 120 });
      state.handleMessage({
        type: 'addProduct',
        product: { id: 'p1', productType: 'futon-frame-full', label: 'Full Futon', x: 10, y: 10, width: 82, depth: 38, depthBed: 54 },
      });
      const s = state.getState();
      expect(s.products).toHaveLength(1);
      expect(s.products[0].id).toBe('p1');
      expect(s.products[0].label).toBe('Full Futon');
    });

    it('selects the newly added product', () => {
      state.handleMessage({
        type: 'addProduct',
        product: { id: 'p1', productType: 'end-table', label: 'Table', x: 0, y: 0, width: 20, depth: 20 },
      });
      expect(state.getState().selectedId).toBe('p1');
    });

    it('sends canvasUpdate with fit status', () => {
      state.handleMessage({ type: 'updateRoom', roomWidth: 100, roomLength: 100 });
      state.clearMessages();
      state.handleMessage({
        type: 'addProduct',
        product: { id: 'p1', label: 'Big Futon', x: 0, y: 0, width: 82, depth: 38, depthBed: 54 },
      });
      const msgs = state.getMessages();
      expect(msgs).toHaveLength(1);
      expect(msgs[0].products[0].fits).toBe(true);
    });

    it('reports no-fit when product exceeds room', () => {
      state.handleMessage({ type: 'updateRoom', roomWidth: 50, roomLength: 50 });
      state.clearMessages();
      state.handleMessage({
        type: 'addProduct',
        product: { id: 'p1', label: 'Big Futon', x: 0, y: 0, width: 82, depth: 38 },
      });
      const msgs = state.getMessages();
      expect(msgs[0].products[0].fits).toBe(false);
    });

    it('defaults missing dimensions to 20', () => {
      state.handleMessage({
        type: 'addProduct',
        product: { id: 'p1', label: 'Unknown' },
      });
      const p = state.getState().products[0];
      expect(p.width).toBe(20);
      expect(p.depth).toBe(20);
    });

    it('ignores addProduct without product.id', () => {
      state.handleMessage({ type: 'addProduct', product: { label: 'No ID' } });
      expect(state.getState().products).toHaveLength(0);
    });

    it('ignores addProduct without product object', () => {
      state.handleMessage({ type: 'addProduct' });
      expect(state.getState().products).toHaveLength(0);
    });

    it('can add multiple products', () => {
      state.handleMessage({ type: 'addProduct', product: { id: 'p1', width: 20, depth: 20 } });
      state.handleMessage({ type: 'addProduct', product: { id: 'p2', width: 30, depth: 30 } });
      state.handleMessage({ type: 'addProduct', product: { id: 'p3', width: 40, depth: 40 } });
      expect(state.getState().products).toHaveLength(3);
    });
  });

  // ── removeProduct ───────────────────────────────────────────────

  describe('removeProduct message', () => {
    it('removes product by id', () => {
      state.handleMessage({ type: 'addProduct', product: { id: 'p1', width: 20, depth: 20 } });
      state.handleMessage({ type: 'addProduct', product: { id: 'p2', width: 20, depth: 20 } });
      state.handleMessage({ type: 'removeProduct', id: 'p1' });
      const s = state.getState();
      expect(s.products).toHaveLength(1);
      expect(s.products[0].id).toBe('p2');
    });

    it('clears selection if removed product was selected', () => {
      state.handleMessage({ type: 'addProduct', product: { id: 'p1', width: 20, depth: 20 } });
      expect(state.getState().selectedId).toBe('p1');
      state.handleMessage({ type: 'removeProduct', id: 'p1' });
      expect(state.getState().selectedId).toBeNull();
    });

    it('keeps selection if different product removed', () => {
      state.handleMessage({ type: 'addProduct', product: { id: 'p1', width: 20, depth: 20 } });
      state.handleMessage({ type: 'addProduct', product: { id: 'p2', width: 20, depth: 20 } });
      // p2 is selected (last added)
      state.handleMessage({ type: 'removeProduct', id: 'p1' });
      expect(state.getState().selectedId).toBe('p2');
    });

    it('no-ops for unknown id', () => {
      state.handleMessage({ type: 'addProduct', product: { id: 'p1', width: 20, depth: 20 } });
      state.handleMessage({ type: 'removeProduct', id: 'nonexistent' });
      expect(state.getState().products).toHaveLength(1);
    });

    it('sends canvasUpdate after removal', () => {
      state.handleMessage({ type: 'addProduct', product: { id: 'p1', width: 20, depth: 20 } });
      state.clearMessages();
      state.handleMessage({ type: 'removeProduct', id: 'p1' });
      const msgs = state.getMessages();
      expect(msgs).toHaveLength(1);
      expect(msgs[0].type).toBe('canvasUpdate');
      expect(msgs[0].products).toHaveLength(0);
    });
  });

  // ── exportImage ─────────────────────────────���───────────────────

  describe('exportImage message', () => {
    it('sends exportResult with dataUrl', () => {
      state.handleMessage({ type: 'exportImage' });
      const msgs = state.getMessages();
      const exportMsg = msgs.find(m => m.type === 'exportResult');
      expect(exportMsg).toBeDefined();
      expect(exportMsg.dataUrl).toContain('data:image/png');
    });
  });

  // ── Invalid messages ───────────────────────────────────��────────

  describe('invalid messages', () => {
    it('ignores null data', () => {
      state.handleMessage(null);
      expect(state.getMessages()).toHaveLength(0);
    });

    it('ignores data without type', () => {
      state.handleMessage({ foo: 'bar' });
      expect(state.getMessages()).toHaveLength(0);
    });

    it('ignores unknown message type', () => {
      state.handleMessage({ type: 'unknownType' });
      expect(state.getMessages()).toHaveLength(0);
    });
  });
});

// ── getProductBounds / checkFit (contract parity with roomPlannerCanvas.js) ──

describe('Room Planner Canvas HTML — fit checking', () => {
  it('fits product fully within room', () => {
    const p = { x: 0, y: 0, width: 82, depth: 38, rotation: 0, isBedMode: false };
    expect(checkFit(p, 100, 100)).toBe(true);
  });

  it('rejects product exceeding room width', () => {
    const p = { x: 0, y: 0, width: 82, depth: 38, rotation: 0, isBedMode: false };
    expect(checkFit(p, 80, 100)).toBe(false);
  });

  it('rejects product exceeding room length', () => {
    const p = { x: 0, y: 0, width: 82, depth: 38, rotation: 0, isBedMode: false };
    expect(checkFit(p, 100, 30)).toBe(false);
  });

  it('rejects negative position', () => {
    const p = { x: -1, y: 0, width: 20, depth: 20, rotation: 0, isBedMode: false };
    expect(checkFit(p, 100, 100)).toBe(false);
  });

  it('handles bed mode (larger depth)', () => {
    const p = { x: 0, y: 0, width: 82, depth: 38, depthBed: 54, rotation: 0, isBedMode: true };
    // In bed mode depth=54, so needs 54 in length
    expect(checkFit(p, 100, 53)).toBe(false);
    expect(checkFit(p, 100, 54)).toBe(true);
  });

  it('handles rotation (90°) — swaps width and depth', () => {
    const p = { x: 0, y: 0, width: 82, depth: 38, rotation: 90, isBedMode: false };
    // Rotated: w=38, h=82
    const b = getProductBounds(p);
    expect(b.w).toBe(38);
    expect(b.h).toBe(82);
  });

  it('handles rotation (270°) — swaps width and depth', () => {
    const p = { x: 0, y: 0, width: 82, depth: 38, rotation: 270, isBedMode: false };
    const b = getProductBounds(p);
    expect(b.w).toBe(38);
    expect(b.h).toBe(82);
  });

  it('rotation 0 and 180 keep original orientation', () => {
    const p = { x: 0, y: 0, width: 82, depth: 38, rotation: 180, isBedMode: false };
    const b = getProductBounds(p);
    expect(b.w).toBe(82);
    expect(b.h).toBe(38);
  });

  it('product exactly filling room edge fits', () => {
    const p = { x: 18, y: 0, width: 82, depth: 38, rotation: 0, isBedMode: false };
    // x(18) + w(82) = 100 <= roomWidth(100)
    expect(checkFit(p, 100, 100)).toBe(true);
  });

  it('product one inch past room edge does not fit', () => {
    const p = { x: 19, y: 0, width: 82, depth: 38, rotation: 0, isBedMode: false };
    // x(19) + w(82) = 101 > roomWidth(100)
    expect(checkFit(p, 100, 100)).toBe(false);
  });
});

// ── Integration sequence tests ─────────────────────────────��────────

describe('Room Planner Canvas HTML — interaction sequences', () => {
  let state;

  beforeEach(() => {
    state = createCanvasState();
  });

  it('full workflow: set room → add products → verify fit', () => {
    state.handleMessage({ type: 'updateRoom', roomWidth: 180, roomLength: 144 });

    state.handleMessage({
      type: 'addProduct',
      product: { id: 'futon', productType: 'futon-frame-full', label: 'Full Futon', x: 10, y: 10, width: 82, depth: 38 },
    });
    state.handleMessage({
      type: 'addProduct',
      product: { id: 'table', productType: 'coffee-table', label: 'Coffee Table', x: 100, y: 10, width: 48, depth: 24 },
    });

    const msgs = state.getMessages();
    const lastUpdate = msgs.filter(m => m.type === 'canvasUpdate').pop();
    expect(lastUpdate.products).toHaveLength(2);
    expect(lastUpdate.products.every(p => p.fits)).toBe(true);
  });

  it('add product then remove it leaves empty canvas', () => {
    state.handleMessage({ type: 'updateRoom', roomWidth: 100, roomLength: 100 });
    state.handleMessage({ type: 'addProduct', product: { id: 'p1', width: 20, depth: 20 } });
    state.handleMessage({ type: 'removeProduct', id: 'p1' });

    const msgs = state.getMessages();
    const lastUpdate = msgs.filter(m => m.type === 'canvasUpdate').pop();
    expect(lastUpdate.products).toHaveLength(0);
  });

  it('changing room dimensions re-evaluates fit of existing products', () => {
    // Add product that fits in big room
    state.handleMessage({ type: 'updateRoom', roomWidth: 200, roomLength: 200 });
    state.handleMessage({
      type: 'addProduct',
      product: { id: 'futon', x: 100, y: 100, width: 82, depth: 38 },
    });
    state.clearMessages();

    // Shrink room — product no longer fits
    state.handleMessage({ type: 'updateRoom', roomWidth: 50, roomLength: 50 });
    const msgs = state.getMessages();
    expect(msgs[0].products[0].fits).toBe(false);
  });

  it('export after adding products returns dataUrl', () => {
    state.handleMessage({ type: 'updateRoom', roomWidth: 120, roomLength: 120 });
    state.handleMessage({ type: 'addProduct', product: { id: 'p1', width: 20, depth: 20 } });
    state.handleMessage({ type: 'exportImage' });

    const exportMsg = state.getMessages().find(m => m.type === 'exportResult');
    expect(exportMsg).toBeDefined();
    expect(exportMsg.dataUrl).toBeTruthy();
  });
});
