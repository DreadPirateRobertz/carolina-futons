/**
 * @file blogSeoService.test.js
 * @description Tests for blog SEO validation + schema generation (cf-dmop).
 */

import { describe, it, expect } from 'vitest';
import {
  validatePostSeo,
  getBlogArticleSchema,
  _TITLE_MIN, _TITLE_MAX,
  _META_DESC_MIN, _META_DESC_MAX,
  _MIN_WORD_COUNT,
} from '../src/backend/blogSeoService.web.js';

const GOOD_POST = {
  title: 'How to Choose the Perfect Futon Frame for Your Space',
  slug: 'choosing-futon-frame',
  metaDescription: 'A complete guide to choosing the right futon frame for your room. Compare wood vs metal, bi-fold vs tri-fold, and find the perfect fit for your budget and space.',
  excerpt: 'Everything you need to know about picking a futon frame.',
  category: 'buying-guides',
  tags: ['futon frames', 'buying guide', 'furniture'],
  heroImage: 'https://example.com/hero.jpg',
  heroImageAlt: 'Selection of hardwood futon frames in a showroom',
  focusKeyword: 'futon frame',
  author: 'Carolina Futons',
  publishDate: '2026-03-15',
  body: 'Choosing the right futon frame is the most important decision you\'ll make. ' + 'A quality futon frame determines comfort, durability, and style. '.repeat(20),
};

// ── SEO Validation ──────────────────────────────────────────────────

describe('validatePostSeo', () => {
  it('passes all checks for a well-optimized post', () => {
    const result = validatePostSeo(GOOD_POST);
    expect(result.success).toBe(true);
    expect(result.percentage).toBeGreaterThanOrEqual(80);
  });

  it('checks required fields', () => {
    const result = validatePostSeo({ title: 'Test' });
    const slugCheck = result.checks.find(c => c.field === 'slug');
    expect(slugCheck.pass).toBe(false);
    const metaCheck = result.checks.find(c => c.field === 'metaDescription');
    expect(metaCheck.pass).toBe(false);
  });

  it('flags title too short', () => {
    const result = validatePostSeo({ ...GOOD_POST, title: 'Short' });
    const check = result.checks.find(c => c.field === 'titleLength');
    expect(check.pass).toBe(false);
    expect(check.message).toContain('too short');
  });

  it('flags title too long', () => {
    const result = validatePostSeo({ ...GOOD_POST, title: 'A'.repeat(80) });
    const check = result.checks.find(c => c.field === 'titleLength');
    expect(check.pass).toBe(false);
    expect(check.message).toContain('too long');
  });

  it('flags meta description too short', () => {
    const result = validatePostSeo({ ...GOOD_POST, metaDescription: 'Too short.' });
    const check = result.checks.find(c => c.field === 'metaDescriptionLength');
    expect(check.pass).toBe(false);
  });

  it('flags missing hero image alt text', () => {
    const result = validatePostSeo({ ...GOOD_POST, heroImageAlt: '' });
    const check = result.checks.find(c => c.field === 'heroImageAlt');
    expect(check.pass).toBe(false);
  });

  it('checks focus keyword in title', () => {
    const result = validatePostSeo(GOOD_POST);
    const check = result.checks.find(c => c.field === 'keywordInTitle');
    expect(check.pass).toBe(true);
  });

  it('flags missing focus keyword in title', () => {
    const result = validatePostSeo({ ...GOOD_POST, title: 'Guide to Buying Furniture' });
    const check = result.checks.find(c => c.field === 'keywordInTitle');
    expect(check.pass).toBe(false);
  });

  it('checks focus keyword in meta description', () => {
    const result = validatePostSeo(GOOD_POST);
    const check = result.checks.find(c => c.field === 'keywordInMeta');
    expect(check.pass).toBe(true);
  });

  it('checks word count minimum', () => {
    const short = { ...GOOD_POST, body: 'Only a few words here.' };
    const result = validatePostSeo(short);
    const check = result.checks.find(c => c.field === 'wordCount');
    expect(check.pass).toBe(false);
    expect(check.message).toContain('too short');
  });

  it('validates slug format', () => {
    const result = validatePostSeo(GOOD_POST);
    const check = result.checks.find(c => c.field === 'slugFormat');
    expect(check.pass).toBe(true);
  });

  it('flags bad slug format', () => {
    const result = validatePostSeo({ ...GOOD_POST, slug: 'Bad Slug With Spaces!' });
    const check = result.checks.find(c => c.field === 'slugFormat');
    expect(check.pass).toBe(false);
  });

  it('calculates read time', () => {
    const result = validatePostSeo(GOOD_POST);
    const check = result.checks.find(c => c.field === 'readTime');
    expect(check.value).toBeGreaterThan(0);
  });

  it('returns score and percentage', () => {
    const result = validatePostSeo(GOOD_POST);
    expect(result.score).toBeGreaterThan(0);
    expect(result.maxScore).toBeGreaterThan(0);
    expect(result.percentage).toBeGreaterThanOrEqual(0);
    expect(result.percentage).toBeLessThanOrEqual(100);
  });

  it('returns failure for null post', () => {
    expect(validatePostSeo(null).success).toBe(false);
  });
});

// ── Article Schema ──────────────────────────────────────────────────

describe('getBlogArticleSchema', () => {
  it('generates valid Article JSON-LD', () => {
    const result = getBlogArticleSchema(GOOD_POST);
    expect(result.success).toBe(true);

    const schema = JSON.parse(result.schema);
    expect(schema['@type']).toBe('Article');
    expect(schema.headline).toBe(GOOD_POST.title);
    expect(schema.mainEntityOfPage['@id']).toContain('/blog/choosing-futon-frame');
  });

  it('includes word count and read time', () => {
    const result = getBlogArticleSchema(GOOD_POST);
    const schema = JSON.parse(result.schema);
    expect(schema.wordCount).toBeGreaterThan(0);
    expect(schema.timeRequired).toMatch(/^PT\d+M$/);
  });

  it('includes keywords from tags', () => {
    const result = getBlogArticleSchema(GOOD_POST);
    const schema = JSON.parse(result.schema);
    expect(schema.keywords).toContain('futon frames');
  });

  it('includes article section from category', () => {
    const result = getBlogArticleSchema(GOOD_POST);
    const schema = JSON.parse(result.schema);
    expect(schema.articleSection).toBe('buying-guides');
  });

  it('returns failure for missing title/slug', () => {
    expect(getBlogArticleSchema({}).success).toBe(false);
    expect(getBlogArticleSchema(null).success).toBe(false);
  });
});

// ── Constants ───────────────────────────────────────────────────────

describe('SEO thresholds', () => {
  it('title range is 30-70', () => {
    expect(_TITLE_MIN).toBe(30);
    expect(_TITLE_MAX).toBe(70);
  });

  it('meta description range is 120-160', () => {
    expect(_META_DESC_MIN).toBe(120);
    expect(_META_DESC_MAX).toBe(160);
  });

  it('minimum word count is 300', () => {
    expect(_MIN_WORD_COUNT).toBe(300);
  });
});
