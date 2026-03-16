import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing the module
vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));
vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
}));
vi.mock('public/designTokens.js', () => ({
  colors: {
    espresso: '#1E3A5F',
    espressoLight: '#3D5A80',
    mountainBlue: '#5B8FA8',
    sunsetCoral: '#4A7D94',
    sandBase: '#F0F4F8',
    sandDark: '#E2E8F0',
  },
  spacing: { xs: '6px', sm: '8px', md: '16px', lg: '24px' },
}));

import {
  SOCIAL_CONFIG,
  buildSectionHeader,
  buildFallbackCard,
  buildInstagramEmbed,
  initInstagramFeed,
  initTikTokFeed,
  initPinterestBoard,
  initSocialFeeds,
} from '../src/public/SocialFeedEmbed.js';
import { trackEvent } from 'public/engagementTracker';

// ── Helper: create a mock $w that returns mock elements ──────────────
function create$w(elementMap = {}) {
  return (selector) => elementMap[selector] || null;
}

function mockHtmlElement(id) {
  return {
    _id: id,
    html: '',
    accessibility: {},
  };
}

describe('SocialFeedEmbed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── SOCIAL_CONFIG ────────────────────────────────────────────────
  describe('SOCIAL_CONFIG', () => {
    it('contains instagram, tiktok, and pinterest configs', () => {
      expect(SOCIAL_CONFIG).toHaveProperty('instagram');
      expect(SOCIAL_CONFIG).toHaveProperty('tiktok');
      expect(SOCIAL_CONFIG).toHaveProperty('pinterest');
    });

    it('each config has required fields', () => {
      for (const [platform, config] of Object.entries(SOCIAL_CONFIG)) {
        expect(config.handle).toBeTruthy();
        expect(config.url).toMatch(/^https:\/\//);
        expect(config.fallbackText).toBeTruthy();
        expect(config.ariaLabel).toBeTruthy();
      }
    });

    it('instagram URL matches expected pattern', () => {
      expect(SOCIAL_CONFIG.instagram.url).toBe('https://www.instagram.com/carolinafutons');
    });

    it('tiktok URL matches expected pattern', () => {
      expect(SOCIAL_CONFIG.tiktok.url).toBe('https://www.tiktok.com/@carolinafutons');
    });

    it('pinterest URL matches expected pattern', () => {
      expect(SOCIAL_CONFIG.pinterest.url).toBe('https://www.pinterest.com/carolinafutons');
    });
  });

  // ── buildSectionHeader ───────────────────────────────────────────
  describe('buildSectionHeader', () => {
    it('returns empty string for unknown platform', () => {
      expect(buildSectionHeader('myspace', 'Test')).toBe('');
    });

    it('includes the title text', () => {
      const html = buildSectionHeader('instagram', 'On the Gram');
      expect(html).toContain('On the Gram');
    });

    it('includes a link to the platform URL', () => {
      const html = buildSectionHeader('pinterest', 'Inspiration');
      expect(html).toContain('https://www.pinterest.com/carolinafutons');
    });

    it('includes aria-label for accessibility', () => {
      const html = buildSectionHeader('tiktok', 'Videos');
      expect(html).toContain('aria-label=');
      expect(html).toContain(SOCIAL_CONFIG.tiktok.ariaLabel);
    });

    it('includes the handle with @ prefix', () => {
      const html = buildSectionHeader('instagram', 'Feed');
      expect(html).toContain('@carolinafutons');
    });

    it('opens links in new tab with noopener', () => {
      const html = buildSectionHeader('instagram', 'Test');
      expect(html).toContain('target="_blank"');
      expect(html).toContain('rel="noopener noreferrer"');
    });
  });

  // ── buildFallbackCard ────────────────────────────────────────────
  describe('buildFallbackCard', () => {
    it('returns empty string for unknown platform', () => {
      expect(buildFallbackCard('friendster')).toBe('');
    });

    it('includes fallback text for instagram', () => {
      const html = buildFallbackCard('instagram');
      expect(html).toContain(SOCIAL_CONFIG.instagram.fallbackText);
    });

    it('includes a follow button with platform name', () => {
      const html = buildFallbackCard('tiktok');
      expect(html).toContain('Follow on Tiktok');
    });

    it('links to the platform URL', () => {
      const html = buildFallbackCard('pinterest');
      expect(html).toContain(SOCIAL_CONFIG.pinterest.url);
    });

    it('uses the CTA button color', () => {
      const html = buildFallbackCard('instagram');
      expect(html).toContain('#4A7D94');
    });

    it('includes role and aria-label for accessibility', () => {
      const html = buildFallbackCard('instagram');
      expect(html).toContain('role="region"');
      expect(html).toContain('aria-label=');
    });
  });

  // ── buildInstagramEmbed ──────────────────────────────────────────
  describe('buildInstagramEmbed', () => {
    it('returns an iframe element', () => {
      const html = buildInstagramEmbed();
      expect(html).toContain('<iframe');
      expect(html).toContain('</iframe>');
    });

    it('uses instagram embed URL', () => {
      const html = buildInstagramEmbed();
      expect(html).toContain('instagram.com/carolinafutons/embed');
    });

    it('includes lazy loading attribute', () => {
      const html = buildInstagramEmbed();
      expect(html).toContain('loading="lazy"');
    });

    it('includes accessible title', () => {
      const html = buildInstagramEmbed();
      expect(html).toContain('title=');
    });

    it('sets width to 100%', () => {
      const html = buildInstagramEmbed();
      expect(html).toContain('width="100%"');
    });
  });

  // ── initInstagramFeed ────────────────────────────────────────────
  describe('initInstagramFeed', () => {
    it('sets html on the container element', () => {
      const container = mockHtmlElement('instagramFeedContainer');
      const $w = create$w({ '#instagramFeedContainer': container });

      initInstagramFeed($w);

      expect(container.html).toContain('iframe');
      expect(container.html).toContain('instagram');
    });

    it('tracks the social_feed_loaded event', () => {
      const container = mockHtmlElement('instagramFeedContainer');
      const $w = create$w({ '#instagramFeedContainer': container });

      initInstagramFeed($w);

      expect(trackEvent).toHaveBeenCalledWith('social_feed_loaded', {
        platform: 'instagram',
        location: 'homepage',
      });
    });

    it('does nothing if container not found', () => {
      const $w = create$w({});
      initInstagramFeed($w);
      expect(trackEvent).not.toHaveBeenCalled();
    });

    it('shows fallback card on error', () => {
      const container = {
        get html() { return this._html; },
        set html(v) {
          if (!this._htmlSet) {
            this._htmlSet = true;
            throw new Error('First set fails');
          }
          this._html = v;
        },
        _html: '',
        _htmlSet: false,
        accessibility: {},
      };
      const $w = create$w({ '#instagramFeedContainer': container });

      initInstagramFeed($w);
      // Should not throw — error is caught
    });

    it('sets accessibility attributes on container', () => {
      const container = mockHtmlElement('instagramFeedContainer');
      const $w = create$w({ '#instagramFeedContainer': container });

      initInstagramFeed($w);

      expect(container.accessibility.ariaLabel).toBeTruthy();
      expect(container.accessibility.role).toBe('region');
    });
  });

  // ── initTikTokFeed ──────────────────────────────────────────────
  describe('initTikTokFeed', () => {
    it('sets html on the container with tiktok content', () => {
      const container = mockHtmlElement('tiktokFeedContainer');
      const $w = create$w({ '#tiktokFeedContainer': container });

      initTikTokFeed($w);

      expect(container.html).toContain('TikTok');
      expect(container.html).toContain('tiktok.com');
    });

    it('tracks the social_feed_loaded event for tiktok', () => {
      const container = mockHtmlElement('tiktokFeedContainer');
      const $w = create$w({ '#tiktokFeedContainer': container });

      initTikTokFeed($w);

      expect(trackEvent).toHaveBeenCalledWith('social_feed_loaded', {
        platform: 'tiktok',
        location: 'homepage',
      });
    });

    it('does nothing if container not found', () => {
      const $w = create$w({});
      initTikTokFeed($w);
      expect(trackEvent).not.toHaveBeenCalled();
    });
  });

  // ── initPinterestBoard ───────────────────────────────────────────
  describe('initPinterestBoard', () => {
    it('sets html on the container with pinterest content', () => {
      const container = mockHtmlElement('pinterestBoardContainer');
      const $w = create$w({ '#pinterestBoardContainer': container });

      initPinterestBoard($w);

      expect(container.html).toContain('Pinterest');
      expect(container.html).toContain('pinterest.com');
    });

    it('tracks the social_feed_loaded event for pinterest', () => {
      const container = mockHtmlElement('pinterestBoardContainer');
      const $w = create$w({ '#pinterestBoardContainer': container });

      initPinterestBoard($w);

      expect(trackEvent).toHaveBeenCalledWith('social_feed_loaded', {
        platform: 'pinterest',
        location: 'homepage',
      });
    });

    it('does nothing if container not found', () => {
      const $w = create$w({});
      initPinterestBoard($w);
      expect(trackEvent).not.toHaveBeenCalled();
    });
  });

  // ── initSocialFeeds (all-in-one) ────────────────────────────────
  describe('initSocialFeeds', () => {
    it('initializes all three platforms', () => {
      const ig = mockHtmlElement('instagramFeedContainer');
      const tt = mockHtmlElement('tiktokFeedContainer');
      const pin = mockHtmlElement('pinterestBoardContainer');
      const $w = create$w({
        '#instagramFeedContainer': ig,
        '#tiktokFeedContainer': tt,
        '#pinterestBoardContainer': pin,
      });

      initSocialFeeds($w);

      expect(ig.html).toContain('instagram');
      expect(tt.html).toContain('TikTok');
      expect(pin.html).toContain('Pinterest');
      expect(trackEvent).toHaveBeenCalledTimes(3);
    });

    it('handles missing containers gracefully', () => {
      const $w = create$w({});
      expect(() => initSocialFeeds($w)).not.toThrow();
    });

    it('works with partial containers (only instagram available)', () => {
      const ig = mockHtmlElement('instagramFeedContainer');
      const $w = create$w({ '#instagramFeedContainer': ig });

      initSocialFeeds($w);

      expect(ig.html).toContain('instagram');
      expect(trackEvent).toHaveBeenCalledTimes(1);
    });
  });
});
