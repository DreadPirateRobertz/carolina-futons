/**
 * Import scraped fabric swatch data into the FabricSwatches CMS collection.
 *
 * Expected input shape per item:
 * {
 *   swatchId: string,        // unique identifier
 *   swatchName: string,       // display name
 *   swatchImage: string,      // image URL
 *   colorFamily: string,      // e.g. "Blue", "Brown", "Neutral"
 *   colorHex: string,         // e.g. "#5B8FA8"
 *   material: string,         // e.g. "Microfiber", "Cotton"
 *   careInstructions?: string,
 *   availableForProducts: string[] | string,  // product IDs or "all"
 *   sortOrder?: number
 * }
 */
import wixData from 'wix-data';
import { processBatches, requireString, normalizeHex, sanitize } from './importConfig';

/**
 * Import swatches with dedup on swatchId.
 * @param {Array} swatches - Array of swatch objects from scrape.
 * @returns {Promise<{inserted: number, skipped: number, errors: Array}>}
 */
export async function importSwatches(swatches) {
  if (!Array.isArray(swatches) || swatches.length === 0) {
    return { inserted: 0, skipped: 0, errors: [{ error: 'No swatch data provided' }] };
  }

  // Pre-fetch existing swatchIds for dedup
  const existingIds = new Set();
  let skip = 0;
  const PAGE = 100;
  while (true) {
    const page = await wixData.query('FabricSwatches')
      .limit(PAGE)
      .skip(skip)
      .find();
    for (const item of page.items) {
      existingIds.add(item.swatchId);
    }
    if (page.items.length < PAGE) break;
    skip += PAGE;
  }

  return processBatches(swatches, async (batch) => {
    let inserted = 0;
    let skipped = 0;
    const errors = [];

    for (const swatch of batch) {
      // Validate required fields
      const validationErrors = [
        requireString(swatch.swatchId, 'swatchId'),
        requireString(swatch.swatchName, 'swatchName'),
        requireString(swatch.colorFamily, 'colorFamily'),
        requireString(swatch.material, 'material'),
      ].filter(Boolean);

      if (validationErrors.length > 0) {
        errors.push({ swatchId: swatch.swatchId, errors: validationErrors });
        skipped++;
        continue;
      }

      // Dedup check
      if (existingIds.has(swatch.swatchId)) {
        skipped++;
        continue;
      }

      // Normalize availableForProducts to Tags (array)
      let products = swatch.availableForProducts;
      if (typeof products === 'string') {
        products = products === 'all' ? ['all'] : products.split(',').map(s => s.trim()).filter(Boolean);
      }
      if (!Array.isArray(products)) products = [];

      try {
        await wixData.insert('FabricSwatches', {
          swatchId: sanitize(swatch.swatchId, 50),
          swatchName: sanitize(swatch.swatchName, 200),
          swatchImage: swatch.swatchImage || '',
          colorFamily: sanitize(swatch.colorFamily, 50),
          colorHex: normalizeHex(swatch.colorHex),
          material: sanitize(swatch.material, 100),
          careInstructions: sanitize(swatch.careInstructions, 500),
          availableForProducts: products,
          sortOrder: typeof swatch.sortOrder === 'number' ? swatch.sortOrder : 0,
        });
        existingIds.add(swatch.swatchId);
        inserted++;
      } catch (err) {
        errors.push({ swatchId: swatch.swatchId, error: err.message });
      }
    }

    return { inserted, skipped, errors };
  });
}
