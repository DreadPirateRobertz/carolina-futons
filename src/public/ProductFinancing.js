// ProductFinancing.js - BNPL financing options display
// Shows available payment plans on product pages with a modal breakdown.
// Integrates with financingService.web.js backend.

/**
 * Initialize the financing section on a product page.
 * Shows "As low as $XX/mo" teaser and expandable plan list.
 *
 * @param {Function} $w - Wix selector function.
 * @param {Object} state - Product page state with state.product.
 */
export async function initFinancingOptions($w, state) {
  try {
    const section = $w('#financingSection');
    if (!section) return;

    const price = state.product?.price;
    if (!price || price <= 0) { section.collapse(); return; }

    const { getFinancingOptions, getLowestMonthlyDisplay } = await import('backend/financingService.web');

    const [plans, teaser] = await Promise.all([
      getFinancingOptions(price),
      getLowestMonthlyDisplay(price),
    ]);

    if (!plans || plans.length === 0) { section.collapse(); return; }

    section.expand();

    // Teaser line: "As low as $XX/mo"
    renderTeaser($w, teaser);

    // Plan repeater
    renderPlans($w, plans);

    // Modal toggle
    initFinancingModal($w, plans);
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

    const { getFinancingOptions, getLowestMonthlyDisplay } = await import('backend/financingService.web');

    const [plans, teaser] = await Promise.all([
      getFinancingOptions(price),
      getLowestMonthlyDisplay(price),
    ]);

    if (!plans || plans.length === 0) { section.collapse(); return; }

    section.expand();
    renderTeaser($w, teaser);
    renderPlans($w, plans);
  } catch (e) {
    try { $w('#financingSection').collapse(); } catch (e2) {}
  }
}

// ── Teaser ─────────────────────────────────────────────────────────────

function renderTeaser($w, teaser) {
  try {
    const el = $w('#financingTeaser');
    if (el && teaser) {
      el.text = teaser;
      el.show();
    } else if (el) {
      el.hide();
    }
  } catch (e) {}
}

// ── Plan Repeater ──────────────────────────────────────────────────────

function renderPlans($w, plans) {
  try {
    const repeater = $w('#financingRepeater');
    if (!repeater) return;

    repeater.onItemReady(($item, itemData) => {
      try { $item('#planLabel').text = itemData.label; } catch (e) {}
      try { $item('#planMonthly').text = `$${itemData.monthly}/mo`; } catch (e) {}
      try { $item('#planDescription').text = itemData.description; } catch (e) {}

      // Show interest info for non-zero APR plans
      try {
        const interestEl = $item('#planInterest');
        if (interestEl) {
          if (itemData.apr > 0) {
            interestEl.text = `$${itemData.total} total (${itemData.apr}% APR)`;
            interestEl.show();
          } else {
            interestEl.text = 'No interest';
            interestEl.show();
          }
        }
      } catch (e) {}
    });

    repeater.data = plans.map((p, i) => ({ ...p, _id: `plan-${i}` }));
  } catch (e) {}
}

// ── Financing Modal ────────────────────────────────────────────────────

function initFinancingModal($w, plans) {
  try {
    const learnMore = $w('#financingLearnMore');
    if (!learnMore) return;

    try { learnMore.accessibility.ariaLabel = 'Learn more about financing options'; } catch (e) {}

    learnMore.onClick(() => openFinancingModal($w, plans));
  } catch (e) {}

  // Close handlers
  try {
    const closeBtn = $w('#financingClose');
    if (closeBtn) {
      try { closeBtn.accessibility.ariaLabel = 'Close financing details'; } catch (e) {}
      closeBtn.onClick(() => closeFinancingModal($w));
    }
  } catch (e) {}

  try {
    const overlay = $w('#financingOverlay');
    if (overlay) overlay.onClick(() => closeFinancingModal($w));
  } catch (e) {}
}

function openFinancingModal($w, plans) {
  try {
    // Populate modal details repeater
    const detailRepeater = $w('#financingDetailRepeater');
    if (detailRepeater) {
      detailRepeater.onItemReady(($item, itemData) => {
        try { $item('#detailLabel').text = itemData.label; } catch (e) {}
        try { $item('#detailTerm').text = `${itemData.term} payments`; } catch (e) {}
        try { $item('#detailMonthly').text = `$${itemData.monthly}/mo`; } catch (e) {}
        try { $item('#detailTotal').text = `Total: $${itemData.total}`; } catch (e) {}
        try {
          const aprEl = $item('#detailApr');
          if (aprEl) {
            aprEl.text = itemData.apr > 0 ? `${itemData.apr}% APR` : '0% APR';
          }
        } catch (e) {}
        try {
          const interestEl = $item('#detailInterest');
          if (interestEl) {
            interestEl.text = itemData.interest > 0 ? `Interest: $${itemData.interest}` : 'No interest charges';
          }
        } catch (e) {}
      });

      detailRepeater.data = plans.map((p, i) => ({ ...p, _id: `detail-${i}` }));
    }

    $w('#financingOverlay').show('fade', { duration: 200 });
    $w('#financingModal').show('fade', { duration: 200 });
  } catch (e) {}
}

function closeFinancingModal($w) {
  try { $w('#financingModal').hide('fade', { duration: 200 }); } catch (e) {}
  try { $w('#financingOverlay').hide('fade', { duration: 200 }); } catch (e) {}
}
