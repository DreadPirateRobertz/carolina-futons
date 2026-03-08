import { describe, it, expect } from 'vitest';
import {
  getTopicCluster,
  generateInternalLinks,
  getSchemaMarkup,
  getSEOScore,
  getSitemapData,
} from '../../src/backend/topicClusters.web.js';

// ── getTopicCluster ──────────────────────────────────────────────────

describe('getTopicCluster', () => {
  it('returns cluster for futon-frames pillar', async () => {
    const result = await getTopicCluster('futon-frames');
    expect(result.success).toBe(true);
    expect(result.cluster).not.toBeNull();
    expect(result.cluster.pillarSlug).toBe('futon-frames');
    expect(result.cluster.pillarTitle).toBe('The Complete Futon Frame Buying Guide');
    expect(result.cluster.topic).toBe('futon frames');
    expect(result.cluster.keywords.length).toBeGreaterThan(0);
    expect(result.cluster.spokePages.length).toBe(4);
    expect(result.cluster.spokeCount).toBe(4);
  });

  it('returns cluster for mattresses pillar', async () => {
    const result = await getTopicCluster('mattresses');
    expect(result.success).toBe(true);
    expect(result.cluster.pillarSlug).toBe('mattresses');
    expect(result.cluster.spokePages.length).toBe(4);
  });

  it('returns cluster for covers pillar', async () => {
    const result = await getTopicCluster('covers');
    expect(result.success).toBe(true);
    expect(result.cluster.spokePages.length).toBe(3);
  });

  it('includes URLs in cluster data', async () => {
    const result = await getTopicCluster('futon-frames');
    expect(result.cluster.pillarUrl).toContain('/buying-guides/futon-frames');
    expect(result.cluster.spokePages[0].url).toContain('/buying-guides/');
  });

  it('returns null cluster for unknown slug', async () => {
    const result = await getTopicCluster('nonexistent');
    expect(result.success).toBe(true);
    expect(result.cluster).toBeNull();
  });

  it('rejects empty slug', async () => {
    const result = await getTopicCluster('');
    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });

  it('rejects null slug', async () => {
    const result = await getTopicCluster(null);
    expect(result.success).toBe(false);
  });

  it('returns all 8 clusters when queried individually', async () => {
    const slugs = ['futon-frames', 'mattresses', 'covers', 'pillows', 'storage', 'outdoor', 'accessories', 'bundle-deals'];
    for (const slug of slugs) {
      const result = await getTopicCluster(slug);
      expect(result.success).toBe(true);
      expect(result.cluster).not.toBeNull();
    }
  });
});

// ── generateInternalLinks ────────────────────────────────────────────

describe('generateInternalLinks', () => {
  it('returns pillar-to-spoke links for pillar page', async () => {
    const result = await generateInternalLinks('futon-frames');
    expect(result.success).toBe(true);
    expect(result.links.length).toBeGreaterThan(0);
    const pillarToSpoke = result.links.filter(l => l.relationship === 'pillar-to-spoke');
    expect(pillarToSpoke.length).toBeGreaterThan(0);
  });

  it('returns spoke-to-pillar link for spoke page', async () => {
    const result = await generateInternalLinks('wood-vs-metal-frames');
    expect(result.success).toBe(true);
    const spokeToPillar = result.links.filter(l => l.relationship === 'spoke-to-pillar');
    expect(spokeToPillar.length).toBe(1);
    expect(spokeToPillar[0].targetSlug).toBe('futon-frames');
  });

  it('returns spoke-to-spoke links for sibling pages', async () => {
    const result = await generateInternalLinks('wood-vs-metal-frames');
    const spokeToSpoke = result.links.filter(l => l.relationship === 'spoke-to-spoke');
    expect(spokeToSpoke.length).toBeGreaterThan(0);
  });

  it('returns cross-cluster links for pillar pages', async () => {
    const result = await generateInternalLinks('futon-frames', 20);
    const crossCluster = result.links.filter(l => l.relationship === 'cross-cluster');
    expect(crossCluster.length).toBeGreaterThan(0);
  });

  it('respects maxLinks parameter', async () => {
    const result = await generateInternalLinks('futon-frames', 2);
    expect(result.links.length).toBeLessThanOrEqual(2);
  });

  it('defaults maxLinks to 5', async () => {
    const result = await generateInternalLinks('futon-frames');
    expect(result.links.length).toBeLessThanOrEqual(5);
  });

  it('clamps maxLinks to 1-20 range', async () => {
    const result = await generateInternalLinks('futon-frames', 100);
    expect(result.links.length).toBeLessThanOrEqual(20);
  });

  it('returns empty links for unknown page', async () => {
    const result = await generateInternalLinks('nonexistent-page');
    expect(result.success).toBe(true);
    expect(result.links).toEqual([]);
  });

  it('rejects empty slug', async () => {
    const result = await generateInternalLinks('');
    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });

  it('links include required fields', async () => {
    const result = await generateInternalLinks('futon-frames');
    const link = result.links[0];
    expect(link).toHaveProperty('targetSlug');
    expect(link).toHaveProperty('targetUrl');
    expect(link).toHaveProperty('anchorText');
    expect(link).toHaveProperty('context');
    expect(link).toHaveProperty('relationship');
  });
});

// ── getSchemaMarkup ──────────────────────────────────────────────────

describe('getSchemaMarkup', () => {
  it('returns Article schema for pillar page', async () => {
    const result = await getSchemaMarkup('futon-frames');
    expect(result.success).toBe(true);
    expect(result.schemas.article).toBeDefined();
    const article = JSON.parse(result.schemas.article);
    expect(article['@type']).toBe('Article');
    expect(article.headline).toBe('The Complete Futon Frame Buying Guide');
    expect(article.publisher.name).toBe('Carolina Futons');
  });

  it('returns BreadcrumbList for pillar page', async () => {
    const result = await getSchemaMarkup('futon-frames');
    expect(result.schemas.breadcrumb).toBeDefined();
    const bc = JSON.parse(result.schemas.breadcrumb);
    expect(bc['@type']).toBe('BreadcrumbList');
    expect(bc.itemListElement.length).toBe(3);
    expect(bc.itemListElement[0].name).toBe('Home');
    expect(bc.itemListElement[1].name).toBe('Buying Guides');
  });

  it('returns 4-level breadcrumb for spoke page', async () => {
    const result = await getSchemaMarkup('wood-vs-metal-frames');
    const bc = JSON.parse(result.schemas.breadcrumb);
    expect(bc.itemListElement.length).toBe(4);
    expect(bc.itemListElement[2].name).toBe('The Complete Futon Frame Buying Guide');
    expect(bc.itemListElement[3].name).toBe('Wood vs Metal Futon Frames');
  });

  it('returns FAQ schema when FAQs provided', async () => {
    const result = await getSchemaMarkup('futon-frames', {
      faqs: [
        { question: 'What is the best futon frame?', answer: 'It depends on your needs.' },
        { question: 'How long do futon frames last?', answer: 'With proper care, 10-15 years.' },
      ],
    });
    expect(result.schemas.faq).toBeDefined();
    const faq = JSON.parse(result.schemas.faq);
    expect(faq['@type']).toBe('FAQPage');
    expect(faq.mainEntity.length).toBe(2);
  });

  it('limits FAQs to 20 items', async () => {
    const faqs = Array.from({ length: 25 }, (_, i) => ({
      question: `Question ${i}?`, answer: `Answer ${i}.`,
    }));
    const result = await getSchemaMarkup('futon-frames', { faqs });
    const faq = JSON.parse(result.schemas.faq);
    expect(faq.mainEntity.length).toBe(20);
  });

  it('returns HowTo schema for howto spoke page', async () => {
    const result = await getSchemaMarkup('futon-frame-assembly');
    expect(result.schemas.howTo).toBeDefined();
    const howTo = JSON.parse(result.schemas.howTo);
    expect(howTo['@type']).toBe('HowTo');
    expect(howTo.name).toBe('How to Assemble a Futon Frame');
  });

  it('returns HowTo schema when steps provided', async () => {
    const result = await getSchemaMarkup('futon-frames', {
      steps: [
        { name: 'Unbox frame', text: 'Remove all parts from packaging.' },
        { name: 'Assemble base', text: 'Connect the base rails.' },
      ],
    });
    expect(result.schemas.howTo).toBeDefined();
    const howTo = JSON.parse(result.schemas.howTo);
    expect(howTo.step.length).toBe(2);
    expect(howTo.step[0].position).toBe(1);
  });

  it('does not return FAQ schema without FAQs', async () => {
    const result = await getSchemaMarkup('futon-frames');
    expect(result.schemas.faq).toBeUndefined();
  });

  it('does not return HowTo schema for non-howto page without steps', async () => {
    const result = await getSchemaMarkup('futon-frames');
    expect(result.schemas.howTo).toBeUndefined();
  });

  it('accepts title override in pageData', async () => {
    const result = await getSchemaMarkup('futon-frames', { title: 'Custom Title' });
    const article = JSON.parse(result.schemas.article);
    expect(article.headline).toBe('Custom Title');
  });

  it('rejects empty slug', async () => {
    const result = await getSchemaMarkup('');
    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });

  it('handles unknown slug with minimal schemas', async () => {
    const result = await getSchemaMarkup('unknown-page', { title: 'Test Page' });
    expect(result.success).toBe(true);
    expect(result.schemas.article).toBeDefined();
    expect(result.schemas.breadcrumb).toBeDefined();
  });
});

// ── getSEOScore ──────────────────────────────────────────────────────

describe('getSEOScore', () => {
  const fullPageData = {
    slug: 'futon-frames',
    title: 'The Complete Futon Frame Buying Guide 2026',
    description: 'Discover the best futon frames for your home. Our comprehensive guide covers wood, metal, and wall hugger frames with expert recommendations and buying tips for every budget.',
    content: Array(300).fill('Lorem ipsum dolor sit amet consectetur').join(' '),
    image: 'https://example.com/hero.jpg',
    imageAlt: 'A beautiful futon frame in a living room setting',
    faqs: [
      { question: 'Q1?', answer: 'A1' },
      { question: 'Q2?', answer: 'A2' },
      { question: 'Q3?', answer: 'A3' },
    ],
    internalLinkCount: 5,
  };

  it('returns high score for fully optimized page', async () => {
    const result = await getSEOScore(fullPageData);
    expect(result.success).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.maxScore).toBe(100);
    expect(result.grade).toBe('A');
  });

  it('returns low score for minimal page', async () => {
    const result = await getSEOScore({ slug: 'futon-frames' });
    expect(result.success).toBe(true);
    expect(result.score).toBeLessThan(30);
  });

  it('checks title length 30-60 chars', async () => {
    const result = await getSEOScore({ ...fullPageData, title: 'Short' });
    const titleCheck = result.checks.find(c => c.name.includes('Title'));
    expect(titleCheck.passed).toBe(false);
  });

  it('awards points for proper title length', async () => {
    const result = await getSEOScore(fullPageData);
    const titleCheck = result.checks.find(c => c.name.includes('Title') && c.passed);
    expect(titleCheck).toBeDefined();
    expect(titleCheck.points).toBe(15);
  });

  it('checks meta description length 120-160', async () => {
    const result = await getSEOScore({ ...fullPageData, description: 'Too short' });
    const descCheck = result.checks.find(c => c.name.includes('Meta description'));
    expect(descCheck.passed).toBe(false);
  });

  it('checks content word count', async () => {
    const result = await getSEOScore({ ...fullPageData, content: 'Very short content' });
    const contentCheck = result.checks.find(c => c.name.includes('Content length'));
    expect(contentCheck.passed).toBe(false);
    expect(contentCheck.points).toBe(0);
  });

  it('gives partial credit for 500+ words', async () => {
    const result = await getSEOScore({
      ...fullPageData,
      content: Array(110).fill('Lorem ipsum dolor sit amet').join(' '),
    });
    const contentCheck = result.checks.find(c => c.name.includes('Content length'));
    expect(contentCheck.points).toBe(8);
  });

  it('checks hero image presence', async () => {
    const result = await getSEOScore({ ...fullPageData, image: undefined });
    const imgCheck = result.checks.find(c => c.name === 'Hero image');
    expect(imgCheck.passed).toBe(false);
  });

  it('checks image alt text', async () => {
    const result = await getSEOScore({ ...fullPageData, imageAlt: '' });
    const altCheck = result.checks.find(c => c.name === 'Image alt text');
    expect(altCheck.passed).toBe(false);
  });

  it('checks topic cluster membership', async () => {
    const result = await getSEOScore({ slug: 'futon-frames', title: fullPageData.title });
    const clusterCheck = result.checks.find(c => c.name === 'Topic cluster membership');
    expect(clusterCheck.passed).toBe(true);
  });

  it('detects spoke page cluster membership', async () => {
    const result = await getSEOScore({ slug: 'wood-vs-metal-frames', title: fullPageData.title });
    const clusterCheck = result.checks.find(c => c.name === 'Topic cluster membership');
    expect(clusterCheck.passed).toBe(true);
  });

  it('fails cluster membership for unknown page', async () => {
    const result = await getSEOScore({ slug: 'random-page', title: fullPageData.title });
    const clusterCheck = result.checks.find(c => c.name === 'Topic cluster membership');
    expect(clusterCheck.passed).toBe(false);
  });

  it('checks internal link count', async () => {
    const result = await getSEOScore({ ...fullPageData, internalLinkCount: 1 });
    const linkCheck = result.checks.find(c => c.name.includes('Internal links'));
    expect(linkCheck.passed).toBe(false);
  });

  it('checks FAQ section presence', async () => {
    const result = await getSEOScore({ ...fullPageData, faqs: [] });
    const faqCheck = result.checks.find(c => c.name.includes('FAQ'));
    expect(faqCheck.passed).toBe(false);
  });

  it('checks schema readiness', async () => {
    const result = await getSEOScore(fullPageData);
    const schemaCheck = result.checks.find(c => c.name.includes('Schema'));
    expect(schemaCheck.passed).toBe(true);
  });

  it('returns percentage and letter grade', async () => {
    const result = await getSEOScore(fullPageData);
    expect(result.percentage).toBeDefined();
    expect(result.grade).toMatch(/^[A-F]$/);
  });

  it('rejects null page data', async () => {
    const result = await getSEOScore(null);
    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });

  it('rejects page data without slug', async () => {
    const result = await getSEOScore({ title: 'No slug' });
    expect(result.success).toBe(false);
  });

  it('assigns correct letter grades', async () => {
    // Grade D for very low score
    const low = await getSEOScore({ slug: 'futon-frames', internalLinkCount: 3 });
    expect(['D', 'F']).toContain(low.grade);
  });
});

// ── getSitemapData ───────────────────────────────────────────────────

describe('getSitemapData', () => {
  it('returns entries for all pages', async () => {
    const result = await getSitemapData();
    expect(result.success).toBe(true);
    expect(result.entries.length).toBeGreaterThan(0);
  });

  it('includes hub entry', async () => {
    const result = await getSitemapData();
    const hub = result.entries.find(e => e.type === 'hub');
    expect(hub).toBeDefined();
    expect(hub.priority).toBe(0.9);
    expect(hub.url).toContain('/buying-guides');
  });

  it('includes pillar entries for all 8 clusters', async () => {
    const result = await getSitemapData();
    const pillars = result.entries.filter(e => e.type === 'pillar');
    expect(pillars.length).toBe(8);
  });

  it('includes spoke entries', async () => {
    const result = await getSitemapData();
    const spokes = result.entries.filter(e => e.type === 'spoke');
    expect(spokes.length).toBeGreaterThan(0);
  });

  it('sets correct priorities', async () => {
    const result = await getSitemapData();
    const hub = result.entries.find(e => e.type === 'hub');
    const pillar = result.entries.find(e => e.type === 'pillar');
    const spoke = result.entries.find(e => e.type === 'spoke');
    expect(hub.priority).toBe(0.9);
    expect(pillar.priority).toBe(0.8);
    expect(spoke.priority).toBe(0.7);
  });

  it('returns stats with counts', async () => {
    const result = await getSitemapData();
    expect(result.stats.hubPages).toBe(1);
    expect(result.stats.pillarPages).toBe(8);
    expect(result.stats.spokePages).toBeGreaterThan(0);
    expect(result.stats.clusters).toBe(8);
    expect(result.stats.totalPages).toBe(result.entries.length);
  });

  it('spoke entries reference parent pillar', async () => {
    const result = await getSitemapData();
    const spoke = result.entries.find(e => e.type === 'spoke');
    expect(spoke.parentPillar).toBeDefined();
    expect(spoke.contentType).toBeDefined();
  });

  it('all entries have required fields', async () => {
    const result = await getSitemapData();
    for (const entry of result.entries) {
      expect(entry.url).toBeDefined();
      expect(entry.title).toBeDefined();
      expect(entry.type).toBeDefined();
      expect(entry.lastmod).toBeDefined();
      expect(entry.changefreq).toBeDefined();
      expect(entry.priority).toBeDefined();
    }
  });
});
