/**
 * Tests for CF-cxe: CompleteTheLookWidget public module.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initCompleteTheLook } from '../src/public/CompleteTheLookWidget.js';

function makeStub() {
  const elements = {};
  function getEl(sel) {
    if (!elements[sel]) {
      elements[sel] = {
        src: '',
        text: '',
        show: vi.fn(),
        hide: vi.fn(),
        expand: vi.fn(),
        collapse: vi.fn(),
        data: [],
        _onItemReady: null,
        onItemReady: vi.fn(function (fn) { this._onItemReady = fn; }),
      };
    }
    return elements[sel];
  }
  const $w = vi.fn(getEl);
  return { $w, elements, getEl };
}

function makeItemStub() {
  const inner = {};
  function get(sel) {
    if (!inner[sel]) inner[sel] = { src: '', text: '', onClick: vi.fn((cb) => { inner[sel]._clickCb = cb; }) };
    return inner[sel];
  }
  return { $item: vi.fn(get), inner };
}

describe('initCompleteTheLook', () => {
  let getCompleteTheLook;

  beforeEach(() => {
    getCompleteTheLook = vi.fn();
  });

  it('collapses container when productId is falsy', async () => {
    const { $w, elements } = makeStub();
    await initCompleteTheLook($w, '', { getCompleteTheLook });
    expect(elements['#ctlContainer'].collapse).toHaveBeenCalled();
    expect(getCompleteTheLook).not.toHaveBeenCalled();
  });

  it('collapses container when no look is returned', async () => {
    const { $w, elements } = makeStub();
    getCompleteTheLook.mockResolvedValue(null);
    await initCompleteTheLook($w, 'futon-a', { getCompleteTheLook });
    expect(elements['#ctlContainer'].collapse).toHaveBeenCalled();
  });

  it('collapses container when roomItems is empty', async () => {
    const { $w, elements } = makeStub();
    getCompleteTheLook.mockResolvedValue({ productId: 'futon-a', roomHeroImage: 'h.jpg', roomItems: [] });
    await initCompleteTheLook($w, 'futon-a', { getCompleteTheLook });
    expect(elements['#ctlContainer'].collapse).toHaveBeenCalled();
  });

  it('renders hero + items when look exists', async () => {
    const { $w, elements } = makeStub();
    getCompleteTheLook.mockResolvedValue({
      productId: 'futon-a',
      roomHeroImage: 'hero.jpg',
      roomItems: [
        { productId: 'rug-01', imageUrl: 'rug.jpg', name: 'Rug', price: 199 },
        { productId: 'lamp-01', imageUrl: 'lamp.jpg', name: 'Lamp', price: 89 },
      ],
    });
    await initCompleteTheLook($w, 'futon-a', { getCompleteTheLook });

    expect(elements['#ctlContainer'].expand).toHaveBeenCalled();
    expect(elements['#ctlHeroImage'].src).toBe('hero.jpg');
    expect(elements['#ctlItemsRepeater'].data).toHaveLength(2);
    expect(elements['#ctlItemsRepeater'].data[0]._id).toBe('rug-01');

    // Invoke onItemReady for first item
    const itemStub = makeItemStub();
    elements['#ctlItemsRepeater']._onItemReady(itemStub.$item, elements['#ctlItemsRepeater'].data[0]);
    expect(itemStub.inner['#itemImage'].src).toBe('rug.jpg');
    expect(itemStub.inner['#itemName'].text).toBe('Rug');
    expect(itemStub.inner['#itemPrice'].text).toBe('$199.00');
  });

  it('handles missing price and name gracefully in repeater render', async () => {
    const { $w, elements } = makeStub();
    getCompleteTheLook.mockResolvedValue({
      productId: 'futon-a',
      roomHeroImage: 'h.jpg',
      roomItems: [{ productId: 'x', imageUrl: '', name: '', price: 0 }],
    });
    await initCompleteTheLook($w, 'futon-a', { getCompleteTheLook });
    const itemStub = makeItemStub();
    elements['#ctlItemsRepeater']._onItemReady(itemStub.$item, elements['#ctlItemsRepeater'].data[0]);
    expect(itemStub.inner['#itemPrice'].text).toBe('');
    expect(itemStub.inner['#itemName'].text).toBe('');
  });

  it('synthesizes _id when item lacks productId', async () => {
    const { $w, elements } = makeStub();
    getCompleteTheLook.mockResolvedValue({
      productId: 'futon-a',
      roomHeroImage: 'h.jpg',
      roomItems: [{ productId: '', imageUrl: 'i', name: 'n', price: 5 }],
    });
    await initCompleteTheLook($w, 'futon-a', { getCompleteTheLook });
    expect(elements['#ctlItemsRepeater'].data[0]._id).toBe('ctl-0');
  });

  it('uses default import when opts.getCompleteTheLook is omitted', async () => {
    const { $w, elements } = makeStub();
    // Default backend call will fail in the test env — widget should catch and collapse
    await initCompleteTheLook($w, 'futon-a');
    expect(elements['#ctlContainer'].collapse).toHaveBeenCalled();
  });

  it('shows error and collapses when fetch rejects', async () => {
    const { $w, elements } = makeStub();
    getCompleteTheLook.mockRejectedValue(new Error('network'));
    await initCompleteTheLook($w, 'futon-a', { getCompleteTheLook });
    expect(elements['#ctlError'].show).toHaveBeenCalled();
    expect(elements['#ctlContainer'].collapse).toHaveBeenCalled();
  });

  it('skips hero src update when roomHeroImage is empty', async () => {
    const { $w, elements } = makeStub();
    getCompleteTheLook.mockResolvedValue({
      productId: 'futon-a',
      roomHeroImage: '',
      roomItems: [{ productId: 'p', imageUrl: 'i', name: 'n', price: 1 }],
    });
    await initCompleteTheLook($w, 'futon-a', { getCompleteTheLook });
    expect(elements['#ctlHeroImage']).toBeUndefined();
    expect(elements['#ctlContainer'].expand).toHaveBeenCalled();
  });

  it('wires add-to-cart CTA for each repeater item', async () => {
    const { $w, elements } = makeStub();
    const addToCart = vi.fn().mockResolvedValue({ success: true });
    getCompleteTheLook.mockResolvedValue({
      productId: 'futon-a',
      roomHeroImage: 'h.jpg',
      roomItems: [{ productId: 'rug-1', imageUrl: 'r.jpg', name: 'Rug', price: 99 }],
    });
    await initCompleteTheLook($w, 'futon-a', { getCompleteTheLook, addToCart });

    const itemStub = makeItemStub();
    elements['#ctlItemsRepeater']._onItemReady(itemStub.$item, elements['#ctlItemsRepeater'].data[0]);

    expect(itemStub.inner['#itemAddToCart'].onClick).toHaveBeenCalled();
    // Simulate click
    await itemStub.inner['#itemAddToCart']._clickCb?.();
    expect(addToCart).toHaveBeenCalledWith('rug-1', 1);
  });
});
