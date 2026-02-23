// Blog Post.js - Individual Blog Post Page
// Wix Blog app renders the post content — this code adds SEO schema enhancements
// Injects Article + FAQ JSON-LD structured data for each pillar blog post
import { getBlogArticleSchema, getBlogFaqSchema, getPageTitle, getCanonicalUrl, getPageMetaDescription } from 'backend/seoHelpers.web';
import { getBlogPost } from 'backend/blogContent';
import wixLocationFrontend from 'wix-location-frontend';
import { initBackToTop } from 'public/mobileHelpers';
import { trackEvent } from 'public/engagementTracker';

$w.onReady(async function () {
  initBackToTop($w);
  trackEvent('page_view', { page: 'blog_post' });

  try {
    // Extract slug from URL path: /blog/<slug>
    const path = wixLocationFrontend.path;
    const slug = path && path.length > 0 ? path[path.length - 1] : null;
    if (!slug) return;

    const post = getBlogPost(slug);
    if (!post) return; // Not a pillar post — no custom schema needed

    // Build schema scripts
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
      try {
        $w('#postSeoSchema').postMessage(schemas.join('\n'));
      } catch (e) {}
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
  } catch (err) {
    console.error('Blog post schema injection error:', err);
  }
});
