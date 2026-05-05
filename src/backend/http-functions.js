// Wix HTTP Functions - Public API endpoints
// Accessible at: https://www.carolinafutons.com/_functions/<functionName>
import { ok, notFound, serverError, forbidden, badRequest, unauthorized, response } from 'wix-http-functions';
import { currentMember } from 'wix-members-backend';
import { accounts, rewards as loyaltyRewards } from 'wix-loyalty.v2';
import { resolveTierFromPoints } from 'backend/utils/loyaltyData';
import { generateFeed } from 'backend/googleMerchantFeed.web';
import { getImageUrl } from 'backend/utils/mediaHelpers';
import { recordPriceSnapshots, checkWishlistAlerts } from 'backend/notificationService.web';
import { sendEmail } from 'backend/emailService.web';
import { triggerBrowseRecovery } from 'backend/browseAbandonment.web';
import { triggerAbandonedCartRecovery, processEmailQueue, triggerReengagement, triggerPostPurchaseSequence, getCampaignAnalytics, unsubscribeContact } from 'backend/emailAutomation.web';
import { scanAndTriggerWinback, runReviewRequestEmails } from 'backend/marketingSequences.web';
import { processContentSchedule } from 'backend/contentScheduler.web';
import { sendWeeklyBlogDigest } from 'backend/blogDigestService.web';
import { getAssemblyFollowUpData } from 'backend/postPurchaseCare.web';
import { insertAnalyticsEvent } from 'backend/utils/analyticsEvents';
import { getAllBlogPosts } from 'backend/blogContent';
import { getSitemapData, buildSitemapXml, getRobotsTxtContent } from 'backend/seoHelpers.web';
import wixData from 'wix-data';
import { colors } from 'public/sharedTokens';
import { sanitize, validateEmail, validateSlug, validateId } from 'backend/utils/sanitize';
import { getEnhancedCatalogFields, exportCustomerAudienceData } from 'backend/facebookCatalog.web';
import { timingSafeEqual, decodeHtmlEntities, stripHtmlSafe, escapeXml } from 'backend/utils/httpHelpers';
import { corsHeaders, corsPreflight } from 'backend/utils/cors';
import { getDeliveryZone as _getDeliveryZone } from 'backend/deliveryZoneService.web';
import { CLUSTERS, SITE_URL } from 'backend/utils/topicClusterData';
import { listBundles, getBundleBySlug, addBundleToCart } from 'backend/bundleDeals.web';
import { receiveGamificationEvent, getActiveChallenges as _getActiveChallengesWebMethod, recordChallengeProgress as _recordChallengeProgressWebMethod } from 'backend/gamificationEventReceiver.web';
import { getLeaderboard as _getLeaderboardWebMethod } from 'backend/loyaltyService.web';
export { post_getLeaderboard } from 'backend/leaderboard-http';
import { validateIncomingEvent, logEventTrace } from 'backend/utils/eventBus';
import { runGarbageCollection } from 'backend/cmsGarbageCollector.web';
import { getSecret } from 'wix-secrets-backend';
import { subscribeToNewsletter } from 'backend/newsletterService.web';
import { verifyUnsubToken } from 'backend/utils/unsubToken';
import { submitSwatchRequest } from 'backend/swatchRequest.web';

/**
 * Fetch all products from the Stores/Products collection, paginating
 * past the Wix 1000-item query limit.
 * @returns {Promise<Array>}
 */
async function fetchAllProducts() {
  const PAGE_SIZE = 1000;
  let allItems = [];
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    const result = await wixData.query('Stores/Products')
      .limit(PAGE_SIZE)
      .skip(skip)
      .find({ suppressAuth: true });
    const items = result.items ?? [];
    allItems = allItems.concat(items);
    skip += PAGE_SIZE;
    hasMore = items.length === PAGE_SIZE;
  }

  return allItems;
}

// Google Merchant Center product feed endpoint
// URL: GET https://www.carolinafutons.com/_functions/googleShoppingFeed
// Configure this URL in Google Merchant Center as a scheduled fetch source
export function get_googleShoppingFeed(request) {
  return generateFeed()
    .then(xml => {
      if (!xml) {
        return serverError({
          body: 'Error generating feed',
          headers: { 'Content-Type': 'text/plain' },
        });
      }

      return ok({
        body: xml,
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    })
    .catch(err => {
      console.error('HTTP function error (googleShoppingFeed):', err);
      return serverError({
        body: 'Internal server error',
        headers: { 'Content-Type': 'text/plain' },
      });
    });
}

// Health check endpoint for monitoring
// URL: GET https://www.carolinafutons.com/_functions/health
// Returns CORS headers so the carolina-futons-web Next.js app + preview URLs
// can probe this endpoint cross-origin (needed for morgott's Phase 0 smoke gate).
export function get_health(request) {
  return ok({
    body: JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }),
    headers: corsHeaders(request, { 'Content-Type': 'application/json' }),
  });
}

// CORS preflight for /_functions/health.
export function options_health(request) {
  return response(corsPreflight(request));
}

// One-click unsubscribe endpoint (CAN-SPAM / GDPR List-Unsubscribe).
// URL: GET https://www.carolinafutons.com/_functions/unsubscribe?token=<JWT>
// Token is HMAC-SHA256 signed with the UNSUB_TOKEN_SECRET Wix secret.
// CF-r9tf
export async function get_unsubscribe(request) {
  const token = request?.query?.token || '';
  if (!token) {
    return badRequest({
      body: _unsubHtml('Invalid link', 'This unsubscribe link is missing or invalid.'),
      headers: { 'Content-Type': 'text/html' },
    });
  }

  let secret;
  try {
    secret = await getSecret('UNSUB_TOKEN_SECRET');
  } catch {
    return serverError({
      body: _unsubHtml('Error', 'Something went wrong. Please try again.'),
      headers: { 'Content-Type': 'text/html' },
    });
  }

  const decoded = await verifyUnsubToken(token, secret);
  if (!decoded) {
    return badRequest({
      body: _unsubHtml('Invalid link', 'This unsubscribe link is invalid or has expired. Links are valid for 30 days.'),
      headers: { 'Content-Type': 'text/html' },
    });
  }

  try {
    await unsubscribeContact(decoded.email, decoded.seq);
    return ok({
      body: _unsubHtml(
        'You\'ve been unsubscribed',
        `<strong>${decoded.email}</strong> has been removed from our mailing list. ` +
        `You won't receive any more ${decoded.seq === 'all' ? '' : decoded.seq + ' '}emails from us.<br/><br/>` +
        `Changed your mind? <a href="https://www.carolinafutons.com/account/preferences">Manage email preferences</a>.`,
      ),
      headers: { 'Content-Type': 'text/html' },
    });
  } catch {
    return serverError({
      body: _unsubHtml('Error', 'We couldn\'t process your request. Please try again or contact us.'),
      headers: { 'Content-Type': 'text/html' },
    });
  }
}

function _unsubHtml(heading, message) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${heading} — Carolina Futons</title>
<style>body{margin:0;padding:40px 20px;font-family:Arial,sans-serif;background:#f5f5f5;color:#333;}
.box{max-width:480px;margin:0 auto;background:#fff;border-radius:6px;padding:32px;text-align:center;}
h1{font-family:Georgia,serif;color:${colors.espresso};font-size:24px;margin:0 0 16px;}
p{line-height:1.6;color:#555;}a{color:${colors.espresso};}</style></head>
<body><div class="box"><h1>${heading}</h1><p>${message}</p></div></body></html>`;
}

// Dynamic product sitemap for SEO
// URL: GET https://www.carolinafutons.com/_functions/productSitemap
// Submit to Google Search Console for improved crawl coverage
export async function get_productSitemap() {
  try {
    const SITE_URL = 'https://www.carolinafutons.com';

    // Static pages
    const staticPages = [
      { loc: '/', priority: '1.0', changefreq: 'daily' },
      { loc: '/shop-main', priority: '0.9', changefreq: 'daily' },
      { loc: '/futon-frames', priority: '0.8', changefreq: 'weekly' },
      { loc: '/mattresses', priority: '0.8', changefreq: 'weekly' },
      { loc: '/murphy-cabinet-beds', priority: '0.8', changefreq: 'weekly' },
      { loc: '/platform-beds', priority: '0.8', changefreq: 'weekly' },
      { loc: '/wall-huggers', priority: '0.8', changefreq: 'weekly' },
      { loc: '/unfinished-wood', priority: '0.8', changefreq: 'weekly' },
      { loc: '/casegoods-accessories', priority: '0.7', changefreq: 'weekly' },
      { loc: '/sales', priority: '0.7', changefreq: 'daily' },
      { loc: '/blog', priority: '0.7', changefreq: 'weekly' },
      { loc: '/blog/best-futons-for-everyday-sleeping', priority: '0.7', changefreq: 'monthly' },
      { loc: '/blog/futon-frame-buying-guide', priority: '0.7', changefreq: 'monthly' },
      { loc: '/blog/how-to-choose-futon-mattress', priority: '0.7', changefreq: 'monthly' },
      { loc: '/blog/murphy-bed-vs-futon', priority: '0.7', changefreq: 'monthly' },
      { loc: '/blog/futon-care-guide', priority: '0.7', changefreq: 'monthly' },
      { loc: '/blog/futon-vs-sofa-bed', priority: '0.7', changefreq: 'monthly' },
      { loc: '/blog/small-space-furniture-guide', priority: '0.7', changefreq: 'monthly' },
      { loc: '/blog/platform-bed-guide', priority: '0.7', changefreq: 'monthly' },
      { loc: '/product-videos', priority: '0.6', changefreq: 'weekly' },
      { loc: '/getting-it-home', priority: '0.5', changefreq: 'monthly' },
      { loc: '/contact', priority: '0.5', changefreq: 'monthly' },
      { loc: '/faq', priority: '0.5', changefreq: 'monthly' },
      { loc: '/about', priority: '0.5', changefreq: 'monthly' },
      { loc: '/newsletter', priority: '0.5', changefreq: 'monthly' },
    ];

    // Fetch all products for dynamic URLs (paginated — no 200 limit).
    // Fail gracefully: if the product query throws, serve static pages only
    // rather than returning a 500 that would block Google from crawling.
    let productItems = [];
    try {
      productItems = await fetchAllProducts();
    } catch (err) {
      console.error('[productSitemap] Product fetch failed — serving static pages only, all product URLs missing:', err?.message ?? err);
    }

    const productUrls = productItems.map(p => ({
      loc: `/product-page/${encodeURIComponent(p.slug)}`,
      priority: '0.7',
      changefreq: 'weekly',
      lastmod: p._updatedDate ? new Date(p._updatedDate).toISOString().split('T')[0] : '',
    }));

    const allUrls = [...staticPages, ...productUrls];

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    for (const url of allUrls) {
      xml += '  <url>\n';
      xml += `    <loc>${escapeXml(SITE_URL + url.loc)}</loc>\n`;
      if (url.lastmod) xml += `    <lastmod>${escapeXml(url.lastmod)}</lastmod>\n`;
      xml += `    <changefreq>${escapeXml(url.changefreq)}</changefreq>\n`;
      xml += `    <priority>${escapeXml(url.priority)}</priority>\n`;
      xml += '  </url>\n';
    }

    xml += '</urlset>';

    return ok({
      body: xml,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    console.error('HTTP function error (productSitemap):', err);
    return serverError({
      body: 'Error generating sitemap',
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

// Dynamic blog sitemap for SEO
// URL: GET https://www.carolinafutons.com/_functions/blogSitemap
// Submit alongside productSitemap to Google Search Console
export async function get_blogSitemap() {
  try {
    const SITE_URL = 'https://www.carolinafutons.com';
    const blogPosts = getAllBlogPosts();

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Blog index page
    xml += '  <url>\n';
    xml += `    <loc>${escapeXml(SITE_URL + '/blog')}</loc>\n`;
    xml += '    <changefreq>weekly</changefreq>\n';
    xml += '    <priority>0.7</priority>\n';
    xml += '  </url>\n';

    // Individual blog posts
    for (const post of blogPosts) {
      xml += '  <url>\n';
      xml += `    <loc>${escapeXml(SITE_URL + '/blog/' + post.slug)}</loc>\n`;
      if (post.publishDate) {
        xml += `    <lastmod>${escapeXml(post.publishDate)}</lastmod>\n`;
      }
      xml += '    <changefreq>monthly</changefreq>\n';
      xml += '    <priority>0.7</priority>\n';
      xml += '  </url>\n';
    }

    xml += '</urlset>';

    return ok({
      body: xml,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    console.error('HTTP function error (blogSitemap):', err);
    return serverError({
      body: 'Error generating blog sitemap',
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

// Blog RSS 2.0 Feed
// URL: GET https://www.carolinafutons.com/_functions/blogRssFeed
// Add <link rel="alternate" type="application/rss+xml" href="/_functions/blogRssFeed"> in site header
// Note: inlined (not delegated to webMethod) — webMethod wrapper does not resolve correctly
// from an http-functions.js context on the Wix platform, causing a 404.
export function get_blogRssFeed() {
  try {
    const SITE_URL = 'https://www.carolinafutons.com';
    const posts = getAllBlogPosts();

    const sorted = Array.isArray(posts) && posts.length > 0
      ? [...posts].sort((a, b) => {
          const da = a.publishDate ? new Date(a.publishDate).getTime() : 0;
          const db = b.publishDate ? new Date(b.publishDate).getTime() : 0;
          return db - da;
        })
      : [];

    const lastBuildDate = sorted.length > 0 && sorted[0].publishDate
      ? new Date(sorted[0].publishDate).toUTCString()
      : new Date().toUTCString();

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n';
    xml += '  <channel>\n';
    xml += `    <title>${escapeXml('Carolina Futons Blog')}</title>\n`;
    xml += `    <link>${escapeXml(SITE_URL + '/blog')}</link>\n`;
    xml += `    <description>${escapeXml('Guides, tips, and inspiration for futon frames, mattresses, Murphy beds, and small-space furniture.')}</description>\n`;
    xml += '    <language>en-us</language>\n';
    xml += `    <lastBuildDate>${escapeXml(lastBuildDate)}</lastBuildDate>\n`;
    xml += '    <ttl>1440</ttl>\n';
    xml += `    <atom:link href="${escapeXml(SITE_URL + '/_functions/blogRssFeed')}" rel="self" type="application/rss+xml" />\n`;

    for (const post of sorted) {
      const postUrl = `${SITE_URL}/blog/${encodeURIComponent(post.slug || '')}`;
      xml += '    <item>\n';
      xml += `      <title>${escapeXml(post.title || '')}</title>\n`;
      xml += `      <link>${escapeXml(postUrl)}</link>\n`;
      xml += `      <guid isPermaLink="true">${escapeXml(postUrl)}</guid>\n`;
      xml += `      <description>${escapeXml(post.excerpt || post.metaDescription || '')}</description>\n`;
      if (post.publishDate) {
        xml += `      <pubDate>${escapeXml(new Date(post.publishDate).toUTCString())}</pubDate>\n`;
      }
      if (post.category) {
        xml += `      <category>${escapeXml(post.category)}</category>\n`;
      }
      if (Array.isArray(post.tags)) {
        for (const tag of post.tags) {
          xml += `      <category>${escapeXml(tag)}</category>\n`;
        }
      }
      xml += '    </item>\n';
    }

    xml += '  </channel>\n';
    xml += '</rss>';

    return ok({
      body: xml,
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    console.error('HTTP function error (blogRssFeed):', err);
    return serverError({
      body: 'Error generating RSS feed',
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

// Facebook/Instagram Commerce Catalog Feed
// URL: GET https://www.carolinafutons.com/_functions/facebookCatalogFeed
// Configure in Facebook Commerce Manager as a scheduled data feed
export async function get_facebookCatalogFeed() {
  try {
    const SITE_URL = 'https://www.carolinafutons.com';
    const productItems = await fetchAllProducts();

    // Facebook catalog TSV format with DPA-enhanced fields
    const headers = ['id', 'title', 'description', 'availability', 'condition', 'price',
      'link', 'image_link', 'brand', 'google_product_category', 'fb_product_category',
      'sale_price', 'item_group_id', 'content_type',
      'product_type', 'color', 'material', 'additional_image_link',
      'custom_label_0', 'custom_label_1', 'custom_label_2', 'custom_label_3', 'custom_label_4'].join('\t');

    const rows = productItems.map(p => {
      const availability = p.inStock !== false ? 'in stock' : 'out of stock';
      const price = `${(p.price || 0).toFixed(2)} USD`;
      const salePrice = p.discountedPrice ? `${p.discountedPrice.toFixed(2)} USD` : '';
      const brand = detectBrandFromProduct(p);
      const description = stripHtmlSafe(p.description || '').replace(/[\t\n\r]/g, ' ').substring(0, 5000);
      const category = detectGoogleCategory(p);
      const imageUrl = getImageUrl(p.mainMedia);
      const dpa = getEnhancedCatalogFields(p);

      return [
        p._id || '',
        (p.name || '').replace(/[\t\n\r]/g, ' '),
        description,
        availability,
        'new',
        price,
        `${SITE_URL}/product-page/${encodeURIComponent(p.slug)}`,
        imageUrl,
        brand,
        category,
        'furniture > bedroom furniture',
        salePrice,
        (p.collections || [])[0] || '',
        'product',
        dpa.product_type || '',
        dpa.color || '',
        dpa.material || '',
        dpa.additional_image_link || '',
        dpa.custom_label_0 || '',
        dpa.custom_label_1 || '',
        dpa.custom_label_2 || '',
        dpa.custom_label_3 || '',
        dpa.custom_label_4 || '',
      ].join('\t');
    });

    const tsv = [headers, ...rows].join('\n');

    return ok({
      body: tsv,
      headers: {
        'Content-Type': 'text/tab-separated-values; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    console.error('HTTP function error (facebookCatalogFeed):', err);
    return serverError({
      body: 'Error generating Facebook catalog feed',
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

// Facebook Custom Audience Export (Admin-only, secret-authenticated)
// URL: GET https://www.carolinafutons.com/_functions/facebookCustomAudience
// Returns hashed customer data for Custom Audience upload / Lookalike Audiences.
// Requires FB_AUDIENCE_SECRET header for authentication.
export async function get_facebookCustomAudience(request) {
  try {
    // Authenticate with secret key
    let audienceSecret;
    try {
      const { getSecret } = await import('wix-secrets-backend');
      audienceSecret = await getSecret('FB_AUDIENCE_SECRET');
    } catch (_) {
      // Secret not configured
    }

    const requestSecret = request.headers['x-fb-audience-secret'];

    if (!audienceSecret || !requestSecret || !timingSafeEqual(requestSecret, audienceSecret)) {
      return forbidden({
        body: JSON.stringify({ error: 'Unauthorized' }),
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await exportCustomerAudienceData();

    if (!result.success) {
      return serverError({
        body: JSON.stringify({ error: result.error || 'Export failed' }),
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return ok({
      body: JSON.stringify({
        schema: ['EMAIL', 'FN', 'LN', 'PHONE', 'CT', 'ST', 'ZIP', 'COUNTRY', 'VALUE'],
        data: result.customers.map(c => [
          c.email, c.fn, c.ln, c.phone, c.ct, c.st, c.zip, c.country, c.value,
        ]),
        total: result.customers.length,
      }),
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('HTTP function error (facebookCustomAudience):', err);
    return serverError({
      body: JSON.stringify({ error: 'Internal server error' }),
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Pinterest Product Catalog Feed
// URL: GET https://www.carolinafutons.com/_functions/pinterestProductFeed
// Configure in Pinterest Business > Catalogs as a data source
export async function get_pinterestProductFeed() {
  try {
    const SITE_URL = 'https://www.carolinafutons.com';
    const productItems = await fetchAllProducts();

    // Pinterest catalog TSV format
    const headers = ['id', 'title', 'description', 'link', 'image_link', 'price',
      'availability', 'brand', 'google_product_category', 'condition',
      'sale_price', 'product_type', 'additional_image_link'].join('\t');

    const rows = productItems.map(p => {
      const availability = p.inStock !== false ? 'in stock' : 'out of stock';
      const price = `${(p.price || 0).toFixed(2)} USD`;
      const salePrice = p.discountedPrice ? `${p.discountedPrice.toFixed(2)} USD` : '';
      const brand = detectBrandFromProduct(p);
      const description = stripHtmlSafe(p.description || '').replace(/[\t\n\r]/g, ' ').substring(0, 5000);
      const category = detectGoogleCategory(p);
      const productType = detectProductType(p);
      const imageUrl = getImageUrl(p.mainMedia);
      const additionalImages = (p.mediaItems || []).slice(1, 5)
        .map(m => getImageUrl(m.src || m)).filter(Boolean).join(',');

      return [
        p._id || '',
        (p.name || '').replace(/[\t\n\r]/g, ' '),
        description,
        `${SITE_URL}/product-page/${encodeURIComponent(p.slug)}`,
        imageUrl,
        price,
        availability,
        brand,
        category,
        'new',
        salePrice,
        productType,
        additionalImages,
      ].join('\t');
    });

    const tsv = [headers, ...rows].join('\n');

    return ok({
      body: tsv,
      headers: {
        'Content-Type': 'text/tab-separated-values; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    console.error('HTTP function error (pinterestProductFeed):', err);
    return serverError({
      body: 'Error generating Pinterest product feed',
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

// PWA Web App Manifest
// URL: GET https://www.carolinafutons.com/_functions/manifest
// Link in site header: <link rel="manifest" href="/_functions/manifest">
export function get_manifest() {
  const manifest = {
    name: 'Carolina Futons',
    short_name: 'CF Futons',
    description: 'Handcrafted futon frames, mattresses, Murphy beds & platform beds. Made in the USA.',
    start_url: '/',
    display: 'standalone',
    background_color: colors.sandBase,
    theme_color: colors.mountainBlue,
    orientation: 'any',
    categories: ['shopping', 'lifestyle'],
    icons: [
      { src: '/favicon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/favicon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  };

  return ok({
    body: JSON.stringify(manifest),
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}

// PWA Service Worker (EXPERIMENTAL — see STORY-010)
// Wix Velo SW support is undocumented and appears broken since Aug 2023.
// Kept for testing; do NOT register in production until Wix confirms support.
// URL: GET https://www.carolinafutons.com/_functions/serviceWorker
export function get_serviceWorker() {
  const CACHE_NAME = 'cf-v1';
  const OFFLINE_URL = '/offline';

  // Service worker source served as JavaScript
  const swCode = `
const CACHE_NAME = '${CACHE_NAME}';
const OFFLINE_URL = '${OFFLINE_URL}';
const PRECACHE_URLS = [
  '/',
  '/shop-main',
  '/futon-frames',
  '/mattresses',
  '/murphy-cabinet-beds',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(event.request).then((cached) => cached || caches.match(OFFLINE_URL))
      )
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
`.trim();

  return ok({
    body: swCode,
    headers: {
      'Content-Type': 'application/javascript',
      'Service-Worker-Allowed': '/',
      'Cache-Control': 'no-cache',
    },
  });
}

// Wishlist Price Drop & Back-in-Stock Alert Checker
// URL: GET https://www.carolinafutons.com/_functions/checkWishlistAlerts
// Schedule daily via Wix Automations webhook or external cron service.
// Pass X-Cron-Secret header for auth (set ALERT_CRON_KEY in Secrets Manager).
export async function get_checkWishlistAlerts(request) {
  try {
    const { getSecret } = await import('wix-secrets-backend');
    const cronKey = await getSecret('ALERT_CRON_KEY');
    const requestKey = request.headers?.['x-cron-secret'];

    if (!cronKey || !requestKey || !timingSafeEqual(requestKey, cronKey)) {
      return forbidden({
        body: JSON.stringify({ error: 'Unauthorized' }),
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Step 1: Record current price snapshots
    const snapshots = await recordPriceSnapshots();

    // Step 2: Check for price drops and back-in-stock events
    const alerts = await checkWishlistAlerts();

    return ok({
      body: JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        snapshotsRecorded: snapshots.recorded,
        priceDropAlerts: alerts.priceDropAlerts,
        backInStockAlerts: alerts.backInStockAlerts,
      }),
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('HTTP function error (checkWishlistAlerts):', err);
    return serverError({
      body: JSON.stringify({ error: 'Internal server error' }),
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ── Browse Recovery Cron ─────────────────────────────────────────────
// URL: GET https://www.carolinafutons.com/_functions/triggerBrowseRecoveryCron
// Schedule every 30 minutes via Wix Automations or external cron.
// Pass X-Cron-Secret header for auth (ALERT_CRON_KEY in Secrets Manager).
export async function get_triggerBrowseRecoveryCron(request) {
  try {
    const { getSecret } = await import('wix-secrets-backend');
    const cronKey = await getSecret('ALERT_CRON_KEY');
    const requestKey = request.headers?.['x-cron-secret'];

    if (!cronKey || !requestKey || !timingSafeEqual(requestKey, cronKey)) {
      return forbidden({
        body: JSON.stringify({ error: 'Unauthorized' }),
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await triggerBrowseRecovery();

    return ok({
      body: JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        triggered: result.triggered || 0,
        skipped: result.skipped || 0,
      }),
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('HTTP function error (triggerBrowseRecoveryCron):', err);
    return serverError({
      body: JSON.stringify({ error: 'Internal server error' }),
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ── Abandoned Cart Recovery Cron ────────────────────────────────────
// URL: GET https://www.carolinafutons.com/_functions/triggerCartRecoveryCron
// Schedule every 30 minutes via Wix Automations or external cron.
// Pass X-Cron-Secret header for auth (ALERT_CRON_KEY in Secrets Manager).
export async function get_triggerCartRecoveryCron(request) {
  try {
    const { getSecret } = await import('wix-secrets-backend');
    const cronKey = await getSecret('ALERT_CRON_KEY');
    const requestKey = request.headers?.['x-cron-secret'];

    if (!cronKey || !requestKey || !timingSafeEqual(requestKey, cronKey)) {
      return forbidden({
        body: JSON.stringify({ error: 'Unauthorized' }),
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await triggerAbandonedCartRecovery();

    return ok({
      body: JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        processed: result.processed || 0,
        emailsQueued: result.emailsQueued || 0,
      }),
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('HTTP function error (triggerCartRecoveryCron):', err);
    return serverError({
      body: JSON.stringify({ error: 'Internal server error' }),
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// robots.txt for SEO crawl control
// URL: GET https://www.carolinafutons.com/_functions/robots
// Add <meta name="robots"> or configure in Wix SEO settings to reference this
export function get_robots() {
  const robotsTxt = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /cart',
    'Disallow: /checkout',
    'Disallow: /thank-you',
    'Disallow: /login',
    'Disallow: /account',
    'Disallow: /search-results',
    'Allow: /_functions/productSitemap',
    'Allow: /_functions/blogSitemap',
    'Allow: /_functions/blogRssFeed',
    'Disallow: /_functions/',
    '',
    'Sitemap: https://www.carolinafutons.com/_functions/productSitemap',
    'Sitemap: https://www.carolinafutons.com/_functions/blogSitemap',
  ].join('\n');

  return ok({
    body: robotsTxt,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}

// ── Email Queue Processor Cron ────────────────────────────────────────
// URL: GET https://www.carolinafutons.com/_functions/processEmailQueueCron
// Schedule every 15-30 minutes via Wix Automations or external cron.
// Pass X-Cron-Secret header for auth (ALERT_CRON_KEY in Secrets Manager).
export async function get_processEmailQueueCron(request) {
  try {
    const { getSecret } = await import('wix-secrets-backend');
    const cronKey = await getSecret('ALERT_CRON_KEY');
    const requestKey = request.headers?.['x-cron-secret'];

    if (!cronKey || !requestKey || !timingSafeEqual(requestKey, cronKey)) {
      return forbidden({
        body: JSON.stringify({ error: 'Unauthorized' }),
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await processEmailQueue();

    return ok({
      body: JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        sent: result.sent || 0,
        failed: result.failed || 0,
        cancelled: result.cancelled || 0,
      }),
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('HTTP function error (processEmailQueueCron):', err);
    return serverError({
      body: JSON.stringify({ error: 'Internal server error' }),
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ── Re-engagement Cron ───────────────────────────────────────────────
// URL: GET https://www.carolinafutons.com/_functions/triggerReengagementCron
// Schedule daily via Wix Automations or external cron.
// Pass X-Cron-Secret header for auth (ALERT_CRON_KEY in Secrets Manager).
export async function get_triggerReengagementCron(request) {
  try {
    const { getSecret } = await import('wix-secrets-backend');
    const cronKey = await getSecret('ALERT_CRON_KEY');
    const requestKey = request.headers?.['x-cron-secret'];

    if (!cronKey || !requestKey || !timingSafeEqual(requestKey, cronKey)) {
      return forbidden({
        body: JSON.stringify({ error: 'Unauthorized' }),
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await triggerReengagement();

    return ok({
      body: JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        contacted: result.contacted || 0,
      }),
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('HTTP function error (triggerReengagementCron):', err);
    return serverError({
      body: JSON.stringify({ error: 'Internal server error' }),
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ── cf-amx: Winback Scanner Cron ───────────────────────────────────────
// URL: GET https://www.carolinafutons.com/_functions/scanAndTriggerWinbackCron
// Weekly Monday 10 AM EST via jobs.config. Also callable by external cron.
// Pass X-Cron-Secret header for auth (ALERT_CRON_KEY in Secrets Manager).
export async function get_scanAndTriggerWinbackCron(request) {
  try {
    const { getSecret } = await import('wix-secrets-backend');
    const cronKey = await getSecret('ALERT_CRON_KEY');
    const requestKey = request.headers?.['x-cron-secret'];

    if (!cronKey || !requestKey || !timingSafeEqual(requestKey, cronKey)) {
      return forbidden({
        body: JSON.stringify({ error: 'Unauthorized' }),
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await scanAndTriggerWinback();

    return ok({
      body: JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        scanned: result.scanned || 0,
        triggered: result.triggered || 0,
      }),
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('HTTP function error (scanAndTriggerWinbackCron):', err);
    return serverError({
      body: JSON.stringify({ error: 'Internal server error' }),
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ── Review Request Cron (cf-fsm) ──────────────────────────────────────
// URL: GET https://www.carolinafutons.com/_functions/runReviewRequestEmailsCron
// Fires review_request email sequence for orders placed 7 days ago (±1 day).
// Pass X-Cron-Secret header for auth (ALERT_CRON_KEY in Secrets Manager).
// Primary schedule is jobs.config `runReviewRequestEmails` (daily 10 AM EST).
// This HTTP endpoint is a manual/external trigger for the same logic.
export async function get_runReviewRequestEmailsCron(request) {
  try {
    const { getSecret } = await import('wix-secrets-backend');
    const cronKey = await getSecret('ALERT_CRON_KEY');
    const requestKey = request.headers?.['x-cron-secret'];

    if (!cronKey || !requestKey || !timingSafeEqual(requestKey, cronKey)) {
      return forbidden({
        body: JSON.stringify({ error: 'Unauthorized' }),
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await runReviewRequestEmails();

    return ok({
      body: JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        ordersScanned: result.ordersScanned || 0,
        triggered: result.triggered || 0,
        skipped: result.skipped || 0,
        failed: result.failed || 0,
      }),
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('HTTP function error (runReviewRequestEmailsCron):', err);
    return serverError({
      body: JSON.stringify({ error: 'Internal server error' }),
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ── Post-Purchase Care Cron ────────────────────────────────────────────
// URL: GET https://www.carolinafutons.com/_functions/processPostPurchaseCareCron
// Schedule daily via Wix Automations or external cron.
// Pass X-Cron-Secret header for auth (ALERT_CRON_KEY in Secrets Manager).
// Processes pending post-purchase care sequences (assembly follow-ups, review solicitations).
export async function get_processPostPurchaseCareCron(request) {
  try {
    const { getSecret } = await import('wix-secrets-backend');
    const cronKey = await getSecret('ALERT_CRON_KEY');
    const requestKey = request.headers?.['x-cron-secret'];

    if (!cronKey || !requestKey || !timingSafeEqual(requestKey, cronKey)) {
      return forbidden({
        body: JSON.stringify({ error: 'Unauthorized' }),
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Process the email queue (handles all sequences including post-purchase)
    const result = await processEmailQueue();

    return ok({
      body: JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        sent: result.sent || 0,
        failed: result.failed || 0,
        cancelled: result.cancelled || 0,
      }),
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('HTTP function error (processPostPurchaseCareCron):', err);
    return serverError({
      body: JSON.stringify({ error: 'Internal server error' }),
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ── Content Schedule Processor Cron ────────────────────────────────────
// URL: GET https://www.carolinafutons.com/_functions/processContentScheduleCron
// Schedule every 30 minutes via Wix Automations or external cron.
// Pass X-Cron-Secret header for auth (CONTENT_CRON_KEY in Secrets Manager).
export async function get_processContentScheduleCron(request) {
  try {
    const { getSecret } = await import('wix-secrets-backend');
    const cronKey = await getSecret('CONTENT_CRON_KEY');
    const requestKey = request.headers?.['x-cron-secret'];

    if (!cronKey || !requestKey || !timingSafeEqual(requestKey, cronKey)) {
      return forbidden({
        body: JSON.stringify({ error: 'Unauthorized' }),
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await processContentSchedule(requestKey);

    return ok({
      body: JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        processed: result.processed || 0,
        failed: result.failed || 0,
        skipped: result.skipped || 0,
      }),
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('HTTP function error (processContentScheduleCron):', err);
    return serverError({
      body: JSON.stringify({ error: 'Internal server error' }),
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ── Campaign Analytics Dashboard ──────────────────────────────────────
// URL: GET https://www.carolinafutons.com/_functions/campaignAnalytics
// Admin dashboard endpoint for email campaign performance metrics.
// Pass X-Cron-Secret header for auth (ALERT_CRON_KEY in Secrets Manager).
// Optional query param: ?days=30 (lookback window, default 30)
export async function get_campaignAnalytics(request) {
  try {
    const { getSecret } = await import('wix-secrets-backend');
    const cronKey = await getSecret('ALERT_CRON_KEY');
    const requestKey = request.headers?.['x-cron-secret'];

    if (!cronKey || !requestKey || !timingSafeEqual(requestKey, cronKey)) {
      return forbidden({
        body: JSON.stringify({ error: 'Unauthorized' }),
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const days = parseInt(request.query?.days, 10) || 30;
    const result = await getCampaignAnalytics(days);

    if (!result.success) {
      return serverError({
        body: JSON.stringify({
          status: 'error',
          timestamp: new Date().toISOString(),
          error: result.error || 'Analytics query failed',
        }),
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return ok({
      body: JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        ...result,
      }),
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('HTTP function error (campaignAnalytics):', err);
    return serverError({
      body: JSON.stringify({ error: 'Internal server error' }),
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ── Feed helper functions ─────────────────────────────────────────────

function detectBrandFromProduct(product) {
  const name = (product.name || '').toLowerCase();
  const collections = (product.collections || []).map(c => (typeof c === 'string' ? c : c.id || '').toLowerCase());

  if (collections.some(c => c.includes('wall-hugger'))) return 'Strata Furniture';
  if (collections.some(c => c.includes('unfinished'))) return 'KD Frames';
  if (collections.some(c => c.includes('mattress'))) return 'Otis Bed';
  if (name.includes('murphy') || name.includes('cabinet bed')) return 'Arason Enterprises';
  return 'Night & Day Furniture';
}

function detectGoogleCategory(product) {
  const collections = (product.collections || []).map(c => (typeof c === 'string' ? c : c.id || '').toLowerCase());

  if (collections.some(c => c.includes('murphy'))) return '436 - Furniture > Beds & Accessories > Beds';
  if (collections.some(c => c.includes('mattress'))) return '2462 - Furniture > Beds & Accessories > Mattresses';
  if (collections.some(c => c.includes('platform'))) return '436 - Furniture > Beds & Accessories > Beds';
  if (collections.some(c => c.includes('casegood') || c.includes('accessor'))) return '6356 - Furniture > Bedroom Furniture';
  return '4295 - Furniture > Futons';
}

function detectProductType(product) {
  const collections = (product.collections || []).map(c => (typeof c === 'string' ? c : c.id || '').toLowerCase());

  if (collections.some(c => c.includes('murphy'))) return 'Bedroom > Murphy Cabinet Beds';
  if (collections.some(c => c.includes('mattress'))) return 'Bedroom > Futon Mattresses';
  if (collections.some(c => c.includes('platform'))) return 'Bedroom > Platform Beds';
  if (collections.some(c => c.includes('casegood'))) return 'Bedroom > Casegoods & Accessories';
  return 'Bedroom > Futon Frames';
}


// ── Stamped.io Review Webhook ─────────────────────────────────────────
// URL: POST https://www.carolinafutons.com/_functions/stampedWebhook
// Configure in Stamped.io > Settings > Webhooks with STAMPED_WEBHOOK_SECRET.
// Ingests new reviews into the ProductReviews moderation queue.
// Reviews with 4+ stars and no profanity are auto-approved.

/**
 * @function post_stampedWebhook
 * @param {Object} request - Wix HTTP request object.
 * @returns {Promise<Object>} HTTP response.
 */
export async function post_stampedWebhook(request) {
  try {
    let webhookSecret;
    try {
      const { getSecret } = await import('wix-secrets-backend');
      webhookSecret = await getSecret('STAMPED_WEBHOOK_SECRET');
    } catch (err) { console.error('[http-functions] stampedWebhook: failed to fetch STAMPED_WEBHOOK_SECRET:', err); }

    const requestSecret = request.headers['x-stamped-secret'] || request.headers['x-stamped-webhook-secret'];
    if (!webhookSecret || !requestSecret || !timingSafeEqual(requestSecret, webhookSecret)) {
      return forbidden({
        body: JSON.stringify({ error: 'Unauthorized' }),
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let payload;
    try {
      const bodyText = await request.body.text();
      payload = JSON.parse(bodyText);
    } catch (_) {
      return badRequest({
        body: JSON.stringify({ error: 'Invalid JSON body' }),
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const reviewData = payload.review || payload;
    const event = payload.event || 'review.created';

    if (!reviewData || !reviewData.productId) {
      return badRequest({
        body: JSON.stringify({ error: 'Missing required fields: productId' }),
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { ingestStampedReview } = await import('backend/reviewModeration.web');
    const result = await ingestStampedReview(reviewData);

    if (!result.success) {
      return serverError({
        body: JSON.stringify({ error: result.error || 'Review ingestion failed' }),
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return ok({
      body: JSON.stringify({ success: true, reviewId: result.reviewId, status: result.status, event }),
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[http-functions] stampedWebhook error:', err);
    return serverError({
      body: JSON.stringify({ error: 'Internal server error' }),
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ── Klaviyo Webhook Endpoint ──────────────────────────────────────────
// URL: POST https://www.carolinafutons.com/_functions/klaviyoWebhook
// Configure in Klaviyo > Settings > Webhooks with the KLAVIYO_WEBHOOK_SECRET.
// Handles subscriber events (unsubscribe, bounce, etc.) from Klaviyo.

/**
 * @function post_klaviyoWebhook
 * @param {Object} request - Wix HTTP request object.
 * @returns {Promise<Object>} HTTP response.
 */
export async function post_klaviyoWebhook(request) {
  try {
    // Authenticate webhook
    let webhookSecret;
    try {
      const { getSecret } = await import('wix-secrets-backend');
      webhookSecret = await getSecret('KLAVIYO_WEBHOOK_SECRET');
    } catch (_) {
      // Secret not configured
    }

    const requestSecret = request.headers['x-klaviyo-webhook-secret'];

    if (!webhookSecret || !requestSecret || !timingSafeEqual(requestSecret, webhookSecret)) {
      return forbidden({
        body: JSON.stringify({ error: 'Unauthorized' }),
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse body
    let payload;
    try {
      const bodyText = await request.body.text();
      payload = JSON.parse(bodyText);
    } catch (_) {
      return badRequest({
        body: JSON.stringify({ error: 'Invalid JSON body' }),
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate required fields
    if (!payload.type || typeof payload.type !== 'string') {
      return badRequest({
        body: JSON.stringify({ error: 'Missing required field: type' }),
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!payload.email || typeof payload.email !== 'string') {
      return badRequest({
        body: JSON.stringify({ error: 'Missing required field: email' }),
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const cleanEmail = sanitize(payload.email, 254).toLowerCase().trim();
    if (!validateEmail(cleanEmail)) {
      return badRequest({
        body: JSON.stringify({ error: 'Invalid email format' }),
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Route by event type
    if (payload.type === 'unsubscribed') {
      const existing = await wixData.query('NewsletterSubscribers')
        .eq('email', cleanEmail)
        .find();

      if (existing.items.length > 0) {
        const record = existing.items[0];
        await wixData.update('NewsletterSubscribers', {
          ...record,
          status: 'unsubscribed',
          unsubscribedAt: new Date(),
        });
      }
    } else if (payload.type === 'email_clicked' && payload.campaignId && typeof payload.campaignId === 'string') {
      const { markABConversion } = await import('backend/emailABService.web');
      await markABConversion(cleanEmail, sanitize(payload.campaignId, 50));
    }
    // Unknown event types are acknowledged without action

    return ok({
      body: JSON.stringify({ status: 'ok', received: payload.type }),
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('HTTP function error (klaviyoWebhook):', err);
    return serverError({
      body: JSON.stringify({ error: 'Internal server error' }),
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ── Sitemap XML ──────────────────────────────────────────────────────
// URL: GET https://www.carolinafutons.com/_functions/sitemapXml
export async function get_sitemapXml() {
  try {
    const products = await fetchAllProducts();
    const sitemapData = getSitemapData(products);
    const xml = buildSitemapXml(sitemapData);

    return ok({
      body: xml,
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    console.error('HTTP function error (sitemapXml):', err);
    return serverError({
      body: 'Error generating sitemap',
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

// ── Loyalty Member Endpoint ──────────────────────────────────────────
// URL: GET https://www.carolinafutons.com/_functions/loyalty/{memberId}
// Returns loyalty account info for the authenticated member.
// IDOR guard: authenticated member must own the requested memberId.
// Tier logic: shared via backend/utils/loyaltyData (plain module, no webMethod).

export async function get_loyalty(request) {
  const json = (obj) => JSON.stringify(obj);
  const jsonHeaders = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  const memberId = request.path && request.path[0];

  try {
    if (!memberId) {
      return badRequest({ body: json({ error: 'memberId is required' }), headers: jsonHeaders });
    }

    let member;
    try {
      member = await currentMember.getMember();
    } catch (err) {
      console.error(`HTTP function error (loyalty): getMember() failed for memberId=${memberId}:`, err);
      return serverError({ body: json({ error: 'Internal server error' }), headers: jsonHeaders });
    }
    if (!member) {
      return unauthorized({ body: json({ error: 'Authentication required' }), headers: jsonHeaders });
    }
    if (member._id !== memberId) {
      return forbidden({ body: json({ error: 'Access denied' }), headers: jsonHeaders });
    }

    const account = await accounts.getMyAccount();
    if (!account) {
      console.error(`HTTP function error (loyalty): no loyalty account for memberId=${memberId}`);
      return notFound({ body: json({ error: 'Loyalty account not found' }), headers: jsonHeaders });
    }

    const points = account.points ? account.points.balance : 0;
    const tier = resolveTierFromPoints(points);

    let rewards = [];
    try {
      const { rewards: rewardList } = await loyaltyRewards.listRewards();
      rewards = (rewardList || []).map((r) => ({
        _id: r._id,
        name: r.name,
        pointCost: r.pointCost,
      }));
    } catch (err) {
      console.error(`HTTP function error (loyalty): listRewards() failed for memberId=${memberId}:`, err);
      // Degrade gracefully — return account data with empty rewards
    }

    return ok({
      body: json({
        memberId,
        points,
        tier: tier.name,
        nextTierAt: tier.next,
        rewards,
      }),
      headers: jsonHeaders,
    });
  } catch (err) {
    console.error(`HTTP function error (loyalty): memberId=${memberId || 'unknown'}:`, err);
    return serverError({ body: json({ error: 'Internal server error' }), headers: jsonHeaders });
  }
}

// ── robots.txt ───────────────────────────────────────────────────────
// URL: GET https://www.carolinafutons.com/_functions/robotsTxt
export function get_robotsTxt() {
  try {
    const content = getRobotsTxtContent();
    return ok({
      body: content,
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err) {
    console.error('HTTP function error (robotsTxt):', err);
    return serverError({
      body: 'Error generating robots.txt',
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

// ── Topic Cluster ─────────────────────────────────────────────────────
// URL: GET https://www.carolinafutons.com/_functions/topicCluster/{slug}
//
// Note: topicClusters.web.js exports are wrapped in webMethod() — Wix does not
// allow HTTP function handlers to invoke webMethods at runtime (same platform
// constraint as blogRssFeed). Cluster data is sourced from the shared
// backend/utils/topicClusterData module instead.
export function get_topicCluster(request) {
  try {
    const rawSlug = (request && Array.isArray(request.path) && request.path[0]) || '';
    const slug = validateSlug(rawSlug);

    if (!slug) {
      return badRequest({
        body: JSON.stringify({ success: false, error: 'Slug is required.' }),
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const cluster = CLUSTERS[slug];
    if (!cluster) {
      return notFound({
        body: JSON.stringify({ success: false, error: 'Topic cluster not found.', cluster: null }),
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const spokePages = Array.isArray(cluster.spokePages)
      ? cluster.spokePages.map(sp => ({ ...sp, url: `${SITE_URL}/buying-guides/${sp.slug}` }))
      : [];
    const data = {
      success: true,
      slug,
      topic: cluster.topic,
      pillarContent: cluster.pillarContent || '',
      internalLinks: Array.isArray(cluster.internalLinks) ? cluster.internalLinks : [],
      spokePages,
      cluster: {
        pillarSlug: cluster.pillarSlug,
        pillarTitle: cluster.pillarTitle,
        pillarUrl: `${SITE_URL}/buying-guides/${cluster.pillarSlug}`,
        topic: cluster.topic,
        keywords: cluster.keywords,
        spokePages,
        spokeCount: spokePages.length,
      },
    };

    return ok({
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    console.error('HTTP function error (topicCluster):', err.name, err.message, err);
    return serverError({
      body: JSON.stringify({ success: false, error: 'Failed to load topic cluster.' }),
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
// ── Referral Program Endpoints ────────────────────────────────────────
// GET  /_functions/generateReferralLink — requires auth
// POST /_functions/trackReferral — requires auth (prevents fraud)

const REFERRAL_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * @function get_generateReferralLink
 * @returns {Promise<Object>} { referralCode, shareUrl, stats }
 */
export async function get_generateReferralLink() {
  try {
    const member = await currentMember.getMember();
    if (!member) {
      return response({
        status: 401,
        body: JSON.stringify({ error: 'Authentication required' }),
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const memberId = member._id;

    // Reuse existing referral code if present
    const existing = await wixData.query('Referrals')
      .eq('referrerMemberId', memberId)
      .find();

    let referralCode;
    if (existing.items.length > 0) {
      referralCode = existing.items[0].referralCode;
    } else {
      referralCode = Array.from({ length: 8 }, () =>
        REFERRAL_CHARSET[Math.floor(Math.random() * REFERRAL_CHARSET.length)]
      ).join('');
      await wixData.insert('Referrals', {
        referrerMemberId: memberId,
        referralCode,
        status: 'pending',
        refereeMemberId: '',
      });
    }

    // Compute stats
    const allReferrals = await wixData.query('Referrals')
      .eq('referrerMemberId', memberId)
      .ne('status', 'pending')
      .find();

    const pendingCredits = await wixData.query('ReferralCredits')
      .eq('memberId', memberId)
      .eq('status', 'pending')
      .find();

    const availableCredits = await wixData.query('ReferralCredits')
      .eq('memberId', memberId)
      .eq('status', 'available')
      .find();

    const pendingRewards = pendingCredits.items.reduce((sum, c) => sum + (c.amount || 0), 0);
    const earnedRewards = availableCredits.items.reduce((sum, c) => sum + (c.amount || 0), 0);
    const shareUrl = `https://carolinafutons.com/?ref=${referralCode}`;

    return ok({
      body: JSON.stringify({
        referralCode,
        shareUrl,
        stats: { totalReferrals: allReferrals.totalCount, pendingRewards, earnedRewards },
      }),
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('HTTP function error (generateReferralLink):', err);
    return serverError({
      body: JSON.stringify({ error: 'Internal server error' }),
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * @function post_trackReferral
 * @param {Object} request - Wix HTTP request object. Body: { referralCode }
 * @returns {Promise<Object>} { tracked, referrerId }
 *
 * Requires authentication. newMemberId is taken from the authenticated member
 * to prevent referral fraud (users cannot claim referrals on behalf of others).
 */
export async function post_trackReferral(request) {
  try {
    // Auth required — prevents unauthenticated users from forging newMemberId
    const member = await currentMember.getMember();
    if (!member) {
      return response({
        status: 401,
        body: JSON.stringify({ error: 'Authentication required' }),
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const newMemberId = member._id;

    // Parse body
    let body;
    try {
      body = await request.body.json();
    } catch (_) {
      return badRequest({
        body: JSON.stringify({ error: 'Invalid JSON body' }),
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { referralCode } = body;
    if (!referralCode || typeof referralCode !== 'string') {
      return badRequest({
        body: JSON.stringify({ error: 'referralCode is required' }),
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const cleanCode = sanitize(String(referralCode), 20);

    // Find referral by code
    const result = await wixData.query('Referrals')
      .eq('referralCode', cleanCode)
      .find();

    if (!result.items.length) {
      return badRequest({
        body: JSON.stringify({ error: 'Invalid referral code' }),
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const referral = result.items[0];

    // Prevent self-referral
    if (referral.referrerMemberId === newMemberId) {
      return badRequest({
        body: JSON.stringify({ error: 'Self-referral not allowed' }),
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Prevent referral hijacking — member cannot apply a second referral code
    const existingAttribution = await wixData.query('Referrals')
      .eq('refereeMemberId', newMemberId)
      .ne('status', 'pending')
      .find();
    if (existingAttribution.items.length > 0) {
      return response({
        status: 409,
        body: JSON.stringify({ error: 'Member already has a referral attribution' }),
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Prevent overwriting an already-claimed referral (any member)
    if (referral.status !== 'pending') {
      return response({
        status: 409,
        body: JSON.stringify({ error: 'Referral already attributed' }),
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await wixData.update('Referrals', {
      ...referral,
      refereeMemberId: newMemberId,
      status: 'signed_up',
    });

    return ok({
      body: JSON.stringify({ tracked: true, referrerId: referral.referrerMemberId }),
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('HTTP function error (trackReferral):', err);
    return serverError({
      body: JSON.stringify({ error: 'Internal server error' }),
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ── Bundle Deals API ─────────────────────────────────────────────────
//
// GET  /_functions/bundles          → list all active bundles
// GET  /_functions/bundles/{slug}   → single bundle detail
// POST /_functions/addBundleToCart  → add bundle to cart + auto-apply coupon

/**
 * GET /_functions/bundles
 *   Lists all active bundles.
 *
 * GET /_functions/bundles?slug=<slug>
 *   Returns a single bundle by slug (via query param — Wix does not support
 *   path-segment routing for named HTTP functions).
 */
export async function get_bundles(request) {
  const JSON_HEADERS = { 'Content-Type': 'application/json' };
  try {
    const slug = request.path && request.path[0];
    if (slug) {
      const result = await getBundleBySlug(slug);
      if (!result.success) {
        return serverError({ body: JSON.stringify({ error: result.error || 'Server error' }), headers: JSON_HEADERS });
      }
      if (!result.bundle) {
        return notFound({ body: JSON.stringify({ error: 'Bundle not found' }), headers: JSON_HEADERS });
      }
      return ok({ body: JSON.stringify(result.bundle), headers: JSON_HEADERS });
    }

    const result = await listBundles();
    if (!result.success) {
      return serverError({ body: JSON.stringify({ error: 'Failed to load bundles' }), headers: JSON_HEADERS });
    }
    return ok({ body: JSON.stringify(result.bundles), headers: JSON_HEADERS });
  } catch (err) {
    console.error('HTTP function error (get_bundles):', err);
    return serverError({ body: JSON.stringify({ error: 'Internal server error' }), headers: JSON_HEADERS });
  }
}

/**
 * POST /_functions/addBundleToCart
 *
 * Body: { "slug": "complete-futon-set" }
 *
 * Adds all bundle products to the visitor's cart and auto-applies the
 * bundle coupon code. All pricing is derived from CMS — no client values used.
 */
export async function post_addBundleToCart(request) {
  const JSON_HEADERS = { 'Content-Type': 'application/json' };
  try {
    let body;
    try {
      const bodyText = await request.body.text();
      body = JSON.parse(bodyText);
    } catch (_) {
      return badRequest({ body: JSON.stringify({ error: 'Invalid JSON body' }), headers: JSON_HEADERS });
    }

    if (!body.slug || typeof body.slug !== 'string') {
      return badRequest({ body: JSON.stringify({ error: 'Missing required field: slug' }), headers: JSON_HEADERS });
    }

    const result = await addBundleToCart(body.slug);

    if (!result.success) {
      if (result.errorCode === 'BUNDLE_NOT_FOUND') {
        return notFound({ body: JSON.stringify(result), headers: JSON_HEADERS });
      }
      return badRequest({ body: JSON.stringify(result), headers: JSON_HEADERS });
    }

    return ok({ body: JSON.stringify(result), headers: JSON_HEADERS });
  } catch (err) {
    console.error('HTTP function error (addBundleToCart):', err);
    return serverError({ body: JSON.stringify({ error: 'Internal server error' }), headers: JSON_HEADERS });
  }
}

// ── Product Q&A HTTP Endpoints ───────────────────────────────────────

/**
 * @function get_productQA
 * @route GET /_functions/productQA?productId=X[&page=1][&pageSize=10]
 * Returns approved Q&A pairs for a product. Public, no auth required.
 */
export async function get_productQA(request) {
  const JSON_HEADERS = { 'Content-Type': 'application/json' };
  try {
    const productId = request.query?.productId;
    if (!productId || typeof productId !== 'string') {
      return badRequest({ body: JSON.stringify({ error: 'Missing required query param: productId' }), headers: JSON_HEADERS });
    }

    const page = Number(request.query?.page) || 1;
    const pageSize = Number(request.query?.pageSize) || 10;

    const { getProductQuestions } = await import('backend/productQA.web');
    const result = await getProductQuestions(productId, { page, pageSize, answeredOnly: true });

    if (!result.success) {
      return serverError({ body: JSON.stringify({ error: result.error || 'Failed to load questions' }), headers: JSON_HEADERS });
    }

    return ok({ body: JSON.stringify(result.data), headers: JSON_HEADERS });
  } catch (err) {
    console.error('HTTP function error (get_productQA):', err);
    return serverError({ body: JSON.stringify({ error: 'Internal server error' }), headers: JSON_HEADERS });
  }
}

/**
 * @function post_submitQuestion
 * @route POST /_functions/submitQuestion
 * Body: { productId: string, question: string, name?: string }
 * Saves question as pending and notifies site owner.
 * Public — no member auth required (uses name from body, not session).
 */
export async function post_submitQuestion(request) {
  const JSON_HEADERS = { 'Content-Type': 'application/json' };
  try {
    let body;
    try {
      body = await request.body.json();
    } catch (_) {
      return badRequest({ body: JSON.stringify({ error: 'Invalid JSON body' }), headers: JSON_HEADERS });
    }

    const productId = sanitize(String(body?.productId || ''), 50);
    const questionText = sanitize(String(body?.question || ''), 500);
    const memberName = sanitize(String(body?.name || 'Customer'), 50) || 'Customer';
    const email = sanitize(String(body?.email || ''), 254);

    if (!productId) {
      return badRequest({ body: JSON.stringify({ error: 'Missing required field: productId' }), headers: JSON_HEADERS });
    }
    if (!questionText || questionText.length < 10) {
      return badRequest({ body: JSON.stringify({ error: 'Question must be at least 10 characters' }), headers: JSON_HEADERS });
    }
    if (!email) {
      return badRequest({ body: JSON.stringify({ error: 'Missing required field: email' }), headers: JSON_HEADERS });
    }

    const { insertGuestQuestion } = await import('backend/productQA.web');
    const result = await insertGuestQuestion({ productId, question: questionText, memberName, email });

    if (!result.success) {
      return badRequest({ body: JSON.stringify({ error: result.error || 'Failed to submit question' }), headers: JSON_HEADERS });
    }

    return ok({ body: JSON.stringify({ success: true, data: result.data }), headers: JSON_HEADERS });
  } catch (err) {
    console.error('HTTP function error (post_submitQuestion):', err);
    return serverError({ body: JSON.stringify({ error: 'Internal server error' }), headers: JSON_HEADERS });
  }
}

/**
 * @function post_answerQuestion
 * @route POST /_functions/answerQuestion
 * Header: x-admin-key — must match QA_ADMIN_KEY secret.
 * Body: { questionId: string, answer: string }
 * Sets answer and marks question as approved.
 */
export async function post_answerQuestion(request) {
  const JSON_HEADERS = { 'Content-Type': 'application/json' };
  try {
    // Admin key authentication
    let adminKey;
    try {
      const { getSecret } = await import('wix-secrets-backend');
      adminKey = await getSecret('QA_ADMIN_KEY');
    } catch (_) {
      // Secret not configured — deny
    }

    const requestKey = request.headers?.['x-admin-key'];
    if (!adminKey || !requestKey || !timingSafeEqual(requestKey, adminKey)) {
      return forbidden({ body: JSON.stringify({ error: 'Unauthorized' }), headers: JSON_HEADERS });
    }

    let body;
    try {
      body = await request.body.json();
    } catch (_) {
      return badRequest({ body: JSON.stringify({ error: 'Invalid JSON body' }), headers: JSON_HEADERS });
    }

    const questionId = String(body?.questionId || '');
    const answerText = String(body?.answer || '');

    if (!questionId) {
      return badRequest({ body: JSON.stringify({ error: 'Missing required field: questionId' }), headers: JSON_HEADERS });
    }
    if (!answerText || answerText.length < 5) {
      return badRequest({ body: JSON.stringify({ error: 'Answer must be at least 5 characters' }), headers: JSON_HEADERS });
    }

    const { answerQuestion } = await import('backend/productQA.web');
    const result = await answerQuestion(questionId, answerText);

    if (!result.success) {
      if (result.error === 'Question not found') {
        return notFound({ body: JSON.stringify({ error: 'Question not found' }), headers: JSON_HEADERS });
      }
      return badRequest({ body: JSON.stringify({ error: result.error || 'Failed to answer question' }), headers: JSON_HEADERS });
    }

    return ok({ body: JSON.stringify({ success: true }), headers: JSON_HEADERS });
  } catch (err) {
    console.error('HTTP function error (post_answerQuestion):', err);
    return serverError({ body: JSON.stringify({ error: 'Internal server error' }), headers: JSON_HEADERS });
  }
}

/**
 * @function post_gamificationEvent
 * @route POST /_functions/gamificationEvent
 * Auth: Wix member session (currentMember.getMember()).
 * Body: { eventName: string, memberId: string, payload?: object }
 * Rate limit: 20 events per minute per memberId.
 * Returns: { success, newTotal, tierChanged, newTier }
 *
 * Used by the mobile app to POST gamification events from native UI.
 * memberId in the request body must match the authenticated member's _id
 * to prevent one member from posting events on behalf of another.
 */
export async function post_gamificationEvent(request) {
  const JSON_HEADERS = { 'Content-Type': 'application/json' };
  try {
    const member = await currentMember.getMember();
    if (!member) {
      return unauthorized({ body: JSON.stringify({ error: 'Authentication required' }), headers: JSON_HEADERS });
    }

    let body;
    try {
      body = await request.body.json();
    } catch (_) {
      return badRequest({ body: JSON.stringify({ error: 'Invalid JSON body' }), headers: JSON_HEADERS });
    }

    const eventName = sanitize(String(body?.eventName || ''), 100).trim();
    const memberId = String(body?.memberId || '').trim();
    if (!eventName) {
      return badRequest({ body: JSON.stringify({ error: 'Missing required field: eventName' }), headers: JSON_HEADERS });
    }
    if (!memberId) {
      return badRequest({ body: JSON.stringify({ error: 'Missing required field: memberId' }), headers: JSON_HEADERS });
    }

    // IDOR guard: memberId must match the authenticated member
    if (memberId !== member._id) {
      return unauthorized({ body: JSON.stringify({ error: 'memberId does not match authenticated member' }), headers: JSON_HEADERS });
    }

    const { checkGamificationRateLimit } = await import('backend/utils/gamificationRateLimit');
    const rateLimitResult = await checkGamificationRateLimit(memberId, eventName);
    if (!rateLimitResult.allowed) {
      return response({ status: 429, body: JSON.stringify({ error: 'Rate limit exceeded — try again in a moment' }), headers: JSON_HEADERS });
    }

    const payload = body?.payload && typeof body.payload === 'object' && !Array.isArray(body.payload) ? body.payload : {};
    const result = await receiveGamificationEvent(eventName, payload, memberId);

    if (!result.success) {
      return serverError({ body: JSON.stringify({ error: result.error || 'Failed to process event' }), headers: JSON_HEADERS });
    }

    return ok({
      body: JSON.stringify({
        success: true,
        newTotal: result.newTotal,
        tierChanged: result.tierChanged,
        newTier: result.newTier,
      }),
      headers: JSON_HEADERS,
    });
  } catch (err) {
    console.error('HTTP function error (post_gamificationEvent):', err);
    return serverError({ body: JSON.stringify({ error: 'Internal server error' }), headers: JSON_HEADERS });
  }
}

// ── Active Challenges Endpoint ────────────────────────────────────────────────
// URL: GET https://www.carolinafutons.com/_functions/activeChallenges?memberId=X
// Returns active challenges with member progress for the authenticated member.
// IDOR guard: authenticated member must own the requested memberId.
// Rate limit: 10 calls/hr per member (shared with webMethod in-memory store).

export async function get_activeChallenges(request) {
  const json = (obj) => JSON.stringify(obj);
  const jsonHeaders = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  const memberId = request.query && request.query.memberId;

  try {
    if (!memberId) {
      return badRequest({ body: json({ error: 'memberId is required' }), headers: jsonHeaders });
    }

    let member;
    try {
      member = await currentMember.getMember();
    } catch (err) {
      console.error(`HTTP function error (activeChallenges): getMember() failed for memberId=${memberId}:`, err);
      return serverError({ body: json({ error: 'Internal server error' }), headers: jsonHeaders });
    }
    if (!member) {
      return unauthorized({ body: json({ error: 'Authentication required' }), headers: jsonHeaders });
    }
    if (member._id !== memberId) {
      return forbidden({ body: json({ error: 'Access denied' }), headers: jsonHeaders });
    }

    const result = await _getActiveChallengesWebMethod(memberId);

    if (result.status === 429) {
      return response({ status: 429, body: json({ error: 'Rate limit exceeded' }), headers: jsonHeaders });
    }

    // cf-gkgo: generalise error mapping beyond literal `internal_error`.
    // Previously only `internal_error` returned 503; any other error string
    // (e.g. `auth_required`, future error codes) silently returned 200 with an
    // empty list — the same silent-failure pattern cf-9lp.1 was meant to fix.
    //
    // Strategy: map known client-class errors to their proper HTTP status, and
    // treat every other error code (including unknown ones) as 503 fail-loud.
    // Better to surface a server-class status for an unmapped error and force
    // the caller to retry / engineer to investigate, than to hide it as 200.
    if (result.error === 'auth_required') {
      // Permissions.SiteMember should have rejected the call earlier, but if a
      // stale session lets it through the webMethod surfaces this code (cf-1y7).
      return unauthorized({ body: json(result), headers: jsonHeaders });
    }
    if (result.error) {
      // internal_error (cf-tlt), db_error, timeout, or any future server-class code.
      // Body still emits the original envelope for diagnostics; callers should
      // branch on status.
      return response({ status: 503, body: json(result), headers: jsonHeaders });
    }

    return ok({ body: json(result), headers: jsonHeaders });
  } catch (err) {
    console.error(`HTTP function error (activeChallenges): memberId=${memberId || 'unknown'}:`, err);
    return serverError({ body: json({ error: 'Internal server error' }), headers: jsonHeaders });
  }
}

// ── Challenge Progress Endpoint ────────────────────────────────────────────────
// URL: POST https://www.carolinafutons.com/_functions/challengeProgress
// Records one unit of progress for the authenticated member on a challenge.
// IDOR guard: authenticated member must own the requested memberId.
// Rate limit: 20 calls/hr per member (shared with webMethod in-memory store).

export async function post_challengeProgress(request) {
  const json = (obj) => JSON.stringify(obj);
  const jsonHeaders = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

  try {
    let body;
    try {
      body = await request.body.json();
    } catch (_) {
      return badRequest({ body: json({ error: 'Invalid JSON body' }), headers: jsonHeaders });
    }

    const memberId = String(body?.memberId || '').trim();
    const challengeId = String(body?.challengeId || '').trim();

    if (!memberId) {
      return badRequest({ body: json({ error: 'memberId is required' }), headers: jsonHeaders });
    }
    if (!challengeId) {
      return badRequest({ body: json({ error: 'challengeId is required' }), headers: jsonHeaders });
    }

    let member;
    try {
      member = await currentMember.getMember();
    } catch (err) {
      console.error(`HTTP function error (challengeProgress): getMember() failed for memberId=${memberId}:`, err);
      return serverError({ body: json({ error: 'Internal server error' }), headers: jsonHeaders });
    }
    if (!member) {
      return unauthorized({ body: json({ error: 'Authentication required' }), headers: jsonHeaders });
    }
    if (member._id !== memberId) {
      return forbidden({ body: json({ error: 'Access denied' }), headers: jsonHeaders });
    }

    const result = await _recordChallengeProgressWebMethod({ memberId, challengeId });

    if (result.status === 429) {
      return response({ status: 429, body: json({ error: 'Rate limit exceeded' }), headers: jsonHeaders });
    }
    if (!result.success) {
      return badRequest({ body: json({ error: result.error || 'Challenge progress failed' }), headers: jsonHeaders });
    }

    return ok({ body: json(result), headers: jsonHeaders });
  } catch (err) {
    console.error('HTTP function error (challengeProgress):', err);
    return serverError({ body: json({ error: 'Internal server error' }), headers: jsonHeaders });
  }
}

// ── Rate Limit TTL Cleanup Cron ───────────────────────────────────────────────
// URL: GET https://www.carolinafutons.com/_functions/cleanupRateLimitCron
// Schedule daily via Wix Automations or external cron.
// Pass X-Cron-Secret header for auth (ALERT_CRON_KEY in Secrets Manager).
// Prunes stale records (windowStart older than 24h) from both gamification
// rate-limit collections to prevent unbounded table growth.
export async function get_cleanupRateLimitCron(request) {
  const JSON_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  try {
    const { getSecret } = await import('wix-secrets-backend');
    const cronKey = await getSecret('ALERT_CRON_KEY');
    const requestKey = request.headers?.['x-cron-secret'];
    if (!cronKey || !requestKey || !timingSafeEqual(requestKey, cronKey)) {
      return forbidden({
        body: JSON.stringify({ error: 'Unauthorized' }),
        headers: JSON_HEADERS,
      });
    }

    const TTL_MS = 24 * 3600_000;
    const cutoff = new Date(Date.now() - TTL_MS);
    const BATCH = 100;

    async function pruneCollection(collection) {
      let totalRemoved = 0;
      // Up to 5 passes × 100 = 500 records per cron run (avoids timeout on large backlogs)
      for (let pass = 0; pass < 5; pass++) {
        const stale = await wixData
          .query(collection)
          .lt('windowStart', cutoff)
          .limit(BATCH)
          .find({ suppressAuth: true });
        if (stale.items.length === 0) break;
        const ids = stale.items.map(item => item._id);
        await wixData.bulkRemove(collection, ids, { suppressAuth: true });
        totalRemoved += stale.items.length;
        if (stale.items.length < BATCH) break;
      }
      return totalRemoved;
    }

    const [actionPruned, dailyPruned] = await Promise.all([
      pruneCollection('GamificationActionRateLimit'),
      pruneCollection('GamificationDailyCap'),
    ]);

    return ok({
      body: JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        pruned: { actionLimit: actionPruned, dailyCap: dailyPruned },
      }),
      headers: JSON_HEADERS,
    });
  } catch (err) {
    console.error('HTTP function error (cleanupRateLimitCron):', err);
    return serverError({
      body: JSON.stringify({ error: 'Internal server error' }),
      headers: JSON_HEADERS,
    });
  }
}

// ── Notification Retry Cron ───────────────────────────────────────────────────
// URL: GET https://www.carolinafutons.com/_functions/processNotificationQueueCron
// Runs every 5min. Two query branches:
//   1. status='failed', retries < MAX_RETRIES, nextRetryAt <= now  (normal retry)
//   2. status='pending', updatedAt <= now - 2min                   (stale/stranded rows)
// Stale rows arise when the process dies between enqueueNotification and markSent/markFailed.
// Authenticated via X-Cron-Secret header (ALERT_CRON_KEY in Secrets Manager).
// CF-hbz
export async function get_processNotificationQueueCron(request) {
  const JSON_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  try {
    const { getSecret } = await import('wix-secrets-backend');
    const cronKey = await getSecret('ALERT_CRON_KEY');
    const requestKey = request.headers?.['x-cron-secret'];
    if (!cronKey || !requestKey || !timingSafeEqual(requestKey, cronKey)) {
      return forbidden({
        body: JSON.stringify({ error: 'Unauthorized' }),
        headers: JSON_HEADERS,
      });
    }

    const { getPendingRetries, getStalePending, markSent, markFailed } = await import('backend/utils/pendingNotifications');
    const [retryRows, staleRows] = await Promise.all([getPendingRetries(50), getStalePending(50)]);
    // Merge both branches; dedup by _id in case of any overlap
    const seen = new Set();
    const rows = [];
    for (const row of [...retryRows, ...staleRows]) {
      if (!seen.has(row._id)) { seen.add(row._id); rows.push(row); }
    }

    let retried = 0;
    let delivered = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        const { memberId, type, message, extra = {} } = row.payload || {};
        await wixData.insert('Notifications', {
          memberId,
          type,
          message,
          read: false,
          createdAt: new Date(),
          ...extra,
        }, { suppressAuth: true });
        await markSent(row._id);
        retried++;
        delivered++;
      } catch (err) {
        console.error('HTTP function error (notificationQueueCron — retry failed):', err);
        await markFailed(row._id, row.retries);
        retried++;
        failed++;
      }
    }

    return ok({
      body: JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        processed: retried,
        delivered,
        failed,
      }),
      headers: JSON_HEADERS,
    });
  } catch (err) {
    console.error('HTTP function error (processNotificationQueueCron):', err);
    return serverError({
      body: JSON.stringify({ error: 'Internal server error' }),
      headers: JSON_HEADERS,
    });
  }
}

// ── Leaderboard Endpoint ──────────────────────────────────────────────────────
// URL: GET https://www.carolinafutons.com/_functions/leaderboard
// Two paths:
//   ?type=points|streak  — public (SiteVisitor), no auth, global 60 req/min rate limit
//   ?period=all-time|weekly — member auth required, 30 req/min per member

// In-memory rate limit store (per server instance, resets on deploy — acceptable for Wix serverless)
const _leaderboardRateLimit = new Map(); // memberId → { count, windowStart }
const LEADERBOARD_RATE_LIMIT = 30;
const LEADERBOARD_WINDOW_MS = 60_000; // 1 minute

// Exported for testing only.
export function _resetLeaderboardRateLimit() {
  _leaderboardRateLimit.clear();
}

export async function get_leaderboard(request) {
  const JSON_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  const json = (obj) => JSON.stringify(obj);
  const params = request.query || {};

  // ── Public path: ?type=points|streak (SiteVisitor, no auth required) ────────
  if (params.type !== undefined) {
    const PUBLIC_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' };
    const type = params.type;
    if (!['points', 'streak'].includes(type)) {
      return badRequest({ body: json({ error: 'Invalid type — must be points or streak' }), headers: JSON_HEADERS });
    }
    const rawLimit = params.limit !== undefined ? Number(params.limit) : 20;
    if (!Number.isFinite(rawLimit) || rawLimit < 1 || rawLimit > 50) {
      return badRequest({ body: json({ error: 'limit must be between 1 and 50' }), headers: JSON_HEADERS });
    }
    const safeLimit = Math.floor(rawLimit);
    try {
      // Global rate limit (CMS-backed, shared across serverless instances) — prevents billing DoS
      const { checkRateLimit } = await import('backend/utils/rateLimit');
      const rlResult = await checkRateLimit('LeaderboardPublicRateLimit', 'global', { max: 60, windowMs: 60_000 });
      if (!rlResult.allowed) {
        return response({ status: 429, body: json({ error: 'Rate limit exceeded — try again in a moment' }), headers: JSON_HEADERS });
      }

      const sortField = type === 'points' ? 'totalPoints' : 'currentStreakDays';
      const pointsResult = await wixData
        .query('MemberPoints')
        .descending(sortField)
        .limit(safeLimit)
        .find({ suppressAuth: true });

      const memberIds = pointsResult.items.map(item => item.memberId);
      const badgesByMember = {};
      if (memberIds.length > 0) {
        // Fetch up to safeLimit*10 badge rows (capped at 1000) to avoid silent truncation
        // when members hold many badges.
        const badgesResult = await wixData
          .query('MemberBadges')
          .hasSome('memberId', memberIds)
          .descending('_createdDate')
          .limit(Math.min(safeLimit * 10, 1000))
          .find({ suppressAuth: true });
        for (const badge of badgesResult.items) {
          if (!badgesByMember[badge.memberId]) {
            badgesByMember[badge.memberId] = badge.badgeId;
          }
        }
      }

      const members = pointsResult.items.map(item => ({
        memberId: item.memberId,
        displayName: item.displayName ?? null,
        totalPoints: item.totalPoints ?? 0,
        currentStreakDays: item.currentStreakDays ?? 0,
        tier: item.tier ?? null,
        badgeId: badgesByMember[item.memberId] ?? null,
      }));
      return ok({ body: json({ members, type, limit: safeLimit }), headers: PUBLIC_HEADERS });
    } catch (err) {
      console.error('HTTP function error (leaderboard/public):', err);
      return serverError({ body: json({ error: 'Internal server error' }), headers: JSON_HEADERS });
    }
  }

  // ── Member-auth path: ?period=all-time|weekly ────────────────────────────────
  let member;
  try {
    member = await currentMember.getMember();
  } catch (err) {
    console.error('HTTP function error (leaderboard): getMember() failed:', err);
    return serverError({ body: json({ error: 'Internal server error' }), headers: JSON_HEADERS });
  }
  if (!member) {
    return unauthorized({ body: json({ error: 'Authentication required' }), headers: JSON_HEADERS });
  }

  try {
    const rawLimit = params.limit !== undefined ? Number(params.limit) : 20;
    const period = params.period || 'all-time';

    if (!['all-time', 'weekly'].includes(period)) {
      return badRequest({ body: json({ error: 'Invalid period — must be all-time or weekly' }), headers: JSON_HEADERS });
    }
    if (rawLimit > 50) {
      return badRequest({ body: json({ error: 'limit must be <= 50' }), headers: JSON_HEADERS });
    }

    // Rate limit check
    const memberId = member._id;
    const now = Date.now();
    const rl = _leaderboardRateLimit.get(memberId);
    if (rl && now - rl.windowStart < LEADERBOARD_WINDOW_MS) {
      if (rl.count >= LEADERBOARD_RATE_LIMIT) {
        return response({ status: 429, body: json({ error: 'Rate limit exceeded — try again in a moment' }), headers: JSON_HEADERS });
      }
      rl.count++;
    } else {
      _leaderboardRateLimit.set(memberId, { count: 1, windowStart: now });
    }

    const result = await _getLeaderboardWebMethod({ limit: rawLimit, period });
    return ok({ body: json(result), headers: JSON_HEADERS });
  } catch (err) {
    console.error('HTTP function error (leaderboard):', err);
    return serverError({ body: json({ error: 'Internal server error' }), headers: JSON_HEADERS });
  }
}

// ── Badge Showcase Endpoint ───────────────────────────────────────────────────
// URL: GET https://www.carolinafutons.com/_functions/badges?memberId={id}
// Public (SiteVisitor) — used by mobile Phase 8 social layer and web member page.
// Returns earned badges for a member with metadata joined from the Badges catalog.
// Rate limit: 30 req/min per requested memberId (prevents enumeration).

// Exported for testing only — badges rate limit is CMS-backed (no in-memory state to clear).
// Call in beforeEach alongside resetData() to match the convention of all rate-limited endpoints.
export function _resetBadgesRateLimit() { /* no-op: CMS state cleared by resetData() */ }

export async function get_badges(request) {
  const JSON_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30' };
  const json = (obj) => JSON.stringify(obj);

  const params = request.query || {};
  const rawId = params.memberId;
  const memberId = validateId(rawId);
  if (!memberId) {
    return badRequest({
      body: json({ error: 'memberId is required and must be a valid ID' }),
      headers: JSON_HEADERS,
    });
  }

  try {
    // Per-memberId rate limit — protects against member enumeration
    const { checkRateLimit } = await import('backend/utils/rateLimit');
    const rlResult = await checkRateLimit('BadgesPublicRateLimit', memberId, { max: 30, windowMs: 60_000 });
    if (!rlResult.allowed) {
      return response({
        status: 429,
        body: json({ error: 'Rate limit exceeded — try again in a moment' }),
        headers: JSON_HEADERS,
      });
    }

    // Fetch member's earned badges (limit 100 — Wix default is 50, explicit cap prevents silent truncation)
    const memberBadgesResult = await wixData
      .query('MemberBadges')
      .eq('memberId', memberId)
      .descending('_createdDate')
      .limit(100)
      .find({ suppressAuth: true });

    if (memberBadgesResult.items.length === 0) {
      return ok({ body: json({ memberId, badges: [], totalCount: 0 }), headers: JSON_HEADERS });
    }

    // Fetch badge catalog metadata for all earned badge IDs
    const badgeIds = [...new Set(memberBadgesResult.items.map(item => item.badgeId))];
    const catalogResult = await wixData
      .query('Badges')
      .hasSome('_id', badgeIds)
      .find({ suppressAuth: true });
    const catalogMap = {};
    for (const b of catalogResult.items) {
      catalogMap[b._id] = b;
    }

    const badges = memberBadgesResult.items.map(item => {
      const meta = catalogMap[item.badgeId] || {};
      return {
        id: item.badgeId,
        name: meta.name ?? item.badgeId,
        iconUrl: meta.iconUrl ?? null,
        earnedAt: item._createdDate ?? null,
        tier: meta.tier ?? null,
      };
    });

    return ok({ body: json({ memberId, badges, totalCount: badges.length }), headers: JSON_HEADERS });
  } catch (err) {
    console.error('HTTP function error (badges):', err);
    return serverError({ body: json({ error: 'Internal server error' }), headers: JSON_HEADERS });
  }
}

// ── Cross-Rig Event Bus — Inbound (Mobile → Web) ───────────────────────────────
// URL: POST https://www.carolinafutons.com/_functions/busEvent
// Auth: Wix session Bearer token (Authorization header, validated by Wix runtime).
// memberId is resolved server-side from the token — payload.userId is advisory only.
// Returns 401 on expired/missing token so mobile can refresh and retry.
// Handles mobile→web events: streak_extended, challenge_started, redemption_initiated.
// All events are idempotently logged to EventTraceLog via eventId as _id.
// Rate-limited per userId (BusEventRateLimit collection): 30 req/min.
//
// Schema: { eventId, schemaVersion: '1.0', traceId, event, userId, source, ts, ...extras }
//
// ── Error contract (mobile retry policy) ──────────────────────────────────────
// 400 Bad Request  — Permanent failure: schema invalid or unknown event.
//                   Mobile MUST NOT retry. Fix the payload before re-sending.
// 401 Unauthorized — Session expired or missing.
//                   Mobile SHOULD refresh the Wix session token and retry.
// 429 Too Many Req — Rate limited (30 req/min per member).
//                   Mobile SHOULD retry after 60 seconds.
// 5xx Server Error — Transient failure (DB write, runtime error).
//                   Mobile SHOULD retry with exponential backoff.
// 200 OK           — Event accepted (not necessarily processed yet).
//                   Check EventTraceLog by eventId to confirm processing.

/**
 * @function post_busEvent
 * @route POST /_functions/busEvent
 */
export async function post_busEvent(request) {
  const JSON_HEADERS = { 'Content-Type': 'application/json' };
  const json = (obj) => JSON.stringify(obj);

  // 1. Authenticate — resolve caller identity from Wix session token.
  // Never trust payload.userId; memberId is authoritative from the session.
  let member;
  try {
    member = await currentMember.getMember();
  } catch (_) {
    member = null;
  }
  if (!member) {
    return unauthorized({ body: json({ error: 'Unauthorized — valid member session required' }), headers: JSON_HEADERS });
  }
  const resolvedMemberId = member._id;

  // 2. Parse body
  let body;
  try {
    body = await request.body.json();
  } catch (_) {
    return badRequest({ body: json({ error: 'Invalid JSON body' }), headers: JSON_HEADERS });
  }

  // 3. Validate schema
  const validationError = validateIncomingEvent(body);
  if (validationError) {
    return badRequest({ body: json({ error: validationError }), headers: JSON_HEADERS });
  }

  // 4. Rate limit per userId (30 req/min)
  try {
    const { checkRateLimit } = await import('backend/utils/rateLimit');
    const rlResult = await checkRateLimit('BusEventRateLimit', resolvedMemberId, { max: 30, windowMs: 60_000 });
    if (!rlResult.allowed) {
      return response({ status: 429, body: json({ error: 'Rate limit exceeded' }), headers: JSON_HEADERS });
    }
  } catch (_) {
    // Rate limit check failure is non-fatal — allow through
  }

  // 5. Log to EventTraceLog (idempotent — skips on duplicate eventId).
  // userId in the trace is always the session-resolved memberId, never the payload value.
  try {
    await logEventTrace({
      eventId: body.eventId,
      traceId: body.traceId || null,
      event: body.event,
      userId: resolvedMemberId,
      source: body.source || null,
      ts: body.ts || null,
      status: 'received',
    });
  } catch (err) {
    console.error('HTTP function error (busEvent — EventTraceLog write):', err);
    // Non-fatal: continue even if logging fails
  }

  return ok({ body: json({ received: true, eventId: body.eventId }), headers: JSON_HEADERS });
}

// ── CMS Garbage Collection Cron ───────────────────────────────────────────────
// URL: GET https://www.carolinafutons.com/_functions/cmsGarbageCollect
// Schedule daily at 3 AM via Wix Automations or external cron.
// Pass X-Cron-Secret header for auth (ALERT_CRON_KEY in Secrets Manager).
// Purges: rate-limit records >24h, browse sessions >30d, email queue sent/cancelled >7d,
// orphan viewer sessions >48h, audit log >90d (365d for flagged records).
// CF-au1w
export async function get_cmsGarbageCollect(request) {
  const JSON_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  try {
    const { getSecret } = await import('wix-secrets-backend');
    const cronKey = await getSecret('ALERT_CRON_KEY');
    const requestKey = request.headers?.['x-cron-secret'];
    if (!cronKey || !requestKey || !timingSafeEqual(requestKey, cronKey)) {
      return forbidden({
        body: JSON.stringify({ error: 'Unauthorized' }),
        headers: JSON_HEADERS,
      });
    }

    const result = await runGarbageCollection();
    return ok({
      body: JSON.stringify(result),
      headers: JSON_HEADERS,
    });
  } catch (err) {
    console.error('HTTP function error (cmsGarbageCollect):', err);
    return serverError({
      body: JSON.stringify({ error: 'Internal server error' }),
      headers: JSON_HEADERS,
    });
  }
}


// ── Monthly Loyalty Statement Batch Send (CF-zo4k) ───────────────────
// URL: GET https://www.carolinafutons.com/_functions/sendMonthlyLoyaltyStatements
// Schedule 1st of each month via Wix Automations or external cron.
// Pass X-Cron-Secret header for auth (ALERT_CRON_KEY in Secrets Manager).
export async function get_sendMonthlyLoyaltyStatements(request) {
  const JSON_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  try {
    const { getSecret } = await import('wix-secrets-backend');
    const cronKey = await getSecret('ALERT_CRON_KEY');
    const requestKey = request.headers?.['x-cron-secret'];

    if (!cronKey || !requestKey || !timingSafeEqual(requestKey, cronKey)) {
      return forbidden({
        body: JSON.stringify({ error: 'Unauthorized' }),
        headers: JSON_HEADERS,
      });
    }

    const { sendMonthlyLoyaltyStatements } = await import('backend/loyaltyMarketing.web');
    const result = await sendMonthlyLoyaltyStatements();

    return ok({
      body: JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        sent: result.sent,
        errors: result.errors,
      }),
      headers: JSON_HEADERS,
    });
  } catch (err) {
    console.error('HTTP function error (sendMonthlyLoyaltyStatements):', err);
    return serverError({
      body: JSON.stringify({ error: 'Internal server error' }),
      headers: JSON_HEADERS,
    });
  }
}

// ── Weekly Blog Digest Cron ───────────────────────────────────────────────────
// URL: GET https://www.carolinafutons.com/_functions/weeklyBlogDigestCron
// Schedule every Friday at 9am MT via Wix Automations or external cron.
// Pass X-Cron-Secret header for auth (ALERT_CRON_KEY in Secrets Manager).
// CF-e3yo
export async function get_weeklyBlogDigestCron(request) {
  const JSON_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  try {
    const { getSecret } = await import('wix-secrets-backend');
    const cronKey = await getSecret('ALERT_CRON_KEY');
    const requestKey = request.headers?.['x-cron-secret'];

    if (!cronKey || !requestKey || !timingSafeEqual(requestKey, cronKey)) {
      return forbidden({
        body: JSON.stringify({ error: 'Unauthorized' }),
        headers: JSON_HEADERS,
      });
    }

    const result = await sendWeeklyBlogDigest();

    return ok({
      body: JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        queued: result.queued,
        skipped: result.skipped,
        postCount: result.postCount,
        error: result.error || null,
      }),
      headers: JSON_HEADERS,
    });
  } catch (err) {
    console.error('HTTP function error (weeklyBlogDigestCron):', err);
    return serverError({
      body: JSON.stringify({ error: 'Internal server error' }),
      headers: JSON_HEADERS,
    });
  }
}

// ── /_functions/contactSubmissions ───────────────────────────────────
//
// HTTP wrapper around emailService.sendEmail so external front-ends
// (carolina-futons-web Next.js) submit the contact form through the
// same Velo path that powers the legacy Wix Studio site — reusing the
// existing rate-limit + site-owner triggered-email pipeline.
//
// CORS allowlist (see backend/utils/cors): prod Vercel domain,
// project-scoped Vercel domain, branch preview URLs, localhost dev.

// Whitelist of accepted bed sizes — mirrors cfw `BedSize` type
// (src/lib/contact/contact-schema.ts). The wrapper rejects any other value
// silently (treats it as if `sizeOfInterest` were absent) so a malicious
// client can't smuggle arbitrary text into the subject prefix.
const SIZE_OF_INTEREST_WHITELIST = new Set(['twin', 'full', 'queen', 'king']);

// sendEmail caps the subject at 300 chars via validateSchema. The size prefix
// (`[Size: queen] ` = 14 chars max) plus a max-length subject would exceed
// that cap and fail validation — the user would see a generic 400. Truncate
// the combined subject so the prefix is preserved end-to-end and only the
// trailing user copy is clipped if necessary.
const SUBJECT_MAX_LEN = 300;

/**
 * @function post_contactSubmissions
 * @route POST /_functions/contactSubmissions
 * @param {Object} request.body.json
 * @param {string} request.body.json.name    — required, ≤200 chars
 * @param {string} request.body.json.email   — required, ≤254 chars, valid format
 * @param {string} [request.body.json.phone] — optional, ≤20 chars
 * @param {string} [request.body.json.subject] — optional, ≤300 chars
 * @param {string} request.body.json.message — required, ≤2000 chars
 * @param {('twin'|'full'|'queen'|'king')} [request.body.json.sizeOfInterest]
 *   — optional bed size from cfw contact form size radio. When present, the
 *   wrapper prepends `[Size: <value>] ` to the subject so the store sees it
 *   in the triggered email + ContactSubmissions CMS row. Anything outside
 *   the whitelist is silently dropped.
 * @returns {Promise<{status: number, body: string, headers: object}>}
 *   200 { success: true } on send;
 *   400 { success: false, error } on validation;
 *   429 { success: false, error } on per-email rate limit (3/hour);
 *   500 { success: false, error } on transport failure or sendEmail
 *   returning a non-object (webMethod proxy fault).
 *
 * Field passthrough audit (cfw `ContactRequest` ↔ this wrapper):
 *   name, email, phone, subject, message — forwarded as-is to sendEmail.
 *   sizeOfInterest                       — folded into the subject prefix.
 *   No other cfw fields are silently dropped.
 */
export async function post_contactSubmissions(request) {
  const JSON_HEADERS = corsHeaders(request, { 'Content-Type': 'application/json' });
  try {
    let body;
    try {
      const bodyText = await request.body.text();
      body = JSON.parse(bodyText);
    } catch (parseErr) {
      console.warn('[contactSubmissions] body parse failed:', parseErr?.message ?? parseErr);
      return badRequest({ body: JSON.stringify({ success: false, error: 'Invalid JSON body' }), headers: JSON_HEADERS });
    }

    // sendEmail has no first-class size field, so fold sizeOfInterest into
    // the subject. Whitelist values (see SIZE_OF_INTEREST_WHITELIST above)
    // — unknown sizes are silently dropped to avoid prefix smuggling. The
    // combined subject is truncated to SUBJECT_MAX_LEN so it never trips
    // sendEmail's validateSchema cap.
    const rawSubject = typeof body.subject === 'string' ? body.subject : '';
    const sizeRaw = typeof body.sizeOfInterest === 'string'
      ? body.sizeOfInterest.trim().toLowerCase()
      : '';
    const size = SIZE_OF_INTEREST_WHITELIST.has(sizeRaw) ? sizeRaw : '';
    const subject = size
      ? `[Size: ${size}] ${rawSubject}`.trim().slice(0, SUBJECT_MAX_LEN)
      : rawSubject;

    const result = await sendEmail({
      name: body.name,
      email: body.email,
      phone: body.phone,
      subject,
      message: body.message,
    });

    // Defensive: webMethod proxy can theoretically resolve to undefined on
    // backend infrastructure failures. Treat as 500 — it's not a client bug.
    if (!result) {
      console.error('[contactSubmissions] sendEmail resolved without a result envelope');
      return serverError({
        body: JSON.stringify({ success: false, error: 'Internal server error' }),
        headers: JSON_HEADERS,
      });
    }

    if (result.success !== true) {
      // Distinguish rate-limit (429) and transport failure (500) from
      // validation (400). sendEmail's outer catch returns success:false
      // with a "Failed to send message…" message — that is an infra
      // outage, not a client validation error. Other handlers in this
      // file already return 429 explicitly for rate-limit so the cfw
      // client can back off (e.g., L1867, L2183, L2255).
      const message = result.message ?? '';
      const lowered = message.toLowerCase();
      const status = lowered.includes('too many requests')
        ? 429
        : lowered.startsWith('failed to send')
        ? 500
        : 400;
      return response({
        status,
        body: JSON.stringify({ success: false, error: message || 'Submission rejected' }),
        headers: JSON_HEADERS,
      });
    }

    return ok({ body: JSON.stringify({ success: true }), headers: JSON_HEADERS });
  } catch (err) {
    console.error('HTTP function error (contactSubmissions):', err);
    return serverError({ body: JSON.stringify({ success: false, error: 'Internal server error' }), headers: JSON_HEADERS });
  }
}

export function options_contactSubmissions(request) {
  return response(corsPreflight(request));
}

// ── /_functions/mailingListSignups ────────────────────────────────────────
//
// Velo HTTP wrapper for newsletterService.subscribeToNewsletter so the
// Next.js frontend (carolina-futons-web) uses the same backend path as
// the Wix Studio footer — reusing rate-limit, dedup, ESP-sync, and
// audit-log pipelines.
//
// Called by: Next.js POST /api/newsletter/subscribe route handler.
// Server Action can still serve as client-side fallback if this path fails.
//
// CORS allowlist: prod Vercel domain, project-scoped preview URLs, localhost.

/**
 * @function post_mailingListSignups
 * @route POST /_functions/mailingListSignups
 * @param {Object} request.body.json
 * @param {string} request.body.json.email    — required, ≤254 chars, valid format
 * @param {string} [request.body.json.source] — optional, ≤50 chars, defaults to 'footer_newsletter'
 * @param {string} [request.body.json.honeypot] — optional bot-trap; non-empty → silent 200
 * @returns {Promise<{status: number, body: string, headers: object}>}
 *   200 { success: true, discountCode } on subscribe or duplicate;
 *   400 { success: false, error } on validation;
 *   429 { success: false, error } on per-email rate limit (3/hour);
 *   500 { success: false, error } on unexpected backend failure.
 */
export async function post_mailingListSignups(request) {
  const JSON_HEADERS = corsHeaders(request, { 'Content-Type': 'application/json' });
  try {
    let body;
    try {
      const bodyText = await request.body.text();
      body = JSON.parse(bodyText);
    } catch (parseErr) {
      console.warn('[mailingListSignups] body parse failed:', parseErr?.message ?? parseErr);
      return badRequest({ body: JSON.stringify({ success: false, error: 'Invalid JSON body' }), headers: JSON_HEADERS });
    }

    const result = await subscribeToNewsletter(body.email, {
      source: body.source || 'footer_newsletter',
      honeypot: body.honeypot,
    });

    if (!result) {
      console.error('[mailingListSignups] subscribeToNewsletter resolved without a result envelope');
      return serverError({
        body: JSON.stringify({ success: false, error: 'Internal server error' }),
        headers: JSON_HEADERS,
      });
    }

    if (result.success !== true) {
      const message = result.message ?? '';
      const status = message.toLowerCase().includes('too many requests') ? 429 : 400;
      return response({
        status,
        body: JSON.stringify({ success: false, error: message || 'Subscription rejected' }),
        headers: JSON_HEADERS,
      });
    }

    return ok({ body: JSON.stringify({ success: true, discountCode: result.discountCode }), headers: JSON_HEADERS });
  } catch (err) {
    console.error('HTTP function error (mailingListSignups):', err);
    return serverError({ body: JSON.stringify({ success: false, error: 'Internal server error' }), headers: JSON_HEADERS });
  }
}

export function options_mailingListSignups(request) {
  return response(corsPreflight(request));
}

// ── Public Analytics Event Tracking ─────────────────────────────────────────
// URL: POST https://www.carolinafutons.com/_functions/trackCustomEvent
// Receives events from the cfw Next.js host (server components, Server Actions).
// Mirror of the customEvents/trackCustomEvent webMethod which is unreachable
// from external callers (Wix webMethods only run within the Wix site runtime).
// Rate-limited: 30 events/min per source (matches webMethod limit). cf-3qt.5.3

export async function post_trackCustomEvent(request) {
  const JSON_HEADERS = corsHeaders(request, { 'Content-Type': 'application/json' });
  try {
    let body;
    try {
      body = await request.body.json();
    } catch (_) {
      // cf-gkgo: distinguish error modes — clients can branch on `error` to
      // decide whether to retry (server-class) or fix-the-call (client-class).
      return badRequest({ body: JSON.stringify({ success: false, error: 'invalid_json' }), headers: JSON_HEADERS });
    }

    const [eventName, params = {}] = Array.isArray(body?.args) ? body.args : [];
    if (!eventName || typeof eventName !== 'string') {
      return badRequest({ body: JSON.stringify({ success: false, error: 'missing_event_name' }), headers: JSON_HEADERS });
    }

    const cleanName = sanitize(eventName, 100)
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .toLowerCase();
    if (!cleanName) {
      return badRequest({ body: JSON.stringify({ success: false, error: 'invalid_event_name' }), headers: JSON_HEADERS });
    }

    const safeParams = params && typeof params === 'object' && !Array.isArray(params) ? params : {};

    // Guard: public endpoint — cap payload to prevent unbounded storage writes.
    if (JSON.stringify(safeParams).length > 8192) {
      return badRequest({ body: JSON.stringify({ success: false, error: 'payload_too_large' }), headers: JSON_HEADERS });
    }

    const source = sanitize(String(safeParams.source || 'custom'), 50);

    const { checkRateLimit } = await import('backend/utils/rateLimit');
    const { allowed } = await checkRateLimit('CustomEventRateLimit', source, { max: 30, windowMs: 60_000 });
    if (!allowed) {
      return response({ status: 429, body: JSON.stringify({ success: false, error: 'rate_limited' }), headers: JSON_HEADERS });
    }

    await insertAnalyticsEvent({
      memberId: safeParams.memberId || null,
      eventType: cleanName,
      source,
      payload: safeParams,
    });

    return ok({ body: JSON.stringify({ success: true }), headers: JSON_HEADERS });
  } catch (err) {
    // cf-gkgo: errorId for log↔response correlation so support can find the
    // original stack trace from a client-side report.
    const errorId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `tce-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    console.error(`HTTP function error (post_trackCustomEvent) errorId=${errorId}:`, err);
    return serverError({ body: JSON.stringify({ success: false, error: 'server_error', errorId }), headers: JSON_HEADERS });
  }
}

export function options_trackCustomEvent(request) {
  return response(corsPreflight(request));
}

// ── Back-in-Stock Notify Me ──────────────────────────────────────────────────
// URL: POST https://www.carolinafutons.com/_functions/notifyMe
// Receives email + productId from cfw PdpNotifyMe server action.
// Inserts a record into the NotifyMe CMS collection.
// Collection schema:
//   email (Text, required)
//   productId (Text, required)
//   source (Text, optional)
//
// cf-lqnd

const NOTIFY_ME_COLLECTION = 'NotifyMe';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @function post_notifyMe
 * @route POST /_functions/notifyMe
 * @param {Object} request.body.json
 * @param {string} request.body.json.email     — required, valid email format
 * @param {string} request.body.json.productId — required, Wix product ID
 * @returns {Promise<{status: number, body: string, headers: object}>}
 *   200 { success: true } on insert;
 *   400 { success: false, error } on validation;
 *   500 { success: false, error } on unexpected failure.
 */
export async function post_notifyMe(request) {
  const JSON_HEADERS = corsHeaders(request, { 'Content-Type': 'application/json' });
  try {
    let body;
    try {
      const bodyText = await request.body.text();
      body = JSON.parse(bodyText);
    } catch (parseErr) {
      console.warn('[notifyMe] body parse failed:', parseErr?.message ?? parseErr);
      return badRequest({ body: JSON.stringify({ success: false, error: 'Invalid JSON body' }), headers: JSON_HEADERS });
    }

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const productId = typeof body.productId === 'string' ? body.productId.trim() : '';

    if (!email || !EMAIL_RE.test(email)) {
      return badRequest({ body: JSON.stringify({ success: false, error: 'Valid email is required' }), headers: JSON_HEADERS });
    }
    if (!productId) {
      return badRequest({ body: JSON.stringify({ success: false, error: 'Product ID is required' }), headers: JSON_HEADERS });
    }

    await wixData.insert(NOTIFY_ME_COLLECTION, {
      email,
      productId,
      source: typeof body.source === 'string' ? body.source.slice(0, 50) : 'pdp',
    }, { suppressAuth: true });

    return ok({ body: JSON.stringify({ success: true }), headers: JSON_HEADERS });
  } catch (err) {
    // cf-gkgo: errorId for log↔response correlation. Previously the outer
    // catch logged the error but returned an opaque 'Internal server error'
    // string, leaving support unable to match a customer's failed signup to
    // a server log entry. The errorId is logged with the stack trace and
    // returned to the client so it can be surfaced in UI / support tickets.
    const errorId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `nm-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    console.error(`HTTP function error (notifyMe) errorId=${errorId}:`, err);
    return serverError({ body: JSON.stringify({ success: false, error: 'server_error', errorId }), headers: JSON_HEADERS });
  }
}

export function options_notifyMe(request) {
  return response(corsPreflight(request));
}

/**
 * @function post_unsubscribe
 * @route POST /_functions/unsubscribe
 * JSON API variant for front-end / List-Unsubscribe-Post header compliance.
 * Body: { token: string }  — same HMAC token as the GET endpoint.
 */
export async function post_unsubscribe(request) {
  const JSON_HEADERS = corsHeaders(request, { 'Content-Type': 'application/json' });
  try {
    let body;
    try {
      body = JSON.parse(await request.body.text());
    } catch {
      return badRequest({ body: JSON.stringify({ success: false, error: 'Invalid JSON body' }), headers: JSON_HEADERS });
    }

    const token = typeof body.token === 'string' ? body.token : '';
    if (!token) {
      return badRequest({ body: JSON.stringify({ success: false, error: 'Token is required' }), headers: JSON_HEADERS });
    }

    let secret;
    try {
      secret = await getSecret('UNSUB_TOKEN_SECRET');
    } catch {
      return serverError({ body: JSON.stringify({ success: false, error: 'Internal server error' }), headers: JSON_HEADERS });
    }

    const decoded = await verifyUnsubToken(token, secret);
    if (!decoded) {
      return badRequest({ body: JSON.stringify({ success: false, error: 'invalid-token' }), headers: JSON_HEADERS });
    }

    await unsubscribeContact(decoded.email, decoded.seq);
    return ok({ body: JSON.stringify({ success: true, email: decoded.email }), headers: JSON_HEADERS });
  } catch (err) {
    console.error('[unsubscribe] post_unsubscribe error:', err);
    return serverError({ body: JSON.stringify({ success: false, error: 'Internal server error' }), headers: JSON_HEADERS });
  }
}

export function options_unsubscribe(request) {
  return response(corsPreflight(request));
}

// ── /_functions/deliveryZone ──────────────────────────────────────────────
//
// Delivery zone resolution for /getting-it-home page + Next.js frontend.
// URL: GET https://www.carolinafutons.com/_functions/deliveryZone?zip=28792
// cf-3qt.4.4: proxies to getDeliveryZone webMethod (distance calc + zone lookup).

export async function get_deliveryZone(request) {
  const JSON_HEADERS = corsHeaders(request, { 'Content-Type': 'application/json' });
  const zip = (request.query?.zip || '').trim();
  if (!zip || !/^\d{5}$/.test(zip)) {
    return badRequest({
      body: JSON.stringify({ success: false, error: 'Missing or invalid zip parameter (must be 5 digits)' }),
      headers: JSON_HEADERS,
    });
  }
  try {
    const result = await _getDeliveryZone(zip);
    // cf-89xn: don't spread service result blindly — `getDeliveryZone` returns
    // { error: '...' } on its own input validation, which when spread into a
    // 200 envelope produces { success: true, error: '...' } (cf-tvbi
    // lying-status pattern). Surface as 400 so cfw can branch on status.
    // Truthy check rejects empty-string `error` (which falls through to 200
    // since an empty string isn't a real service rejection signal). Logged
    // so ops can distinguish wrapper-validation 400s from service-validation
    // 400s without a stack.
    if (result && typeof result.error === 'string' && result.error.length > 0) {
      console.warn('[deliveryZone] service emitted error envelope:', result.error);
      return badRequest({
        body: JSON.stringify({ success: false, error: result.error }),
        headers: JSON_HEADERS,
      });
    }
    return ok({ body: JSON.stringify({ success: true, ...result }), headers: JSON_HEADERS });
  } catch (err) {
    console.error('HTTP function error (deliveryZone):', err);
    return serverError({ body: JSON.stringify({ success: false, error: 'Internal server error' }), headers: JSON_HEADERS });
  }
}

export function options_deliveryZone(request) {
  return response(corsPreflight(request));
}

// ── /_functions/sampleRequests ────────────────────────────────────────────
//
// HTTP wrapper around swatchRequest.submitSwatchRequest so the Next.js
// frontend can submit fabric swatch requests without exposing Velo webMethod
// internals. Rate-limited per email (5/hour) to prevent sample abuse.
//
// Called by: Next.js Server Action in src/app/actions/swatch-request.ts
// CORS allowlist: prod Vercel domain, project-scoped preview URLs, localhost.

/**
 * @function post_sampleRequests
 * @route POST /_functions/sampleRequests
 * @param {string[]} request.body.json.swatchIds    — 1–5 swatch _id values
 * @param {Object}   request.body.json.contactInfo  — shipping address fields
 * @param {string}   [request.body.json.productSlug] — optional referring product
 * @returns {Promise<{status: number, body: string, headers: object}>}
 *   200 { success: true, requestId } on success;
 *   400 { success: false, error } on validation;
 *   429 { success: false, error } on per-email rate limit (5/hour);
 *   500 { success: false, error } on backend failure.
 */
export async function post_sampleRequests(request) {
  const JSON_HEADERS = corsHeaders(request, { 'Content-Type': 'application/json' });
  try {
    let body;
    try {
      const bodyText = await request.body.text();
      body = JSON.parse(bodyText);
    } catch (parseErr) {
      console.warn('[sampleRequests] body parse failed:', parseErr?.message ?? parseErr);
      return badRequest({ body: JSON.stringify({ success: false, error: 'Invalid JSON body' }), headers: JSON_HEADERS });
    }

    // Rate-limit by email (5 requests/hour) — swatch samples have material cost
    const email = (body?.contactInfo?.email || '').toLowerCase().trim();
    if (email) {
      const { checkRateLimit } = await import('backend/utils/rateLimit');
      const rl = await checkRateLimit('SwatchRequestRateLimit', email, { max: 5, windowMs: 3_600_000 });
      if (!rl.allowed) {
        return response({
          status: 429,
          body: JSON.stringify({ success: false, error: 'Too many requests — please try again later.' }),
          headers: JSON_HEADERS,
        });
      }
    }

    const result = await submitSwatchRequest({
      swatchIds: body.swatchIds,
      contactInfo: body.contactInfo,
      productSlug: body.productSlug,
    });

    if (!result) {
      console.error('[sampleRequests] submitSwatchRequest resolved without a result envelope');
      return serverError({ body: JSON.stringify({ success: false, error: 'Internal server error' }), headers: JSON_HEADERS });
    }

    if (result.success !== true) {
      const message = result.error ?? '';
      return badRequest({
        body: JSON.stringify({ success: false, error: message || 'Submission rejected' }),
        headers: JSON_HEADERS,
      });
    }

    return ok({ body: JSON.stringify({ success: true, requestId: result.requestId }), headers: JSON_HEADERS });
  } catch (err) {
    console.error('HTTP function error (sampleRequests):', err);
    return serverError({ body: JSON.stringify({ success: false, error: 'Internal server error' }), headers: JSON_HEADERS });
  }
}

export function options_sampleRequests(request) {
  return response(corsPreflight(request));
}

// ── /_functions/contactSubmissionsDiagnostic ──────────────────────────────
//
// cf-9ieq one-shot diagnostic. The contactSubmissions wrapper went live
// (cf-foo0) but sendEmail returns 500 with its outer-catch fallback message
// — that catch swallows the underlying exception. This endpoint replicates
// each step of sendEmail's CRM flow IN ISOLATION and returns the actual
// error envelope so we can identify which of:
//   (1) SITE_OWNER_CONTACT_ID secret missing/stale
//   (2) `contact_form_submission` triggered template not Published
//   (3) other CRM resolution gap
// is the actual cause.
//
// Inline-auth gated (mirrors post_importProductOptions pattern, cf-44mq).
// REMOVE in follow-up cleanup PR once cf-9ieq closes.

export async function post_contactSubmissionsDiagnostic(request) {
  try {
    const INLINE_AUTH_TOKEN = 'cf-9ieq-godfrey-2026-05-05-diagnostic';
    const auth = request.headers?.['authorization'] || request.headers?.['Authorization'] || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (token !== INLINE_AUTH_TOKEN) {
      return unauthorized({
        body: JSON.stringify({ error: 'unauthorized', hint: 'use inline auth token' }),
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const steps = {};

    // Step 1 — resolve SITE_OWNER_CONTACT_ID via wix-secrets-backend.
    let siteOwnerContactId;
    try {
      siteOwnerContactId = await getSecret('SITE_OWNER_CONTACT_ID');
      steps.getSecret = {
        ok: true,
        present: !!siteOwnerContactId,
        type: typeof siteOwnerContactId,
        // Don't echo the full ID — surface just enough to confirm shape
        // (Wix contactIds are 36-char UUIDs).
        length: typeof siteOwnerContactId === 'string' ? siteOwnerContactId.length : null,
        prefix: typeof siteOwnerContactId === 'string' ? siteOwnerContactId.slice(0, 4) : null,
      };
    } catch (err) {
      steps.getSecret = {
        ok: false,
        error: { message: err?.message || String(err), name: err?.name },
      };
    }

    // Step 2 — call triggeredEmails.emailContact directly with the same
    // template + variable shape that sendEmail uses, so any exception is
    // surfaced rather than swallowed.
    if (typeof siteOwnerContactId === 'string' && siteOwnerContactId.length > 0) {
      try {
        const { triggeredEmails } = await import('wix-crm-backend');
        await triggeredEmails.emailContact(
          'contact_form_submission',
          siteOwnerContactId,
          {
            variables: {
              customerName: 'cf-9ieq diagnostic',
              customerEmail: 'godfrey@cf-9ieq.diagnostic',
              customerPhone: '',
              subject: '[diagnostic] cf-9ieq probe — safe to ignore',
              message: 'Diagnostic ping from /_functions/contactSubmissionsDiagnostic. Safe to ignore. Will be removed in a follow-up PR once cf-9ieq closes.',
              submittedAt: new Date().toISOString(),
            },
          },
        );
        steps.emailContact = { ok: true };
      } catch (err) {
        steps.emailContact = {
          ok: false,
          error: {
            message: err?.message || String(err),
            name: err?.name || null,
            // err.details is Wix-specific; surface common shapes
            details: err?.details ?? null,
            cause: err?.cause?.message ?? null,
            stack: err?.stack?.slice(0, 1500) ?? null,
          },
        };
      }
    } else {
      steps.emailContact = { skipped: 'no usable contactId from getSecret' };
    }

    return ok({
      body: JSON.stringify({ bead: 'cf-9ieq', steps }, null, 2),
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return response({
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'unhandled',
        detail: err?.message || String(err),
        stack: err?.stack?.slice(0, 800),
      }),
    });
  }
}
