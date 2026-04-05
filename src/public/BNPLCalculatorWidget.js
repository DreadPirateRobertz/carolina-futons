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
  if (price >= 50) {
    const affirm = Math.round((price / 12) * 100) / 100;
    rows.push(makeRow('Affirm (est.)', `${formatDollar(affirm)}/mo`, '12 mo, est. 0% APR'));
  }

  // Klarna pay-in-4 estimate (capped at $1,000)
  if (price >= 35 && price <= 1000) {
    const klarna = Math.round((price / 4) * 100) / 100;
    rows.push(makeRow('Klarna', `4 × ${formatDollar(klarna)}`, 'pay-in-4, 0% interest'));
  }

  return rows;
}

// ── DOM rendering ──────────────────────────────────────────────────────────────

function renderRows($w, rows) {
  const repeater = safeGet($w, '#bnplCalcRepeater');
  if (!repeater) return;

  repeater.onItemReady(($item, itemData) => {
    try { $item('#providerName').text = itemData.name; } catch (e) {}
    try { $item('#providerAmount').text = itemData.amount; } catch (e) {}
    try { $item('#providerNote').text = itemData.note; } catch (e) {}
  });

  repeater.data = rows;
}

function renderLowest($w, lowestText) {
  const el = safeGet($w, '#bnplCalcLowest');
  if (!el) return;
  try { el.text = lowestText || ''; } catch (e) {}
}

function initToggle($w) {
  const btn = safeGet($w, '#bnplCalcToggle');
  const details = safeGet($w, '#bnplCalcDetails');
  if (!btn || !details) return;

  try { details.collapse(); } catch (e) {}
  try { btn.label = 'See all options'; } catch (e) {}

  btn.onClick(() => {
    try {
      if (details.collapsed) {
        details.expand();
        try { btn.label = 'Hide options'; } catch (e) {}
      } else {
        details.collapse();
        try { btn.label = 'See all options'; } catch (e) {}
      }
    } catch (e) {}
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
    try { container?.hide(); } catch (e) {}
    return;
  }

  try {
    const { getFinancingWidget } = await import('backend/financingCalc.web');
    const result = await getFinancingWidget(p);

    const rows = buildComparisonRows(p, result);

    if (rows.length === 0) {
      try { container?.hide(); } catch (e) {}
      return;
    }

    renderLowest($w, result.lowestMonthly);
    renderRows($w, rows);
    initToggle($w);
    try { container?.show(); } catch (e) {}
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
