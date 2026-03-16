import { describe, it, expect } from 'vitest';

const {
  STORY_TYPES,
  isValidStoryType,
  getHashtags,
  formatCaption,
  getScheduledStories,
  getNextPostTime,
  buildTemplateData,
  buildMetaStoryPayload,
  getOptimalPostHour,
} = await import('../src/public/socialStoryHelpers.js');

describe('socialStoryHelpers', () => {

  // ── STORY_TYPES ──────────────────────────────────────────────────

  describe('STORY_TYPES', () => {
    it('has exactly 5 story types', () => {
      expect(Object.keys(STORY_TYPES)).toHaveLength(5);
    });

    it('has expected keys', () => {
      expect(STORY_TYPES).toHaveProperty('DID_YOU_KNOW');
      expect(STORY_TYPES).toHaveProperty('CARE_TIP');
      expect(STORY_TYPES).toHaveProperty('WEEKEND_VISIT');
      expect(STORY_TYPES).toHaveProperty('NEW_ARRIVAL');
      expect(STORY_TYPES).toHaveProperty('CUSTOMER_SPOTLIGHT');
    });
  });

  // ── isValidStoryType ─────────────────────────────────────────────

  describe('isValidStoryType', () => {
    it('returns true for each valid type', () => {
      for (const type of Object.values(STORY_TYPES)) {
        expect(isValidStoryType(type)).toBe(true);
      }
    });

    it('returns false for unknown type', () => {
      expect(isValidStoryType('promo')).toBe(false);
    });

    it('returns false for null', () => {
      expect(isValidStoryType(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isValidStoryType(undefined)).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isValidStoryType('')).toBe(false);
    });
  });

  // ── getHashtags ──────────────────────────────────────────────────

  describe('getHashtags', () => {
    it('includes base hashtags for any type', () => {
      const tags = getHashtags(STORY_TYPES.DID_YOU_KNOW);
      expect(tags).toContain('#CarolinaFutons');
      expect(tags).toContain('#HandcraftedComfort');
      expect(tags).toContain('#HendersonvilleNC');
    });

    it('includes type-specific hashtags for DID_YOU_KNOW', () => {
      const tags = getHashtags(STORY_TYPES.DID_YOU_KNOW);
      expect(tags).toContain('#FurnitureFacts');
      expect(tags).toContain('#DidYouKnow');
    });

    it('includes type-specific hashtags for CARE_TIP', () => {
      const tags = getHashtags(STORY_TYPES.CARE_TIP);
      expect(tags).toContain('#FurnitureCare');
      expect(tags).toContain('#HomeTips');
    });

    it('includes type-specific hashtags for WEEKEND_VISIT', () => {
      const tags = getHashtags(STORY_TYPES.WEEKEND_VISIT);
      expect(tags).toContain('#ShopLocal');
      expect(tags).toContain('#NCMountains');
    });

    it('includes type-specific hashtags for NEW_ARRIVAL', () => {
      const tags = getHashtags(STORY_TYPES.NEW_ARRIVAL);
      expect(tags).toContain('#NewArrival');
      expect(tags).toContain('#HomeDecor');
    });

    it('includes type-specific hashtags for CUSTOMER_SPOTLIGHT', () => {
      const tags = getHashtags(STORY_TYPES.CUSTOMER_SPOTLIGHT);
      expect(tags).toContain('#CustomerLove');
      expect(tags).toContain('#Testimonial');
    });

    it('returns only base hashtags for unknown type', () => {
      const tags = getHashtags('unknown');
      expect(tags).toHaveLength(5); // only base
    });
  });

  // ── formatCaption ────────────────────────────────────────────────

  describe('formatCaption', () => {
    it('appends hashtags by default', () => {
      const caption = formatCaption('Hello world', STORY_TYPES.DID_YOU_KNOW);
      expect(caption).toContain('Hello world');
      expect(caption).toContain('#CarolinaFutons');
    });

    it('omits hashtags when includeHashtags is false', () => {
      const caption = formatCaption('Hello world', STORY_TYPES.DID_YOU_KNOW, { includeHashtags: false });
      expect(caption).toBe('Hello world');
      expect(caption).not.toContain('#');
    });

    it('trims whitespace', () => {
      const caption = formatCaption('  spaced  ', STORY_TYPES.CARE_TIP, { includeHashtags: false });
      expect(caption).toBe('spaced');
    });

    it('returns empty string for null text', () => {
      expect(formatCaption(null, STORY_TYPES.CARE_TIP)).toBe('');
    });

    it('returns empty string for empty text', () => {
      expect(formatCaption('', STORY_TYPES.CARE_TIP)).toBe('');
    });

    it('truncates to maxLength', () => {
      const caption = formatCaption('Hello', STORY_TYPES.DID_YOU_KNOW, { maxLength: 10 });
      expect(caption.length).toBeLessThanOrEqual(10);
    });

    it('uses 2200 as default maxLength', () => {
      const longText = 'x'.repeat(2300);
      const caption = formatCaption(longText, STORY_TYPES.DID_YOU_KNOW, { includeHashtags: false });
      expect(caption.length).toBeLessThanOrEqual(2200);
    });

    it('separates text and hashtags with double newline', () => {
      const caption = formatCaption('Test', STORY_TYPES.DID_YOU_KNOW);
      expect(caption).toMatch(/Test\n\n#/);
    });
  });

  // ── getScheduledStories ──────────────────────────────────────────

  describe('getScheduledStories', () => {
    it('returns empty for Sunday', () => {
      // 2026-03-15 is a Sunday
      expect(getScheduledStories('2026-03-15T12:00:00')).toEqual([]);
    });

    it('returns DID_YOU_KNOW for Monday', () => {
      // 2026-03-16 is a Monday
      const stories = getScheduledStories('2026-03-16T12:00:00');
      expect(stories).toContain(STORY_TYPES.DID_YOU_KNOW);
    });

    it('returns CARE_TIP for Tuesday', () => {
      const stories = getScheduledStories('2026-03-17T12:00:00');
      expect(stories).toContain(STORY_TYPES.CARE_TIP);
    });

    it('returns NEW_ARRIVAL for Wednesday', () => {
      const stories = getScheduledStories('2026-03-18T12:00:00');
      expect(stories).toContain(STORY_TYPES.NEW_ARRIVAL);
    });

    it('returns WEEKEND_VISIT for Friday', () => {
      const stories = getScheduledStories('2026-03-20T12:00:00');
      expect(stories).toContain(STORY_TYPES.WEEKEND_VISIT);
    });

    it('returns CUSTOMER_SPOTLIGHT for Saturday', () => {
      const stories = getScheduledStories('2026-03-21T12:00:00');
      expect(stories).toContain(STORY_TYPES.CUSTOMER_SPOTLIGHT);
    });

    it('returns empty for invalid date', () => {
      expect(getScheduledStories('not-a-date')).toEqual([]);
    });

    it('returns defensive copy', () => {
      const a = getScheduledStories('2026-03-16T12:00:00');
      const b = getScheduledStories('2026-03-16T12:00:00');
      a.push('mutated');
      expect(b).not.toContain('mutated');
    });

    it('accepts Date objects', () => {
      const stories = getScheduledStories(new Date('2026-03-16T12:00:00'));
      expect(stories.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── getNextPostTime ──────────────────────────────────────────────

  describe('getNextPostTime', () => {
    it('returns 10 AM for a scheduled day', () => {
      const postTime = getNextPostTime('2026-03-16T08:00:00');
      expect(postTime).toBeInstanceOf(Date);
      expect(postTime.getHours()).toBe(10);
      expect(postTime.getMinutes()).toBe(0);
    });

    it('returns null for Sunday', () => {
      expect(getNextPostTime('2026-03-15T12:00:00')).toBeNull();
    });

    it('returns null for invalid date', () => {
      expect(getNextPostTime('garbage')).toBeNull();
    });

    it('accepts Date objects', () => {
      const postTime = getNextPostTime(new Date('2026-03-16T08:00:00'));
      expect(postTime).toBeInstanceOf(Date);
    });
  });

  // ── buildTemplateData ────────────────────────────────────────────

  describe('buildTemplateData', () => {
    it('returns null for invalid type', () => {
      expect(buildTemplateData('invalid')).toBeNull();
    });

    it('includes base fields for DID_YOU_KNOW', () => {
      const data = buildTemplateData(STORY_TYPES.DID_YOU_KNOW);
      expect(data.type).toBe(STORY_TYPES.DID_YOU_KNOW);
      expect(data.width).toBe(1080);
      expect(data.height).toBe(1920);
      expect(data.brandName).toBe('Carolina Futons');
      expect(data.timestamp).toBeDefined();
    });

    it('builds DID_YOU_KNOW with data', () => {
      const data = buildTemplateData(STORY_TYPES.DID_YOU_KNOW, {
        headline: 'Fun Fact',
        fact: 'Futons originated in Japan',
        source: 'Wikipedia',
      });
      expect(data.headline).toBe('Fun Fact');
      expect(data.fact).toBe('Futons originated in Japan');
      expect(data.source).toBe('Wikipedia');
    });

    it('builds DID_YOU_KNOW with defaults', () => {
      const data = buildTemplateData(STORY_TYPES.DID_YOU_KNOW);
      expect(data.headline).toBe('Did You Know?');
      expect(data.fact).toBe('');
      expect(data.source).toBe('');
    });

    it('builds CARE_TIP with data', () => {
      const data = buildTemplateData(STORY_TYPES.CARE_TIP, {
        title: 'Cleaning',
        tip: 'Vacuum weekly',
        productName: 'Lounger',
      });
      expect(data.title).toBe('Cleaning');
      expect(data.tip).toBe('Vacuum weekly');
      expect(data.productName).toBe('Lounger');
    });

    it('builds WEEKEND_VISIT with address', () => {
      const data = buildTemplateData(STORY_TYPES.WEEKEND_VISIT);
      expect(data.heading).toBe('Visit Us This Weekend');
      expect(data.address).toContain('Hendersonville');
    });

    it('builds NEW_ARRIVAL with data', () => {
      const data = buildTemplateData(STORY_TYPES.NEW_ARRIVAL, {
        productName: 'Futon X',
        price: '$599',
        description: 'New model',
        imageUrl: 'https://example.com/img.jpg',
      });
      expect(data.productName).toBe('Futon X');
      expect(data.price).toBe('$599');
      expect(data.imageUrl).toBe('https://example.com/img.jpg');
    });

    it('builds CUSTOMER_SPOTLIGHT with data', () => {
      const data = buildTemplateData(STORY_TYPES.CUSTOMER_SPOTLIGHT, {
        customerName: 'Jane',
        quote: 'Love it!',
        productName: 'Futon Y',
        rating: 4,
      });
      expect(data.customerName).toBe('Jane');
      expect(data.quote).toBe('Love it!');
      expect(data.rating).toBe(4);
    });

    it('clamps rating to 0-5', () => {
      const high = buildTemplateData(STORY_TYPES.CUSTOMER_SPOTLIGHT, { rating: 10 });
      expect(high.rating).toBe(5);

      const low = buildTemplateData(STORY_TYPES.CUSTOMER_SPOTLIGHT, { rating: -3 });
      expect(low.rating).toBe(0);
    });

    it('defaults rating to 5 for non-numeric', () => {
      const data = buildTemplateData(STORY_TYPES.CUSTOMER_SPOTLIGHT, { rating: 'great' });
      expect(data.rating).toBe(5);
    });

    it('returns null for null type', () => {
      expect(buildTemplateData(null)).toBeNull();
    });
  });

  // ── buildMetaStoryPayload ────────────────────────────────────────

  describe('buildMetaStoryPayload', () => {
    it('builds valid payload', () => {
      const payload = buildMetaStoryPayload({
        imageUrl: 'https://example.com/story.jpg',
        caption: 'Check this out!',
        pageId: '12345',
      });
      expect(payload.url).toBe('https://example.com/story.jpg');
      expect(payload.caption).toBe('Check this out!');
      expect(payload.published).toBe(true);
      expect(payload.endpoint).toBe('/12345/photo_stories');
    });

    it('returns null without imageUrl', () => {
      expect(buildMetaStoryPayload({ pageId: '123' })).toBeNull();
    });

    it('returns null without pageId', () => {
      expect(buildMetaStoryPayload({ imageUrl: 'https://example.com/img.jpg' })).toBeNull();
    });

    it('returns null for empty imageUrl', () => {
      expect(buildMetaStoryPayload({ imageUrl: '', pageId: '123' })).toBeNull();
    });

    it('returns null for empty pageId', () => {
      expect(buildMetaStoryPayload({ imageUrl: 'https://example.com/img.jpg', pageId: '' })).toBeNull();
    });

    it('defaults caption to empty string', () => {
      const payload = buildMetaStoryPayload({
        imageUrl: 'https://example.com/img.jpg',
        pageId: '123',
      });
      expect(payload.caption).toBe('');
    });
  });

  // ── getOptimalPostHour ───────────────────────────────────────────

  describe('getOptimalPostHour', () => {
    it('returns default 10 with no data', () => {
      expect(getOptimalPostHour()).toBe(10);
    });

    it('returns default 10 for empty array', () => {
      expect(getOptimalPostHour([])).toBe(10);
    });

    it('returns default 10 for null', () => {
      expect(getOptimalPostHour(null)).toBe(10);
    });

    it('returns hour with highest engagement', () => {
      const data = [
        { hour: 8, engagement: 100 },
        { hour: 12, engagement: 300 },
        { hour: 18, engagement: 200 },
      ];
      expect(getOptimalPostHour(data)).toBe(12);
    });

    it('handles string values via Number coercion', () => {
      const data = [
        { hour: '9', engagement: '500' },
        { hour: '15', engagement: '300' },
      ];
      expect(getOptimalPostHour(data)).toBe(9);
    });

    it('ignores entries with non-finite hour', () => {
      const data = [
        { hour: NaN, engagement: 1000 },
        { hour: 14, engagement: 50 },
      ];
      expect(getOptimalPostHour(data)).toBe(14);
    });

    it('ignores entries with non-finite engagement', () => {
      const data = [
        { hour: 8, engagement: Infinity },
        { hour: 14, engagement: 50 },
      ];
      expect(getOptimalPostHour(data)).toBe(14);
    });

    it('picks first highest on tie', () => {
      const data = [
        { hour: 8, engagement: 100 },
        { hour: 14, engagement: 100 },
      ];
      // Both have same engagement, first one wins (strictly >)
      expect(getOptimalPostHour(data)).toBe(8);
    });
  });
});
