/**
 * @module financingService
 * @description Backend web module for Buy Now Pay Later / financing calculations.
 * Provides monthly payment estimates for furniture purchases.
 * Currently uses in-house calculation; designed for future Sezzle/Affirm integration.
 *
 * @requires wix-web-module
 *
 * @setup
 * No external API keys needed for calculator mode.
 * For future BNPL integration, add provider API keys to Wix Secrets Manager.
 */
import { Permissions, webMethod } from 'wix-web-module';

// ─── Financing Configuration ──────────────────────────────────────────

const FINANCING_PLANS = [
  { term: 4, apr: 0, label: 'Pay in 4', description: '4 interest-free payments', minPrice: 50, maxPrice: 5000 },
  { term: 6, apr: 0, label: '6 Months', description: '0% APR for 6 months', minPrice: 200, maxPrice: 10000 },
  { term: 12, apr: 0, label: '12 Months', description: '0% APR for 12 months', minPrice: 500, maxPrice: 10000 },
  { term: 24, apr: 9.99, label: '24 Months', description: '9.99% APR for 24 months', minPrice: 500, maxPrice: 10000 },
  { term: 36, apr: 14.99, label: '36 Months', description: '14.99% APR for 36 months', minPrice: 1000, maxPrice: 10000 },
];

const MIN_FINANCING_PRICE = 50;

// ─── Public Methods ─────────────────────────────────────────────────

/**
 * Calculate the monthly payment for a given price and term.
 * Uses standard amortization formula for APR > 0, simple division for 0% APR.
 *
 * @param {number} price - Product price in dollars.
 * @param {number} term - Number of monthly payments.
 * @param {number} [apr=0] - Annual percentage rate (e.g., 9.99 for 9.99%).
 * @returns {{monthly: number, total: number, interest: number, term: number, apr: number}}
 */
export const calculateMonthlyPayment = webMethod(
  Permissions.Anyone,
  (price, term, apr = 0) => {
    const p = Number(price);
    const t = Math.max(1, Math.floor(Number(term)));
    const a = Math.max(0, Number(apr));

    if (!isFinite(p) || p <= 0) {
      return { monthly: 0, total: 0, interest: 0, term: t, apr: a };
    }

    if (a === 0) {
      const monthly = roundCents(p / t);
      return { monthly, total: roundCents(monthly * t), interest: 0, term: t, apr: 0 };
    }

    // Standard amortization: M = P * [r(1+r)^n] / [(1+r)^n - 1]
    const monthlyRate = a / 100 / 12;
    const factor = Math.pow(1 + monthlyRate, t);
    const monthly = roundCents(p * (monthlyRate * factor) / (factor - 1));
    const total = roundCents(monthly * t);
    const interest = roundCents(total - p);

    return { monthly, total, interest, term: t, apr: a };
  }
);

/**
 * Get available financing plans for a given price.
 * Filters plans by price eligibility and calculates monthly for each.
 *
 * @param {number} price - Product price in dollars.
 * @returns {Array<{term: number, apr: number, label: string, description: string, monthly: number, total: number, interest: number}>}
 */
export const getFinancingOptions = webMethod(
  Permissions.Anyone,
  (price) => {
    const p = Number(price);
    if (!isFinite(p) || p < MIN_FINANCING_PRICE) return [];

    return FINANCING_PLANS
      .filter(plan => p >= plan.minPrice && p <= plan.maxPrice)
      .map(plan => {
        const calc = calculatePayment(p, plan.term, plan.apr);
        return {
          term: plan.term,
          apr: plan.apr,
          label: plan.label,
          description: plan.description,
          monthly: calc.monthly,
          total: calc.total,
          interest: calc.interest,
        };
      });
  }
);

/**
 * Get the lowest monthly payment text for display on product cards.
 * Returns "As low as $XX/mo" or null if price is too low for financing.
 *
 * @param {number} price - Product price in dollars.
 * @returns {string|null} Display text like "As low as $42/mo" or null.
 */
export const getLowestMonthlyDisplay = webMethod(
  Permissions.Anyone,
  (price) => {
    const p = Number(price);
    if (!isFinite(p) || p < MIN_FINANCING_PRICE) return null;

    // Find the plan with the longest 0% term for lowest monthly
    const zeroPlans = FINANCING_PLANS.filter(plan => plan.apr === 0 && p >= plan.minPrice && p <= plan.maxPrice);

    if (zeroPlans.length === 0) return null;

    // Pick longest term for lowest monthly
    const best = zeroPlans.reduce((a, b) => a.term > b.term ? a : b);
    const monthly = Math.ceil(p / best.term);

    return `As low as $${monthly}/mo`;
  }
);

// ─── Internal Helpers ───────────────────────────────────────────────

/**
 * Pure calculation function (not a webMethod) for internal use.
 */
function calculatePayment(price, term, apr) {
  if (apr === 0) {
    const monthly = roundCents(price / term);
    return { monthly, total: roundCents(monthly * term), interest: 0 };
  }

  const monthlyRate = apr / 100 / 12;
  const factor = Math.pow(1 + monthlyRate, term);
  const monthly = roundCents(price * (monthlyRate * factor) / (factor - 1));
  const total = roundCents(monthly * term);
  const interest = roundCents(total - price);

  return { monthly, total, interest };
}

function roundCents(value) {
  return Math.round(value * 100) / 100;
}
