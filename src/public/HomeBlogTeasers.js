/**
 * HomeBlogTeasers.js — Blog post teaser cards for the homepage
 *
 * Fetches recent blog posts and renders them as a teaser grid
 * with titles, excerpts, reading time, and category badges.
 *
 * CF-iix7: Website content injection
 *
 * @module HomeBlogTeasers
 */
import { estimateReadingTime, getFeaturedPost } from 'public/blogHelpers';
import { trackEvent } from 'public/engagementTracker';
import { announce } from 'public/a11yHelpers';
import { colors, spacing } from 'public/designTokens.js';

const MAX_TEASERS = 3;
const EXCERPT_MAX_LENGTH = 120;

/**
 * Truncate text to a max length, adding ellipsis if needed.
 * @param {string} text
 * @param {number} maxLen
 * @returns {string}
 */
function truncateExcerpt(text, maxLen) {
  if (!text || typeof text !== 'string') return '';
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  const cut = trimmed.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > maxLen * 0.5 ? cut.slice(0, lastSpace) : cut) + '...';
}

/**
 * Build a single blog teaser card's data object.
 * @param {Object} post - Blog post from CMS
 * @returns {{ title: string, excerpt: string, readingTime: number, category: string, slug: string, image: string|null }}
 */
export function buildTeaserData(post) {
  if (!post) return null;
  return {
    title: post.title || 'Untitled',
    excerpt: truncateExcerpt(post.excerpt || post.plainContent || '', EXCERPT_MAX_LENGTH),
    readingTime: estimateReadingTime(post.plainContent || post.excerpt || ''),
    category: post.category || '',
    slug: post.slug || '',
    image: post.coverImage || null,
  };
}

/**
 * Build teaser card HTML for a single blog post.
 * @param {Object} teaser - Output of buildTeaserData
 * @returns {string} HTML string
 */
export function buildTeaserCardHtml(teaser) {
  if (!teaser) return '';
  const categoryBadge = teaser.category
    ? `<span style="display:inline-block;background:${colors.sunsetCoral};color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:${spacing.xs};">${teaser.category}</span>`
    : '';
  const imageHtml = teaser.image
    ? `<img src="${teaser.image}" alt="${teaser.title}" loading="lazy" style="width:100%;height:160px;object-fit:cover;border-radius:8px 8px 0 0;" />`
    : '';
  return `<article style="background:#fff;border-radius:8px;border:1px solid ${colors.sandDark};overflow:hidden;" role="article">` +
    imageHtml +
    `<div style="padding:${spacing.md};">` +
    categoryBadge +
    `<h4 style="font-size:16px;color:${colors.espresso};margin-bottom:${spacing.xs};line-height:1.3;">${teaser.title}</h4>` +
    `<p style="font-size:13px;color:${colors.espressoLight};line-height:1.5;margin-bottom:${spacing.sm};">${teaser.excerpt}</p>` +
    `<div style="display:flex;justify-content:space-between;align-items:center;">` +
    `<span style="font-size:12px;color:${colors.muted || '#646C79'};">${teaser.readingTime} min read</span>` +
    `<a href="/blog/${teaser.slug}" style="color:${colors.mountainBlue};font-size:13px;font-weight:600;text-decoration:none;" aria-label="Read ${teaser.title}">Read more &rarr;</a>` +
    `</div></div></article>`;
}

/**
 * Build the complete blog teasers section HTML.
 * @param {Array} posts - Array of blog post objects
 * @returns {string} HTML string for the section
 */
export function buildBlogTeaserSection(posts) {
  if (!posts || !Array.isArray(posts) || posts.length === 0) {
    return '';
  }

  const sorted = [...posts].sort((a, b) => {
    const da = a.publishDate || '';
    const db = b.publishDate || '';
    return db.localeCompare(da);
  });

  const teasers = sorted.slice(0, MAX_TEASERS).map(buildTeaserData).filter(Boolean);
  if (teasers.length === 0) return '';

  const cardsHtml = teasers.map(buildTeaserCardHtml).join('');

  return `<div style="text-align:center;margin-bottom:${spacing.lg};">` +
    `<h3 style="font-size:20px;color:${colors.espresso};margin-bottom:${spacing.xs};">From Our Blog</h3>` +
    `<p style="font-size:14px;color:${colors.espressoLight};">Guides, tips, and stories from the showroom floor</p>` +
    `</div>` +
    `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:${spacing.md};" role="feed" aria-label="Recent blog posts">` +
    cardsHtml +
    `</div>` +
    `<div style="text-align:center;margin-top:${spacing.lg};">` +
    `<a href="/blog" style="color:${colors.mountainBlue};font-size:14px;font-weight:600;text-decoration:none;">View all posts &rarr;</a>` +
    `</div>`;
}

/**
 * Initialize the blog teasers section on the homepage.
 * Fetches recent posts from CMS and renders teaser cards.
 *
 * @param {Function} $w - Wix selector function
 * @param {Object} [state] - Shared page state
 */
export async function initHomeBlogTeasers($w, state) {
  try {
    const container = $w('#blogTeaserSection');
    if (!container) return;

    // Fetch blog posts from backend
    const { fetchAllBlogPosts } = await import('backend/blogService.web');
    const posts = await fetchAllBlogPosts();

    if (!posts || posts.length === 0) {
      try { container.collapse(); } catch (_) {}
      return;
    }

    const sectionHtml = buildBlogTeaserSection(posts);
    container.html = sectionHtml;
    container.accessibility = { ariaLabel: 'Recent blog posts', role: 'region' };

    trackEvent('blog_teasers_loaded', { count: Math.min(posts.length, MAX_TEASERS), location: 'homepage' });
  } catch (e) {
    try {
      const container = $w('#blogTeaserSection');
      if (container) container.collapse();
    } catch (_) {}
  }
}

export { MAX_TEASERS, EXCERPT_MAX_LENGTH, truncateExcerpt };
