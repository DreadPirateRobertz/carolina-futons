import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────

const { mockGet360Images } = vi.hoisted(() => ({
  mockGet360Images: vi.fn(),
}));

vi.mock('public/product360Data.js', () => ({
  get360Images: mockGet360Images,
  has360View: vi.fn((product) => {
    const images = mockGet360Images(product?.slug || product?._id);
    return images && images.length > 0;
  }),
}));

vi.mock('public/designTokens.js', () => ({
  colors: {
    espresso: '#3A2518',
    sand: '#E8D5B7',
    sandLight: '#F2E8D5',
    mountainBlue: '#5B8FA8',
    sunsetCoral: '#E8845C',
    offWhite: '#FAF7F2',
  },
  spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px' },
  transitions: { fast: 150, medium: 250 },
}));

vi.mock('public/a11yHelpers.js', () => ({
  announce: vi.fn(),
}));

vi.mock('public/engagementTracker', () => ({
  trackVideoInteraction: vi.fn(),
}));

import { initProduct360Viewer } from '../src/public/Product360Viewer.js';

// ── Helpers ──────────────────────────────────────────────────────────

function createMockElement() {
  return {
    text: '', src: '', alt: '', html: '',
    style: { color: '', backgroundColor: '', cursor: '' },
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

const MOCK_360_IMAGES = Array.from({ length: 24 }, (_, i) => ({
  src: `https://cdn.example.com/360/nomad/frame-${String(i).padStart(2, '0')}.jpg`,
  alt: `Nomad Platform Bed - angle ${i * 15} degrees`,
}));

// ── Tests ────────────────────────────────────────────────────────────

describe('Product360Viewer', () => {
  let $w, state;

  beforeEach(() => {
    $w = create$w();
    state = {
      product: {
        _id: 'prod-nomad',
        name: 'Nomad Platform Bed',
        slug: 'nomad-platform-bed',
        collections: ['platform-beds'],
      },
    };
    mockGet360Images.mockReset();
  });

  // ── Initialization ─────────────────────────────────────────────────

  describe('initialization', () => {
    it('collapses section when product is null', async () => {
      state.product = null;
      await initProduct360Viewer($w, state);
      expect($w('#viewer360Section').collapse).toHaveBeenCalled();
    });

    it('collapses section when no 360 images exist', async () => {
      mockGet360Images.mockReturnValue([]);
      await initProduct360Viewer($w, state);
      expect($w('#viewer360Section').collapse).toHaveBeenCalled();
    });

    it('hides 360 button when no images exist', async () => {
      mockGet360Images.mockReturnValue([]);
      await initProduct360Viewer($w, state);
      expect($w('#view360Btn').hide).toHaveBeenCalled();
    });

    it('expands section when 360 images exist', async () => {
      mockGet360Images.mockReturnValue(MOCK_360_IMAGES);
      await initProduct360Viewer($w, state);
      expect($w('#viewer360Section').expand).toHaveBeenCalled();
    });

    it('shows 360 view button when images exist', async () => {
      mockGet360Images.mockReturnValue(MOCK_360_IMAGES);
      await initProduct360Viewer($w, state);
      expect($w('#view360Btn').show).toHaveBeenCalled();
    });

    it('sets section title', async () => {
      mockGet360Images.mockReturnValue(MOCK_360_IMAGES);
      await initProduct360Viewer($w, state);
      expect($w('#viewer360Title').text).toBe('360° View');
    });
  });

  // ── Viewer Interaction ─────────────────────────────────────────────

  describe('viewer interaction', () => {
    it('registers click handler on 360 button', async () => {
      mockGet360Images.mockReturnValue(MOCK_360_IMAGES);
      await initProduct360Viewer($w, state);
      expect($w('#view360Btn').onClick).toHaveBeenCalled();
    });

    it('sends image data to HtmlComponent on button click', async () => {
      mockGet360Images.mockReturnValue(MOCK_360_IMAGES);
      await initProduct360Viewer($w, state);

      const clickHandler = $w('#view360Btn').onClick.mock.calls[0][0];
      clickHandler();

      expect($w('#viewer360Embed').postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'load360',
          images: MOCK_360_IMAGES,
          productName: 'Nomad Platform Bed',
        })
      );
    });

    it('expands 360 viewer container on button click', async () => {
      mockGet360Images.mockReturnValue(MOCK_360_IMAGES);
      await initProduct360Viewer($w, state);

      const clickHandler = $w('#view360Btn').onClick.mock.calls[0][0];
      clickHandler();

      expect($w('#viewer360Container').expand).toHaveBeenCalled();
    });

    it('sets instruction text', async () => {
      mockGet360Images.mockReturnValue(MOCK_360_IMAGES);
      await initProduct360Viewer($w, state);
      expect($w('#viewer360Hint').text).toBe('Drag to rotate');
    });
  });

  // ── Accessibility ──────────────────────────────────────────────────

  describe('accessibility', () => {
    it('sets ARIA label on 360 button', async () => {
      mockGet360Images.mockReturnValue(MOCK_360_IMAGES);
      await initProduct360Viewer($w, state);
      expect($w('#view360Btn').accessibility.ariaLabel).toBe('View Nomad Platform Bed in 360 degrees');
    });

    it('sets ARIA region role on section', async () => {
      mockGet360Images.mockReturnValue(MOCK_360_IMAGES);
      await initProduct360Viewer($w, state);
      expect($w('#viewer360Section').accessibility.role).toBe('region');
    });

    it('sets ARIA label on section', async () => {
      mockGet360Images.mockReturnValue(MOCK_360_IMAGES);
      await initProduct360Viewer($w, state);
      expect($w('#viewer360Section').accessibility.ariaLabel).toBe('360 degree product view');
    });
  });

  // ── Cleanup ────────────────────────────────────────────────────────

  describe('cleanup', () => {
    it('returns a destroy function', async () => {
      mockGet360Images.mockReturnValue(MOCK_360_IMAGES);
      const result = await initProduct360Viewer($w, state);
      expect(typeof result.destroy).toBe('function');
    });

    it('collapses container on destroy', async () => {
      mockGet360Images.mockReturnValue(MOCK_360_IMAGES);
      const result = await initProduct360Viewer($w, state);
      result.destroy();
      expect($w('#viewer360Container').collapse).toHaveBeenCalled();
    });

    it('does not send messages after destroy', async () => {
      mockGet360Images.mockReturnValue(MOCK_360_IMAGES);
      const result = await initProduct360Viewer($w, state);

      const clickHandler = $w('#view360Btn').onClick.mock.calls[0][0];
      result.destroy();
      clickHandler();

      expect($w('#viewer360Embed').postMessage).not.toHaveBeenCalled();
    });
  });
});
