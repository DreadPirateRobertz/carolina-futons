/**
 * @module catalogImport
 * @description Bulk catalog import service for admin product management.
 * Supports CSV/JSON product imports with validation, dry-run preview,
 * upsert logic, and import history tracking.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires backend/utils/sanitize
 *
 * @setup
 * Create CMS collections:
 *   CatalogImports - Import history records
 *     importId (Text, indexed) - Unique import identifier
 *     status (Text, indexed) - 'pending'|'processing'|'completed'|'failed'
 *     totalItems (Number) - Total items in import
 *     successCount (Number) - Successfully imported
 *     errorCount (Number) - Failed items
 *     errors (Text) - JSON array of error details
 *     importedBy (Text) - Admin identifier
 *     dryRun (Boolean) - Whether this was a dry run
 *     completedAt (Date) - When import finished
 *     _createdDate (Date) - Auto
 */

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize, validateId } from 'backend/utils/sanitize';

// ── Constants ────────────────────────────────────────────────────────

const MAX_IMPORT_SIZE = 500;
const REQUIRED_FIELDS = ['name', 'price', 'category'];
const VALID_CATEGORIES = [
  'futon-frames', 'mattresses', 'murphy-cabinet-beds', 'platform-beds',
  'casegoods-accessories', 'front-loading-nesting', 'wall-huggers',
  'wall-hugger-frames', 'unfinished-wood', 'covers', 'outdoor-furniture',
  'pillows-702', 'log-frames',
];
const MAX_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_SKU_LENGTH = 50;

// ── Helpers ──────────────────────────────────────────────────────────

function generateImportId() {
  return `imp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function validateProduct(item, index) {
  const errors = [];

  if (!item.name || typeof item.name !== 'string' || item.name.trim().length === 0) {
    errors.push({ row: index, field: 'name', error: 'Name is required' });
  }

  if (item.price !== null && (typeof item.price !== 'number' || item.price < 0)) {
    errors.push({ row: index, field: 'price', error: 'Price must be null or a non-negative number' });
  }

  if (!item.category || !VALID_CATEGORIES.includes(item.category)) {
    errors.push({ row: index, field: 'category', error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` });
  }

  if (item.sku && typeof item.sku === 'string' && item.sku.length > MAX_SKU_LENGTH) {
    errors.push({ row: index, field: 'sku', error: `SKU exceeds ${MAX_SKU_LENGTH} characters` });
  }

  if (item.weight != null && (typeof item.weight !== 'number' || item.weight < 0)) {
    errors.push({ row: index, field: 'weight', error: 'Weight must be a non-negative number' });
  }

  return errors;
}

// ── importProducts ──────────────────────────────────────────────────

/**
 * Bulk import products into the catalog. Admin only.
 * @param {Array} items - Array of product objects
 * @param {Object} opts - { dryRun: boolean }
 */
export const importProducts = webMethod(Permissions.Admin, async (items, opts = {}) => {
  try {
    if (!Array.isArray(items) || items.length === 0) {
      return { success: false, error: 'Items must be a non-empty array' };
    }

    if (items.length > MAX_IMPORT_SIZE) {
      return { success: false, error: `Import exceeds maximum of ${MAX_IMPORT_SIZE} items` };
    }

    const dryRun = opts.dryRun === true;
    const importId = generateImportId();
    const allErrors = [];
    let successCount = 0;

    // Validate all items first
    for (let i = 0; i < items.length; i++) {
      const itemErrors = validateProduct(items[i], i);
      allErrors.push(...itemErrors);
    }

    if (allErrors.length > 0 && !dryRun) {
      // Record failed import
      await wixData.insert('CatalogImports', {
        importId,
        status: 'failed',
        totalItems: items.length,
        successCount: 0,
        errorCount: allErrors.length,
        errors: JSON.stringify(allErrors.slice(0, 100)),
        importedBy: 'admin',
        dryRun: false,
        completedAt: new Date(),
      });

      return {
        success: false,
        error: 'Validation failed',
        data: { importId, errors: allErrors, errorCount: allErrors.length },
      };
    }

    if (dryRun) {
      const invalidRows = new Set(allErrors.map(e => e.row)).size;
      return {
        success: true,
        data: {
          importId,
          dryRun: true,
          totalItems: items.length,
          validItems: items.length - invalidRows,
          errors: allErrors,
          errorCount: allErrors.length,
        },
      };
    }

    // Process upsert for each valid item
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemErrors = validateProduct(item, i);
      if (itemErrors.length > 0) continue;

      const sanitized = {
        name: sanitize(item.name, MAX_NAME_LENGTH),
        description: sanitize(item.description || '', MAX_DESCRIPTION_LENGTH),
        price: item.price,
        category: item.category,
        sku: item.sku ? sanitize(item.sku, MAX_SKU_LENGTH) : null,
        weight: item.weight || null,
        inStock: item.inStock !== false,
        lastImportId: importId,
      };

      // Upsert: check if product exists by SKU
      if (sanitized.sku) {
        const existing = await wixData.query('Products')
          .eq('sku', sanitized.sku)
          .limit(1)
          .find();

        if (existing.items.length > 0) {
          await wixData.update('Products', { ...existing.items[0], ...sanitized });
          successCount++;
          continue;
        }
      }

      await wixData.insert('Products', sanitized);
      successCount++;
    }

    // Record successful import
    await wixData.insert('CatalogImports', {
      importId,
      status: 'completed',
      totalItems: items.length,
      successCount,
      errorCount: allErrors.length,
      errors: JSON.stringify(allErrors.slice(0, 100)),
      importedBy: 'admin',
      dryRun: false,
      completedAt: new Date(),
    });

    return {
      success: true,
      data: { importId, totalItems: items.length, successCount, errorCount: allErrors.length },
    };
  } catch (err) {
    return { success: false, error: 'Import failed' };
  }
});

// ── validateImportData ──────────────────────────────────────────────

/**
 * Pre-validates import data and returns statistics.
 * @param {Array} items - Array of product objects to validate
 */
export const validateImportData = webMethod(Permissions.Admin, async (items) => {
  try {
    if (!Array.isArray(items) || items.length === 0) {
      return { success: false, error: 'Items must be a non-empty array' };
    }

    if (items.length > MAX_IMPORT_SIZE) {
      return { success: false, error: `Exceeds maximum of ${MAX_IMPORT_SIZE} items` };
    }

    const allErrors = [];
    const categoryCounts = {};
    const missingFields = { name: 0, price: 0, category: 0 };

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemErrors = validateProduct(item, i);
      allErrors.push(...itemErrors);

      // Track category distribution
      if (item.category && VALID_CATEGORIES.includes(item.category)) {
        categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
      }

      // Track missing required fields
      if (!item.name || typeof item.name !== 'string' || item.name.trim().length === 0) missingFields.name++;
      if (item.price == null || typeof item.price !== 'number') missingFields.price++;
      if (!item.category) missingFields.category++;
    }

    return {
      success: true,
      data: {
        totalItems: items.length,
        validItems: items.length - new Set(allErrors.map(e => e.row)).size,
        errorCount: allErrors.length,
        errors: allErrors,
        categoryCounts,
        missingFields,
      },
    };
  } catch (err) {
    return { success: false, error: 'Validation failed' };
  }
});

// ── getImportHistory ────────────────────────────────────────────────

/**
 * Returns paginated import history for admin review.
 * @param {Object} opts - { page, pageSize }
 */
export const getImportHistory = webMethod(Permissions.Admin, async (opts = {}) => {
  try {
    const page = Math.max(1, Math.round(Number(opts.page) || 1));
    const pageSize = Math.min(50, Math.max(1, Math.round(Number(opts.pageSize) || 10)));

    const result = await wixData.query('CatalogImports')
      .descending('_createdDate')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .find();

    return {
      success: true,
      data: {
        imports: result.items.map(i => ({
          _id: i._id,
          importId: i.importId,
          status: i.status,
          totalItems: i.totalItems,
          successCount: i.successCount,
          errorCount: i.errorCount,
          dryRun: i.dryRun || false,
          importedBy: i.importedBy,
          completedAt: i.completedAt,
          createdDate: i._createdDate,
        })),
        page,
        pageSize,
        totalCount: result.totalCount,
      },
    };
  } catch (err) {
    return { success: false, error: 'Failed to load import history' };
  }
});

// ── getImportDetails ────────────────────────────────────────────────

/**
 * Returns detailed info about a specific import.
 * @param {string} importId - The import ID
 */
export const getImportDetails = webMethod(Permissions.Admin, async (importId) => {
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
        _id: imp._id,
        importId: imp.importId,
        status: imp.status,
        totalItems: imp.totalItems,
        successCount: imp.successCount,
        errorCount: imp.errorCount,
        errors,
        dryRun: imp.dryRun || false,
        importedBy: imp.importedBy,
        completedAt: imp.completedAt,
        createdDate: imp._createdDate,
      },
    };
  } catch (err) {
    return { success: false, error: 'Failed to load import details' };
  }
});

// ── getCatalogStats ─────────────────────────────────────────────────

/**
 * Returns catalog statistics — product counts by category and stock status.
 */
export const getCatalogStats = webMethod(Permissions.Admin, async () => {
  try {
    const allProducts = await wixData.query('Products')
      .limit(1000)
      .find();

    const categoryCounts = {};
    let inStockCount = 0;
    let outOfStockCount = 0;
    let totalValue = 0;

    for (const product of allProducts.items) {
      const cat = product.category || 'uncategorized';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;

      if (product.inStock !== false) {
        inStockCount++;
      } else {
        outOfStockCount++;
      }

      totalValue += product.price || 0;
    }

    return {
      success: true,
      data: {
        totalProducts: allProducts.totalCount,
        categoryCounts,
        inStockCount,
        outOfStockCount,
        averagePrice: allProducts.items.length > 0
          ? Math.round((totalValue / allProducts.items.length) * 100) / 100
          : 0,
      },
    };
  } catch (err) {
    return { success: false, error: 'Failed to load catalog stats' };
  }
});
