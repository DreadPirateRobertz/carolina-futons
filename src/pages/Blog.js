// Blog.js - Blog Page
// Wix Blog app integration with SEO schema, social sharing, and related products sidebar
// Blog content is managed in Wix Blog dashboard — this code adds enhancements
import { getBusinessSchema } from 'backend/seoHelpers.web';
import { getFeaturedProducts } from 'backend/productRecommendations.web';
import wixLocationFrontend from 'wix-location-frontend';

$w.onReady(async function () {
  try {
    // ── SEO Schema Injection ───────────────────────────────────────────
    const businessSchema = await getBusinessSchema();
    if (businessSchema) {
      try {
        $w('#blogSeoSchema').postMessage(
          `<script type="application/ld+json">${businessSchema}</script>`
        );
      } catch (e) {}
    }

    // ── Related Products Sidebar ───────────────────────────────────────
    initRelatedProductsSidebar();

    // ── Social Share Buttons ───────────────────────────────────────────
    initSocialShareButtons();

    // ── Newsletter CTA ─────────────────────────────────────────────────
    initBlogNewsletter();

  } catch (err) {
    console.error('Blog page init error:', err);
  }
});

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

    sidebarRepeater.data = featured.map((p, i) => ({
      ...p,
      _id: p._id || `bp-${i}`,
    }));

    sidebarRepeater.onItemReady(($item, itemData) => {
      try {
        $item('#sidebarProductImage').src = itemData.mainMedia || '';
        $item('#sidebarProductImage').alt = itemData.name || 'Product';
        $item('#sidebarProductName').text = itemData.name || '';
        $item('#sidebarProductPrice').text = itemData.formattedPrice || '';
        $item('#sidebarProductLink').onClick(() => {
          wixLocationFrontend.to(`/product-page/${itemData.slug}`);
        });
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
    const pageTitle = encodeURIComponent(document.title || 'Carolina Futons Blog');

    try {
      $w('#shareFacebook').onClick(() => {
        import('wix-window-frontend').then(({ openUrl }) => {
          openUrl(`https://www.facebook.com/sharer/sharer.php?u=${currentUrl}`, '_blank');
        });
      });
    } catch (e) {}

    try {
      $w('#sharePinterest').onClick(() => {
        import('wix-window-frontend').then(({ openUrl }) => {
          openUrl(`https://pinterest.com/pin/create/button/?url=${currentUrl}&description=${pageTitle}`, '_blank');
        });
      });
    } catch (e) {}

    try {
      $w('#shareTwitter').onClick(() => {
        import('wix-window-frontend').then(({ openUrl }) => {
          openUrl(`https://twitter.com/intent/tweet?url=${currentUrl}&text=${pageTitle}`, '_blank');
        });
      });
    } catch (e) {}

    try {
      $w('#shareEmail').onClick(() => {
        import('wix-window-frontend').then(({ openUrl }) => {
          openUrl(`mailto:?subject=${pageTitle}&body=Check out this article: ${currentUrl}`, '_self');
        });
      });
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

    submitBtn.onClick(async () => {
      const email = emailInput.value?.trim();
      if (!email || !email.includes('@')) {
        try { $w('#blogNewsletterError').text = 'Please enter a valid email'; } catch (e) {}
        try { $w('#blogNewsletterError').show(); } catch (e) {}
        return;
      }

      try {
        submitBtn.disable();
        const { submitContactForm } = await import('backend/contactSubmissions.web');
        await submitContactForm({
          email,
          source: 'blog_newsletter',
          status: 'newsletter_signup',
        });

        try { $w('#blogNewsletterSuccess').show(); } catch (e) {}
        try { $w('#blogNewsletterError').hide(); } catch (e) {}
        emailInput.value = '';
      } catch (err) {
        try { $w('#blogNewsletterError').text = 'Something went wrong. Please try again.'; } catch (e) {}
        try { $w('#blogNewsletterError').show(); } catch (e) {}
      } finally {
        submitBtn.enable();
      }
    });
  } catch (err) {
    console.error('Blog newsletter init error:', err);
  }
}
