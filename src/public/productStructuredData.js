/**
 * @module productStructuredData
 * @description Generates schema.org/Product JSON-LD and injects it into the
 * page via #productJsonLd HtmlComponent.
 *
 * Elements:
 *   #productJsonLd — HtmlComponent that renders an invisible script tag
 *
 * CF-06xu
 */

import { getProductStructuredData as _defaultGet } from 'backend/productResources.web';

const SITE_URL = 'https://www.carolinafutons.com';

function buildJsonLd(data) {
  const { product, reviews, aggregate } = data;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name || '',
    description: product.description || '',
    image: product.mainMedia || '',
    sku: product.sku || '',
    brand: { '@type': 'Brand', name: 'Carolina Futons' },
    offers: {
      '@type': 'Offer',
      price: (Number(product.price) || 0).toFixed(2),
      priceCurrency: 'USD',
      availability: product.inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: `${SITE_URL}/product-page/${product.slug || ''}`,
    },
  };

  if (aggregate && aggregate.total > 0) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(aggregate.average).toFixed(1),
      reviewCount: aggregate.total,
      bestRating: '5',
      worstRating: '1',
    };
  }

  if (reviews && reviews.length > 0) {
    schema.review = reviews.map(r => ({
      '@type': 'Review',
      author: { '@type': 'Person', name: r.authorName || 'Anonymous' },
      reviewRating: {
        '@type': 'Rating',
        ratingValue: String(r.rating),
        bestRating: '5',
      },
      reviewBody: r.body || '',
      datePublished: r._createdDate || '',
    }));
  }

  return schema;
}

/**
 * Fetch product structured data and inject JSON-LD into #productJsonLd.
 *
 * @param {string}   productId
 * @param {Object}   [opts]
 * @param {Function} [opts.$w]
 * @param {Function} [opts.getProductStructuredData]
 */
export async function initProductStructuredData(productId, opts = {}) {
  const $w = opts.$w ?? globalThis.$w;
  const getData = opts.getProductStructuredData ?? _defaultGet;

  let data;
  try {
    data = await getData(productId);
  } catch (err) {
    console.error('[productStructuredData] Failed to fetch structured data', err);
    return;
  }
  if (!data || !data.product) return;

  const schema = buildJsonLd(data);
  const script = `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;

  try {
    $w('#productJsonLd').html = script;
  } catch (err) {
    console.error('[productStructuredData] Failed to inject JSON-LD into #productJsonLd', err);
  }
}
