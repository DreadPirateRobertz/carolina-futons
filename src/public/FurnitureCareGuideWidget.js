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

// ── Constants ─────────────────────────────────────────────────────────────────

const MATERIAL_LABELS = {
  fabric:  'Fabric Care',
  wood:    'Wood Care',
  metal:   'Metal Care',
  leather: 'Leather Care',
};

// Why: generic tips ensure the care section always provides value, even when
// a product has no CMS care record. Showing an empty section or collapsing
// entirely would leave customers without any maintenance guidance. (CF-gbv)
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
  function collapse() {
    try { $w('#careGuideSection').collapse(); } catch (err) {
      console.error('[FurnitureCareGuideWidget] collapse error:', err.message);
    }
  }

  const slug = state?.product?.slug;

  if (!slug) {
    // Why: no slug means the product record is missing or not yet loaded —
    // collapsing avoids rendering an empty care guide with no content. (CF-gbv)
    collapse();
    return { destroy() {} };
  }

  let guide = null;
  try {
    const result = await getCareGuide(slug);
    if (result.success) {
      guide = result.guide; // may be null (no CMS record) — handled below
    }
  } catch (err) {
    console.error('[FurnitureCareGuideWidget] service error:', err.message);
    // Fall through to generic tips on service failure — still useful to the customer.
  }

  // Resolve display data: use product-specific guide or generic fallback.
  // Why: generic fallback ensures the section always renders rather than showing
  // nothing. Every physical furniture product can benefit from basic care guidance,
  // so collapsing on missing data would hide genuinely useful information. (CF-gbv)
  const materialLabel   = (guide && MATERIAL_LABELS[guide.material]) || GENERIC_CARE.materialLabel;
  const cleaningMethod  = guide?.cleaningMethod  || GENERIC_CARE.cleaningMethod;
  const maintenanceTips = guide?.maintenanceTips || GENERIC_CARE.maintenanceTips;
  const warningNotes    = guide?.warningNotes    || GENERIC_CARE.warningNotes;

  try {
    try {
      $w('#careGuideSection').accessibility.role     = 'region';
      $w('#careGuideSection').accessibility.ariaLabel = 'Care and maintenance guide';
    } catch (err) {
      console.error('[FurnitureCareGuideWidget] accessibility error:', err.message);
    }

    try { $w('#careGuideTitle').text      = 'Care & Maintenance'; } catch (err) {
      console.error('[FurnitureCareGuideWidget] #careGuideTitle error:', err.message);
    }
    try { $w('#careGuideMaterial').text   = materialLabel; } catch (err) {
      console.error('[FurnitureCareGuideWidget] #careGuideMaterial error:', err.message);
    }
    try { $w('#careGuideCleaning').text   = cleaningMethod; } catch (err) {
      console.error('[FurnitureCareGuideWidget] #careGuideCleaning error:', err.message);
    }
    try { $w('#careGuideMaintenance').text = maintenanceTips; } catch (err) {
      console.error('[FurnitureCareGuideWidget] #careGuideMaintenance error:', err.message);
    }
    try { $w('#careGuideWarnings').text   = warningNotes; } catch (err) {
      console.error('[FurnitureCareGuideWidget] #careGuideWarnings error:', err.message);
    }

    try { $w('#careGuideSection').expand(); } catch (err) {
      console.error('[FurnitureCareGuideWidget] expand error:', err.message);
    }
  } catch (err) {
    console.error('[FurnitureCareGuideWidget] init error:', err.message);
    collapse();
  }

  return { destroy() {} };
}
