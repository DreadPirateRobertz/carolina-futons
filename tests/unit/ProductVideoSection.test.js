import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────

const { mockGetProductVideos, mockGetAssemblyVideo } = vi.hoisted(() => ({
  mockGetProductVideos: vi.fn(),
  mockGetAssemblyVideo: vi.fn(),
}));

vi.mock('backend/productVideos.web', () => ({
  getProductVideos: mockGetProductVideos,
  getAssemblyVideo: mockGetAssemblyVideo,
}));

vi.mock('public/designTokens.js', () => ({
  colors: {
    espresso: '#3A2518',
    sand: '#E8D5B7',
    sandLight: '#F2E8D5',
    mountainBlue: '#5B8FA8',
    sunsetCoral: '#E8845C',
    offWhite: '#FAF7F2',
    success: '#4A7C59',
    error: '#C0392B',
  },
  spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px' },
  fontFamilies: { heading: 'Playfair Display', body: 'Source Sans 3' },
  transitions: { fast: 150, medium: 250, slow: 400 },
}));

vi.mock('public/a11yHelpers.js', () => ({
  announce: vi.fn(),
  makeClickable: vi.fn(),
}));

vi.mock('public/engagementTracker', () => ({
  trackVideoInteraction: vi.fn(),
}));

import { initProductVideoSection } from '../../src/public/ProductVideoSection.js';

// ── Helpers ──────────────────────────────────────────────────────────

function createMockElement() {
  return {
    text: '', src: '', alt: '', html: '',
    value: '',
    label: '',
    style: { color: '', backgroundColor: '', borderColor: '' },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(),
    expand: vi.fn(),
    onClick: vi.fn(),
    onChange: vi.fn(),
    onMessage: vi.fn(),
    postMessage: vi.fn(),
    disable: vi.fn(),
    enable: vi.fn(),
    accessibility: {},
    items: [],
    data: [],
    onItemReady: vi.fn(),
  };
}

function create$w() {
  const els = new Map();
  return (sel) => {
    if (!els.has(sel)) els.set(sel, createMockElement());
    return els.get(sel);
  };
}

const MOCK_ASSEMBLY_VIDEO = {
  videoId: 'v-kd-001',
  title: 'Nomad Platform Bed Assembly',
  brand: 'KD Frames',
  type: 'assembly',
  youtubeUrl: 'https://www.youtube.com/watch?v=EC1GCQ5CiSo',
  youtubeId: 'EC1GCQ5CiSo',
  embedUrl: 'https://www.youtube.com/embed/EC1GCQ5CiSo',
  mp4Url: null,
  thumbnailUrl: 'https://img.youtube.com/vi/EC1GCQ5CiSo/hqdefault.jpg',
  duration: 480,
  productSlugs: ['nomad-platform-bed'],
};

const MOCK_DEMO_VIDEO = {
  videoId: 'v-demo-001',
  title: 'Nomad Platform Bed Product Demo',
  brand: 'KD Frames',
  type: 'demo',
  youtubeUrl: 'https://www.youtube.com/watch?v=DEMO123456',
  youtubeId: 'DEMO123456',
  embedUrl: 'https://www.youtube.com/embed/DEMO123456',
  mp4Url: null,
  thumbnailUrl: 'https://img.youtube.com/vi/DEMO123456/hqdefault.jpg',
  duration: 300,
  productSlugs: ['nomad-platform-bed'],
};

const MOCK_MP4_VIDEO = {
  videoId: 'v-strata-001',
  title: 'Dillon Futon Conversion Animation',
  brand: 'Strata Furniture',
  type: 'animation',
  youtubeUrl: null,
  youtubeId: null,
  embedUrl: null,
  mp4Url: 'https://store.stratafurniture.com/video.mp4',
  thumbnailUrl: null,
  duration: 30,
  productSlugs: ['dillon-futon-frame'],
};

// ── Tests ────────────────────────────────────────────────────────────

describe('ProductVideoSection', () => {
  let $w, state;

  beforeEach(() => {
    $w = create$w();
    state = {
      product: {
        _id: 'prod-nomad',
        name: 'Nomad Platform Bed',
        slug: 'nomad-platform-bed',
        collections: ['platform-beds'],
        mediaItems: [],
      },
    };
    mockGetProductVideos.mockReset();
    mockGetAssemblyVideo.mockReset();
  });

  // ── Initialization ─────────────────────────────────────────────────

  describe('initialization', () => {
    it('collapses section when product is null', async () => {
      state.product = null;
      await initProductVideoSection($w, state);
      expect($w('#videoSection').collapse).toHaveBeenCalled();
    });

    it('collapses section when product has no slug', async () => {
      state.product.slug = '';
      mockGetProductVideos.mockResolvedValue({ success: true, data: [] });
      await initProductVideoSection($w, state);
      expect($w('#videoSection').collapse).toHaveBeenCalled();
    });

    it('calls getProductVideos with product slug', async () => {
      mockGetProductVideos.mockResolvedValue({ success: true, data: [MOCK_DEMO_VIDEO] });
      await initProductVideoSection($w, state);
      expect(mockGetProductVideos).toHaveBeenCalledWith('nomad-platform-bed');
    });

    it('collapses section when no videos found', async () => {
      mockGetProductVideos.mockResolvedValue({ success: true, data: [] });
      await initProductVideoSection($w, state);
      expect($w('#videoSection').collapse).toHaveBeenCalled();
    });

    it('collapses section when API returns error', async () => {
      mockGetProductVideos.mockResolvedValue({ success: false, error: 'Failed' });
      await initProductVideoSection($w, state);
      expect($w('#videoSection').collapse).toHaveBeenCalled();
    });

    it('expands section when videos are found', async () => {
      mockGetProductVideos.mockResolvedValue({ success: true, data: [MOCK_DEMO_VIDEO] });
      await initProductVideoSection($w, state);
      expect($w('#videoSection').expand).toHaveBeenCalled();
    });

    it('handles API exception gracefully', async () => {
      mockGetProductVideos.mockRejectedValue(new Error('Network error'));
      await initProductVideoSection($w, state);
      expect($w('#videoSection').collapse).toHaveBeenCalled();
    });
  });

  // ── Video Display ──────────────────────────────────────────────────

  describe('video display', () => {
    it('sets section title', async () => {
      mockGetProductVideos.mockResolvedValue({ success: true, data: [MOCK_DEMO_VIDEO] });
      await initProductVideoSection($w, state);
      expect($w('#videoSectionTitle').text).toBe('See It In Action');
    });

    it('sets up video repeater with video data', async () => {
      mockGetProductVideos.mockResolvedValue({ success: true, data: [MOCK_DEMO_VIDEO, MOCK_ASSEMBLY_VIDEO] });
      await initProductVideoSection($w, state);
      expect($w('#videoRepeater').onItemReady).toHaveBeenCalled();
      expect($w('#videoRepeater').data).toHaveLength(2);
    });

    it('video repeater item shows title', async () => {
      mockGetProductVideos.mockResolvedValue({ success: true, data: [MOCK_DEMO_VIDEO] });
      await initProductVideoSection($w, state);

      const itemReadyCb = $w('#videoRepeater').onItemReady.mock.calls[0][0];
      const $item = create$w();
      itemReadyCb($item, MOCK_DEMO_VIDEO);

      expect($item('#videoTitle').text).toBe('Nomad Platform Bed Product Demo');
    });

    it('video repeater item shows duration', async () => {
      mockGetProductVideos.mockResolvedValue({ success: true, data: [MOCK_DEMO_VIDEO] });
      await initProductVideoSection($w, state);

      const itemReadyCb = $w('#videoRepeater').onItemReady.mock.calls[0][0];
      const $item = create$w();
      itemReadyCb($item, MOCK_DEMO_VIDEO);

      expect($item('#videoDuration').text).toBe('5:00');
    });

    it('video repeater item shows type badge', async () => {
      mockGetProductVideos.mockResolvedValue({ success: true, data: [MOCK_ASSEMBLY_VIDEO] });
      await initProductVideoSection($w, state);

      const itemReadyCb = $w('#videoRepeater').onItemReady.mock.calls[0][0];
      const $item = create$w();
      itemReadyCb($item, MOCK_ASSEMBLY_VIDEO);

      expect($item('#videoTypeBadge').text).toBe('Assembly');
    });

    it('video repeater item shows thumbnail for YouTube videos', async () => {
      mockGetProductVideos.mockResolvedValue({ success: true, data: [MOCK_DEMO_VIDEO] });
      await initProductVideoSection($w, state);

      const itemReadyCb = $w('#videoRepeater').onItemReady.mock.calls[0][0];
      const $item = create$w();
      itemReadyCb($item, MOCK_DEMO_VIDEO);

      expect($item('#videoThumbnail').src).toBe('https://img.youtube.com/vi/DEMO123456/hqdefault.jpg');
    });

    it('hides thumbnail for MP4 videos without thumbnailUrl', async () => {
      mockGetProductVideos.mockResolvedValue({ success: true, data: [MOCK_MP4_VIDEO] });
      await initProductVideoSection($w, state);

      const itemReadyCb = $w('#videoRepeater').onItemReady.mock.calls[0][0];
      const $item = create$w();
      itemReadyCb($item, MOCK_MP4_VIDEO);

      expect($item('#videoThumbnail').hide).toHaveBeenCalled();
    });

    it('registers click handler on video thumbnail', async () => {
      mockGetProductVideos.mockResolvedValue({ success: true, data: [MOCK_DEMO_VIDEO] });
      await initProductVideoSection($w, state);

      const itemReadyCb = $w('#videoRepeater').onItemReady.mock.calls[0][0];
      const $item = create$w();
      itemReadyCb($item, MOCK_DEMO_VIDEO);

      expect($item('#videoThumbnail').onClick).toHaveBeenCalled();
    });
  });

  // ── Video Player ───────────────────────────────────────────────────

  describe('video player', () => {
    it('sends YouTube embed URL to HtmlComponent on video click', async () => {
      mockGetProductVideos.mockResolvedValue({ success: true, data: [MOCK_DEMO_VIDEO] });
      await initProductVideoSection($w, state);

      const itemReadyCb = $w('#videoRepeater').onItemReady.mock.calls[0][0];
      const $item = create$w();
      itemReadyCb($item, MOCK_DEMO_VIDEO);

      const clickHandler = $item('#videoThumbnail').onClick.mock.calls[0][0];
      clickHandler();

      expect($w('#videoPlayerEmbed').postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'loadVideo',
          embedUrl: 'https://www.youtube.com/embed/DEMO123456',
          videoType: 'youtube',
        })
      );
    });

    it('sends MP4 URL to HtmlComponent for MP4 videos', async () => {
      mockGetProductVideos.mockResolvedValue({ success: true, data: [MOCK_MP4_VIDEO] });
      await initProductVideoSection($w, state);

      const itemReadyCb = $w('#videoRepeater').onItemReady.mock.calls[0][0];
      const $item = create$w();
      itemReadyCb($item, MOCK_MP4_VIDEO);

      const clickHandler = $item('#videoThumbnail').onClick.mock.calls[0][0];
      clickHandler();

      expect($w('#videoPlayerEmbed').postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'loadVideo',
          mp4Url: 'https://store.stratafurniture.com/video.mp4',
          videoType: 'mp4',
        })
      );
    });

    it('expands video player container on video click', async () => {
      mockGetProductVideos.mockResolvedValue({ success: true, data: [MOCK_DEMO_VIDEO] });
      await initProductVideoSection($w, state);

      const itemReadyCb = $w('#videoRepeater').onItemReady.mock.calls[0][0];
      const $item = create$w();
      itemReadyCb($item, MOCK_DEMO_VIDEO);

      const clickHandler = $item('#videoThumbnail').onClick.mock.calls[0][0];
      clickHandler();

      expect($w('#videoPlayerContainer').expand).toHaveBeenCalled();
    });

    it('sets now-playing title when video is selected', async () => {
      mockGetProductVideos.mockResolvedValue({ success: true, data: [MOCK_DEMO_VIDEO] });
      await initProductVideoSection($w, state);

      const itemReadyCb = $w('#videoRepeater').onItemReady.mock.calls[0][0];
      const $item = create$w();
      itemReadyCb($item, MOCK_DEMO_VIDEO);

      const clickHandler = $item('#videoThumbnail').onClick.mock.calls[0][0];
      clickHandler();

      expect($w('#nowPlayingTitle').text).toBe('Nomad Platform Bed Product Demo');
    });
  });

  // ── Assembly Tutorial Section ──────────────────────────────────────

  describe('assembly tutorial', () => {
    it('shows assembly section when assembly video exists', async () => {
      mockGetProductVideos.mockResolvedValue({
        success: true,
        data: [MOCK_DEMO_VIDEO, MOCK_ASSEMBLY_VIDEO],
      });
      await initProductVideoSection($w, state);
      expect($w('#assemblyVideoSection').expand).toHaveBeenCalled();
    });

    it('sets assembly video title', async () => {
      mockGetProductVideos.mockResolvedValue({
        success: true,
        data: [MOCK_ASSEMBLY_VIDEO],
      });
      await initProductVideoSection($w, state);
      expect($w('#assemblyVideoTitle').text).toBe('Assembly Tutorial');
    });

    it('sets assembly video subtitle with video title', async () => {
      mockGetProductVideos.mockResolvedValue({
        success: true,
        data: [MOCK_ASSEMBLY_VIDEO],
      });
      await initProductVideoSection($w, state);
      expect($w('#assemblyVideoName').text).toBe('Nomad Platform Bed Assembly');
    });

    it('collapses assembly section when no assembly video exists', async () => {
      mockGetProductVideos.mockResolvedValue({
        success: true,
        data: [MOCK_DEMO_VIDEO],
      });
      await initProductVideoSection($w, state);
      expect($w('#assemblyVideoSection').collapse).toHaveBeenCalled();
    });

    it('registers click on assembly play button', async () => {
      mockGetProductVideos.mockResolvedValue({
        success: true,
        data: [MOCK_ASSEMBLY_VIDEO],
      });
      await initProductVideoSection($w, state);
      expect($w('#assemblyPlayBtn').onClick).toHaveBeenCalled();
    });

    it('loads assembly video into player on play button click', async () => {
      mockGetProductVideos.mockResolvedValue({
        success: true,
        data: [MOCK_ASSEMBLY_VIDEO],
      });
      await initProductVideoSection($w, state);

      const clickHandler = $w('#assemblyPlayBtn').onClick.mock.calls[0][0];
      clickHandler();

      expect($w('#videoPlayerEmbed').postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'loadVideo',
          embedUrl: 'https://www.youtube.com/embed/EC1GCQ5CiSo',
          videoType: 'youtube',
        })
      );
    });

    it('shows assembly duration formatted', async () => {
      mockGetProductVideos.mockResolvedValue({
        success: true,
        data: [MOCK_ASSEMBLY_VIDEO],
      });
      await initProductVideoSection($w, state);
      expect($w('#assemblyDuration').text).toBe('8:00');
    });
  });

  // ── Accessibility ──────────────────────────────────────────────────

  describe('accessibility', () => {
    it('sets ARIA region role on video section', async () => {
      mockGetProductVideos.mockResolvedValue({ success: true, data: [MOCK_DEMO_VIDEO] });
      await initProductVideoSection($w, state);
      expect($w('#videoSection').accessibility.role).toBe('region');
    });

    it('sets ARIA label on video section', async () => {
      mockGetProductVideos.mockResolvedValue({ success: true, data: [MOCK_DEMO_VIDEO] });
      await initProductVideoSection($w, state);
      expect($w('#videoSection').accessibility.ariaLabel).toBe('Product videos');
    });

    it('sets alt text on video thumbnails', async () => {
      mockGetProductVideos.mockResolvedValue({ success: true, data: [MOCK_DEMO_VIDEO] });
      await initProductVideoSection($w, state);

      const itemReadyCb = $w('#videoRepeater').onItemReady.mock.calls[0][0];
      const $item = create$w();
      itemReadyCb($item, MOCK_DEMO_VIDEO);

      expect($item('#videoThumbnail').alt).toBe('Play Nomad Platform Bed Product Demo');
    });
  });

  // ── Duration Formatting ────────────────────────────────────────────

  describe('duration formatting', () => {
    it('formats seconds-only duration', async () => {
      const video = { ...MOCK_DEMO_VIDEO, duration: 45 };
      mockGetProductVideos.mockResolvedValue({ success: true, data: [video] });
      await initProductVideoSection($w, state);

      const itemReadyCb = $w('#videoRepeater').onItemReady.mock.calls[0][0];
      const $item = create$w();
      itemReadyCb($item, video);

      expect($item('#videoDuration').text).toBe('0:45');
    });

    it('formats hour+ duration', async () => {
      const video = { ...MOCK_DEMO_VIDEO, duration: 3661 };
      mockGetProductVideos.mockResolvedValue({ success: true, data: [video] });
      await initProductVideoSection($w, state);

      const itemReadyCb = $w('#videoRepeater').onItemReady.mock.calls[0][0];
      const $item = create$w();
      itemReadyCb($item, video);

      expect($item('#videoDuration').text).toBe('1:01:01');
    });

    it('handles null duration', async () => {
      const video = { ...MOCK_DEMO_VIDEO, duration: null };
      mockGetProductVideos.mockResolvedValue({ success: true, data: [video] });
      await initProductVideoSection($w, state);

      const itemReadyCb = $w('#videoRepeater').onItemReady.mock.calls[0][0];
      const $item = create$w();
      itemReadyCb($item, video);

      expect($item('#videoDuration').text).toBe('');
    });
  });

  // ── Cleanup ────────────────────────────────────────────────────────

  describe('cleanup', () => {
    it('returns a destroy function', async () => {
      mockGetProductVideos.mockResolvedValue({ success: true, data: [MOCK_DEMO_VIDEO] });
      const result = await initProductVideoSection($w, state);
      expect(typeof result.destroy).toBe('function');
    });

    it('collapses sections on destroy', async () => {
      mockGetProductVideos.mockResolvedValue({ success: true, data: [MOCK_DEMO_VIDEO] });
      const result = await initProductVideoSection($w, state);
      result.destroy();
      expect($w('#videoPlayerContainer').collapse).toHaveBeenCalled();
    });
  });
});
