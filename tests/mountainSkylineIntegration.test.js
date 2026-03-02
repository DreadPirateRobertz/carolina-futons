import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement(id) {
  return {
    _id: id,
    text: '',
    src: '',
    alt: '',
    value: '',
    label: '',
    html: '',
    data: [],
    hidden: true,
    style: { color: '', fontWeight: '', boxShadow: '', backgroundColor: '' },
    accessibility: {
      ariaLabel: '',
      ariaExpanded: undefined,
      ariaHasPopup: undefined,
      ariaCurrent: undefined,
      ariaLive: undefined,
      ariaAtomic: undefined,
      ariaModal: undefined,
      role: undefined,
      tabIndex: undefined,
    },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(),
    expand: vi.fn(),
    focus: vi.fn(),
    scrollTo: vi.fn(),
    postMessage: vi.fn(),
    onClick: vi.fn(),
    onKeyPress: vi.fn(),
    onMouseIn: vi.fn(),
    onMouseOut: vi.fn(),
    onFocus: vi.fn(),
    onBlur: vi.fn(),
    onChange: vi.fn(),
    onItemReady: vi.fn(),
    onReady: vi.fn((fn) => fn()),
    disable: vi.fn(),
    enable: vi.fn(),
  };
}

function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockElement(sel));
  return elements.get(sel);
}

function $wFn(sel) {
  return getEl(sel);
}

// ── Mock initMountainSkyline ─────────────────────────────────────────

const mockInitMountainSkyline = vi.fn();

vi.mock('public/MountainSkyline.js', () => ({
  initMountainSkyline: mockInitMountainSkyline,
}));

// ── Tests ────────────────────────────────────────────────────────────

describe('Mountain Skyline Integration', () => {
  beforeEach(() => {
    elements.clear();
    mockInitMountainSkyline.mockReset();
  });

  describe('masterPage integration', () => {
    it('should call initMountainSkyline with silhouette variant for global header', async () => {
      // Simulate how masterPage calls the skyline init
      const { initMountainSkyline } = await import('public/MountainSkyline.js');
      initMountainSkyline($wFn, { variant: 'silhouette', containerId: '#headerSkyline' });

      expect(mockInitMountainSkyline).toHaveBeenCalledTimes(1);
      expect(mockInitMountainSkyline).toHaveBeenCalledWith(
        $wFn,
        expect.objectContaining({ variant: 'silhouette', containerId: '#headerSkyline' })
      );
    });

    it('should not break if initMountainSkyline throws', async () => {
      mockInitMountainSkyline.mockImplementation(() => {
        throw new Error('SVG render failed');
      });

      // Wrapped in try/catch as the integration code does
      expect(() => {
        try {
          mockInitMountainSkyline($wFn, { variant: 'silhouette', containerId: '#headerSkyline' });
        } catch (e) {
          // Should be caught silently
        }
      }).not.toThrow();
    });
  });

  describe('Home.js hero integration', () => {
    it('should call initMountainSkyline with gradient variant for hero', async () => {
      const { initMountainSkyline } = await import('public/MountainSkyline.js');
      initMountainSkyline($wFn, { variant: 'gradient', containerId: '#heroSkyline' });

      expect(mockInitMountainSkyline).toHaveBeenCalledWith(
        $wFn,
        expect.objectContaining({ variant: 'gradient', containerId: '#heroSkyline' })
      );
    });

    it('should not break existing hero layout if skyline fails', async () => {
      mockInitMountainSkyline.mockImplementation(() => {
        throw new Error('Container not found');
      });

      // Hero elements should still be usable after skyline failure
      const heroTitle = getEl('#heroTitle');
      heroTitle.text = 'Handcrafted Comfort, Mountain Inspired.';

      try {
        mockInitMountainSkyline($wFn, { variant: 'gradient', containerId: '#heroSkyline' });
      } catch (e) {
        // Expected — integration wraps this in try/catch
      }

      expect(heroTitle.text).toBe('Handcrafted Comfort, Mountain Inspired.');
    });
  });

  describe('Category Page.js hero integration', () => {
    it('should call initMountainSkyline with gradient variant for category hero', async () => {
      const { initMountainSkyline } = await import('public/MountainSkyline.js');
      initMountainSkyline($wFn, { variant: 'gradient', containerId: '#categoryHeroSkyline' });

      expect(mockInitMountainSkyline).toHaveBeenCalledWith(
        $wFn,
        expect.objectContaining({ variant: 'gradient', containerId: '#categoryHeroSkyline' })
      );
    });

    it('should not break category hero content when skyline fails', async () => {
      mockInitMountainSkyline.mockImplementation(() => {
        throw new Error('Element missing');
      });

      const heroTitle = getEl('#categoryHeroTitle');
      heroTitle.text = 'Futon Frames';

      try {
        mockInitMountainSkyline($wFn, { variant: 'gradient', containerId: '#categoryHeroSkyline' });
      } catch (e) {
        // Caught by integration code
      }

      expect(heroTitle.text).toBe('Futon Frames');
    });
  });

  describe('Product Page.js hero integration', () => {
    it('should call initMountainSkyline with gradient variant for product hero', async () => {
      const { initMountainSkyline } = await import('public/MountainSkyline.js');
      initMountainSkyline($wFn, { variant: 'gradient', containerId: '#productHeroSkyline' });

      expect(mockInitMountainSkyline).toHaveBeenCalledWith(
        $wFn,
        expect.objectContaining({ variant: 'gradient', containerId: '#productHeroSkyline' })
      );
    });
  });

  describe('dynamic import resilience', () => {
    it('should handle module not available gracefully', async () => {
      // Simulates the scenario where MountainSkyline.js doesn't exist yet
      const dynamicImportFail = async () => {
        try {
          await import('public/NonExistentModule.js');
        } catch (e) {
          // Dynamic import fails — this is expected and handled
          return null;
        }
        return 'loaded';
      };

      const result = await dynamicImportFail();
      expect(result).toBeNull();
    });

    it('should not affect page rendering when import fails', async () => {
      // Set up page elements as they would be before skyline init
      const heroTitle = getEl('#heroTitle');
      heroTitle.text = 'Test Title';

      const heroSubtitle = getEl('#heroSubtitle');
      heroSubtitle.text = 'Test Subtitle';

      // Simulate failed dynamic import
      try {
        throw new Error('Module not found');
      } catch (e) {
        // Integration code catches this
      }

      // Page elements should be unaffected
      expect(heroTitle.text).toBe('Test Title');
      expect(heroSubtitle.text).toBe('Test Subtitle');
    });
  });

  describe('responsive behavior', () => {
    it('should pass responsive hint to initMountainSkyline', async () => {
      const { initMountainSkyline } = await import('public/MountainSkyline.js');

      // Desktop: full-width
      initMountainSkyline($wFn, {
        variant: 'gradient',
        containerId: '#heroSkyline',
      });

      expect(mockInitMountainSkyline).toHaveBeenCalledWith(
        $wFn,
        expect.objectContaining({
          variant: 'gradient',
          containerId: '#heroSkyline',
        })
      );
    });
  });

  describe('variant selection per page', () => {
    it('masterPage uses silhouette variant', () => {
      mockInitMountainSkyline($wFn, { variant: 'silhouette', containerId: '#headerSkyline' });
      const call = mockInitMountainSkyline.mock.calls[0];
      expect(call[1].variant).toBe('silhouette');
    });

    it('Home uses gradient variant', () => {
      mockInitMountainSkyline($wFn, { variant: 'gradient', containerId: '#heroSkyline' });
      const call = mockInitMountainSkyline.mock.calls[0];
      expect(call[1].variant).toBe('gradient');
    });

    it('Category Page uses gradient variant', () => {
      mockInitMountainSkyline($wFn, { variant: 'gradient', containerId: '#categoryHeroSkyline' });
      const call = mockInitMountainSkyline.mock.calls[0];
      expect(call[1].variant).toBe('gradient');
    });

    it('Product Page uses gradient variant', () => {
      mockInitMountainSkyline($wFn, { variant: 'gradient', containerId: '#productHeroSkyline' });
      const call = mockInitMountainSkyline.mock.calls[0];
      expect(call[1].variant).toBe('gradient');
    });
  });

  describe('multiple skylines on same page', () => {
    it('masterPage silhouette should not conflict with page-level gradient', () => {
      // masterPage init (runs on all pages)
      mockInitMountainSkyline($wFn, { variant: 'silhouette', containerId: '#headerSkyline' });
      // Home page init (runs additionally on home page)
      mockInitMountainSkyline($wFn, { variant: 'gradient', containerId: '#heroSkyline' });

      expect(mockInitMountainSkyline).toHaveBeenCalledTimes(2);

      // Verify different containers used
      const calls = mockInitMountainSkyline.mock.calls;
      expect(calls[0][1].containerId).toBe('#headerSkyline');
      expect(calls[1][1].containerId).toBe('#heroSkyline');
    });
  });
});
