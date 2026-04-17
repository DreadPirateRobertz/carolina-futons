/**
 * furnitureCareGuideService.web.js — Per-product furniture care guide data service.
 *
 * Reads from the FurnitureCare CMS collection to return structured care
 * instructions for a given product, keyed by material type. Callers receive
 * cleaningMethod, maintenanceTips, and warningNotes fields that map directly
 * to PDP element text — no content logic lives in the widget.
 *
 * Collection schema:
 *   productId       — Text      — references the Wix product slug
 *   material        — Text      — 'fabric' | 'wood' | 'metal' | 'leather'
 *   cleaningMethod  — Text      — step-by-step cleaning instructions
 *   maintenanceTips — Text      — ongoing maintenance advice
 *   warningNotes    — Text      — warnings (chemicals, conditions, etc.)
 *
 * CF-gbv
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { logError } from 'backend/utils/errorHandler';

const COLLECTION = 'FurnitureCare';

const VALID_MATERIALS = ['fabric', 'wood', 'metal', 'leather'];

// ── webMethods ────────────────────────────────────────────────────────────────

/**
 * Return the care guide for the given product slug.
 * Returns null when no care record is configured — callers should fall back
 * to generic care tips rather than collapsing the section entirely, since
 * every furniture product benefits from basic care guidance.
 *
 * @param {string} slug  Product slug (matches productId in FurnitureCare collection)
 * @returns {Promise<{success: boolean, guide?: Object|null, error?: string}>}
 */
export const getCareGuide = webMethod(
  Permissions.Anyone,
  async (slug) => {
    if (!slug || typeof slug !== 'string') {
      return { success: false, error: 'invalid_slug' };
    }

    let result;
    try {
      result = await wixData
        .query(COLLECTION)
        .eq('productId', slug)
        .limit(1)
        .find();
    } catch (err) {
      logError('furnitureCareGuideService.getCareGuide', err);
      return { success: false, error: 'internal_error' };
    }

    if (!result.items.length) {
      // Why: no CMS record means the product has no material-specific care data.
      // Return null so the widget falls back to generic tips — callers must NOT
      // collapse the section, since generic care guidance is always valid. (CF-gbv)
      return { success: true, guide: null };
    }

    const item = result.items[0];
    const rawMaterial = typeof item.material === 'string'
      ? item.material.toLowerCase().trim()
      : '';
    const material = VALID_MATERIALS.includes(rawMaterial) ? rawMaterial : 'unknown';

    // Why: an out-of-allowlist material usually means a typo or a new category
    // added in the CMS without an accompanying code change. Surfacing it via
    // logError keeps the widget safe (generic fallback) while flagging the data
    // issue for ops to correct in the FurnitureCare collection. (CF-gbv)
    if (material === 'unknown' && rawMaterial !== '') {
      logError(
        'furnitureCareGuideService.getCareGuide',
        new Error(`unknown material "${rawMaterial}" for productId "${slug}"`),
      );
    }

    return {
      success: true,
      guide: {
        material,
        cleaningMethod:  item.cleaningMethod  || '',
        maintenanceTips: item.maintenanceTips || '',
        warningNotes:    item.warningNotes    || '',
      },
    };
  }
);
