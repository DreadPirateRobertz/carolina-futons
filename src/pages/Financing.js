// Financing.js — Financing Calculator Page
// Interactive BNPL calculator for Affirm/Klarna/Afterpay payment plans.
// Customers enter a price or use quick-select presets to see all available
// financing options with monthly breakdowns and comparison table.
import { trackEvent } from 'public/engagementTracker';
import { initBackToTop } from 'public/mobileHelpers';
import { announce, makeClickable } from 'public/a11yHelpers';
import {
  validatePriceInput,
  formatCurrency,
  formatMonthlyPayment,
  getFinancingFaqs,
  filterFaqsByTopic,
  buildComparisonRows,
  getProviderInfo,
  getPriceRangeLabel,
  QUICK_PRICES,
} from 'public/financingPageHelpers.js';
import { initPageSeo } from 'public/pageSeo.js';

let currentPrice = null;

$w.onReady(function () {
  initBackToTop($w);
  initPageSeo('financing');
  initPriceInput();
  initQuickPrices();
  initProviderInfo();
  initFinancingFaqs();
  initCtaButtons();
  trackEvent('page_view', { page: 'financing' });
});

// ── Price Input & Calculator ────────────────────────────────────────

function initPriceInput() {
  try {
    const input = $w('#priceInput');
    const calcBtn = $w('#calculateBtn');
    const errorText = $w('#priceError');
    if (!input) return;

    try { input.placeholder = 'Enter product price (e.g. $799)'; } catch (e) {}
    try { input.accessibility.ariaLabel = 'Enter a price to calculate financing options'; } catch (e) {}

    if (errorText) {
      try { errorText.hide(); } catch (e) {}
    }

    // Hide results initially
    try { $w('#resultsSection').collapse(); } catch (e) {}

    if (calcBtn) {
      calcBtn.onClick(() => handleCalculate());
      try { calcBtn.accessibility.ariaLabel = 'Calculate financing options'; } catch (e) {}
    }

    // Allow Enter key to trigger calculation
    try {
      input.onKeyPress((event) => {
        if (event.key === 'Enter') handleCalculate();
      });
    } catch (e) {}
  } catch (e) {}
}

async function handleCalculate() {
  try {
    const input = $w('#priceInput');
    const errorText = $w('#priceError');
    if (!input) return;

    const rawValue = input.value;
    const validation = validatePriceInput(rawValue);

    if (!validation.valid) {
      showError(errorText, validation.error);
      try { $w('#resultsSection').collapse(); } catch (e) {}
      announce($w, validation.error);
      return;
    }

    hideError(errorText);
    currentPrice = validation.price;

    await loadFinancingResults(validation.price);

    trackEvent('financing_calculate', { price: validation.price });
    announce($w, `Showing financing options for ${formatCurrency(validation.price)}`);
  } catch (e) {
    try { $w('#resultsSection').collapse(); } catch (e2) {}
  }
}

function showError(errorEl, message) {
  if (!errorEl) return;
  try {
    errorEl.text = message;
    errorEl.show();
  } catch (e) {}
}

function hideError(errorEl) {
  if (!errorEl) return;
  try { errorEl.hide(); } catch (e) {}
}

// ── Quick Price Buttons ─────────────────────────────────────────────

function initQuickPrices() {
  try {
    const repeater = $w('#quickPriceRepeater');
    if (!repeater) return;

    try { repeater.accessibility.ariaLabel = 'Quick price selection'; } catch (e) {}

    repeater.onItemReady(($item, itemData) => {
      try { $item('#quickPriceLabel').text = itemData.label; } catch (e) {}

      makeClickable($item('#quickPriceBtn'), () => {
        try { $w('#priceInput').value = String(itemData.price); } catch (e) {}
        currentPrice = itemData.price;
        loadFinancingResults(itemData.price);
        trackEvent('financing_quick_price', { price: itemData.price });
        announce($w, `Selected ${itemData.label}`);
      }, { ariaLabel: `Calculate financing for ${itemData.label}` });
    });

    repeater.data = QUICK_PRICES.map((qp, i) => ({ ...qp, _id: `qp-${i}` }));
  } catch (e) {}
}

// ── Load & Display Results ──────────────────────────────────────────

async function loadFinancingResults(price) {
  try {
    // Show loading state
    try { $w('#loadingIndicator').show(); } catch (e) {}
    try { $w('#resultsSection').expand(); } catch (e) {}

    const { getFinancingWidget } = await import('backend/financingCalc.web');
    const result = await getFinancingWidget(price);

    try { $w('#loadingIndicator').hide(); } catch (e) {}

    if (!result || !result.success) {
      showNoResults(price);
      return;
    }

    // Price range label
    try {
      const rangeLabel = $w('#priceRangeLabel');
      if (rangeLabel) {
        rangeLabel.text = getPriceRangeLabel(price);
        rangeLabel.show();
      }
    } catch (e) {}

    // Result header
    try {
      const header = $w('#resultHeader');
      if (header) {
        header.text = `Financing options for ${formatCurrency(price)}`;
      }
    } catch (e) {}

    // Lowest monthly highlight
    try {
      const highlight = $w('#lowestMonthly');
      if (highlight && result.lowestMonthly) {
        highlight.text = result.lowestMonthly;
        highlight.show();
      } else if (highlight) {
        highlight.hide();
      }
    } catch (e) {}

    // Comparison table
    renderComparisonTable(result.terms, result.afterpay);

    // Afterpay schedule
    renderAfterpaySchedule(result.afterpay);

    // Below minimum messaging
    if (!result.eligible) {
      showNoResults(price);
    }
  } catch (e) {
    try { $w('#loadingIndicator').hide(); } catch (e2) {}
    try { $w('#resultsSection').collapse(); } catch (e2) {}
  }
}

function showNoResults(price) {
  try {
    const noResults = $w('#noResultsMessage');
    if (noResults) {
      noResults.text = price < 200
        ? 'Financing plans start at $200. Afterpay Pay in 4 is available on purchases $35–$1,000.'
        : 'No financing plans available for this amount. Please contact us for custom options.';
      noResults.show();
    }
  } catch (e) {}

  try { $w('#comparisonRepeater').collapse(); } catch (e) {}
  try { $w('#afterpaySection').collapse(); } catch (e) {}
}

// ── Comparison Table ────────────────────────────────────────────────

function renderComparisonTable(terms, afterpay) {
  try {
    const repeater = $w('#comparisonRepeater');
    if (!repeater) return;

    const rows = buildComparisonRows(terms || [], afterpay || { eligible: false });

    if (rows.length === 0) {
      repeater.collapse();
      return;
    }

    try { repeater.accessibility.ariaLabel = 'Financing plan comparison'; } catch (e) {}

    repeater.onItemReady(($item, itemData) => {
      try { $item('#compLabel').text = itemData.label; } catch (e) {}
      try { $item('#compPayment').text = itemData.payment; } catch (e) {}
      try { $item('#compTotal').text = itemData.totalCost; } catch (e) {}
      try { $item('#compInterest').text = itemData.interestText; } catch (e) {}

      // Highlight zero-interest rows
      try {
        const badge = $item('#zeroBadge');
        if (badge) {
          if (itemData.isZeroInterest) {
            badge.text = '0% APR';
            badge.show();
          } else {
            badge.hide();
          }
        }
      } catch (e) {}
    });

    repeater.data = rows.map((r, i) => ({ ...r, _id: `comp-${i}` }));
    repeater.expand();
  } catch (e) {}
}

// ── Afterpay Schedule ───────────────────────────────────────────────

function renderAfterpaySchedule(afterpay) {
  try {
    const section = $w('#afterpaySection');
    if (!section) return;

    if (!afterpay || !afterpay.eligible) {
      section.collapse();
      return;
    }

    section.expand();

    try {
      const message = $w('#afterpayMessage');
      if (message) message.text = afterpay.message;
    } catch (e) {}

    // Schedule repeater
    try {
      const scheduleRepeater = $w('#afterpayScheduleRepeater');
      if (scheduleRepeater && afterpay.schedule) {
        scheduleRepeater.onItemReady(($item, itemData) => {
          try { $item('#scheduleLabel').text = itemData.label; } catch (e) {}
          try { $item('#scheduleAmount').text = formatCurrency(itemData.amount); } catch (e) {}
          try { $item('#schedulePayment').text = `Payment ${itemData.payment}`; } catch (e) {}
        });

        scheduleRepeater.data = afterpay.schedule.map((s, i) => ({ ...s, _id: `sched-${i}` }));
      }
    } catch (e) {}
  } catch (e) {}
}

// ── Provider Info ───────────────────────────────────────────────────

function initProviderInfo() {
  try {
    const repeater = $w('#providerRepeater');
    if (!repeater) return;

    const providers = getProviderInfo();

    try { repeater.accessibility.ariaLabel = 'Payment providers'; } catch (e) {}

    repeater.onItemReady(($item, itemData) => {
      try { $item('#providerName').text = itemData.name; } catch (e) {}
      try { $item('#providerDesc').text = itemData.description; } catch (e) {}
      try { $item('#providerRange').text = itemData.range; } catch (e) {}
    });

    repeater.data = providers.map((p, i) => ({ ...p, _id: `prov-${i}` }));
  } catch (e) {}
}

// ── Financing FAQs ──────────────────────────────────────────────────

function initFinancingFaqs() {
  try {
    const repeater = $w('#financingFaqRepeater');
    if (!repeater) return;

    const faqs = getFinancingFaqs();

    try { repeater.accessibility.ariaLabel = 'Financing frequently asked questions'; } catch (e) {}

    repeater.onItemReady(($item, itemData) => {
      try { $item('#faqQuestion').text = itemData.question; } catch (e) {}
      try { $item('#faqAnswer').text = itemData.answer; } catch (e) {}

      // Accordion collapse
      try { $item('#faqAnswer').collapse(); } catch (e) {}
      try { $item('#faqChevron').text = '+'; } catch (e) {}

      const toggle = () => {
        try {
          const answer = $item('#faqAnswer');
          const chevron = $item('#faqChevron');
          if (answer.collapsed) {
            answer.expand();
            try { chevron.text = '−'; } catch (e) {}
            trackEvent('financing_faq_expand', { question: itemData.question });
          } else {
            answer.collapse();
            try { chevron.text = '+'; } catch (e) {}
          }
        } catch (e) {}
      };

      makeClickable($item('#faqQuestion'), toggle, {
        ariaLabel: `Toggle answer: ${itemData.question}`,
      });
    });

    repeater.data = faqs.map((f, i) => ({ ...f, _id: `faq-${i}` }));
  } catch (e) {}
}

// ── CTA Buttons ─────────────────────────────────────────────────────

function initCtaButtons() {
  try {
    const shopBtn = $w('#shopNowBtn');
    if (shopBtn) {
      shopBtn.onClick(() => {
        trackEvent('financing_cta_shop', { price: currentPrice });
        try { $w('#shopNowBtn').link = '/shop'; } catch (e) {}
      });
    }
  } catch (e) {}

  try {
    const contactBtn = $w('#financingContactBtn');
    if (contactBtn) {
      contactBtn.onClick(() => {
        trackEvent('financing_cta_contact', { price: currentPrice });
        try { $w('#financingContactBtn').link = '/contact'; } catch (e) {}
      });
    }
  } catch (e) {}
}
