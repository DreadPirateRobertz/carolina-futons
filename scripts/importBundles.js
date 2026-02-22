/**
 * Import scraped product bundle data into the ProductBundles CMS collection.
 *
 * Expected input shape per item:
 * {
 *   bundleId: string,           // unique bundle identifier
 *   bundleName: string,         // display name
 *   primaryProductId: string,   // the main product this bundle is shown on
 *   bundledProductIds: string[] | string,  // array or comma-separated product IDs
 *   isActive?: boolean,         // defaults to true
 *   discountPercent?: number    // bundle discount (defaults to 5)
 * }
 */
import wixData from 'wix-data';
import { processBatches, requireString, sanitize } from './importConfig';

/**
 * Import bundles with dedup on bundleId.
 * @param {Array} bundles - Array of bundle objects from scrape.
 * @returns {Promise<{inserted: number, skipped: number, errors: Array}>}
 */
export async function importBundles(bundles) {
  if (!Array.isArray(bundles) || bundles.length === 0) {
    return { inserted: 0, skipped: 0, errors: [{ error: 'No bundle data provided' }] };
  }

  // Pre-fetch existing bundleIds for dedup
  const existingIds = new Set();
  let skip = 0;
  const PAGE = 100;
  while (true) {
    const page = await wixData.query('ProductBundles')
      .limit(PAGE)
      .skip(skip)
      .find();
    for (const item of page.items) {
      existingIds.add(item.bundleId);
    }
    if (page.items.length < PAGE) break;
    skip += PAGE;
  }

  return processBatches(bundles, async (batch) => {
    let inserted = 0;
    let skipped = 0;
    const errors = [];

    for (const bundle of batch) {
      const validationErrors = [
        requireString(bundle.bundleId, 'bundleId'),
        requireString(bundle.bundleName, 'bundleName'),
        requireString(bundle.primaryProductId, 'primaryProductId'),
      ].filter(Boolean);

      if (validationErrors.length > 0) {
        errors.push({ bundleId: bundle.bundleId, errors: validationErrors });
        skipped++;
        continue;
      }

      if (existingIds.has(bundle.bundleId)) {
        skipped++;
        continue;
      }

      // Normalize bundledProductIds to comma-separated string
      let productIds = bundle.bundledProductIds;
      if (Array.isArray(productIds)) {
        productIds = productIds.join(',');
      }
      if (typeof productIds !== 'string') productIds = '';

      try {
        await wixData.insert('ProductBundles', {
          bundleId: sanitize(bundle.bundleId, 100),
          bundleName: sanitize(bundle.bundleName, 200),
          primaryProductId: sanitize(bundle.primaryProductId, 100),
          bundledProductIds: sanitize(productIds, 500),
          isActive: bundle.isActive !== false,
          discountPercent: typeof bundle.discountPercent === 'number' ? bundle.discountPercent : 5,
        });
        existingIds.add(bundle.bundleId);
        inserted++;
      } catch (err) {
        errors.push({ bundleId: bundle.bundleId, error: err.message });
      }
    }

    return { inserted, skipped, errors };
  });
}
