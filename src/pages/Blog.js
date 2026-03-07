// Blog.js - Blog Page
// Card grid layout with featured post hero, category filters,
// reading time badges, SEO schema, social sharing, and related products sidebar
import { getBusinessSchema } from 'backend/seoHelpers.web';
import { getFeaturedProducts } from 'backend/productRecommendations.web';
// eslint-disable-next-line @wix/cli/no-invalid-backend-import
import { getAllBlogPosts } from 'backend/blogContent';
import wixLocationFrontend from 'wix-location-frontend';
import { limitForViewport, initBackToTop, onViewportChange } from 'public/mobileHelpers';
import { trackEvent } from 'public/engagementTracker';
import { fireCustomEvent } from 'public/ga4Tracking';
import { announce, makeClickable } from 'public/a11yHelpers';
import { colors } from 'public/designTokens.js';
import {
  getCategories,
  filterPostsByCategory,
  getFeaturedPost,
  estimateReadingTime,
  formatPublishDate,
  buildAuthorBio,
} from 'public/blogHelpers';

let _allPosts = [];
let _activeCategory = null;

$w.onReady(async function () {
  initBackToTop($w);
  trackEvent('page_view', { page: 'blog' });
  try {
    // ── Load Blog Posts ─────────────────────────────────────────────
    _allPosts = getAllBlogPosts() || [];

    // ── Featured Post Hero ──────────────────────────────────────────
    initFeaturedHero(_allPosts);

    // ── Category Filters ────────────────────────────────────────────
    initCategoryFilters(_allPosts);

    // ── Blog Card Grid ──────────────────────────────────────────────
    renderBlogGrid(_allPosts);

    // Re-render grid when viewport changes (e.g. device rotation)
    onViewportChange(() => {
      try { renderBlogGrid(_allPosts); } catch (e) {}
    });

    // ── SEO Schema Injection ────────────────────────────────────────
    const businessSchema = await getBusinessSchema();
    if (businessSchema) {
      try {
        $w('#blogSeoSchema').postMessage(
          `<script type="application/ld+json">${businessSchema}</script>`
        );
      } catch (e) {}
    }

    // ── Related Products Sidebar ────────────────────────────────────
    initRelatedProductsSidebar();

    // ── Social Share Buttons ────────────────────────────────────────
    initSocialShareButtons();

    // ── Newsletter CTA ──────────────────────────────────────────────
    initBlogNewsletter();

  } catch (err) {
    console.error('Blog page init error:', err);
  }
});

// ── Featured Post Hero ────────────────────────────────────────────────
// Shows the most recent post in a prominent hero section

function initFeaturedHero(posts) {
  try {
    const featured = getFeaturedPost(posts);
    if (!featured) {
      try { $w('#featuredHeroSection').collapse(); } catch (e) {}
      return;
    }

    try { $w('#featuredTitle').text = featured.title || ''; } catch (e) {}
    try { $w('#featuredExcerpt').text = featured.excerpt || ''; } catch (e) {}
    try { $w('#featuredCategory').text = featured.category || ''; } catch (e) {}
    try {
      $w('#featuredDate').text = formatPublishDate(featured.publishDate);
    } catch (e) {}
    try {
      const readTime = estimateReadingTime(featured.excerpt);
      $w('#featuredReadTime').text = `${readTime} min read`;
    } catch (e) {}

    try {
      const authorBio = buildAuthorBio();
      $w('#featuredAuthor').text = authorBio.name;
    } catch (e) {}

    try {
      makeClickable($w('#featuredHeroLink'), () => {
        wixLocationFrontend.to(`/blog/${featured.slug}`);
      }, { ariaLabel: `Read featured post: ${featured.title}` });
    } catch (e) {}

    try { $w('#featuredHeroSection').expand(); } catch (e) {}
    fireCustomEvent('blog_featured_view', { slug: featured.slug });
  } catch (err) {
    console.error('Featured hero error:', err);
  }
}

// ── Category Filters ──────────────────────────────────────────────────
// Horizontal filter chips — "All" + each category

function initCategoryFilters(posts) {
  try {
    const filterRepeater = $w('#categoryFilterRepeater');
    if (!filterRepeater) return;

    const categories = getCategories(posts);
    const filterData = [
      { _id: 'all', label: 'All', value: null },
      ...categories.map((cat, i) => ({
        _id: `cat-${i}`,
        label: cat,
        value: cat,
      })),
    ];

    filterRepeater.data = filterData;

    filterRepeater.onItemReady(($item, itemData) => {
      try {
        $item('#filterLabel').text = itemData.label;
        const isActive = itemData.value === _activeCategory;
        try {
          $item('#filterChip').style.backgroundColor = isActive ? colors.mountainBlue : colors.sandLight;
          $item('#filterLabel').style.color = isActive ? colors.white : colors.espresso;
        } catch (e) {}

        makeClickable($item('#filterChip'), () => {
          _activeCategory = itemData.value;
          const filtered = filterPostsByCategory(_allPosts, _activeCategory);
          renderBlogGrid(filtered);
          filterRepeater.data = [...filterData];
          fireCustomEvent('blog_filter', { category: itemData.label });
          announce($w, `Showing ${itemData.label} posts`);
        }, { ariaLabel: `Filter by ${itemData.label}` });
      } catch (e) {}
    });
  } catch (err) {
    console.error('Category filter error:', err);
  }
}

// ── Blog Card Grid ────────────────────────────────────────────────────
// Responsive card grid with title, excerpt, category, date, reading time

function renderBlogGrid(posts) {
  try {
    const gridRepeater = $w('#blogGridRepeater');
    if (!gridRepeater) return;

    if (!posts || posts.length === 0) {
      try { $w('#blogEmptyState').expand(); } catch (e) {}
      try { $w('#blogGridRepeater').collapse(); } catch (e) {}
      return;
    }

    try { $w('#blogEmptyState').collapse(); } catch (e) {}
    try { $w('#blogGridRepeater').expand(); } catch (e) {}

    const visiblePosts = limitForViewport(posts, { mobile: 4, tablet: 6, desktop: 9 });
    gridRepeater.data = visiblePosts.map((p, i) => ({
      ...p,
      _id: p.slug || `post-${i}`,
    }));

    gridRepeater.onItemReady(($item, itemData) => {
      try {
        try { $item('#cardTitle').text = itemData.title || ''; } catch (e) {}
        try { $item('#cardExcerpt').text = itemData.excerpt || ''; } catch (e) {}
        try { $item('#cardCategory').text = itemData.category || ''; } catch (e) {}
        try {
          $item('#cardDate').text = formatPublishDate(itemData.publishDate);
        } catch (e) {}
        try {
          const readTime = estimateReadingTime(itemData.excerpt);
          $item('#cardReadTime').text = `${readTime} min read`;
        } catch (e) {}

        makeClickable($item('#blogCardLink'), () => {
          wixLocationFrontend.to(`/blog/${itemData.slug}`);
        }, { ariaLabel: `Read: ${itemData.title}` });
      } catch (e) {}
    });
  } catch (err) {
    console.error('Blog grid error:', err);
  }
}

// ── Related Products Sidebar ──────────────────────────────────────────
// Shows featured products alongside blog content for cross-selling

async function initRelatedProductsSidebar() {
  try {
    const sidebarRepeater = $w('#blogProductsRepeater');
    if (!sidebarRepeater) return;

    const featured = await getFeaturedProducts(4);
    if (!featured || featured.length === 0) {
      try { $w('#blogProductsSection').collapse(); } catch (e) {}
      return;
    }

    const visibleProducts = limitForViewport(featured, { mobile: 2, tablet: 3, desktop: 4 });
    sidebarRepeater.data = visibleProducts.map((p, i) => ({
      ...p,
      _id: p._id || `bp-${i}`,
    }));

    sidebarRepeater.onItemReady(($item, itemData) => {
      try {
        $item('#sidebarProductImage').src = itemData.mainMedia || '';
        $item('#sidebarProductImage').alt = itemData.name || 'Product';
        $item('#sidebarProductName').text = itemData.name || '';
        $item('#sidebarProductPrice').text = itemData.formattedPrice || '';
        makeClickable($item('#sidebarProductLink'), () => {
          wixLocationFrontend.to(`/product-page/${itemData.slug}`);
        }, { ariaLabel: `View ${itemData.name}` });
      } catch (e) {}
    });

    try { $w('#blogProductsSection').expand(); } catch (e) {}
  } catch (err) {
    console.error('Blog sidebar error:', err);
  }
}

// ── Social Share Buttons ──────────────────────────────────────────────

function initSocialShareButtons() {
  try {
    const currentUrl = encodeURIComponent(wixLocationFrontend.url);
    const pageTitle = encodeURIComponent(
      (typeof document !== 'undefined' && document.title) ? document.title : 'Carolina Futons Blog'
    );

    try {
      $w('#shareFacebook').onClick(() => {
        import('wix-window-frontend').then(({ openUrl }) => {
          openUrl(`https://www.facebook.com/sharer/sharer.php?u=${currentUrl}`, '_blank');
        });
      });
      try { $w('#shareFacebook').accessibility.ariaLabel = 'Share this article on Facebook (opens in new window)'; } catch (e) {}
    } catch (e) {}

    try {
      $w('#sharePinterest').onClick(() => {
        import('wix-window-frontend').then(({ openUrl }) => {
          openUrl(`https://pinterest.com/pin/create/button/?url=${currentUrl}&description=${pageTitle}`, '_blank');
        });
      });
      try { $w('#sharePinterest').accessibility.ariaLabel = 'Share this article on Pinterest (opens in new window)'; } catch (e) {}
    } catch (e) {}

    try {
      $w('#shareTwitter').onClick(() => {
        import('wix-window-frontend').then(({ openUrl }) => {
          openUrl(`https://twitter.com/intent/tweet?url=${currentUrl}&text=${pageTitle}`, '_blank');
        });
      });
      try { $w('#shareTwitter').accessibility.ariaLabel = 'Share this article on Twitter (opens in new window)'; } catch (e) {}
    } catch (e) {}

    try {
      $w('#shareEmail').onClick(() => {
        import('wix-window-frontend').then(({ openUrl }) => {
          openUrl(`mailto:?subject=${pageTitle}&body=Check out this article: ${currentUrl}`, '_self');
        });
      });
      try { $w('#shareEmail').accessibility.ariaLabel = 'Share this article via email'; } catch (e) {}
    } catch (e) {}
  } catch (err) {
    console.error('Social share init error:', err);
  }
}

// ── Blog Newsletter CTA ──────────────────────────────────────────────

function initBlogNewsletter() {
  try {
    const submitBtn = $w('#blogNewsletterSubmit');
    const emailInput = $w('#blogNewsletterEmail');
    if (!submitBtn || !emailInput) return;

    try { emailInput.accessibility.ariaLabel = 'Enter your email for newsletter'; } catch (e) {}
    try { submitBtn.accessibility.ariaLabel = 'Subscribe to newsletter'; } catch (e) {}

    submitBtn.onClick(async () => {
      const email = emailInput.value?.trim();
      if (!email || !email.includes('@')) {
        try { $w('#blogNewsletterError').text = 'Please enter a valid email'; } catch (e) {}
        try { $w('#blogNewsletterError').show(); } catch (e) {}
        announce($w, 'Please enter a valid email address');
        return;
      }

      try {
        submitBtn.disable();
        const { subscribeToNewsletter } = await import('backend/newsletterService.web');
        const result = await subscribeToNewsletter(email, { source: 'blog_newsletter' });

        if (result.success) {
          try { $w('#blogNewsletterSuccess').show(); } catch (e) {}
          try { $w('#blogNewsletterError').hide(); } catch (e) {}
          fireCustomEvent('newsletter_signup', { source: 'blog' });
          announce($w, 'Successfully subscribed to newsletter');
          emailInput.value = '';
        } else {
          try { $w('#blogNewsletterError').text = result.message || 'Something went wrong. Please try again.'; } catch (e) {}
          try { $w('#blogNewsletterError').show(); } catch (e) {}
        }
      } catch (err) {
        try { $w('#blogNewsletterError').text = 'Something went wrong. Please try again.'; } catch (e) {}
        try { $w('#blogNewsletterError').show(); } catch (e) {}
        announce($w, 'Something went wrong. Please try again.');
      } finally {
        submitBtn.enable();
      }
    });
  } catch (err) {
    console.error('Blog newsletter init error:', err);
  }
}
