// ProductFinancing.js - BNPL financing options display
// Shows available payment plans and Afterpay on product pages with a modal breakdown.
// Integrates with financingCalc.web.js backend.

import { makeClickable, setupAccessibleDialog, announce } from 'public/a11yHelpers';
import { isCallForPrice } from 'public/productPageUtils.js';

/**
 * Initialize the financing section on a product page.
 * Shows "As low as $XX/mo" teaser, Afterpay message, and expandable plan list.
 *
 * @param {Function} $w - Wix selector function.
 * @param {Object} state - Product page state with state.product.
 */
export async function initFinancingOptions($w, state) {
  try {
    const section = $w('#financingSection');
    if (!section) return;

    const price = state.product?.price;
    if (!price || price <= 0 || isCallForPrice(state.product)) { section.collapse(); return; }

    const { getFinancingWidget } = await import('backend/financingCalc.web');
    const result = await getFinancingWidget(price);

    if (!result.success || !result.eligible) { section.collapse(); return; }

    section.expand();

    renderTeaser($w, result.lowestMonthly);
    renderAfterpayMessage($w, result.afterpay);
    renderPlans($w, result.widgetData.sections);
    initFinancingModal($w, result.widgetData.sections);
  } catch (e) {
    try { $w('#financingSection').collapse(); } catch (e2) {}
  }
}

/**
 * Update financing display when variant/price changes.
 *
 * @param {Function} $w - Wix selector function.
 * @param {number} price - New price to calculate financing for.
 */
export async function updateFinancingPrice($w, price) {
  try {
    const section = $w('#financingSection');
    if (!section) return;

    if (!price || price <= 0) { section.collapse(); return; }

    const { getFinancingWidget } = await import('backend/financingCalc.web');
    const result = await getFinancingWidget(price);

    if (!result.success || !result.eligible) { section.collapse(); return; }

    section.expand();
    renderTeaser($w, result.lowestMonthly);
    renderAfterpayMessage($w, result.afterpay);
    renderPlans($w, result.widgetData.sections);
  } catch (e) {
    try { $w('#financingSection').collapse(); } catch (e2) {}
  }
}

// ── Teaser ─────────────────────────────────────────────────────────────

function renderTeaser($w, lowestMonthly) {
  try {
    const el = $w('#financingTeaser');
    if (el && lowestMonthly) {
      el.text = lowestMonthly;
      el.show();
    } else if (el) {
      el.hide();
    }
  } catch (e) {}
}

// ── Afterpay Message ──────────────────────────────────────────────────

function renderAfterpayMessage($w, afterpay) {
  try {
    const el = $w('#afterpayMessage');
    if (!el) return;

    if (afterpay && afterpay.eligible && afterpay.message) {
      el.text = afterpay.message;
      el.show();
    } else {
      el.hide();
    }
  } catch (e) {}
}

// ── Plan Repeater ──────────────────────────────────────────────────────

function renderPlans($w, sections) {
  try {
    const repeater = $w('#financingRepeater');
    if (!repeater) return;

    repeater.onItemReady(($item, itemData) => {
      try { $item('#planLabel').text = itemData.title; } catch (e) {}
      try { $item('#planMonthly').text = itemData.highlight; } catch (e) {}
      try { $item('#planDescription').text = itemData.subtitle; } catch (e) {}

      try {
        const interestEl = $item('#planInterest');
        if (interestEl) {
          if (itemData.type === 'afterpay') {
            interestEl.text = 'No interest';
            interestEl.show();
          } else if (itemData.details && itemData.details.apr > 0) {
            interestEl.text = `$${itemData.details.total} total (${itemData.details.apr}% APR)`;
            interestEl.show();
          } else {
            interestEl.text = 'No interest';
            interestEl.show();
          }
        }
      } catch (e) {}
    });

    repeater.data = sections.map((s, i) => ({ ...s, _id: `plan-${i}` }));
  } catch (e) {}
}

// ── Financing Modal ────────────────────────────────────────────────────

function initFinancingModal($w, sections) {
  try {
    const learnMore = $w('#financingLearnMore');
    if (!learnMore) return;

    try { $w('#financingClose').accessibility.ariaLabel = 'Close financing details'; } catch (e) {}

    const dialog = setupAccessibleDialog($w, {
      panelId: '#financingModal',
      closeId: '#financingClose',
      titleId: '#financingModalTitle',
      focusableIds: ['#financingClose', '#financingDetailRepeater'],
      onClose: () => {
        try { $w('#financingOverlay').hide('fade', { duration: 200 }); } catch (e) {}
        try { learnMore.focus(); } catch (e) {}
      },
    });

    makeClickable(learnMore, () => openFinancingModal($w, sections, dialog), { ariaLabel: 'Learn more about financing options' });
  } catch (e) {}

  try {
    const overlay = $w('#financingOverlay');
    if (overlay) overlay.onClick(() => closeFinancingModal($w));
  } catch (e) {}
}

function openFinancingModal($w, sections, dialog) {
  try {
    const detailRepeater = $w('#financingDetailRepeater');
    if (detailRepeater) {
      detailRepeater.onItemReady(($item, itemData) => {
        try { $item('#detailLabel').text = itemData.title; } catch (e) {}
        try { $item('#detailMonthly').text = itemData.highlight; } catch (e) {}

        try {
          const aprEl = $item('#detailApr');
          if (aprEl) {
            if (itemData.type === 'afterpay') {
              aprEl.text = '0% APR';
            } else if (itemData.details && itemData.details.apr > 0) {
              aprEl.text = `${itemData.details.apr}% APR`;
            } else {
              aprEl.text = '0% APR';
            }
          }
        } catch (e) {}

        try {
          const interestEl = $item('#detailInterest');
          if (interestEl) {
            if (itemData.type === 'afterpay' || !itemData.details || itemData.details.interest <= 0) {
              interestEl.text = 'No interest charges';
            } else {
              interestEl.text = `Interest: $${itemData.details.interest}`;
            }
          }
        } catch (e) {}
      });

      detailRepeater.data = sections.map((s, i) => ({ ...s, _id: `detail-${i}` }));
    }

    $w('#financingOverlay').show('fade', { duration: 200 });
    $w('#financingModal').show('fade', { duration: 200 });
    announce($w, 'Financing details opened');
    try { $w('#financingClose').focus(); } catch (e) {}
  } catch (e) {}
}

function closeFinancingModal($w) {
  try { $w('#financingModal').hide('fade', { duration: 200 }); } catch (e) {}
  try { $w('#financingOverlay').hide('fade', { duration: 200 }); } catch (e) {}
  announce($w, 'Financing details closed');
  try { $w('#financingLearnMore').focus(); } catch (e) {}
}
