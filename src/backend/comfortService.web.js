/**
 * @module comfortService
 * @description Backend web module for comfort level data.
 * Queries ComfortLevels and ProductComfort CMS collections to provide
 * comfort personality descriptions (Plush/Medium/Firm) and product-comfort
 * mappings for the Feel & Comfort product page section and category filters.
 *
 * @requires wix-web-module
 * @requires wix-data
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';

/**
 * Get all comfort levels with personality descriptions and illustrations.
 * Returns Plush, Medium, Firm sorted by sortOrder.
 *
 * @function getComfortLevels
 * @returns {Promise<Array<{slug, name, tagline, description, illustration, illustrationAlt}>>}
 * @permission Anyone
 */
export const getComfortLevels = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      const results = await wixData.query('ComfortLevels')
        .ascending('sortOrder')
        .find();

      return results.items.map(item => ({
        slug: item.slug,
        name: item.name,
        tagline: item.tagline,
        description: item.description,
        illustration: item.illustration,
        illustrationAlt: item.illustrationAlt,
      }));
    } catch (err) {
      console.error('Error fetching comfort levels:', err);
      return [];
    }
  }
);

/**
 * Get the comfort level for a specific product.
 * Looks up the ProductComfort mapping, then fetches the full comfort level data.
 *
 * @function getProductComfort
 * @param {string} productId - The product ID to look up.
 * @returns {Promise<{slug, name, tagline, description, illustration, illustrationAlt}|null>}
 * @permission Anyone
 */
export const getProductComfort = webMethod(
  Permissions.Anyone,
  async (productId) => {
    try {
      if (!productId) return null;

      const mapping = await wixData.query('ProductComfort')
        .eq('productId', productId)
        .limit(1)
        .find();

      if (!mapping.items || mapping.items.length === 0) return null;

      const comfortLevelId = mapping.items[0].comfortLevelId;

      const level = await wixData.query('ComfortLevels')
        .eq('_id', comfortLevelId)
        .limit(1)
        .find();

      if (!level.items || level.items.length === 0) return null;

      const item = level.items[0];
      return {
        slug: item.slug,
        name: item.name,
        tagline: item.tagline,
        description: item.description,
        illustration: item.illustration,
        illustrationAlt: item.illustrationAlt,
      };
    } catch (err) {
      console.error('Error fetching product comfort:', err);
      return null;
    }
  }
);

/**
 * Get product IDs that match a given comfort level slug.
 * Used for comfort filtering on category pages.
 *
 * @function getComfortProducts
 * @param {string} comfortSlug - The comfort level slug (plush, medium, firm).
 * @returns {Promise<string[]>} Array of product IDs.
 * @permission Anyone
 */
export const getComfortProducts = webMethod(
  Permissions.Anyone,
  async (comfortSlug) => {
    try {
      if (!comfortSlug) return [];

      // Find the comfort level ID from slug
      const levelResult = await wixData.query('ComfortLevels')
        .eq('slug', comfortSlug)
        .limit(1)
        .find();

      if (!levelResult.items || levelResult.items.length === 0) return [];

      const comfortLevelId = levelResult.items[0]._id;

      // Find all product mappings for this comfort level
      const mappings = await wixData.query('ProductComfort')
        .eq('comfortLevelId', comfortLevelId)
        .ascending('sortOrder')
        .find();

      return mappings.items.map(m => m.productId);
    } catch (err) {
      console.error('Error fetching comfort products:', err);
      return [];
    }
  }
);
