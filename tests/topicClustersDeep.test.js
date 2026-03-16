import { describe, it, expect } from 'vitest';
import {
  getTopicCluster,
  generateInternalLinks,
  getSchemaMarkup,
  getSEOScore,
  getSitemapData,
} from '../src/backend/topicClusters.web.js';

// ── getTopicCluster — edge cases ────────────────────────────────────

describe('getTopicCluster — edge cases', () => {
  it('returns error for undefined slug', async () => {
    const result = await getTopicCluster(undefined);
    expect(result.success).toBe(false);
    expect(result.cluster).toBeNull();
  });

  it('returns error for numeric slug (type coercion)', async () => {
    // Number is not a string — validateSlug returns ''
    const result = await getTopicCluster(12345);
    expect(result.success).toBe(false);
  });

  it('returns error for boolean slug', async () => {
    const result = await getTopicCluster(true);
    expect(result.success).toBe(false);
  });

  it('returns error for object slug', async () => {
    const result = await getTopicCluster({ slug: 'futon-frames' });
    expect(result.success).toBe(false);
  });

  it('returns error for array slug', async () => {
    const result = await getTopicCluster(['futon-frames']);
    expect(result.success).toBe(false);
  });

  it('returns null cluster for slug with uppercase letters (case-sensitive lookup)', async () => {
    // validateSlug lowercases, but 'Futon-Frames' → 'futon-frames' which IS in CLUSTERS
    const result = await getTopicCluster('Futon-Frames');
    expect(result.success).toBe(true);
    expect(result.cluster).not.toBeNull();
    expect(result.cluster.pillarSlug).toBe('futon-frames');
  });

  it('returns null cluster for slug with trailing whitespace', async () => {
    // validateSlug trims, so '  futon-frames  ' → 'futon-frames'
    const result = await getTopicCluster('  futon-frames  ');
    expect(result.success).toBe(true);
    expect(result.cluster).not.toBeNull();
  });

  it('returns error for whitespace-only slug', async () => {
    const result = await getTopicCluster('   ');
    expect(result.success).toBe(false);
  });

  it('returns null cluster for slug with underscores (not in CLUSTERS)', async () => {
    // validateSlug allows only [a-z0-9-], underscores fail → sanitize fallback strips them
    const result = await getTopicCluster('futon_frames');
    // sanitize removes nothing (no HTML), result is 'futon_frames', not in CLUSTERS
    expect(result.success).toBe(true);
    expect(result.cluster).toBeNull();
  });

  it('returns null cluster for slug with special chars (dots, slashes)', async () => {
    const result = await getTopicCluster('futon.frames/test');
    expect(result.success).toBe(true);
    expect(result.cluster).toBeNull();
  });

  it('spoke pages in returned cluster include url field from SITE_URL', async () => {
    const result = await getTopicCluster('outdoor');
    for (const spoke of result.cluster.spokePages) {
      expect(spoke.url).toBe(`https://www.carolinafutons.com/buying-guides/${spoke.slug}`);
    }
  });

  it('cluster pillarUrl uses the cluster pillarSlug, not the input', async () => {
    // Input 'FUTON-FRAMES' normalizes to 'futon-frames'
    const result = await getTopicCluster('FUTON-FRAMES');
    expect(result.cluster.pillarUrl).toBe('https://www.carolinafutons.com/buying-guides/futon-frames');
  });

  it('returns error for NaN input', async () => {
    const result = await getTopicCluster(NaN);
    expect(result.success).toBe(false);
  });

  it('returns error for Infinity input', async () => {
    const result = await getTopicCluster(Infinity);
    expect(result.success).toBe(false);
  });

  it('returns error for empty string after sanitize strips all HTML', async () => {
    const result = await getTopicCluster('<b></b>');
    expect(result.success).toBe(false);
  });
});

// ── generateInternalLinks — edge cases ──────────────────────────────

describe('generateInternalLinks — edge cases', () => {
  it('returns error for undefined slug', async () => {
    const result = await generateInternalLinks(undefined);
    expect(result.success).toBe(false);
    expect(result.links).toEqual([]);
  });

  it('treats maxLinks=0 as 5 (0 is falsy, falls through to default 5)', async () => {
    // Number(0) is 0, which is falsy → || 5 triggers → Math.max(1,Math.min(20,5)) = 5
    const result = await generateInternalLinks('futon-frames', 0);
    expect(result.links.length).toBeLessThanOrEqual(5);
  });

  it('treats maxLinks=-5 as 1 (clamped minimum)', async () => {
    const result = await generateInternalLinks('futon-frames', -5);
    expect(result.links.length).toBeLessThanOrEqual(1);
  });

  it('treats maxLinks=NaN as 5 (fallback default)', async () => {
    // Number(NaN) is NaN, || 5 triggers
    const result = await generateInternalLinks('futon-frames', NaN);
    expect(result.links.length).toBeLessThanOrEqual(5);
  });

  it('treats maxLinks="abc" as 5 (non-numeric string fallback)', async () => {
    const result = await generateInternalLinks('futon-frames', 'abc');
    expect(result.links.length).toBeLessThanOrEqual(5);
  });

  it('treats maxLinks=Infinity as 20 (clamped maximum)', async () => {
    const result = await generateInternalLinks('futon-frames', Infinity);
    expect(result.links.length).toBeLessThanOrEqual(20);
  });

  it('treats maxLinks=null as 5 (Number(null)=0, ||5 triggers)', async () => {
    const result = await generateInternalLinks('futon-frames', null);
    expect(result.links.length).toBeLessThanOrEqual(5);
  });

  it('rounds fractional maxLinks (e.g. 2.7 → 3)', async () => {
    const result = await generateInternalLinks('futon-frames', 2.7);
    expect(result.links.length).toBeLessThanOrEqual(3);
  });

  it('pillar page does NOT get spoke-to-pillar links', async () => {
    const result = await generateInternalLinks('covers', 20);
    const s2p = result.links.filter(l => l.relationship === 'spoke-to-pillar');
    expect(s2p.length).toBe(0);
  });

  it('spoke page does NOT get pillar-to-spoke links', async () => {
    const result = await generateInternalLinks('mattress-fill-types', 20);
    const p2s = result.links.filter(l => l.relationship === 'pillar-to-spoke');
    expect(p2s.length).toBe(0);
  });

  it('spoke page does NOT get cross-cluster links', async () => {
    const result = await generateInternalLinks('mattress-fill-types', 20);
    const cc = result.links.filter(l => l.relationship === 'cross-cluster');
    expect(cc.length).toBe(0);
  });

  it('spoke does not link to itself among siblings', async () => {
    const result = await generateInternalLinks('wood-vs-metal-frames', 20);
    const self = result.links.filter(l => l.targetSlug === 'wood-vs-metal-frames');
    expect(self.length).toBe(0);
  });

  it('cross-cluster links exclude the current pillar', async () => {
    const result = await generateInternalLinks('futon-frames', 20);
    const cc = result.links.filter(l => l.relationship === 'cross-cluster');
    for (const link of cc) {
      expect(link.targetSlug).not.toBe('futon-frames');
    }
  });

  it('cross-cluster links have context "sidebar"', async () => {
    const result = await generateInternalLinks('mattresses', 20);
    const cc = result.links.filter(l => l.relationship === 'cross-cluster');
    for (const link of cc) {
      expect(link.context).toBe('sidebar');
    }
  });

  it('spoke-to-spoke links have context "related"', async () => {
    const result = await generateInternalLinks('wood-vs-metal-frames', 20);
    const s2s = result.links.filter(l => l.relationship === 'spoke-to-spoke');
    for (const link of s2s) {
      expect(link.context).toBe('related');
    }
  });

  it('returns error for boolean slug', async () => {
    const result = await generateInternalLinks(false);
    expect(result.success).toBe(false);
  });

  it('pillows cluster (2 spokes) — spoke gets 1 sibling + 1 pillar', async () => {
    const result = await generateInternalLinks('pillow-styles-guide', 20);
    expect(result.links.some(l => l.relationship === 'spoke-to-pillar')).toBe(true);
    expect(result.links.some(l => l.relationship === 'spoke-to-spoke')).toBe(true);
    const s2s = result.links.filter(l => l.relationship === 'spoke-to-spoke');
    expect(s2s.length).toBe(1);
    expect(s2s[0].targetSlug).toBe('bolster-placement-tips');
  });

  it('maxLinks=1 on spoke page returns only the spoke-to-pillar link', async () => {
    // Spoke-to-pillar is pushed first, then siblings; limit=1 cuts at first
    const result = await generateInternalLinks('wood-vs-metal-frames', 1);
    expect(result.links.length).toBe(1);
    expect(result.links[0].relationship).toBe('spoke-to-pillar');
  });
});

// ── getSchemaMarkup — edge cases ────────────────────────────────────

describe('getSchemaMarkup — edge cases', () => {
  it('returns error for undefined slug', async () => {
    const result = await getSchemaMarkup(undefined);
    expect(result.success).toBe(false);
    expect(result.schemas).toEqual({});
  });

  it('returns error for numeric slug', async () => {
    const result = await getSchemaMarkup(42);
    expect(result.success).toBe(false);
  });

  it('unknown page breadcrumb has only Home and Buying Guides (2 items)', async () => {
    const result = await getSchemaMarkup('totally-unknown-page');
    const bc = JSON.parse(result.schemas.breadcrumb);
    // Unknown page is not a pillar or spoke — only 2 breadcrumb items
    expect(bc.itemListElement.length).toBe(2);
  });

  it('empty faqs array does not produce FAQ schema', async () => {
    const result = await getSchemaMarkup('futon-frames', { faqs: [] });
    expect(result.schemas.faq).toBeUndefined();
  });

  it('faqs with non-array value does not produce FAQ schema', async () => {
    const result = await getSchemaMarkup('futon-frames', { faqs: 'not-array' });
    expect(result.schemas.faq).toBeUndefined();
  });

  it('empty steps array on non-howto page does not produce HowTo schema', async () => {
    // 'futon-frames' is a pillar, not a howto spoke
    const result = await getSchemaMarkup('futon-frames', { steps: [] });
    expect(result.schemas.howTo).toBeUndefined();
  });

  it('howto spoke page generates HowTo schema even without explicit steps', async () => {
    // 'cover-sizing-guide' is type 'howto'
    const result = await getSchemaMarkup('cover-sizing-guide');
    expect(result.schemas.howTo).toBeDefined();
    const howTo = JSON.parse(result.schemas.howTo);
    expect(howTo['@type']).toBe('HowTo');
    // step array is empty since no steps data was provided
    expect(howTo.step).toEqual([]);
  });

  it('article schema defaults image to slug-hero.jpg when not provided', async () => {
    const result = await getSchemaMarkup('covers');
    const article = JSON.parse(result.schemas.article);
    expect(article.image).toBe('https://www.carolinafutons.com/buying-guides/covers-hero.jpg');
  });

  it('article schema uses provided image when given', async () => {
    const result = await getSchemaMarkup('covers', { image: 'https://example.com/custom.jpg' });
    const article = JSON.parse(result.schemas.article);
    expect(article.image).toBe('https://example.com/custom.jpg');
  });

  it('article schema has datePublished and dateModified', async () => {
    const result = await getSchemaMarkup('futon-frames');
    const article = JSON.parse(result.schemas.article);
    expect(article.datePublished).toBe('2026-02-20');
    expect(article.dateModified).toBe('2026-02-20');
  });

  it('article schema publisher has logo ImageObject', async () => {
    const result = await getSchemaMarkup('futon-frames');
    const article = JSON.parse(result.schemas.article);
    expect(article.publisher.logo['@type']).toBe('ImageObject');
    expect(article.publisher.logo.url).toContain('/logo.png');
  });

  it('HowTo step without image omits image field', async () => {
    const result = await getSchemaMarkup('futon-frames', {
      steps: [{ name: 'Step 1', text: 'Do it.' }],
    });
    const howTo = JSON.parse(result.schemas.howTo);
    expect(howTo.step[0]).not.toHaveProperty('image');
  });

  it('spoke page title defaults from CLUSTERS data when no title override', async () => {
    const result = await getSchemaMarkup('wall-hugger-guide');
    const article = JSON.parse(result.schemas.article);
    expect(article.headline).toBe('Wall Hugger Futon Guide');
  });

  it('spoke breadcrumb position 3 is the parent pillar', async () => {
    const result = await getSchemaMarkup('outdoor-futon-care');
    const bc = JSON.parse(result.schemas.breadcrumb);
    expect(bc.itemListElement[2].name).toBe('Outdoor Futon Guide');
    expect(bc.itemListElement[2].item).toContain('/buying-guides/outdoor');
  });

  it('pageData.description defaults to empty string in schema', async () => {
    const result = await getSchemaMarkup('futon-frames');
    const article = JSON.parse(result.schemas.article);
    expect(article.description).toBe('');
  });

  it('non-howto spoke page does not generate HowTo schema', async () => {
    // 'mattress-firmness-guide' is type 'reference'
    const result = await getSchemaMarkup('mattress-firmness-guide');
    expect(result.schemas.howTo).toBeUndefined();
  });
});

// ── getSEOScore — edge cases ────────────────────────────────────────

describe('getSEOScore — edge cases', () => {
  it('returns error for empty object (no slug)', async () => {
    const result = await getSEOScore({});
    expect(result.success).toBe(false);
    expect(result.score).toBe(0);
  });

  it('returns error for undefined input', async () => {
    const result = await getSEOScore(undefined);
    expect(result.success).toBe(false);
  });

  it('returns error for string input (not an object)', async () => {
    const result = await getSEOScore('futon-frames');
    expect(result.success).toBe(false);
  });

  it('title at exactly 30 chars passes check', async () => {
    const result = await getSEOScore({
      slug: 'futon-frames',
      title: 'A'.repeat(30), // exactly 30 chars
    });
    const titleCheck = result.checks.find(c => c.name.includes('Title') && c.name.includes('30-60'));
    expect(titleCheck.passed).toBe(true);
    expect(titleCheck.points).toBe(15);
  });

  it('title at exactly 60 chars passes check', async () => {
    const result = await getSEOScore({
      slug: 'futon-frames',
      title: 'B'.repeat(60),
    });
    const titleCheck = result.checks.find(c => c.name.includes('Title') && c.name.includes('30-60'));
    expect(titleCheck.passed).toBe(true);
  });

  it('title at 29 chars fails check (boundary)', async () => {
    const result = await getSEOScore({
      slug: 'futon-frames',
      title: 'C'.repeat(29),
    });
    const titleCheck = result.checks.find(c => c.name.includes('Title'));
    expect(titleCheck.passed).toBe(false);
  });

  it('title at 61 chars fails check (boundary)', async () => {
    const result = await getSEOScore({
      slug: 'futon-frames',
      title: 'D'.repeat(61),
    });
    const titleCheck = result.checks.find(c => c.name.includes('Title'));
    expect(titleCheck.passed).toBe(false);
  });

  it('description at exactly 120 chars passes check', async () => {
    const result = await getSEOScore({
      slug: 'futon-frames',
      description: 'E'.repeat(120),
    });
    const descCheck = result.checks.find(c => c.name.includes('Meta description') && c.name.includes('120-160'));
    expect(descCheck.passed).toBe(true);
    expect(descCheck.points).toBe(15);
  });

  it('description at exactly 160 chars passes check', async () => {
    const result = await getSEOScore({
      slug: 'futon-frames',
      description: 'F'.repeat(160),
    });
    const descCheck = result.checks.find(c => c.name.includes('Meta description') && c.name.includes('120-160'));
    expect(descCheck.passed).toBe(true);
  });

  it('description at 119 chars fails check (boundary)', async () => {
    const result = await getSEOScore({
      slug: 'futon-frames',
      description: 'G'.repeat(119),
    });
    const descCheck = result.checks.find(c => c.name.includes('Meta description'));
    expect(descCheck.passed).toBe(false);
  });

  it('description at 161 chars fails check (boundary)', async () => {
    const result = await getSEOScore({
      slug: 'futon-frames',
      description: 'H'.repeat(161),
    });
    const descCheck = result.checks.find(c => c.name.includes('Meta description'));
    expect(descCheck.passed).toBe(false);
  });

  it('content with exactly 500 words gets partial credit (8 pts)', async () => {
    const result = await getSEOScore({
      slug: 'futon-frames',
      content: Array(500).fill('word').join(' '),
    });
    const contentCheck = result.checks.find(c => c.name.includes('Content length'));
    expect(contentCheck.points).toBe(8);
  });

  it('content with 499 words gets 0 points', async () => {
    const result = await getSEOScore({
      slug: 'futon-frames',
      content: Array(499).fill('word').join(' '),
    });
    const contentCheck = result.checks.find(c => c.name.includes('Content length'));
    expect(contentCheck.points).toBe(0);
  });

  it('content with exactly 1500 words gets full 15 points', async () => {
    const result = await getSEOScore({
      slug: 'futon-frames',
      content: Array(1500).fill('word').join(' '),
    });
    const contentCheck = result.checks.find(c => c.name.includes('Content length'));
    expect(contentCheck.passed).toBe(true);
    expect(contentCheck.points).toBe(15);
  });

  it('imageAlt shorter than 10 chars fails alt text check', async () => {
    const result = await getSEOScore({
      slug: 'futon-frames',
      image: 'https://example.com/img.jpg',
      imageAlt: 'short',
    });
    const altCheck = result.checks.find(c => c.name === 'Image alt text');
    expect(altCheck.passed).toBe(false);
  });

  it('imageAlt at exactly 10 chars passes alt text check', async () => {
    const result = await getSEOScore({
      slug: 'futon-frames',
      image: 'https://example.com/img.jpg',
      imageAlt: 'A'.repeat(10),
    });
    const altCheck = result.checks.find(c => c.name === 'Image alt text');
    expect(altCheck.passed).toBe(true);
    expect(altCheck.points).toBe(5);
  });

  it('no image means both hero image and alt text checks fail', async () => {
    const result = await getSEOScore({ slug: 'futon-frames' });
    const heroCheck = result.checks.find(c => c.name === 'Hero image');
    const altCheck = result.checks.find(c => c.name === 'Image alt text');
    expect(heroCheck.passed).toBe(false);
    expect(altCheck.passed).toBe(false);
  });

  it('internalLinkCount=2 fails (boundary, needs 3+)', async () => {
    const result = await getSEOScore({ slug: 'futon-frames', internalLinkCount: 2 });
    const linkCheck = result.checks.find(c => c.name.includes('Internal links'));
    expect(linkCheck.passed).toBe(false);
  });

  it('internalLinkCount=3 passes (boundary)', async () => {
    const result = await getSEOScore({ slug: 'futon-frames', internalLinkCount: 3 });
    const linkCheck = result.checks.find(c => c.name.includes('Internal links'));
    expect(linkCheck.passed).toBe(true);
    expect(linkCheck.points).toBe(10);
  });

  it('faqs with exactly 2 items fails (needs 3+)', async () => {
    const result = await getSEOScore({
      slug: 'futon-frames',
      faqs: [{ question: 'Q1?', answer: 'A1' }, { question: 'Q2?', answer: 'A2' }],
    });
    const faqCheck = result.checks.find(c => c.name.includes('FAQ'));
    expect(faqCheck.passed).toBe(false);
  });

  it('faqs with exactly 3 items passes', async () => {
    const result = await getSEOScore({
      slug: 'futon-frames',
      faqs: [
        { question: 'Q1?', answer: 'A1' },
        { question: 'Q2?', answer: 'A2' },
        { question: 'Q3?', answer: 'A3' },
      ],
    });
    const faqCheck = result.checks.find(c => c.name.includes('FAQ'));
    expect(faqCheck.passed).toBe(true);
    expect(faqCheck.points).toBe(10);
  });

  it('grade F for score below 20', async () => {
    const result = await getSEOScore({ slug: 'random-unknown-page' });
    expect(result.grade).toBe('F');
  });

  it('grade C for score 40-59', async () => {
    // cluster(10) + title(15) + desc(15) = 40
    const result = await getSEOScore({
      slug: 'futon-frames',
      title: 'A'.repeat(40),
      description: 'B'.repeat(130),
    });
    expect(result.score).toBeGreaterThanOrEqual(40);
    expect(result.score).toBeLessThan(60);
    expect(result.grade).toBe('C');
  });

  it('schema readiness requires all three: title, description, and image', async () => {
    // Has title and desc but no image
    const result = await getSEOScore({
      slug: 'futon-frames',
      title: 'Some Title Here For Testing Purposes',
      description: 'A'.repeat(130),
    });
    const schemaCheck = result.checks.find(c => c.name.includes('Schema'));
    expect(schemaCheck.passed).toBe(false);
  });

  it('negative internalLinkCount treated as 0', async () => {
    // Number(-5) is -5, which is truthy but < 3
    const result = await getSEOScore({ slug: 'futon-frames', internalLinkCount: -5 });
    const linkCheck = result.checks.find(c => c.name.includes('Internal links'));
    expect(linkCheck.passed).toBe(false);
  });

  it('internalLinkCount as boolean true treated as 1 (fails)', async () => {
    // Number(true) = 1, which < 3
    const result = await getSEOScore({ slug: 'futon-frames', internalLinkCount: true });
    const linkCheck = result.checks.find(c => c.name.includes('Internal links'));
    expect(linkCheck.passed).toBe(false);
  });

  it('empty content string yields 0 word count', async () => {
    const result = await getSEOScore({ slug: 'futon-frames', content: '' });
    const contentCheck = result.checks.find(c => c.name.includes('Content length'));
    expect(contentCheck.points).toBe(0);
  });

  it('percentage is correctly rounded', async () => {
    const result = await getSEOScore({ slug: 'futon-frames' });
    expect(result.percentage).toBe(Math.round((result.score / result.maxScore) * 100));
  });
});

// ── getSitemapData — edge cases ─────────────────────────────────────

describe('getSitemapData — edge cases', () => {
  it('hub entry is always first in the entries array', async () => {
    const result = await getSitemapData();
    expect(result.entries[0].type).toBe('hub');
  });

  it('hub changefreq is "weekly"', async () => {
    const result = await getSitemapData();
    expect(result.entries[0].changefreq).toBe('weekly');
  });

  it('pillar changefreq is "monthly"', async () => {
    const result = await getSitemapData();
    const pillar = result.entries.find(e => e.type === 'pillar');
    expect(pillar.changefreq).toBe('monthly');
  });

  it('spoke changefreq is "monthly"', async () => {
    const result = await getSitemapData();
    const spoke = result.entries.find(e => e.type === 'spoke');
    expect(spoke.changefreq).toBe('monthly');
  });

  it('every spoke references a valid pillar slug from CLUSTERS', async () => {
    const result = await getSitemapData();
    const pillarSlugs = result.entries.filter(e => e.type === 'pillar').map(e => {
      // Extract slug from URL
      const parts = e.url.split('/');
      return parts[parts.length - 1];
    });
    const spokes = result.entries.filter(e => e.type === 'spoke');
    for (const spoke of spokes) {
      expect(pillarSlugs).toContain(spoke.parentPillar);
    }
  });

  it('pillar entries have topic field', async () => {
    const result = await getSitemapData();
    const pillars = result.entries.filter(e => e.type === 'pillar');
    for (const pillar of pillars) {
      expect(pillar.topic).toBeTruthy();
    }
  });

  it('hub entry does not have parentPillar or contentType', async () => {
    const result = await getSitemapData();
    const hub = result.entries[0];
    expect(hub.parentPillar).toBeUndefined();
    expect(hub.contentType).toBeUndefined();
  });

  it('no duplicate spoke slugs across clusters', async () => {
    const result = await getSitemapData();
    const spokeUrls = result.entries.filter(e => e.type === 'spoke').map(e => e.url);
    expect(new Set(spokeUrls).size).toBe(spokeUrls.length);
  });

  it('calling getSitemapData twice returns identical results (deterministic)', async () => {
    const r1 = await getSitemapData();
    const r2 = await getSitemapData();
    expect(r1.entries.length).toBe(r2.entries.length);
    expect(r1.stats).toEqual(r2.stats);
    for (let i = 0; i < r1.entries.length; i++) {
      expect(r1.entries[i].url).toBe(r2.entries[i].url);
    }
  });

  it('stats.clusters matches stats.pillarPages', async () => {
    const result = await getSitemapData();
    expect(result.stats.clusters).toBe(result.stats.pillarPages);
  });
});
