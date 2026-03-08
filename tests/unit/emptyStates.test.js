import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement(id) {
  return {
    _id: id,
    text: '',
    src: '',
    alt: '',
    label: '',
    hidden: true,
    style: { color: '', backgroundColor: '' },
    accessibility: {
      ariaLabel: '',
      ariaHidden: undefined,
      ariaLive: undefined,
      role: undefined,
    },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(),
    expand: vi.fn(),
    focus: vi.fn(),
    scrollTo: vi.fn(),
    onClick: vi.fn(),
    onKeyPress: vi.fn(),
    disable: vi.fn(),
    enable: vi.fn(),
  };
}

function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockElement(sel));
  return elements.get(sel);
}

// ── Mock Modules ────────────────────────────────────────────────────

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
  makeClickable: vi.fn((el, handler) => {
    if (el && handler) el.onClick(handler);
  }),
}));

vi.mock('wix-location-frontend', () => ({
  to: vi.fn(),
}));

// Use real illustrations module (no mock needed — it's pure data)

// ── Import Module Under Test ────────────────────────────────────────

import {
  EMPTY_STATE_CONTENT,
  renderEmptyState,
  hideEmptyState,
  showSkeletons,
  hideSkeletons,
  withSkeleton,
  showSpinner,
  hideSpinner,
  showErrorState,
} from '../../src/public/emptyStates.js';

import { announce } from 'public/a11yHelpers';

// ── Tests ───────────────────────────────────────────────────────────

describe('Empty States & Loading Skeletons', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  // ── EMPTY_STATE_CONTENT registry ──────────────────────────────────

  describe('EMPTY_STATE_CONTENT', () => {
    it('has all required empty state types', () => {
      const keys = Object.keys(EMPTY_STATE_CONTENT);
      expect(keys).toContain('cart');
      expect(keys).toContain('search');
      expect(keys).toContain('wishlist');
      expect(keys).toContain('reviews');
      expect(keys).toContain('category');
      expect(keys).toContain('error');
      expect(keys).toContain('notFound');
      expect(keys).toContain('sideCart');
    });

    it('every state has required fields', () => {
      Object.entries(EMPTY_STATE_CONTENT).forEach(([key, content]) => {
        expect(content.title, `${key}.title`).toBeTruthy();
        expect(content.message, `${key}.message`).toBeTruthy();
        expect(content.ctaLabel, `${key}.ctaLabel`).toBeTruthy();
        expect(content.illustrationAlt, `${key}.illustrationAlt`).toBeTruthy();
        expect(content.ariaLabel, `${key}.ariaLabel`).toBeTruthy();
      });
    });

    it('cart state has mountain-themed messaging', () => {
      expect(EMPTY_STATE_CONTENT.cart.title).toContain('mountain');
    });

    it('search state has "searched every peak" messaging', () => {
      expect(EMPTY_STATE_CONTENT.search.title).toContain('searched every peak');
    });

    it('wishlist state has "Start your" CTA', () => {
      expect(EMPTY_STATE_CONTENT.wishlist.title).toContain('Start your');
    });

    it('reviews state encourages first review', () => {
      expect(EMPTY_STATE_CONTENT.reviews.title).toContain('first');
    });

    it('error state has friendly bridge metaphor', () => {
      expect(EMPTY_STATE_CONTENT.error.title).toContain('trail washed out');
    });

    it('notFound state has lost hiker metaphor', () => {
      expect(EMPTY_STATE_CONTENT.notFound.title).toContain('Lost on the mountain');
    });

    it('states with ctaPath point to valid paths', () => {
      Object.values(EMPTY_STATE_CONTENT).forEach(content => {
        if (content.ctaPath) {
          expect(content.ctaPath).toMatch(/^\//);
        }
      });
    });
  });

  // ── renderEmptyState ──────────────────────────────────────────────

  describe('renderEmptyState', () => {
    it('shows the empty section', () => {
      renderEmptyState(getEl, 'cart');
      expect(getEl('#EmptySection').show).toHaveBeenCalledWith('fade', { duration: 250 });
    });

    it('sets title text from content registry', () => {
      renderEmptyState(getEl, 'cart');
      expect(getEl('#EmptyTitle').text).toBe(EMPTY_STATE_CONTENT.cart.title);
    });

    it('sets message text from content registry', () => {
      renderEmptyState(getEl, 'cart');
      expect(getEl('#EmptyMessage').text).toBe(EMPTY_STATE_CONTENT.cart.message);
    });

    it('sets title color to Espresso', () => {
      renderEmptyState(getEl, 'cart');
      expect(getEl('#EmptyTitle').style.color).toBe('#3A2518');
    });

    it('sets message color to Espresso Light', () => {
      renderEmptyState(getEl, 'cart');
      expect(getEl('#EmptyMessage').style.color).toBe('#5C4033');
    });

    it('sets illustration alt text', () => {
      renderEmptyState(getEl, 'cart');
      expect(getEl('#EmptyIllustration').alt).toBe(EMPTY_STATE_CONTENT.cart.illustrationAlt);
    });

    it('sets CTA button label', () => {
      renderEmptyState(getEl, 'cart');
      expect(getEl('#EmptyCta').label).toBe('Start Shopping');
    });

    it('sets aria-label on CTA button', () => {
      renderEmptyState(getEl, 'cart');
      expect(getEl('#EmptyCta').accessibility.ariaLabel).toBe('Start Shopping');
    });

    it('wires CTA onClick for navigation', () => {
      renderEmptyState(getEl, 'cart');
      expect(getEl('#EmptyCta').onClick).toHaveBeenCalled();
    });

    it('sets ARIA role=status on section', () => {
      renderEmptyState(getEl, 'cart');
      expect(getEl('#EmptySection').accessibility.role).toBe('status');
    });

    it('sets ariaLabel on section', () => {
      renderEmptyState(getEl, 'cart');
      expect(getEl('#EmptySection').accessibility.ariaLabel).toBe('Empty shopping cart');
    });

    it('announces empty state to screen readers', () => {
      renderEmptyState(getEl, 'cart');
      expect(announce).toHaveBeenCalledWith(getEl, 'Empty shopping cart');
    });

    it('uses prefix for element IDs', () => {
      renderEmptyState(getEl, 'sideCart', { prefix: 'sideCart' });
      expect(getEl('#sideCartEmptyTitle').text).toBe(EMPTY_STATE_CONTENT.sideCart.title);
      expect(getEl('#sideCartEmptySection').show).toHaveBeenCalled();
    });

    it('uses custom message when provided', () => {
      renderEmptyState(getEl, 'search', { customMessage: 'Custom: no futons found' });
      expect(getEl('#EmptyMessage').text).toBe('Custom: no futons found');
    });

    it('uses custom onCtaClick handler', () => {
      const handler = vi.fn();
      renderEmptyState(getEl, 'error', { onCtaClick: handler });
      expect(getEl('#EmptyCta').onClick).toHaveBeenCalled();
      // Get the registered handler and call it
      const registered = getEl('#EmptyCta').onClick.mock.calls[0][0];
      registered();
      expect(handler).toHaveBeenCalled();
    });

    it('renders search suggestions when provided', () => {
      renderEmptyState(getEl, 'search', {
        suggestions: ['futon frames', 'mattresses', 'murphy beds'],
      });
      expect(getEl('#searchSuggestionsList').text).toContain('futon frames');
      expect(getEl('#searchSuggestionsList').show).toHaveBeenCalled();
    });

    it('does nothing for unknown state key', () => {
      expect(() => renderEmptyState(getEl, 'nonexistent')).not.toThrow();
    });

    it('renders all state types without errors', () => {
      Object.keys(EMPTY_STATE_CONTENT).forEach(key => {
        elements.clear();
        expect(() => renderEmptyState(getEl, key)).not.toThrow();
      });
    });
  });

  // ── hideEmptyState ────────────────────────────────────────────────

  describe('hideEmptyState', () => {
    it('hides the empty section', () => {
      hideEmptyState(getEl);
      expect(getEl('#EmptySection').hide).toHaveBeenCalledWith('fade', { duration: 150 });
    });

    it('uses prefix for element ID', () => {
      hideEmptyState(getEl, 'sideCart');
      expect(getEl('#sideCartEmptySection').hide).toHaveBeenCalled();
    });

    it('does not throw when element missing', () => {
      expect(() => hideEmptyState(getEl, 'nonexistent')).not.toThrow();
    });
  });

  // ── Loading Skeletons ─────────────────────────────────────────────

  describe('showSkeletons', () => {
    it('shows all skeleton elements', () => {
      showSkeletons(getEl, ['#skeleton1', '#skeleton2', '#skeleton3']);
      expect(getEl('#skeleton1').show).toHaveBeenCalledWith('fade', { duration: 150 });
      expect(getEl('#skeleton2').show).toHaveBeenCalled();
      expect(getEl('#skeleton3').show).toHaveBeenCalled();
    });

    it('sets ariaHidden=true on skeletons', () => {
      showSkeletons(getEl, ['#skeleton1']);
      expect(getEl('#skeleton1').accessibility.ariaHidden).toBe(true);
    });

    it('announces loading state', () => {
      showSkeletons(getEl, ['#skeleton1']);
      expect(announce).toHaveBeenCalledWith(getEl, 'Loading content');
    });

    it('handles empty array', () => {
      expect(() => showSkeletons(getEl, [])).not.toThrow();
    });

    it('handles null/undefined', () => {
      expect(() => showSkeletons(getEl, null)).not.toThrow();
      expect(() => showSkeletons(getEl, undefined)).not.toThrow();
    });
  });

  describe('hideSkeletons', () => {
    it('hides all skeleton elements', () => {
      hideSkeletons(getEl, ['#skeleton1', '#skeleton2']);
      expect(getEl('#skeleton1').hide).toHaveBeenCalledWith('fade', { duration: 150 });
      expect(getEl('#skeleton2').hide).toHaveBeenCalled();
    });

    it('handles empty array', () => {
      expect(() => hideSkeletons(getEl, [])).not.toThrow();
    });

    it('handles null/undefined', () => {
      expect(() => hideSkeletons(getEl, null)).not.toThrow();
    });
  });

  // ── withSkeleton ──────────────────────────────────────────────────

  describe('withSkeleton', () => {
    it('shows skeletons, runs loader, hides skeletons on success', async () => {
      const loader = vi.fn().mockResolvedValue('data');
      const result = await withSkeleton(getEl, ['#sk1'], loader);
      expect(getEl('#sk1').show).toHaveBeenCalled();
      expect(loader).toHaveBeenCalled();
      expect(getEl('#sk1').hide).toHaveBeenCalled();
      expect(result).toBe('data');
    });

    it('hides skeletons on error', async () => {
      const loader = vi.fn().mockRejectedValue(new Error('fail'));
      await expect(withSkeleton(getEl, ['#sk1'], loader)).rejects.toThrow('fail');
      expect(getEl('#sk1').hide).toHaveBeenCalled();
    });

    it('renders error state on failure', async () => {
      const loader = vi.fn().mockRejectedValue(new Error('network'));
      try {
        await withSkeleton(getEl, ['#sk1'], loader);
      } catch (e) {}
      // Error state should be rendered
      expect(getEl('#EmptyTitle').text).toBe(EMPTY_STATE_CONTENT.error.title);
    });

    it('calls custom onError instead of rendering error state', async () => {
      const onError = vi.fn();
      const loader = vi.fn().mockRejectedValue(new Error('custom'));
      try {
        await withSkeleton(getEl, ['#sk1'], loader, { onError });
      } catch (e) {}
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      // Default error state should NOT be rendered
      expect(getEl('#EmptyTitle').text).toBe('');
    });

    it('error state retry button re-runs withSkeleton', async () => {
      let callCount = 0;
      const loader = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.reject(new Error('first'));
        return Promise.resolve('success');
      });

      try {
        await withSkeleton(getEl, ['#sk1'], loader);
      } catch (e) {}

      // CTA should be wired with retry
      expect(getEl('#EmptyCta').onClick).toHaveBeenCalled();
    });
  });

  // ── Loading Spinner ───────────────────────────────────────────────

  describe('showSpinner', () => {
    it('shows the mountain spinner', () => {
      showSpinner(getEl);
      expect(getEl('#mountainSpinner').show).toHaveBeenCalledWith('fade', { duration: 150 });
    });

    it('sets ariaLabel for loading', () => {
      showSpinner(getEl);
      expect(getEl('#mountainSpinner').accessibility.ariaLabel).toBe('Loading, please wait');
    });

    it('sets role=progressbar', () => {
      showSpinner(getEl);
      expect(getEl('#mountainSpinner').accessibility.role).toBe('progressbar');
    });

    it('announces loading state', () => {
      showSpinner(getEl);
      expect(announce).toHaveBeenCalledWith(getEl, 'Loading');
    });

    it('uses custom spinner ID', () => {
      showSpinner(getEl, '#customSpinner');
      expect(getEl('#customSpinner').show).toHaveBeenCalled();
    });
  });

  describe('hideSpinner', () => {
    it('hides the mountain spinner', () => {
      hideSpinner(getEl);
      expect(getEl('#mountainSpinner').hide).toHaveBeenCalledWith('fade', { duration: 150 });
    });

    it('uses custom spinner ID', () => {
      hideSpinner(getEl, '#customSpinner');
      expect(getEl('#customSpinner').hide).toHaveBeenCalled();
    });
  });

  // ── showErrorState ────────────────────────────────────────────────

  describe('showErrorState', () => {
    it('renders error empty state', () => {
      showErrorState(getEl);
      expect(getEl('#EmptyTitle').text).toBe(EMPTY_STATE_CONTENT.error.title);
    });

    it('uses custom error message', () => {
      showErrorState(getEl, { message: 'Server is on fire' });
      expect(getEl('#EmptyMessage').text).toBe('Server is on fire');
    });

    it('uses custom prefix', () => {
      showErrorState(getEl, { prefix: 'product' });
      expect(getEl('#productEmptyTitle').text).toBe(EMPTY_STATE_CONTENT.error.title);
    });

    it('wires custom retry handler', () => {
      const retry = vi.fn();
      showErrorState(getEl, { onRetry: retry });
      expect(getEl('#EmptyCta').onClick).toHaveBeenCalled();
      const registered = getEl('#EmptyCta').onClick.mock.calls[0][0];
      registered();
      expect(retry).toHaveBeenCalled();
    });

    it('falls back to home navigation when no retry provided', () => {
      showErrorState(getEl);
      expect(getEl('#EmptyCta').onClick).toHaveBeenCalled();
    });
  });

  // ── Accessibility ─────────────────────────────────────────────────

  describe('accessibility', () => {
    it('all empty states have aria labels', () => {
      Object.keys(EMPTY_STATE_CONTENT).forEach(key => {
        elements.clear();
        renderEmptyState(getEl, key);
        expect(announce).toHaveBeenCalledWith(getEl, EMPTY_STATE_CONTENT[key].ariaLabel);
      });
    });

    it('all illustrations have descriptive alt text', () => {
      Object.entries(EMPTY_STATE_CONTENT).forEach(([key, content]) => {
        expect(content.illustrationAlt.length).toBeGreaterThan(10);
        expect(content.illustrationAlt).not.toMatch(/^image$/i);
      });
    });

    it('spinner has progressbar role', () => {
      showSpinner(getEl);
      expect(getEl('#mountainSpinner').accessibility.role).toBe('progressbar');
    });

    it('skeletons are hidden from screen readers', () => {
      showSkeletons(getEl, ['#sk1']);
      expect(getEl('#sk1').accessibility.ariaHidden).toBe(true);
    });
  });

  // ── Edge Cases ────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('renderEmptyState tolerates missing elements gracefully', () => {
      // All element access is wrapped in try/catch, so no throws
      expect(() => renderEmptyState(getEl, 'cart')).not.toThrow();
    });

    it('withSkeleton propagates loader errors', async () => {
      const loader = vi.fn().mockRejectedValue(new Error('API down'));
      await expect(withSkeleton(getEl, ['#sk1'], loader)).rejects.toThrow('API down');
    });

    it('withSkeleton works with empty skeleton array', async () => {
      const loader = vi.fn().mockResolvedValue('ok');
      const result = await withSkeleton(getEl, [], loader);
      expect(result).toBe('ok');
    });

    it('renderEmptyState search without suggestions does not throw', () => {
      expect(() => renderEmptyState(getEl, 'search')).not.toThrow();
    });

    it('showErrorState without options does not throw', () => {
      expect(() => showErrorState(getEl)).not.toThrow();
    });
  });

  // ── Illustration Integration ─────────────────────────────────────

  describe('illustration integration', () => {
    it('renderEmptyState sets illustration src to a data URI', () => {
      renderEmptyState(getEl, 'cart');
      const src = getEl('#EmptyIllustration').src;
      expect(src).toMatch(/^data:image\/svg\+xml/);
    });

    it('all 8 states set illustration src', () => {
      Object.keys(EMPTY_STATE_CONTENT).forEach(key => {
        elements.clear();
        renderEmptyState(getEl, key);
        const src = getEl('#EmptyIllustration').src;
        expect(src, `${key} missing illustration src`).toMatch(/^data:image\/svg\+xml/);
      });
    });

    it('prefixed empty state sets prefixed illustration src', () => {
      renderEmptyState(getEl, 'sideCart', { prefix: 'sideCart' });
      const src = getEl('#sideCartEmptyIllustration').src;
      expect(src).toMatch(/^data:image\/svg\+xml/);
    });
  });
});
