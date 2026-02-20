// Wix HTTP Functions - Public API endpoints
// Accessible at: https://www.carolinafutons.com/_functions/<functionName>
import { ok, serverError } from 'wix-http-functions';
import { generateFeed } from 'backend/googleMerchantFeed.web';
import wixData from 'wix-data';

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
export function get_health() {
  return ok({
    body: JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }),
    headers: { 'Content-Type': 'application/json' },
  });
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
      { loc: '/sales', priority: '0.7', changefreq: 'daily' },
      { loc: '/product-videos', priority: '0.6', changefreq: 'weekly' },
      { loc: '/getting-it-home', priority: '0.5', changefreq: 'monthly' },
      { loc: '/contact', priority: '0.5', changefreq: 'monthly' },
      { loc: '/faq', priority: '0.5', changefreq: 'monthly' },
      { loc: '/about', priority: '0.5', changefreq: 'monthly' },
    ];

    // Fetch all products for dynamic URLs
    const products = await wixData.query('Stores/Products')
      .limit(200)
      .find();

    const productUrls = products.items.map(p => ({
      loc: `/product-page/${p.slug}`,
      priority: '0.7',
      changefreq: 'weekly',
      lastmod: p._updatedDate ? new Date(p._updatedDate).toISOString().split('T')[0] : '',
    }));

    const allUrls = [...staticPages, ...productUrls];

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    for (const url of allUrls) {
      xml += '  <url>\n';
      xml += `    <loc>${SITE_URL}${url.loc}</loc>\n`;
      if (url.lastmod) xml += `    <lastmod>${url.lastmod}</lastmod>\n`;
      xml += `    <changefreq>${url.changefreq}</changefreq>\n`;
      xml += `    <priority>${url.priority}</priority>\n`;
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
