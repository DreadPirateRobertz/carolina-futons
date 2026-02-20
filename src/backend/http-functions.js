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

// Facebook/Instagram Commerce Catalog Feed
// URL: GET https://www.carolinafutons.com/_functions/facebookCatalogFeed
// Configure in Facebook Commerce Manager as a scheduled data feed
export async function get_facebookCatalogFeed() {
  try {
    const SITE_URL = 'https://www.carolinafutons.com';
    const products = await wixData.query('Stores/Products')
      .limit(200)
      .find();

    // Facebook catalog TSV format (tab-separated values)
    const headers = ['id', 'title', 'description', 'availability', 'condition', 'price',
      'link', 'image_link', 'brand', 'google_product_category', 'fb_product_category',
      'sale_price', 'item_group_id'].join('\t');

    const rows = products.items.map(p => {
      const availability = p.inStock !== false ? 'in stock' : 'out of stock';
      const price = `${(p.price || 0).toFixed(2)} USD`;
      const salePrice = p.discountedPrice ? `${p.discountedPrice.toFixed(2)} USD` : '';
      const brand = detectBrandFromProduct(p);
      const description = (p.description || '').replace(/<[^>]*>/g, '').replace(/[\t\n\r]/g, ' ').substring(0, 5000);
      const category = detectGoogleCategory(p);

      return [
        p._id || '',
        (p.name || '').replace(/[\t\n\r]/g, ' '),
        description,
        availability,
        'new',
        price,
        `${SITE_URL}/product-page/${p.slug}`,
        p.mainMedia || '',
        brand,
        category,
        'furniture > bedroom furniture',
        salePrice,
        (p.collections || [])[0] || '',
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

// Pinterest Product Catalog Feed
// URL: GET https://www.carolinafutons.com/_functions/pinterestProductFeed
// Configure in Pinterest Business > Catalogs as a data source
export async function get_pinterestProductFeed() {
  try {
    const SITE_URL = 'https://www.carolinafutons.com';
    const products = await wixData.query('Stores/Products')
      .limit(200)
      .find();

    // Pinterest catalog TSV format
    const headers = ['id', 'title', 'description', 'link', 'image_link', 'price',
      'availability', 'brand', 'google_product_category', 'condition',
      'sale_price', 'product_type', 'additional_image_link'].join('\t');

    const rows = products.items.map(p => {
      const availability = p.inStock !== false ? 'in stock' : 'out of stock';
      const price = `${(p.price || 0).toFixed(2)} USD`;
      const salePrice = p.discountedPrice ? `${p.discountedPrice.toFixed(2)} USD` : '';
      const brand = detectBrandFromProduct(p);
      const description = (p.description || '').replace(/<[^>]*>/g, '').replace(/[\t\n\r]/g, ' ').substring(0, 5000);
      const category = detectGoogleCategory(p);
      const productType = detectProductType(p);
      const additionalImages = (p.mediaItems || []).slice(1, 5).map(m => m.src || '').join(',');

      return [
        p._id || '',
        (p.name || '').replace(/[\t\n\r]/g, ' '),
        description,
        `${SITE_URL}/product-page/${p.slug}`,
        p.mainMedia || '',
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
