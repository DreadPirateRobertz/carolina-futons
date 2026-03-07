// ProductQA.js - Customer Q&A section for product pages
// Displays questions & answers, submit form, helpful voting, flagging,
// and injects FAQ schema for SEO.
import { getProductQuestions, submitQuestion, voteHelpful, flagQuestion, getQASchema } from 'backend/productQA.web';

/**
 * Initialize the Q&A section on a product page.
 * @param {Function} $w - Wix selector function.
 * @param {Object} state - Product page state with state.product.
 */
export async function initProductQA($w, state) {
  try {
    const section = $w('#qaSection');
    const productId = state.product?._id;

    if (!productId) {
      try { section.collapse(); } catch (e) {}
      return;
    }

    // ARIA for section
    try { section.accessibility.ariaLabel = 'Customer Questions & Answers'; } catch (e) {}
    try { section.accessibility.role = 'region'; } catch (e) {}

    // Load questions + schema in parallel
    const [questionsResult, schemaResult] = await Promise.all([
      getProductQuestions(productId),
      getQASchema(productId).catch(() => null),
    ]);

    if (!questionsResult.success) {
      try { section.collapse(); } catch (e) {}
      return;
    }

    section.expand();

    const { questions, totalCount, pageSize } = questionsResult.data;
    let currentPage = questionsResult.data.page;

    // Question count
    renderCount($w, totalCount);

    // Questions list
    renderQuestions($w, questions);

    // Pagination
    initLoadMore($w, productId, questions.length, totalCount, pageSize, currentPage);

    // Search input
    initSearchInput($w, productId);

    // Submit form
    initSubmitForm($w, state, productId);

    // Inject FAQ schema (non-blocking)
    injectSchema($w, schemaResult);
  } catch (e) {
    try { $w('#qaSection').collapse(); } catch (e2) {}
  }
}

// ── Count Display ────────────────────────────────────────────────────

function renderCount($w, totalCount) {
  try {
    const countEl = $w('#qaCount');
    countEl.text = totalCount === 1
      ? '1 question'
      : `${totalCount} questions`;
  } catch (e) {}
}

// ── Questions Repeater ───────────────────────────────────────────────

function renderQuestions($w, questions) {
  try {
    const repeater = $w('#qaRepeater');
    const emptyState = $w('#qaEmptyState');

    if (questions.length === 0) {
      try { emptyState.show(); } catch (e) {}
      try { repeater.collapse(); } catch (e) {}
      return;
    }

    try { emptyState.hide(); } catch (e) {}
    try { repeater.expand(); } catch (e) {}

    repeater.onItemReady(($item, itemData) => {
      renderQuestionItem($item, itemData);
    });

    repeater.data = questions;
  } catch (e) {}
}

function renderQuestionItem($item, q) {
  // Question text & author
  try { $item('#qaQuestionText').text = q.question; } catch (e) {}
  try { $item('#qaAuthorName').text = q.memberName || 'Customer'; } catch (e) {}
  try {
    $item('#qaDate').text = q.createdDate
      ? new Date(q.createdDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '';
  } catch (e) {}

  // Answer section
  if (q.answer && q.status === 'answered') {
    try { $item('#qaAnswerText').text = q.answer; } catch (e) {}
    try { $item('#qaAnswerSection').show(); } catch (e) {}
    try { $item('#qaAnsweredBy').text = `— ${q.answeredBy || 'Carolina Futons'}`; } catch (e) {}
    try { $item('#qaPendingBadge').hide(); } catch (e) {}
  } else {
    try { $item('#qaAnswerSection').hide(); } catch (e) {}
    try { $item('#qaPendingBadge').show(); } catch (e) {}
  }

  // Helpful voting
  try {
    $item('#qaHelpfulCount').text = q.helpfulVotes > 0
      ? `Helpful (${q.helpfulVotes})`
      : 'Helpful';
  } catch (e) {}

  try {
    $item('#qaHelpfulBtn').accessibility.ariaLabel = `Vote this question helpful (${q.helpfulVotes} votes)`;
  } catch (e) {}

  try {
    $item('#qaHelpfulBtn').onClick(async () => {
      try {
        const result = await voteHelpful(q._id);
        if (result.success) {
          try { $item('#qaHelpfulCount').text = `Helpful (${result.data.helpfulVotes})`; } catch (e) {}
        } else {
          try { $item('#qaHelpfulBtn').label = 'Voted'; } catch (e) {}
        }
      } catch (e) {
        // Network error — silent for non-critical action
      }
    });
  } catch (e) {}

  // Flag button
  try {
    $item('#qaFlagBtn').accessibility.ariaLabel = 'Report this question';
  } catch (e) {}

  try {
    $item('#qaFlagBtn').onClick(async () => {
      try {
        const result = await flagQuestion(q._id);
        if (result.success) {
          try { $item('#qaFlagBtn').label = 'Reported'; } catch (e) {}
          try { $item('#qaFlagBtn').disable(); } catch (e) {}
        }
      } catch (e) {
        // Network error — silent for non-critical action
      }
    });
  } catch (e) {}
}

// ── Load More Pagination ─────────────────────────────────────────────

function initLoadMore($w, productId, loadedCount, totalCount, pageSize, currentPage) {
  try {
    const loadMoreBtn = $w('#qaLoadMoreBtn');

    if (loadedCount >= totalCount) {
      loadMoreBtn.hide();
      return;
    }

    loadMoreBtn.show();
    loadMoreBtn.onClick(async () => {
      try {
        loadMoreBtn.disable();
        loadMoreBtn.label = 'Loading...';

        const nextPage = currentPage + 1;
        const result = await getProductQuestions(productId, { page: nextPage, pageSize });

        if (result.success && result.data.questions.length > 0) {
          const repeater = $w('#qaRepeater');
          const existingData = repeater.data || [];
          repeater.data = [...existingData, ...result.data.questions];

          currentPage = nextPage;
          const newTotal = existingData.length + result.data.questions.length;

          if (newTotal >= result.data.totalCount) {
            loadMoreBtn.hide();
          } else {
            loadMoreBtn.enable();
            loadMoreBtn.label = 'Load More Questions';
          }
        } else {
          loadMoreBtn.hide();
        }
      } catch (e) {
        loadMoreBtn.enable();
        loadMoreBtn.label = 'Load More Questions';
      }
    });
  } catch (e) {}
}

// ── Search Input ─────────────────────────────────────────────────────

/**
 * Initialize the search/filter input for Q&A questions.
 * Debounces input (300ms), queries backend with searchText, re-renders
 * the question list and resets pagination on each search.
 * @param {Function} $w - Wix selector function.
 * @param {string} productId - Product ID to search questions for.
 */
function initSearchInput($w, productId) {
  try {
    const input = $w('#qaSearchInput');
    if (!input) return;

    try { input.accessibility.ariaLabel = 'Search questions about this product'; } catch (e) {}

    let debounceTimer = null;

    input.onInput(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        try {
          const searchText = (input.value || '').trim();
          const opts = searchText ? { searchText } : {};
          const result = await getProductQuestions(productId, opts);

          if (result.success) {
            renderCount($w, result.data.totalCount);
            renderQuestions($w, result.data.questions);
            // Reset pagination — search results start from page 1
            initLoadMore(
              $w, productId,
              result.data.questions.length,
              result.data.totalCount,
              result.data.pageSize,
              1
            );
          } else {
            console.error('[ProductQA] Search failed:', result.error);
          }
        } catch (err) {
          console.error('[ProductQA] Search error:', err.message);
          try {
            $w('#qaSearchError').text = 'Search failed. Please try again.';
            $w('#qaSearchError').show('fade', { duration: 200 });
          } catch (e) {}
        }
      }, 300);
    });
  } catch (err) {
    console.error('[ProductQA] initSearchInput failed:', err.message);
  }
}

// ── Submit Question Form ─────────────────────────────────────────────

function initSubmitForm($w, state, productId) {
  try {
    const input = $w('#qaQuestionInput');
    const submitBtn = $w('#qaSubmitBtn');
    const errorEl = $w('#qaFormError');
    const successEl = $w('#qaFormSuccess');

    try { input.accessibility.ariaLabel = 'Ask a question about this product'; } catch (e) {}
    try { submitBtn.accessibility.ariaLabel = 'Submit your question'; } catch (e) {}

    submitBtn.onClick(async () => {
      const questionText = (input.value || '').trim();

      // Client-side validation
      if (!questionText) {
        try { errorEl.text = 'Please enter a question.'; } catch (e) {}
        try { errorEl.show(); } catch (e) {}
        return;
      }

      try { errorEl.hide(); } catch (e) {}
      try { successEl.hide(); } catch (e) {}

      submitBtn.disable();
      try { submitBtn.label = 'Submitting...'; } catch (e) {}

      try {
        const result = await submitQuestion(productId, questionText);

        if (result.success) {
          input.value = '';
          try { successEl.text = 'Your question has been submitted! We\'ll answer it soon.'; } catch (e) {}
          try { successEl.show(); } catch (e) {}

          // Refresh questions list
          const refreshed = await getProductQuestions(productId);
          if (refreshed.success) {
            renderCount($w, refreshed.data.totalCount);
            renderQuestions($w, refreshed.data.questions);
          }
        } else {
          try { errorEl.text = result.error || 'Failed to submit question.'; } catch (e) {}
          try { errorEl.show(); } catch (e) {}
        }
      } catch (e) {
        try { errorEl.text = 'Something went wrong. Please try again.'; } catch (e2) {}
        try { errorEl.show(); } catch (e2) {}
      }

      submitBtn.enable();
      try { submitBtn.label = 'Ask a Question'; } catch (e) {}
    });
  } catch (e) {}
}

// ── FAQ Schema Injection ─────────────────────────────────────────────

function injectSchema($w, schemaResult) {
  try {
    if (!schemaResult?.success || !schemaResult.data?.schema) return;

    // Inject JSON-LD via Wix SEO API if available
    if (typeof $w('#qaSchemaScript') !== 'undefined') {
      try {
        $w('#qaSchemaScript').html = `<script type="application/ld+json">${JSON.stringify(schemaResult.data.schema)}</script>`;
      } catch (e) {}
    }
  } catch (e) {}
}
