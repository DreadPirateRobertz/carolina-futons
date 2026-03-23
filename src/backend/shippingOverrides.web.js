/**
 * @module shippingOverrides.web
 * @description CMS-driven shipping override rules — no-deploy shipping customization.
 *
 * Reads ShippingOverrides CMS collection (cached, 5-min TTL) and applies matching
 * rules to a shipping options array. Both shipping-rates-plugin.js and
 * shippingIntelligence.web.js call this as a final post-routing step.
 *
 * Rule types:
 *   - product_override  condition: {productId}            → per-SKU overrides
 *   - zip_override      condition: {zipPrefix}            → geographic rules
 *   - promo             condition: {minOrderValue}        → spend-threshold promos
 *   - global            condition: {}                     → applies to all orders
 *
 * Actions (can combine):
 *   - freeShipping: true            → zero-cost all non-local options
 *   - discountShipping: 0.0–1.0    → fractional discount off all option costs
 *   - freeWhiteGlove: true         → zero-cost white-glove options only
 *   - forceLTL: true               → routing hint (consumed pre-routing by callers)
 *
 * @requires wix-data - ShippingOverrides CMS reads
 */

import wixData from 'wix-data';

const COLLECTION = 'ShippingOverrides';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let _cache = null;
let _cacheExpiry = 0;

/**
 * Fetch active override rules from CMS, with 5-min in-memory cache.
 * @private
 * @returns {Promise<Array>}
 */
async function getOverrideRules() {
  if (_cache && Date.now() < _cacheExpiry) return _cache;

  const result = await wixData.query(COLLECTION)
    .eq('active', true)
    .ascending('priority')
    .find({ suppressAuth: true });

  _cache = result.items || [];
  _cacheExpiry = Date.now() + CACHE_TTL_MS;
  return _cache;
}

/**
 * Invalidate the rule cache (used by tests and admin triggers).
 */
export function _invalidateCache() {
  _cache = null;
  _cacheExpiry = 0;
}

/**
 * Determine whether a rule matches the current shipping context.
 * @private
 * @param {Object} rule - ShippingOverrides CMS item
 * @param {Object} context - {zip, products[], orderSubtotal, memberId}
 * @returns {boolean}
 */
function ruleMatches(rule, context) {
  if (!rule.active) return false;
  if (rule.endDate && new Date(rule.endDate) < new Date()) return false;
  const cond = rule.condition || {};

  switch (rule.ruleType) {
    case 'product_override':
      if (Array.isArray(cond.productIds)) {
        return (context.products || []).some(p => cond.productIds.includes(p.productId));
      }
      return (context.products || []).some(p => p.productId === cond.productId);
    case 'zip_override':
      return !!(cond.zipPrefix && (context.zip || '').startsWith(String(cond.zipPrefix)));
    case 'promo':
      return (context.orderSubtotal || 0) >= (cond.minOrderValue || 0);
    case 'global':
      return true;
    default:
      return false;
  }
}

/**
 * Merge actions from all matching rules (later/higher-priority rules win on conflict).
 * @private
 * @param {Array} rules
 * @param {Object} context
 * @returns {Object} merged action object
 */
function mergeMatchingActions(rules, context) {
  const merged = {};
  for (const rule of rules) {
    if (ruleMatches(rule, context)) {
      Object.assign(merged, rule.action || {});
    }
  }
  return merged;
}

/**
 * Apply a merged actions object to an options array.
 * @private
 * @param {Array} options - Shipping options
 * @param {Object} actions - Merged actions from matching rules
 * @returns {Array}
 */
function applyActions(options, actions) {
  if (!actions || Object.keys(actions).length === 0) return options;

  return options.map(opt => {
    let { cost } = opt;

    if (actions.freeShipping) {
      cost = 0;
    } else if (typeof actions.discountShipping === 'number') {
      const discount = Math.min(1, Math.max(0, actions.discountShipping));
      cost = cost * (1 - discount);
    }

    if (actions.freeWhiteGlove && (opt.code || '').startsWith('white-glove')) {
      cost = 0;
    }

    // Walk addOn: local delivery options carry white-glove as a nested add-on.
    // Zero the add-on cost when freeWhiteGlove is active.
    let { addOn } = opt;
    if (actions.freeWhiteGlove && addOn && (addOn.code || '').startsWith('white-glove') && addOn.cost > 0) {
      addOn = { ...addOn, cost: 0, price: '0.00' };
    }

    cost = Math.max(0, cost);

    const costChanged = cost !== opt.cost;
    const addOnChanged = addOn !== opt.addOn;
    if (!costChanged && !addOnChanged) return opt;
    return { ...opt, cost, price: cost.toFixed(2), ...(addOnChanged ? { addOn } : {}) };
  });
}

/**
 * Get merged actions for the current context — including routing hints like forceLTL.
 * Callers can use this before routing to check `actions.forceLTL`.
 *
 * @param {Object} context - {zip, products[], orderSubtotal, memberId}
 * @returns {Promise<Object>} merged action object (empty {} on CMS error)
 */
export async function getMatchingActions(context) {
  try {
    const rules = await getOverrideRules();
    return mergeMatchingActions(rules, context);
  } catch {
    return {};
  }
}

/**
 * Apply CMS-driven override rules to a shipping options array.
 * Call this as the final step before returning rates to callers.
 *
 * Fail-open: if the CMS is unavailable, returns options unchanged.
 *
 * @param {Array} options  - Array of shipping option objects
 * @param {Object} context - {zip, products[], orderSubtotal, memberId}
 * @returns {Promise<Array>} Modified options array
 */
export async function applyOverrides(options, context) {
  try {
    const actions = await getMatchingActions(context);
    return applyActions(options, actions);
  } catch {
    return options;
  }
}
