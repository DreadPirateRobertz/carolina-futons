// ProductQnA.js — Product Q&A accordion widget for the PDP
// Queries the 'ProductQnA' CMS collection, renders an accessible accordion,
// supports pagination, and lets customers submit pending questions.
// S10 spec: qna* element nicknames, direct wixData access for reads.

const PAGE_SIZE = 5;
const RATE_LIMIT_MS = 60_000; // one submit per minute per session

// Module-level state (reset via _resetForTest / destroy)
let _lastSubmitAt = 0;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Load the first page of approved Q&A items for a product.
 * @param {string} productId
 * @returns {{ items: object[], hasMore: boolean, error: boolean }}
 */
export async function loadQnA(productId) {
  try {
    const wixData = (await import('wix-data')).default;
    const result = await wixData
      .query('ProductQnA')
      .eq('productId', productId)
      .eq('approved', true)
      .descending('createdDate')
      .limit(PAGE_SIZE + 1) // fetch one extra to detect hasMore
      .find();

    const allItems = result.items || [];
    const hasMore = allItems.length > PAGE_SIZE;
    const items = hasMore ? allItems.slice(0, PAGE_SIZE) : allItems;

    return { items, hasMore, error: false };
  } catch (e) {
    console.error('[ProductQnA] loadQnA failed:', e.message);
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
    console.error('[ProductQnA] renderQnA repeater failed:', e.message);
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
 * @param {number} currentPage - 1-based page that was last loaded
 * @returns {{ appended: number, hasMore: boolean }}
 */
export async function loadMore($w, productId, currentPage) {
  try {
    const wixData = (await import('wix-data')).default;
    const skip = currentPage * PAGE_SIZE;
    const result = await wixData
      .query('ProductQnA')
      .eq('productId', productId)
      .eq('approved', true)
      .descending('createdDate')
      .limit(PAGE_SIZE + 1)
      .skip(skip)
      .find();

    const allItems = result.items || [];
    const hasMore = allItems.length > PAGE_SIZE;
    const newItems = hasMore ? allItems.slice(0, PAGE_SIZE) : allItems;

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
    console.error('[ProductQnA] loadMore failed:', e.message);
    return { appended: 0, hasMore: false };
  }
}

/**
 * Submit a customer question (pending approval).
 * Applies a client-side rate limit (one per RATE_LIMIT_MS).
 * @param {Function} $w
 * @param {string} productId
 */
export async function submitQuestion($w, productId) {
  const input = $w('#qnaQuestionInput');
  const submitBtn = $w('#qnaSubmitBtn');
  const thankYou = $w('#qnaThankYou');

  const questionText = (input.value || '').trim();
  if (!questionText) return;

  // Client-side rate limit
  const now = Date.now();
  if (now - _lastSubmitAt < RATE_LIMIT_MS) {
    try { submitBtn.enable(); } catch (e) {}
    return;
  }

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
    console.error('[ProductQnA] submitQuestion failed:', e.message);
  }

  try { submitBtn.enable(); } catch (e) {}
}

/**
 * Clean up module state for SPA navigation or test teardown.
 */
export function destroy() {
  _lastSubmitAt = 0;
}

// ─── Test-only reset ─────────────────────────────────────────────────────────

export function _resetForTest() {
  _lastSubmitAt = 0;
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function _renderItem($item, itemData) {
  const answerId = `qna-answer-${itemData._id}`;
  let isExpanded = false;

  // Question text + ARIA
  try {
    const qEl = $item('#qnaQuestion');
    qEl.text = itemData.question || '';
    qEl.accessibility.ariaExpanded = false;
    qEl.accessibility.ariaControls = answerId;
    qEl.accessibility.ariaLabel = `Question: ${itemData.question || ''}`;

    // Accordion toggle
    qEl.onClick(() => {
      isExpanded = !isExpanded;
      qEl.accessibility.ariaExpanded = isExpanded;
      try {
        if (isExpanded) {
          $item('#qnaAnswer').expand();
        } else {
          $item('#qnaAnswer').collapse();
        }
      } catch (e) {}
    });
  } catch (e) {
    console.error('[ProductQnA] _renderItem question failed:', e.message);
  }

  // Answer text + collapsed by default
  try {
    const aEl = $item('#qnaAnswer');
    aEl.text = itemData.answer || '';
    aEl.accessibility = aEl.accessibility || {};
    aEl.accessibility.role = 'region';
    aEl.collapse();
  } catch (e) {
    console.error('[ProductQnA] _renderItem answer failed:', e.message);
  }
}
