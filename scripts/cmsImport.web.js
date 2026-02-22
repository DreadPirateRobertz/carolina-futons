/**
 * @module cmsImport
 * @description Orchestrator web module for importing scraped product data
 * into Wix CMS collections. Callable from admin pages after deployment.
 *
 * @requires wix-web-module
 * @requires wix-members-backend - All import ops require admin auth
 *
 * Usage from admin page:
 *   import { runImport, runFullImport } from 'backend/scripts/cmsImport.web';
 *   const result = await runImport('FabricSwatches', jsonArray);
 */
import { Permissions, webMethod } from 'wix-web-module';
import { currentMember } from 'wix-members-backend';
import { importSwatches } from './importSwatches';
import { importAssemblyGuides } from './importAssemblyGuides';
import { importBundles } from './importBundles';
import { importVideos } from './importVideos';
import { importProducts, prepareProductsCsv } from './importProducts';

const IMPORTERS = {
  FabricSwatches: importSwatches,
  AssemblyGuides: importAssemblyGuides,
  ProductBundles: importBundles,
  Videos: importVideos,
  Products: importProducts,
};

/**
 * Require site member auth (admin-only operation).
 */
async function requireAdmin() {
  const member = await currentMember.getMember();
  if (!member || !member._id) {
    throw new Error('Authentication required. Only site admins can run imports.');
  }
  return member._id;
}

/**
 * Import data into a single CMS collection.
 * @param {string} collection - One of: FabricSwatches, AssemblyGuides, ProductBundles, Videos, Products
 * @param {Array} data - Array of items to import.
 * @returns {Promise<{collection: string, inserted: number, skipped: number, errors: Array}>}
 */
export const runImport = webMethod(
  Permissions.SiteMember,
  async (collection, data) => {
    try {
      await requireAdmin();

      const importer = IMPORTERS[collection];
      if (!importer) {
        return {
          collection,
          inserted: 0,
          skipped: 0,
          errors: [{ error: `Unknown collection: ${collection}. Valid: ${Object.keys(IMPORTERS).join(', ')}` }],
        };
      }

      if (!Array.isArray(data) || data.length === 0) {
        return {
          collection,
          inserted: 0,
          skipped: 0,
          errors: [{ error: 'Data must be a non-empty array' }],
        };
      }

      console.log(`[CMS Import] Starting import: ${collection} (${data.length} items)`);
      const result = await importer(data);
      console.log(`[CMS Import] Completed: ${collection} — inserted=${result.inserted}, skipped=${result.skipped}, errors=${result.errors?.length || 0}`);

      return {
        collection,
        ...result,
      };
    } catch (err) {
      console.error(`[CMS Import] Failed: ${collection}`, err);
      return {
        collection,
        inserted: 0,
        skipped: 0,
        errors: [{ error: err.message }],
      };
    }
  }
);

/**
 * Run import across all collections from a single scrape payload.
 * @param {Object} payload - Keyed by collection name.
 * @param {Array} [payload.Products] - Product data
 * @param {Array} [payload.FabricSwatches] - Swatch data
 * @param {Array} [payload.AssemblyGuides] - Assembly guide data
 * @param {Array} [payload.ProductBundles] - Bundle data
 * @param {Array} [payload.Videos] - Video data
 * @returns {Promise<{results: Object, summary: string}>}
 */
export const runFullImport = webMethod(
  Permissions.SiteMember,
  async (payload) => {
    try {
      await requireAdmin();

      if (!payload || typeof payload !== 'object') {
        return {
          results: {},
          summary: 'Invalid payload — expected object with collection keys',
        };
      }

      const results = {};
      let totalInserted = 0;
      let totalSkipped = 0;
      let totalErrors = 0;

      // Import in dependency order: Products first, then supplementary collections
      const order = ['Products', 'FabricSwatches', 'AssemblyGuides', 'ProductBundles', 'Videos'];

      for (const collection of order) {
        if (payload[collection] && Array.isArray(payload[collection]) && payload[collection].length > 0) {
          console.log(`[CMS Import] Processing ${collection} (${payload[collection].length} items)...`);
          const importer = IMPORTERS[collection];
          const result = await importer(payload[collection]);
          results[collection] = result;
          totalInserted += result.inserted || 0;
          totalSkipped += result.skipped || 0;
          totalErrors += result.errors?.length || 0;
        }
      }

      const summary = `Import complete: ${totalInserted} inserted, ${totalSkipped} skipped, ${totalErrors} errors across ${Object.keys(results).length} collections`;
      console.log(`[CMS Import] ${summary}`);

      return { results, summary };
    } catch (err) {
      console.error('[CMS Import] Full import failed:', err);
      return {
        results: {},
        summary: `Import failed: ${err.message}`,
      };
    }
  }
);

/**
 * Export products as CSV-ready format for Wix Dashboard import.
 * Useful when direct Stores/Products insert fails.
 * @param {Array} products - Scraped product data.
 * @returns {Promise<Array>} CSV-ready objects.
 */
export const getProductsCsvData = webMethod(
  Permissions.SiteMember,
  async (products) => {
    try {
      await requireAdmin();
      return prepareProductsCsv(products);
    } catch (err) {
      console.error('[CMS Import] CSV prep failed:', err);
      return [];
    }
  }
);

/**
 * Dry-run validation — check data without inserting.
 * @param {string} collection - Collection name.
 * @param {Array} data - Items to validate.
 * @returns {Promise<{valid: number, invalid: number, issues: Array}>}
 */
export const validateImportData = webMethod(
  Permissions.SiteMember,
  async (collection, data) => {
    try {
      await requireAdmin();

      if (!Array.isArray(data)) {
        return { valid: 0, invalid: 0, issues: [{ error: 'Data must be an array' }] };
      }

      const issues = [];
      let valid = 0;
      let invalid = 0;

      const requiredFields = {
        FabricSwatches: ['swatchId', 'swatchName', 'colorFamily', 'material'],
        AssemblyGuides: ['sku', 'title'],
        ProductBundles: ['bundleId', 'bundleName', 'primaryProductId'],
        Videos: ['title', 'videoUrl'],
        Products: ['name', 'description', 'price'],
      };

      const fields = requiredFields[collection];
      if (!fields) {
        return { valid: 0, invalid: 0, issues: [{ error: `Unknown collection: ${collection}` }] };
      }

      for (let i = 0; i < data.length; i++) {
        const item = data[i];
        const missing = fields.filter(f => {
          if (f === 'price') return typeof item[f] !== 'number' || item[f] <= 0;
          return !item[f] || (typeof item[f] === 'string' && !item[f].trim());
        });

        if (missing.length > 0) {
          issues.push({ index: i, item: item.name || item.sku || item.swatchId || item.bundleId || `item[${i}]`, missing });
          invalid++;
        } else {
          valid++;
        }
      }

      return { valid, invalid, issues };
    } catch (err) {
      return { valid: 0, invalid: 0, issues: [{ error: err.message }] };
    }
  }
);
