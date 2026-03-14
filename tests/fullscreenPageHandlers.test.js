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
    onKeyPress: vi.fn(),
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

// ── Mock Dependencies ───────────────────────────────────────────────

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
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
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

vi.mock('public/videoPageHelpers.js', () => ({
  getVideoData: vi.fn(() => [
    { _id: 'vid-intro', title: 'Intro', description: 'Welcome', category: 'overview', videoUrl: 'https://cdn/intro.mp4', posterUrl: 'https://cdn/intro.jpg', sortOrder: 0 },
    { _id: 'vid-asheville', title: 'Asheville', description: 'Asheville demo', category: 'futon', videoUrl: 'https://cdn/asheville.mp4', posterUrl: 'https://cdn/asheville.jpg', productSlug: 'asheville-futon-frame', sortOrder: 1 },
    { _id: 'vid-studio', title: 'Studio Conversion', description: 'Studio demo', category: 'conversion', videoUrl: 'https://cdn/studio.mp4', posterUrl: 'https://cdn/studio.jpg', sortOrder: 8 },
  ]),
  getVideoCategories: vi.fn(() => [
    { id: 'overview', label: 'Overview' },
    { id: 'futon', label: 'Futon Frames' },
    { id: 'conversion', label: 'Conversion Demos' },
  ]),
  filterVideosByCategory: vi.fn((videos, cat) => {
    if (!cat) return videos;
    return videos.filter(v => v.category === cat);
  }),
}));

vi.mock('wix-location-frontend', () => ({
  to: vi.fn(),
}));

const { trackEvent } = await import('public/engagementTracker');
const { announce, makeClickable } = await import('public/a11yHelpers');
const { initBackToTop } = await import('public/mobileHelpers');
const { initPageSeo } = await import('public/pageSeo.js');
const { getVideoData } = await import('public/videoPageHelpers.js');

// ── Import Page ─────────────────────────────────────────────────────

describe('Fullscreen Page — Product Videos', () => {
  beforeAll(async () => {
    await import('../src/pages/Fullscreen Page.js');
  });

  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  // ── Initialization ──────────────────────────────────────────────

  describe('onReady initialization', () => {
    it('calls initBackToTop', async () => {
      await onReadyHandler();
      expect(initBackToTop).toHaveBeenCalledWith($w);
    });

    it('sets page heading text', async () => {
      await onReadyHandler();
      expect(getEl('#videoPageTitle').text).toBe('Product Videos');
    });

    it('sets page subtitle', async () => {
      await onReadyHandler();
      expect(getEl('#videoPageSubtitle').text).toMatch(/futon frames.*Murphy beds/);
    });

    it('calls initPageSeo with product-videos', async () => {
      await onReadyHandler();
      expect(initPageSeo).toHaveBeenCalledWith('product-videos');
    });

    it('tracks page_view event', async () => {
      await onReadyHandler();
      expect(trackEvent).toHaveBeenCalledWith('page_view', { page: 'product_videos' });
    });
  });

  // ── Video Grid ──────────────────────────────────────────────────

  describe('video grid', () => {
    it('sets repeater data from getVideoData', async () => {
      await onReadyHandler();
      const repeater = getEl('#videosRepeater');
      expect(repeater.data).toHaveLength(3);
      expect(repeater.data[0].title).toBe('Intro');
    });

    it('sets ARIA label on repeater', async () => {
      await onReadyHandler();
      expect(getEl('#videosRepeater').accessibility.ariaLabel).toBe('Product demo videos');
    });

    it('registers onItemReady handler', async () => {
      await onReadyHandler();
      expect(getEl('#videosRepeater').onItemReady).toHaveBeenCalled();
    });

    describe('onItemReady', () => {
      async function setupItem(itemData) {
        await onReadyHandler();
        const repeater = getEl('#videosRepeater');
        const cb = repeater.onItemReady.mock.calls[0][0];
        const itemEls = new Map();
        const $item = (sel) => {
          if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
          return itemEls.get(sel);
        };
        cb($item, itemData);
        return $item;
      }

      it('sets video title', async () => {
        const $item = await setupItem({ _id: 'v1', title: 'Asheville', posterUrl: 'p.jpg', category: 'futon' });
        expect($item('#videoTitle').text).toBe('Asheville');
      });

      it('sets description text', async () => {
        const $item = await setupItem({ _id: 'v1', title: 'Asheville', description: 'A demo', category: 'futon' });
        expect($item('#videoDescription').text).toBe('A demo');
      });

      it('sets poster image src and alt', async () => {
        const $item = await setupItem({ _id: 'v1', title: 'Sedona', posterUrl: 'https://cdn/poster.jpg', category: 'futon' });
        expect($item('#videoThumb').src).toBe('https://cdn/poster.jpg');
        expect($item('#videoThumb').alt).toBe('Sedona product demo video');
      });

      it('sets category badge for futon', async () => {
        const $item = await setupItem({ _id: 'v1', title: 'Test', category: 'futon' });
        expect($item('#videoCategoryBadge').text).toBe('Futon Frame');
      });

      it('sets category badge for conversion', async () => {
        const $item = await setupItem({ _id: 'v1', title: 'Test', category: 'conversion' });
        expect($item('#videoCategoryBadge').text).toBe('Conversion Demo');
      });

      it('sets category badge for overview', async () => {
        const $item = await setupItem({ _id: 'v1', title: 'Test', category: 'overview' });
        expect($item('#videoCategoryBadge').text).toBe('Overview');
      });

      it('registers makeClickable on thumbnail with play handler', async () => {
        const $item = await setupItem({ _id: 'v1', title: 'Alpine', posterUrl: 'p.jpg', category: 'futon' });
        expect(makeClickable).toHaveBeenCalledWith(
          $item('#videoThumb'),
          expect.any(Function),
          { ariaLabel: 'Play Alpine video', role: 'button' }
        );
      });
    });
  });

  // ── Category Filters ────────────────────────────────────────────

  describe('category filters', () => {
    it('sets category repeater data with All option first', async () => {
      await onReadyHandler();
      const catRepeater = getEl('#videoCategoryRepeater');
      expect(catRepeater.data[0].label).toBe('All Videos');
      expect(catRepeater.data).toHaveLength(4);
    });

    it('sets ARIA role tablist on category repeater', async () => {
      await onReadyHandler();
      expect(getEl('#videoCategoryRepeater').accessibility.role).toBe('tablist');
    });

    it('registers onItemReady on category repeater', async () => {
      await onReadyHandler();
      expect(getEl('#videoCategoryRepeater').onItemReady).toHaveBeenCalled();
    });

    describe('category onItemReady', () => {
      async function setupCatItem(catData) {
        await onReadyHandler();
        const catRepeater = getEl('#videoCategoryRepeater');
        const cb = catRepeater.onItemReady.mock.calls[0][0];
        const itemEls = new Map();
        const $item = (sel) => {
          if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
          return itemEls.get(sel);
        };
        cb($item, catData);
        return $item;
      }

      it('sets category label text', async () => {
        const $item = await setupCatItem({ _id: 'cat-futon', id: 'futon', label: 'Futon Frames' });
        expect($item('#categoryLabel').text).toBe('Futon Frames');
      });

      it('sets ARIA role tab on label', async () => {
        const $item = await setupCatItem({ _id: 'cat-futon', id: 'futon', label: 'Futon Frames' });
        expect($item('#categoryLabel').accessibility.role).toBe('tab');
      });

      it('registers onClick handler', async () => {
        const $item = await setupCatItem({ _id: 'cat-futon', id: 'futon', label: 'Futon Frames' });
        expect($item('#categoryLabel').onClick).toHaveBeenCalled();
      });

      it('clicking category filters the video repeater', async () => {
        const $item = await setupCatItem({ _id: 'cat-futon', id: 'futon', label: 'Futon Frames' });
        const clickHandler = $item('#categoryLabel').onClick.mock.calls[0][0];
        clickHandler();
        // The videos repeater should be updated with filtered data
        const repeater = getEl('#videosRepeater');
        expect(repeater.data).toHaveLength(1); // Only Asheville from mock
      });

      it('clicking "All" shows all videos', async () => {
        // First filter to futon
        const $itemFuton = await setupCatItem({ _id: 'cat-futon', id: 'futon', label: 'Futon Frames' });
        $itemFuton('#categoryLabel').onClick.mock.calls[0][0]();

        // Then click All
        const catRepeater = getEl('#videoCategoryRepeater');
        const cb = catRepeater.onItemReady.mock.calls[0][0];
        const allEls = new Map();
        const $itemAll = (sel) => {
          if (!allEls.has(sel)) allEls.set(sel, createMockElement());
          return allEls.get(sel);
        };
        cb($itemAll, { _id: 'cat-all', id: '', label: 'All Videos' });
        $itemAll('#categoryLabel').onClick.mock.calls[0][0]();

        expect(getEl('#videosRepeater').data).toHaveLength(3);
      });

      it('announces filter change', async () => {
        const $item = await setupCatItem({ _id: 'cat-conv', id: 'conversion', label: 'Conversion Demos' });
        $item('#categoryLabel').onClick.mock.calls[0][0]();
        expect(announce).toHaveBeenCalledWith($w, 'Showing conversion demos');
      });

      it('tracks video_filter event', async () => {
        const $item = await setupCatItem({ _id: 'cat-futon', id: 'futon', label: 'Futon Frames' });
        $item('#categoryLabel').onClick.mock.calls[0][0]();
        expect(trackEvent).toHaveBeenCalledWith('video_filter', { category: 'Futon Frames' });
      });
    });
  });

  // ── Video Player ────────────────────────────────────────────────

  describe('playVideo — via thumbnail click', () => {
    async function clickVideoThumb(videoData) {
      await onReadyHandler();
      const repeater = getEl('#videosRepeater');
      const cb = repeater.onItemReady.mock.calls[0][0];
      const itemEls = new Map();
      const $item = (sel) => {
        if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
        return itemEls.get(sel);
      };
      cb($item, videoData);
      $item('#videoThumb')._clickHandler();
    }

    it('sets videoPlayer src', async () => {
      await clickVideoThumb({ _id: 'v1', title: 'Asheville', videoUrl: 'https://cdn/asheville.mp4', category: 'futon' });
      expect(getEl('#videoPlayer').src).toBe('https://cdn/asheville.mp4');
    });

    it('calls player.play()', async () => {
      await clickVideoThumb({ _id: 'v1', title: 'Asheville', videoUrl: 'https://cdn/asheville.mp4', category: 'futon' });
      expect(getEl('#videoPlayer').play).toHaveBeenCalled();
    });

    it('tracks video_play event', async () => {
      await clickVideoThumb({ _id: 'v1', title: 'Asheville', videoUrl: 'https://cdn/asheville.mp4', category: 'futon' });
      expect(trackEvent).toHaveBeenCalledWith('video_play', { title: 'Asheville', category: 'futon' });
    });

    it('announces now playing', async () => {
      await clickVideoThumb({ _id: 'v1', title: 'Asheville', videoUrl: 'https://cdn/asheville.mp4', category: 'futon' });
      expect(announce).toHaveBeenCalledWith($w, 'Now playing: Asheville');
    });

    it('sets nowPlayingTitle text', async () => {
      await clickVideoThumb({ _id: 'v1', title: 'Asheville', videoUrl: 'https://cdn/asheville.mp4', category: 'futon' });
      expect(getEl('#nowPlayingTitle').text).toBe('Asheville');
    });

    it('expands videoPlayerContainer', async () => {
      await clickVideoThumb({ _id: 'v1', title: 'Asheville', videoUrl: 'https://cdn/asheville.mp4', category: 'futon' });
      expect(getEl('#videoPlayerContainer').expand).toHaveBeenCalled();
    });

    it('shows product link with label for videos with productSlug', async () => {
      await clickVideoThumb({ _id: 'v1', title: 'Asheville', videoUrl: 'v.mp4', category: 'futon', productSlug: 'asheville-futon-frame' });
      expect(getEl('#videoProductLink').label).toBe('Shop the Asheville');
      expect(getEl('#videoProductLink').show).toHaveBeenCalled();
    });

    it('hides product link for videos without productSlug', async () => {
      await clickVideoThumb({ _id: 'v1', title: 'Intro', videoUrl: 'v.mp4', category: 'overview' });
      expect(getEl('#videoProductLink').hide).toHaveBeenCalled();
    });

    it('registers makeClickable on product link for navigation', async () => {
      await clickVideoThumb({ _id: 'v1', title: 'Asheville', videoUrl: 'v.mp4', category: 'futon', productSlug: 'asheville-futon-frame' });
      expect(makeClickable).toHaveBeenCalledWith(
        getEl('#videoProductLink'),
        expect.any(Function),
        { ariaLabel: 'Shop the Asheville' }
      );
    });

    it('product link navigates to product page', async () => {
      const wixLocation = await import('wix-location-frontend');
      await clickVideoThumb({ _id: 'v1', title: 'Asheville', videoUrl: 'v.mp4', category: 'futon', productSlug: 'asheville-futon-frame' });

      // Invoke the makeClickable handler for the product link
      const linkCalls = makeClickable.mock.calls.filter(c => c[0] === getEl('#videoProductLink'));
      const navHandler = linkCalls[linkCalls.length - 1][1];
      navHandler();

      await new Promise(r => setTimeout(r, 10));
      expect(wixLocation.to).toHaveBeenCalledWith('/product-page/asheville-futon-frame');
    });
  });
});
