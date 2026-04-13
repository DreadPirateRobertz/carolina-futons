/**
 * @module BNPLCalculatorWidget
 * @description Interactive BNPL comparison widget — shows all available financing
 * options (in-house terms, Afterpay, Affirm estimate, Klarna estimate) for a given
 * price. Embeddable on any page via initBNPLCalculator / updateBNPLCalculatorPrice.
 *
 * Distinct from BNPLWidget.js (static Affirm/Klarna estimates only) and the full
 * Financing.js standalone page. This widget is compact, reactive, and drives
 * real backend calculations via financingCalc.web.js.
 *
 * Elements:
 *   #bnplCalcContainer  — Wrapper box; hidden when price is ineligible
 *   #bnplCalcLowest     — Text: "As low as $XX/mo" headline
 *   #bnplCalcRepeater   — Repeater: one row per provider/term
 *     ↳ #providerName   — Text: provider name (e.g. "In-house 12 mo")
 *     ↳ #providerAmount — Text: payment amount (e.g. "$42/mo" or "4 × $125")
 *     ↳ #providerNote   — Text: qualifier (e.g. "0% APR" or "pay-in-4")
 *   #bnplCalcDetails    — Box: expanded breakdown (collapse by default)
 *   #bnplCalcToggle     — Button: "See all options" / "Hide options"
 *
 * CF-zpf
 */

// ── safeGet ────────────────────────────────────────────────────────────────────

/**
 * Safely retrieve a Wix element, returning null on any error.
 * Suppresses "not found" and "Cannot read" errors (expected in partial renders);
 * warns on anything else.
 *
 * @param {function} $wFn - Wix element selector function
 * @param {string} sel - Element selector (e.g. '#bnplCalcContainer')
 * @returns {object|null}
 */
function safeGet($wFn, sel) {
  try {
    return $wFn(sel) || null;
  } catch (err) {
    const msg = err?.message ?? '';
    if (!msg.includes('not found') && !msg.includes('Cannot read'))
      console.warn('[BNPLCalculatorWidget] safeGet unexpected error:', sel, msg);
    return null;
  }
}

// ── Pure formatting helpers ────────────────────────────────────────────────────

/**
 * Format a dollar amount — whole dollars omit cents, others show 2dp.
 * @param {number} amount
 * @returns {string}
 */
export function formatDollar(amount) {
  if (!Number.isFinite(amount) || amount < 0) return '';
  return amount % 1 === 0 ? `$${amount}` : `$${amount.toFixed(2)}`;
}

/**
 * Build a display row for a financing provider/term.
 * @param {string} name
 * @param {string} amount
 * @param {string} note
 * @returns {{ _id: string, name: string, amount: string, note: string }}
 */
function makeRow(name, amount, note) {
  return { _id: name.replace(/\s+/g, '-').toLowerCase(), name, amount, note };
}

/**
 * Build the list of comparison rows from a getFinancingWidget result.
 * Returns [] when the price is ineligible (no options available).
 *
 * @param {number} price
 * @param {{ success: boolean, terms: Array, afterpay: Object, eligible: boolean }} financingResult
 * @returns {Array<{ _id: string, name: string, amount: string, note: string }>}
 */
export function buildComparisonRows(price, financingResult) {
  if (!financingResult?.success || !financingResult.eligible) return [];

  const rows = [];

  // In-house term plans (backend-calculated, real APR)
  for (const term of financingResult.terms ?? []) {
    const monthlyStr = formatDollar(term.monthly);
    if (!monthlyStr) continue;
    const note = term.apr === 0 ? '0% APR' : `${term.apr}% APR`;
    rows.push(makeRow(`In-house ${term.months} mo`, `${monthlyStr}/mo`, note));
  }

  // Afterpay (real eligibility from backend)
  const ap = financingResult.afterpay;
  if (ap?.eligible && ap.installmentAmount > 0) {
    const amtStr = formatDollar(ap.installmentAmount);
    rows.push(makeRow('Afterpay', `4 × ${amtStr}`, 'pay-in-4, 0% interest'));
  }

  // Affirm estimate (price / 12 — promotional 0% APR estimate)
  // Affirm's minimum order value for their 0% promotional offer is $50.
  // Source: Affirm merchant eligibility guidelines (affirm.com/merchants).
  if (price >= 50) {
    const affirm = Math.round((price / 12) * 100) / 100;
    rows.push(makeRow('Affirm (est.)', `${formatDollar(affirm)}/mo`, '12 mo, est. 0% APR'));
  }

  // Klarna pay-in-4 estimate (capped at $1,000)
  // Klarna pay-in-4 eligibility: $35 minimum, $1,000 maximum per Klarna's US merchant rules.
  // Source: Klarna merchant documentation (docs.klarna.com/payments).
  if (price >= 35 && price <= 1000) {
    const klarna = Math.round((price / 4) * 100) / 100;
    rows.push(makeRow('Klarna', `4 × ${formatDollar(klarna)}`, 'pay-in-4, 0% interest'));
  }

  return rows;
}

// ── DOM rendering ──────────────────────────────────────────────────────────────

/**
 * Populate the BNPL repeater with comparison rows.
 * No-ops if the repeater element is missing from the page.
 *
 * @param {function} $w - Wix element selector function
 * @param {Array<{ _id: string, name: string, amount: string, note: string }>} rows
 * @returns {void}
 */
function renderRows($w, rows) {
  const repeater = safeGet($w, '#bnplCalcRepeater');
  if (!repeater) return;

  repeater.onItemReady(($item, itemData) => {
    try { $item('#providerName').text = itemData.name; } catch (e) { console.error('[BNPLCalculatorWidget] renderRows: #providerName:', e.message); }
    try { $item('#providerAmount').text = itemData.amount; } catch (e) { console.error('[BNPLCalculatorWidget] renderRows: #providerAmount:', e.message); }
    try { $item('#providerNote').text = itemData.note; } catch (e) { console.error('[BNPLCalculatorWidget] renderRows: #providerNote:', e.message); }
  });

  repeater.data = rows;
}

/**
 * Set the "As low as $XX/mo" headline text.
 * No-ops if the element is missing from the page.
 *
 * @param {function} $w - Wix element selector function
 * @param {string} lowestText - Headline string (e.g. "As low as $42/mo")
 * @returns {void}
 */
function renderLowest($w, lowestText) {
  const el = safeGet($w, '#bnplCalcLowest');
  if (!el) return;
  try { el.text = lowestText || ''; } catch (e) { console.error('[BNPLCalculatorWidget] renderLowest: #bnplCalcLowest:', e.message); }
}

/**
 * Wire up the "See all options" / "Hide options" toggle button.
 * Initialises details panel collapsed. No-ops if either element is missing.
 *
 * @param {function} $w - Wix element selector function
 * @returns {void}
 */
function initToggle($w) {
  const btn = safeGet($w, '#bnplCalcToggle');
  const details = safeGet($w, '#bnplCalcDetails');
  if (!btn || !details) return;

  try { details.collapse(); } catch (e) { console.error('[BNPLCalculatorWidget] initToggle: details.collapse:', e.message); }
  try { btn.label = 'See all options'; } catch (e) { console.error('[BNPLCalculatorWidget] initToggle: btn.label init:', e.message); }

  btn.onClick(() => {
    try {
      if (details.collapsed) {
        details.expand();
        try { btn.label = 'Hide options'; } catch (e) { console.error('[BNPLCalculatorWidget] initToggle: btn.label expand:', e.message); }
      } else {
        details.collapse();
        try { btn.label = 'See all options'; } catch (e) { console.error('[BNPLCalculatorWidget] initToggle: btn.label collapse:', e.message); }
      }
    } catch (e) { console.error('[BNPLCalculatorWidget] initToggle: onClick:', e.message); }
  });
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Initialise the BNPL calculator widget for a given price.
 * Fetches real financing data from the backend and renders all available options.
 * Hides the container when no options are available.
 *
 * @param {function} $w - Wix element selector
 * @param {number} price - Product or cart price
 */
export async function initBNPLCalculator($w, price) {
  const container = safeGet($w, '#bnplCalcContainer');

  const p = parseFloat(price);
  if (!Number.isFinite(p) || p <= 0) {
    try { container?.hide(); } catch (e) { console.error('[BNPLCalculatorWidget] initBNPLCalculator: hide (invalid price):', e.message); }
    return;
  }

  try {
    const { getFinancingWidget } = await import('backend/financingCalc.web');
    const result = await getFinancingWidget(p);

    const rows = buildComparisonRows(p, result);

    if (rows.length === 0) {
      try { container?.hide(); } catch (e) { console.error('[BNPLCalculatorWidget] initBNPLCalculator: hide (no rows):', e.message); }
      return;
    }

    renderLowest($w, result.lowestMonthly);
    renderRows($w, rows);
    initToggle($w);
    try { container?.show(); } catch (e) { console.error('[BNPLCalculatorWidget] initBNPLCalculator: show:', e.message); }
  } catch (err) {
    console.warn('[BNPLCalculatorWidget] initBNPLCalculator error:', err?.message);
    try { container?.hide(); } catch (e) {}
  }
}

/**
 * Update the widget when the product price changes (e.g. variant selection).
 * Re-fetches backend data and re-renders. Hides the widget if the new price
 * is ineligible.
 *
 * @param {function} $w - Wix element selector
 * @param {number} price - New price
 */
export async function updateBNPLCalculatorPrice($w, price) {
  await initBNPLCalculator($w, price);
}
