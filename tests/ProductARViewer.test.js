import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('public/models3d', () => ({
  getModel3DForProduct: vi.fn((id) => {
    if (id === 'prod-asheville-full') {
      return {
        productId: 'prod-asheville-full',
        glbUrl: 'https://cdn.example.com/model.glb',
        usdzUrl: 'https://cdn.example.com/model.usdz',
        dimensions: { width: 1.37, depth: 0.86, height: 0.84 },
      };
    }
    return undefined;
  }),
  hasARModel: vi.fn((id) => id === 'prod-asheville-full'),
}));

vi.mock('public/arSupport', () => ({
  checkWebARSupport: vi.fn(() => true),
  isProductAREnabled: vi.fn((p) => p?._id === 'prod-asheville-full' && p?.inStock),
}));

import { initProductARViewer } from '../src/public/ProductARViewer.js';

function createMockElement() {
  return {
    text: '', src: '', alt: '', html: '',
    style: { color: '', backgroundColor: '' },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(),
    expand: vi.fn(),
    onClick: vi.fn(),
    onMessage: vi.fn(),
    postMessage: vi.fn(),
    accessibility: {},
  };
}

function create$w() {
  const els = new Map();
  return (sel) => {
    if (!els.has(sel)) els.set(sel, createMockElement());
    return els.get(sel);
  };
}

describe('ProductARViewer', () => {
  let $w, state;

  beforeEach(() => {
    $w = create$w();
    state = {
      product: {
        _id: 'prod-asheville-full',
        name: 'Asheville Full Futon',
        collections: ['futons'],
        inStock: true,
      },
    };
  });

  describe('initProductARViewer', () => {
    it('shows the AR button for eligible product', async () => {
      await initProductARViewer($w, state);
      expect($w('#viewInRoomBtn').show).toHaveBeenCalled();
    });

    it('hides the AR button when product has no AR model', async () => {
      state.product = { _id: 'prod-no-model', name: 'No Model', collections: ['futons'], inStock: true };
      const { isProductAREnabled } = await import('public/arSupport');
      isProductAREnabled.mockReturnValueOnce(false);

      await initProductARViewer($w, state);
      expect($w('#viewInRoomBtn').hide).toHaveBeenCalled();
    });

    it('hides the AR button when product is null', async () => {
      state.product = null;
      await initProductARViewer($w, state);
      expect($w('#viewInRoomBtn').hide).toHaveBeenCalled();
    });

    it('registers click handler on AR button', async () => {
      await initProductARViewer($w, state);
      expect($w('#viewInRoomBtn').onClick).toHaveBeenCalled();
    });

    it('sends model data to HtmlComponent on button click', async () => {
      await initProductARViewer($w, state);

      const clickHandler = $w('#viewInRoomBtn').onClick.mock.calls[0][0];
      clickHandler();

      expect($w('#productARViewer').postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'loadModel',
          glbUrl: 'https://cdn.example.com/model.glb',
          usdzUrl: 'https://cdn.example.com/model.usdz',
          title: 'Asheville Full Futon',
        })
      );
    });

    it('expands the AR viewer container on button click', async () => {
      await initProductARViewer($w, state);

      const clickHandler = $w('#viewInRoomBtn').onClick.mock.calls[0][0];
      clickHandler();

      expect($w('#arViewerContainer').expand).toHaveBeenCalled();
    });

    it('returns a destroy function', async () => {
      const result = await initProductARViewer($w, state);
      expect(typeof result.destroy).toBe('function');
    });

    it('collapses viewer on destroy', async () => {
      const result = await initProductARViewer($w, state);
      result.destroy();
      expect($w('#arViewerContainer').collapse).toHaveBeenCalled();
    });
  });
});
