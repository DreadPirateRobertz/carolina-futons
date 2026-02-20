import { describe, it, expect } from 'vitest';
import { futonFrame, wallHuggerFrame, futonMattress, murphyBed, platformBed, casegoodsItem } from './fixtures/products.js';
import {
  getProductSchema,
  getBusinessSchema,
  getBreadcrumbSchema,
  getFaqSchema,
  generateAltText,
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
    const crumbs = [{ name: 'Home', url: '/' }];
    const schema = JSON.parse(getBreadcrumbSchema(crumbs));
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
    expect(alt).toContain('Natural finish');
    expect(alt).toContain('Full size');
    expect(alt).toContain('Carolina Futons');
  });

  it('generates lifestyle alt text', () => {
    const alt = generateAltText(futonFrame, 'lifestyle');
    expect(alt).toContain('Eureka Futon Frame');
    expect(alt).toContain('modern living space');
    expect(alt).toContain('Carolina Futons');
  });

  it('generates detail alt text', () => {
    const alt = generateAltText(futonFrame, 'detail');
    expect(alt).toContain('Close-up detail');
    expect(alt).toContain('Natural finish');
  });

  it('generates open position alt text for futons', () => {
    const alt = generateAltText(futonFrame, 'open');
    expect(alt).toContain('open bed position');
    expect(alt).toContain('Full size');
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
