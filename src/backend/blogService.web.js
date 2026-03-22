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

// ── Static data wrappers (legacy — used by Blog Post page and RSS) ────

export const fetchAllBlogPosts = webMethod(Permissions.Anyone, () => getAllBlogPosts());

export const fetchBlogPost = webMethod(Permissions.Anyone, (slug) => getBlogPost(slug));

export const fetchBlogSlugs = webMethod(Permissions.Anyone, () => getBlogSlugs());

export const fetchBlogFaqs = webMethod(Permissions.Anyone, (slug) => getBlogFaqs(slug));
