/**
 * @module localSeo
 * @description Schema markup utilities for /near/[city] local SEO landing pages.
 * Generates LocalBusiness + FurnitureStore JSON-LD for Google rich results.
 *
 * @requires backend/utils/localSeoData
 */

import { SITE_URL, STORE_PHONE, STORE_GEO, STORE_ADDRESS, CITY_GEO } from 'backend/utils/localSeoData';

// '@type' is kept here (not in STORE_ADDRESS) so the plain address object stays
// schema-agnostic. Do not add '@type' to STORE_ADDRESS — it would override this.
const SCHEMA_ADDRESS = {
  '@type': 'PostalAddress',
  ...STORE_ADDRESS,
};

// Wed-Fri 10am-5pm, Sat 10am-4pm — schema.org openingHours format
export const SCHEMA_OPENING_HOURS = ['We-Fr 10:00-17:00', 'Sa 10:00-16:00'];
// Human-readable hours for display in UI (not schema.org format)
export const STORE_HOURS_DISPLAY = ['Wed–Fri: 10am–5pm', 'Sat: 10am–4pm'];

/**
 * Generate a LocalBusiness + FurnitureStore JSON-LD schema for a city page.
 *
 * Safe to call with null/undefined city — returns a valid fallback schema
 * rather than throwing, so callers never get a 500 from missing params.
 *
 * @param {Object|null} city - City data: { city, state, slug } or null/undefined.
 * @param {Array} [products=[]] - Optional featured products; included as hasOfferCatalog.
 * @returns {Object} Valid JSON-LD schema object (always returns, never throws).
 */
export function generateLocalBusinessSchema(city, products = []) {
  const hasCity = city != null && typeof city === 'object' && city.city;

  const name = hasCity
    ? `Carolina Futons — ${city.city}, ${city.state || 'NC'}`
    : 'Carolina Futons';

  const url = hasCity && city.slug
    ? `${SITE_URL}/near/${city.slug}`
    : SITE_URL;

  const areaServed = hasCity
    ? `${city.city}, ${city.state || 'NC'}`
    : 'Hendersonville, NC';

  // Per-city geo for local search proximity signal. Falls back to store coords
  // (Hendersonville) when city is null, slug is missing, or slug is not in CITY_GEO.
  const cityGeoEntry = hasCity && city.slug ? CITY_GEO[city.slug] : null;
  if (hasCity && city.slug && !cityGeoEntry) {
    console.warn('[localSeo] generateLocalBusinessSchema: no CITY_GEO entry for slug:', city.slug, '— falling back to STORE_GEO');
  }
  const cityGeo = cityGeoEntry || STORE_GEO;

  const schema = {
    '@context': 'https://schema.org',
    '@type': ['LocalBusiness', 'FurnitureStore'],
    name,
    url,
    telephone: STORE_PHONE,
    address: SCHEMA_ADDRESS,
    geo: {
      '@type': 'GeoCoordinates',
      latitude: cityGeo.latitude,
      longitude: cityGeo.longitude,
    },
    openingHours: SCHEMA_OPENING_HOURS,
    areaServed,
  };

  if (Array.isArray(products) && products.length > 0) {
    schema.hasOfferCatalog = {
      '@type': 'OfferCatalog',
      name: 'Futon Products',
      itemListElement: products.map(p => ({
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Product',
          name: p && p.name ? String(p.name) : String(p),
        },
      })),
    };
  }

  return schema;
}
