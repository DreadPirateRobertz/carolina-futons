import { describe, it, expect } from 'vitest';
import { futonFrame, wallHuggerFrame, futonMattress, murphyBed, platformBed, casegoodsItem } from './fixtures/products.js';
import {
  getProductSchema,
  getBusinessSchema,
  getBreadcrumbSchema,
  getFaqSchema,
  generateAltText,
  getWebSiteSchema,
  getCollectionSchema,
  getCategoryMetaDescription,
  getProductOgTags,
  getCategoryOgTags,
  getProductMetaTags,
  getCategoryMetaTags,
} from '../src/backend/seoHelpers.web.js';

// ── getProductSchema ────────────────────────────────────────────────

describe('getProductSchema', () => {
  it('generates valid JSON-LD Product schema', () => {
    const json = getProductSchema(futonFrame);
    expect(json).toBeTruthy();
    const schema = JSON.parse(json);
    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('Product');
    expect(schema.name).toBe('Eureka Futon Frame');
    expect(schema.sku).toBe('EUR-FRM-001');
  });

  it('includes correct offer with price and availability', () => {
    const schema = JSON.parse(getProductSchema(futonFrame));
    expect(schema.offers['@type']).toBe('Offer');
    expect(schema.offers.priceCurrency).toBe('USD');
    expect(schema.offers.price).toBe(499);
    expect(schema.offers.availability).toBe('https://schema.org/InStock');
  });

  it('uses discounted price when available', () => {
    const schema = JSON.parse(getProductSchema(futonMattress));
    expect(schema.offers.price).toBe(299); // discountedPrice
  });

  it('marks out-of-stock products correctly', () => {
    const outOfStock = { ...futonFrame, inStock: false };
    const schema = JSON.parse(getProductSchema(outOfStock));
    expect(schema.offers.availability).toBe('https://schema.org/OutOfStock');
  });

  it('includes aggregate rating when present', () => {
    const schema = JSON.parse(getProductSchema(futonFrame));
    expect(schema.aggregateRating).toBeDefined();
    expect(schema.aggregateRating.ratingValue).toBe(4.5);
    expect(schema.aggregateRating.reviewCount).toBe(12);
  });

  it('omits aggregate rating when no rating', () => {
    const noRating = { ...futonFrame, numericRating: 0 };
    const schema = JSON.parse(getProductSchema(noRating));
    expect(schema.aggregateRating).toBeUndefined();
  });

  it('returns null for null product', () => {
    expect(getProductSchema(null)).toBeNull();
  });

  it('builds correct product URL from slug', () => {
    const schema = JSON.parse(getProductSchema(futonFrame));
    expect(schema.offers.url).toContain('/product-page/eureka-futon-frame');
  });

  it('detects brand from collections', () => {
    // wall-hugger -> Strata Furniture
    const schema = JSON.parse(getProductSchema(wallHuggerFrame));
    expect(schema.brand.name).toBe('Strata Furniture');
  });
});

// ── getBusinessSchema ───────────────────────────────────────────────

describe('getBusinessSchema', () => {
  it('generates valid FurnitureStore schema', () => {
    const json = getBusinessSchema();
    const schema = JSON.parse(json);
    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('FurnitureStore');
    expect(schema.name).toBe('Carolina Futons');
  });

  it('includes correct address', () => {
    const schema = JSON.parse(getBusinessSchema());
    expect(schema.address.streetAddress).toBe('824 Locust St, Ste 200');
    expect(schema.address.addressLocality).toBe('Hendersonville');
    expect(schema.address.addressRegion).toBe('NC');
    expect(schema.address.postalCode).toBe('28792');
  });

  it('includes opening hours', () => {
    const schema = JSON.parse(getBusinessSchema());
    expect(schema.openingHoursSpecification).toBeDefined();
    expect(schema.openingHoursSpecification[0].dayOfWeek).toContain('Wednesday');
    expect(schema.openingHoursSpecification[0].opens).toBe('10:00');
    expect(schema.openingHoursSpecification[0].closes).toBe('17:00');
  });

  it('includes geo coordinates', () => {
    const schema = JSON.parse(getBusinessSchema());
    expect(schema.geo.latitude).toBe(35.3187);
    expect(schema.geo.longitude).toBe(-82.4612);
  });
});

// ── getBreadcrumbSchema ────────────────────────────────────────────

describe('getBreadcrumbSchema', () => {
  it('generates BreadcrumbList with correct positions', () => {
    const crumbs = [
      { name: 'Home', url: '/' },
      { name: 'Futon Frames', url: '/futon-frames' },
      { name: 'Eureka Frame' },
    ];
    const schema = JSON.parse(getBreadcrumbSchema(crumbs));
    expect(schema['@type']).toBe('BreadcrumbList');
    expect(schema.itemListElement).toHaveLength(3);
    expect(schema.itemListElement[0].position).toBe(1);
    expect(schema.itemListElement[2].position).toBe(3);
  });

  it('includes full URLs with base domain', () => {
    const crumbs = [{ name: 'Home', url: '/' }, { name: 'Current Page' }];
    const schema = JSON.parse(getBreadcrumbSchema(crumbs));
    // First item (non-last) should have full URL
    expect(schema.itemListElement[0].item).toContain('carolinafutons.com');
  });

  it('omits item URL when not provided', () => {
    const crumbs = [{ name: 'Current Page' }];
    const schema = JSON.parse(getBreadcrumbSchema(crumbs));
    expect(schema.itemListElement[0].item).toBeUndefined();
  });

  it('returns null for empty/null breadcrumbs', () => {
    expect(getBreadcrumbSchema(null)).toBeNull();
    expect(getBreadcrumbSchema([])).toBeNull();
  });
});

// ── getFaqSchema ───────────────────────────────────────────────────

describe('getFaqSchema', () => {
  it('generates FAQPage schema with questions and answers', () => {
    const faqs = [
      { question: 'Do you deliver?', answer: 'Yes, we deliver throughout the Southeast.' },
      { question: 'What is your return policy?', answer: '30-day return on unused items.' },
    ];
    const schema = JSON.parse(getFaqSchema(faqs));
    expect(schema['@type']).toBe('FAQPage');
    expect(schema.mainEntity).toHaveLength(2);
    expect(schema.mainEntity[0]['@type']).toBe('Question');
    expect(schema.mainEntity[0].name).toBe('Do you deliver?');
    expect(schema.mainEntity[0].acceptedAnswer.text).toContain('Southeast');
  });

  it('returns null for empty/null faqs', () => {
    expect(getFaqSchema(null)).toBeNull();
    expect(getFaqSchema([])).toBeNull();
  });
});

// ── generateAltText ────────────────────────────────────────────────

describe('generateAltText', () => {
  it('generates main image alt text with brand, finish, size', () => {
    const alt = generateAltText(futonFrame, 'main');
    expect(alt).toContain('Eureka Futon Frame');
    expect(alt).toContain('Night & Day Furniture'); // default brand
    expect(alt).toContain('in Natural');
    expect(alt).toContain('Full size');
    expect(alt).toContain('Carolina Futons');
  });

  it('generates lifestyle alt text', () => {
    const alt = generateAltText(futonFrame, 'lifestyle');
    expect(alt).toContain('Eureka Futon Frame');
    expect(alt).toContain('living room setting');
    expect(alt).toContain('Carolina Futons');
  });

  it('generates detail alt text', () => {
    const alt = generateAltText(futonFrame, 'detail');
    expect(alt).toContain('Close-up of');
    expect(alt).toContain('Natural finish');
  });

  it('generates open position alt text for futons', () => {
    const alt = generateAltText(futonFrame, 'open');
    expect(alt).toContain('open bed position');
    expect(alt).toContain('Full');
  });

  it('returns generic fallback for unknown image type', () => {
    const alt = generateAltText(futonFrame, 'unknown');
    expect(alt).toContain('Eureka Futon Frame');
    expect(alt).toContain('Carolina Futons');
  });

  it('returns empty string for null product', () => {
    expect(generateAltText(null)).toBe('');
  });

  it('detects Strata Furniture brand for wall-huggers', () => {
    const alt = generateAltText(wallHuggerFrame, 'main');
    expect(alt).toContain('Strata Furniture');
  });

  it('detects correct category labels', () => {
    const murphyAlt = generateAltText(murphyBed, 'main');
    expect(murphyAlt).toContain('Murphy Cabinet Bed');

    const platformAlt = generateAltText(platformBed, 'main');
    expect(platformAlt).toContain('Platform Bed');

    const mattressAlt = generateAltText(futonMattress, 'main');
    expect(mattressAlt).toContain('Futon Mattress');
  });
});

// ── getWebSiteSchema ────────────────────────────────────────────────

describe('getWebSiteSchema', () => {
  it('generates valid WebSite schema', () => {
    const schema = JSON.parse(getWebSiteSchema());
    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('WebSite');
    expect(schema.name).toBe('Carolina Futons');
  });

  it('includes SearchAction for sitelinks', () => {
    const schema = JSON.parse(getWebSiteSchema());
    expect(schema.potentialAction['@type']).toBe('SearchAction');
    expect(schema.potentialAction.target.urlTemplate).toContain('search-results');
    expect(schema.potentialAction['query-input']).toContain('search_term_string');
  });

  it('references business as publisher', () => {
    const schema = JSON.parse(getWebSiteSchema());
    expect(schema.publisher['@id']).toContain('#business');
  });
});

// ── getCollectionSchema ─────────────────────────────────────────────

describe('getCollectionSchema', () => {
  it('generates CollectionPage schema with ItemList', () => {
    const categoryInfo = { title: 'Futon Frames', slug: 'futon-frames', description: 'Shop futon frames.' };
    const products = [futonFrame, wallHuggerFrame];
    const schema = JSON.parse(getCollectionSchema(categoryInfo, products));
    expect(schema['@type']).toBe('CollectionPage');
    expect(schema.name).toBe('Futon Frames');
    expect(schema.mainEntity['@type']).toBe('ItemList');
    expect(schema.mainEntity.numberOfItems).toBe(2);
  });

  it('includes breadcrumb with category', () => {
    const categoryInfo = { title: 'Mattresses', slug: 'mattresses' };
    const schema = JSON.parse(getCollectionSchema(categoryInfo, [futonMattress]));
    expect(schema.breadcrumb['@type']).toBe('BreadcrumbList');
    expect(schema.breadcrumb.itemListElement).toHaveLength(2);
    expect(schema.breadcrumb.itemListElement[1].name).toBe('Mattresses');
  });

  it('limits ItemList to 30 products', () => {
    const categoryInfo = { title: 'Test', slug: 'test' };
    const manyProducts = Array.from({ length: 35 }, (_, i) => ({
      ...futonFrame,
      _id: `prod-${i}`,
      slug: `product-${i}`,
      name: `Product ${i}`,
    }));
    const schema = JSON.parse(getCollectionSchema(categoryInfo, manyProducts));
    expect(schema.mainEntity.itemListElement).toHaveLength(30);
  });

  it('returns null for missing category or empty products', () => {
    expect(getCollectionSchema(null, [futonFrame])).toBeNull();
    expect(getCollectionSchema({ title: 'Test', slug: 'test' }, [])).toBeNull();
    expect(getCollectionSchema({ title: 'Test', slug: 'test' }, null)).toBeNull();
  });
});

// ── getCategoryMetaDescription ──────────────────────────────────────

describe('getCategoryMetaDescription', () => {
  it('returns category-specific description for futon-frames', () => {
    const desc = getCategoryMetaDescription('futon-frames');
    expect(desc).toContain('futon frames');
    expect(desc).toContain('Night & Day Furniture');
  });

  it('returns category-specific description for mattresses', () => {
    const desc = getCategoryMetaDescription('mattresses');
    expect(desc).toContain('Otis Bed');
    expect(desc).toContain('CertiPUR-US');
  });

  it('returns default description for unknown category', () => {
    const desc = getCategoryMetaDescription('nonexistent');
    expect(desc).toContain('futon furniture');
    expect(desc).toContain('Carolinas');
  });
});

// ── getProductOgTags ────────────────────────────────────────────────

describe('getProductOgTags', () => {
  it('generates OG and Twitter Card tags for product', () => {
    const tags = JSON.parse(getProductOgTags(futonFrame));
    expect(tags['og:type']).toBe('product');
    expect(tags['og:title']).toContain('Eureka Futon Frame');
    expect(tags['og:title']).toContain('Carolina Futons');
    expect(tags['og:url']).toContain('/product-page/eureka-futon-frame');
    expect(tags['og:image']).toBe('https://example.com/eureka.jpg');
  });

  it('includes price and availability', () => {
    const tags = JSON.parse(getProductOgTags(futonFrame));
    expect(tags['product:price:amount']).toBe('499');
    expect(tags['product:price:currency']).toBe('USD');
    expect(tags['product:availability']).toBe('in stock');
  });

  it('marks out-of-stock availability', () => {
    const oos = { ...futonFrame, inStock: false };
    const tags = JSON.parse(getProductOgTags(oos));
    expect(tags['product:availability']).toBe('out of stock');
  });

  it('includes Twitter Card tags', () => {
    const tags = JSON.parse(getProductOgTags(futonFrame));
    expect(tags['twitter:card']).toBe('summary_large_image');
    expect(tags['twitter:title']).toContain('Eureka Futon Frame');
  });

  it('returns empty string for null product', () => {
    expect(getProductOgTags(null)).toBe('');
  });
});

// ── getCategoryOgTags ───────────────────────────────────────────────

describe('getCategoryOgTags', () => {
  it('generates OG tags for known category', () => {
    const tags = JSON.parse(getCategoryOgTags('futon-frames'));
    expect(tags['og:type']).toBe('website');
    expect(tags['og:title']).toContain('Futon Frames');
    expect(tags['og:url']).toContain('/futon-frames');
  });

  it('includes Twitter Card tags', () => {
    const tags = JSON.parse(getCategoryOgTags('mattresses'));
    expect(tags['twitter:card']).toBe('summary');
    expect(tags['twitter:title']).toContain('Futon Mattresses');
  });

  it('falls back to Shop for unknown slug', () => {
    const tags = JSON.parse(getCategoryOgTags('unknown'));
    expect(tags['og:title']).toContain('Shop');
  });
});

// ── getProductMetaTags ──────────────────────────────────────────────

describe('getProductMetaTags', () => {
  it('generates HTML meta tags for product', async () => {
    const html = await getProductMetaTags(futonFrame);
    expect(html).toContain('<meta property="og:type" content="product"');
    expect(html).toContain('Eureka Futon Frame');
    expect(html).toContain('og:image');
  });

  it('includes Twitter Card meta tags', async () => {
    const html = await getProductMetaTags(futonFrame);
    expect(html).toContain('twitter:card');
    expect(html).toContain('summary_large_image');
  });

  it('includes Pinterest Rich Pin price tags', async () => {
    const html = await getProductMetaTags(futonFrame);
    expect(html).toContain('og:price:amount');
    expect(html).toContain('og:price:currency');
    expect(html).toContain('USD');
  });

  it('includes product availability', async () => {
    const html = await getProductMetaTags(futonFrame);
    expect(html).toContain('product:availability');
    expect(html).toContain('instock');
  });

  it('shows oos for out-of-stock product', async () => {
    const oos = { ...futonFrame, inStock: false };
    const html = await getProductMetaTags(oos);
    expect(html).toContain('"oos"');
  });

  it('returns empty string for null product', async () => {
    expect(await getProductMetaTags(null)).toBe('');
  });

  it('escapes HTML entities in attributes', async () => {
    const xss = { ...futonFrame, name: 'Frame "Special" <Edition>' };
    const html = await getProductMetaTags(xss);
    expect(html).not.toContain('"Special"');
    expect(html).toContain('&quot;Special&quot;');
  });
});

// ── getCategoryMetaTags ─────────────────────────────────────────────

describe('getCategoryMetaTags', () => {
  it('generates HTML meta tags for category page', async () => {
    const html = await getCategoryMetaTags('futon-frames', 'Futon Frames');
    expect(html).toContain('<meta property="og:type" content="website"');
    expect(html).toContain('Futon Frames');
  });

  it('includes Twitter Card tags', async () => {
    const html = await getCategoryMetaTags('mattresses', 'Mattresses');
    expect(html).toContain('twitter:card');
    expect(html).toContain('twitter:title');
  });

  it('uses provided image URL', async () => {
    const html = await getCategoryMetaTags('sales', 'Sale', 'https://example.com/sale.jpg');
    expect(html).toContain('https://example.com/sale.jpg');
  });
});
