// Blog Page Helpers
// Pure utility functions for blog listing and blog post pages
// Used by Blog.js and Blog Post.js for reading time, categories,
// featured posts, related posts, social sharing, and author bio

/**
 * Estimate reading time in minutes for given text.
 * @param {string|null|undefined} text - The text content
 * @returns {number} Minutes to read (minimum 1)
 */
export function estimateReadingTime(text) {
  if (!text || typeof text !== 'string') return 1;
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 1;
  const minutes = Math.ceil(words.length / 200);
  return Math.max(1, minutes);
}

/**
 * Extract unique, sorted categories from an array of posts.
 * @param {Array|null} posts - Array of post objects with .category
 * @returns {string[]} Sorted unique category names
 */
export function getCategories(posts) {
  if (!posts || !Array.isArray(posts)) return [];
  const set = new Set();
  for (const post of posts) {
    if (post && post.category) set.add(post.category);
  }
  return [...set].sort();
}

/**
 * Filter posts by category. Returns all posts if category is null/empty.
 * @param {Array|null} posts
 * @param {string|null} category
 * @returns {Array}
 */
export function filterPostsByCategory(posts, category) {
  if (!posts || !Array.isArray(posts)) return [];
  if (!category) return [...posts];
  return posts.filter(p => p.category === category);
}

/**
 * Get the most recently published post (featured).
 * @param {Array|null} posts
 * @returns {Object|null}
 */
export function getFeaturedPost(posts) {
  if (!posts || !Array.isArray(posts) || posts.length === 0) return null;
  const sorted = [...posts].sort((a, b) => {
    const da = a.publishDate || '';
    const db = b.publishDate || '';
    return db.localeCompare(da);
  });
  return sorted[0];
}

/**
 * Get up to 3 related posts, prioritizing same category then shared tags.
 * Excludes the current post.
 * @param {Object|null} currentPost
 * @param {Array|null} allPosts
 * @returns {Array}
 */
export function getRelatedPosts(currentPost, allPosts) {
  if (!currentPost || !allPosts || !Array.isArray(allPosts)) return [];
  const others = allPosts.filter(p => p.slug !== currentPost.slug);
  if (others.length === 0) return [];

  const currentTags = new Set(currentPost.tags || []);

  const scored = others.map(p => {
    let score = 0;
    if (p.category === currentPost.category) score += 10;
    const pTags = p.tags || [];
    for (const tag of pTags) {
      if (currentTags.has(tag)) score += 3;
    }
    return { post: p, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map(s => s.post);
}

/**
 * Format a YYYY-MM-DD date string to a readable format.
 * @param {string|null} dateStr
 * @returns {string} e.g. "February 20, 2026" or "" on invalid
 */
export function formatPublishDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const parts = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) return '';
  const date = new Date(`${dateStr}T12:00:00`);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Build the Carolina Futons author bio object.
 * @returns {{ name: string, description: string, location: string, established: string }}
 */
export function buildAuthorBio() {
  return {
    name: 'Carolina Futons',
    description:
      'The largest selection of quality futon furniture in the Carolinas. Family-owned since 1991, specializing in futon frames, mattresses, Murphy cabinet beds, and platform beds.',
    location: 'Hendersonville, NC',
    established: '1991',
  };
}

/**
 * Build social share URLs for a blog post.
 * @param {string|null} url - Full URL of the post
 * @param {string|null} title - Post title
 * @returns {{ facebook?: string, pinterest?: string, twitter?: string, email?: string }}
 */
export function buildShareUrls(url, title) {
  if (!url || !title) return {};
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  return {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    pinterest: `https://pinterest.com/pin/create/button/?url=${encodedUrl}&description=${encodedTitle}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    email: `mailto:?subject=${encodedTitle}&body=Check out this article: ${encodedUrl}`,
  };
}
