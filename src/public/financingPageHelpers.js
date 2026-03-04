// financingPageHelpers.js — Pure helper functions for the Financing Calculator page.
// Handles input validation, formatting, FAQ data, comparison table building,
// and provider info. Integrates with financingCalc.web.js backend.

/**
 * Quick-select price presets for common furniture price points.
 * @type {Array<{price: number, label: string}>}
 */
export const QUICK_PRICES = [
  { price: 299, label: '$299' },
  { price: 599, label: '$599' },
  { price: 999, label: '$999' },
  { price: 1499, label: '$1,499' },
  { price: 2499, label: '$2,499' },
  { price: 4999, label: '$4,999' },
];

const MAX_PRICE = 25000;

/**
 * Validate and sanitize a price input string or number.
 *
 * @param {string|number|null|undefined} input - Raw price input.
 * @returns {{valid: boolean, price: number|null, error: string|null}}
 */
export function validatePriceInput(input) {
  if (input == null || input === '') {
    return { valid: false, price: null, error: 'Please enter a price' };
  }

  let cleaned = input;
  if (typeof cleaned === 'string') {
    cleaned = cleaned.trim().replace(/^\$/, '').replace(/,/g, '');
  }

  const price = Number(cleaned);

  if (!isFinite(price) || isNaN(price)) {
    return { valid: false, price: null, error: 'Please enter a valid number' };
  }

  if (price <= 0) {
    return { valid: false, price: null, error: 'Price must be greater than $0' };
  }

  if (price > MAX_PRICE) {
    return { valid: false, price: null, error: `Maximum price is $25,000. Call us for orders above $25,000.` };
  }

  return { valid: true, price, error: null };
}

/**
 * Format a number as USD currency string.
 *
 * @param {number} amount - Dollar amount.
 * @returns {string} Formatted string like "$1,500.00".
 */
export function formatCurrency(amount) {
  const rounded = Math.round(amount * 100) / 100;
  const parts = rounded.toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `$${parts.join('.')}`;
}

/**
 * Format a monthly payment for display.
 *
 * @param {number} amount - Monthly payment amount.
 * @returns {string} Formatted string like "$42.50/mo".
 */
export function formatMonthlyPayment(amount) {
  return `${formatCurrency(amount)}/mo`;
}

/**
 * Build comparison table rows from financing terms and Afterpay data.
 *
 * @param {Array} terms - Array of term objects from financingCalc.
 * @param {Object} afterpay - Afterpay breakdown from financingCalc.
 * @returns {Array<{type: string, label: string, payment: string, totalCost: string, interestText: string, isZeroInterest: boolean}>}
 */
export function buildComparisonRows(terms, afterpay) {
  const rows = [];

  if (afterpay && afterpay.eligible) {
    rows.push({
      type: 'afterpay',
      label: 'Pay in 4',
      payment: formatCurrency(afterpay.installmentAmount),
      totalCost: formatCurrency(afterpay.total),
      interestText: '$0 interest',
      isZeroInterest: true,
    });
  }

  for (const term of terms) {
    rows.push({
      type: 'term',
      label: term.label,
      payment: formatCurrency(term.monthly),
      totalCost: formatCurrency(term.total),
      interestText: term.isZeroInterest
        ? '$0 interest'
        : `${formatCurrency(term.interest)} (${term.apr}% APR)`,
      isZeroInterest: term.isZeroInterest,
      months: term.months,
      apr: term.apr,
    });
  }

  return rows;
}

/**
 * Get information about supported BNPL providers.
 *
 * @returns {Array<{name: string, description: string, range: string}>}
 */
export function getProviderInfo() {
  return [
    {
      name: 'Afterpay',
      description: 'Split your purchase into 4 interest-free payments, paid every 2 weeks. No credit impact for checking eligibility.',
      range: '$35 – $1,000',
    },
    {
      name: 'Affirm',
      description: 'Choose 6, 12, 18, or 24 month plans. 0% APR available on select terms. Quick approval with no hidden fees.',
      range: '$200 – $10,000',
    },
    {
      name: 'Klarna',
      description: 'Flexible payment plans with easy monthly installments. Pay over time with transparent terms and no surprises.',
      range: '$200 – $10,000',
    },
  ];
}

/**
 * Get a label describing available financing options for a price level.
 *
 * @param {number} price - Product price.
 * @returns {string}
 */
export function getPriceRangeLabel(price) {
  if (price < 200) {
    return 'Afterpay available on purchases $35+. Financing plans start at $200.';
  }
  if (price < 500) {
    return '6-month 0% APR plan available at this price.';
  }
  if (price < 750) {
    return '6 and 12-month 0% APR plans available at this price.';
  }
  if (price <= 1000) {
    return 'Multiple 0% APR plans plus Afterpay available at this price.';
  }
  return 'Full range of financing plans available at this price.';
}

/**
 * Get financing-specific FAQ content.
 *
 * @returns {Array<{question: string, answer: string, topic: string}>}
 */
export function getFinancingFaqs() {
  return [
    {
      question: 'How does Affirm financing work?',
      answer: 'Affirm lets you split your purchase into monthly payments over 6, 12, 18, or 24 months. Select Affirm at checkout, get approved in seconds, and enjoy your new furniture right away while paying over time. 0% APR is available on select terms.',
      topic: 'affirm',
    },
    {
      question: 'Is there a credit check for financing?',
      answer: 'Affirm performs a soft credit check to determine eligibility, which does not affect your credit score. Afterpay does not require a credit check for its Pay in 4 program.',
      topic: 'credit',
    },
    {
      question: 'What is the minimum purchase for financing?',
      answer: 'Afterpay Pay in 4 is available on purchases from $35 to $1,000. Affirm monthly payment plans are available on purchases $200 and above, up to $10,000.',
      topic: 'eligibility',
    },
    {
      question: 'Are there any hidden fees or interest charges?',
      answer: 'Afterpay Pay in 4 is always interest-free with no fees when you pay on time. Affirm offers 0% APR on 6 and 12-month plans. Longer terms (18 and 24 months) carry a low APR clearly shown before you confirm.',
      topic: 'interest',
    },
    {
      question: 'Can I pay off my plan early?',
      answer: 'Yes! Both Affirm and Afterpay allow early payoff with no prepayment penalties. Paying early can save you on interest charges for plans with APR.',
      topic: 'payment',
    },
    {
      question: 'What happens if I miss a payment?',
      answer: 'Afterpay may charge a late fee and pause your account. Affirm does not charge late fees but may report missed payments. We recommend setting up autopay to stay on track.',
      topic: 'payment',
    },
    {
      question: 'Can I use financing with other promotions?',
      answer: 'Yes, financing can be combined with most Carolina Futons promotions and free shipping offers. Financing applies to the final price after discounts.',
      topic: 'eligibility',
    },
    {
      question: 'How do I apply for financing at checkout?',
      answer: 'Select your preferred payment plan at checkout. For Affirm, you will be redirected to complete a quick application. For Afterpay, log in or create an account. Approval is instant in most cases.',
      topic: 'process',
    },
  ];
}

/**
 * Filter financing FAQs by topic keyword.
 *
 * @param {Array} faqs - Array of FAQ objects.
 * @param {string|null} topic - Topic keyword to filter by.
 * @returns {Array}
 */
export function filterFaqsByTopic(faqs, topic) {
  if (!topic || topic.trim() === '') return faqs;

  const lower = topic.toLowerCase();
  return faqs.filter(faq => {
    const combined = (faq.question + ' ' + faq.answer).toLowerCase();
    return combined.includes(lower);
  });
}
