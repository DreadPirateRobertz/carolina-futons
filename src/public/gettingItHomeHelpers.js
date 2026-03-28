// gettingItHomeHelpers.js — Pure helpers for the Getting It Home page.
// Delivery options data, coverage zones, FAQ content, comparison table,
// and CTA utilities. cf-z8sj.

// ── Delivery Options ────────────────────────────────────────────────

/**
 * All available delivery options with pricing and details.
 * Source of truth used by comparison table and product badge logic.
 */
export const DELIVERY_OPTIONS = [
  {
    code: 'standard',
    name: 'Standard Shipping',
    price: 0,
    freeThreshold: 500,
    timeframe: '5–7 business days',
    carrier: 'UPS / FedEx',
    details: 'Curbside delivery. Free on orders $500 or more.',
    whiteGlove: false,
  },
  {
    code: 'local',
    name: 'Local Delivery',
    price: 75,
    freeThreshold: null,
    timeframe: '1–3 business days',
    carrier: 'Carolina Futons delivery team',
    details: 'In-home delivery to Hendersonville area. Includes placement in the room of your choice.',
    whiteGlove: false,
  },
  {
    code: 'white-glove-local',
    name: 'White Glove Delivery (Local)',
    price: 149,
    freeThreshold: null,
    timeframe: '1–5 business days',
    carrier: 'Carolina Futons white-glove team',
    details: 'Delivery, assembly, room placement, and packaging/debris removal. Within 25-mile radius.',
    whiteGlove: true,
    radiusMiles: 25,
  },
  {
    code: 'white-glove-regional',
    name: 'White Glove Delivery (Regional)',
    price: 249,
    freeThreshold: null,
    timeframe: '3–7 business days',
    carrier: 'Carolina Futons white-glove team',
    details: 'Full white-glove service — delivery, assembly, room placement, debris removal. 25–100 mile radius (Asheville, Greenville, Spartanburg, and more).',
    whiteGlove: true,
    radiusMiles: 100,
  },
];

// ── Coverage Zones ──────────────────────────────────────────────────

export const COVERAGE_ZONES = {
  local: {
    label: 'Local Zone',
    radiusMiles: 25,
    cities: ['Hendersonville', 'Flat Rock', 'Fletcher', 'Arden', 'Mills River', 'Horse Shoe'],
    description:
      'Our local delivery zone covers Hendersonville and the surrounding area within 25 miles. ' +
      'This includes Flat Rock, Fletcher, Arden, Mills River, and Horse Shoe.',
  },
  regional: {
    label: 'Regional Zone',
    radiusMin: 25,
    radiusMax: 100,
    cities: ['Asheville', 'Greenville', 'Spartanburg', 'Anderson', 'Brevard', 'Waynesville', 'Canton'],
    description:
      'Our regional white-glove zone extends 25–100 miles from Hendersonville, including ' +
      'Asheville, Greenville, Spartanburg, Brevard, Waynesville, and more. ' +
      'Contact us to confirm availability for your specific address.',
  },
};

// ── White Glove Checklist ───────────────────────────────────────────

export const WHITE_GLOVE_CHECKLIST = [
  'Scheduled delivery window (morning or afternoon)',
  'Professional in-home delivery to your room of choice',
  'Full assembly of your furniture',
  'Room placement and final adjustment',
  'Packaging and debris removal — we haul it all away',
  'White-glove care: no scuffs, no rushing, no stress',
];

// ── Delivery FAQ ────────────────────────────────────────────────────

export const DELIVERY_FAQ = [
  {
    q: 'How far in advance should I schedule white-glove delivery?',
    a: 'We recommend booking at least 5–7 business days in advance for local delivery, and 10–14 days for regional. Peak periods (holidays, spring) book out faster — the earlier the better.',
    zones: ['local', 'regional'],
  },
  {
    q: 'Do I need to be home during delivery?',
    a: 'Yes — someone 18 or older must be present to receive and sign for white-glove delivery. For standard shipping, you do not need to be home.',
    zones: ['local', 'regional', 'standard'],
  },
  {
    q: 'What if I live in an apartment or condo?',
    a: 'No problem. Our white-glove team handles apartment, condo, and multi-floor deliveries. Just let us know about elevator access, stairwell dimensions, or building entry requirements when you schedule, so we can plan accordingly.',
    zones: ['local', 'regional'],
  },
  {
    q: 'Can you remove my old furniture?',
    a: 'Debris and packaging removal are always included. Old furniture haul-away is available as an add-on — just ask when scheduling. Additional fees may apply.',
    zones: ['local', 'regional'],
  },
  {
    q: 'What does "assembly" include?',
    a: 'Assembly covers full setup of your futon frame, mattress placement, and any accessories you ordered. We test the mechanism and make sure everything is working perfectly before we leave.',
    zones: ['local', 'regional'],
  },
  {
    q: 'Does standard shipping include assembly?',
    a: 'No. Standard shipping via UPS/FedEx delivers to your curb or door. Assembly is not included. If you need assembly, choose local or white-glove delivery.',
    zones: ['standard'],
  },
];

// ── Helper Functions ────────────────────────────────────────────────

/**
 * Get a delivery option by its code.
 * @param {string} code
 * @returns {Object|null}
 */
export function getDeliveryOptionByCode(code) {
  if (!code) return null;
  return DELIVERY_OPTIONS.find(o => o.code === code) ?? null;
}

/**
 * Get the human-readable label for a coverage zone.
 * @param {string} zone - 'local' | 'regional'
 * @returns {string}
 */
export function getCoverageLabel(zone) {
  return COVERAGE_ZONES[zone]?.label ?? '';
}

/**
 * Get the coverage description for a zone.
 * @param {string} zone
 * @returns {string}
 */
export function getCoverageDescription(zone) {
  return COVERAGE_ZONES[zone]?.description ?? '';
}

/**
 * @param {string} zone
 * @returns {boolean}
 */
export function isLocalZone(zone) {
  return zone === 'local';
}

/**
 * @param {string} zone
 * @returns {boolean}
 */
export function isRegionalZone(zone) {
  return zone === 'regional';
}

/**
 * Filter FAQs by delivery zone. Returns all FAQs when zone is null/undefined.
 * @param {string|null} zone
 * @returns {Array}
 */
export function filterFaqsByZone(zone) {
  if (!zone) return DELIVERY_FAQ;
  return DELIVERY_FAQ.filter(faq => faq.zones.includes(zone));
}

/**
 * Build comparison table rows for all delivery options.
 * @returns {Array<{code, option, priceLabel, details, timeframe}>}
 */
export function buildDeliveryComparisonRows() {
  return DELIVERY_OPTIONS.map(opt => ({
    code: opt.code,
    option: opt.name,
    priceLabel: opt.price === 0
      ? `Free on orders $${opt.freeThreshold}+`
      : `$${opt.price}`,
    details: opt.details,
    timeframe: opt.timeframe,
    whiteGlove: opt.whiteGlove,
  }));
}

/**
 * Returns the URL for the scheduling / white-glove booking CTA.
 * Points to the contact form with a pre-selected topic.
 * @returns {string}
 */
export function getSchedulingCtaUrl() {
  return '/contact?topic=schedule-delivery';
}

/**
 * Short badge text for white-glove-eligible product cards.
 * @returns {string}
 */
export function getWhiteGloveBadgeText() {
  return 'White Glove Delivery Available';
}
