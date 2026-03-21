/**
 * @module localSeoService
 * @description WebMethod layer for /near/[city] local SEO landing pages.
 * Returns city page data, SEO metadata, and slug lists for route generation.
 *
 * All city data is sourced from backend/utils/localSeoData — no CMS queries.
 *
 * @requires wix-web-module
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { validateSlug } from 'backend/utils/sanitize';
import {
  LOCAL_PAGES,
  SITE_URL,
  STORE_PHONE,
  STORE_ADDRESS,
  STORE_GEO,
  STORE_HOURS,
  STORE_DIRECTIONS_URL,
  FEATURED_PRODUCT_CATALOG,
  HOME_CITY_FEATURED_CATEGORIES,
  NEARBY_CITY_FEATURED_CATEGORIES,
} from 'backend/utils/localSeoData';

// ── getLocalPage ──────────────────────────────────────────────────────

/**
 * Get all data needed to render a /near/[slug] city landing page.
 *
 * @param {string} slug - City slug (e.g. 'asheville-nc').
 * @returns {Promise<{success: boolean, page: Object|null, error?: string}>}
 *   - success: false — invalid slug (empty, path-traversal, etc.)
 *   - success: true, page: null — valid slug but no city page defined
 *   - success: true, page: Object — full page data ready to render
 */
export const getLocalPage = webMethod(
  Permissions.Anyone,
  async (slug) => {
    try {
      const cleanSlug = validateSlug(slug);
      if (!cleanSlug) {
        return { success: false, error: 'Slug is required.', page: null };
      }

      const cityData = LOCAL_PAGES[cleanSlug];
      if (!cityData) {
        return { success: true, page: null };
      }

      const canonicalUrl = `${SITE_URL}/near/${cityData.slug}`;

      return {
        success: true,
        page: {
          slug: cityData.slug,
          city: cityData.city,
          state: cityData.state,
          isHomeCity: cityData.isHomeCity,
          headline: cityData.headline,
          metaTitle: _buildMetaTitle(cityData),
          metaDescription: _buildMetaDescription(cityData),
          canonicalUrl,
          jsonLd: _buildJsonLd(cityData, canonicalUrl),
          featuredProducts: Array.isArray(cityData.featuredProducts) ? cityData.featuredProducts : [],
          mapEmbedUrl: cityData.mapEmbedUrl || '',
          directionsUrl: STORE_DIRECTIONS_URL,
          directions: cityData.directions || '',
          nearbyAreas: Array.isArray(cityData.nearbyAreas)
            ? cityData.nearbyAreas
                .filter(s => LOCAL_PAGES[s])
                .map(s => ({
                  slug: s,
                  city: LOCAL_PAGES[s].city,
                  state: LOCAL_PAGES[s].state,
                  url: `${SITE_URL}/near/${s}`,
                }))
            : [],
        },
      };
    } catch (err) {
      console.error('[localSeoService] Error loading local page:', slug, err.name, err.message, err);
      return { success: false, error: 'Failed to load local page.', page: null };
    }
  }
);

// ── SEO helpers ───────────────────────────────────────────────────────

function _buildMetaTitle(cityData) {
  if (cityData.isHomeCity) {
    return `${cityData.city} Futons & Furniture — Carolina Futons`;
  }
  return `${cityData.city} Futons & Furniture — Carolina Futons near ${cityData.city}, ${cityData.state}`;
}

function _buildMetaDescription(cityData) {
  if (cityData.isHomeCity) {
    return `Shop futons, murphy beds & mattresses in ${cityData.city}, ${cityData.state}. Carolina Futons — located in Hendersonville, NC. Family-owned since 1991. Special savings for local customers.`;
  }
  const distancePart = cityData.distance ? ` — ${cityData.distance} from ${cityData.city}` : '';
  return `Shop futons, murphy beds & mattresses near ${cityData.city}, ${cityData.state}. Visit Carolina Futons in Hendersonville NC${distancePart}.`;
}

function _buildJsonLd(cityData, canonicalUrl) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: 'Carolina Futons',
    url: canonicalUrl,
    telephone: STORE_PHONE,
    address: {
      '@type': 'PostalAddress',
      streetAddress: STORE_ADDRESS.streetAddress,
      addressLocality: STORE_ADDRESS.addressLocality,
      addressRegion: STORE_ADDRESS.addressRegion,
      postalCode: STORE_ADDRESS.postalCode,
      addressCountry: STORE_ADDRESS.addressCountry,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: STORE_GEO.latitude,
      longitude: STORE_GEO.longitude,
    },
    openingHours: STORE_HOURS,
    areaServed: `${cityData.city}, ${cityData.state}`,
  };
}

// ── getFeaturedProductsForCity ────────────────────────────────────────

/**
 * Get featured products for a /near/[slug] city landing page.
 * Fetches live product data (name, price, image) from Wix Stores by
 * hardcoded catalog IDs. Home city returns 4 categories; others return 2.
 *
 * @param {string} slug - City slug (e.g. 'asheville-nc').
 * @returns {Promise<{success: boolean, products: Array, error?: string}>}
 *   - success: false — invalid slug format
 *   - success: true, products: [] — valid slug but city not defined
 *   - success: true, products: Array — up to 4 product objects
 */
export const getFeaturedProductsForCity = webMethod(
  Permissions.Anyone,
  async (slug) => {
    try {
      const cleanSlug = validateSlug(slug);
      if (!cleanSlug) {
        return { success: false, error: 'Slug is required.', products: [] };
      }

      const cityData = LOCAL_PAGES[cleanSlug];
      if (!cityData) {
        return { success: true, products: [] };
      }

      const categories = cityData.isHomeCity
        ? HOME_CITY_FEATURED_CATEGORIES
        : NEARBY_CITY_FEATURED_CATEGORIES;

      const products = [];
      for (const category of categories) {
        const catalog = FEATURED_PRODUCT_CATALOG[category];
        if (!catalog) continue;
        try {
          const product = await wixData.get('Stores/Products', catalog.productId);
          if (product) {
            products.push({
              productId: product._id,
              name: product.name,
              price: product.price,
              formattedPrice: product.formattedPrice || `$${product.price}`,
              imageUrl: product.mainMedia || '',
              productPageUrl: `${SITE_URL}/product-page/${product.slug}`,
            });
          }
        } catch (e) {
          console.error('[localSeoService] Failed to fetch product:', catalog.productId, e.message);
        }
      }

      return { success: true, products };
    } catch (err) {
      console.error('[localSeoService] Error loading featured products:', slug, err.name, err.message, err);
      return { success: false, error: 'Failed to load featured products.', products: [] };
    }
  }
);

// ── getAllLocalSlugs ──────────────────────────────────────────────────

/**
 * Get all defined city slugs for static route generation.
 *
 * @returns {Promise<{success: boolean, slugs: string[]}>}
 */
export const getAllLocalSlugs = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      return { success: true, slugs: Object.keys(LOCAL_PAGES) };
    } catch (err) {
      console.error('[localSeoService] Error getting local slugs:', err.name, err.message, err);
      return { success: false, slugs: [] };
    }
  }
);
