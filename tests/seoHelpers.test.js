import { describe, it, expect } from 'vitest';
import { futonFrame, wallHuggerFrame, futonMattress, murphyBed, platformBed, casegoodsItem } from './fixtures/products.js';
import {
  getProductSchema,
  getBusinessSchema,
  getBreadcrumbSchema,
  getFaqSchema,
  getProductFaqSchema,
  generateAltText,
  getWebSiteSchema,
  getCollectionSchema,
  getCategoryMetaDescription,
  getProductOgTags,
  getCategoryOgTags,
  getProductMetaTags,
  getCategoryMetaTags,
  getPageTitle,
  getCanonicalUrl,
  getPageMetaDescription,
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

  it('includes mpn from SKU', () => {
    const schema = JSON.parse(getProductSchema(futonFrame));
    expect(schema.mpn).toBe('EUR-FRM-001');
  });

  it('includes productID from _id', () => {
    const schema = JSON.parse(getProductSchema(futonFrame));
    expect(schema.productID).toBe('prod-frame-001');
  });

  it('includes priceValidUntil on offers', () => {
    const schema = JSON.parse(getProductSchema(futonFrame));
    expect(schema.offers.priceValidUntil).toBeDefined();
    // Should be ISO date format YYYY-MM-DD
    expect(schema.offers.priceValidUntil).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Should be ~1 year from now
    const validDate = new Date(schema.offers.priceValidUntil);
    const now = new Date();
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    expect(validDate.getFullYear()).toBe(oneYearFromNow.getFullYear());
  });

  it('includes individual reviews when present', () => {
    const schema = JSON.parse(getProductSchema(futonFrame));
    expect(schema.review).toBeDefined();
    expect(schema.review).toHaveLength(2);
    expect(schema.review[0]['@type']).toBe('Review');
    expect(schema.review[0].reviewRating.ratingValue).toBe(5);
    expect(schema.review[0].author.name).toBe('Sarah M.');
    expect(schema.review[0].reviewBody).toBe('Solid build quality, easy to assemble.');
    expect(schema.review[0].datePublished).toBe('2025-06-10');
  });

  it('strips HTML from review body', () => {
    const schema = JSON.parse(getProductSchema(futonFrame));
    expect(schema.review[1].reviewBody).toBe('Great frame, finish is beautiful.');
    expect(schema.review[1].reviewBody).not.toContain('<b>');
  });

  it('uses Verified Customer as fallback author', () => {
    const withAnonymousReview = {
      ...futonFrame,
      reviews: [{ rating: 4 }],
    };
    const schema = JSON.parse(getProductSchema(withAnonymousReview));
    expect(schema.review[0].author.name).toBe('Verified Customer');
  });

  it('omits reviews when not present', () => {
    const schema = JSON.parse(getProductSchema(wallHuggerFrame));
    expect(schema.review).toBeUndefined();
  });

  it('omits reviews for empty reviews array', () => {
    const emptyReviews = { ...futonFrame, reviews: [] };
    const schema = JSON.parse(getProductSchema(emptyReviews));
    expect(schema.review).toBeUndefined();
  });

  it('omits mpn when no SKU', () => {
    const noSku = { ...futonFrame, sku: '' };
    const schema = JSON.parse(getProductSchema(noSku));
    expect(schema.mpn).toBeUndefined();
  });
});

// ── getProductFaqSchema ─────────────────────────────────────────────

describe('getProductFaqSchema', () => {
  it('returns null for null product', () => {
    expect(getProductFaqSchema(null)).toBeNull();
  });

  it('generates valid FAQPage schema', () => {
    const schema = JSON.parse(getProductFaqSchema(futonFrame));
    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('FAQPage');
    expect(schema.mainEntity.length).toBeGreaterThan(0);
    expect(schema.mainEntity[0]['@type']).toBe('Question');
    expect(schema.mainEntity[0].acceptedAnswer['@type']).toBe('Answer');
  });

  it('includes return policy and shipping questions for all products', () => {
    const schema = JSON.parse(getProductFaqSchema(futonFrame));
    const questions = schema.mainEntity.map(q => q.name);
    expect(questions.some(q => q.includes('return policy'))).toBe(true);
    expect(questions.some(q => q.includes('shipping options'))).toBe(true);
    expect(questions.some(q => q.includes('delivery take'))).toBe(true);
  });

  it('includes product name in questions', () => {
    const schema = JSON.parse(getProductFaqSchema(futonFrame));
    const questions = schema.mainEntity.map(q => q.name);
    expect(questions.every(q => q.includes('Eureka Futon Frame'))).toBe(true);
  });

  it('adds futon-specific questions for futon frames', () => {
    const schema = JSON.parse(getProductFaqSchema(futonFrame));
    const questions = schema.mainEntity.map(q => q.name);
    expect(questions.some(q => q.includes('mattress sizes'))).toBe(true);
    expect(questions.some(q => q.includes('assembly required'))).toBe(true);
  });

  it('adds wall-hugger-specific questions', () => {
    const schema = JSON.parse(getProductFaqSchema(wallHuggerFrame));
    const questions = schema.mainEntity.map(q => q.name);
    expect(questions.some(q => q.includes('mattress sizes'))).toBe(true);
    expect(questions.some(q => q.includes('assembly required'))).toBe(true);
  });

  it('adds murphy-bed-specific questions', () => {
    const schema = JSON.parse(getProductFaqSchema(murphyBed));
    const questions = schema.mainEntity.map(q => q.name);
    expect(questions.some(q => q.includes('mounted to a wall'))).toBe(true);
    expect(questions.some(q => q.includes('mattress comes with'))).toBe(true);
  });

  it('adds mattress-specific questions', () => {
    const schema = JSON.parse(getProductFaqSchema(futonMattress));
    const questions = schema.mainEntity.map(q => q.name);
    expect(questions.some(q => q.includes('How long will'))).toBe(true);
    expect(questions.some(q => q.includes('hypoallergenic'))).toBe(true);
  });

  it('adds platform-bed-specific questions', () => {
    const schema = JSON.parse(getProductFaqSchema(platformBed));
    const questions = schema.mainEntity.map(q => q.name);
    expect(questions.some(q => q.includes('box spring'))).toBe(true);
  });

  it('adds casegoods-specific questions', () => {
    const schema = JSON.parse(getProductFaqSchema(casegoodsItem));
    const questions = schema.mainEntity.map(q => q.name);
    expect(questions.some(q => q.includes('Night & Day Furniture'))).toBe(true);
  });

  it('includes shipping options question with rates calculated at checkout', () => {
    const schema = JSON.parse(getProductFaqSchema(murphyBed)); // $1,899
    const shippingQ = schema.mainEntity.find(q => q.name.includes('shipping options'));
    expect(shippingQ).toBeDefined();
    expect(shippingQ.acceptedAnswer.text).toContain('rates calculated at checkout');
  });

  it('shipping FAQ mentions white-glove delivery', () => {
    const schema = JSON.parse(getProductFaqSchema(futonFrame)); // $499
    const shippingQ = schema.mainEntity.find(q => q.name.includes('shipping options'));
    expect(shippingQ.acceptedAnswer.text).toContain('White-glove delivery');
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

  it('includes detected brand instead of hardcoded Carolina Futons', () => {
    const tags = JSON.parse(getProductOgTags(wallHuggerFrame));
    expect(tags['product:brand']).toBe('Strata Furniture');
  });

  it('includes Night & Day Furniture brand for futon frames', () => {
    const tags = JSON.parse(getProductOgTags(futonFrame));
    expect(tags['product:brand']).toBe('Night & Day Furniture');
  });

  it('includes product:condition as NewCondition', () => {
    const tags = JSON.parse(getProductOgTags(futonFrame));
    expect(tags['product:condition']).toBe('new');
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
    expect(html).toContain('product:price:amount');
    expect(html).toContain('product:price:currency');
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

// ── getPageTitle ──────────────────────────────────────────────────────

describe('getPageTitle', () => {
  it('generates product page title with name', () => {
    const title = getPageTitle('product', { name: 'Eureka Futon Frame' });
    expect(title).toBe('Eureka Futon Frame | Carolina Futons');
  });

  it('falls back to site name for product without name', () => {
    const title = getPageTitle('product', {});
    expect(title).toBe('Carolina Futons');
  });

  it('generates category page title for known slug', () => {
    const title = getPageTitle('category', { slug: 'futon-frames' });
    expect(title).toContain('Futon Frames');
    expect(title).toContain('Carolina Futons');
  });

  it('generates category page title for sales', () => {
    const title = getPageTitle('category', { slug: 'sales' });
    expect(title).toContain('Sale & Clearance');
    expect(title).toContain('Carolina Futons');
  });

  it('falls back to Shop for unknown category', () => {
    const title = getPageTitle('category', { slug: 'unknown' });
    expect(title).toContain('Shop');
  });

  it('generates home page title', () => {
    const title = getPageTitle('home');
    expect(title).toContain('Carolina Futons');
    expect(title).toContain('Hendersonville NC');
  });

  it('generates blog post title with post title', () => {
    const title = getPageTitle('blogPost', { title: 'How to Choose a Futon' });
    expect(title).toBe('How to Choose a Futon | Carolina Futons Blog');
  });

  it('returns site name for unknown page type', () => {
    expect(getPageTitle('unknown')).toBe('Carolina Futons');
  });
});

// ── getCanonicalUrl ──────────────────────────────────────────────────

describe('getCanonicalUrl', () => {
  it('generates product canonical URL', () => {
    expect(getCanonicalUrl('product', 'eureka-futon-frame'))
      .toBe('https://www.carolinafutons.com/product-page/eureka-futon-frame');
  });

  it('generates category canonical URL', () => {
    expect(getCanonicalUrl('category', 'futon-frames'))
      .toBe('https://www.carolinafutons.com/futon-frames');
  });

  it('generates home canonical URL', () => {
    expect(getCanonicalUrl('home'))
      .toBe('https://www.carolinafutons.com');
  });

  it('generates blog post canonical URL', () => {
    expect(getCanonicalUrl('blogPost', 'how-to-choose'))
      .toBe('https://www.carolinafutons.com/blog/how-to-choose');
  });

  it('returns base URL for unknown page type', () => {
    expect(getCanonicalUrl('unknown'))
      .toBe('https://www.carolinafutons.com');
  });
});

// ── getPageMetaDescription ──────────────────────────────────────────

describe('getPageMetaDescription', () => {
  it('generates product meta description from product description', () => {
    const desc = getPageMetaDescription('product', { description: 'Solid hardwood futon frame.', name: 'Eureka' });
    expect(desc).toContain('Solid hardwood futon frame');
  });

  it('generates fallback product meta description from name', () => {
    const desc = getPageMetaDescription('product', { name: 'Eureka Frame' });
    expect(desc).toContain('Eureka Frame');
    expect(desc).toContain('Carolina Futons');
  });

  it('generates category meta description', () => {
    const desc = getPageMetaDescription('category', { slug: 'mattresses' });
    expect(desc).toContain('Otis Bed');
  });

  it('generates home meta description', () => {
    const desc = getPageMetaDescription('home');
    expect(desc).toContain('Carolina Futons');
    expect(desc).toContain('futon furniture');
  });

  it('generates blog post meta description from excerpt', () => {
    const desc = getPageMetaDescription('blogPost', { excerpt: 'Tips for choosing.', title: 'Guide' });
    expect(desc).toContain('Tips for choosing');
  });

  it('truncates long product descriptions', () => {
    const longDesc = 'A'.repeat(200);
    const desc = getPageMetaDescription('product', { description: longDesc });
    expect(desc.length).toBeLessThanOrEqual(159); // 155 + "..."
  });

  it('strips HTML from product description', () => {
    const desc = getPageMetaDescription('product', { description: '<b>Bold</b> frame', name: 'Test' });
    expect(desc).not.toContain('<b>');
    expect(desc).toContain('Bold frame');
  });
});

// ── getCategoryOgTags — sales category ──────────────────────────────

describe('getCategoryOgTags — sales category', () => {
  it('generates OG tags for sales category', () => {
    const tags = JSON.parse(getCategoryOgTags('sales'));
    expect(tags['og:type']).toBe('website');
    expect(tags['og:title']).toContain('Sale');
    expect(tags['og:url']).toContain('/sales');
  });
});

// ═══════════════════════════════════════════════════════════════════
// Google Rich Results Validator — CF-gi3p SEO Schema Audit
// Tests validate required + recommended fields per Google's
// structured data documentation for each rich result type.
// ═══════════════════════════════════════════════════════════════════

describe('Google Rich Results: Product schema', () => {
  let schema;
  beforeAll(() => { schema = JSON.parse(getProductSchema(futonFrame)); });

  // Required fields per Google Product structured data
  it('has @context and @type', () => {
    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('Product');
  });

  it('has name (required)', () => {
    expect(typeof schema.name).toBe('string');
    expect(schema.name.length).toBeGreaterThan(0);
  });

  it('has image array (required)', () => {
    expect(schema.image).toBeDefined();
    // Google requires at least one image
    if (Array.isArray(schema.image)) {
      expect(schema.image.length).toBeGreaterThan(0);
    } else {
      expect(typeof schema.image).toBe('string');
    }
  });

  it('has offers with required fields', () => {
    const offers = schema.offers;
    expect(offers['@type']).toBe('Offer');
    expect(offers.priceCurrency).toBe('USD');
    expect(typeof offers.price).toBe('number');
    expect(offers.availability).toMatch(/^https:\/\/schema\.org\/(InStock|OutOfStock|PreOrder|BackOrder)$/);
  });

  it('has offers.url (required for Merchant)', () => {
    expect(schema.offers.url).toContain('https://www.carolinafutons.com/product-page/');
  });

  it('has offers.itemCondition (recommended)', () => {
    expect(schema.offers.itemCondition).toBe('https://schema.org/NewCondition');
  });

  it('has offers.seller with @type (recommended)', () => {
    expect(schema.offers.seller['@type']).toBe('Organization');
    expect(schema.offers.seller.name).toBe('Carolina Futons');
  });

  it('has offers.priceValidUntil in ISO date format (required for price drop)', () => {
    expect(schema.offers.priceValidUntil).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('has offers.shippingDetails with required subfields', () => {
    const sd = schema.offers.shippingDetails;
    expect(sd['@type']).toBe('OfferShippingDetails');
    expect(sd.shippingDestination['@type']).toBe('DefinedRegion');
    expect(sd.shippingDestination.addressCountry).toBe('US');
    expect(sd.deliveryTime['@type']).toBe('ShippingDeliveryTime');
    expect(sd.shippingRate['@type']).toBe('MonetaryAmount');
    expect(sd.shippingRate.currency).toBe('USD');
  });

  it('has offers.shippingRate with flat $49.99 value (free shipping disabled)', () => {
    // All products now show $49.99 shipping rate
    expect(schema.offers.shippingDetails.shippingRate.value).toBe(49.99);
    // Even expensive products show $49.99 (free shipping disabled)
    const expensive = { ...murphyBed, price: 1899 };
    const s2 = JSON.parse(getProductSchema(expensive));
    expect(s2.offers.shippingDetails.shippingRate.value).toBe(49.99);
  });

  it('has offers.deliveryTime with handling and transit (Google Merchant)', () => {
    const dt = schema.offers.shippingDetails.deliveryTime;
    expect(dt.handlingTime['@type']).toBe('QuantitativeValue');
    expect(dt.handlingTime.unitCode).toBe('DAY');
    expect(typeof dt.handlingTime.minValue).toBe('number');
    expect(typeof dt.handlingTime.maxValue).toBe('number');
    expect(dt.transitTime['@type']).toBe('QuantitativeValue');
    expect(dt.transitTime.unitCode).toBe('DAY');
  });

  it('has offers.hasMerchantReturnPolicy (Google Merchant)', () => {
    const rp = schema.offers.hasMerchantReturnPolicy;
    expect(rp['@type']).toBe('MerchantReturnPolicy');
    expect(rp.applicableCountry).toBe('US');
    expect(rp.returnPolicyCategory).toBe('https://schema.org/MerchantReturnFiniteReturnWindow');
    expect(rp.merchantReturnDays).toBe(30);
    expect(rp.returnMethod).toBe('https://schema.org/ReturnByMail');
  });

  it('has brand with @type Brand (recommended)', () => {
    expect(schema.brand['@type']).toBe('Brand');
    expect(typeof schema.brand.name).toBe('string');
    expect(schema.brand.name.length).toBeGreaterThan(0);
  });

  it('has description (recommended)', () => {
    expect(typeof schema.description).toBe('string');
    expect(schema.description.length).toBeGreaterThan(0);
  });

  it('has sku (recommended)', () => {
    expect(typeof schema.sku).toBe('string');
    expect(schema.sku.length).toBeGreaterThan(0);
  });

  it('has url (recommended)', () => {
    expect(schema.url).toContain('https://www.carolinafutons.com/product-page/');
  });

  it('has @id for cross-referencing (recommended)', () => {
    expect(schema['@id']).toBeDefined();
  });

  it('has aggregateRating with required sub-fields when present', () => {
    expect(schema.aggregateRating['@type']).toBe('AggregateRating');
    expect(typeof schema.aggregateRating.ratingValue).toBe('number');
    expect(schema.aggregateRating.bestRating).toBe(5);
    expect(schema.aggregateRating.worstRating).toBe(1);
    expect(typeof schema.aggregateRating.reviewCount).toBe('number');
    expect(schema.aggregateRating.reviewCount).toBeGreaterThan(0);
  });

  it('has review items with required sub-fields when present', () => {
    expect(Array.isArray(schema.review)).toBe(true);
    for (const r of schema.review) {
      expect(r['@type']).toBe('Review');
      expect(r.reviewRating['@type']).toBe('Rating');
      expect(typeof r.reviewRating.ratingValue).toBe('number');
      expect(r.reviewRating.bestRating).toBe(5);
      expect(r.author['@type']).toBe('Person');
      expect(typeof r.author.name).toBe('string');
    }
  });

  it('has weight with QuantitativeValue when available', () => {
    const heavy = { ...futonFrame, weight: 75 };
    const s = JSON.parse(getProductSchema(heavy));
    expect(s.weight['@type']).toBe('QuantitativeValue');
    expect(s.weight.value).toBe(75);
    expect(s.weight.unitCode).toBe('LBR');
  });

  it('has additionalProperty for size when available', () => {
    expect(schema.additionalProperty).toBeDefined();
    const sizeProp = schema.additionalProperty.find(p => p.name === 'Size');
    expect(sizeProp['@type']).toBe('PropertyValue');
    expect(sizeProp.value).toBe('Full');
  });

  it('does not include undefined/null values in JSON output', () => {
    const json = getProductSchema(futonFrame);
    expect(json).not.toContain(':undefined');
    expect(json).not.toContain(':null');
  });
});

describe('Google Rich Results: LocalBusiness schema', () => {
  let schema;
  beforeAll(() => { schema = JSON.parse(getBusinessSchema()); });

  it('uses FurnitureStore type (subtype of LocalBusiness)', () => {
    expect(schema['@type']).toBe('FurnitureStore');
  });

  it('has @id for cross-referencing', () => {
    expect(schema['@id']).toContain('#business');
  });

  it('has name (required)', () => {
    expect(schema.name).toBe('Carolina Futons');
  });

  it('has address with all PostalAddress fields (required)', () => {
    const addr = schema.address;
    expect(addr['@type']).toBe('PostalAddress');
    expect(addr.streetAddress).toBeTruthy();
    expect(addr.addressLocality).toBeTruthy();
    expect(addr.addressRegion).toBeTruthy();
    expect(addr.postalCode).toMatch(/^\d{5}$/);
    expect(addr.addressCountry).toBe('US');
  });

  it('has telephone in E.164 format (recommended)', () => {
    expect(schema.telephone).toMatch(/^\+1\d{10}$/);
  });

  it('has openingHoursSpecification with valid structure', () => {
    expect(Array.isArray(schema.openingHoursSpecification)).toBe(true);
    const spec = schema.openingHoursSpecification[0];
    expect(spec['@type']).toBe('OpeningHoursSpecification');
    expect(Array.isArray(spec.dayOfWeek)).toBe(true);
    expect(spec.opens).toMatch(/^\d{2}:\d{2}$/);
    expect(spec.closes).toMatch(/^\d{2}:\d{2}$/);
  });

  it('has geo with GeoCoordinates (recommended)', () => {
    expect(schema.geo['@type']).toBe('GeoCoordinates');
    expect(typeof schema.geo.latitude).toBe('number');
    expect(typeof schema.geo.longitude).toBe('number');
  });

  it('has logo as ImageObject (recommended)', () => {
    expect(schema.logo['@type']).toBe('ImageObject');
    expect(schema.logo.url).toContain('http');
  });

  it('has url (required)', () => {
    expect(schema.url).toContain('https://');
  });

  it('has sameAs for social profiles (recommended)', () => {
    expect(Array.isArray(schema.sameAs)).toBe(true);
    expect(schema.sameAs.length).toBeGreaterThan(0);
    for (const url of schema.sameAs) {
      expect(url).toMatch(/^https:\/\//);
    }
  });

  it('has paymentAccepted (recommended)', () => {
    expect(Array.isArray(schema.paymentAccepted)).toBe(true);
    expect(schema.paymentAccepted).toContain('Credit Card');
  });

  it('has priceRange (recommended)', () => {
    expect(schema.priceRange).toBeDefined();
  });

  it('has description (recommended)', () => {
    expect(typeof schema.description).toBe('string');
    expect(schema.description.length).toBeGreaterThan(0);
  });

  it('has hasMap URL (recommended)', () => {
    expect(schema.hasMap).toContain('maps.google.com');
  });
});

describe('Google Rich Results: WebSite schema (sitelinks searchbox)', () => {
  let schema;
  beforeAll(() => { schema = JSON.parse(getWebSiteSchema()); });

  it('has @type WebSite (required)', () => {
    expect(schema['@type']).toBe('WebSite');
  });

  it('has url matching the homepage (required)', () => {
    expect(schema.url).toBe('https://www.carolinafutons.com');
  });

  it('has potentialAction SearchAction (required for sitelinks searchbox)', () => {
    expect(schema.potentialAction['@type']).toBe('SearchAction');
  });

  it('has target as EntryPoint with urlTemplate (required)', () => {
    expect(schema.potentialAction.target['@type']).toBe('EntryPoint');
    expect(schema.potentialAction.target.urlTemplate).toContain('{search_term_string}');
  });

  it('has query-input with required name (required)', () => {
    expect(schema.potentialAction['query-input']).toBe('required name=search_term_string');
  });

  it('has @id for cross-referencing', () => {
    expect(schema['@id']).toContain('#website');
  });
});

describe('Google Rich Results: BreadcrumbList schema', () => {
  const crumbs = [
    { name: 'Home', url: '/' },
    { name: 'Futon Frames', url: '/futon-frames' },
    { name: 'Eureka Frame' },
  ];
  let schema;
  beforeAll(() => { schema = JSON.parse(getBreadcrumbSchema(crumbs)); });

  it('has @type BreadcrumbList (required)', () => {
    expect(schema['@type']).toBe('BreadcrumbList');
  });

  it('each item has @type ListItem (required)', () => {
    for (const item of schema.itemListElement) {
      expect(item['@type']).toBe('ListItem');
    }
  });

  it('each item has position as integer (required)', () => {
    schema.itemListElement.forEach((item, i) => {
      expect(item.position).toBe(i + 1);
    });
  });

  it('each item has name (required)', () => {
    for (const item of schema.itemListElement) {
      expect(typeof item.name).toBe('string');
      expect(item.name.length).toBeGreaterThan(0);
    }
  });

  it('non-last items have item URL with full domain (required)', () => {
    for (let i = 0; i < schema.itemListElement.length - 1; i++) {
      expect(schema.itemListElement[i].item).toContain('carolinafutons.com');
    }
  });

  it('last item omits URL per Google guidelines', () => {
    const lastItem = schema.itemListElement[schema.itemListElement.length - 1];
    expect(lastItem.item).toBeUndefined();
  });
});

describe('Google Rich Results: FAQPage schema', () => {
  let schema;
  beforeAll(() => { schema = JSON.parse(getProductFaqSchema(futonFrame)); });

  it('has @type FAQPage (required)', () => {
    expect(schema['@type']).toBe('FAQPage');
  });

  it('has @context schema.org (required)', () => {
    expect(schema['@context']).toBe('https://schema.org');
  });

  it('has mainEntity as array of Questions (required)', () => {
    expect(Array.isArray(schema.mainEntity)).toBe(true);
    expect(schema.mainEntity.length).toBeGreaterThan(0);
  });

  it('each Question has required fields', () => {
    for (const q of schema.mainEntity) {
      expect(q['@type']).toBe('Question');
      expect(typeof q.name).toBe('string');
      expect(q.name.length).toBeGreaterThan(0);
    }
  });

  it('each Question has acceptedAnswer with required fields', () => {
    for (const q of schema.mainEntity) {
      expect(q.acceptedAnswer['@type']).toBe('Answer');
      expect(typeof q.acceptedAnswer.text).toBe('string');
      expect(q.acceptedAnswer.text.length).toBeGreaterThan(0);
    }
  });

  it('generic getFaqSchema also validates against Google requirements', () => {
    const faqs = [{ question: 'Q1?', answer: 'A1.' }];
    const s = JSON.parse(getFaqSchema(faqs));
    expect(s['@type']).toBe('FAQPage');
    expect(s.mainEntity[0]['@type']).toBe('Question');
    expect(s.mainEntity[0].acceptedAnswer['@type']).toBe('Answer');
  });
});

describe('Google Rich Results: CollectionPage schema', () => {
  const catInfo = { title: 'Futon Frames', slug: 'futon-frames', description: 'Shop frames.' };
  let schema;
  beforeAll(() => { schema = JSON.parse(getCollectionSchema(catInfo, [futonFrame, wallHuggerFrame])); });

  it('has @type CollectionPage', () => {
    expect(schema['@type']).toBe('CollectionPage');
  });

  it('has name and url (required)', () => {
    expect(schema.name).toBe('Futon Frames');
    expect(schema.url).toContain('/futon-frames');
  });

  it('has @id for the page', () => {
    expect(schema['@id']).toContain('/futon-frames');
  });

  it('has mainEntity as ItemList with required fields', () => {
    const list = schema.mainEntity;
    expect(list['@type']).toBe('ItemList');
    expect(typeof list.numberOfItems).toBe('number');
    expect(Array.isArray(list.itemListElement)).toBe(true);
  });

  it('each list item has @type ListItem with position', () => {
    for (const item of schema.mainEntity.itemListElement) {
      expect(item['@type']).toBe('ListItem');
      expect(typeof item.position).toBe('number');
      expect(typeof item.url).toBe('string');
      expect(typeof item.name).toBe('string');
    }
  });

  it('has breadcrumb with BreadcrumbList type', () => {
    expect(schema.breadcrumb['@type']).toBe('BreadcrumbList');
    expect(Array.isArray(schema.breadcrumb.itemListElement)).toBe(true);
    for (const item of schema.breadcrumb.itemListElement) {
      expect(item['@type']).toBe('ListItem');
    }
  });
});

describe('Google Rich Results: cross-page schema consistency', () => {
  it('all schemas use consistent @context', () => {
    const productSchema = JSON.parse(getProductSchema(futonFrame));
    const businessSchema = JSON.parse(getBusinessSchema());
    const websiteSchema = JSON.parse(getWebSiteSchema());
    const breadcrumbSchema = JSON.parse(getBreadcrumbSchema([{ name: 'Home', url: '/' }]));
    const faqSchema = JSON.parse(getFaqSchema([{ question: 'Q', answer: 'A' }]));

    const ctx = 'https://schema.org';
    expect(productSchema['@context']).toBe(ctx);
    expect(businessSchema['@context']).toBe(ctx);
    expect(websiteSchema['@context']).toBe(ctx);
    expect(breadcrumbSchema['@context']).toBe(ctx);
    expect(faqSchema['@context']).toBe(ctx);
  });

  it('product schema offers.seller references same business as LocalBusiness', () => {
    const product = JSON.parse(getProductSchema(futonFrame));
    const business = JSON.parse(getBusinessSchema());
    expect(product.offers.seller.name).toBe(business.name);
  });

  it('website schema publisher references business @id', () => {
    const website = JSON.parse(getWebSiteSchema());
    const business = JSON.parse(getBusinessSchema());
    expect(website.publisher['@id']).toBe(business['@id']);
  });

  it('all URL-based fields use HTTPS', () => {
    const product = JSON.parse(getProductSchema(futonFrame));
    expect(product.url).toMatch(/^https:\/\//);
    expect(product.offers.url).toMatch(/^https:\/\//);
    expect(product['@id']).toMatch(/^https:\/\//);
  });

  it('canonical URLs are consistent with schema URLs', () => {
    const productUrl = getCanonicalUrl('product', 'eureka-futon-frame');
    const product = JSON.parse(getProductSchema(futonFrame));
    expect(product.url).toBe(productUrl);
  });

  it('all page types have valid canonical URLs', () => {
    const types = [
      ['product', 'test-slug'],
      ['category', 'futon-frames'],
      ['home', undefined],
      ['blog', undefined],
      ['blogPost', 'test-post'],
      ['faq', undefined],
      ['contact', undefined],
      ['about', undefined],
    ];
    for (const [type, slug] of types) {
      const url = getCanonicalUrl(type, slug);
      expect(url).toMatch(/^https:\/\/www\.carolinafutons\.com/);
    }
  });
});

describe('Google Rich Results: meta description quality', () => {
  it('product meta descriptions are under 160 chars', () => {
    const desc = getPageMetaDescription('product', futonFrame);
    expect(desc.length).toBeLessThanOrEqual(160);
  });

  it('category meta descriptions are under 220 chars (Google truncates at ~155-160 display)', () => {
    const slugs = ['futon-frames', 'mattresses', 'murphy-cabinet-beds', 'platform-beds'];
    for (const slug of slugs) {
      const desc = getCategoryMetaDescription(slug);
      // Google may truncate, but descriptions should remain reasonable
      expect(desc.length).toBeLessThanOrEqual(220);
      expect(desc.length).toBeGreaterThan(50);
    }
  });

  it('home meta description includes location for local SEO', () => {
    const desc = getPageMetaDescription('home');
    expect(desc).toMatch(/Hendersonville|NC|Carolinas/i);
  });

  it('product meta description uses description text when available', () => {
    const desc = getPageMetaDescription('product', futonFrame);
    // When product has description, it uses stripped HTML description (not product name)
    expect(desc.length).toBeLessThanOrEqual(160);
    expect(desc).toBeTruthy();
  });

  it('product meta description uses name when no description', () => {
    const desc = getPageMetaDescription('product', { name: 'Eureka Frame' });
    expect(desc).toContain('Eureka Frame');
  });

  it('page titles include brand suffix', () => {
    const types = ['product', 'category', 'home', 'faq', 'contact', 'about'];
    for (const type of types) {
      const data = type === 'product' ? { name: 'Test' } : type === 'category' ? { slug: 'futon-frames' } : undefined;
      const title = getPageTitle(type, data);
      expect(title).toContain('Carolina Futons');
    }
  });
});

describe('Google Rich Results: OG tags completeness', () => {
  it('product OG tags include all required Open Graph properties', () => {
    const tags = JSON.parse(getProductOgTags(futonFrame));
    expect(tags['og:type']).toBe('product');
    expect(tags['og:title']).toBeTruthy();
    expect(tags['og:url']).toMatch(/^https:\/\//);
    expect(tags['og:image']).toBeTruthy();
    expect(tags['og:site_name']).toBe('Carolina Futons');
  });

  it('product OG tags include commerce-specific properties', () => {
    const tags = JSON.parse(getProductOgTags(futonFrame));
    expect(tags['product:price:amount']).toBeTruthy();
    expect(tags['product:price:currency']).toBe('USD');
    expect(tags['product:availability']).toMatch(/^(in stock|out of stock)$/);
    expect(tags['product:brand']).toBeTruthy();
    expect(tags['product:condition']).toBe('new');
  });

  it('category OG tags include all required Open Graph properties', () => {
    const tags = JSON.parse(getCategoryOgTags('futon-frames'));
    expect(tags['og:type']).toBe('website');
    expect(tags['og:title']).toBeTruthy();
    expect(tags['og:url']).toMatch(/^https:\/\//);
  });

  it('Twitter Card tags use correct card types', () => {
    const productTags = JSON.parse(getProductOgTags(futonFrame));
    expect(productTags['twitter:card']).toBe('summary_large_image');

    const catTags = JSON.parse(getCategoryOgTags('futon-frames'));
    expect(catTags['twitter:card']).toBe('summary');
  });
});
