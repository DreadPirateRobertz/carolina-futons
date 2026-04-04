/**
 * @file buyingGuideOgCards.test.js
 * @description Tests for cf-jdgq: auto-generated OG social card specs and
 * SVG markup for all 8 buying guides.
 *
 * Covers:
 *  - wrapTitle: single-line, multi-line, word-boundary splits, empty input
 *  - escapeXml: & < > " ' all escaped; safe strings untouched; null/undefined
 *  - truncateDescription: under-limit passthrough, over-limit ellipsis at word boundary
 *  - formatPublishDate: valid date → 'Mon YYYY', invalid → '', missing → ''
 *  - computeReadingTime: empty sections, single section, multi-section, rounding
 *  - generateOgCardSvg: SVG structure, dimensions, title/category text, brand,
 *      escaping, null spec, one-line vs two-line title, footer
 *  - getOgCardSpec: all 8 slugs return success + complete spec fields,
 *      unknown slug returns error, coming-soon guides return error
 *  - getAllOgCardSpecs: returns exactly 8 specs, all slugs present, no duplicates
 *
 * cf-jdgq
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset } from 'wix-data';
import {
  OG_WIDTH,
  OG_HEIGHT,
  CATEGORY_COLORS,
  wrapTitle,
  escapeXml,
  truncateDescription,
  formatPublishDate,
  computeReadingTime,
  generateOgCardSvg,
  getOgCardSpec,
  getAllOgCardSpecs,
} from '../src/backend/buyingGuideOgCards.web.js';

const ALL_SLUGS = [
  'futon-frames',
  'mattresses',
  'covers',
  'pillows',
  'storage',
  'outdoor',
  'accessories',
  'bundle-deals',
];

beforeEach(() => {
  __reset();
});

// ── OG_WIDTH / OG_HEIGHT constants ───────────────���────────────────────────────

describe('OG card dimensions', () => {
  it('OG_WIDTH is 1200', () => {
    expect(OG_WIDTH).toBe(1200);
  });

  it('OG_HEIGHT is 630', () => {
    expect(OG_HEIGHT).toBe(630);
  });
});

// ── CATEGORY_COLORS ─────────────────���──────────────────────────���──────────────

describe('CATEGORY_COLORS', () => {
  it('has an entry for every guide slug', () => {
    for (const slug of ALL_SLUGS) {
      expect(CATEGORY_COLORS[slug]).toBeTruthy();
    }
  });

  it('all color values are valid 6-digit hex', () => {
    for (const color of Object.values(CATEGORY_COLORS)) {
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('each guide has a distinct accent color', () => {
    const colors = ALL_SLUGS.map(s => CATEGORY_COLORS[s]);
    const unique = new Set(colors);
    expect(unique.size).toBe(ALL_SLUGS.length);
  });
});

// ── wrapTitle ───────────────────────────────────────────���─────────────────────

describe('wrapTitle', () => {
  it('returns a single-element array for a short title', () => {
    const lines = wrapTitle('Short Title', 38);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe('Short Title');
  });

  it('wraps a long title into two lines', () => {
    const title = 'The Complete Futon Frame Buying Guide for 2026';
    const lines = wrapTitle(title, 38);
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });

  it('never splits a word across lines', () => {
    const title = 'Futon Mattress Buying Guide Thickness Fill Types and Comfort';
    const lines = wrapTitle(title, 30);
    const rejoined = lines.join(' ');
    expect(rejoined).toBe(title);
  });

  it('no individual line exceeds maxLen', () => {
    const title = 'Futon Storage Solutions Drawers Shelves and Space-Saving Ideas';
    const lines = wrapTitle(title, 35);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(35);
    }
  });

  it('returns [""] for empty string', () => {
    expect(wrapTitle('')).toEqual(['']);
  });

  it('returns [""] for null', () => {
    expect(wrapTitle(null)).toEqual(['']);
  });

  it('uses 38 as default maxLen', () => {
    const title = 'A'.repeat(38);
    expect(wrapTitle(title)).toHaveLength(1);
  });

  it('splits when title is over maxLen', () => {
    const title = 'A'.repeat(20) + ' ' + 'B'.repeat(20);
    const lines = wrapTitle(title, 38);
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });
});

// ── escapeXml ─────────────────────���───────────────────────���───────────────────

describe('escapeXml', () => {
  it('escapes ampersands', () => {
    expect(escapeXml('Throw Pillows & Bolsters')).toBe('Throw Pillows &amp; Bolsters');
  });

  it('escapes less-than signs', () => {
    expect(escapeXml('a < b')).toBe('a &lt; b');
  });

  it('escapes greater-than signs', () => {
    expect(escapeXml('a > b')).toBe('a &gt; b');
  });

  it('escapes double quotes', () => {
    expect(escapeXml('"quote"')).toBe('&quot;quote&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeXml("it's")).toBe('it&apos;s');
  });

  it('leaves safe strings unchanged', () => {
    expect(escapeXml('Carolina Futons Buying Guide')).toBe('Carolina Futons Buying Guide');
  });

  it('returns empty string for null', () => {
    expect(escapeXml(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(escapeXml(undefined)).toBe('');
  });

  it('escapes multiple special chars in one string', () => {
    expect(escapeXml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });
});

// ── truncateDescription ───────────────────────────────────────────────────────

describe('truncateDescription', () => {
  it('returns the string unchanged when under maxLen', () => {
    const desc = 'Short description.';
    expect(truncateDescription(desc, 90)).toBe(desc);
  });

  it('returns the string unchanged when exactly maxLen', () => {
    const desc = 'x'.repeat(90);
    expect(truncateDescription(desc, 90)).toBe(desc);
  });

  it('truncates at word boundary and appends ellipsis', () => {
    const desc = 'Everything you need to know before buying a futon frame for your home.';
    const result = truncateDescription(desc, 40);
    expect(result.endsWith('\u2026')).toBe(true);
    expect(result.length).toBeLessThan(desc.length);
  });

  it('does not cut mid-word', () => {
    const desc = 'Choose the perfect futon mattress for your needs.';
    const result = truncateDescription(desc, 20);
    // The truncated part (before ellipsis) must be a valid word prefix from the original
    const withoutEllipsis = result.slice(0, -1);
    expect(desc.startsWith(withoutEllipsis)).toBe(true);
  });

  it('returns empty string for null', () => {
    expect(truncateDescription(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(truncateDescription(undefined)).toBe('');
  });

  it('uses 90 as default maxLen', () => {
    const long = 'word '.repeat(30);
    const result = truncateDescription(long);
    expect(result.endsWith('\u2026')).toBe(true);
  });
});

// ── formatPublishDate ─────────────────��─────────────────────────��─────────────

describe('formatPublishDate', () => {
  it('formats a valid ISO date as "Mon YYYY"', () => {
    expect(formatPublishDate('2026-02-20')).toBe('Feb 2026');
  });

  it('formats January correctly', () => {
    expect(formatPublishDate('2026-01-05')).toBe('Jan 2026');
  });

  it('formats December correctly', () => {
    expect(formatPublishDate('2025-12-01')).toBe('Dec 2025');
  });

  it('returns empty string for null', () => {
    expect(formatPublishDate(null)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(formatPublishDate('')).toBe('');
  });

  it('returns empty string for invalid date string', () => {
    expect(formatPublishDate('not-a-date')).toBe('');
  });
});

// ── computeReadingTime ──────────────────���───────────────────��─────────────────

describe('computeReadingTime', () => {
  it('returns 0 for a guide with empty sections array', () => {
    expect(computeReadingTime({ sections: [] })).toBe(0);
  });

  it('returns 0 for null guide', () => {
    expect(computeReadingTime(null)).toBe(0);
  });

  it('returns 0 for guide with no sections property', () => {
    expect(computeReadingTime({})).toBe(0);
  });

  it('returns at least 1 for a section with content', () => {
    const guide = { sections: [{ heading: 'Intro', body: 'word '.repeat(10) }] };
    expect(computeReadingTime(guide)).toBeGreaterThanOrEqual(1);
  });

  it('sums words across multiple sections', () => {
    const guide = {
      sections: [
        { body: 'word '.repeat(100) },
        { body: 'word '.repeat(100) },
      ],
    };
    // 200 words / 200 wpm = 1 minute
    expect(computeReadingTime(guide)).toBe(1);
  });

  it('counts heading words as well as body words', () => {
    const guide = {
      sections: [
        { heading: 'The Guide', body: 'word '.repeat(195) },
      ],
    };
    // 2 (heading) + 195 (body) = 197 → rounds to 1
    expect(computeReadingTime(guide)).toBe(1);
  });

  it('rounds to nearest minute', () => {
    // 300 words / 200 wpm = 1.5 → rounds to 2
    const guide = { sections: [{ body: 'word '.repeat(300) }] };
    expect(computeReadingTime(guide)).toBe(2);
  });

  it('returns a positive integer for a realistic guide', () => {
    const guide = { sections: [{ body: 'word '.repeat(800) }] };
    const rt = computeReadingTime(guide);
    expect(Number.isInteger(rt)).toBe(true);
    expect(rt).toBeGreaterThan(0);
  });
});

// ── generateOgCardSvg ─────────────────────────────────────────��───────────────

const BASE_SPEC = {
  slug:            'futon-frames',
  title:           'The Complete Futon Frame Buying Guide for 2026',
  categoryLabel:   'Futon Frames',
  metaDescription: 'Everything you need to know before buying a futon frame.',
  ogImageUrl:      'https://www.carolinafutons.com/og-images/buying-guides/futon-frames-social.jpg',
  bgColor:         '#1E3A5F',
  accentColor:     '#5B8FA8',
  publishDate:     '2026-02-20',
  readingTime:     12,
  width:           OG_WIDTH,
  height:          OG_HEIGHT,
};

describe('generateOgCardSvg', () => {
  it('returns empty string for null spec', () => {
    expect(generateOgCardSvg(null)).toBe('');
  });

  it('returns empty string for undefined spec', () => {
    expect(generateOgCardSvg(undefined)).toBe('');
  });

  it('returns a string starting with <svg', () => {
    expect(generateOgCardSvg(BASE_SPEC)).toMatch(/^<svg/);
  });

  it('includes the SVG namespace declaration', () => {
    expect(generateOgCardSvg(BASE_SPEC)).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it('includes width="1200"', () => {
    expect(generateOgCardSvg(BASE_SPEC)).toContain('width="1200"');
  });

  it('includes height="630"', () => {
    expect(generateOgCardSvg(BASE_SPEC)).toContain('height="630"');
  });

  it('includes part of the guide title text', () => {
    const svg = generateOgCardSvg(BASE_SPEC);
    expect(svg).toContain('Complete Futon Frame');
  });

  it('includes the category label text', () => {
    expect(generateOgCardSvg(BASE_SPEC)).toContain('Futon Frames');
  });

  it('includes "Carolina Futons" brand name', () => {
    expect(generateOgCardSvg(BASE_SPEC)).toContain('Carolina Futons');
  });

  it('includes "BUYING GUIDE" label', () => {
    expect(generateOgCardSvg(BASE_SPEC)).toContain('BUYING GUIDE');
  });

  it('includes the accent color', () => {
    expect(generateOgCardSvg(BASE_SPEC)).toContain('#5B8FA8');
  });

  it('includes the background color', () => {
    expect(generateOgCardSvg(BASE_SPEC)).toContain('#1E3A5F');
  });

  it('includes reading time in the footer', () => {
    expect(generateOgCardSvg(BASE_SPEC)).toContain('12 min read');
  });

  it('includes the formatted publish date', () => {
    expect(generateOgCardSvg(BASE_SPEC)).toContain('Feb 2026');
  });

  it('closes the SVG tag', () => {
    expect(generateOgCardSvg(BASE_SPEC)).toContain('</svg>');
  });

  it('XML-escapes ampersands in the title', () => {
    const spec = { ...BASE_SPEC, title: 'Pillows & Bolsters Guide' };
    expect(generateOgCardSvg(spec)).toContain('&amp;');
    expect(generateOgCardSvg(spec)).not.toContain(' & ');
  });

  it('XML-escapes angle brackets in description', () => {
    const spec = { ...BASE_SPEC, metaDescription: 'Choose <best> futon.' };
    const svg = generateOgCardSvg(spec);
    expect(svg).toContain('&lt;best&gt;');
    expect(svg).not.toContain('<best>');
  });

  it('produces different SVG for different accent colors', () => {
    const svg1 = generateOgCardSvg({ ...BASE_SPEC, accentColor: '#5B8FA8' });
    const svg2 = generateOgCardSvg({ ...BASE_SPEC, accentColor: '#C8960C' });
    expect(svg1).not.toBe(svg2);
  });

  it('omits reading-time footer text when readingTime is 0 and no date', () => {
    const spec = { ...BASE_SPEC, readingTime: 0, publishDate: '' };
    expect(generateOgCardSvg(spec)).not.toContain('min read');
  });

  it('still includes brand name when there is no footer meta', () => {
    const spec = { ...BASE_SPEC, readingTime: 0, publishDate: '' };
    expect(generateOgCardSvg(spec)).toContain('Carolina Futons');
  });

  it('two-line title has at least two font-size-52 text elements', () => {
    const spec = { ...BASE_SPEC, title: 'Futon Storage Solutions: Drawers, Shelves & Space-Saving Ideas' };
    const svg = generateOgCardSvg(spec);
    const matches = svg.match(/font-size="52"/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('generates valid XML with a single root svg element', () => {
    const svg = generateOgCardSvg(BASE_SPEC);
    expect((svg.match(/<svg/g) || []).length).toBe(1);
    expect((svg.match(/<\/svg>/g) || []).length).toBe(1);
  });

  it('uses fallback colors when bgColor/accentColor are undefined', () => {
    const spec = { ...BASE_SPEC, bgColor: undefined, accentColor: undefined };
    expect(() => generateOgCardSvg(spec)).not.toThrow();
    expect(generateOgCardSvg(spec)).toContain('fill=');
  });
});

// ── getOgCardSpec ─────────────────────────────────────────────��───────────────

describe('getOgCardSpec', () => {
  it.each(ALL_SLUGS)('returns success for "%s"', async (slug) => {
    const result = await getOgCardSpec(slug);
    expect(result.success).toBe(true);
  });

  it.each(ALL_SLUGS)('spec.slug matches input for "%s"', async (slug) => {
    const { spec } = await getOgCardSpec(slug);
    expect(spec.slug).toBe(slug);
  });

  it.each(ALL_SLUGS)('spec.title is a non-empty string for "%s"', async (slug) => {
    const { spec } = await getOgCardSpec(slug);
    expect(typeof spec.title).toBe('string');
    expect(spec.title.length).toBeGreaterThan(0);
  });

  it.each(ALL_SLUGS)('spec.categoryLabel is non-empty for "%s"', async (slug) => {
    const { spec } = await getOgCardSpec(slug);
    expect(spec.categoryLabel).toBeTruthy();
  });

  it.each(ALL_SLUGS)('spec.ogImageUrl is an HTTPS URL for "%s"', async (slug) => {
    const { spec } = await getOgCardSpec(slug);
    expect(spec.ogImageUrl).toMatch(/^https:\/\//);
  });

  it.each(ALL_SLUGS)('spec.ogImageUrl contains slug and "social" for "%s"', async (slug) => {
    const { spec } = await getOgCardSpec(slug);
    expect(spec.ogImageUrl).toContain(slug);
    expect(spec.ogImageUrl).toContain('social');
  });

  it.each(ALL_SLUGS)('spec.accentColor is a valid hex for "%s"', async (slug) => {
    const { spec } = await getOgCardSpec(slug);
    expect(spec.accentColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it.each(ALL_SLUGS)('spec.accentColor matches CATEGORY_COLORS for "%s"', async (slug) => {
    const { spec } = await getOgCardSpec(slug);
    expect(spec.accentColor).toBe(CATEGORY_COLORS[slug]);
  });

  it.each(ALL_SLUGS)('spec.readingTime is a positive integer for "%s"', async (slug) => {
    const { spec } = await getOgCardSpec(slug);
    expect(Number.isInteger(spec.readingTime)).toBe(true);
    expect(spec.readingTime).toBeGreaterThan(0);
  });

  it.each(ALL_SLUGS)('spec.width is 1200 for "%s"', async (slug) => {
    const { spec } = await getOgCardSpec(slug);
    expect(spec.width).toBe(1200);
  });

  it.each(ALL_SLUGS)('spec.height is 630 for "%s"', async (slug) => {
    const { spec } = await getOgCardSpec(slug);
    expect(spec.height).toBe(630);
  });

  it.each(ALL_SLUGS)('spec.bgColor is a valid hex for "%s"', async (slug) => {
    const { spec } = await getOgCardSpec(slug);
    expect(spec.bgColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it.each(ALL_SLUGS)('spec.publishDate is non-empty for "%s"', async (slug) => {
    const { spec } = await getOgCardSpec(slug);
    expect(spec.publishDate).toBeTruthy();
  });

  it.each(ALL_SLUGS)('spec.metaDescription is non-empty for "%s"', async (slug) => {
    const { spec } = await getOgCardSpec(slug);
    expect(spec.metaDescription).toBeTruthy();
  });

  it('returns failure for an unknown slug', async () => {
    const result = await getOgCardSpec('unknown-category');
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns failure for empty slug', async () => {
    const result = await getOgCardSpec('');
    expect(result.success).toBe(false);
  });

  it('spec can be passed directly to generateOgCardSvg without error', async () => {
    const { spec } = await getOgCardSpec('futon-frames');
    expect(() => generateOgCardSvg(spec)).not.toThrow();
    expect(generateOgCardSvg(spec)).toMatch(/^<svg/);
  });
});

// ── getAllOgCardSpecs ───────────────��─────────────────────────────────────────

describe('getAllOgCardSpecs', () => {
  it('returns success', async () => {
    const result = await getAllOgCardSpecs();
    expect(result.success).toBe(true);
  });

  it('returns exactly 8 specs', async () => {
    const { specs } = await getAllOgCardSpecs();
    expect(specs).toHaveLength(8);
  });

  it('all 8 buying guide slugs are present', async () => {
    const { specs } = await getAllOgCardSpecs();
    const returnedSlugs = specs.map(s => s.slug);
    for (const slug of ALL_SLUGS) {
      expect(returnedSlugs).toContain(slug);
    }
  });

  it('no duplicate slugs', async () => {
    const { specs } = await getAllOgCardSpecs();
    const slugs = specs.map(s => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('each spec has all required fields', async () => {
    const { specs } = await getAllOgCardSpecs();
    const required = ['slug', 'title', 'categoryLabel', 'metaDescription',
                      'ogImageUrl', 'bgColor', 'accentColor', 'publishDate',
                      'readingTime', 'width', 'height'];
    for (const spec of specs) {
      for (const field of required) {
        expect(spec[field] !== undefined).toBe(true);
      }
    }
  });

  it('all specs have distinct ogImageUrls', async () => {
    const { specs } = await getAllOgCardSpecs();
    const urls = specs.map(s => s.ogImageUrl);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('all specs have distinct accentColors', async () => {
    const { specs } = await getAllOgCardSpecs();
    const colors = specs.map(s => s.accentColor);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it('every spec passes through generateOgCardSvg without throwing', async () => {
    const { specs } = await getAllOgCardSpecs();
    for (const spec of specs) {
      expect(() => generateOgCardSvg(spec)).not.toThrow();
    }
  });

  it('every generated SVG contains the first word of the guide title', async () => {
    const { specs } = await getAllOgCardSpecs();
    for (const spec of specs) {
      const svg = generateOgCardSvg(spec);
      const firstWord = spec.title.split(' ')[0];
      expect(svg).toContain(firstWord);
    }
  });
});
