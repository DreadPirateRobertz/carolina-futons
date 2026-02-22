/**
 * Import scraped assembly guide data into the AssemblyGuides CMS collection.
 *
 * Expected input shape per item:
 * {
 *   sku: string,              // product SKU — primary key for dedup
 *   title: string,            // guide title
 *   pdfUrl?: string,          // PDF download URL
 *   videoUrl?: string,        // video URL
 *   estimatedTime?: string,   // e.g. "30-60 minutes"
 *   category?: string,        // e.g. "futon-frames", "murphy-cabinet-beds"
 *   steps?: string,           // Rich Text — assembly steps
 *   tips?: string             // Rich Text — pro tips and warnings
 * }
 */
import wixData from 'wix-data';
import { processBatches, requireString, validateUrl, sanitize, sanitizeRichText } from './importConfig';

/**
 * Import assembly guides with dedup on sku.
 * @param {Array} guides - Array of guide objects from scrape.
 * @returns {Promise<{inserted: number, skipped: number, errors: Array}>}
 */
export async function importAssemblyGuides(guides) {
  if (!Array.isArray(guides) || guides.length === 0) {
    return { inserted: 0, skipped: 0, errors: [{ error: 'No assembly guide data provided' }] };
  }

  // Pre-fetch existing SKUs for dedup
  const existingSkus = new Set();
  let skip = 0;
  const PAGE = 100;
  while (true) {
    const page = await wixData.query('AssemblyGuides')
      .limit(PAGE)
      .skip(skip)
      .find();
    for (const item of page.items) {
      existingSkus.add(item.sku);
    }
    if (page.items.length < PAGE) break;
    skip += PAGE;
  }

  return processBatches(guides, async (batch) => {
    let inserted = 0;
    let skipped = 0;
    const errors = [];

    for (const guide of batch) {
      const validationErrors = [
        requireString(guide.sku, 'sku'),
        requireString(guide.title, 'title'),
        validateUrl(guide.pdfUrl, 'pdfUrl'),
        validateUrl(guide.videoUrl, 'videoUrl'),
      ].filter(Boolean);

      if (validationErrors.length > 0) {
        errors.push({ sku: guide.sku, errors: validationErrors });
        skipped++;
        continue;
      }

      if (existingSkus.has(guide.sku)) {
        skipped++;
        continue;
      }

      try {
        await wixData.insert('AssemblyGuides', {
          sku: sanitize(guide.sku, 50),
          title: sanitize(guide.title, 200),
          pdfUrl: guide.pdfUrl || '',
          videoUrl: guide.videoUrl || '',
          estimatedTime: sanitize(guide.estimatedTime, 50),
          category: sanitize(guide.category, 50),
          steps: sanitizeRichText(guide.steps),
          tips: sanitizeRichText(guide.tips),
        });
        existingSkus.add(guide.sku);
        inserted++;
      } catch (err) {
        errors.push({ sku: guide.sku, error: err.message });
      }
    }

    return { inserted, skipped, errors };
  });
}
