/**
 * FurnitureCareGuideWidget.js — Collapsible per-product care instructions on the PDP.
 *
 * Fetches structured care data from the FurnitureCare CMS collection and renders
 * cleaning method, maintenance tips, and warning notes. Falls back to generic
 * care tips when no product-specific record exists — the section is always shown
 * since basic care guidance is useful for every furniture product.
 *
 * Required Wix Studio elements:
 *   #careGuideSection    Box    — outer wrapper (starts collapsed)
 *   #careGuideTitle      Text   — section heading "Care & Maintenance"
 *   #careGuideMaterial   Text   — material type label (e.g. "Fabric Care")
 *   #careGuideCleaning   Text   — cleaning method instructions
 *   #careGuideMaintenance Text  — maintenance tips paragraph
 *   #careGuideWarnings   Text   — warning notes paragraph
 *
 * Product fields consumed (via backend service):
 *   slug  (string) — used to look up the FurnitureCare CMS record
 *
 * CF-gbv
 */
import { getCareGuide } from 'backend/furnitureCareGuideService.web';
import { logError } from 'backend/errorMonitoring.web';

// ── Constants ─────────────────────────────────────────────────────────────────

const MATERIAL_LABELS = {
  fabric:  'Fabric Care',
  wood:    'Wood Care',
  metal:   'Metal Care',
  leather: 'Leather Care',
};

// Why: generic tips ensure the care section always provides value even when the
// CMS has no product-specific record or the backend service fails. Collapsing
// would hide genuinely useful guidance — every physical furniture product can
// benefit from basic care advice. (CF-gbv)
const GENERIC_CARE = {
  materialLabel:   'General Care',
  cleaningMethod:  'Wipe surfaces with a soft, dry or slightly damp cloth. For light soil, use a mild soap solution and wipe clean with a fresh damp cloth. Dry immediately after cleaning.',
  maintenanceTips: 'Keep away from direct sunlight and heat sources to prevent fading and warping. Inspect hardware and connections periodically and tighten as needed.',
  warningNotes:    'Avoid harsh chemical cleaners, abrasive pads, and excessive moisture. Do not use bleach or ammonia-based products.',
};

// ── Module init ───────────────────────────────────────────────────────────────

/**
 * Initialize the care guide section for the current product.
 * Fetches care data from the backend, falls back to generic tips if unavailable,
 * then renders and expands the collapsible section.
 *
 * @param {Function} $w   Wix selector
 * @param {Object}  state Product page state — must have state.product.slug
 * @returns {Promise<{ destroy: Function }>}
 */
export async function initFurnitureCareGuideWidget($w, state) {
  function safeSet(selector, apply) {
    try {
      apply($w(selector));
    } catch (err) {
      logError({
        context: `FurnitureCareGuideWidget.safeSet(${selector})`,
        message: err?.message ?? String(err),
      });
    }
  }

  function collapse() {
    safeSet('#careGuideSection', el => el.collapse());
  }

  const slug = state?.product?.slug;

  if (!slug) {
    // No slug means the product record is missing or not yet loaded — nothing
    // to render, so collapse and exit. (CF-gbv)
    collapse();
    return { destroy() {} };
  }

  let guide = null;
  try {
    const result = await getCareGuide(slug);
    if (result.success) {
      guide = result.guide; // may be null (no CMS record) — handled below
    } else {
      // Service returned a handled failure (e.g. internal_error). Fall through
      // to the generic fallback so the section still renders, but log so the
      // failure is visible in monitoring rather than silently masked. (CF-gbv)
      logError({
        context: 'FurnitureCareGuideWidget.initFurnitureCareGuideWidget',
        message: `service error for slug "${slug}": ${result.error || 'unknown'}`,
      });
    }
  } catch (err) {
    logError({
      context: 'FurnitureCareGuideWidget.initFurnitureCareGuideWidget',
      message: err?.message ?? String(err),
    });
  }

  const materialLabel   = (guide && MATERIAL_LABELS[guide.material]) || GENERIC_CARE.materialLabel;
  const cleaningMethod  = guide?.cleaningMethod  || GENERIC_CARE.cleaningMethod;
  const maintenanceTips = guide?.maintenanceTips || GENERIC_CARE.maintenanceTips;
  const warningNotes    = guide?.warningNotes    || GENERIC_CARE.warningNotes;

  safeSet('#careGuideSection', el => {
    el.accessibility.role      = 'region';
    el.accessibility.ariaLabel = 'Care and maintenance guide';
  });
  safeSet('#careGuideTitle',       el => { el.text = 'Care & Maintenance'; });
  safeSet('#careGuideMaterial',    el => { el.text = materialLabel; });
  safeSet('#careGuideCleaning',    el => { el.text = cleaningMethod; });
  safeSet('#careGuideMaintenance', el => { el.text = maintenanceTips; });
  safeSet('#careGuideWarnings',    el => { el.text = warningNotes; });
  safeSet('#careGuideSection',     el => el.expand());

  return { destroy() {} };
}
