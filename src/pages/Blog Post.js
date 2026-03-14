// Blog Post.js - Individual Blog Post Page
// Wix Blog app renders the post content — this code adds SEO schema,
// reading time, social share buttons, author bio, and related posts
import { getBlogArticleSchema, getBlogFaqSchema, getPageTitle, getCanonicalUrl, getPageMetaDescription } from 'backend/seoHelpers.web';
import { getGuidePinData } from 'backend/pinterestRichPins.web';
// eslint-disable-next-line @wix/cli/no-invalid-backend-import
import { getBlogPost, getAllBlogPosts } from 'backend/blogContent';
import wixLocationFrontend from 'wix-location-frontend';
import { initBackToTop } from 'public/mobileHelpers';
import { trackEvent } from 'public/engagementTracker';
import { fireCustomEvent } from 'public/ga4Tracking';
import { announce, makeClickable } from 'public/a11yHelpers';
import {
  estimateReadingTime,
  formatPublishDate,
  buildAuthorBio,
  buildShareUrls,
  getRelatedPosts,
} from 'public/blogHelpers';
import { initPageSeo } from 'public/pageSeo.js';

$w.onReady(async function () {
  initBackToTop($w);
  trackEvent('page_view', { page: 'blog_post' });

  try {
    // Extract slug from URL path: /blog/<slug>
    const path = wixLocationFrontend.path;
    const slug = path && path.length > 0 ? path[path.length - 1] : null;
    if (!slug) return;

    const post = getBlogPost(slug);
    if (!post) return; // Not a pillar post — no custom enhancements

    // ── Reading Time Badge ────────────────────────────────────────────
    initReadingTime(post);

    // ── Author Bio ────────────────────────────────────────────────────
    initAuthorBio();

    // ── Social Share Buttons ──────────────────────────────────────────
    initPostShareButtons(post);

    // ── Related Posts ─────────────────────────────────────────────────
    initRelatedPosts(post);

    // ── SEO Schema Injection ──────────────────────────────────────────
    const schemas = [];
    const articleSchema = await getBlogArticleSchema(post);
    if (articleSchema) {
      schemas.push(`<script type="application/ld+json">${articleSchema}</script>`);
    }
    const faqSchema = await getBlogFaqSchema(slug);
    if (faqSchema) {
      schemas.push(`<script type="application/ld+json">${faqSchema}</script>`);
    }
    if (schemas.length > 0) {
      try { $w('#postSeoSchema').postMessage(schemas.join('\n')); } catch (e) {}
    }

    // Inject meta tags (title, description, canonical)
    try {
      const [title, description, canonical] = await Promise.all([
        getPageTitle('blogPost', { title: post.title }),
        getPageMetaDescription('blogPost', { title: post.title, excerpt: post.excerpt }),
        getCanonicalUrl('blogPost', slug),
      ]);
      try { $w('#postMetaHtml').postMessage(JSON.stringify({ title, description, canonical })); } catch (e) {}
    } catch (e) {}

    // ── Pinterest Article Pin Meta ────────────────────────────────────
    injectPinterestArticleMeta(post);

    // ── OG + Twitter Card meta ──────────────────────────────────────
    initPageSeo('blogPost', { name: post.title, slug, image: post.coverImage });

    fireCustomEvent('blog_post_view', { slug, category: post.category });
  } catch (err) {
    console.error('Blog post page init error:', err);
  }
});

// ── Reading Time Badge ────────────────────────────────────────────────

function initReadingTime(post) {
  try {
    const readTime = estimateReadingTime(post.excerpt);
    try { $w('#postReadTime').text = `${readTime} min read`; } catch (e) {}
    try { $w('#postDate').text = formatPublishDate(post.publishDate); } catch (e) {}
    try { $w('#postCategory').text = post.category || ''; } catch (e) {}
  } catch (err) {
    console.error('Reading time error:', err);
  }
}

// ── Author Bio ────────────────────────────────────────────────────────

function initAuthorBio() {
  try {
    const bio = buildAuthorBio();
    try { $w('#authorName').text = bio.name; } catch (e) {}
    try { $w('#authorDescription').text = bio.description; } catch (e) {}
    try { $w('#authorLocation').text = bio.location; } catch (e) {}
    try { $w('#authorEstablished').text = `Est. ${bio.established}`; } catch (e) {}
    try { $w('#authorBioSection').expand(); } catch (e) {}
  } catch (err) {
    console.error('Author bio error:', err);
  }
}

// ── Social Share Buttons ──────────────────────────────────────────────

function initPostShareButtons(post) {
  try {
    const postUrl = `https://www.carolinafutons.com/blog/${post.slug}`;
    const urls = buildShareUrls(postUrl, post.title);
    if (!urls.facebook) return;

    try {
      makeClickable($w('#postShareFacebook'), () => {
        import('wix-window-frontend').then(({ openUrl }) => {
          openUrl(urls.facebook, '_blank');
        });
      }, { ariaLabel: 'Share on Facebook (opens in new window)' });
    } catch (e) {}

    try {
      makeClickable($w('#postSharePinterest'), () => {
        import('wix-window-frontend').then(({ openUrl }) => {
          openUrl(urls.pinterest, '_blank');
        });
      }, { ariaLabel: 'Share on Pinterest (opens in new window)' });
    } catch (e) {}

    try {
      makeClickable($w('#postShareTwitter'), () => {
        import('wix-window-frontend').then(({ openUrl }) => {
          openUrl(urls.twitter, '_blank');
        });
      }, { ariaLabel: 'Share on Twitter (opens in new window)' });
    } catch (e) {}

    try {
      makeClickable($w('#postShareEmail'), () => {
        import('wix-window-frontend').then(({ openUrl }) => {
          openUrl(urls.email, '_self');
        });
      }, { ariaLabel: 'Share via email' });
    } catch (e) {}
  } catch (err) {
    console.error('Share buttons error:', err);
  }
}

// ── Related Posts ─────────────────────────────────────────────────────

function initRelatedPosts(currentPost) {
  try {
    const allPosts = getAllBlogPosts() || [];
    const related = getRelatedPosts(currentPost, allPosts);

    if (related.length === 0) {
      try { $w('#relatedPostsSection').collapse(); } catch (e) {}
      return;
    }

    const relatedRepeater = $w('#relatedPostsRepeater');
    if (!relatedRepeater) return;

    relatedRepeater.data = related.map((p, i) => ({
      ...p,
      _id: p.slug || `related-${i}`,
    }));

    relatedRepeater.onItemReady(($item, itemData) => {
      try {
        try { $item('#relatedTitle').text = itemData.title || ''; } catch (e) {}
        try { $item('#relatedCategory').text = itemData.category || ''; } catch (e) {}
        try {
          const readTime = estimateReadingTime(itemData.excerpt);
          $item('#relatedReadTime').text = `${readTime} min read`;
        } catch (e) {}

        makeClickable($item('#relatedPostLink'), () => {
          wixLocationFrontend.to(`/blog/${itemData.slug}`);
        }, { ariaLabel: `Read related: ${itemData.title}` });
      } catch (e) {}
    });

    try { $w('#relatedPostsSection').expand(); } catch (e) {}
  } catch (err) {
    console.error('Related posts error:', err);
  }
}

// ── Pinterest Article Pin Meta ──────────────────────────────────────────

async function injectPinterestArticleMeta(post) {
  try {
    if (!post) return;

    const pinResult = await getGuidePinData({
      slug: post.slug,
      title: post.title,
      description: post.excerpt || post.description,
      heroImage: post.heroImage,
      publishDate: post.publishDate,
      author: post.author,
    });

    if (!pinResult?.success || !pinResult.meta) return;

    const { head } = await import('wix-seo-frontend');
    const pinterestKeys = ['pinterest-rich-pin', 'pinterest:description', 'article:author', 'article:published_time'];
    for (const key of pinterestKeys) {
      if (pinResult.meta[key]) {
        head.setMetaTag(key, pinResult.meta[key]);
      }
    }
  } catch (e) {
    // Pinterest meta injection is non-critical
  }
}
