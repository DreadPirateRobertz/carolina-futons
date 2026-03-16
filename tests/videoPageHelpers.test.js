import { describe, it, expect } from 'vitest';
import {
  getVideoData,
  getVideoCategories,
  filterVideosByCategory,
} from '../src/public/videoPageHelpers.js';

describe('videoPageHelpers', () => {
  describe('getVideoData', () => {
    it('returns 17 videos (11 Wix + 6 manufacturer)', () => {
      expect(getVideoData()).toHaveLength(17);
    });

    it('every video has _id, title, category, source', () => {
      for (const v of getVideoData()) {
        expect(v._id).toBeTruthy();
        expect(v.title).toBeTruthy();
        expect(v.category).toBeTruthy();
        expect(v.source).toBeTruthy();
      }
    });

    it('Wix videos have wixstatic videoUrl and posterUrl', () => {
      const wix = getVideoData().filter(v => v.source === 'wix');
      expect(wix.length).toBe(11);
      for (const v of wix) {
        expect(v.videoUrl).toMatch(/^https:\/\/video\.wixstatic\.com\/video\/e04e89_/);
        expect(v.posterUrl).toMatch(/^https:\/\/static\.wixstatic\.com\/media\/e04e89_/);
      }
    });

    it('YouTube videos have embedUrl and YouTube posterUrl', () => {
      const yt = getVideoData().filter(v => v.source === 'youtube');
      expect(yt.length).toBe(5);
      for (const v of yt) {
        expect(v.embedUrl).toMatch(/^https:\/\/www\.youtube\.com\/embed\//);
        expect(v.posterUrl).toMatch(/^https:\/\/img\.youtube\.com\/vi\//);
        expect(v.videoUrl).toMatch(/^https:\/\/www\.youtube\.com\/watch\?v=/);
      }
    });

    it('MP4 videos have direct videoUrl', () => {
      const mp4 = getVideoData().filter(v => v.source === 'mp4');
      expect(mp4.length).toBe(1);
      expect(mp4[0].videoUrl).toMatch(/\.mp4$/);
      expect(mp4[0].posterUrl).toBeNull();
    });

    it('videos are sorted by sortOrder', () => {
      const data = getVideoData();
      for (let i = 1; i < data.length; i++) {
        expect(data[i].sortOrder).toBeGreaterThanOrEqual(data[i - 1].sortOrder);
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

    it('Wix conversion demos do not have productSlug', () => {
      const conversions = getVideoData().filter(v => v.category === 'conversion' && v.source === 'wix');
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

    it('assembly videos have productSlug and brand', () => {
      const assembly = getVideoData().filter(v => v.category === 'assembly');
      expect(assembly.length).toBe(5);
      for (const v of assembly) {
        expect(v.productSlug).toBeTruthy();
        expect(v.brand).toBeTruthy();
      }
    });

    it('Strata Dillon conversion has brand and productSlug', () => {
      const dillon = getVideoData().find(v => v._id === 'v-strata-001');
      expect(dillon).toBeTruthy();
      expect(dillon.brand).toBe('Strata Furniture');
      expect(dillon.productSlug).toBe('dillon-futon-frame');
      expect(dillon.category).toBe('conversion');
    });
  });

  describe('getVideoCategories', () => {
    it('returns 4 categories', () => {
      expect(getVideoCategories()).toHaveLength(4);
    });

    it('categories have id and label', () => {
      for (const c of getVideoCategories()) {
        expect(c.id).toBeTruthy();
        expect(c.label).toBeTruthy();
      }
    });

    it('includes overview, futon, conversion, and assembly', () => {
      const ids = getVideoCategories().map(c => c.id);
      expect(ids).toContain('overview');
      expect(ids).toContain('futon');
      expect(ids).toContain('conversion');
      expect(ids).toContain('assembly');
    });
  });

  describe('filterVideosByCategory', () => {
    const videos = getVideoData();

    it('returns all videos when category is null', () => {
      expect(filterVideosByCategory(videos, null)).toHaveLength(17);
    });

    it('returns all videos when category is empty string', () => {
      expect(filterVideosByCategory(videos, '')).toHaveLength(17);
    });

    it('filters to futon category (7 videos)', () => {
      expect(filterVideosByCategory(videos, 'futon')).toHaveLength(7);
    });

    it('filters to conversion category (4 videos — 3 Wix + 1 Strata)', () => {
      expect(filterVideosByCategory(videos, 'conversion')).toHaveLength(4);
    });

    it('filters to overview category (1 video)', () => {
      expect(filterVideosByCategory(videos, 'overview')).toHaveLength(1);
    });

    it('filters to assembly category (5 videos)', () => {
      expect(filterVideosByCategory(videos, 'assembly')).toHaveLength(5);
    });

    it('returns empty array for unknown category', () => {
      expect(filterVideosByCategory(videos, 'nonexistent')).toHaveLength(0);
    });
  });
});
