/**
 * @module loadCatalogMaster
 * @description Transforms and loads catalog-MASTER.json into Wix CMS.
 * Handles the full product schema: slug, images, variants, dimensions,
 * manufacturer, swatches, sizes, bundleCompatible, availability.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires backend/utils/sanitize
 *
 * @setup
 * Uses existing CMS collections:
 *   Products (Collection_0) - Main product collection
 *   CatalogImports - Import history tracking
 */

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize } from 'backend/utils/sanitize';

// ── Constants ────────────────────────────────────────────────────────

const VALID_CATEGORIES = [
  'futon-frames', 'mattresses', 'murphy-cabinet-beds', 'platform-beds',
  'casegoods-accessories', 'front-loading-nesting', 'wall-huggers',
  'unfinished-wood', 'covers', 'outdoor-furniture', 'pillows-702', 'log-frames',
];

const MAX_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_SKU_LENGTH = 50;
const MAX_SLUG_LENGTH = 100;
const MAX_IMAGES = 20;
const MAX_VARIANTS = 50;
const BATCH_SIZE = 25;

// ── Helpers ──────────────────────────────────────────────────────────

function generateImportId() {
  return `cml-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Validates a single product from the MASTER catalog format.
 * @param {Object} product - Raw product from catalog-MASTER.json
 * @param {number} index - Position in products array
 * @returns {Array} Array of error objects
 */
function validateMasterProduct(product, index) {
  const errors = [];

  if (!product || typeof product !== 'object') {
    errors.push({ row: index, field: '_self', error: 'Product must be an object' });
    return errors;
  }

  if (!product.name || typeof product.name !== 'string' || product.name.trim().length === 0) {
    errors.push({ row: index, field: 'name', error: 'Name is required' });
  }

  if (!product.slug || typeof product.slug !== 'string' || product.slug.trim().length === 0) {
    errors.push({ row: index, field: 'slug', error: 'Slug is required' });
  }

  if (!product.sku || typeof product.sku !== 'string' || product.sku.trim().length === 0) {
    errors.push({ row: index, field: 'sku', error: 'SKU is required' });
  }

  if (product.price == null || typeof product.price !== 'number' || product.price < 0) {
    errors.push({ row: index, field: 'price', error: 'Price must be a non-negative number' });
  }

  if (!product.category || !VALID_CATEGORIES.includes(product.category)) {
    errors.push({ row: index, field: 'category', error: `Invalid category: ${product.category}` });
  }

  if (!Array.isArray(product.images)) {
    errors.push({ row: index, field: 'images', error: 'Images must be an array' });
  }

  return errors;
}

/**
 * Transforms a MASTER catalog product into a CMS-ready record.
 * @param {Object} product - Raw product from catalog-MASTER.json
 * @param {string} importId - Current import ID
 * @returns {Object} CMS-ready product record
 */
function transformProduct(product, importId) {
  const images = Array.isArray(product.images)
    ? product.images.slice(0, MAX_IMAGES)
    : [];

  const variants = Array.isArray(product.variants)
    ? product.variants.slice(0, MAX_VARIANTS).map(v => ({
        label: sanitize(v.label || '', MAX_NAME_LENGTH),
        sku: v.sku ? sanitize(v.sku, MAX_SKU_LENGTH) : null,
        price: typeof v.price === 'number' ? v.price : null,
      }))
    : [];

  const dimensions = product.dimensions && typeof product.dimensions === 'object'
    ? {
        width: typeof product.dimensions.width === 'number' ? product.dimensions.width : 0,
        depth: typeof product.dimensions.depth === 'number' ? product.dimensions.depth : 0,
        height: typeof product.dimensions.height === 'number' ? product.dimensions.height : 0,
        weight: typeof product.dimensions.weight === 'number' ? product.dimensions.weight : 0,
      }
    : { width: 0, depth: 0, height: 0, weight: 0 };

  return {
    name: sanitize(product.name, MAX_NAME_LENGTH),
    slug: sanitize(product.slug, MAX_SLUG_LENGTH),
    sku: sanitize(product.sku, MAX_SKU_LENGTH),
    category: product.category,
    url: product.url || '',
    price: product.price,
    description: sanitize(product.description || '', MAX_DESCRIPTION_LENGTH),
    images: JSON.stringify(images),
    variants: JSON.stringify(variants),
    dimensions: JSON.stringify(dimensions),
    manufacturer: sanitize(product.manufacturer || '', MAX_NAME_LENGTH),
    inStock: product.inStock !== false,
    bundleCompatible: product.bundleCompatible === true,
    availability: sanitize(product.availability || 'InStock', 50),
    swatches: JSON.stringify(Array.isArray(product.swatches) ? product.swatches : []),
    sizes: JSON.stringify(Array.isArray(product.sizes) ? product.sizes : []),
    lastImportId: importId,
  };
}

// ── previewCatalogLoad ───────────────────────────────────────────────

/**
 * Dry-run preview of catalog-MASTER.json load. Validates all products
 * and returns statistics without writing to CMS.
 * @param {Object} catalog - Full catalog-MASTER.json object
 */
export const previewCatalogLoad = webMethod(Permissions.Admin, async (catalog) => {
  try {
    if (!catalog || !Array.isArray(catalog.products)) {
      return { success: false, error: 'Catalog must have a products array' };
    }

    const products = catalog.products;
    const allErrors = [];
    const categoryCounts = {};
    let validCount = 0;

    for (let i = 0; i < products.length; i++) {
      const errs = validateMasterProduct(products[i], i);
      allErrors.push(...errs);
      if (errs.length === 0) {
        validCount++;
        const cat = products[i].category;
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      }
    }

    return {
      success: true,
      data: {
        dryRun: true,
        catalogVersion: catalog.catalogVersion || 'unknown',
        totalProducts: products.length,
        validProducts: validCount,
        invalidProducts: products.length - validCount,
        errorCount: allErrors.length,
        errors: allErrors.slice(0, 100),
        categoryCounts,
      },
    };
  } catch (err) {
    return { success: false, error: 'Preview failed' };
  }
});

// ── loadCatalogMaster ────────────────────────────────────────────────

/**
 * Bulk-loads catalog-MASTER.json into Wix CMS. Upserts by SKU.
 * @param {Object} catalog - Full catalog-MASTER.json object
 * @param {Object} opts - { skipInvalid: boolean } skip invalid products instead of failing
 */
export const loadCatalogMaster = webMethod(Permissions.Admin, async (catalog, opts = {}) => {
  try {
    if (!catalog || !Array.isArray(catalog.products)) {
      return { success: false, error: 'Catalog must have a products array' };
    }

    const products = catalog.products;
    const importId = generateImportId();
    const skipInvalid = opts.skipInvalid === true;
    const allErrors = [];
    let successCount = 0;
    let skippedCount = 0;

    // Validate all products
    for (let i = 0; i < products.length; i++) {
      const errs = validateMasterProduct(products[i], i);
      allErrors.push(...errs);
    }

    // If errors and not skipping, fail
    if (allErrors.length > 0 && !skipInvalid) {
      await wixData.insert('CatalogImports', {
        importId,
        status: 'failed',
        totalItems: products.length,
        successCount: 0,
        errorCount: allErrors.length,
        errors: JSON.stringify(allErrors.slice(0, 100)),
        importedBy: 'catalog-master-loader',
        dryRun: false,
        completedAt: new Date(),
      });

      return {
        success: false,
        error: 'Validation failed',
        data: { importId, errors: allErrors.slice(0, 100), errorCount: allErrors.length },
      };
    }

    // Build set of invalid row indices
    const invalidRows = new Set(allErrors.map(e => e.row));

    // Process in batches
    for (let batchStart = 0; batchStart < products.length; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, products.length);

      for (let i = batchStart; i < batchEnd; i++) {
        if (invalidRows.has(i)) {
          skippedCount++;
          continue;
        }

        const record = transformProduct(products[i], importId);

        // Upsert by SKU
        const existing = await wixData.query('Products')
          .eq('sku', record.sku)
          .limit(1)
          .find();

        if (existing.items.length > 0) {
          await wixData.update('Products', { ...existing.items[0], ...record });
        } else {
          await wixData.insert('Products', record);
        }

        successCount++;
      }
    }

    // Record import
    await wixData.insert('CatalogImports', {
      importId,
      status: 'completed',
      totalItems: products.length,
      successCount,
      errorCount: allErrors.length,
      skippedCount,
      errors: JSON.stringify(allErrors.slice(0, 100)),
      importedBy: 'catalog-master-loader',
      dryRun: false,
      completedAt: new Date(),
    });

    return {
      success: true,
      data: {
        importId,
        totalProducts: products.length,
        successCount,
        skippedCount,
        errorCount: allErrors.length,
      },
    };
  } catch (err) {
    return { success: false, error: 'Catalog load failed' };
  }
});

// ── getCatalogLoadStatus ─────────────────────────────────────────────

/**
 * Returns status of a catalog master load by import ID.
 * @param {string} importId - The import ID to look up
 */
export const getCatalogLoadStatus = webMethod(Permissions.Admin, async (importId) => {
  try {
    if (!importId || typeof importId !== 'string') {
      return { success: false, error: 'Invalid import ID' };
    }

    const cleanId = sanitize(importId, 100);
    const result = await wixData.query('CatalogImports')
      .eq('importId', cleanId)
      .limit(1)
      .find();

    if (result.items.length === 0) {
      return { success: false, error: 'Import not found' };
    }

    const imp = result.items[0];
    let errors = [];
    try { errors = JSON.parse(imp.errors || '[]'); } catch { errors = []; }

    return {
      success: true,
      data: {
        importId: imp.importId,
        status: imp.status,
        totalItems: imp.totalItems,
        successCount: imp.successCount,
        errorCount: imp.errorCount,
        skippedCount: imp.skippedCount || 0,
        errors,
        completedAt: imp.completedAt,
      },
    };
  } catch (err) {
    return { success: false, error: 'Failed to load status' };
  }
});
