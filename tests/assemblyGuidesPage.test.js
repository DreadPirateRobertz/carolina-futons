import { describe, it, expect } from 'vitest';

import {
  getGuideCategories,
  groupGuidesByCategory,
  filterGuides,
  buildVideoEmbedUrl,
  formatEstimatedTime,
  buildHowToSchema,
  getCategoryLabel,
  getCategoryIcon,
} from '../src/public/assemblyGuideHelpers.js';

// ── Sample guide data (matches listAssemblyGuides shape) ──────────────

const sampleGuides = [
  { _id: 'ag-1', sku: 'NDF-SEATTLE', title: 'Seattle Futon Frame Assembly', category: 'futon-frames', estimatedTime: '30 minutes', hasPdf: true, hasVideo: true },
  { _id: 'ag-2', sku: 'ARA-MURPHY', title: 'Murphy Cabinet Bed Setup', category: 'murphy-cabinet-beds', estimatedTime: '45 minutes', hasPdf: true, hasVideo: false },
  { _id: 'ag-3', sku: 'NDF-NOMAD', title: 'Nomad Platform Bed Assembly', category: 'platform-beds', estimatedTime: '20 minutes', hasPdf: false, hasVideo: false },
  { _id: 'ag-4', sku: 'NDF-ASHEVILLE', title: 'Asheville Futon Frame Assembly', category: 'futon-frames', estimatedTime: '25 minutes', hasPdf: true, hasVideo: true },
  { _id: 'ag-5', sku: 'MTR-COMFORT', title: 'Comfort Plus Mattress Setup', category: 'mattresses', estimatedTime: '10 minutes', hasPdf: true, hasVideo: true },
];

// ── getGuideCategories ────────────────────────────────────────────────

describe('getGuideCategories', () => {
  it('returns array of category objects', () => {
    const cats = getGuideCategories();
    expect(Array.isArray(cats)).toBe(true);
    expect(cats.length).toBeGreaterThanOrEqual(4);
  });

  it('each category has id, label, and description', () => {
    const cats = getGuideCategories();
    for (const cat of cats) {
      expect(cat.id).toBeDefined();
      expect(typeof cat.id).toBe('string');
      expect(cat.label).toBeDefined();
      expect(typeof cat.label).toBe('string');
      expect(cat.description).toBeDefined();
    }
  });

  it('labels are user-friendly (capitalized)', () => {
    const cats = getGuideCategories();
    for (const cat of cats) {
      expect(cat.label[0]).toBe(cat.label[0].toUpperCase());
    }
  });

  it('includes futon-frames, mattresses, murphy, platform categories', () => {
    const cats = getGuideCategories();
    const ids = cats.map(c => c.id);
    expect(ids).toContain('futon-frames');
    expect(ids).toContain('mattresses');
    expect(ids).toContain('murphy-cabinet-beds');
    expect(ids).toContain('platform-beds');
  });
});

// ── getCategoryLabel / getCategoryIcon ─────────────────────────────────

describe('getCategoryLabel', () => {
  it('returns label for known category', () => {
    expect(getCategoryLabel('futon-frames')).toBe('Futon Frames');
  });

  it('returns titlecased id for unknown category', () => {
    const label = getCategoryLabel('unknown-thing');
    expect(typeof label).toBe('string');
    expect(label.length).toBeGreaterThan(0);
  });

  it('handles null/undefined gracefully', () => {
    expect(getCategoryLabel(null)).toBe('');
    expect(getCategoryLabel(undefined)).toBe('');
  });
});

describe('getCategoryIcon', () => {
  it('returns emoji string for known categories', () => {
    const icon = getCategoryIcon('futon-frames');
    expect(typeof icon).toBe('string');
    expect(icon.length).toBeGreaterThan(0);
  });

  it('returns default icon for unknown category', () => {
    const icon = getCategoryIcon('unknown');
    expect(typeof icon).toBe('string');
    expect(icon.length).toBeGreaterThan(0);
  });
});

// ── groupGuidesByCategory ─────────────────────────────────────────────

describe('groupGuidesByCategory', () => {
  it('groups guides by category key', () => {
    const grouped = groupGuidesByCategory(sampleGuides);
    expect(grouped['futon-frames']).toHaveLength(2);
    expect(grouped['murphy-cabinet-beds']).toHaveLength(1);
    expect(grouped['platform-beds']).toHaveLength(1);
    expect(grouped['mattresses']).toHaveLength(1);
  });

  it('returns empty object for empty array', () => {
    const grouped = groupGuidesByCategory([]);
    expect(Object.keys(grouped)).toHaveLength(0);
  });

  it('returns empty object for null/undefined', () => {
    expect(Object.keys(groupGuidesByCategory(null))).toHaveLength(0);
    expect(Object.keys(groupGuidesByCategory(undefined))).toHaveLength(0);
  });

  it('preserves all guide data in grouped items', () => {
    const grouped = groupGuidesByCategory(sampleGuides);
    const seattle = grouped['futon-frames'].find(g => g.sku === 'NDF-SEATTLE');
    expect(seattle).toBeDefined();
    expect(seattle.title).toBe('Seattle Futon Frame Assembly');
    expect(seattle.estimatedTime).toBe('30 minutes');
  });
});

// ── filterGuides ──────────────────────────────────────────────────────

describe('filterGuides', () => {
  it('returns all guides when no filters applied', () => {
    const result = filterGuides(sampleGuides, null, '');
    expect(result).toHaveLength(sampleGuides.length);
  });

  it('filters by category', () => {
    const result = filterGuides(sampleGuides, 'futon-frames', '');
    expect(result).toHaveLength(2);
    for (const g of result) {
      expect(g.category).toBe('futon-frames');
    }
  });

  it('filters by search query (title match)', () => {
    const result = filterGuides(sampleGuides, null, 'murphy');
    expect(result).toHaveLength(1);
    expect(result[0].sku).toBe('ARA-MURPHY');
  });

  it('search is case-insensitive', () => {
    const result = filterGuides(sampleGuides, null, 'SEATTLE');
    expect(result).toHaveLength(1);
    expect(result[0].sku).toBe('NDF-SEATTLE');
  });

  it('filters by both category and search', () => {
    const result = filterGuides(sampleGuides, 'futon-frames', 'asheville');
    expect(result).toHaveLength(1);
    expect(result[0].sku).toBe('NDF-ASHEVILLE');
  });

  it('returns empty array for no matches', () => {
    const result = filterGuides(sampleGuides, null, 'nonexistent-product');
    expect(result).toHaveLength(0);
  });

  it('handles null/undefined guides array', () => {
    expect(filterGuides(null, null, '')).toEqual([]);
    expect(filterGuides(undefined, null, '')).toEqual([]);
  });

  it('matches on SKU as well as title', () => {
    const result = filterGuides(sampleGuides, null, 'NDF-NOMAD');
    expect(result).toHaveLength(1);
    expect(result[0].title).toContain('Nomad');
  });

  it('matches on category name for search', () => {
    const result = filterGuides(sampleGuides, null, 'mattress');
    expect(result).toHaveLength(1);
    expect(result[0].sku).toBe('MTR-COMFORT');
  });
});

// ── buildVideoEmbedUrl ────────────────────────────────────────────────

describe('buildVideoEmbedUrl', () => {
  it('converts YouTube watch URL to embed URL', () => {
    const url = buildVideoEmbedUrl('https://youtube.com/watch?v=abc123');
    expect(url).toBe('https://www.youtube.com/embed/abc123');
  });

  it('converts YouTube short URL to embed URL', () => {
    const url = buildVideoEmbedUrl('https://youtu.be/abc123');
    expect(url).toBe('https://www.youtube.com/embed/abc123');
  });

  it('converts www.youtube.com watch URL', () => {
    const url = buildVideoEmbedUrl('https://www.youtube.com/watch?v=xyz789');
    expect(url).toBe('https://www.youtube.com/embed/xyz789');
  });

  it('returns null for null/empty input', () => {
    expect(buildVideoEmbedUrl(null)).toBeNull();
    expect(buildVideoEmbedUrl('')).toBeNull();
    expect(buildVideoEmbedUrl(undefined)).toBeNull();
  });

  it('returns original URL for non-YouTube URLs', () => {
    const url = 'https://vimeo.com/12345';
    expect(buildVideoEmbedUrl(url)).toBe(url);
  });

  it('handles YouTube URL with extra params', () => {
    const url = buildVideoEmbedUrl('https://www.youtube.com/watch?v=abc123&t=30');
    expect(url).toBe('https://www.youtube.com/embed/abc123');
  });
});

// ── formatEstimatedTime ───────────────────────────────────────────────

describe('formatEstimatedTime', () => {
  it('returns formatted time string', () => {
    expect(formatEstimatedTime('30 minutes')).toBe('30 minutes');
  });

  it('returns empty string for null/undefined', () => {
    expect(formatEstimatedTime(null)).toBe('');
    expect(formatEstimatedTime(undefined)).toBe('');
    expect(formatEstimatedTime('')).toBe('');
  });

  it('trims whitespace', () => {
    expect(formatEstimatedTime('  45 minutes  ')).toBe('45 minutes');
  });
});

// ── buildHowToSchema (SEO) ────────────────────────────────────────────

describe('buildHowToSchema', () => {
  const sampleGuide = {
    _id: 'ag-1',
    sku: 'NDF-SEATTLE',
    title: 'Seattle Futon Frame Assembly',
    pdfUrl: 'https://cdn.example.com/seattle.pdf',
    videoUrl: 'https://youtube.com/watch?v=abc123',
    estimatedTime: '30 minutes',
    steps: '<ol><li>Unbox all parts</li><li>Attach side rails</li><li>Connect center beam</li></ol>',
    tips: 'Use a Phillips screwdriver',
    category: 'futon-frames',
  };

  it('returns valid HowTo schema object', () => {
    const schema = buildHowToSchema(sampleGuide);
    expect(schema['@type']).toBe('HowTo');
    expect(schema.name).toBe('Seattle Futon Frame Assembly');
  });

  it('includes estimated time', () => {
    const schema = buildHowToSchema(sampleGuide);
    expect(schema.totalTime).toBeDefined();
  });

  it('includes video if present', () => {
    const schema = buildHowToSchema(sampleGuide);
    expect(schema.video).toBeDefined();
    expect(schema.video['@type']).toBe('VideoObject');
  });

  it('omits video when not present', () => {
    const schema = buildHowToSchema({ ...sampleGuide, videoUrl: null });
    expect(schema.video).toBeUndefined();
  });

  it('returns null for null/undefined guide', () => {
    expect(buildHowToSchema(null)).toBeNull();
    expect(buildHowToSchema(undefined)).toBeNull();
  });

  it('parses steps from HTML', () => {
    const schema = buildHowToSchema(sampleGuide);
    expect(schema.step).toBeDefined();
    expect(Array.isArray(schema.step)).toBe(true);
    expect(schema.step.length).toBeGreaterThan(0);
    expect(schema.step[0]['@type']).toBe('HowToStep');
  });

  it('handles empty steps gracefully', () => {
    const schema = buildHowToSchema({ ...sampleGuide, steps: '' });
    expect(schema.step).toEqual([]);
  });
});
