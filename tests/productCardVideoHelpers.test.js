// productCardVideoHelpers.test.js — TDD for ProductCardVideo (CF-nmvf)
// Wires Wix-hosted product videos to card hover-play feature.
import { describe, it, expect, vi } from 'vitest';
import {
  PRODUCT_CARD_VIDEOS,
  getCardVideoUrl,
  initCardVideo,
} from '../src/public/productCardVideoHelpers.js';

const WIX_BASE = 'https://video.wixstatic.com/video';

// ── Helper ────────────────────────────────────────────────────────────
function mockEl(overrides = {}) {
  return {
    src: '',
    show: vi.fn(),
    hide: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    onMouseIn: vi.fn(),
    onMouseOut: vi.fn(),
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 1. PRODUCT_CARD_VIDEOS — test data mapping
// ═══════════════════════════════════════════════════════════════════════

describe('PRODUCT_CARD_VIDEOS', () => {
  it('has entry for asheville-futon-frame', () => {
    expect(PRODUCT_CARD_VIDEOS['asheville-futon-frame']).toBe('e04e89_ea16ef6edfe64c03a5bfdd0ee468ab7f');
  });

  it('has entry for sedona-futon-frame', () => {
    expect(PRODUCT_CARD_VIDEOS['sedona-futon-frame']).toBe('e04e89_8483b56d2ef5417c95242c821934e2b2');
  });

  it('has entry for alpine-futon-frame', () => {
    expect(PRODUCT_CARD_VIDEOS['alpine-futon-frame']).toBe('e04e89_dba4fc2f08ee4a42906dcb76bcb9b31a');
  });

  it('has at least 3 entries', () => {
    expect(Object.keys(PRODUCT_CARD_VIDEOS).length).toBeGreaterThanOrEqual(3);
  });

  it('all IDs are non-empty strings', () => {
    for (const [slug, id] of Object.entries(PRODUCT_CARD_VIDEOS)) {
      expect(typeof id, `${slug} id`).toBe('string');
      expect(id.length, `${slug} id length`).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 2. getCardVideoUrl
// ═══════════════════════════════════════════════════════════════════════

describe('getCardVideoUrl', () => {
  it('returns full Wix video URL for asheville-futon-frame', () => {
    const url = getCardVideoUrl('asheville-futon-frame');
    expect(url).toBe(`${WIX_BASE}/e04e89_ea16ef6edfe64c03a5bfdd0ee468ab7f/1080p/mp4/file.mp4`);
  });

  it('returns full Wix video URL for sedona-futon-frame', () => {
    const url = getCardVideoUrl('sedona-futon-frame');
    expect(url).toBe(`${WIX_BASE}/e04e89_8483b56d2ef5417c95242c821934e2b2/1080p/mp4/file.mp4`);
  });

  it('returns full Wix video URL for alpine-futon-frame', () => {
    const url = getCardVideoUrl('alpine-futon-frame');
    expect(url).toBe(`${WIX_BASE}/e04e89_dba4fc2f08ee4a42906dcb76bcb9b31a/1080p/mp4/file.mp4`);
  });

  it('returns null for unknown slug', () => {
    expect(getCardVideoUrl('monterey-futon-frame')).toBeNull();
  });

  it('returns null for null slug', () => {
    expect(getCardVideoUrl(null)).toBeNull();
  });

  it('returns null for undefined slug', () => {
    expect(getCardVideoUrl(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(getCardVideoUrl('')).toBeNull();
  });

  it('URL uses 1080p mp4 format', () => {
    const url = getCardVideoUrl('sedona-futon-frame');
    expect(url).toContain('/1080p/mp4/file.mp4');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 3. initCardVideo
// ═══════════════════════════════════════════════════════════════════════

describe('initCardVideo', () => {
  const VIDEO_URL = `${WIX_BASE}/e04e89_ea16ef6edfe64c03a5bfdd0ee468ab7f/1080p/mp4/file.mp4`;

  it('sets video src', () => {
    const container = mockEl();
    const video = mockEl();
    const image = mockEl();
    initCardVideo(container, video, image, VIDEO_URL);
    expect(video.src).toBe(VIDEO_URL);
  });

  it('hides video element initially', () => {
    const container = mockEl();
    const video = mockEl();
    const image = mockEl();
    initCardVideo(container, video, image, VIDEO_URL);
    expect(video.hide).toHaveBeenCalled();
  });

  it('registers mouseIn handler on container', () => {
    const container = mockEl();
    const video = mockEl();
    initCardVideo(container, video, null, VIDEO_URL);
    expect(container.onMouseIn).toHaveBeenCalledTimes(1);
  });

  it('registers mouseOut handler on container', () => {
    const container = mockEl();
    const video = mockEl();
    initCardVideo(container, video, null, VIDEO_URL);
    expect(container.onMouseOut).toHaveBeenCalledTimes(1);
  });

  it('mouseIn plays and shows video', () => {
    const container = mockEl();
    const video = mockEl();
    initCardVideo(container, video, null, VIDEO_URL);
    container.onMouseIn.mock.calls[0][0]();
    expect(video.play).toHaveBeenCalled();
    expect(video.show).toHaveBeenCalled();
  });

  it('mouseIn hides image element', () => {
    const container = mockEl();
    const video = mockEl();
    const image = mockEl();
    initCardVideo(container, video, image, VIDEO_URL);
    container.onMouseIn.mock.calls[0][0]();
    expect(image.hide).toHaveBeenCalled();
  });

  it('mouseOut pauses and hides video', () => {
    const container = mockEl();
    const video = mockEl();
    initCardVideo(container, video, null, VIDEO_URL);
    container.onMouseOut.mock.calls[0][0]();
    expect(video.pause).toHaveBeenCalled();
    expect(video.hide).toHaveBeenCalled();
  });

  it('mouseOut shows image element', () => {
    const container = mockEl();
    const video = mockEl();
    const image = mockEl();
    initCardVideo(container, video, image, VIDEO_URL);
    container.onMouseOut.mock.calls[0][0]();
    expect(image.show).toHaveBeenCalled();
  });

  it('no-ops when videoUrl is null', () => {
    const container = mockEl();
    const video = mockEl();
    initCardVideo(container, video, null, null);
    expect(container.onMouseIn).not.toHaveBeenCalled();
    expect(video.src).toBe('');
  });

  it('no-ops when videoUrl is empty string', () => {
    const container = mockEl();
    const video = mockEl();
    initCardVideo(container, video, null, '');
    expect(container.onMouseIn).not.toHaveBeenCalled();
  });

  it('no-ops when container is null', () => {
    const video = mockEl();
    expect(() => initCardVideo(null, video, null, VIDEO_URL)).not.toThrow();
    expect(video.src).toBe('');
  });

  it('no-ops when video element is null', () => {
    const container = mockEl();
    expect(() => initCardVideo(container, null, null, VIDEO_URL)).not.toThrow();
    expect(container.onMouseIn).not.toHaveBeenCalled();
  });

  it('handles missing image element gracefully on mouseIn', () => {
    const container = mockEl();
    const video = mockEl();
    initCardVideo(container, video, null, VIDEO_URL);
    expect(() => container.onMouseIn.mock.calls[0][0]()).not.toThrow();
  });

  it('handles missing image element gracefully on mouseOut', () => {
    const container = mockEl();
    const video = mockEl();
    initCardVideo(container, video, null, VIDEO_URL);
    expect(() => container.onMouseOut.mock.calls[0][0]()).not.toThrow();
  });

  it('handles video.play() throwing gracefully', () => {
    const container = mockEl();
    const video = mockEl({ play: vi.fn(() => { throw new Error('autoplay blocked'); }) });
    initCardVideo(container, video, null, VIDEO_URL);
    expect(() => container.onMouseIn.mock.calls[0][0]()).not.toThrow();
  });

  it('handles container without onMouseIn gracefully', () => {
    const container = { onMouseOut: vi.fn() };
    const video = mockEl();
    expect(() => initCardVideo(container, video, null, VIDEO_URL)).not.toThrow();
  });
});
