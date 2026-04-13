/**
 * Blog Service — web module wrapper for blogContent (static) and Wix Blog CMS (live).
 * Exposes blog functions to public/page files via Wix web module convention.
 *
 * @requires wix-web-module
 * @requires wix-blog-backend
 * @requires backend/blogContent
 */
import { Permissions, webMethod } from 'wix-web-module';
import { posts as blogPosts } from 'wix-blog-backend';
import { getAllBlogPosts, getBlogPost, getBlogSlugs, getBlogFaqs } from 'backend/blogContent';

const DEFAULT_PER_PAGE = 9;
const FALLBACK_AUTHOR = 'Carolina Futons Team';

/** Normalize a raw Wix Blog post into a flat display object. */
function normalizePost(raw) {
  return {
    _id: raw._id,
    title: raw.title || '',
    slug: raw.slug || '',
    excerpt: raw.excerpt || '',
    publishedDate: raw.publishedDate || '',
    coverImageUrl: raw.media?.wixMedia?.image?.url ?? '',
    category: raw.categories?.[0]?.label ?? '',
    authorName: raw.author?.authorName || FALLBACK_AUTHOR,
  };
}

/**
 * Fetch published blog posts from the Wix Blog CMS with pagination.
 * Fails open on error — returns empty result with error flag rather than throwing.
 *
 * @function getPublishedBlogPosts
 * @param {number} [page=1]            1-based page number (clamped to ≥1)
 * @param {number} [perPage=9]         Posts per page (clamped to 1–100)
 * @returns {Promise<Object>} { posts, total, page, perPage, totalPages, hasNextPage, hasPrevPage, error? }
 * @permission Anyone
 */
export const getPublishedBlogPosts = webMethod(
  Permissions.Anyone,
  async (page = 1, perPage = DEFAULT_PER_PAGE) => {
    const safePage = Math.max(1, Math.floor(page));
    const safePerPage = Math.min(100, Math.max(1, Math.floor(perPage)));
    const offset = (safePage - 1) * safePerPage;

    try {
      const response = await blogPosts.listPosts({
        paging: { limit: safePerPage, offset },
      });

      const rawPosts = response.posts ?? [];
      const total = response.metaData?.total ?? rawPosts.length;
      const totalPages = total === 0 ? 0 : Math.ceil(total / safePerPage);

      return {
        posts: rawPosts.map(normalizePost),
        total,
        page: safePage,
        perPage: safePerPage,
        totalPages,
        hasNextPage: safePage < totalPages,
        hasPrevPage: safePage > 1,
      };
    } catch (err) {
      console.error('[blogService] getPublishedBlogPosts failed:', err?.message);
      return {
        posts: [],
        total: 0,
        page: safePage,
        perPage: safePerPage,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
        error: true,
      };
    }
  }
);

/**
 * Fetch the most recent N published posts from the Wix Blog CMS.
 * Returns a flat array of normalized post objects (not a pagination wrapper).
 * Fails open — returns [] on error.
 *
 * @function getRecentPosts
 * @param {number} [count=3] Number of posts to fetch (clamped to 1–50)
 * @returns {Promise<Array>} Array of normalized post objects
 * @permission Anyone
 */
export const getRecentPosts = webMethod(
  Permissions.Anyone,
  async (count = DEFAULT_PER_PAGE) => {
    const safeCount = Math.min(50, Math.max(1, Math.floor(count)));
    try {
      const response = await blogPosts.listPosts({
        paging: { limit: safeCount, offset: 0 },
      });
      return (response.posts ?? []).map(normalizePost);
    } catch (err) {
      console.error('[blogService] getRecentPosts failed:', err?.message);
      return [];
    }
  }
);

/**
 * Fetch a single published post from the Wix Blog CMS by its slug.
 * Returns a normalized post object, or null if not found or on error.
 *
 * @function getPostBySlug
 * @param {string} slug Post slug (from URL path)
 * @returns {Promise<Object|null>} Normalized post or null
 * @permission Anyone
 */
export const getPostBySlug = webMethod(
  Permissions.Anyone,
  async (slug) => {
    if (!slug || typeof slug !== 'string') return null;
    try {
      const response = await blogPosts.getPost(slug.trim());
      return response.post ? normalizePost(response.post) : null;
    } catch (err) {
      if (err?.code === 404 || err?.message?.includes('not found')) return null;
      console.error('[blogService] getPostBySlug failed:', err?.message);
      return null;
    }
  }
);

/**
 * Return the sorted list of unique category labels found in recent posts.
 * Fetches up to 50 posts to collect categories; fails open → returns [].
 *
 * @function getCategories
 * @returns {Promise<string[]>} Sorted array of category label strings
 * @permission Anyone
 */
export const getCategories = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      const response = await blogPosts.listPosts({
        paging: { limit: 50, offset: 0 },
      });
      const posts = response.posts ?? [];
      const seen = new Set();
      for (const post of posts) {
        const label = post.categories?.[0]?.label;
        if (label) seen.add(label);
      }
      return [...seen].sort();
    } catch (err) {
      console.error('[blogService] getCategories failed:', err?.message);
      return [];
    }
  }
);

// ── Static data wrappers (legacy — used by Blog Post page and RSS) ────

export const fetchAllBlogPosts = webMethod(Permissions.Anyone, () => getAllBlogPosts());

export const fetchBlogPost = webMethod(Permissions.Anyone, (slug) => getBlogPost(slug));

export const fetchBlogSlugs = webMethod(Permissions.Anyone, () => getBlogSlugs());

export const fetchBlogFaqs = webMethod(Permissions.Anyone, (slug) => getBlogFaqs(slug));
