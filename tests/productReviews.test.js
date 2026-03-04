import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initProductReviews } from '../src/public/ProductReviews.js';
import { futonFrame } from './fixtures/products.js';

// Mock backend module
const mockAggregate = { average: 4.5, total: 12, breakdown: { 5: 6, 4: 3, 3: 2, 2: 1, 1: 0 } };
const mockReviews = {
  reviews: [
    { _id: 'rev-1', authorName: 'Sarah M.', rating: 5, title: 'Great', body: 'Solid build.', photos: [], verifiedPurchase: true, helpful: 3, date: 'January 15, 2026' },
    { _id: 'rev-2', authorName: 'Tom B.', rating: 4, title: 'Good', body: 'Nice finish.', photos: ['photo.jpg'], verifiedPurchase: false, helpful: 1, date: 'January 10, 2026' },
  ],
  total: 2,
  page: 0,
  pageSize: 10,
};

vi.mock('public/ProductPagePolish.js', () => ({
  styleReviewStars: vi.fn((rating) => {
    const r = Math.max(0, Math.min(5, Number(rating) || 0));
    const filled = Math.floor(r);
    const half = r - filled >= 0.5;
    const empty = 5 - filled - (half ? 1 : 0);
    return { filled, half, empty, filledColor: '#E8845C', emptyColor: '#D4BC96' };
  }),
  styleReviewCard: vi.fn(),
}));

vi.mock('backend/reviewsService.web', () => ({
  getAggregateRating: vi.fn(async () => mockAggregate),
  getProductReviews: vi.fn(async () => mockReviews),
  submitReview: vi.fn(async () => ({ success: true, reviewId: 'new-001' })),
  markHelpful: vi.fn(async () => ({ success: true, helpful: 4 })),
}));

function createMockElement() {
  return {
    text: '',
    value: '',
    label: '',
    collapse: vi.fn(() => Promise.resolve()),
    expand: vi.fn(() => Promise.resolve()),
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    enable: vi.fn(),
    disable: vi.fn(),
    onClick: vi.fn(),
    onChange: vi.fn(),
    onItemReady: vi.fn(),
    data: [],
    options: [],
    items: [],
    accessibility: { ariaLabel: '', ariaExpanded: false },
  };
}

function create$w() {
  const els = new Map();
  const $w = (sel) => {
    if (!els.has(sel)) els.set(sel, createMockElement());
    return els.get(sel);
  };
  $w._els = els;
  return $w;
}

describe('ProductReviews', () => {
  let $w;
  let state;

  beforeEach(() => {
    vi.clearAllMocks();
    $w = create$w();
    state = { product: { ...futonFrame } };
  });

  it('expands reviews section when product has reviews', async () => {
    await initProductReviews($w, state);
    expect($w('#reviewsSection').expand).toHaveBeenCalled();
  });

  it('collapses reviews section when no product ID', async () => {
    state.product._id = null;
    await initProductReviews($w, state);
    expect($w('#reviewsSection').collapse).toHaveBeenCalled();
  });

  it('handles missing reviews section gracefully', async () => {
    const nullW = () => null;
    await expect(initProductReviews(nullW, state)).resolves.not.toThrow();
  });

  it('renders aggregate average', async () => {
    await initProductReviews($w, state);
    expect($w('#reviewsAverage').text).toBe('4.5');
  });

  it('renders review count', async () => {
    await initProductReviews($w, state);
    expect($w('#reviewsCount').text).toBe('12 reviews');
  });

  it('renders singular review count', async () => {
    const { getAggregateRating } = await import('backend/reviewsService.web');
    getAggregateRating.mockResolvedValueOnce({ average: 5, total: 1, breakdown: { 5: 1, 4: 0, 3: 0, 2: 0, 1: 0 } });

    await initProductReviews($w, state);
    expect($w('#reviewsCount').text).toBe('1 review');
  });

  it('renders star string', async () => {
    await initProductReviews($w, state);
    // 4.5 average → ★★★★½
    expect($w('#reviewsStars').text).toBe('★★★★½');
  });

  it('sets up sort dropdown with options', async () => {
    await initProductReviews($w, state);
    expect($w('#reviewsSortDropdown').options).toHaveLength(4);
    expect($w('#reviewsSortDropdown').onChange).toHaveBeenCalled();
  });

  it('sets up pagination buttons', async () => {
    await initProductReviews($w, state);
    expect($w('#reviewsNextBtn').onClick).toHaveBeenCalled();
    expect($w('#reviewsPrevBtn').onClick).toHaveBeenCalled();
  });

  it('disables prev button on first page', async () => {
    await initProductReviews($w, state);
    expect($w('#reviewsPrevBtn').disable).toHaveBeenCalled();
  });

  it('sets up submit button', async () => {
    await initProductReviews($w, state);
    expect($w('#reviewSubmitBtn').onClick).toHaveBeenCalled();
  });

  it('renders reviews repeater with data', async () => {
    await initProductReviews($w, state);
    const repeater = $w('#reviewsRepeater');
    expect(repeater.onItemReady).toHaveBeenCalled();
    expect(repeater.data).toHaveLength(2);
  });

  it('shows empty state when no reviews', async () => {
    const { getProductReviews } = await import('backend/reviewsService.web');
    getProductReviews.mockResolvedValueOnce({ reviews: [], total: 0, page: 0, pageSize: 10 });

    await initProductReviews($w, state);
    expect($w('#reviewsEmptyState').show).toHaveBeenCalled();
  });

  it('hides empty state when reviews exist', async () => {
    await initProductReviews($w, state);
    expect($w('#reviewsEmptyState').hide).toHaveBeenCalled();
  });

  it('collapses repeater when no reviews', async () => {
    const { getProductReviews } = await import('backend/reviewsService.web');
    getProductReviews.mockResolvedValueOnce({ reviews: [], total: 0, page: 0, pageSize: 10 });

    await initProductReviews($w, state);
    expect($w('#reviewsRepeater').collapse).toHaveBeenCalled();
  });

  // ── Rating Breakdown Bars (#ratingBar1-5, #ratingCount1-5) ──────────

  it('sets rating breakdown bar values as percentages', async () => {
    await initProductReviews($w, state);
    // breakdown: { 5: 6, 4: 3, 3: 2, 2: 1, 1: 0 }, total: 12
    expect($w('#ratingBar5').value).toBe(50);  // 6/12 = 50%
    expect($w('#ratingBar4').value).toBe(25);  // 3/12 = 25%
    expect($w('#ratingBar3').value).toBe(17);  // 2/12 = 16.67 → 17%
    expect($w('#ratingBar2').value).toBe(8);   // 1/12 = 8.33 → 8%
    expect($w('#ratingBar1').value).toBe(0);   // 0/12 = 0%
  });

  it('sets rating breakdown count text', async () => {
    await initProductReviews($w, state);
    expect($w('#ratingCount5').text).toBe('6');
    expect($w('#ratingCount4').text).toBe('3');
    expect($w('#ratingCount3').text).toBe('2');
    expect($w('#ratingCount2').text).toBe('1');
    expect($w('#ratingCount1').text).toBe('0');
  });

  it('sets all rating bars to 0 when no reviews', async () => {
    const { getAggregateRating } = await import('backend/reviewsService.web');
    getAggregateRating.mockResolvedValueOnce({ average: 0, total: 0, breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } });

    await initProductReviews($w, state);
    for (let star = 1; star <= 5; star++) {
      expect($w(`#ratingBar${star}`).value).toBe(0);
    }
  });

  it('shows dash for average when no reviews', async () => {
    const { getAggregateRating } = await import('backend/reviewsService.web');
    getAggregateRating.mockResolvedValueOnce({ average: 0, total: 0, breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } });

    await initProductReviews($w, state);
    expect($w('#reviewsAverage').text).toBe('—');
  });

  it('shows "No reviews yet" text when total is 0', async () => {
    const { getAggregateRating } = await import('backend/reviewsService.web');
    getAggregateRating.mockResolvedValueOnce({ average: 0, total: 0, breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } });

    await initProductReviews($w, state);
    expect($w('#reviewsCount').text).toBe('No reviews yet');
  });

  // ── Repeater Item Bindings ──────────────────────────────────────────

  describe('repeater item bindings', () => {
    let $item;
    let renderHandler;

    beforeEach(async () => {
      await initProductReviews($w, state);
      const repeater = $w('#reviewsRepeater');
      // renderReviews sets onItemReady first
      renderHandler = repeater.onItemReady.mock.calls[0][0];
      $item = create$w();
    });

    it('binds #reviewAuthor text', () => {
      renderHandler($item, mockReviews.reviews[0]);
      expect($item('#reviewAuthor').text).toBe('Sarah M.');
    });

    it('binds #reviewDate text', () => {
      renderHandler($item, mockReviews.reviews[0]);
      expect($item('#reviewDate').text).toBe('January 15, 2026');
    });

    it('binds #reviewTitle text', () => {
      renderHandler($item, mockReviews.reviews[0]);
      expect($item('#reviewTitle').text).toBe('Great');
    });

    it('binds empty title as empty string', () => {
      renderHandler($item, { ...mockReviews.reviews[0], title: null });
      expect($item('#reviewTitle').text).toBe('');
    });

    it('binds #reviewBody text', () => {
      renderHandler($item, mockReviews.reviews[0]);
      expect($item('#reviewBody').text).toBe('Solid build.');
    });

    it('renders #reviewStars for item rating', () => {
      renderHandler($item, mockReviews.reviews[0]);
      // rating 5 → ★★★★★
      expect($item('#reviewStars').text).toMatch(/[★½☆]{5}/);
    });

    it('shows #reviewVerified for verified purchase', () => {
      renderHandler($item, mockReviews.reviews[0]); // verifiedPurchase: true
      expect($item('#reviewVerified').show).toHaveBeenCalled();
    });

    it('hides #reviewVerified for non-verified purchase', () => {
      renderHandler($item, mockReviews.reviews[1]); // verifiedPurchase: false
      expect($item('#reviewVerified').hide).toHaveBeenCalled();
    });

    it('sets verified purchase ARIA label', () => {
      renderHandler($item, mockReviews.reviews[0]);
      expect($item('#reviewVerified').accessibility.ariaLabel).toBe('Verified purchase');
    });

    it('shows #reviewPhotos when photos exist', () => {
      renderHandler($item, mockReviews.reviews[1]); // has photos: ['photo.jpg']
      expect($item('#reviewPhotos').show).toHaveBeenCalled();
    });

    it('hides #reviewPhotos when no photos', () => {
      renderHandler($item, mockReviews.reviews[0]); // photos: []
      expect($item('#reviewPhotos').hide).toHaveBeenCalled();
    });

    it('sets #reviewHelpfulCount text with count', () => {
      renderHandler($item, mockReviews.reviews[0]); // helpful: 3
      expect($item('#reviewHelpfulCount').text).toBe('Helpful (3)');
    });

    it('sets #reviewHelpfulCount to "Helpful" when count is 0', () => {
      renderHandler($item, { ...mockReviews.reviews[0], helpful: 0 });
      expect($item('#reviewHelpfulCount').text).toBe('Helpful');
    });

    it('stores review ID on #reviewHelpfulBtn label', () => {
      renderHandler($item, mockReviews.reviews[0]);
      expect($item('#reviewHelpfulBtn').label).toBe('rev-1');
    });
  });

  // ── Helpful Voting ──────────────────────────────────────────────────

  describe('helpful voting', () => {
    it('calls markHelpful on button click', async () => {
      const { markHelpful } = await import('backend/reviewsService.web');
      await initProductReviews($w, state);

      const repeater = $w('#reviewsRepeater');
      // initHelpfulVoting sets onItemReady second time
      const helpfulHandler = repeater.onItemReady.mock.calls[1][0];
      const $item = create$w();
      helpfulHandler($item, mockReviews.reviews[0]);

      const clickHandler = $item('#reviewHelpfulBtn').onClick.mock.calls[0][0];
      await clickHandler();

      expect(markHelpful).toHaveBeenCalledWith('rev-1');
    });

    it('disables helpful button after click', async () => {
      await initProductReviews($w, state);

      const repeater = $w('#reviewsRepeater');
      const helpfulHandler = repeater.onItemReady.mock.calls[1][0];
      const $item = create$w();
      helpfulHandler($item, mockReviews.reviews[0]);

      const clickHandler = $item('#reviewHelpfulBtn').onClick.mock.calls[0][0];
      await clickHandler();

      expect($item('#reviewHelpfulBtn').disable).toHaveBeenCalled();
    });

    it('updates helpful count text after successful vote', async () => {
      await initProductReviews($w, state);

      const repeater = $w('#reviewsRepeater');
      const helpfulHandler = repeater.onItemReady.mock.calls[1][0];
      const $item = create$w();
      helpfulHandler($item, mockReviews.reviews[0]);

      const clickHandler = $item('#reviewHelpfulBtn').onClick.mock.calls[0][0];
      await clickHandler();

      expect($item('#reviewHelpfulCount').text).toBe('Helpful (4)');
    });

    it('sets ARIA label on helpful button', async () => {
      await initProductReviews($w, state);

      const repeater = $w('#reviewsRepeater');
      const helpfulHandler = repeater.onItemReady.mock.calls[1][0];
      const $item = create$w();
      helpfulHandler($item, mockReviews.reviews[0]);

      expect($item('#reviewHelpfulBtn').accessibility.ariaLabel).toBe('Mark review by Sarah M. as helpful');
    });

    it('re-enables helpful button on backend error', async () => {
      const { markHelpful } = await import('backend/reviewsService.web');
      markHelpful.mockRejectedValueOnce(new Error('Network error'));

      await initProductReviews($w, state);

      const repeater = $w('#reviewsRepeater');
      const helpfulHandler = repeater.onItemReady.mock.calls[1][0];
      const $item = create$w();
      helpfulHandler($item, mockReviews.reviews[0]);

      const clickHandler = $item('#reviewHelpfulBtn').onClick.mock.calls[0][0];
      await clickHandler();

      expect($item('#reviewHelpfulBtn').enable).toHaveBeenCalled();
    });
  });

  // ── Pagination (#reviewsPageInfo, next/prev behavior) ──────────────

  describe('pagination', () => {
    it('renders page info text', async () => {
      await initProductReviews($w, state);
      // total: 2, pageSize: 10 → 1 page
      expect($w('#reviewsPageInfo').text).toBe('Page 1 of 1');
    });

    it('renders multi-page info', async () => {
      const { getProductReviews } = await import('backend/reviewsService.web');
      getProductReviews.mockResolvedValueOnce({ reviews: mockReviews.reviews, total: 25, page: 0, pageSize: 10 });

      await initProductReviews($w, state);
      expect($w('#reviewsPageInfo').text).toBe('Page 1 of 3');
    });

    it('disables next button on last page', async () => {
      // total: 2, pageSize: 10 → only 1 page, next should be disabled
      await initProductReviews($w, state);
      expect($w('#reviewsNextBtn').disable).toHaveBeenCalled();
    });

    it('enables next button when more pages exist', async () => {
      const { getProductReviews } = await import('backend/reviewsService.web');
      getProductReviews.mockResolvedValueOnce({ reviews: mockReviews.reviews, total: 25, page: 0, pageSize: 10 });

      await initProductReviews($w, state);
      expect($w('#reviewsNextBtn').enable).toHaveBeenCalled();
    });

    it('updates page info after next click', async () => {
      const { getProductReviews } = await import('backend/reviewsService.web');
      getProductReviews.mockResolvedValueOnce({ reviews: mockReviews.reviews, total: 25, page: 0, pageSize: 10 });

      await initProductReviews($w, state);

      getProductReviews.mockResolvedValueOnce({ reviews: mockReviews.reviews, total: 25, page: 1, pageSize: 10 });
      const nextHandler = $w('#reviewsNextBtn').onClick.mock.calls[0][0];
      await nextHandler();

      expect($w('#reviewsPageInfo').text).toBe('Page 2 of 3');
    });

    it('enables prev button after navigating forward', async () => {
      const { getProductReviews } = await import('backend/reviewsService.web');
      getProductReviews.mockResolvedValueOnce({ reviews: mockReviews.reviews, total: 25, page: 0, pageSize: 10 });

      await initProductReviews($w, state);

      getProductReviews.mockResolvedValueOnce({ reviews: mockReviews.reviews, total: 25, page: 1, pageSize: 10 });
      const nextHandler = $w('#reviewsNextBtn').onClick.mock.calls[0][0];
      await nextHandler();

      expect($w('#reviewsPrevBtn').enable).toHaveBeenCalled();
    });

    it('renders empty page info when no reviews', async () => {
      const { getProductReviews, getAggregateRating } = await import('backend/reviewsService.web');
      getProductReviews.mockResolvedValueOnce({ reviews: [], total: 0, page: 0, pageSize: 10 });
      getAggregateRating.mockResolvedValueOnce({ average: 0, total: 0, breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } });

      await initProductReviews($w, state);
      expect($w('#reviewsPageInfo').text).toBe('');
    });

    it('sets ARIA labels on pagination buttons', async () => {
      await initProductReviews($w, state);
      expect($w('#reviewsNextBtn').accessibility.ariaLabel).toBe('Next page of reviews');
      expect($w('#reviewsPrevBtn').accessibility.ariaLabel).toBe('Previous page of reviews');
    });
  });

  // ── Sort Dropdown ───────────────────────────────────────────────────

  describe('sort dropdown', () => {
    it('has correct sort options', async () => {
      await initProductReviews($w, state);
      const opts = $w('#reviewsSortDropdown').options;
      expect(opts).toEqual([
        { label: 'Newest', value: 'newest' },
        { label: 'Highest Rated', value: 'highest' },
        { label: 'Lowest Rated', value: 'lowest' },
        { label: 'Most Helpful', value: 'helpful' },
      ]);
    });

    it('defaults to newest sort', async () => {
      await initProductReviews($w, state);
      expect($w('#reviewsSortDropdown').value).toBe('newest');
    });

    it('reloads reviews on sort change', async () => {
      const { getProductReviews } = await import('backend/reviewsService.web');
      await initProductReviews($w, state);

      $w('#reviewsSortDropdown').value = 'highest';
      const handler = $w('#reviewsSortDropdown').onChange.mock.calls[0][0];
      await handler();

      expect(getProductReviews).toHaveBeenCalledWith(
        state.product._id,
        expect.objectContaining({ sort: 'highest', page: 0 })
      );
    });

    it('resets page to 0 on sort change', async () => {
      const { getProductReviews } = await import('backend/reviewsService.web');
      getProductReviews.mockResolvedValue({ reviews: mockReviews.reviews, total: 25, page: 0, pageSize: 10 });

      await initProductReviews($w, state);

      // Navigate to page 1
      const nextHandler = $w('#reviewsNextBtn').onClick.mock.calls[0][0];
      await nextHandler();

      // Change sort
      $w('#reviewsSortDropdown').value = 'lowest';
      const sortHandler = $w('#reviewsSortDropdown').onChange.mock.calls[0][0];
      await sortHandler();

      expect(getProductReviews).toHaveBeenLastCalledWith(
        state.product._id,
        expect.objectContaining({ sort: 'lowest', page: 0 })
      );
    });

    it('sets ARIA label on sort dropdown', async () => {
      await initProductReviews($w, state);
      expect($w('#reviewsSortDropdown').accessibility.ariaLabel).toBe('Sort reviews');
    });
  });

  // ── Review Form (#reviewForm, inputs, submit, errors, success) ──────

  describe('review form', () => {
    it('shows error when no rating selected', async () => {
      await initProductReviews($w, state);

      $w('#reviewRatingInput').value = '';
      $w('#reviewBodyInput').value = 'This is a long enough review body text.';

      const handler = $w('#reviewSubmitBtn').onClick.mock.calls[0][0];
      await handler();

      expect($w('#reviewFormError').text).toBe('Please select a star rating.');
      expect($w('#reviewFormError').show).toHaveBeenCalled();
    });

    it('shows error when rating is 0', async () => {
      await initProductReviews($w, state);

      $w('#reviewRatingInput').value = '0';
      $w('#reviewBodyInput').value = 'This is a long enough review body text.';

      const handler = $w('#reviewSubmitBtn').onClick.mock.calls[0][0];
      await handler();

      expect($w('#reviewFormError').text).toBe('Please select a star rating.');
    });

    it('shows error when rating exceeds 5', async () => {
      await initProductReviews($w, state);

      $w('#reviewRatingInput').value = '6';
      $w('#reviewBodyInput').value = 'This is a long enough review body text.';

      const handler = $w('#reviewSubmitBtn').onClick.mock.calls[0][0];
      await handler();

      expect($w('#reviewFormError').text).toBe('Please select a star rating.');
    });

    it('shows error when body too short', async () => {
      await initProductReviews($w, state);

      $w('#reviewRatingInput').value = '4';
      $w('#reviewBodyInput').value = 'Short';

      const handler = $w('#reviewSubmitBtn').onClick.mock.calls[0][0];
      await handler();

      expect($w('#reviewFormError').text).toBe('Review must be at least 10 characters.');
    });

    it('submits review with valid data', async () => {
      const { submitReview } = await import('backend/reviewsService.web');
      await initProductReviews($w, state);

      $w('#reviewRatingInput').value = '5';
      $w('#reviewTitleInput').value = 'Amazing product';
      $w('#reviewBodyInput').value = 'This futon is absolutely wonderful!';

      const handler = $w('#reviewSubmitBtn').onClick.mock.calls[0][0];
      await handler();

      expect(submitReview).toHaveBeenCalledWith({
        productId: state.product._id,
        rating: 5,
        title: 'Amazing product',
        body: 'This futon is absolutely wonderful!',
        photos: [],
      });
    });

    it('disables submit button during submission', async () => {
      await initProductReviews($w, state);

      $w('#reviewRatingInput').value = '4';
      $w('#reviewBodyInput').value = 'Great product, very comfortable!';

      const handler = $w('#reviewSubmitBtn').onClick.mock.calls[0][0];
      await handler();

      expect($w('#reviewSubmitBtn').disable).toHaveBeenCalled();
    });

    it('shows #reviewFormSuccess on successful submit', async () => {
      await initProductReviews($w, state);

      $w('#reviewRatingInput').value = '4';
      $w('#reviewBodyInput').value = 'Great product, very comfortable!';

      const handler = $w('#reviewSubmitBtn').onClick.mock.calls[0][0];
      await handler();

      expect($w('#reviewFormSuccess').show).toHaveBeenCalled();
    });

    it('collapses #reviewForm on successful submit', async () => {
      await initProductReviews($w, state);

      $w('#reviewRatingInput').value = '4';
      $w('#reviewBodyInput').value = 'Great product, very comfortable!';

      const handler = $w('#reviewSubmitBtn').onClick.mock.calls[0][0];
      await handler();

      expect($w('#reviewForm').collapse).toHaveBeenCalled();
    });

    it('shows #reviewFormError on backend failure', async () => {
      const { submitReview } = await import('backend/reviewsService.web');
      submitReview.mockResolvedValueOnce({ success: false, error: 'Duplicate review' });

      await initProductReviews($w, state);

      $w('#reviewRatingInput').value = '4';
      $w('#reviewBodyInput').value = 'Great product, very comfortable!';

      const handler = $w('#reviewSubmitBtn').onClick.mock.calls[0][0];
      await handler();

      expect($w('#reviewFormError').text).toBe('Duplicate review');
      expect($w('#reviewSubmitBtn').enable).toHaveBeenCalled();
    });

    it('shows generic error on exception', async () => {
      const { submitReview } = await import('backend/reviewsService.web');
      submitReview.mockRejectedValueOnce(new Error('Network error'));

      await initProductReviews($w, state);

      $w('#reviewRatingInput').value = '4';
      $w('#reviewBodyInput').value = 'Great product, very comfortable!';

      const handler = $w('#reviewSubmitBtn').onClick.mock.calls[0][0];
      await handler();

      expect($w('#reviewFormError').text).toBe('Something went wrong. Please try again.');
      expect($w('#reviewSubmitBtn').enable).toHaveBeenCalled();
    });

    it('re-enables submit button on backend failure', async () => {
      const { submitReview } = await import('backend/reviewsService.web');
      submitReview.mockResolvedValueOnce({ success: false, error: 'Error' });

      await initProductReviews($w, state);

      $w('#reviewRatingInput').value = '4';
      $w('#reviewBodyInput').value = 'Great product, very comfortable!';

      const handler = $w('#reviewSubmitBtn').onClick.mock.calls[0][0];
      await handler();

      expect($w('#reviewSubmitBtn').enable).toHaveBeenCalled();
    });

    it('hides error before submitting', async () => {
      await initProductReviews($w, state);

      $w('#reviewRatingInput').value = '4';
      $w('#reviewBodyInput').value = 'Great product, very comfortable!';

      const handler = $w('#reviewSubmitBtn').onClick.mock.calls[0][0];
      await handler();

      expect($w('#reviewFormError').hide).toHaveBeenCalled();
    });

    it('trims whitespace from title and body', async () => {
      const { submitReview } = await import('backend/reviewsService.web');
      await initProductReviews($w, state);

      $w('#reviewRatingInput').value = '3';
      $w('#reviewTitleInput').value = '  Padded Title  ';
      $w('#reviewBodyInput').value = '  This is long enough review text  ';

      const handler = $w('#reviewSubmitBtn').onClick.mock.calls[0][0];
      await handler();

      expect(submitReview).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Padded Title',
          body: 'This is long enough review text',
        })
      );
    });

    it('sets ARIA label on submit button', async () => {
      await initProductReviews($w, state);
      expect($w('#reviewSubmitBtn').accessibility.ariaLabel).toBe('Submit your review');
    });
  });

  // ── Error Handling ──────────────────────────────────────────────────

  describe('error handling', () => {
    it('collapses section on backend error', async () => {
      const { getAggregateRating } = await import('backend/reviewsService.web');
      getAggregateRating.mockRejectedValueOnce(new Error('DB down'));

      await initProductReviews($w, state);
      expect($w('#reviewsSection').collapse).toHaveBeenCalled();
    });

    it('handles missing product gracefully', async () => {
      state.product = null;
      await expect(initProductReviews($w, state)).resolves.not.toThrow();
    });
  });

  // ── SPA state-bleed regression tests ────────────────────────────────

  it('resets sort to newest on each init (SPA navigation)', async () => {
    const { getProductReviews } = await import('backend/reviewsService.web');

    // First product page — simulate sort change via onChange handler
    await initProductReviews($w, state);
    const sortDropdown = $w('#reviewsSortDropdown');
    // Simulate user changing sort to 'helpful'
    sortDropdown.value = 'helpful';
    const onChangeHandler = sortDropdown.onChange.mock.calls[0][0];
    await onChangeHandler();

    // Verify sort was called with 'helpful'
    expect(getProductReviews).toHaveBeenCalledWith(
      state.product._id,
      expect.objectContaining({ sort: 'helpful' })
    );

    // Navigate to second product (SPA) — fresh $w and state
    vi.clearAllMocks();
    const $w2 = create$w();
    const state2 = { product: { ...futonFrame, _id: 'product-2' } };

    await initProductReviews($w2, state2);

    // Sort dropdown should be reset to 'newest', NOT carry over 'helpful'
    expect($w2('#reviewsSortDropdown').value).toBe('newest');
    // Initial fetch should use 'newest' sort and page 0
    expect(getProductReviews).toHaveBeenCalledWith(
      'product-2',
      expect.objectContaining({ sort: 'newest', page: 0 })
    );
  });

  it('resets page to 0 on each init (SPA navigation)', async () => {
    const { getProductReviews } = await import('backend/reviewsService.web');
    getProductReviews.mockResolvedValue({ reviews: mockReviews.reviews, total: 30, page: 0, pageSize: 10 });

    // First product page — simulate pagination
    await initProductReviews($w, state);
    const nextBtn = $w('#reviewsNextBtn');
    const nextHandler = nextBtn.onClick.mock.calls[0][0];
    await nextHandler(); // go to page 1

    // Navigate to second product (SPA)
    vi.clearAllMocks();
    getProductReviews.mockResolvedValue({ reviews: mockReviews.reviews, total: 30, page: 0, pageSize: 10 });
    const $w2 = create$w();
    const state2 = { product: { ...futonFrame, _id: 'product-2' } };

    await initProductReviews($w2, state2);

    // Should fetch page 0, not page 1 carried over from previous product
    expect(getProductReviews).toHaveBeenCalledWith(
      'product-2',
      expect.objectContaining({ page: 0 })
    );
    // Prev button should be disabled (we're on page 0)
    expect($w2('#reviewsPrevBtn').disable).toHaveBeenCalled();
  });
});
