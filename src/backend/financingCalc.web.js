/**
 * @module financingCalc
 * @description Financing calculator widget for product pages and cart. Provides
 * monthly payment estimates at standard terms (6/12/18/24 months), Afterpay
 * 4-installment breakdown, and combined financing display data for page code
 * integration. Wraps financingService and paymentOptions into a single
 * product-page-ready API.
 *
 * @requires wix-web-module
 *
 * @setup
 * No CMS collections or API keys needed. Pure calculation module.
 * Embed on product page via $w('#financingWidget') or page code import.
 */
import { Permissions, webMethod } from 'wix-web-module';

// ─── Configuration ──────────────────────────────────────────────────

const TERMS = [6, 12, 18, 24];

const TERM_PLANS = [
  { months: 6, apr: 0, label: '6 Months', description: '0% APR for 6 months', minPrice: 200, maxPrice: 10000 },
  { months: 12, apr: 0, label: '12 Months', description: '0% APR for 12 months', minPrice: 500, maxPrice: 10000 },
  { months: 18, apr: 4.99, label: '18 Months', description: '4.99% APR for 18 months', minPrice: 750, maxPrice: 10000 },
  { months: 24, apr: 9.99, label: '24 Months', description: '9.99% APR for 24 months', minPrice: 500, maxPrice: 10000 },
];

const AFTERPAY = {
  installments: 4,
  minAmount: 35,
  maxAmount: 1000,
  fee: 0,
};

const MIN_FINANCING_AMOUNT = 200;

// ─── Public Methods ─────────────────────────────────────────────────

/**
 * Get complete financing widget data for a product page.
 * Returns monthly payments for all eligible terms, Afterpay breakdown,
 * and display-ready messaging.
 *
 * @param {number} price - Product price in dollars.
 * @returns {{success: boolean, price: number, eligible: boolean, minimumAmount: number,
 *   terms: Array, afterpay: Object, lowestMonthly: string|null, widgetData: Object}}
 */
export const getFinancingWidget = webMethod(
  Permissions.Anyone,
  async (price) => {
    try {
      const p = toNumber(price);
      if (p === null) {
        return { success: false, error: 'Valid price required' };
      }

      const terms = calculateAllTerms(p);
      const afterpay = calculateAfterpay(p);
      const eligible = terms.length > 0 || afterpay.eligible;

      const lowestMonthly = getLowestMonthlyText(terms, afterpay, p);

      return {
        success: true,
        price: p,
        eligible,
        minimumAmount: MIN_FINANCING_AMOUNT,
        terms,
        afterpay,
        lowestMonthly,
        widgetData: buildWidgetData(p, terms, afterpay),
      };
    } catch (err) {
      console.error('getFinancingWidget error:', err);
      return { success: false, error: 'Unable to calculate financing options' };
    }
  }
);

/**
 * Calculate monthly payment for a specific term.
 * Used when a customer selects a term from the financing widget.
 *
 * @param {number} price - Product price in dollars.
 * @param {number} months - Term length in months (6, 12, 18, or 24).
 * @returns {{success: boolean, monthly: number, total: number, interest: number,
 *   apr: number, months: number, isZeroInterest: boolean}}
 */
export const calculateForTerm = webMethod(
  Permissions.Anyone,
  async (price, months) => {
    try {
      const p = toNumber(price);
      const m = toNumber(months);
      if (p === null) return { success: false, error: 'Valid price required' };
      if (m === null || m <= 0) return { success: false, error: 'Valid term required' };

      const intMonths = Math.floor(m);
      const plan = TERM_PLANS.find(t => t.months === intMonths && p >= t.minPrice && p <= t.maxPrice);

      const apr = plan ? plan.apr : 9.99;
      const calc = amortize(p, intMonths, apr);

      return {
        success: true,
        monthly: calc.monthly,
        total: calc.total,
        interest: calc.interest,
        apr,
        months: intMonths,
        isZeroInterest: apr === 0,
        label: plan ? plan.label : `${intMonths} Months`,
        description: plan ? plan.description : `${apr}% APR for ${intMonths} months`,
      };
    } catch (err) {
      console.error('calculateForTerm error:', err);
      return { success: false, error: 'Unable to calculate payment' };
    }
  }
);

/**
 * Get Afterpay 4-installment breakdown for a price.
 *
 * @param {number} price - Product price in dollars.
 * @returns {{success: boolean, eligible: boolean, installments: number,
 *   installmentAmount: number, total: number, message: string}}
 */
export const getAfterpayBreakdown = webMethod(
  Permissions.Anyone,
  async (price) => {
    try {
      const p = toNumber(price);
      if (p === null) return { success: false, error: 'Valid price required' };

      const info = calculateAfterpay(p);
      return { success: true, ...info };
    } catch (err) {
      console.error('getAfterpayBreakdown error:', err);
      return { success: false, error: 'Unable to calculate Afterpay breakdown' };
    }
  }
);

/**
 * Get financing display for cart page.
 * Accepts cart total and returns combined financing/Afterpay messaging
 * with threshold nudges.
 *
 * @param {number} cartTotal - Current cart total in dollars.
 * @returns {{success: boolean, cartTotal: number, financing: Object,
 *   afterpay: Object, thresholdMessage: string|null}}
 */
export const getCartFinancing = webMethod(
  Permissions.Anyone,
  async (cartTotal) => {
    try {
      const total = toNumber(cartTotal);
      if (total === null) return { success: false, error: 'Valid cart total required' };

      const terms = calculateAllTerms(total);
      const afterpay = calculateAfterpay(total);
      const thresholdMessage = getThresholdMessage(total);

      return {
        success: true,
        cartTotal: total,
        financing: {
          eligible: terms.length > 0,
          terms,
          lowestMonthly: getLowestMonthlyText(terms, afterpay, total),
        },
        afterpay,
        thresholdMessage,
      };
    } catch (err) {
      console.error('getCartFinancing error:', err);
      return { success: false, error: 'Unable to calculate cart financing' };
    }
  }
);

// ─── Internal Helpers ───────────────────────────────────────────────

function toNumber(val) {
  if (val == null || val === '') return null;
  const n = typeof val === 'number' ? val : parseFloat(val);
  if (!isFinite(n) || isNaN(n) || n <= 0) return null;
  return n;
}

function roundCents(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Standard amortization formula.
 * M = P * [r(1+r)^n] / [(1+r)^n - 1]  when apr > 0
 * M = P / n  when apr === 0
 */
function amortize(price, months, apr) {
  if (apr === 0) {
    const monthly = roundCents(price / months);
    return { monthly, total: roundCents(monthly * months), interest: 0 };
  }

  const r = apr / 100 / 12;
  const factor = Math.pow(1 + r, months);
  const monthly = roundCents(price * (r * factor) / (factor - 1));
  const total = roundCents(monthly * months);
  const interest = roundCents(total - price);

  return { monthly, total, interest };
}

function calculateAllTerms(price) {
  return TERM_PLANS
    .filter(plan => price >= plan.minPrice && price <= plan.maxPrice)
    .map(plan => {
      const calc = amortize(price, plan.months, plan.apr);
      return {
        months: plan.months,
        apr: plan.apr,
        label: plan.label,
        description: plan.description,
        monthly: calc.monthly,
        total: calc.total,
        interest: calc.interest,
        isZeroInterest: plan.apr === 0,
      };
    });
}

function calculateAfterpay(price) {
  if (price < AFTERPAY.minAmount || price > AFTERPAY.maxAmount) {
    return {
      eligible: false,
      reason: price < AFTERPAY.minAmount
        ? `Minimum order $${AFTERPAY.minAmount} for Afterpay`
        : `Maximum order $${AFTERPAY.maxAmount} for Afterpay`,
      installments: AFTERPAY.installments,
      installmentAmount: 0,
      total: 0,
      message: '',
    };
  }

  const installmentAmount = roundCents(price / AFTERPAY.installments);

  return {
    eligible: true,
    installments: AFTERPAY.installments,
    installmentAmount,
    total: price,
    message: `or 4 interest-free payments of $${installmentAmount.toFixed(2)} with Afterpay`,
    schedule: [
      { payment: 1, label: 'Today', amount: installmentAmount },
      { payment: 2, label: 'In 2 weeks', amount: installmentAmount },
      { payment: 3, label: 'In 4 weeks', amount: installmentAmount },
      { payment: 4, label: 'In 6 weeks', amount: roundCents(price - installmentAmount * 3) },
    ],
  };
}

function getLowestMonthlyText(terms, afterpay, price) {
  let lowest = Infinity;

  for (const term of terms) {
    if (term.monthly < lowest) lowest = term.monthly;
  }

  if (afterpay.eligible && afterpay.installmentAmount < lowest) {
    lowest = afterpay.installmentAmount;
  }

  if (lowest === Infinity) return null;

  return `As low as $${Math.ceil(lowest)}/mo`;
}

function getThresholdMessage(cartTotal) {
  if (cartTotal >= MIN_FINANCING_AMOUNT) return null;

  const remaining = roundCents(MIN_FINANCING_AMOUNT - cartTotal);
  return `Add $${remaining.toFixed(2)} more to unlock financing options`;
}

function buildWidgetData(price, terms, afterpay) {
  const sections = [];

  if (afterpay.eligible) {
    sections.push({
      type: 'afterpay',
      title: 'Pay in 4',
      subtitle: 'Interest-free with Afterpay',
      highlight: `$${afterpay.installmentAmount.toFixed(2)}/payment`,
      details: afterpay.schedule,
    });
  }

  for (const term of terms) {
    sections.push({
      type: 'financing',
      title: term.label,
      subtitle: term.description,
      highlight: `$${term.monthly.toFixed(2)}/mo`,
      details: {
        monthly: term.monthly,
        total: term.total,
        interest: term.interest,
        apr: term.apr,
      },
    });
  }

  return {
    showWidget: sections.length > 0,
    sections,
    defaultSection: sections.length > 0 ? 0 : null,
    minimumAmount: MIN_FINANCING_AMOUNT,
    belowMinimum: price < MIN_FINANCING_AMOUNT,
    belowMinimumMessage: price < MIN_FINANCING_AMOUNT
      ? `Financing available on orders $${MIN_FINANCING_AMOUNT}+`
      : null,
  };
}
