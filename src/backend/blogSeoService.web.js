/**
 * @module blogSeoService
 * @description Blog post SEO validation and schema generation.
 *
 * Validates blog posts against an SEO checklist (required fields, keyword
 * presence, image alt text, meta description length) and generates
 * Article JSON-LD schema.
 *
 * CMS Schema (BlogPosts collection fields):
 *   title (Text, required) - Post title (50-60 chars ideal)
 *   slug (Text, required, unique) - URL-safe identifier
 *   metaDescription (Text, required) - 120-160 chars
 *   excerpt (Text, required) - 1-2 sentence preview
 *   category (Text, required) - Primary topic category
 *   tags (Tags) - Related topic tags
 *   author (Text) - Author name
 *   publishDate (DateTime) - Publication date
 *   updatedDate (DateTime) - Last update
 *   body (RichContent) - Post content
 *   heroImage (Image) - Featured image URL
 *   heroImageAlt (Text) - Featured image alt text
 *   readTimeMinutes (Number) - Estimated read time
 *   focusKeyword (Text) - Primary SEO keyword
 *   status (Text) - 'draft' | 'review' | 'published'
 *
 * CF-dmop
 */
import { Permissions, webMethod } from 'wix-web-module';
import { sanitize } from 'backend/utils/sanitize';

const SITE_URL = 'https://www.carolinafutons.com';
const PUBLISHER = { name: 'Carolina Futons', logo: 'https://www.carolinafutons.com/logo.png' };

// SEO thresholds
const TITLE_MIN = 30;
const TITLE_MAX = 70;
const META_DESC_MIN = 120;
const META_DESC_MAX = 160;
const MIN_WORD_COUNT = 300;
const WORDS_PER_MINUTE = 200;

// ── SEO Validation ──────────────────────────────────────────────────

/**
 * Validate a blog post against the SEO checklist.
 * Returns pass/fail per check with actionable messages.
 *
 * @param {Object} post - Blog post data
 * @returns {{success: boolean, score: number, maxScore: number, checks: Array}}
 * @permission Anyone
 */
export const validatePostSeo = webMethod(
  Permissions.Anyone,
  (post) => {
    if (!post) return { success: false, score: 0, maxScore: 0, checks: [] };

    const checks = [];

    // Required fields
    checks.push(checkRequired('title', post.title, 'Post title is required'));
    checks.push(checkRequired('slug', post.slug, 'URL slug is required'));
    checks.push(checkRequired('metaDescription', post.metaDescription, 'Meta description is required'));
    checks.push(checkRequired('excerpt', post.excerpt, 'Excerpt is required for social sharing'));
    checks.push(checkRequired('category', post.category, 'Category is required for navigation'));
    checks.push(checkRequired('heroImage', post.heroImage, 'Featured image is required'));

    // Title length
    const titleLen = (post.title || '').length;
    checks.push({
      field: 'titleLength',
      pass: titleLen >= TITLE_MIN && titleLen <= TITLE_MAX,
      value: titleLen,
      message: titleLen < TITLE_MIN
        ? `Title too short (${titleLen} chars). Aim for ${TITLE_MIN}-${TITLE_MAX}.`
        : titleLen > TITLE_MAX
          ? `Title too long (${titleLen} chars). Google truncates at ~${TITLE_MAX}.`
          : `Title length OK (${titleLen} chars).`,
    });

    // Meta description length
    const metaLen = (post.metaDescription || '').length;
    checks.push({
      field: 'metaDescriptionLength',
      pass: metaLen >= META_DESC_MIN && metaLen <= META_DESC_MAX,
      value: metaLen,
      message: metaLen < META_DESC_MIN
        ? `Meta description too short (${metaLen} chars). Aim for ${META_DESC_MIN}-${META_DESC_MAX}.`
        : metaLen > META_DESC_MAX
          ? `Meta description too long (${metaLen} chars). May be truncated in search results.`
          : `Meta description length OK (${metaLen} chars).`,
    });

    // Hero image alt text
    checks.push({
      field: 'heroImageAlt',
      pass: !!(post.heroImageAlt && post.heroImageAlt.length > 5),
      value: post.heroImageAlt || '',
      message: post.heroImageAlt ? 'Hero image has alt text.' : 'Hero image needs alt text for accessibility and SEO.',
    });

    // Focus keyword in title
    if (post.focusKeyword) {
      const kw = post.focusKeyword.toLowerCase();
      const titleHasKw = (post.title || '').toLowerCase().includes(kw);
      checks.push({
        field: 'keywordInTitle',
        pass: titleHasKw,
        value: post.focusKeyword,
        message: titleHasKw
          ? `Focus keyword "${post.focusKeyword}" found in title.`
          : `Focus keyword "${post.focusKeyword}" not found in title.`,
      });

      // Keyword in meta description
      const metaHasKw = (post.metaDescription || '').toLowerCase().includes(kw);
      checks.push({
        field: 'keywordInMeta',
        pass: metaHasKw,
        value: post.focusKeyword,
        message: metaHasKw
          ? 'Focus keyword found in meta description.'
          : 'Add focus keyword to meta description.',
      });

      // Keyword in first paragraph (body)
      if (post.body) {
        const firstPara = (typeof post.body === 'string' ? post.body : '').substring(0, 500).toLowerCase();
        const bodyHasKw = firstPara.includes(kw);
        checks.push({
          field: 'keywordInBody',
          pass: bodyHasKw,
          value: post.focusKeyword,
          message: bodyHasKw
            ? 'Focus keyword found in first paragraph.'
            : 'Add focus keyword to the opening paragraph.',
        });
      }
    }

    // Word count
    const wordCount = countWords(post.body);
    checks.push({
      field: 'wordCount',
      pass: wordCount >= MIN_WORD_COUNT,
      value: wordCount,
      message: wordCount < MIN_WORD_COUNT
        ? `Content too short (${wordCount} words). Aim for ${MIN_WORD_COUNT}+ words.`
        : `Content length OK (${wordCount} words).`,
    });

    // Read time
    const readTime = Math.ceil(wordCount / WORDS_PER_MINUTE);
    checks.push({
      field: 'readTime',
      pass: true,
      value: readTime,
      message: `Estimated read time: ${readTime} min.`,
    });

    // Slug format
    const slugOk = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(post.slug || '');
    checks.push({
      field: 'slugFormat',
      pass: slugOk,
      value: post.slug || '',
      message: slugOk ? 'Slug format is clean.' : 'Slug should be lowercase with hyphens only.',
    });

    const passed = checks.filter(c => c.pass).length;

    return {
      success: true,
      score: passed,
      maxScore: checks.length,
      percentage: Math.round((passed / checks.length) * 100),
      checks,
    };
  }
);

// ── Article Schema ──────────────────────────────────────────────────

/**
 * Generate Article JSON-LD schema for a blog post.
 *
 * @param {Object} post
 * @returns {{success: boolean, schema: string|null}}
 * @permission Anyone
 */
export const getBlogArticleSchema = webMethod(
  Permissions.Anyone,
  (post) => {
    if (!post || !post.title || !post.slug) {
      return { success: false, schema: null };
    }

    const wordCount = countWords(post.body);
    const readTime = Math.ceil(wordCount / WORDS_PER_MINUTE);

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: sanitize(post.title, 200),
      description: sanitize(post.metaDescription || post.excerpt || '', 300),
      image: post.heroImage || undefined,
      author: {
        '@type': 'Organization',
        name: post.author || PUBLISHER.name,
      },
      publisher: {
        '@type': 'Organization',
        name: PUBLISHER.name,
        logo: { '@type': 'ImageObject', url: PUBLISHER.logo },
      },
      datePublished: post.publishDate || new Date().toISOString(),
      dateModified: post.updatedDate || post.publishDate || new Date().toISOString(),
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': `${SITE_URL}/blog/${post.slug}`,
      },
      wordCount,
      timeRequired: `PT${readTime}M`,
      keywords: Array.isArray(post.tags) ? post.tags.join(', ') : (post.tags || ''),
      articleSection: post.category || '',
    };

    return { success: true, schema: JSON.stringify(schema) };
  }
);

// ── Helpers ─────────────────────────────────────────────────────────

function checkRequired(field, value, failMessage) {
  const pass = !!value && String(value).trim().length > 0;
  return {
    field,
    pass,
    value: value || '',
    message: pass ? `${field} is set.` : failMessage,
  };
}

function countWords(body) {
  if (!body || typeof body !== 'string') return 0;
  // Strip HTML tags for word count
  const text = body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return text ? text.split(' ').length : 0;
}

export const _TITLE_MIN = TITLE_MIN;
export const _TITLE_MAX = TITLE_MAX;
export const _META_DESC_MIN = META_DESC_MIN;
export const _META_DESC_MAX = META_DESC_MAX;
export const _MIN_WORD_COUNT = MIN_WORD_COUNT;
