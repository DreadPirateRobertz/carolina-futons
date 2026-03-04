import { describe, it, expect } from 'vitest';
import {
  getGuideCategories,
  formatGuideDate,
  buildBreadcrumbs,
  buildTableOfContents,
  buildComparisonRows,
  getReadingTime,
  buildShareLinks,
  getRelatedGuideCards,
  truncateDescription,
  getCategoryIcon,
  buildFaqAccordionData,
  buildHubCardData,
} from '../src/public/buyingGuidesHelpers.js';

// ── Guide Categories ──────────────────────────────────────────────────

describe('getGuideCategories', () => {
  it('returns all 8 guide categories', () => {
    const cats = getGuideCategories();
    expect(Array.isArray(cats)).toBe(true);
    expect(cats).toHaveLength(8);
  });

  it('each category has slug, label, and description', () => {
    const cats = getGuideCategories();
    for (const cat of cats) {
      expect(typeof cat.slug).toBe('string');
      expect(typeof cat.label).toBe('string');
      expect(typeof cat.description).toBe('string');
      expect(cat.slug.length).toBeGreaterThan(0);
      expect(cat.label.length).toBeGreaterThan(0);
    }
  });

  it('slugs are unique', () => {
    const cats = getGuideCategories();
    const slugs = cats.map(c => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('includes expected categories', () => {
    const cats = getGuideCategories();
    const slugs = cats.map(c => c.slug);
    expect(slugs).toContain('futon-frames');
    expect(slugs).toContain('mattresses');
    expect(slugs).toContain('covers');
    expect(slugs).toContain('bundle-deals');
  });
});

// ── Format Guide Date ─────────────────────────────────────────────────

describe('formatGuideDate', () => {
  it('formats ISO date to human-readable', () => {
    const result = formatGuideDate('2026-02-20');
    expect(result).toBe('February 20, 2026');
  });

  it('handles different months', () => {
    expect(formatGuideDate('2025-12-01')).toBe('December 1, 2025');
    expect(formatGuideDate('2026-01-15')).toBe('January 15, 2026');
  });

  it('returns empty string for null/undefined', () => {
    expect(formatGuideDate(null)).toBe('');
    expect(formatGuideDate(undefined)).toBe('');
    expect(formatGuideDate('')).toBe('');
  });

  it('returns empty string for invalid date', () => {
    expect(formatGuideDate('not-a-date')).toBe('');
    expect(formatGuideDate('13-45-99')).toBe('');
  });
});

// ── Build Breadcrumbs ─────────────────────────────────────────────────

describe('buildBreadcrumbs', () => {
  it('returns hub breadcrumbs when no slug provided', () => {
    const crumbs = buildBreadcrumbs();
    expect(crumbs).toHaveLength(2);
    expect(crumbs[0]).toEqual({ label: 'Home', url: '/' });
    expect(crumbs[1]).toEqual({ label: 'Buying Guides', url: '/buying-guides' });
  });

  it('returns detail breadcrumbs when slug provided', () => {
    const crumbs = buildBreadcrumbs('futon-frames', 'Futon Frames');
    expect(crumbs).toHaveLength(3);
    expect(crumbs[0]).toEqual({ label: 'Home', url: '/' });
    expect(crumbs[1]).toEqual({ label: 'Buying Guides', url: '/buying-guides' });
    expect(crumbs[2]).toEqual({ label: 'Futon Frames', url: '/buying-guides/futon-frames' });
  });

  it('handles missing label by titlecasing slug', () => {
    const crumbs = buildBreadcrumbs('outdoor');
    expect(crumbs[2].label).toBe('Outdoor');
  });
});

// ── Build Table of Contents ───────────────────────────────────────────

describe('buildTableOfContents', () => {
  it('builds TOC from sections array', () => {
    const sections = [
      { heading: 'First Section', body: 'text' },
      { heading: 'Second Section', body: 'text' },
    ];
    const toc = buildTableOfContents(sections);
    expect(toc).toHaveLength(2);
    expect(toc[0]).toEqual({ id: 'first-section', label: 'First Section' });
    expect(toc[1]).toEqual({ id: 'second-section', label: 'Second Section' });
  });

  it('returns empty array for null/empty sections', () => {
    expect(buildTableOfContents(null)).toEqual([]);
    expect(buildTableOfContents([])).toEqual([]);
    expect(buildTableOfContents(undefined)).toEqual([]);
  });

  it('generates valid CSS-safe ids', () => {
    const sections = [{ heading: 'What to Look For: A Quick Checklist', body: '' }];
    const toc = buildTableOfContents(sections);
    expect(toc[0].id).toBe('what-to-look-for-a-quick-checklist');
    expect(toc[0].id).toMatch(/^[a-z0-9-]+$/);
  });
});

// ── Build Comparison Rows ─────────────────────────────────────────────

describe('buildComparisonRows', () => {
  const table = {
    title: 'Frame Comparison',
    headers: ['Feature', 'Wood', 'Metal'],
    rows: [
      ['Durability', '15-20 years', '8-12 years'],
      ['Price', '$400-$900', '$150-$400'],
    ],
  };

  it('returns structured row objects', () => {
    const rows = buildComparisonRows(table);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      _id: 'row-0',
      feature: 'Durability',
      values: ['15-20 years', '8-12 years'],
    });
  });

  it('returns empty array for null table', () => {
    expect(buildComparisonRows(null)).toEqual([]);
    expect(buildComparisonRows(undefined)).toEqual([]);
  });

  it('returns empty array for table with no rows', () => {
    expect(buildComparisonRows({ headers: ['A'], rows: [] })).toEqual([]);
  });
});

// ── Reading Time ──────────────────────────────────────────────────────

describe('getReadingTime', () => {
  it('calculates reading time from sections', () => {
    const sections = [
      { heading: 'A', body: 'word '.repeat(200) },
      { heading: 'B', body: 'word '.repeat(200) },
    ];
    const time = getReadingTime(sections);
    expect(time).toBeGreaterThanOrEqual(1);
    expect(time).toBeLessThanOrEqual(5);
  });

  it('returns 1 for very short content', () => {
    expect(getReadingTime([{ heading: 'A', body: 'Short text' }])).toBe(1);
  });

  it('returns 0 for null/empty', () => {
    expect(getReadingTime(null)).toBe(0);
    expect(getReadingTime([])).toBe(0);
  });

  it('handles sections with missing body', () => {
    // Heading alone has words → minimum 1 minute
    expect(getReadingTime([{ heading: 'A' }])).toBe(1);
  });
});

// ── Build Share Links ─────────────────────────────────────────────────

describe('buildShareLinks', () => {
  it('builds social share URLs', () => {
    const links = buildShareLinks('futon-frames', 'Futon Frame Guide');
    expect(links.facebook).toContain('facebook.com');
    expect(links.twitter).toContain('twitter.com');
    expect(links.pinterest).toContain('pinterest.com');
    expect(links.email).toContain('mailto:');
  });

  it('encodes URL components', () => {
    const links = buildShareLinks('futon-frames', 'Title & Special <chars>');
    expect(links.facebook).not.toContain('&');
    expect(links.twitter).toContain(encodeURIComponent('Title & Special <chars>'));
  });

  it('returns empty object for missing slug', () => {
    expect(buildShareLinks(null, 'Title')).toEqual({});
    expect(buildShareLinks('', 'Title')).toEqual({});
  });
});

// ── Related Guide Cards ───────────────────────────────────────────────

describe('getRelatedGuideCards', () => {
  const allGuides = [
    { slug: 'futon-frames', title: 'Frames', categoryLabel: 'Futon Frames', heroImage: '/img1.jpg' },
    { slug: 'mattresses', title: 'Mattresses', categoryLabel: 'Mattresses', heroImage: '/img2.jpg' },
    { slug: 'covers', title: 'Covers', categoryLabel: 'Covers', heroImage: '/img3.jpg' },
    { slug: 'pillows', title: 'Pillows', categoryLabel: 'Pillows', heroImage: '/img4.jpg' },
  ];

  it('returns guides excluding current slug', () => {
    const cards = getRelatedGuideCards('futon-frames', allGuides, 3);
    expect(cards.every(c => c.slug !== 'futon-frames')).toBe(true);
    expect(cards).toHaveLength(3);
  });

  it('limits to requested count', () => {
    const cards = getRelatedGuideCards('futon-frames', allGuides, 2);
    expect(cards).toHaveLength(2);
  });

  it('returns empty array when no guides provided', () => {
    expect(getRelatedGuideCards('x', null, 3)).toEqual([]);
    expect(getRelatedGuideCards('x', [], 3)).toEqual([]);
  });

  it('each card has required display fields', () => {
    const cards = getRelatedGuideCards('futon-frames', allGuides, 3);
    for (const card of cards) {
      expect(card.slug).toBeTruthy();
      expect(card.title).toBeTruthy();
      expect(card.url).toContain('/buying-guides/');
    }
  });
});

// ── Truncate Description ──────────────────────────────────────────────

describe('truncateDescription', () => {
  it('truncates long text with ellipsis', () => {
    const long = 'word '.repeat(100);
    const result = truncateDescription(long, 50);
    expect(result.length).toBeLessThanOrEqual(53); // 50 + '...'
    expect(result).toMatch(/\.\.\.$/);
  });

  it('does not truncate short text', () => {
    expect(truncateDescription('Short text', 50)).toBe('Short text');
  });

  it('returns empty string for null/undefined', () => {
    expect(truncateDescription(null, 50)).toBe('');
    expect(truncateDescription(undefined, 50)).toBe('');
  });

  it('truncates at word boundary', () => {
    const text = 'Hello world this is a test string';
    const result = truncateDescription(text, 15);
    expect(result).not.toMatch(/\s\.\.\.$/); // No trailing space before ellipsis
  });
});

// ── Category Icon ─────────────────────────────────────────────────────

describe('getCategoryIcon', () => {
  it('returns icon identifier for known categories', () => {
    expect(getCategoryIcon('futon-frames')).toBeTruthy();
    expect(getCategoryIcon('mattresses')).toBeTruthy();
    expect(getCategoryIcon('covers')).toBeTruthy();
  });

  it('returns default icon for unknown category', () => {
    expect(getCategoryIcon('unknown-cat')).toBeTruthy();
    expect(getCategoryIcon('')).toBeTruthy();
    expect(getCategoryIcon(null)).toBeTruthy();
  });
});

// ── FAQ Accordion Data ────────────────────────────────────────────────

describe('buildFaqAccordionData', () => {
  const faqs = [
    { question: 'What is the best frame?', answer: 'Solid hardwood.' },
    { question: 'How much?', answer: '$400-$700.' },
  ];

  it('returns accordion items with _id, question, answer', () => {
    const items = buildFaqAccordionData(faqs);
    expect(items).toHaveLength(2);
    expect(items[0]._id).toBe('faq-0');
    expect(items[0].question).toBe('What is the best frame?');
    expect(items[0].answer).toBe('Solid hardwood.');
  });

  it('returns empty array for null/empty', () => {
    expect(buildFaqAccordionData(null)).toEqual([]);
    expect(buildFaqAccordionData([])).toEqual([]);
    expect(buildFaqAccordionData(undefined)).toEqual([]);
  });
});

// ── Hub Card Data ─────────────────────────────────────────────────────

describe('buildHubCardData', () => {
  const guides = [
    {
      slug: 'futon-frames',
      title: 'Complete Frame Guide',
      metaDescription: 'Everything about frames',
      categoryLabel: 'Futon Frames',
      heroImage: '/hero.jpg',
      publishDate: '2026-02-20',
    },
  ];

  it('builds card data from guide summaries', () => {
    const cards = buildHubCardData(guides);
    expect(cards).toHaveLength(1);
    expect(cards[0]._id).toBe('guide-futon-frames');
    expect(cards[0].slug).toBe('futon-frames');
    expect(cards[0].title).toBe('Complete Frame Guide');
    expect(cards[0].url).toBe('/buying-guides/futon-frames');
    expect(cards[0].description).toBe('Everything about frames');
    expect(cards[0].heroImage).toBe('/hero.jpg');
  });

  it('returns empty array for null/empty', () => {
    expect(buildHubCardData(null)).toEqual([]);
    expect(buildHubCardData([])).toEqual([]);
  });

  it('truncates long descriptions', () => {
    const longGuides = [{
      slug: 'x',
      title: 'X',
      metaDescription: 'word '.repeat(100),
      categoryLabel: 'X',
      heroImage: '/x.jpg',
      publishDate: '2026-01-01',
    }];
    const cards = buildHubCardData(longGuides);
    expect(cards[0].description.length).toBeLessThanOrEqual(163); // 160 + '...'
  });
});
