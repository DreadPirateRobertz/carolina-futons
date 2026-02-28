// ProductReviews.js - Customer reviews section
// Displays product reviews with star ratings, sorting, pagination,
// submission form for logged-in members, and helpful voting.

// Page-scoped review state — reset on every init to prevent SPA bleed
const DEFAULT_SORT = 'newest';
const DEFAULT_PAGE = 0;

/**
 * Initialize the reviews section on a product page.
 * Loads aggregate rating and first page of reviews.
 *
 * @param {Function} $w - Wix selector function.
 * @param {Object} state - Product page state with state.product.
 */
export async function initProductReviews($w, state) {
  try {
    const section = $w('#reviewsSection');
    if (!section) return;

    const productId = state.product?._id;
    if (!productId) { section.collapse(); return; }

    // Reset review state on each init to prevent SPA navigation bleed
    state.reviewSort = DEFAULT_SORT;
    state.reviewPage = DEFAULT_PAGE;

    // Load aggregate + reviews in parallel
    const { getAggregateRating, getProductReviews } = await import('backend/reviewsService.web');

    const [aggregate, reviewsResult] = await Promise.all([
      getAggregateRating(productId),
      getProductReviews(productId, { sort: state.reviewSort, page: DEFAULT_PAGE }),
    ]);

    // Show section
    section.expand();

    // Render aggregate rating summary
    renderAggregate($w, aggregate);

    // Render reviews list
    renderReviews($w, reviewsResult);

    // Sort dropdown
    initSortDropdown($w, state, getProductReviews);

    // Pagination
    initPagination($w, state, reviewsResult, getProductReviews);

    // Submit form
    initReviewForm($w, state);

    // Helpful voting
    initHelpfulVoting($w);
  } catch (e) {
    try { $w('#reviewsSection').collapse(); } catch (e2) {}
  }
}

// ── Aggregate Rating ──────────────────────────────────────────────────

function renderAggregate($w, aggregate) {
  try {
    const avgEl = $w('#reviewsAverage');
    if (avgEl) avgEl.text = aggregate.total > 0 ? String(aggregate.average) : '—';
  } catch (e) {}

  try {
    const countEl = $w('#reviewsCount');
    if (countEl) {
      countEl.text = aggregate.total > 0
        ? `${aggregate.total} review${aggregate.total !== 1 ? 's' : ''}`
        : 'No reviews yet';
    }
  } catch (e) {}

  // Star display (fill stars based on average)
  renderStars($w, '#reviewsStars', aggregate.average);

  // Rating breakdown bars (5-star to 1-star)
  for (let star = 5; star >= 1; star--) {
    try {
      const barEl = $w(`#ratingBar${star}`);
      if (barEl && aggregate.total > 0) {
        const pct = Math.round((aggregate.breakdown[star] / aggregate.total) * 100);
        barEl.value = pct;
      } else if (barEl) {
        barEl.value = 0;
      }
    } catch (e) {}

    try {
      const countEl = $w(`#ratingCount${star}`);
      if (countEl) countEl.text = String(aggregate.breakdown[star] || 0);
    } catch (e) {}
  }
}

function renderStars($w, selector, rating) {
  try {
    const el = $w(selector);
    if (!el) return;
    // Generate star string: ★★★★☆ format
    const fullStars = Math.floor(rating);
    const halfStar = rating - fullStars >= 0.5;
    let stars = '★'.repeat(fullStars);
    if (halfStar) stars += '½';
    stars += '☆'.repeat(5 - fullStars - (halfStar ? 1 : 0));
    el.text = stars;
  } catch (e) {}
}

// ── Reviews List ──────────────────────────────────────────────────────

function renderReviews($w, reviewsResult) {
  try {
    const repeater = $w('#reviewsRepeater');
    if (!repeater) return;

    if (reviewsResult.reviews.length === 0) {
      try { $w('#reviewsEmptyState').show(); } catch (e) {}
      try { repeater.collapse(); } catch (e) {}
      return;
    }

    try { $w('#reviewsEmptyState').hide(); } catch (e) {}
    repeater.expand();

    repeater.onItemReady(($item, itemData) => {
      try { $item('#reviewAuthor').text = itemData.authorName; } catch (e) {}
      try { $item('#reviewDate').text = itemData.date; } catch (e) {}
      try { $item('#reviewTitle').text = itemData.title || ''; } catch (e) {}
      try { $item('#reviewBody').text = itemData.body; } catch (e) {}
      try {
        renderStars({ [sel => sel]: null, ...createItemStarHelper($item) }, '#reviewStars', itemData.rating);
      } catch (e) {
        // Fallback: set star text directly
        try { $item('#reviewStars').text = '★'.repeat(itemData.rating) + '☆'.repeat(5 - itemData.rating); } catch (e2) {}
      }

      // Verified purchase badge
      try {
        if (itemData.verifiedPurchase) {
          $item('#reviewVerified').show();
          try { $item('#reviewVerified').accessibility.ariaLabel = 'Verified purchase'; } catch (e) {}
        } else {
          $item('#reviewVerified').hide();
        }
      } catch (e) {}

      // Helpful count
      try { $item('#reviewHelpfulCount').text = itemData.helpful > 0 ? `Helpful (${itemData.helpful})` : 'Helpful'; } catch (e) {}

      // Store review ID on helpful button for click handler
      try { $item('#reviewHelpfulBtn').label = itemData._id; } catch (e) {}

      // Review photos
      try {
        if (itemData.photos && itemData.photos.length > 0) {
          $item('#reviewPhotos').show();
          // If photos is a gallery element
          try { $item('#reviewPhotos').items = itemData.photos.map(src => ({ src, alt: 'Review photo' })); } catch (e) {}
        } else {
          $item('#reviewPhotos').hide();
        }
      } catch (e) {}
    });

    repeater.data = reviewsResult.reviews.map((r, i) => ({ ...r, _id: r._id || `rev-${i}` }));
  } catch (e) {}
}

function createItemStarHelper($item) {
  return new Proxy({}, {
    get: (_, prop) => (sel) => $item(sel),
  });
}

// ── Sort Dropdown ─────────────────────────────────────────────────────

function initSortDropdown($w, state, getProductReviews) {
  try {
    const dropdown = $w('#reviewsSortDropdown');
    if (!dropdown) return;

    dropdown.options = [
      { label: 'Newest', value: 'newest' },
      { label: 'Highest Rated', value: 'highest' },
      { label: 'Lowest Rated', value: 'lowest' },
      { label: 'Most Helpful', value: 'helpful' },
    ];
    dropdown.value = state.reviewSort;
    try { dropdown.accessibility.ariaLabel = 'Sort reviews'; } catch (e) {}

    dropdown.onChange(async () => {
      state.reviewSort = dropdown.value;
      state.reviewPage = 0;
      const result = await getProductReviews(state.product._id, { sort: state.reviewSort, page: 0 });
      renderReviews($w, result);
      updatePaginationState($w, state, result);
    });
  } catch (e) {}
}

// ── Pagination ────────────────────────────────────────────────────────

function initPagination($w, state, initialResult, getProductReviews) {
  updatePaginationState($w, state, initialResult);

  try {
    const nextBtn = $w('#reviewsNextBtn');
    if (nextBtn) {
      try { nextBtn.accessibility.ariaLabel = 'Next page of reviews'; } catch (e) {}
      nextBtn.onClick(async () => {
        state.reviewPage++;
        const result = await getProductReviews(state.product._id, { sort: state.reviewSort, page: state.reviewPage });
        renderReviews($w, result);
        updatePaginationState($w, state, result);
      });
    }
  } catch (e) {}

  try {
    const prevBtn = $w('#reviewsPrevBtn');
    if (prevBtn) {
      try { prevBtn.accessibility.ariaLabel = 'Previous page of reviews'; } catch (e) {}
      prevBtn.onClick(async () => {
        state.reviewPage = Math.max(0, state.reviewPage - 1);
        const result = await getProductReviews(state.product._id, { sort: state.reviewSort, page: state.reviewPage });
        renderReviews($w, result);
        updatePaginationState($w, state, result);
      });
    }
  } catch (e) {}
}

function updatePaginationState($w, state, result) {
  const totalPages = Math.ceil(result.total / result.pageSize);
  try {
    const prevBtn = $w('#reviewsPrevBtn');
    if (prevBtn) { state.reviewPage > 0 ? prevBtn.enable() : prevBtn.disable(); }
  } catch (e) {}
  try {
    const nextBtn = $w('#reviewsNextBtn');
    if (nextBtn) { state.reviewPage < totalPages - 1 ? nextBtn.enable() : nextBtn.disable(); }
  } catch (e) {}
  try {
    $w('#reviewsPageInfo').text = totalPages > 0
      ? `Page ${state.reviewPage + 1} of ${totalPages}`
      : '';
  } catch (e) {}
}

// ── Review Submission Form ────────────────────────────────────────────

function initReviewForm($w, state) {
  try {
    const submitBtn = $w('#reviewSubmitBtn');
    if (!submitBtn) return;

    try { submitBtn.accessibility.ariaLabel = 'Submit your review'; } catch (e) {}

    submitBtn.onClick(async () => {
      try {
        const ratingInput = $w('#reviewRatingInput');
        const titleInput = $w('#reviewTitleInput');
        const bodyInput = $w('#reviewBodyInput');

        const rating = Number(ratingInput?.value);
        const title = titleInput?.value?.trim() || '';
        const body = bodyInput?.value?.trim() || '';

        if (!rating || rating < 1 || rating > 5) {
          showFormError($w, 'Please select a star rating.');
          return;
        }
        if (body.length < 10) {
          showFormError($w, 'Review must be at least 10 characters.');
          return;
        }

        submitBtn.disable();
        try { $w('#reviewFormError').hide(); } catch (e) {}

        const { submitReview } = await import('backend/reviewsService.web');
        const result = await submitReview({
          productId: state.product._id,
          rating,
          title,
          body,
        });

        if (result.success) {
          try { $w('#reviewFormSuccess').show(); } catch (e) {}
          try { $w('#reviewForm').collapse(); } catch (e) {}
        } else {
          showFormError($w, result.error || 'Unable to submit review.');
          submitBtn.enable();
        }
      } catch (err) {
        showFormError($w, 'Something went wrong. Please try again.');
        submitBtn.enable();
      }
    });
  } catch (e) {}
}

function showFormError($w, message) {
  try {
    const errEl = $w('#reviewFormError');
    if (errEl) {
      errEl.text = message;
      errEl.show();
    }
  } catch (e) {}
}

// ── Helpful Voting ────────────────────────────────────────────────────

function initHelpfulVoting($w) {
  try {
    const repeater = $w('#reviewsRepeater');
    if (!repeater) return;

    // Use event delegation via repeater item click
    repeater.onItemReady(($item, itemData) => {
      try {
        const helpfulBtn = $item('#reviewHelpfulBtn');
        if (!helpfulBtn) return;

        try { helpfulBtn.accessibility.ariaLabel = `Mark review by ${itemData.authorName} as helpful`; } catch (e) {}
        helpfulBtn.onClick(async () => {
          try {
            helpfulBtn.disable();
            const { markHelpful } = await import('backend/reviewsService.web');
            const result = await markHelpful(itemData._id);
            if (result.success) {
              try { $item('#reviewHelpfulCount').text = `Helpful (${result.helpful})`; } catch (e) {}
            }
          } catch (e) { console.error('[ProductReviews] markHelpful failed:', e.message); helpfulBtn.enable(); }
        });
      } catch (e) {}
    });
  } catch (e) {}
}
