import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    src: '',
    alt: '',
    value: '',
    collapsed: false,
    style: { color: '', backgroundColor: '' },
    accessibility: { ariaLabel: '', role: '' },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(function () { this.collapsed = true; }),
    expand: vi.fn(function () { this.collapsed = false; }),
    data: [],
    onClick: vi.fn(),
    onKeyPress: vi.fn(),
    onBlur: vi.fn(),
    onItemReady: vi.fn(),
  };
}

function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockElement());
  return elements.get(sel);
}

let onReadyHandler = null;

globalThis.$w = Object.assign(
  (sel) => getEl(sel),
  { onReady: (fn) => { onReadyHandler = fn; } }
);

// ── Mock Dependencies ───────────────────────────────────────────────

vi.mock('wix-data', () => ({
  default: {
    query: vi.fn().mockReturnValue({
      contains: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      find: vi.fn().mockResolvedValue({
        items: [
          { _id: 'p1', name: 'Monterey Futon Frame', slug: 'monterey-futon-frame', formattedPrice: '$899', mainMedia: 'img1.jpg' },
          { _id: 'p2', name: 'Kingston Platform Bed', slug: 'kingston-platform-bed', formattedPrice: '$1,299', mainMedia: 'img2.jpg' },
        ],
      }),
    }),
  },
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
}));

vi.mock('public/mobileHelpers', () => ({
  isMobile: vi.fn().mockReturnValue(false),
}));

vi.mock('wix-location-frontend', () => ({
  to: vi.fn(),
}));

// ── Tests ───────────────────────────────────────────────────────────

beforeEach(() => {
  elements.clear();
  onReadyHandler = null;
  vi.clearAllMocks();
});

describe('Search Suggestions Box', () => {
  beforeEach(async () => {
    vi.resetModules();
    await import('../src/pages/Search Suggestions Box.js');
  });

  it('registers an onReady handler', () => {
    expect(onReadyHandler).toBeInstanceOf(Function);
  });

  describe('page initialization', () => {
    it('registers onItemReady on suggestions repeater', async () => {
      await onReadyHandler();
      const repeater = getEl('#suggestionsRepeater');
      expect(repeater.onItemReady).toHaveBeenCalled();
    });

    it('registers onKeyPress on search input', async () => {
      await onReadyHandler();
      const input = getEl('#searchInput');
      expect(input.onKeyPress).toHaveBeenCalled();
    });

    it('registers onBlur on search input', async () => {
      await onReadyHandler();
      const input = getEl('#searchInput');
      expect(input.onBlur).toHaveBeenCalled();
    });

    it('sets aria-label on search input', async () => {
      await onReadyHandler();
      const input = getEl('#searchInput');
      expect(input.accessibility.ariaLabel).toBe('Search products');
    });
  });

  describe('suggestions repeater onItemReady', () => {
    it('sets product image, name, and price', async () => {
      await onReadyHandler();
      const repeater = getEl('#suggestionsRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const $item = (sel) => getEl(`_sug_${sel}`);
      itemReadyCb($item, { _id: 'p1', name: 'Monterey Futon', slug: 'monterey', price: '$899', image: 'img.jpg' });

      expect(getEl('_sug_#sugImage').src).toBe('img.jpg');
      expect(getEl('_sug_#sugName').text).toBe('Monterey Futon');
      expect(getEl('_sug_#sugPrice').text).toBe('$899');
    });

    it('sets alt text on suggestion image', async () => {
      await onReadyHandler();
      const repeater = getEl('#suggestionsRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const $item = (sel) => getEl(`_sug2_${sel}`);
      itemReadyCb($item, { _id: 'p2', name: 'Kingston Bed', slug: 'kingston', price: '$1,299', image: 'img2.jpg' });

      expect(getEl('_sug2_#sugImage').alt).toBe('Kingston Bed');
    });

    it('wires onClick navigation on image and name', async () => {
      await onReadyHandler();
      const repeater = getEl('#suggestionsRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const $item = (sel) => getEl(`_sug3_${sel}`);
      itemReadyCb($item, { _id: 'p3', name: 'Test', slug: 'test-slug', price: '$99', image: 'img.jpg' });

      expect(getEl('_sug3_#sugImage').onClick).toHaveBeenCalled();
      expect(getEl('_sug3_#sugName').onClick).toHaveBeenCalled();
    });
  });

  describe('search behavior', () => {
    it('collapses suggestions for queries shorter than 2 chars', async () => {
      await onReadyHandler();
      const input = getEl('#searchInput');
      input.value = 'a';

      const keyPressCb = input.onKeyPress.mock.calls[0][0];
      keyPressCb({ key: 'a' });

      const box = getEl('#suggestionsBox');
      expect(box.collapse).toHaveBeenCalled();
    });

    it('collapses suggestions for empty query', async () => {
      await onReadyHandler();
      const input = getEl('#searchInput');
      input.value = '';

      const keyPressCb = input.onKeyPress.mock.calls[0][0];
      keyPressCb({ key: 'Backspace' });

      const box = getEl('#suggestionsBox');
      expect(box.collapse).toHaveBeenCalled();
    });

    it('debounces search with 300ms delay', async () => {
      vi.useFakeTimers();
      await onReadyHandler();
      const input = getEl('#searchInput');
      input.value = 'futon frame';

      const keyPressCb = input.onKeyPress.mock.calls[0][0];
      keyPressCb({ key: 'e' });

      const wixData = (await import('wix-data')).default;

      // Before timer fires, query should not be called yet
      expect(wixData.query).not.toHaveBeenCalled();

      // After 300ms, search should fire
      await vi.advanceTimersByTimeAsync(300);

      expect(wixData.query).toHaveBeenCalledWith('Stores/Products');
      vi.useRealTimers();
    });

    it('expands suggestions box when results found', async () => {
      vi.useFakeTimers();
      await onReadyHandler();
      const input = getEl('#searchInput');
      input.value = 'monterey';

      const keyPressCb = input.onKeyPress.mock.calls[0][0];
      keyPressCb({ key: 'y' });

      await vi.advanceTimersByTimeAsync(300);

      const box = getEl('#suggestionsBox');
      expect(box.expand).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('announces result count for accessibility', async () => {
      vi.useFakeTimers();
      await onReadyHandler();
      const input = getEl('#searchInput');
      input.value = 'monterey';

      const keyPressCb = input.onKeyPress.mock.calls[0][0];
      keyPressCb({ key: 'y' });

      await vi.advanceTimersByTimeAsync(300);

      const { announce } = await import('public/a11yHelpers');
      expect(announce).toHaveBeenCalledWith(expect.any(Function), '2 suggestions found');
      vi.useRealTimers();
    });

    it('navigates to search results on Enter', async () => {
      await onReadyHandler();
      const input = getEl('#searchInput');
      input.value = 'futon';

      const keyPressCb = input.onKeyPress.mock.calls[0][0];
      keyPressCb({ key: 'Enter' });

      const box = getEl('#suggestionsBox');
      expect(box.collapse).toHaveBeenCalled();
    });
  });

  describe('blur behavior', () => {
    it('registers blur handler to collapse suggestions', async () => {
      await onReadyHandler();
      const input = getEl('#searchInput');
      expect(input.onBlur).toHaveBeenCalled();
    });
  });

  describe('search product mapping', () => {
    it('uses limit of 5 on desktop', async () => {
      vi.useFakeTimers();
      await onReadyHandler();
      const input = getEl('#searchInput');
      input.value = 'futon';

      const keyPressCb = input.onKeyPress.mock.calls[0][0];
      keyPressCb({ key: 'n' });

      await vi.advanceTimersByTimeAsync(300);

      const wixData = (await import('wix-data')).default;
      const queryChain = wixData.query();
      expect(queryChain.limit).toHaveBeenCalledWith(5);
      vi.useRealTimers();
    });

    it('uses limit of 3 on mobile', async () => {
      const { isMobile } = await import('public/mobileHelpers');
      isMobile.mockReturnValue(true);

      vi.useFakeTimers();

      // Need fresh import to pick up mobile mock
      vi.resetModules();
      elements.clear();
      onReadyHandler = null;
      await import('../src/pages/Search Suggestions Box.js');
      await onReadyHandler();

      const input = getEl('#searchInput');
      input.value = 'futon';

      const keyPressCb = input.onKeyPress.mock.calls[0][0];
      keyPressCb({ key: 'n' });

      await vi.advanceTimersByTimeAsync(300);

      const wixData = (await import('wix-data')).default;
      const queryChain = wixData.query();
      expect(queryChain.limit).toHaveBeenCalledWith(3);
      vi.useRealTimers();
    });

    it('populates repeater data from search results', async () => {
      vi.useFakeTimers();
      await onReadyHandler();
      const input = getEl('#searchInput');
      input.value = 'monterey';

      const keyPressCb = input.onKeyPress.mock.calls[0][0];
      keyPressCb({ key: 'y' });

      await vi.advanceTimersByTimeAsync(300);

      const repeater = getEl('#suggestionsRepeater');
      expect(repeater.data).toHaveLength(2);
      expect(repeater.data[0].name).toBe('Monterey Futon Frame');
      expect(repeater.data[0].slug).toBe('monterey-futon-frame');
      vi.useRealTimers();
    });
  });

  describe('suggestion click navigation', () => {
    it('tracks search_suggestion_click event on navigation', async () => {
      await onReadyHandler();
      const repeater = getEl('#suggestionsRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const $item = (sel) => getEl(`_nav_${sel}`);
      itemReadyCb($item, { _id: 'p1', name: 'Test', slug: 'test-product', price: '$99', image: 'img.jpg' });

      // Simulate click on image
      const imgClickCb = getEl('_nav_#sugImage').onClick.mock.calls[0][0];
      imgClickCb();

      const { trackEvent } = await import('public/engagementTracker');
      expect(trackEvent).toHaveBeenCalledWith('search_suggestion_click', { slug: 'test-product' });
    });
  });
});
