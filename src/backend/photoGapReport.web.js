/**
 * @module photoGapReport
 * @description Generates per-category image coverage reports from catalog-MASTER.json.
 *
 * Computes images-per-product averages by category, flags categories below a
 * configurable threshold (default 3.0), and logs a structured report to AuditLog.
 *
 * Intended to run weekly (e.g., Wix scheduled job or manual trigger).
 *
 * Dependencies: wix-web-module, backend/utils/auditLog, wix-data
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { logAuditEvent } from 'backend/utils/auditLog';

const DEFAULT_THRESHOLD = 3.0;
const CATALOG_COLLECTION = 'Products';

/**
 * Generate a photo gap report from product data.
 *
 * Queries all products from the CMS (or accepts a products array for testing),
 * computes per-category image coverage, and returns a structured report.
 *
 * @param {Object} [options]
 * @param {number} [options.threshold=3.0] - Min images/product average to pass
 * @param {Array}  [options.products] - Override products (for testing / offline use)
 * @returns {Promise<{success: boolean, report: Object}>}
 * @permission Admin
 */
export const generatePhotoGapReport = webMethod(
  Permissions.Admin,
  async (options = {}) => {
    try {
      const threshold = options.threshold != null ? options.threshold : DEFAULT_THRESHOLD;
      let products = options.products;

      if (!products) {
        // Query all products from CMS
        const result = await wixData.query(CATALOG_COLLECTION)
          .limit(1000)
          .find();
        products = result.items;
      }

      if (!Array.isArray(products) || products.length === 0) {
        return { success: false, error: 'No products found' };
      }

      const report = buildReport(products, threshold);

      // Log to audit trail
      logAuditEvent('PhotoGapReport', 'generate', 'system', {
        totalProducts: report.totalProducts,
        totalImages: report.totalImages,
        flaggedCategories: report.flaggedCategories.length,
        overallAvg: report.overallAvg,
      });

      return { success: true, report };
    } catch (err) {
      console.error('[photoGapReport] Error generating report:', err);
      return { success: false, error: 'Failed to generate photo gap report' };
    }
  }
);

/**
 * Build the photo gap report from a products array.
 *
 * @param {Array} products - Product objects with { category, images }
 * @param {number} threshold - Minimum avg images/product
 * @returns {Object} Report with categories, flagged gaps, and summary
 */
function buildReport(products, threshold) {
  const categoryMap = {};

  for (const product of products) {
    const cat = product.category || 'uncategorized';
    if (!categoryMap[cat]) {
      categoryMap[cat] = { category: cat, products: 0, images: 0, items: [] };
    }
    const imageCount = Array.isArray(product.images) ? product.images.length : 0;
    categoryMap[cat].products++;
    categoryMap[cat].images += imageCount;
    if (imageCount < threshold) {
      categoryMap[cat].items.push({
        name: product.name,
        sku: product.sku,
        imageCount,
        deficit: Math.ceil(threshold) - imageCount,
      });
    }
  }

  const categories = Object.values(categoryMap).map(cat => ({
    category: cat.category,
    products: cat.products,
    images: cat.images,
    avg: cat.products > 0 ? Math.round((cat.images / cat.products) * 10) / 10 : 0,
    underPhotographed: cat.items,
  }));

  // Sort by avg ascending (worst first)
  categories.sort((a, b) => a.avg - b.avg);

  const totalProducts = products.length;
  const totalImages = categories.reduce((sum, c) => sum + c.images, 0);
  const overallAvg = totalProducts > 0
    ? Math.round((totalImages / totalProducts) * 10) / 10
    : 0;

  const flaggedCategories = categories.filter(c => c.avg < threshold);

  return {
    generatedAt: new Date().toISOString(),
    threshold,
    totalProducts,
    totalImages,
    overallAvg,
    categories,
    flaggedCategories,
  };
}
