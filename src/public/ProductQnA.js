// ProductQnA.js — Product Q&A accordion widget for the PDP
// Queries the 'ProductQnA' CMS collection, renders an accessible accordion,
// supports pagination, and lets customers submit pending questions.
// S10 spec: qna* element nicknames, direct wixData access for reads.

const PAGE_SIZE = 5;
const RATE_LIMIT_MS = 60_000; // one submit per minute per session

// Module-level state (reset via destroy / _resetForTest)
let _lastSubmitAt = 0;
let _submitting = false; // prevents concurrent insert race on double-tap

/**
 * Load the first page of approved Q&A items for a product.
 * @param {string} productId
 * @returns {{ items: object[], hasMore: boolean, error: boolean }}
 */
export async function loadQnA(productId) {
  if (!productId) return { items: [], hasMore: false, error: false };
  try {
    const { items, hasMore } = await _queryQnA(productId, 0);
    return { items, hasMore, error: false };
  } catch (e) {
    console.error('[ProductQnA] loadQnA failed:', e);
    return { items: [], hasMore: false, error: true };
  }
}

/**
 * Render Q&A items into the accordion repeater.
 * Registers onItemReady BEFORE setting .data (Wix requirement).
 * @param {Function} $w - Wix selector function
 * @param {object[]} items
 * @param {boolean} hasMore
 */
export function renderQnA($w, items, hasMore) {
  if (items.length === 0) {
    try { $w('#qnaSection').hide(); } catch (e) {}
    try { $w('#qnaEmpty').show(); } catch (e) {}
    try { $w('#qnaLoadMore').hide(); } catch (e) {}
    return;
  }

  try { $w('#qnaSection').show(); } catch (e) {}
  try { $w('#qnaEmpty').hide(); } catch (e) {}

  // Accordion repeater — onItemReady MUST precede .data assignment
  try {
    const accordion = $w('#qnaAccordion');
    accordion.onItemReady(($item, itemData) => {
      _renderItem($item, itemData);
    });
    accordion.data = items;
  } catch (e) {
    console.error('[ProductQnA] renderQnA repeater failed:', e);
  }

  // Pagination control
  try {
    if (hasMore) {
      $w('#qnaLoadMore').show();
    } else {
      $w('#qnaLoadMore').hide();
    }
  } catch (e) {}
}

/**
 * Append the next page of items to the accordion without re-rendering existing ones.
 * @param {Function} $w
 * @param {string} productId
 * @param {number} currentPage - 1-based index of the last loaded page; must be >= 1
 * @returns {{ appended: number, hasMore: boolean }}
 */
export async function loadMore($w, productId, currentPage) {
  try {
    const skip = currentPage * PAGE_SIZE;
    const { items: newItems, hasMore } = await _queryQnA(productId, skip);

    if (newItems.length > 0) {
      const accordion = $w('#qnaAccordion');
      const existing = accordion.data || [];
      accordion.data = [...existing, ...newItems];
    }

    if (hasMore) {
      try { $w('#qnaLoadMore').show(); } catch (e) {}
    } else {
      try { $w('#qnaLoadMore').hide(); } catch (e) {}
    }

    return { appended: newItems.length, hasMore };
  } catch (e) {
    console.error('[ProductQnA] loadMore failed:', e);
    // Keep the button visible so the user can retry — do not report hasMore:false on error.
    try { $w('#qnaLoadMore').show(); } catch (_) {}
    return { appended: 0, hasMore: true };
  }
}

/**
 * Submit a customer question (pending approval).
 * Applies a client-side rate limit (one per RATE_LIMIT_MS) and a
 * concurrent-call guard so double-tap cannot produce two CMS inserts.
 * @param {Function} $w
 * @param {string} productId
 */
export async function submitQuestion($w, productId) {
  if (!productId) return;

  const input = $w('#qnaQuestionInput');
  const submitBtn = $w('#qnaSubmitBtn');
  const thankYou = $w('#qnaThankYou');

  const questionText = (input.value || '').trim();
  if (!questionText) return;

  // Concurrent-call guard (e.g. double-tap before the first insert resolves)
  if (_submitting) {
    // Defensive re-enable: a previous call may have left the button disabled.
    try { submitBtn.enable(); } catch (e) {}
    return;
  }

  // Client-side rate limit
  if (Date.now() - _lastSubmitAt < RATE_LIMIT_MS) {
    // Defensive re-enable: same as above.
    try { submitBtn.enable(); } catch (e) {}
    return;
  }

  _submitting = true;
  try { submitBtn.disable(); } catch (e) {}

  try {
    const wixData = (await import('wix-data')).default;
    await wixData.insert('ProductQnA', {
      productId,
      question: questionText,
      approved: false,
      createdDate: new Date(),
    });

    _lastSubmitAt = Date.now();
    input.value = '';
    try { thankYou.show(); } catch (e) {}
  } catch (e) {
    console.error('[ProductQnA] submitQuestion failed:', e);
  } finally {
    _submitting = false;
    try { submitBtn.enable(); } catch (e) {}
  }
}

/**
 * Clean up module state for SPA navigation or test teardown.
 */
export function destroy() {
  _lastSubmitAt = 0;
  _submitting = false;
}

// ─── Test-only reset ─────────────────────────────────────────────────────────

export function _resetForTest() {
  destroy();
}

// ─── Private helpers ──────────────────────────────────────────────────────────

/**
 * Query the ProductQnA collection for approved items.
 * Fetches PAGE_SIZE+1 to detect whether more pages exist.
 * @param {string} productId
 * @param {number} skip - number of items to skip (for pagination)
 * @returns {{ items: object[], hasMore: boolean }}
 */
async function _queryQnA(productId, skip) {
  const wixData = (await import('wix-data')).default;
  const query = wixData
    .query('ProductQnA')
    .eq('productId', productId)
    .eq('approved', true)
    .descending('createdDate')
    .limit(PAGE_SIZE + 1);

  const result = await (skip > 0 ? query.skip(skip) : query).find();
  const allItems = result.items || [];
  const hasMore = allItems.length > PAGE_SIZE;
  return { items: hasMore ? allItems.slice(0, PAGE_SIZE) : allItems, hasMore };
}

function _renderItem($item, itemData) {
  const answerId = `qna-answer-${itemData._id || 'unknown'}`;
  let isExpanded = false;

  // Question text + ARIA
  try {
    const qEl = $item('#qnaQuestion');
    qEl.text = itemData.question || '';
    qEl.accessibility.ariaExpanded = false;
    qEl.accessibility.ariaControls = answerId;
    qEl.accessibility.ariaLabel = `Question: ${itemData.question || ''}`;

    // Accordion toggle — flip ariaExpanded only after the DOM call succeeds
    qEl.onClick(() => {
      const next = !isExpanded;
      try {
        if (next) {
          $item('#qnaAnswer').expand();
        } else {
          $item('#qnaAnswer').collapse();
        }
        isExpanded = next;
        qEl.accessibility.ariaExpanded = isExpanded;
      } catch (e) {
        // DOM call failed — do not update ARIA state to avoid mismatch
        console.error('[ProductQnA] accordion toggle failed:', e);
      }
    });
  } catch (e) {
    console.error('[ProductQnA] _renderItem question failed:', e);
  }

  // Answer text + collapsed by default
  try {
    const aEl = $item('#qnaAnswer');
    aEl.text = itemData.answer || '';
    aEl.accessibility = aEl.accessibility || {};
    aEl.accessibility.role = 'region';
    aEl.collapse();
  } catch (e) {
    console.error('[ProductQnA] _renderItem answer failed:', e);
  }
}
