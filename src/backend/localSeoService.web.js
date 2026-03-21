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
import { validateSlug } from 'backend/utils/sanitize';
import { LOCAL_PAGES, SITE_URL } from 'backend/utils/localSeoData';

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

      return {
        success: true,
        page: {
          slug: cityData.slug,
          city: cityData.city,
          state: cityData.state,
          isHomeCity: cityData.isHomeCity,
          headline: cityData.headline,
          metaTitle: cityData.metaTitle,
          metaDescription: cityData.metaDescription,
          canonicalUrl: `${SITE_URL}/near/${cityData.slug}`,
          featuredProducts: Array.isArray(cityData.featuredProducts) ? cityData.featuredProducts : [],
          mapEmbedUrl: cityData.mapEmbedUrl || '',
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
