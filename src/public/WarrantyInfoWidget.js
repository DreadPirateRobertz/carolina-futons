/**
 * WarrantyInfoWidget.js — Collapsible warranty terms section on the PDP.
 * Reads warranty metadata from the product record and renders duration,
 * coverage type, and a claim-filing link. Gracefully collapses when the
 * product carries no warranty data.
 *
 * Required Wix Studio elements:
 *   #warrantySection     Box    — outer wrapper (starts collapsed)
 *   #warrantyTitle       Text   — section heading "Warranty & Guarantee"
 *   #warrantyDuration    Text   — e.g. "2-Year Limited Warranty"
 *   #warrantyCoverage    Text   — coverage description paragraph
 *   #warrantyClaimBtn    Button — "File a Warranty Claim" (links to claim page)
 *
 * Product fields consumed (Stores/Products custom fields):
 *   warrantyYears  (number)  — 0 means no warranty; use 999 for lifetime
 *   warrantyType   (text)    — 'none' | 'limited' | 'full' | 'lifetime'
 *
 * CF-bog
 */

// ── Constants ─────────────────────────────────────────────────────────────────

const WARRANTY_CLAIM_URL = '/warranty-claim';

const COVERAGE_COPY = {
  lifetime: 'This product is backed by a lifetime warranty against defects in materials and workmanship. Coverage applies to the original purchaser.',
  full:     'This product is covered by a full warranty. Defective parts or products will be repaired or replaced at no charge, including shipping.',
  limited:  'This product carries a limited warranty covering manufacturing defects. Damage from misuse, accidents, or normal wear is excluded.',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extract and validate warranty fields from a product object.
 * Returns null when the product has no meaningful warranty information.
 *
 * @param {Object|null|undefined} product
 * @returns {{ years: number, type: string }|null}
 */
function parseWarranty(product) {
  if (!product) return null;

  const type  = typeof product.warrantyType  === 'string' ? product.warrantyType.toLowerCase().trim()  : '';
  const years = typeof product.warrantyYears === 'number' ? product.warrantyYears : 0;

  // Explicit 'none' or zero years with no type → no warranty to display.
  // Why: products without warranty fields default to no coverage — collapsing the
  // section is safer than silently showing incorrect warranty copy. (CF-bog)
  if (type === 'none' || type === '' || years === 0) {
    if (type !== 'lifetime') return null;
  }

  const validTypes = ['limited', 'full', 'lifetime'];
  if (!validTypes.includes(type)) return null;

  return { years, type };
}

/**
 * Build the warranty duration label shown to the customer.
 * @param {{ years: number, type: string }} warranty
 * @returns {string}
 */
function buildDurationLabel(warranty) {
  if (warranty.type === 'lifetime') return 'Lifetime Warranty';
  if (warranty.years === 1) return `1-Year ${capitalize(warranty.type)} Warranty`;
  return `${warranty.years}-Year ${capitalize(warranty.type)} Warranty`;
}

/**
 * Capitalise the first letter of a string.
 * @param {string} str
 * @returns {string}
 */
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ── Module init ───────────────────────────────────────────────────────────────

/**
 * Initialize the warranty information section for the current product.
 * Reads warranty fields from state.product and renders them in a collapsible
 * section with duration, coverage description, and a claim CTA.
 *
 * @param {Function} $w   Wix selector
 * @param {Object}  state Product page state — must have state.product
 * @returns {{ destroy: Function }}
 */
export function initWarrantyInfoWidget($w, state) {
  function collapse() {
    try { $w('#warrantySection').collapse(); } catch (err) {
      console.error('[WarrantyInfoWidget] collapse error:', err.message);
    }
  }

  const warranty = parseWarranty(state?.product);

  if (!warranty) {
    // Why: collapse rather than showing empty or placeholder copy. Products
    // without warranty data (e.g. clearance items, accessories) should not
    // display a broken warranty section. (CF-bog)
    collapse();
    return { destroy() {} };
  }

  try {
    // Section heading & ARIA
    try { $w('#warrantyTitle').text = 'Warranty & Guarantee'; } catch (err) {
      console.error('[WarrantyInfoWidget] #warrantyTitle error:', err.message);
    }
    try {
      $w('#warrantySection').accessibility.role = 'region';
      $w('#warrantySection').accessibility.ariaLabel = 'Warranty information';
    } catch (err) {
      console.error('[WarrantyInfoWidget] accessibility error:', err.message);
    }

    // Duration label
    try {
      $w('#warrantyDuration').text = buildDurationLabel(warranty);
    } catch (err) {
      console.error('[WarrantyInfoWidget] #warrantyDuration error:', err.message);
    }

    // Coverage description — use type-specific copy, fall back to limited copy
    try {
      $w('#warrantyCoverage').text = COVERAGE_COPY[warranty.type] || COVERAGE_COPY.limited;
    } catch (err) {
      console.error('[WarrantyInfoWidget] #warrantyCoverage error:', err.message);
    }

    // Claim button
    try {
      $w('#warrantyClaimBtn').label = 'File a Warranty Claim';
      $w('#warrantyClaimBtn').link  = WARRANTY_CLAIM_URL;
    } catch (err) {
      console.error('[WarrantyInfoWidget] #warrantyClaimBtn error:', err.message);
    }

    try { $w('#warrantySection').expand(); } catch (err) {
      console.error('[WarrantyInfoWidget] expand error:', err.message);
    }
  } catch (err) {
    console.error('[WarrantyInfoWidget] init error:', err.message);
    collapse();
  }

  return { destroy() {} };
}
