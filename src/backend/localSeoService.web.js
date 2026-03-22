/**
 * @module localSeoService
 * @description WebMethod layer for /near/[city] local SEO landing pages.
 * Returns city page data, SEO metadata, slug lists, and product recommendations.
 *
 * Static city data sourced from backend/utils/localSeoData.
 * Product recommendations query Stores/Products live, ordered by salesRank.
 *
 * @requires wix-web-module
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { validateSlug } from 'backend/utils/sanitize';
import {
  LOCAL_PAGES,
  SITE_URL,
  STORE_DIRECTIONS_URL,
} from 'backend/utils/localSeoData';
import { generateLocalBusinessSchema, SCHEMA_OPENING_HOURS, STORE_HOURS_DISPLAY } from 'backend/localSeo.web';
import { buildBreadcrumbSchema, buildBreadcrumbList, buildFaqSchema } from 'public/localSeoHelpers';

const CMS_COLLECTION = 'LocalSeoCities';

// ── CMS helpers ───────────────────────────────────────────────────────

/**
 * Parse a JSON string field into an array. Returns [] on any failure.
 * Accepts already-parsed arrays for defensive use with mixed CMS field types.
 */
function _parseJsonField(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

/**
 * Map a LocalSeoCities CMS record to the cityData shape used by getLocalPage.
 */
function _normalizeCmsCity(item) {
  return {
    slug: item.slug,
    city: item.city,
    state: item.state,
    headline: item.headline || '',
    heroDescription: item.heroDescription || '',
    neighborhoodContext: item.neighborhoodContext || '',
    metaTitle: item.metaTitle || null,
    metaDescription: item.metaDescription || null,
    preferredCategories: Array.isArray(item.preferredCategories) ? item.preferredCategories : [],
    categoryRecommendations: _parseJsonField(item.categoryRecommendations),
    faqs: _parseJsonField(item.faqs),
    distance: item.distance || '',
    isHomeCity: Boolean(item.isHomeCity),
    nearbyAreas: Array.isArray(item.nearbyAreas) ? item.nearbyAreas : [],
    mapEmbedUrl: item.mapEmbedUrl || '',
    directions: item.directions || '',
  };
}

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

      // CMS-primary: query LocalSeoCities first, fall through to static on miss or error
      let cityData = null;
      try {
        const cmsResult = await wixData.query(CMS_COLLECTION).eq('slug', cleanSlug).find();
        if (cmsResult.items.length > 0) {
          cityData = _normalizeCmsCity(cmsResult.items[0]);
        }
      } catch {
        // CMS unavailable — fall through to static
      }
      if (!cityData) {
        cityData = LOCAL_PAGES[cleanSlug] || null;
      }
      if (!cityData) {
        return { success: true, page: null };
      }

      const canonicalUrl = `${SITE_URL}/near/${cityData.slug}`;

      const faqItems = Array.isArray(cityData.faqs) ? cityData.faqs : [];
      const breadcrumbs = buildBreadcrumbList(cityData, SITE_URL);
      const localBusinessSchema = generateLocalBusinessSchema(cityData);
      const faqSchema = buildFaqSchema(faqItems);
      const breadcrumbSchema = buildBreadcrumbSchema(cityData, SITE_URL);

      // Fetch live product recommendations — non-critical, page still renders on failure
      let featuredProducts = [];
      try {
        featuredProducts = await _fetchProductsByCity(cityData, 4);
      } catch (e) {
        console.warn('[localSeoService] Failed to fetch featured products for page:', cleanSlug, e.message, e);
      }

      return {
        success: true,
        page: {
          slug: cityData.slug,
          city: cityData.city,
          state: cityData.state,
          isHomeCity: cityData.isHomeCity,
          headline: cityData.headline,
          heroDescription: cityData.heroDescription || '',
          neighborhoodContext: cityData.neighborhoodContext || '',
          metaTitle: _buildMetaTitle(cityData),
          metaDescription: _buildMetaDescription(cityData),
          canonicalUrl,
          storeHours: SCHEMA_OPENING_HOURS,
          storeHoursDisplay: STORE_HOURS_DISPLAY,
          categoryRecommendations: Array.isArray(cityData.categoryRecommendations) ? cityData.categoryRecommendations : [],
          faqItems,
          // Legacy alias for backward compat with existing page components — remove once all callers migrate to faqItems
          faqs: faqItems,
          breadcrumbs,
          jsonLd: localBusinessSchema,
          breadcrumbSchema,
          faqSchema,
          // Combined structured data bundle for page <head> injection
          schemaData: {
            localBusiness: localBusinessSchema,
            faqPage: faqSchema,
            breadcrumb: breadcrumbSchema,
          },
          featuredProducts,
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

// ── _fetchProductsByCity (internal helper) ────────────────────────────

/**
 * Query Stores/Products ordered by salesRank, optionally filtered by the
 * city's preferredCategories. Called by both getFeaturedProductsForCity and
 * getLocalPage so product objects are consistent across both callers.
 *
 * @param {Object} cityData - City config from LOCAL_PAGES.
 * @param {number} [limit=4] - Max products to return. Clamped internally to [1, 20];
 *   non-numeric values fall back to 4.
 * @returns {Promise<Array>} Mapped product objects.
 */
async function _fetchProductsByCity(cityData, limit = 4) {
  const safeLimit = Math.max(1, Math.min(Number.isNaN(Number(limit)) ? 4 : Number(limit), 20));
  let query = wixData.query('Stores/Products').ascending('salesRank').limit(safeLimit);

  if (Array.isArray(cityData.preferredCategories) && cityData.preferredCategories.length > 0) {
    query = query.hasSome('categories', cityData.preferredCategories);
  }

  const result = await query.find();
  const items = Array.isArray(result?.items) ? result.items : [];
  return items.map(p => ({
    productId: p._id,
    name: p.name,
    price: p.price,
    formattedPrice: p.formattedPrice || `$${p.price}`,
    imageUrl: p.mainMedia || '',
    productPageUrl: `${SITE_URL}/product-page/${p.slug}`,
    salesRank: p.salesRank,
    categories: Array.isArray(p.categories) ? p.categories : [],
  }));
}

// ── getFeaturedProductsForCity ────────────────────────────────────────

/**
 * Get featured products for a /near/[slug] city landing page.
 * Queries Wix Stores ordered by salesRank. Filters by cityData.preferredCategories
 * when set; otherwise returns top products across all categories.
 *
 * @param {string} slug - City slug (e.g. 'asheville-nc').
 * @param {number} [limit=4] - Max products to return. Clamped to [1, 20].
 * @returns {Promise<{success: boolean, products: Array, error?: string}>}
 *   - success: false, error: string — invalid slug (empty/path-traversal)
 *   - success: false, error: string — Wix Stores query error
 *   - success: true, products: [] — valid slug but no city defined, or no category matches
 *   - success: true, products: Array — up to `limit` product objects ordered by salesRank
 */
export const getFeaturedProductsForCity = webMethod(
  Permissions.Anyone,
  async (slug, limit = 4) => {
    try {
      const cleanSlug = validateSlug(slug);
      if (!cleanSlug) {
        return { success: false, error: 'Slug is required.', products: [] };
      }

      const cityData = LOCAL_PAGES[cleanSlug];
      if (!cityData) {
        return { success: true, products: [] };
      }

      const products = await _fetchProductsByCity(cityData, limit);
      return { success: true, products };
    } catch (err) {
      console.error('[localSeoService] Error loading featured products:', slug, err.name, err.message, err);
      return { success: false, error: 'Failed to load featured products.', products: [] };
    }
  }
);

// ── getRelatedCityLinks ───────────────────────────────────────────────

/**
 * Get internal cross-links to all other defined city pages.
 * Nearby cities (listed in the current page's nearbyAreas) are flagged and
 * sorted first; remaining cities are sorted alphabetically by city name.
 *
 * Filters to only defined slugs so no dead links are returned.
 *
 * @param {string} slug - Current city slug (excluded from results).
 * @returns {Promise<{success: boolean, links: Array, error?: string}>}
 *   Each link: { slug, city, state, url, isNearby: boolean }
 */
export const getRelatedCityLinks = webMethod(
  Permissions.Anyone,
  async (slug) => {
    try {
      const cleanSlug = validateSlug(slug);
      if (!cleanSlug) {
        return { success: false, error: 'Slug is required.', links: [] };
      }

      const currentCity = LOCAL_PAGES[cleanSlug];
      const nearbySet = new Set(
        Array.isArray(currentCity?.nearbyAreas) ? currentCity.nearbyAreas : []
      );

      const links = Object.values(LOCAL_PAGES)
        .filter(city => city.slug !== cleanSlug)
        .map(city => ({
          slug: city.slug,
          city: city.city,
          state: city.state,
          url: `${SITE_URL}/near/${city.slug}`,
          isNearby: nearbySet.has(city.slug),
        }))
        .sort((a, b) => {
          if (a.isNearby !== b.isNearby) return a.isNearby ? -1 : 1;
          return a.city.localeCompare(b.city);
        });

      return { success: true, links };
    } catch (err) {
      console.error('[localSeoService] Error loading related city links:', slug, err.name, err.message, err);
      return { success: false, error: 'Failed to load related city links.', links: [] };
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
      let cmsSlugs = [];
      try {
        const cmsResult = await wixData.query(CMS_COLLECTION).find();
        cmsSlugs = (cmsResult.items || []).map(i => i.slug).filter(Boolean);
      } catch {
        // CMS unavailable — return static only
      }
      const staticSlugs = Object.keys(LOCAL_PAGES);
      const allSlugs = [...new Set([...staticSlugs, ...cmsSlugs])];
      return { success: true, slugs: allSlugs };
    } catch (err) {
      console.error('[localSeoService] Error getting local slugs:', err.name, err.message, err);
      return { success: false, slugs: [] };
    }
  }
);
