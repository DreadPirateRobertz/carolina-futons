/**
 * @module catalogNameUpdate
 * @description Batch-rename Wix catalog products to CF marketing names.
 *
 * Mapping confirmed via cross-team product name review on 2026-03-21.
 * Run from admin dashboard or via Wix backend function.
 *
 * @requires wix-web-module
 * @requires wix-stores-backend
 */
import { Permissions, webMethod } from 'wix-web-module';
import { products } from 'wix-stores-backend';

/**
 * Mapping from OtisBed/Wix current product names to CF marketing names.
 * Keys are exact current product names as they appear in the Wix catalog.
 */
export const CF_NAME_MAP = {
  // Futons
  'Gemini': 'The Gemini Full Futon',
  'Gemini II': 'The Gemini Queen Futon',
  'Chandler': 'The Chandler Full Futon',
  'Mesa': 'The Mesa Full Futon',
  'Mesa 5000': 'The Mesa Queen Futon',
  'Yuma': 'The Yuma Full Futon',
  'Prescott': 'The Prescott Full Futon',
  'Sedona': 'The Sedona Queen Futon',
  'Flagstaff': 'The Flagstaff Twin Futon',
  'Tucson': 'The Tucson Loveseat Futon',
  // Murphy Beds
  'Vail': 'The Vail Queen Murphy Cabinet Bed',
  'Aspen': 'The Aspen Full Murphy Cabinet',
  'Breckenridge': 'The Breckenridge Queen Bookcase Murphy',
  'Telluride': 'The Telluride Twin Cabinet Bed',
  'Durango': 'The Durango Queen Desk Murphy',
  'Silverton': 'The Silverton Full Storage Murphy',
};

/**
 * Batch-rename all catalog products with CF marketing names.
 * Skips products whose names are not in CF_NAME_MAP.
 *
 * @param {Object} [opts]
 * @param {boolean} [opts.dryRun=false] - Preview changes without writing.
 * @returns {Promise<{updated: number, skipped: number, errors: string[], changes: Array<{from: string, to: string, id: string}>}>}
 */
export const runCatalogNameUpdate = webMethod(
  Permissions.Admin,
  async (opts = {}) => {
    const { dryRun = false } = opts;
    const results = { updated: 0, skipped: 0, errors: [], changes: [] };

    try {
      let allProducts = [];
      let skip = 0;
      const limit = 100;

      // Paginate through all products (Wix cap: 100 per query)
      while (true) {
        const query = await products.queryProducts()
          .skip(skip)
          .limit(limit)
          .find();

        allProducts = allProducts.concat(query.items);
        if (query.items.length < limit) break;
        skip += limit;
      }

      for (const product of allProducts) {
        const currentName = product.name;
        const newName = CF_NAME_MAP[currentName];

        if (!newName) {
          results.skipped++;
          continue;
        }

        results.changes.push({ id: product._id, from: currentName, to: newName });

        if (!dryRun) {
          try {
            await products.updateProductFields(product._id, { name: newName });
            results.updated++;
          } catch (err) {
            results.errors.push(`${currentName} (${product._id}): ${err.message}`);
          }
        } else {
          results.updated++;
        }
      }
    } catch (err) {
      results.errors.push(`Query failed: ${err.message}`);
    }

    return results;
  }
);
