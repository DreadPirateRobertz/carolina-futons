// ProductReviews.js - Customer reviews section
// Displays product reviews with star ratings, sorting, pagination,
// submission form for logged-in members, and helpful voting.
import { styleReviewStars, styleReviewCard } from 'public/ProductPagePolish.js';

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
    state.reviewFilterStars = undefined;

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

    // Inject review schema for SEO
    injectReviewSchema($w, aggregate, state.product);

    // Render reviews list
    renderReviews($w, reviewsResult);

    // Sort dropdown
    initSortDropdown($w, state, getProductReviews);

    // Star filter
    initStarFilter($w, state, getProductReviews);

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
    const starData = styleReviewStars(rating);
    let stars = '★'.repeat(starData.filled);
    if (starData.half) stars += '½';
    stars += '☆'.repeat(starData.empty);
    el.text = stars;
    try { el.style.color = starData.filledColor; } catch (e) {}
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
      // Brand-token card styling
      try { styleReviewCard($item('#reviewCard')); } catch (e) {}

      try { $item('#reviewAuthor').text = itemData.authorName; } catch (e) {}
      try { $item('#reviewDate').text = itemData.date; } catch (e) {}
      try { $item('#reviewTitle').text = itemData.title || ''; } catch (e) {}
      try { $item('#reviewBody').text = itemData.body; } catch (e) {}
      // $item is a scoped selector — works like $w for the repeater row
      renderStars($item, '#reviewStars', itemData.rating);

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

      // Owner response
      try {
        if (itemData.ownerResponse) {
          $item('#reviewOwnerResponse').show();
          try { $item('#reviewOwnerResponse').accessibility.ariaLabel = 'Store response'; } catch (e) {}
          try { $item('#reviewOwnerResponseText').text = itemData.ownerResponse; } catch (e) {}
          try { $item('#reviewOwnerResponseDate').text = itemData.ownerResponseDate || ''; } catch (e) {}
        } else {
          $item('#reviewOwnerResponse').hide();
        }
      } catch (e) {}

      // Report button
      try {
        const reportBtn = $item('#reviewReportBtn');
        if (reportBtn) {
          try { reportBtn.accessibility.ariaLabel = 'Report this review'; } catch (e) {}
          reportBtn.onClick(() => {
            try {
              const dropdown = $item('#reviewReportDropdown');
              if (dropdown) {
                dropdown.options = [
                  { label: 'Spam', value: 'spam' },
                  { label: 'Offensive', value: 'offensive' },
                  { label: 'Fake review', value: 'fake' },
                  { label: 'Other', value: 'other' },
                ];
                dropdown.show();
                dropdown.onChange(async () => {
                  try {
                    const { flagReview } = await import('backend/reviewsService.web');
                    const result = await flagReview(itemData._id, dropdown.value);
                    if (result.success) {
                      reportBtn.disable();
                      reportBtn.label = 'Reported';
                      try { dropdown.hide(); } catch (e) {}
                    }
                  } catch (e) {}
                });
              }
            } catch (e) {}
          });
        }
      } catch (e) {}
    });

    repeater.data = reviewsResult.reviews.map((r, i) => ({ ...r, _id: r._id || `rev-${i}` }));
  } catch (e) {}
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
      const result = await getProductReviews(state.product._id, { sort: state.reviewSort, page: 0, filterStars: state.reviewFilterStars });
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
        const result = await getProductReviews(state.product._id, { sort: state.reviewSort, page: state.reviewPage, filterStars: state.reviewFilterStars });
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
        const result = await getProductReviews(state.product._id, { sort: state.reviewSort, page: state.reviewPage, filterStars: state.reviewFilterStars });
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

// ── Star Filter ──────────────────────────────────────────────────────

function initStarFilter($w, state, getProductReviews) {
  // "All" button
  try {
    const allBtn = $w('#starFilterAll');
    if (allBtn) {
      try { allBtn.accessibility.ariaLabel = 'Show all reviews'; } catch (e) {}
      allBtn.onClick(async () => {
        state.reviewFilterStars = undefined;
        state.reviewPage = 0;
        const result = await getProductReviews(state.product._id, {
          sort: state.reviewSort, page: 0,
        });
        renderReviews($w, result);
        updatePaginationState($w, state, result);
      });
    }
  } catch (e) {}

  // Star buttons 1-5
  for (let star = 1; star <= 5; star++) {
    try {
      const btn = $w(`#starFilter${star}`);
      if (!btn) continue;
      try { btn.accessibility.ariaLabel = `Show ${star} star reviews`; } catch (e) {}
      btn.onClick(async () => {
        state.reviewFilterStars = star;
        state.reviewPage = 0;
        const result = await getProductReviews(state.product._id, {
          sort: state.reviewSort, page: 0, filterStars: star,
        });
        renderReviews($w, result);
        updatePaginationState($w, state, result);
      });
    } catch (e) {}
  }
}

// ── Review Schema Markup ─────────────────────────────────────────────

function injectReviewSchema($w, aggregate, product) {
  if (!aggregate || aggregate.total === 0) return;
  try {
    const schema = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product?.name || '',
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: aggregate.average,
        bestRating: 5,
        worstRating: 1,
        reviewCount: aggregate.total,
      },
    });
    const el = $w('#reviewSchemaMarkup');
    if (el) el.postMessage(schema);
  } catch (e) {}
}

// ── Review Submission Form ────────────────────────────────────────────

const MAX_REVIEW_PHOTOS = 3;
let _uploadedPhotoUrls = [];

function initReviewForm($w, state) {
  try {
    const submitBtn = $w('#reviewSubmitBtn');
    if (!submitBtn) return;
    _uploadedPhotoUrls = [];

    try { submitBtn.accessibility.ariaLabel = 'Submit your review'; } catch (e) {}

    // Photo upload button (max 3 photos)
    initPhotoUpload($w);

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
          photos: _uploadedPhotoUrls.slice(0, MAX_REVIEW_PHOTOS),
        });

        if (result.success) {
          _uploadedPhotoUrls = [];
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

function initPhotoUpload($w) {
  try {
    const uploadBtn = $w('#reviewPhotoUpload');
    if (!uploadBtn) return;

    try { uploadBtn.accessibility.ariaLabel = `Upload photos (max ${MAX_REVIEW_PHOTOS})`; } catch (e) {}

    updatePhotoCount($w);

    uploadBtn.onChange(async () => {
      if (_uploadedPhotoUrls.length >= MAX_REVIEW_PHOTOS) {
        showFormError($w, `Maximum ${MAX_REVIEW_PHOTOS} photos allowed.`);
        return;
      }

      try {
        uploadBtn.disable();
        try {
          const label = $w('#reviewPhotoStatus');
          if (label) label.text = 'Uploading...';
        } catch (e) {}

        const uploadResult = await uploadBtn.startUpload();
        if (uploadResult && uploadResult.url) {
          _uploadedPhotoUrls.push(uploadResult.url);
          updatePhotoCount($w);
          renderPhotoPreview($w);
        }

        uploadBtn.enable();
        try {
          const label = $w('#reviewPhotoStatus');
          if (label) label.text = '';
        } catch (e) {}

        // Disable upload button if max reached
        if (_uploadedPhotoUrls.length >= MAX_REVIEW_PHOTOS) {
          uploadBtn.disable();
          try {
            const label = $w('#reviewPhotoStatus');
            if (label) label.text = `Maximum ${MAX_REVIEW_PHOTOS} photos reached`;
          } catch (e) {}
        }
      } catch (err) {
        console.error('[ProductReviews] Photo upload failed:', err.message);
        uploadBtn.enable();
        try {
          const label = $w('#reviewPhotoStatus');
          if (label) label.text = 'Upload failed — try again';
        } catch (e) {}
      }
    });
  } catch (e) {}
}

function updatePhotoCount($w) {
  try {
    const countEl = $w('#reviewPhotoCount');
    if (countEl) countEl.text = `${_uploadedPhotoUrls.length}/${MAX_REVIEW_PHOTOS} photos`;
  } catch (e) {}
}

function renderPhotoPreview($w) {
  try {
    const previewRepeater = $w('#reviewPhotoPreview');
    if (!previewRepeater) return;

    if (_uploadedPhotoUrls.length === 0) {
      try { previewRepeater.collapse(); } catch (e) {}
      return;
    }

    previewRepeater.expand();
    previewRepeater.data = _uploadedPhotoUrls.map((url, i) => ({
      _id: `photo-${i}`,
      src: url,
      index: i,
    }));

    previewRepeater.onItemReady(($item, itemData) => {
      try { $item('#reviewPreviewImage').src = itemData.src; } catch (e) {}
      try { $item('#reviewPreviewImage').alt = `Review photo ${itemData.index + 1}`; } catch (e) {}
      try {
        $item('#reviewPreviewRemove').onClick(() => {
          _uploadedPhotoUrls.splice(itemData.index, 1);
          updatePhotoCount($w);
          renderPhotoPreview($w);
          // Re-enable upload button if below max
          try {
            const uploadBtn = $w('#reviewPhotoUpload');
            if (uploadBtn && _uploadedPhotoUrls.length < MAX_REVIEW_PHOTOS) {
              uploadBtn.enable();
              try {
                const label = $w('#reviewPhotoStatus');
                if (label) label.text = '';
              } catch (e) {}
            }
          } catch (e) {}
        });
        try { $item('#reviewPreviewRemove').accessibility.ariaLabel = `Remove photo ${itemData.index + 1}`; } catch (e) {}
      } catch (e) {}
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
