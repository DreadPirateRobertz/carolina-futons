import { describe, it, expect } from 'vitest';
import {
  getLifestyleScenes,
  getLifestyleScene,
  getLifestyleThumbnail,
  getLifestyleOverlay,
  LIFESTYLE_CATEGORIES,
} from '../src/public/lifestyleImages.js';

const PRIORITY_CATEGORIES = ['futon-frames', 'murphy-cabinet-beds', 'platform-beds'];
const ALL_CATEGORIES = [
  'futon-frames',
  'mattresses',
  'murphy-cabinet-beds',
  'platform-beds',
  'casegoods-accessories',
  'wall-huggers',
  'unfinished-wood',
];

const UNSPLASH_PATTERN = /^https:\/\/images\.unsplash\.com\/photo-[\w-]+\?/;

// ── getLifestyleScenes ──────────────────────────────────────────────

describe('getLifestyleScenes', () => {
  it('returns array of lifestyle scene objects for a category', () => {
    const scenes = getLifestyleScenes('futon-frames');
    expect(Array.isArray(scenes)).toBe(true);
    expect(scenes.length).toBeGreaterThanOrEqual(3);
  });

  it('each scene has required fields: url, alt, room, style', () => {
    const scenes = getLifestyleScenes('futon-frames');
    for (const scene of scenes) {
      expect(scene).toHaveProperty('url');
      expect(scene).toHaveProperty('alt');
      expect(scene).toHaveProperty('room');
      expect(scene).toHaveProperty('style');
      expect(typeof scene.url).toBe('string');
      expect(typeof scene.alt).toBe('string');
      expect(typeof scene.room).toBe('string');
      expect(typeof scene.style).toBe('string');
    }
  });

  it('scene URLs are valid Unsplash URLs', () => {
    const scenes = getLifestyleScenes('platform-beds');
    for (const scene of scenes) {
      expect(scene.url).toMatch(UNSPLASH_PATTERN);
    }
  });

  it.each(ALL_CATEGORIES)('returns scenes for %s', (category) => {
    const scenes = getLifestyleScenes(category);
    expect(scenes.length).toBeGreaterThanOrEqual(2);
  });

  it.each(PRIORITY_CATEGORIES)('priority category %s has at least 4 scenes', (category) => {
    const scenes = getLifestyleScenes(category);
    expect(scenes.length).toBeGreaterThanOrEqual(4);
  });

  it('returns fallback scenes for unknown category', () => {
    const scenes = getLifestyleScenes('nonexistent');
    expect(Array.isArray(scenes)).toBe(true);
    expect(scenes.length).toBeGreaterThanOrEqual(2);
  });

  it('scenes have unique URLs within a category', () => {
    const scenes = getLifestyleScenes('murphy-cabinet-beds');
    const urls = scenes.map(s => s.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('room field describes a room type', () => {
    const scenes = getLifestyleScenes('futon-frames');
    const validRooms = ['living room', 'bedroom', 'guest room', 'studio', 'den', 'loft', 'office', 'sunroom'];
    for (const scene of scenes) {
      expect(validRooms).toContain(scene.room);
    }
  });

  it('respects count parameter', () => {
    const scenes = getLifestyleScenes('futon-frames', 2);
    expect(scenes).toHaveLength(2);
  });

  it('returns all scenes when count exceeds available', () => {
    const all = getLifestyleScenes('futon-frames');
    const more = getLifestyleScenes('futon-frames', 100);
    expect(more).toHaveLength(all.length);
  });

  it('handles null/undefined category', () => {
    expect(getLifestyleScenes(null).length).toBeGreaterThanOrEqual(2);
    expect(getLifestyleScenes(undefined).length).toBeGreaterThanOrEqual(2);
  });
});

// ── getLifestyleScene (single) ──────────────────────────────────────

describe('getLifestyleScene', () => {
  it('returns a single scene object', () => {
    const scene = getLifestyleScene('platform-beds');
    expect(scene).toHaveProperty('url');
    expect(scene).toHaveProperty('alt');
    expect(scene).toHaveProperty('room');
    expect(scene).toHaveProperty('style');
  });

  it('returns first scene by default', () => {
    const scene = getLifestyleScene('futon-frames');
    const scenes = getLifestyleScenes('futon-frames');
    expect(scene.url).toBe(scenes[0].url);
  });

  it('returns scene at specified index', () => {
    const scenes = getLifestyleScenes('futon-frames');
    const scene = getLifestyleScene('futon-frames', 1);
    expect(scene.url).toBe(scenes[1].url);
  });

  it('wraps around when index exceeds available scenes', () => {
    const scenes = getLifestyleScenes('futon-frames');
    const wrapped = getLifestyleScene('futon-frames', scenes.length);
    expect(wrapped.url).toBe(scenes[0].url);
  });

  it('returns fallback for unknown category', () => {
    const scene = getLifestyleScene('nonexistent');
    expect(scene).toHaveProperty('url');
    expect(scene.url).toMatch(UNSPLASH_PATTERN);
  });
});

// ── getLifestyleThumbnail ───────────────────────────────────────────

describe('getLifestyleThumbnail', () => {
  it('resizes Unsplash URL to thumbnail dimensions', () => {
    const thumb = getLifestyleThumbnail('futon-frames');
    expect(thumb).toContain('w=400');
    expect(thumb).toContain('h=300');
  });

  it('returns valid URL for each category', () => {
    for (const cat of ALL_CATEGORIES) {
      const thumb = getLifestyleThumbnail(cat);
      expect(thumb).toMatch(UNSPLASH_PATTERN);
      expect(thumb).toContain('w=400');
    }
  });

  it('returns fallback thumbnail for unknown category', () => {
    const thumb = getLifestyleThumbnail('nonexistent');
    expect(thumb).toMatch(UNSPLASH_PATTERN);
    expect(thumb).toContain('w=400');
  });

  it('accepts custom dimensions', () => {
    const thumb = getLifestyleThumbnail('futon-frames', { width: 600, height: 400 });
    expect(thumb).toContain('w=600');
    expect(thumb).toContain('h=400');
  });
});

// ── getLifestyleOverlay ─────────────────────────────────────────────

describe('getLifestyleOverlay', () => {
  it('returns overlay data with image URL and label', () => {
    const overlay = getLifestyleOverlay('futon-frames');
    expect(overlay).toHaveProperty('imageUrl');
    expect(overlay).toHaveProperty('label');
    expect(overlay).toHaveProperty('alt');
    expect(overlay.label).toBe('See It In a Room');
    expect(overlay.imageUrl).toMatch(UNSPLASH_PATTERN);
  });

  it.each(ALL_CATEGORIES)('returns overlay for %s', (category) => {
    const overlay = getLifestyleOverlay(category);
    expect(overlay.imageUrl).toBeTruthy();
    expect(overlay.label).toBe('See It In a Room');
  });

  it('returns fallback for unknown category', () => {
    const overlay = getLifestyleOverlay('nonexistent');
    expect(overlay.imageUrl).toBeTruthy();
    expect(overlay.label).toBe('See It In a Room');
  });
});

// ── LIFESTYLE_CATEGORIES constant ───────────────────────────────────

describe('LIFESTYLE_CATEGORIES', () => {
  it('exports array of supported categories', () => {
    expect(Array.isArray(LIFESTYLE_CATEGORIES)).toBe(true);
    expect(LIFESTYLE_CATEGORIES.length).toBeGreaterThanOrEqual(7);
  });

  it('includes all priority categories', () => {
    for (const cat of PRIORITY_CATEGORIES) {
      expect(LIFESTYLE_CATEGORIES).toContain(cat);
    }
  });

  it('includes all standard categories', () => {
    for (const cat of ALL_CATEGORIES) {
      expect(LIFESTYLE_CATEGORIES).toContain(cat);
    }
  });
});
