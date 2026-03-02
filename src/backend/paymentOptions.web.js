/**
 * @module paymentOptions
 * @description Payment options display, Afterpay/BNPL messaging, and payment
 * method helpers for product pages and checkout. Shows installment pricing,
 * payment method availability, and financing options.
 *
 * @requires wix-web-module
 * @requires wix-data
 *
 * @setup
 * Wix Payments is the payment processor. Enabled methods:
 * - Credit/Debit cards (Visa, Mastercard, Amex, Discover)
 * - Apple Pay
 * - Google Pay
 * - Afterpay (BNPL — 4 installments, $35-$1,000 range)
 * - Wix POS / Tap to Pay (in-store)
 *
 * No CMS collection needed — this module computes installment
 * messaging from product prices and displays payment badges.
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize } from 'backend/utils/sanitize';
import { colors } from 'public/sharedTokens.js';

// Afterpay configuration
const AFTERPAY_CONFIG = {
  minAmount: 35,
  maxAmount: 1000,
  installments: 4,
  fee: 0,
  currency: 'USD',
};

// Financing tiers (separate from Afterpay — for larger purchases)
const FINANCING_TIERS = [
  { minAmount: 300, maxAmount: 999, months: 6, apr: 0, label: '6 months interest-free' },
  { minAmount: 1000, maxAmount: 1999, months: 12, apr: 0, label: '12 months interest-free' },
  { minAmount: 2000, maxAmount: 4999, months: 24, apr: 9.99, label: '24 months at 9.99% APR' },
  { minAmount: 5000, maxAmount: 10000, months: 36, apr: 9.99, label: '36 months at 9.99% APR' },
];

// Available payment methods
const PAYMENT_METHODS = [
  { id: 'credit-card', name: 'Credit/Debit Card', icon: 'credit-card', brands: ['Visa', 'Mastercard', 'Amex', 'Discover'], alwaysAvailable: true },
  { id: 'apple-pay', name: 'Apple Pay', icon: 'apple-pay', brands: ['Apple Pay'], alwaysAvailable: true },
  { id: 'google-pay', name: 'Google Pay', icon: 'google-pay', brands: ['Google Pay'], alwaysAvailable: true },
  { id: 'afterpay', name: 'Afterpay', icon: 'afterpay', brands: ['Afterpay'], alwaysAvailable: false },
];

// ── getPaymentOptions (public — for product page) ───────────────────

export const getPaymentOptions = webMethod(
  Permissions.Anyone,
  async (price) => {
    try {
      const numPrice = typeof price === 'number' ? price : parseFloat(price);
      if (!isFinite(numPrice) || numPrice <= 0) {
        return { success: false, error: 'Valid price required' };
      }

      const options = {
        afterpay: getAfterpayInfo(numPrice),
        financing: getFinancingInfo(numPrice),
        methods: getAvailableMethods(numPrice),
        badges: getPaymentBadges(numPrice),
      };

      return { success: true, price: numPrice, ...options };
    } catch (err) {
      console.error('getPaymentOptions error:', err);
      return { success: false, error: 'Unable to calculate payment options' };
    }
  }
);

// ── getAfterpayMessage (public — for product page badge) ────────────

export const getAfterpayMessage = webMethod(
  Permissions.Anyone,
  async (price) => {
    try {
      const numPrice = typeof price === 'number' ? price : parseFloat(price);
      if (!isFinite(numPrice) || numPrice <= 0) {
        return { success: false, error: 'Valid price required' };
      }

      const info = getAfterpayInfo(numPrice);
      return { success: true, ...info };
    } catch (err) {
      console.error('getAfterpayMessage error:', err);
      return { success: false, error: 'Unable to calculate Afterpay message' };
    }
  }
);

// ── getBatchPaymentBadges (public — for category pages) ─────────────

export const getBatchPaymentBadges = webMethod(
  Permissions.Anyone,
  async (products = []) => {
    try {
      if (!Array.isArray(products) || products.length === 0) {
        return { success: true, badges: {} };
      }

      const badges = {};
      for (const prod of products.slice(0, 50)) {
        const cleanId = sanitize(prod.productId || prod._id || '', 50);
        const price = typeof prod.price === 'number' ? prod.price : parseFloat(prod.price);

        if (!cleanId || !isFinite(price) || price <= 0) continue;

        const afterpay = getAfterpayInfo(price);
        const financing = getFinancingInfo(price);

        const badgeList = [];

        if (afterpay.eligible) {
          badgeList.push({
            type: 'afterpay',
            label: `4 payments of $${afterpay.installmentAmount}`,
            color: colors.sandLight,
            textColor: colors.espresso,
          });
        }

        if (financing.eligible) {
          badgeList.push({
            type: 'financing',
            label: financing.bestTier.label,
            color: colors.sandLight,
            textColor: colors.espresso,
          });
        }

        if (badgeList.length > 0) {
          badges[cleanId] = badgeList;
        }
      }

      return { success: true, badges };
    } catch (err) {
      console.error('getBatchPaymentBadges error:', err);
      return { success: false, error: 'Unable to calculate payment badges' };
    }
  }
);

// ── getCheckoutPaymentSummary (public — for checkout page) ──────────

export const getCheckoutPaymentSummary = webMethod(
  Permissions.Anyone,
  async (cartTotal) => {
    try {
      const numTotal = typeof cartTotal === 'number' ? cartTotal : parseFloat(cartTotal);
      if (!isFinite(numTotal) || numTotal <= 0) {
        return { success: false, error: 'Valid cart total required' };
      }

      const afterpay = getAfterpayInfo(numTotal);
      const financing = getFinancingInfo(numTotal);
      const methods = getAvailableMethods(numTotal);

      const summary = {
        cartTotal: numTotal,
        payNow: {
          methods: methods.filter(m => m.id !== 'afterpay'),
          message: `Pay $${numTotal.toFixed(2)} now`,
        },
      };

      if (afterpay.eligible) {
        summary.afterpay = {
          installmentAmount: afterpay.installmentAmount,
          installments: afterpay.installments,
          message: afterpay.message,
          totalCost: numTotal,
        };
      }

      if (financing.eligible) {
        summary.financing = {
          tiers: financing.tiers,
          bestTier: financing.bestTier,
          message: financing.message,
        };
      }

      // Free shipping threshold messaging
      const FREE_SHIPPING_THRESHOLD = 999;
      if (numTotal < FREE_SHIPPING_THRESHOLD) {
        const remaining = FREE_SHIPPING_THRESHOLD - numTotal;
        summary.shippingMessage = `Add $${remaining.toFixed(2)} more for free shipping`;
      } else {
        summary.shippingMessage = 'Free shipping included';
      }

      return { success: true, summary };
    } catch (err) {
      console.error('getCheckoutPaymentSummary error:', err);
      return { success: false, error: 'Unable to calculate payment summary' };
    }
  }
);

// ── getInstallmentCalculation (public — for financing widget) ───────

export const getInstallmentCalculation = webMethod(
  Permissions.Anyone,
  async (price, months) => {
    try {
      const numPrice = typeof price === 'number' ? price : parseFloat(price);
      const numMonths = typeof months === 'number' ? months : parseInt(months);

      if (!isFinite(numPrice) || numPrice <= 0) {
        return { success: false, error: 'Valid price required' };
      }
      if (!isFinite(numMonths) || numMonths <= 0 || numMonths > 120) {
        return { success: false, error: 'Valid months required (1-120)' };
      }

      // Find applicable tier
      const tier = FINANCING_TIERS.find(t => numPrice >= t.minAmount && numPrice <= t.maxAmount && t.months === numMonths);

      if (!tier) {
        // Calculate with default rate
        const apr = 9.99;
        const monthlyRate = apr / 100 / 12;
        const payment = monthlyRate > 0
          ? (numPrice * monthlyRate * Math.pow(1 + monthlyRate, numMonths)) / (Math.pow(1 + monthlyRate, numMonths) - 1)
          : numPrice / numMonths;
        const totalCost = Math.round(payment * numMonths * 100) / 100;

        return {
          success: true,
          price: numPrice,
          months: numMonths,
          apr,
          monthlyPayment: Math.round(payment * 100) / 100,
          totalCost,
          totalInterest: Math.round((totalCost - numPrice) * 100) / 100,
          isPromotional: false,
        };
      }

      // Use promotional tier
      const monthlyRate = tier.apr / 100 / 12;
      const payment = monthlyRate > 0
        ? (numPrice * monthlyRate * Math.pow(1 + monthlyRate, numMonths)) / (Math.pow(1 + monthlyRate, numMonths) - 1)
        : numPrice / numMonths;
      const totalCost = Math.round(payment * numMonths * 100) / 100;

      return {
        success: true,
        price: numPrice,
        months: numMonths,
        apr: tier.apr,
        monthlyPayment: Math.round(payment * 100) / 100,
        totalCost,
        totalInterest: Math.round((totalCost - numPrice) * 100) / 100,
        isPromotional: tier.apr === 0,
        tierLabel: tier.label,
      };
    } catch (err) {
      console.error('getInstallmentCalculation error:', err);
      return { success: false, error: 'Unable to calculate installments' };
    }
  }
);

// ── Internal helpers ────────────────────────────────────────────────

function getAfterpayInfo(price) {
  if (price < AFTERPAY_CONFIG.minAmount || price > AFTERPAY_CONFIG.maxAmount) {
    return {
      eligible: false,
      reason: price < AFTERPAY_CONFIG.minAmount
        ? `Minimum order $${AFTERPAY_CONFIG.minAmount} for Afterpay`
        : `Maximum order $${AFTERPAY_CONFIG.maxAmount} for Afterpay`,
      message: '',
    };
  }

  const installmentAmount = Math.round((price / AFTERPAY_CONFIG.installments) * 100) / 100;

  return {
    eligible: true,
    installmentAmount,
    installments: AFTERPAY_CONFIG.installments,
    message: `or ${AFTERPAY_CONFIG.installments} interest-free payments of $${installmentAmount.toFixed(2)} with Afterpay`,
    totalCost: price,
  };
}

function getFinancingInfo(price) {
  const eligible = FINANCING_TIERS.filter(t => price >= t.minAmount && price <= t.maxAmount);

  if (eligible.length === 0) {
    return {
      eligible: false,
      message: price < FINANCING_TIERS[0].minAmount
        ? `Financing available on orders $${FINANCING_TIERS[0].minAmount}+`
        : '',
    };
  }

  // Best tier = 0% APR or longest term
  const bestTier = eligible.reduce((best, tier) => {
    if (tier.apr === 0 && best.apr !== 0) return tier;
    if (tier.apr === 0 && best.apr === 0) return tier.months > best.months ? tier : best;
    return tier.months > best.months ? tier : best;
  });

  return {
    eligible: true,
    tiers: eligible.map(t => ({
      months: t.months,
      apr: t.apr,
      label: t.label,
      monthlyPayment: t.apr === 0
        ? Math.round((price / t.months) * 100) / 100
        : Math.round(((price * (t.apr / 100 / 12) * Math.pow(1 + t.apr / 100 / 12, t.months)) / (Math.pow(1 + t.apr / 100 / 12, t.months) - 1)) * 100) / 100,
    })),
    bestTier,
    message: `As low as $${(price / bestTier.months).toFixed(2)}/mo with ${bestTier.label}`,
  };
}

function getAvailableMethods(price) {
  return PAYMENT_METHODS.filter(m => {
    if (m.alwaysAvailable) return true;
    if (m.id === 'afterpay') return price >= AFTERPAY_CONFIG.minAmount && price <= AFTERPAY_CONFIG.maxAmount;
    return true;
  }).map(m => ({
    id: m.id,
    name: m.name,
    icon: m.icon,
    brands: m.brands,
  }));
}

function getPaymentBadges(price) {
  const badges = [
    { type: 'secure', label: 'Secure Checkout', icon: 'lock', color: colors.success },
  ];

  if (price >= AFTERPAY_CONFIG.minAmount && price <= AFTERPAY_CONFIG.maxAmount) {
    badges.push({
      type: 'afterpay',
      label: `4 payments of $${(price / 4).toFixed(2)}`,
      icon: 'afterpay',
      color: colors.sandLight,
    });
  }

  const financing = getFinancingInfo(price);
  if (financing.eligible) {
    badges.push({
      type: 'financing',
      label: financing.bestTier.label,
      icon: 'calendar',
      color: colors.sandLight,
    });
  }

  if (price >= 999) {
    badges.push({
      type: 'free-shipping',
      label: 'Free Shipping',
      icon: 'truck',
      color: colors.mountainBlueLight,
    });
  }

  return badges;
}
