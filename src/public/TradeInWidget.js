/**
 * @module TradeInWidget
 * @description Pure functions for the Trade-In CTA widget shown on eligible PDPs.
 *
 * No Wix API calls — all side effects handled by the page module which calls
 * these functions and applies returned state to Wix elements.
 *
 * Elements expected on PDP:
 *   #tradeInBanner     — collapsed strip showing trade-in CTA
 *   #tradeInEstimate   — inline credit range estimate text
 *   #tradeInCtaBtn     — "Start Trade-In" button
 *   #tradeInConditionDropdown — condition selector (if shown inline)
 */

/** Product types eligible for trade-in. Mirrors VALID_PRODUCT_TYPES in tradeInService. */
export const ELIGIBLE_PRODUCT_TYPES = [
  'futon-frame',
  'futon-mattress',
  'murphy-bed',
  'platform-bed',
  'sofa',
];

/** Map from Wix product category slug to trade-in product type. */
const CATEGORY_TO_TRADE_IN_TYPE = {
  'futon-frames':    'futon-frame',
  'futon-mattresses':'futon-mattress',
  'murphy-beds':     'murphy-bed',
  'platform-beds':   'platform-bed',
  'sofas':           'sofa',
};

/**
 * Returns the trade-in product type for a given product category slug,
 * or null if the category is not eligible.
 *
 * @param {string|null|undefined} categorySlug
 * @returns {string|null}
 */
export function getTradeInType(categorySlug) {
  if (typeof categorySlug !== 'string' || !categorySlug.trim()) return null;
  return CATEGORY_TO_TRADE_IN_TYPE[categorySlug.trim().toLowerCase()] ?? null;
}

/**
 * Whether the widget should be shown for the given trade-in type.
 *
 * @param {string|null} tradeInType
 * @returns {boolean}
 */
export function isEligible(tradeInType) {
  return ELIGIBLE_PRODUCT_TYPES.includes(tradeInType ?? '');
}

/**
 * Build the banner text for the PDP widget.
 * Shown to all visitors regardless of whether they have an old item.
 *
 * @param {string|null} tradeInType
 * @returns {string}
 */
export function buildBannerText(tradeInType) {
  if (!isEligible(tradeInType)) return '';
  const typeLabels = {
    'futon-frame':    'futon frame',
    'futon-mattress': 'futon mattress',
    'murphy-bed':     'murphy bed',
    'platform-bed':   'platform bed',
    'sofa':           'sofa',
  };
  const label = typeLabels[tradeInType] || 'furniture';
  return `Trade in your old ${label} for store credit toward this purchase.`;
}

/**
 * Format a credit estimate range for display.
 *
 * @param {{ min: number, max: number, base: number }} estimate
 * @returns {string}  e.g. "Worth $64–$86 in store credit"
 */
export function formatEstimateText(estimate) {
  if (!estimate || typeof estimate !== 'object') return '';
  const { min, max } = estimate;
  if (min <= 0 && max <= 0) return 'No credit available for this condition.';
  if (min === max) return `Worth $${min} in store credit`;
  return `Worth $${min}–$${max} in store credit`;
}

/**
 * Build the condition dropdown options.
 *
 * @returns {Array<{ value: string, label: string, description: string }>}
 */
export function buildConditionOptions() {
  return [
    {
      value: 'good',
      label: 'Good',
      description: 'Minimal wear, no tears or stains, fully functional.',
    },
    {
      value: 'fair',
      label: 'Fair',
      description: 'Some visible wear, minor cosmetic issues, still functional.',
    },
    {
      value: 'poor',
      label: 'Poor',
      description: 'Heavy wear, structural issues, or significant cosmetic damage.',
    },
  ];
}

/**
 * Widget state when the product is not eligible for trade-in.
 *
 * @returns {{ bannerVisible: boolean }}
 */
export function buildHiddenState() {
  return { bannerVisible: false };
}

/**
 * Widget state when the product is eligible but no estimate has been fetched.
 *
 * @param {string} tradeInType
 * @returns {{ bannerVisible: boolean, bannerText: string, estimateVisible: boolean }}
 */
export function buildIdleState(tradeInType) {
  return {
    bannerVisible: true,
    bannerText: buildBannerText(tradeInType),
    estimateVisible: false,
  };
}

/**
 * Widget state while fetching an estimate.
 *
 * @returns {{ estimateVisible: boolean, estimateText: string, ctaDisabled: boolean }}
 */
export function buildLoadingState() {
  return {
    estimateVisible: true,
    estimateText: 'Calculating estimate…',
    ctaDisabled: true,
  };
}

/**
 * Widget state after a successful estimate fetch.
 *
 * @param {{ min: number, max: number, base: number }} estimate
 * @returns {{ estimateVisible: boolean, estimateText: string, ctaDisabled: boolean, ctaLabel: string }}
 */
export function buildEstimateState(estimate) {
  const estimateText = formatEstimateText(estimate);
  const noCredit = estimate.max <= 0;
  return {
    estimateVisible: true,
    estimateText,
    ctaDisabled: noCredit,
    ctaLabel: noCredit ? 'No credit available' : 'Start Trade-In →',
  };
}

/**
 * Build the Trade-In page URL with pre-filled query params.
 *
 * @param {string} tradeInType
 * @param {string} [condition]
 * @returns {string}
 */
export function buildTradeInUrl(tradeInType, condition = '') {
  const base = '/trade-in';
  const params = new URLSearchParams();
  if (tradeInType) params.set('type', tradeInType);
  if (condition) params.set('condition', condition);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}
