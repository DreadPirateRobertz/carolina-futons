// ProductQnA.js — Consolidated Q&A widget for the PDP
// Supersedes ProductQA.js (retired in CF-qa8c). Uses #qna* element nicknames.
// Backend: productQA.web (ProductQuestions CMS collection, rate-limited, auth-gated).
import { getProductQuestions, submitQuestion as submitQuestionBackend, voteHelpful, flagQuestion, getQASchema } from 'backend/productQA.web';

const PAGE_SIZE = 5;

// Module-level state (reset via destroy / _resetForTest)
let _submitting = false; // prevents concurrent insert race on double-tap

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Load the first page of approved Q&A items for a product.
 * @param {string} productId
 * @returns {{ items: object[], hasMore: boolean, totalCount: number, pageSize: number, page: number, error: boolean }}
 */
export async function loadQnA(productId) {
  if (!productId) return { items: [], hasMore: false, totalCount: 0, pageSize: PAGE_SIZE, page: 1, error: false };
  try {
    const result = await getProductQuestions(productId, { page: 1, pageSize: PAGE_SIZE });
    if (!result.success) return { items: [], hasMore: false, totalCount: 0, pageSize: PAGE_SIZE, page: 1, error: true };
    const { questions, totalCount, pageSize, page } = result.data;
    return { items: questions, hasMore: questions.length < totalCount, totalCount, pageSize, page, error: false };
  } catch (e) {
    console.error('[ProductQnA] loadQnA failed:', e);
    return { items: [], hasMore: false, totalCount: 0, pageSize: PAGE_SIZE, page: 1, error: true };
  }
}

/**
 * Render Q&A items into the accordion repeater.
 * Registers onItemReady BEFORE setting .data (Wix requirement).
 * @param {Function} $w
 * @param {object[]} items
 * @param {{ hasMore: boolean, totalCount: number }} opts
 */
export function renderQnA($w, items, { hasMore = false, totalCount = 0 } = {}) {
  // Count display (optional element)
  try {
    $w('#qnaCount').text = totalCount === 1 ? '1 question' : `${totalCount} questions`;
  } catch (e) {}

  if (items.length === 0) {
    try { $w('#qnaSection').hide(); } catch (e) { console.error('[ProductQnA] hide qnaSection failed:', e); }
    try { $w('#qnaEmpty').show(); } catch (e) { console.error('[ProductQnA] show qnaEmpty failed:', e); }
    try { $w('#qnaLoadMore').hide(); } catch (e) { console.error('[ProductQnA] hide qnaLoadMore failed:', e); }
    return;
  }

  try { $w('#qnaSection').show(); } catch (e) { console.error('[ProductQnA] show qnaSection failed:', e); }
  try { $w('#qnaEmpty').hide(); } catch (e) { console.error('[ProductQnA] hide qnaEmpty failed:', e); }

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
  } catch (e) { console.error('[ProductQnA] qnaLoadMore visibility failed:', e); }
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
    const nextPage = currentPage + 1;
    const result = await getProductQuestions(productId, { page: nextPage, pageSize: PAGE_SIZE });
    if (!result.success || !result.data.questions.length) {
      try { $w('#qnaLoadMore').hide(); } catch (e) {}
      return { appended: 0, hasMore: false };
    }

    const { questions, totalCount } = result.data;
    const accordion = $w('#qnaAccordion');
    const existing = Array.isArray(accordion.data) ? accordion.data : [];
    accordion.data = [...existing, ...questions];

    const loadedTotal = existing.length + questions.length;
    const hasMore = loadedTotal < totalCount;
    if (hasMore) {
      try { $w('#qnaLoadMore').show(); } catch (e) {}
    } else {
      try { $w('#qnaLoadMore').hide(); } catch (e) {}
    }

    return { appended: questions.length, hasMore };
  } catch (e) {
    console.error('[ProductQnA] loadMore failed:', e);
    // Keep button visible so user can retry — hasMore unknown on error
    try { $w('#qnaLoadMore').show(); } catch (_) {}
    return { appended: 0, hasMore: true };
  }
}

/**
 * Submit a customer question (pending approval).
 * Backend handles rate limiting and auth. Client guard prevents concurrent double-tap.
 * @param {Function} $w
 * @param {string} productId
 */
export async function submitQuestion($w, productId) {
  if (!productId) return;

  const input = $w('#qnaQuestionInput');
  const submitBtn = $w('#qnaSubmitBtn');
  const thankYou = $w('#qnaThankYou');
  const errorEl = $w('#qnaFormError');

  const questionText = (input.value || '').trim();
  if (!questionText) return;

  // Concurrent-call guard (e.g. double-tap before first insert resolves)
  if (_submitting) {
    // Defensive re-enable: a previous call may have left the button disabled.
    try { submitBtn.enable(); } catch (e) {}
    return;
  }

  _submitting = true;
  try { submitBtn.disable(); } catch (e) {}
  try { errorEl.hide(); } catch (e) {}

  try {
    const result = await submitQuestionBackend(productId, questionText);

    if (result.success) {
      input.value = '';
      try { thankYou.show(); } catch (e) {}
    } else {
      try { errorEl.text = result.error || 'Failed to submit. Please try again.'; } catch (e) {}
      try { errorEl.show(); } catch (e) {}
      console.error('[ProductQnA] submitQuestion rejected:', result.error);
    }
  } catch (e) {
    try { errorEl.text = 'Something went wrong. Please try again.'; } catch (e2) {}
    try { errorEl.show(); } catch (e2) {}
    console.error('[ProductQnA] submitQuestion failed:', e);
  } finally {
    _submitting = false;
    try { submitBtn.enable(); } catch (e) {}
  }
}

/**
 * Wire the optional search/filter input (#qnaSearchInput).
 * Debounces 300ms, re-renders on each keystroke. No-op if element absent.
 * @param {Function} $w
 * @param {string} productId
 */
export function initSearch($w, productId) {
  try {
    const input = $w('#qnaSearchInput');
    try { input.accessibility.ariaLabel = 'Search questions about this product'; } catch (e) {}

    let timer = null;
    input.onInput(() => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          const searchText = (input.value || '').trim();
          const opts = searchText ? { searchText, page: 1, pageSize: PAGE_SIZE } : { page: 1, pageSize: PAGE_SIZE };
          const result = await getProductQuestions(productId, opts);
          if (result.success) {
            const { questions, totalCount } = result.data;
            renderQnA($w, questions, { hasMore: questions.length < totalCount, totalCount });
          }
        } catch (e) {
          console.error('[ProductQnA] search failed:', e);
        }
      }, 300);
    });
  } catch (e) {
    // #qnaSearchInput not present in this editor layout — skip silently
  }
}

/**
 * Inject FAQ JSON-LD schema into #qnaSchemaScript (optional SEO element).
 * @param {Function} $w
 * @param {string} productId
 */
export async function injectSchema($w, productId) {
  try {
    const result = await getQASchema(productId);
    if (!result?.success || !result.data?.schema) return;
    try {
      $w('#qnaSchemaScript').html =
        `<script type="application/ld+json">${safeJsonLd(result.data.schema)}</script>`;
    } catch (e) {
      // Element not present — schema injection skipped
    }
  } catch (e) {
    console.error('[ProductQnA] injectSchema failed:', e);
  }
}

/**
 * Serialize an object to JSON safe for inline <script> injection.
 * Escapes </ to prevent early script tag termination.
 * @param {*} obj
 * @returns {string}
 */
export function safeJsonLd(obj) {
  return JSON.stringify(obj).replace(/<\//g, '<\\/');
}

/**
 * Clean up module state for SPA navigation.
 */
export function destroy() {
  _submitting = false;
}

// ─── Test-only reset ─────────────────────────────────────────────────────────

export function _resetForTest() {
  destroy();
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function _renderItem($item, q) {
  const answerId = `qna-answer-${q._id || 'unknown'}`;
  let isExpanded = false;

  // Question text + metadata
  try { $item('#qnaQuestion').text = q.question || ''; } catch (e) {}
  try { $item('#qnaAuthor').text = q.memberName || 'Customer'; } catch (e) {}
  try {
    $item('#qnaDate').text = q.createdDate
      ? new Date(q.createdDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '';
  } catch (e) {}

  // Answer section — show if answered, show pending badge otherwise
  if (q.answer && q.status === 'answered') {
    try { $item('#qnaAnswer').text = q.answer; } catch (e) {}
    try { $item('#qnaAnswerSection').show(); } catch (e) {}
    try { $item('#qnaAnsweredBy').text = `— ${q.answeredBy || 'Carolina Futons'}`; } catch (e) {}
    try { $item('#qnaPending').hide(); } catch (e) {}
  } else {
    try { $item('#qnaAnswerSection').hide(); } catch (e) {}
    try { $item('#qnaPending').show(); } catch (e) {}
  }

  // ARIA + accordion toggle on question element
  try {
    const qEl = $item('#qnaQuestion');
    qEl.accessibility.ariaExpanded = false;
    qEl.accessibility.ariaControls = answerId;
    qEl.accessibility.ariaLabel = `Question: ${q.question || ''}`;

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
        console.error('[ProductQnA] accordion toggle failed:', e);
      }
    });
  } catch (e) {
    console.error('[ProductQnA] _renderItem ARIA/toggle failed:', e);
  }

  // Answer element id for aria-controls target
  try {
    const aEl = $item('#qnaAnswer');
    aEl.id = answerId;
    aEl.accessibility = aEl.accessibility || {};
    aEl.accessibility.role = 'region';
    aEl.collapse();
  } catch (e) {
    console.error('[ProductQnA] _renderItem answer setup failed:', e);
  }

  // Helpful voting (optional element)
  try {
    const helpfulBtn = $item('#qnaHelpfulBtn');
    const helpfulCount = $item('#qnaHelpfulCount');
    helpfulCount.text = q.helpfulVotes > 0 ? `Helpful (${q.helpfulVotes})` : 'Helpful';
    helpfulBtn.accessibility.ariaLabel = `Vote this question helpful (${q.helpfulVotes || 0} votes)`;
    helpfulBtn.onClick(async () => {
      try {
        const result = await voteHelpful(q._id);
        if (result.success) {
          helpfulCount.text = `Helpful (${result.data.helpfulVotes})`;
        } else {
          helpfulBtn.label = 'Voted';
        }
      } catch (e) { /* non-critical action — silent */ }
    });
  } catch (e) { /* #qnaHelpfulBtn not in this layout */ }

  // Flag/report (optional element)
  try {
    const flagBtn = $item('#qnaFlagBtn');
    flagBtn.accessibility.ariaLabel = 'Report this question';
    flagBtn.onClick(async () => {
      try {
        const result = await flagQuestion(q._id);
        if (result.success) {
          flagBtn.label = 'Reported';
          flagBtn.disable();
        }
      } catch (e) { /* non-critical action — silent */ }
    });
  } catch (e) { /* #qnaFlagBtn not in this layout */ }
}
