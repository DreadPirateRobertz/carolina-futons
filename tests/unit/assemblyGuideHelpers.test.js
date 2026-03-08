/**
 * Tests for assemblyGuideHelpers.js — Assembly guide page utility functions
 */
import { describe, it, expect } from 'vitest';
import {
  getGuideCategories,
  getCategoryLabel,
  getCategoryIcon,
  groupGuidesByCategory,
  filterGuides,
  buildVideoEmbedUrl,
  formatEstimatedTime,
  buildHowToSchema,
} from '../../src/public/assemblyGuideHelpers.js';

// ── getGuideCategories ────────────────────────────────────────────────

describe('getGuideCategories', () => {
  it('returns array of categories', () => {
    const cats = getGuideCategories();
    expect(Array.isArray(cats)).toBe(true);
    expect(cats.length).toBeGreaterThan(0);
  });

  it('each category has id, label, description, icon', () => {
    getGuideCategories().forEach(c => {
      expect(c).toHaveProperty('id');
      expect(c).toHaveProperty('label');
      expect(c).toHaveProperty('description');
      expect(c).toHaveProperty('icon');
    });
  });

  it('returns a defensive copy', () => {
    const cats1 = getGuideCategories();
    const cats2 = getGuideCategories();
    expect(cats1).not.toBe(cats2);
  });
});

// ── getCategoryLabel ──────────────────────────────────────────────────

describe('getCategoryLabel', () => {
  it('returns known category label', () => {
    expect(getCategoryLabel('futon-frames')).toBe('Futon Frames');
    expect(getCategoryLabel('mattresses')).toBe('Mattresses');
  });

  it('returns title-cased fallback for unknown category', () => {
    expect(getCategoryLabel('some-new-type')).toBe('Some New Type');
  });

  it('returns empty string for null/undefined', () => {
    expect(getCategoryLabel(null)).toBe('');
    expect(getCategoryLabel(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(getCategoryLabel('')).toBe('');
  });
});

// ── getCategoryIcon ───────────────────────────────────────────────────

describe('getCategoryIcon', () => {
  it('returns icon for known category', () => {
    const icon = getCategoryIcon('futon-frames');
    expect(typeof icon).toBe('string');
    expect(icon.length).toBeGreaterThan(0);
  });

  it('returns default icon for unknown category', () => {
    const icon = getCategoryIcon('unknown');
    expect(typeof icon).toBe('string');
    expect(icon.length).toBeGreaterThan(0);
  });

  it('returns default icon for null', () => {
    expect(typeof getCategoryIcon(null)).toBe('string');
  });
});

// ── groupGuidesByCategory ─────────────────────────────────────────────

describe('groupGuidesByCategory', () => {
  it('groups guides by category field', () => {
    const guides = [
      { title: 'A', category: 'frames' },
      { title: 'B', category: 'mattresses' },
      { title: 'C', category: 'frames' },
    ];
    const grouped = groupGuidesByCategory(guides);
    expect(grouped.frames).toHaveLength(2);
    expect(grouped.mattresses).toHaveLength(1);
  });

  it('puts guides without category into "uncategorized"', () => {
    const guides = [{ title: 'No Cat' }];
    const grouped = groupGuidesByCategory(guides);
    expect(grouped.uncategorized).toHaveLength(1);
  });

  it('returns empty object for null/undefined', () => {
    expect(groupGuidesByCategory(null)).toEqual({});
    expect(groupGuidesByCategory(undefined)).toEqual({});
  });

  it('returns empty object for non-array', () => {
    expect(groupGuidesByCategory('not-array')).toEqual({});
  });
});

// ── filterGuides ──────────────────────────────────────────────────────

describe('filterGuides', () => {
  const guides = [
    { title: 'Frame Assembly', sku: 'FR-001', category: 'frames' },
    { title: 'Mattress Setup', sku: 'MT-001', category: 'mattresses' },
    { title: 'Murphy Install', sku: 'MB-001', category: 'murphy' },
  ];

  it('filters by category', () => {
    const result = filterGuides(guides, 'frames', '');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Frame Assembly');
  });

  it('filters by search query (title)', () => {
    const result = filterGuides(guides, null, 'murphy');
    expect(result).toHaveLength(1);
  });

  it('filters by search query (sku)', () => {
    const result = filterGuides(guides, null, 'MT-001');
    expect(result).toHaveLength(1);
  });

  it('combines category and query filters', () => {
    const result = filterGuides(guides, 'frames', 'assembly');
    expect(result).toHaveLength(1);
  });

  it('returns all when no filters applied', () => {
    expect(filterGuides(guides, null, '')).toHaveLength(3);
  });

  it('returns empty array for null guides', () => {
    expect(filterGuides(null, null, '')).toEqual([]);
  });

  it('search is case-insensitive', () => {
    expect(filterGuides(guides, null, 'FRAME')).toHaveLength(1);
  });

  it('trims query whitespace', () => {
    expect(filterGuides(guides, null, '  murphy  ')).toHaveLength(1);
  });

  it('returns empty when query matches nothing', () => {
    expect(filterGuides(guides, null, 'nonexistent')).toEqual([]);
  });
});

// ── buildVideoEmbedUrl ────────────────────────────────────────────────

describe('buildVideoEmbedUrl', () => {
  it('converts youtube.com/watch URL to embed', () => {
    const result = buildVideoEmbedUrl('https://www.youtube.com/watch?v=abc123');
    expect(result).toBe('https://www.youtube.com/embed/abc123');
  });

  it('converts youtu.be short URL to embed', () => {
    const result = buildVideoEmbedUrl('https://youtu.be/abc123');
    expect(result).toBe('https://www.youtube.com/embed/abc123');
  });

  it('handles youtube.com without www', () => {
    const result = buildVideoEmbedUrl('https://youtube.com/watch?v=xyz789');
    expect(result).toBe('https://www.youtube.com/embed/xyz789');
  });

  it('strips extra query params from watch URL', () => {
    const result = buildVideoEmbedUrl('https://www.youtube.com/watch?v=abc123&t=30');
    expect(result).toBe('https://www.youtube.com/embed/abc123');
  });

  it('returns non-YouTube URLs as-is', () => {
    const url = 'https://vimeo.com/12345';
    expect(buildVideoEmbedUrl(url)).toBe(url);
  });

  it('returns null for null/undefined input', () => {
    expect(buildVideoEmbedUrl(null)).toBeNull();
    expect(buildVideoEmbedUrl(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(buildVideoEmbedUrl('')).toBeNull();
  });
});

// ── formatEstimatedTime ───────────────────────────────────────────────

describe('formatEstimatedTime', () => {
  it('trims and returns time string', () => {
    expect(formatEstimatedTime('  30 minutes  ')).toBe('30 minutes');
  });

  it('returns empty string for null/undefined', () => {
    expect(formatEstimatedTime(null)).toBe('');
    expect(formatEstimatedTime(undefined)).toBe('');
  });
});

// ── buildHowToSchema ──────────────────────────────────────────────────

describe('buildHowToSchema', () => {
  it('returns null for null guide', () => {
    expect(buildHowToSchema(null)).toBeNull();
  });

  it('builds valid HowTo schema', () => {
    const guide = {
      title: 'Assemble Frame',
      estimatedTime: '30 minutes',
      steps: '<ol><li>Unpack parts</li><li>Attach legs</li></ol>',
    };
    const schema = buildHowToSchema(guide);
    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('HowTo');
    expect(schema.name).toBe('Assemble Frame');
    expect(schema.totalTime).toBe('PT30M');
    expect(schema.step).toHaveLength(2);
    expect(schema.step[0].text).toBe('Unpack parts');
    expect(schema.step[0].position).toBe(1);
  });

  it('includes video when videoUrl is present', () => {
    const guide = {
      title: 'Frame Guide',
      steps: '<ol><li>Step 1</li></ol>',
      videoUrl: 'https://youtube.com/watch?v=abc',
    };
    const schema = buildHowToSchema(guide);
    expect(schema.video['@type']).toBe('VideoObject');
    expect(schema.video.contentUrl).toBe(guide.videoUrl);
  });

  it('omits video when no videoUrl', () => {
    const guide = { title: 'Basic', steps: '' };
    const schema = buildHowToSchema(guide);
    expect(schema.video).toBeUndefined();
  });

  it('handles empty steps HTML', () => {
    const guide = { title: 'Test', steps: '' };
    const schema = buildHowToSchema(guide);
    expect(schema.step).toEqual([]);
  });

  it('handles null steps', () => {
    const guide = { title: 'Test', steps: null };
    const schema = buildHowToSchema(guide);
    expect(schema.step).toEqual([]);
  });

  it('strips HTML from step text', () => {
    const guide = {
      title: 'Test',
      steps: '<ol><li><strong>Bold step</strong> text</li></ol>',
    };
    const schema = buildHowToSchema(guide);
    expect(schema.step[0].text).toBe('Bold step text');
  });

  it('handles missing estimatedTime', () => {
    const guide = { title: 'Test', steps: '' };
    const schema = buildHowToSchema(guide);
    expect(schema.totalTime).toBeUndefined();
  });
});
