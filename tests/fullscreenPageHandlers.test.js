import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '',
    options: [], data: [],
    style: { color: '', fontWeight: '' },
    accessibility: {},
    hidden: false,
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(), expand: vi.fn(),
    scrollTo: vi.fn(), postMessage: vi.fn(),
    onClick: vi.fn(), onChange: vi.fn(),
    onItemReady: vi.fn(), onItemClicked: vi.fn(),
    onPlay: vi.fn(), onPause: vi.fn(), onEnded: vi.fn(),
    play: vi.fn(),
    onReady: vi.fn(() => Promise.resolve()),
    setFilter: vi.fn(), setSort: vi.fn(),
    focus: vi.fn(),
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

// ── Mock Backend Modules ────────────────────────────────────────────

vi.mock('wix-data', () => ({
  default: {
    query: vi.fn(),
    filter: vi.fn(() => ({
      contains: vi.fn((field, value) => ({ _field: field, _value: value })),
    })),
  },
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
  trackGalleryInteraction: vi.fn(),
}));

vi.mock('public/designTokens.js', () => ({
  typography: { h2: { weight: 700 }, body: { weight: 400 } },
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
  makeClickable: vi.fn((el, handler, opts) => {
    el._clickHandler = handler;
    el._a11yOpts = opts;
  }),
}));

vi.mock('public/mobileHelpers', () => ({
  initBackToTop: vi.fn(),
  collapseOnMobile: vi.fn(),
}));

vi.mock('wix-location-frontend', () => ({
  to: vi.fn(),
}));

const { trackEvent, trackGalleryInteraction } = await import('public/engagementTracker');
const { announce, makeClickable } = await import('public/a11yHelpers');
const wixData = (await import('wix-data')).default;

// ── Import Page ─────────────────────────────────────────────────────

describe('Fullscreen Page — handler behavior', () => {
  beforeAll(async () => {
    await import('../src/pages/Fullscreen Page.js');
  });

  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  // ── playVideo behavior ──────────────────────────────────────────

  describe('playVideo — via thumbnail click', () => {
    async function clickVideoThumb(videoData) {
      await onReadyHandler();
      const repeater = getEl('#videosRepeater');
      const onItemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = new Map();
      const $item = (sel) => {
        if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
        return itemElements.get(sel);
      };

      onItemReadyCb($item, videoData);

      // Invoke the click handler registered via makeClickable on #videoThumb
      const thumbEl = $item('#videoThumb');
      thumbEl._clickHandler();
    }

    it('sets videoPlayer src to the video URL', async () => {
      await clickVideoThumb({ title: 'Asheville Demo', thumbnail: 't.jpg', videoUrl: 'https://cdn/asheville.mp4', category: 'futon' });
      expect(getEl('#videoPlayer').src).toBe('https://cdn/asheville.mp4');
    });

    it('calls player.play()', async () => {
      await clickVideoThumb({ title: 'Asheville Demo', thumbnail: 't.jpg', videoUrl: 'https://cdn/asheville.mp4' });
      expect(getEl('#videoPlayer').play).toHaveBeenCalled();
    });

    it('tracks video_play via trackGalleryInteraction', async () => {
      await clickVideoThumb({ title: 'Asheville Demo', thumbnail: 't.jpg', videoUrl: 'https://cdn/asheville.mp4' });
      expect(trackGalleryInteraction).toHaveBeenCalledWith('video_play');
    });

    it('tracks video_play event with title and category', async () => {
      await clickVideoThumb({ title: 'Asheville Demo', thumbnail: 't.jpg', videoUrl: 'https://cdn/asheville.mp4', category: 'futon' });
      expect(trackEvent).toHaveBeenCalledWith('video_play', { title: 'Asheville Demo', category: 'futon' });
    });

    it('shows videoProductLink when productSlug is present', async () => {
      await clickVideoThumb({ title: 'Asheville', thumbnail: 't.jpg', videoUrl: 'v.mp4', productSlug: 'asheville-futon' });
      expect(getEl('#videoProductLink').show).toHaveBeenCalled();
    });

    it('does not show videoProductLink when productSlug is absent', async () => {
      await clickVideoThumb({ title: 'Intro Video', thumbnail: 't.jpg', videoUrl: 'intro.mp4' });
      expect(getEl('#videoProductLink').show).not.toHaveBeenCalled();
    });
  });

  // ── videoProductLink navigation ─────────────────────────────────

  describe('videoProductLink — navigation to product page', () => {
    it('navigates to product page using stored slug on click', async () => {
      const wixLocation = await import('wix-location-frontend');

      await onReadyHandler();

      // First play a video with a productSlug to set currentVideoProductSlug
      const repeater = getEl('#videosRepeater');
      const onItemReadyCb = repeater.onItemReady.mock.calls[0][0];
      const itemElements = new Map();
      const $item = (sel) => {
        if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
        return itemElements.get(sel);
      };
      onItemReadyCb($item, { title: 'Sedona', thumbnail: 't.jpg', videoUrl: 'v.mp4', productSlug: 'sedona-futon' });
      $item('#videoThumb')._clickHandler();

      // Now click the product link
      const productLink = getEl('#videoProductLink');
      productLink._clickHandler();

      // Wait for dynamic import to resolve
      await new Promise(r => setTimeout(r, 10));

      expect(wixLocation.to).toHaveBeenCalledWith('/product-page/sedona-futon');
    });
  });

  // ── onPlay/onPause/onEnded handler behavior ─────────────────────

  describe('video player event handler behavior', () => {
    it('onPlay hides videoOverlay with fade animation', async () => {
      await onReadyHandler();
      const player = getEl('#videoPlayer');
      const onPlayCb = player.onPlay.mock.calls[0][0];
      onPlayCb();
      expect(getEl('#videoOverlay').hide).toHaveBeenCalledWith('fade', { duration: 300 });
    });

    it('onPause shows videoOverlay with fade animation', async () => {
      await onReadyHandler();
      const player = getEl('#videoPlayer');
      const onPauseCb = player.onPause.mock.calls[0][0];
      onPauseCb();
      expect(getEl('#videoOverlay').show).toHaveBeenCalledWith('fade', { duration: 300 });
    });

    it('onEnded shows both videoOverlay and videoShopCTA', async () => {
      await onReadyHandler();
      const player = getEl('#videoPlayer');
      const onEndedCb = player.onEnded.mock.calls[0][0];
      onEndedCb();
      expect(getEl('#videoOverlay').show).toHaveBeenCalledWith('fade', { duration: 300 });
      expect(getEl('#videoShopCTA').show).toHaveBeenCalledWith('fade', { duration: 400 });
    });
  });

  // ── filterVideosByCategory ──────────────────────────────────────

  describe('filterVideosByCategory — via filter button click', () => {
    it('clicking "All" filter clears dataset filter', async () => {
      await onReadyHandler();
      const allBtn = getEl('#videoFilterAll');
      allBtn._clickHandler();
      expect(getEl('#videosDataset').setFilter).toHaveBeenCalled();
      expect(wixData.filter).toHaveBeenCalled();
    });

    it('clicking "Futons" filter sets contains filter on category', async () => {
      await onReadyHandler();
      const futonBtn = getEl('#videoFilterFutons');
      futonBtn._clickHandler();
      expect(getEl('#videosDataset').setFilter).toHaveBeenCalled();
    });

    it('clicking filter announces the active filter to screen readers', async () => {
      await onReadyHandler();
      const murphyBtn = getEl('#videoFilterMurphy');
      murphyBtn._clickHandler();
      expect(announce).toHaveBeenCalledWith($w, 'Showing filter murphy bed videos');
    });

    it('clicking filter bolds the active button and unbolds others', async () => {
      await onReadyHandler();
      const futonBtn = getEl('#videoFilterFutons');
      futonBtn._clickHandler();

      expect(getEl('#videoFilterFutons').style.fontWeight).toBe('700');
      expect(getEl('#videoFilterAll').style.fontWeight).toBe('400');
      expect(getEl('#videoFilterMurphy').style.fontWeight).toBe('400');
      expect(getEl('#videoFilterPlatform').style.fontWeight).toBe('400');
    });

    it('clicking filter sets ariaPressed on active button only', async () => {
      await onReadyHandler();
      const platformBtn = getEl('#videoFilterPlatform');
      platformBtn._clickHandler();

      expect(getEl('#videoFilterPlatform').accessibility.ariaPressed).toBe(true);
      expect(getEl('#videoFilterAll').accessibility.ariaPressed).toBe(false);
      expect(getEl('#videoFilterFutons').accessibility.ariaPressed).toBe(false);
      expect(getEl('#videoFilterMurphy').accessibility.ariaPressed).toBe(false);
    });
  });

  // ── onItemReady — edge cases ──────────────────────────────────────

  describe('onItemReady — edge cases', () => {
    async function setupItemReady(itemData) {
      await onReadyHandler();
      const repeater = getEl('#videosRepeater');
      const onItemReadyCb = repeater.onItemReady.mock.calls[0][0];
      const itemElements = new Map();
      const $item = (sel) => {
        if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
        return itemElements.get(sel);
      };
      onItemReadyCb($item, itemData);
      return $item;
    }

    it('hides category badge when category is not provided', async () => {
      const $item = await setupItemReady({ title: 'Intro', thumbnail: 't.jpg' });
      // Badge show should NOT be called when no category
      expect($item('#videoCategoryBadge').show).not.toHaveBeenCalled();
    });

    it('does not set duration when duration is not provided', async () => {
      const $item = await setupItemReady({ title: 'Test', thumbnail: 't.jpg' });
      expect($item('#videoDuration').text).toBe('');
    });

    it('sets alt text with brand suffix', async () => {
      const $item = await setupItemReady({ title: 'Maricopa Demo', thumbnail: 't.jpg' });
      expect($item('#videoThumb').alt).toBe('Maricopa Demo product demo video - Carolina Futons');
    });
  });
});
