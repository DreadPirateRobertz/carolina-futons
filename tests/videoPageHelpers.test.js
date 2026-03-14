import { describe, it, expect } from 'vitest';
import {
  getVideoData,
  getVideoCategories,
  filterVideosByCategory,
} from '../src/public/videoPageHelpers.js';

describe('videoPageHelpers', () => {
  describe('getVideoData', () => {
    it('returns 11 videos', () => {
      expect(getVideoData()).toHaveLength(11);
    });

    it('every video has _id, title, videoUrl, posterUrl, category', () => {
      for (const v of getVideoData()) {
        expect(v._id).toBeTruthy();
        expect(v.title).toBeTruthy();
        expect(v.videoUrl).toMatch(/^https:\/\/video\.wixstatic\.com\/video\/e04e89_/);
        expect(v.posterUrl).toMatch(/^https:\/\/static\.wixstatic\.com\/media\/e04e89_/);
        expect(v.category).toBeTruthy();
      }
    });

    it('videos are sorted by sortOrder', () => {
      const data = getVideoData();
      for (let i = 1; i < data.length; i++) {
        expect(data[i].sortOrder).toBeGreaterThan(data[i - 1].sortOrder);
      }
    });

    it('first video is the Intro', () => {
      expect(getVideoData()[0].title).toBe('Intro');
    });

    it('futon frame videos have productSlug', () => {
      const futons = getVideoData().filter(v => v.category === 'futon');
      expect(futons.length).toBe(7);
      for (const v of futons) {
        expect(v.productSlug).toBeTruthy();
      }
    });

    it('conversion demos do not have productSlug', () => {
      const conversions = getVideoData().filter(v => v.category === 'conversion');
      expect(conversions.length).toBe(3);
      for (const v of conversions) {
        expect(v.productSlug).toBeUndefined();
      }
    });

    it('Intro is overview category without productSlug', () => {
      const intro = getVideoData()[0];
      expect(intro.category).toBe('overview');
      expect(intro.productSlug).toBeUndefined();
    });
  });

  describe('getVideoCategories', () => {
    it('returns 3 categories', () => {
      expect(getVideoCategories()).toHaveLength(3);
    });

    it('categories have id and label', () => {
      for (const c of getVideoCategories()) {
        expect(c.id).toBeTruthy();
        expect(c.label).toBeTruthy();
      }
    });

    it('includes overview, futon, and conversion', () => {
      const ids = getVideoCategories().map(c => c.id);
      expect(ids).toContain('overview');
      expect(ids).toContain('futon');
      expect(ids).toContain('conversion');
    });
  });

  describe('filterVideosByCategory', () => {
    const videos = getVideoData();

    it('returns all videos when category is null', () => {
      expect(filterVideosByCategory(videos, null)).toHaveLength(11);
    });

    it('returns all videos when category is empty string', () => {
      expect(filterVideosByCategory(videos, '')).toHaveLength(11);
    });

    it('filters to futon category (7 videos)', () => {
      expect(filterVideosByCategory(videos, 'futon')).toHaveLength(7);
    });

    it('filters to conversion category (3 videos)', () => {
      expect(filterVideosByCategory(videos, 'conversion')).toHaveLength(3);
    });

    it('filters to overview category (1 video)', () => {
      expect(filterVideosByCategory(videos, 'overview')).toHaveLength(1);
    });

    it('returns empty array for unknown category', () => {
      expect(filterVideosByCategory(videos, 'nonexistent')).toHaveLength(0);
    });
  });
});
