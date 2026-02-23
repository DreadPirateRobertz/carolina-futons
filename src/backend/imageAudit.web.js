/**
 * @module imageAudit
 * @description Product image pipeline audit and diagnostics.
 * Validates image URLs, reports coverage gaps, and provides
 * a pre-import health check for the product catalog.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires backend/utils/sanitize
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize } from 'backend/utils/sanitize';

// ── Constants ────────────────────────────────────────────────────────

const PRODUCTS_COLLECTION = 'Stores/Products';
const MIN_RECOMMENDED_IMAGES = 3;
const IDEAL_IMAGE_COUNT = 5;
const WIXSTATIC_PATTERN = /^https:\/\/static\.wixstatic\.com\/media\//;
const WIX_IMAGE_PATTERN = /^wix:image:\/\/v1\//;

// ── Helpers ──────────────────────────────────────────────────────────

function classifyImageUrl(url) {
  if (!url || typeof url !== 'string') return 'invalid';
  if (WIXSTATIC_PATTERN.test(url)) return 'wixstatic';
  if (WIX_IMAGE_PATTERN.test(url)) return 'wix-image';
  if (url.startsWith('https://')) return 'external';
  return 'unknown';
}

function extractMediaId(url) {
  if (!url) return null;
  const wixMatch = url.match(/wix:image:\/\/v1\/([^/]+)/);
  if (wixMatch) return wixMatch[1];
  const staticMatch = url.match(/static\.wixstatic\.com\/media\/([^/?#]+)/);
  if (staticMatch) return staticMatch[1];
  return null;
}

// ── auditCatalogImages (admin) ───────────────────────────────────────

/**
 * Audit a pre-import catalog JSON for image completeness.
 * Accepts the products array from catalog-MASTER.json.
 * @param {Array} products - Array of product objects with images arrays
 * @returns {Object} Audit report with coverage stats and flagged products
 */
export const auditCatalogImages = webMethod(
  Permissions.Anyone,
  (products) => {
    if (!Array.isArray(products)) {
      return { success: false, error: 'Products must be an array' };
    }

    const report = {
      totalProducts: products.length,
      totalImages: 0,
      avgImagesPerProduct: 0,
      coverage: { noImages: 0, oneImage: 0, belowMinimum: 0, adequate: 0, ideal: 0 },
      urlTypes: { wixstatic: 0, 'wix-image': 0, external: 0, invalid: 0, unknown: 0 },
      duplicateUrls: [],
      flaggedProducts: [],
      categoryBreakdown: {},
    };

    const allUrls = new Set();
    const duplicates = new Set();

    for (const product of products) {
      const images = Array.isArray(product.images) ? product.images : [];
      const count = images.length;
      report.totalImages += count;

      // Coverage classification
      if (count === 0) {
        report.coverage.noImages++;
        report.flaggedProducts.push({
          name: product.name,
          slug: product.slug,
          category: product.category,
          imageCount: 0,
          issue: 'NO_IMAGES',
        });
      } else if (count === 1) {
        report.coverage.oneImage++;
        report.flaggedProducts.push({
          name: product.name,
          slug: product.slug,
          category: product.category,
          imageCount: 1,
          issue: 'SINGLE_IMAGE',
        });
      } else if (count < MIN_RECOMMENDED_IMAGES) {
        report.coverage.belowMinimum++;
        report.flaggedProducts.push({
          name: product.name,
          slug: product.slug,
          category: product.category,
          imageCount: count,
          issue: 'BELOW_MINIMUM',
        });
      } else if (count >= IDEAL_IMAGE_COUNT) {
        report.coverage.ideal++;
      } else {
        report.coverage.adequate++;
      }

      // URL type classification and duplicate detection
      for (const url of images) {
        const type = classifyImageUrl(url);
        report.urlTypes[type] = (report.urlTypes[type] || 0) + 1;

        const mediaId = extractMediaId(url);
        const key = mediaId || url;
        if (allUrls.has(key)) {
          duplicates.add(key);
        }
        allUrls.add(key);
      }

      // Category breakdown
      const cat = product.category || 'uncategorized';
      if (!report.categoryBreakdown[cat]) {
        report.categoryBreakdown[cat] = { products: 0, totalImages: 0, avgImages: 0 };
      }
      report.categoryBreakdown[cat].products++;
      report.categoryBreakdown[cat].totalImages += count;
    }

    // Compute averages
    report.avgImagesPerProduct = products.length > 0
      ? Math.round((report.totalImages / products.length) * 10) / 10
      : 0;

    for (const cat of Object.keys(report.categoryBreakdown)) {
      const cb = report.categoryBreakdown[cat];
      cb.avgImages = cb.products > 0
        ? Math.round((cb.totalImages / cb.products) * 10) / 10
        : 0;
    }

    report.duplicateUrls = [...duplicates];
    report.uniqueImageCount = allUrls.size;
    report.success = true;

    return report;
  }
);

// ── auditLiveProducts (admin — checks Wix CMS) ─────────────────────

/**
 * Audit live products in the Wix CMS for image coverage.
 * Checks Stores/Products for missing or insufficient media.
 * @returns {Object} Live audit report
 */
export const auditLiveProducts = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      const results = [];
      let offset = 0;
      const batchSize = 100;
      let hasMore = true;

      while (hasMore) {
        const batch = await wixData.query(PRODUCTS_COLLECTION)
          .skip(offset)
          .limit(batchSize)
          .find();

        for (const product of batch.items) {
          const mediaItems = product.mediaItems || [];
          const mainMedia = product.mainMedia;
          const imageCount = mediaItems.length + (mainMedia && !mediaItems.some(m =>
            (m.src || m.image) === mainMedia
          ) ? 1 : 0);

          results.push({
            productId: product._id,
            name: product.name || 'Unknown',
            slug: product.slug || '',
            imageCount,
            hasMainMedia: !!mainMedia,
            mainMediaType: mainMedia ? classifyImageUrl(
              typeof mainMedia === 'string' ? mainMedia : mainMedia.src || ''
            ) : 'none',
          });
        }

        offset += batchSize;
        hasMore = batch.items.length === batchSize;
      }

      const noImages = results.filter(r => r.imageCount === 0);
      const singleImage = results.filter(r => r.imageCount === 1);
      const adequate = results.filter(r => r.imageCount >= MIN_RECOMMENDED_IMAGES);

      return {
        success: true,
        totalProducts: results.length,
        totalWithNoImages: noImages.length,
        totalWithSingleImage: singleImage.length,
        totalAdequate: adequate.length,
        avgImagesPerProduct: results.length > 0
          ? Math.round(results.reduce((sum, r) => sum + r.imageCount, 0) / results.length * 10) / 10
          : 0,
        flagged: [...noImages, ...singleImage],
        allProducts: results,
      };
    } catch (err) {
      console.error('auditLiveProducts error:', err);
      return { success: false, error: 'Unable to audit live products' };
    }
  }
);

// ── getImagePipelineStatus (public summary) ──────────────────────────

/**
 * Quick status check of the image pipeline.
 * Returns high-level metrics for dashboard display.
 * @param {Array} catalogProducts - Products array from catalog JSON
 * @returns {Object} Pipeline status summary
 */
export const getImagePipelineStatus = webMethod(
  Permissions.Anyone,
  (catalogProducts) => {
    if (!Array.isArray(catalogProducts)) {
      return { success: false, error: 'Products array required' };
    }

    const total = catalogProducts.length;
    let withImages = 0;
    let totalImages = 0;
    let allWixstatic = true;

    for (const p of catalogProducts) {
      const images = Array.isArray(p.images) ? p.images : [];
      if (images.length > 0) withImages++;
      totalImages += images.length;
      for (const url of images) {
        if (!WIXSTATIC_PATTERN.test(url)) allWixstatic = false;
      }
    }

    return {
      success: true,
      totalProducts: total,
      productsWithImages: withImages,
      productsWithoutImages: total - withImages,
      totalImageUrls: totalImages,
      avgImagesPerProduct: total > 0 ? Math.round((totalImages / total) * 10) / 10 : 0,
      allImagesOnWixCdn: allWixstatic,
      readyForImport: withImages === total && allWixstatic,
    };
  }
);
