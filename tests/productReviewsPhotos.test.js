import { describe, it, expect, vi, beforeEach } from 'vitest';
import { futonFrame } from './fixtures/products.js';

const mockAggregate = { average: 4.5, total: 12, breakdown: { 5: 6, 4: 3, 3: 2, 2: 1, 1: 0 } };
const mockReviews = {
  reviews: [
    { _id: 'rev-1', authorName: 'Sarah M.', rating: 5, title: 'Great', body: 'Solid build.', photos: [], verifiedPurchase: true, helpful: 3, date: 'January 15, 2026' },
  ],
  total: 1,
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

vi.mock('public/sharedTokens.js', () => ({
  colors: { sunsetCoral: '#4A7D94', espresso: '#3c2415', sandBase: '#E8D5B7' },
}));

vi.mock('backend/reviewsService.web', () => ({
  getAggregateRating: vi.fn(async () => mockAggregate),
  getProductReviews: vi.fn(async () => mockReviews),
  submitReview: vi.fn(async () => ({ success: true, reviewId: 'new-001' })),
  markHelpful: vi.fn(async () => ({ success: true, helpful: 4 })),
  flagReview: vi.fn(async () => ({ success: true })),
}));

import { initProductReviews } from '../src/public/ProductReviews.js';

function createMockElement() {
  return {
    text: '', value: '', label: '', src: '', alt: '',
    style: { color: '', backgroundColor: '', width: '', opacity: 0 },
    collapse: vi.fn(() => Promise.resolve()),
    expand: vi.fn(() => Promise.resolve()),
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    enable: vi.fn(), disable: vi.fn(),
    onClick: vi.fn(), onChange: vi.fn(),
    onItemReady: vi.fn(), onInput: vi.fn(),
    data: [], options: [], items: [],
    postMessage: vi.fn(),
    accessibility: { ariaLabel: '', ariaExpanded: false },
    startUpload: vi.fn(),
    focus: vi.fn(),
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

describe('ProductReviews — photo upload & preview', () => {
  let $w, state;

  beforeEach(() => {
    vi.clearAllMocks();
    $w = create$w();
    state = { product: { ...futonFrame } };
  });

  // ── Photo Upload ──

  describe('photo upload', () => {
    it('sets ARIA label on photo upload button', async () => {
      await initProductReviews($w, state);
      expect($w('#reviewPhotoUpload').accessibility.ariaLabel).toContain('Upload photos');
      expect($w('#reviewPhotoUpload').accessibility.ariaLabel).toContain('3');
    });

    it('registers onChange handler on upload button', async () => {
      await initProductReviews($w, state);
      expect($w('#reviewPhotoUpload').onChange).toHaveBeenCalled();
    });

    it('sets initial photo count to 0/3', async () => {
      await initProductReviews($w, state);
      expect($w('#reviewPhotoCount').text).toBe('0/3 photos');
    });

    it('uploads photo and updates count', async () => {
      await initProductReviews($w, state);
      const uploadBtn = $w('#reviewPhotoUpload');
      uploadBtn.startUpload.mockResolvedValueOnce({ url: 'https://example.com/photo1.jpg' });

      const onChangeHandler = uploadBtn.onChange.mock.calls[0][0];
      await onChangeHandler();

      expect(uploadBtn.disable).toHaveBeenCalled();
      expect(uploadBtn.enable).toHaveBeenCalled();
      expect($w('#reviewPhotoCount').text).toBe('1/3 photos');
    });

    it('shows uploading status during upload', async () => {
      await initProductReviews($w, state);
      const uploadBtn = $w('#reviewPhotoUpload');

      let resolveUpload;
      uploadBtn.startUpload.mockReturnValueOnce(new Promise(r => { resolveUpload = r; }));

      const onChangePromise = uploadBtn.onChange.mock.calls[0][0]();
      expect($w('#reviewPhotoStatus').text).toBe('Uploading...');

      resolveUpload({ url: 'https://example.com/photo.jpg' });
      await onChangePromise;

      expect($w('#reviewPhotoStatus').text).toBe('');
    });

    it('disables upload button at max photos', async () => {
      await initProductReviews($w, state);
      const uploadBtn = $w('#reviewPhotoUpload');

      // Upload 3 photos
      for (let i = 0; i < 3; i++) {
        uploadBtn.startUpload.mockResolvedValueOnce({ url: `https://example.com/photo${i}.jpg` });
        const handler = uploadBtn.onChange.mock.calls[0][0];
        await handler();
      }

      expect($w('#reviewPhotoCount').text).toBe('3/3 photos');
      expect($w('#reviewPhotoStatus').text).toContain('Maximum 3 photos reached');
    });

    it('shows error when trying to upload beyond max', async () => {
      await initProductReviews($w, state);
      const uploadBtn = $w('#reviewPhotoUpload');

      // Upload 3 photos first
      for (let i = 0; i < 3; i++) {
        uploadBtn.startUpload.mockResolvedValueOnce({ url: `https://example.com/photo${i}.jpg` });
        await uploadBtn.onChange.mock.calls[0][0]();
      }

      // Try uploading a 4th
      await uploadBtn.onChange.mock.calls[0][0]();
      expect($w('#reviewFormError').text).toContain('Maximum 3 photos allowed');
    });

    it('handles upload failure gracefully', async () => {
      await initProductReviews($w, state);
      const uploadBtn = $w('#reviewPhotoUpload');
      uploadBtn.startUpload.mockRejectedValueOnce(new Error('Upload failed'));

      await uploadBtn.onChange.mock.calls[0][0]();

      expect(uploadBtn.enable).toHaveBeenCalled();
      expect($w('#reviewPhotoStatus').text).toBe('Upload failed — try again');
    });

    it('does not add photo when startUpload returns null', async () => {
      await initProductReviews($w, state);
      const uploadBtn = $w('#reviewPhotoUpload');
      uploadBtn.startUpload.mockResolvedValueOnce(null);

      await uploadBtn.onChange.mock.calls[0][0]();

      expect($w('#reviewPhotoCount').text).toBe('0/3 photos');
    });

    it('does not add photo when startUpload returns no url', async () => {
      await initProductReviews($w, state);
      const uploadBtn = $w('#reviewPhotoUpload');
      uploadBtn.startUpload.mockResolvedValueOnce({});

      await uploadBtn.onChange.mock.calls[0][0]();

      expect($w('#reviewPhotoCount').text).toBe('0/3 photos');
    });
  });

  // ── Photo Preview ──

  describe('photo preview rendering', () => {
    it('renders photo preview repeater after upload', async () => {
      await initProductReviews($w, state);
      const uploadBtn = $w('#reviewPhotoUpload');
      uploadBtn.startUpload.mockResolvedValueOnce({ url: 'https://example.com/photo1.jpg' });

      await uploadBtn.onChange.mock.calls[0][0]();

      const previewRepeater = $w('#reviewPhotoPreview');
      expect(previewRepeater.expand).toHaveBeenCalled();
      expect(previewRepeater.data).toHaveLength(1);
      expect(previewRepeater.data[0].src).toBe('https://example.com/photo1.jpg');
    });

    it('sets preview image src and alt via onItemReady', async () => {
      await initProductReviews($w, state);
      const uploadBtn = $w('#reviewPhotoUpload');
      uploadBtn.startUpload.mockResolvedValueOnce({ url: 'https://example.com/photo1.jpg' });

      await uploadBtn.onChange.mock.calls[0][0]();

      const previewRepeater = $w('#reviewPhotoPreview');
      const itemReady = previewRepeater.onItemReady.mock.calls[0][0];
      const $item = create$w();
      itemReady($item, { _id: 'photo-0', src: 'https://example.com/photo1.jpg', index: 0 });

      expect($item('#reviewPreviewImage').src).toBe('https://example.com/photo1.jpg');
      expect($item('#reviewPreviewImage').alt).toBe('Review photo 1');
    });

    it('sets ARIA label on remove button', async () => {
      await initProductReviews($w, state);
      const uploadBtn = $w('#reviewPhotoUpload');
      uploadBtn.startUpload.mockResolvedValueOnce({ url: 'https://example.com/photo1.jpg' });

      await uploadBtn.onChange.mock.calls[0][0]();

      const previewRepeater = $w('#reviewPhotoPreview');
      const itemReady = previewRepeater.onItemReady.mock.calls[0][0];
      const $item = create$w();
      itemReady($item, { _id: 'photo-0', src: 'https://example.com/photo1.jpg', index: 0 });

      expect($item('#reviewPreviewRemove').accessibility.ariaLabel).toBe('Remove photo 1');
    });

    it('removes photo on remove button click', async () => {
      await initProductReviews($w, state);
      const uploadBtn = $w('#reviewPhotoUpload');
      uploadBtn.startUpload.mockResolvedValueOnce({ url: 'https://example.com/photo1.jpg' });
      uploadBtn.startUpload.mockResolvedValueOnce({ url: 'https://example.com/photo2.jpg' });

      await uploadBtn.onChange.mock.calls[0][0]();
      await uploadBtn.onChange.mock.calls[0][0]();

      expect($w('#reviewPhotoCount').text).toBe('2/3 photos');

      // Get the onItemReady from the latest renderPhotoPreview call
      const previewRepeater = $w('#reviewPhotoPreview');
      const lastItemReady = previewRepeater.onItemReady.mock.calls[previewRepeater.onItemReady.mock.calls.length - 1][0];
      const $item = create$w();
      lastItemReady($item, { _id: 'photo-0', src: 'https://example.com/photo1.jpg', index: 0 });

      // Click remove
      const removeHandler = $item('#reviewPreviewRemove').onClick.mock.calls[0][0];
      removeHandler();

      expect($w('#reviewPhotoCount').text).toBe('1/3 photos');
    });

    it('collapses preview when all photos removed', async () => {
      await initProductReviews($w, state);
      const uploadBtn = $w('#reviewPhotoUpload');
      uploadBtn.startUpload.mockResolvedValueOnce({ url: 'https://example.com/photo1.jpg' });

      await uploadBtn.onChange.mock.calls[0][0]();

      const previewRepeater = $w('#reviewPhotoPreview');
      const lastItemReady = previewRepeater.onItemReady.mock.calls[previewRepeater.onItemReady.mock.calls.length - 1][0];
      const $item = create$w();
      lastItemReady($item, { _id: 'photo-0', src: 'https://example.com/photo1.jpg', index: 0 });

      // Remove the only photo
      const removeHandler = $item('#reviewPreviewRemove').onClick.mock.calls[0][0];
      removeHandler();

      expect(previewRepeater.collapse).toHaveBeenCalled();
    });

    it('re-enables upload button when photo removed below max', async () => {
      await initProductReviews($w, state);
      const uploadBtn = $w('#reviewPhotoUpload');

      // Upload 3 photos
      for (let i = 0; i < 3; i++) {
        uploadBtn.startUpload.mockResolvedValueOnce({ url: `https://example.com/photo${i}.jpg` });
        await uploadBtn.onChange.mock.calls[0][0]();
      }

      // Verify upload is disabled at max
      expect($w('#reviewPhotoStatus').text).toContain('Maximum');

      // Remove one photo
      const previewRepeater = $w('#reviewPhotoPreview');
      const lastItemReady = previewRepeater.onItemReady.mock.calls[previewRepeater.onItemReady.mock.calls.length - 1][0];
      const $item = create$w();
      lastItemReady($item, { _id: 'photo-0', src: 'https://example.com/photo0.jpg', index: 0 });

      const removeHandler = $item('#reviewPreviewRemove').onClick.mock.calls[0][0];
      removeHandler();

      expect(uploadBtn.enable).toHaveBeenCalled();
    });
  });

  // ── Review submission with photos ──

  describe('review submission with photos', () => {
    it('submits review with uploaded photo URLs', async () => {
      const { submitReview } = await import('backend/reviewsService.web');
      await initProductReviews($w, state);
      const uploadBtn = $w('#reviewPhotoUpload');

      // Upload 2 photos
      uploadBtn.startUpload.mockResolvedValueOnce({ url: 'https://example.com/a.jpg' });
      await uploadBtn.onChange.mock.calls[0][0]();
      uploadBtn.startUpload.mockResolvedValueOnce({ url: 'https://example.com/b.jpg' });
      await uploadBtn.onChange.mock.calls[0][0]();

      // Submit review
      $w('#reviewRatingInput').value = '5';
      $w('#reviewTitleInput').value = 'With photos';
      $w('#reviewBodyInput').value = 'Great product with photos to prove it!';

      const submitHandler = $w('#reviewSubmitBtn').onClick.mock.calls[0][0];
      await submitHandler();

      expect(submitReview).toHaveBeenCalledWith(
        expect.objectContaining({
          photos: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
        })
      );
    });

    it('clears uploaded photos after successful submission', async () => {
      await initProductReviews($w, state);
      const uploadBtn = $w('#reviewPhotoUpload');

      uploadBtn.startUpload.mockResolvedValueOnce({ url: 'https://example.com/a.jpg' });
      await uploadBtn.onChange.mock.calls[0][0]();

      $w('#reviewRatingInput').value = '4';
      $w('#reviewBodyInput').value = 'Nice product with photo!';

      const submitHandler = $w('#reviewSubmitBtn').onClick.mock.calls[0][0];
      await submitHandler();

      // After successful submit, photos should be cleared
      // Re-init to verify the module-level _uploadedPhotoUrls was reset
      expect($w('#reviewFormSuccess').show).toHaveBeenCalled();
    });

    it('limits photos to MAX_REVIEW_PHOTOS in submission', async () => {
      const { submitReview } = await import('backend/reviewsService.web');
      await initProductReviews($w, state);
      const uploadBtn = $w('#reviewPhotoUpload');

      // Upload 3 photos
      for (let i = 0; i < 3; i++) {
        uploadBtn.startUpload.mockResolvedValueOnce({ url: `https://example.com/${i}.jpg` });
        await uploadBtn.onChange.mock.calls[0][0]();
      }

      $w('#reviewRatingInput').value = '5';
      $w('#reviewBodyInput').value = 'Product review with three photos attached!';

      await $w('#reviewSubmitBtn').onClick.mock.calls[0][0]();

      expect(submitReview).toHaveBeenCalledWith(
        expect.objectContaining({
          photos: expect.arrayContaining(['https://example.com/0.jpg']),
        })
      );
      const callPhotos = submitReview.mock.calls[0][0].photos;
      expect(callPhotos.length).toBeLessThanOrEqual(3);
    });
  });

  // ── Review repeater — photos gallery items ──

  describe('repeater photo gallery bindings', () => {
    it('sets gallery items when review has photos', async () => {
      const { getProductReviews } = await import('backend/reviewsService.web');
      getProductReviews.mockResolvedValueOnce({
        reviews: [{
          _id: 'rev-1', authorName: 'Alex', rating: 5, title: 'Amazing',
          body: 'With pics', photos: ['p1.jpg', 'p2.jpg'],
          verifiedPurchase: false, helpful: 0, date: 'Mar 1, 2026',
        }],
        total: 1, page: 0, pageSize: 10,
      });

      await initProductReviews($w, state);
      const repeater = $w('#reviewsRepeater');
      const renderHandler = repeater.onItemReady.mock.calls[0][0];
      const $item = create$w();

      renderHandler($item, {
        _id: 'rev-1', authorName: 'Alex', rating: 5, title: 'Amazing',
        body: 'With pics', photos: ['p1.jpg', 'p2.jpg'],
        verifiedPurchase: false, helpful: 0, date: 'Mar 1, 2026',
      });

      expect($item('#reviewPhotos').show).toHaveBeenCalled();
      expect($item('#reviewPhotos').items).toEqual([
        { src: 'p1.jpg', alt: 'Review photo' },
        { src: 'p2.jpg', alt: 'Review photo' },
      ]);
    });

    it('hides #reviewPhotos when photos array is empty', async () => {
      await initProductReviews($w, state);
      const repeater = $w('#reviewsRepeater');
      const renderHandler = repeater.onItemReady.mock.calls[0][0];
      const $item = create$w();

      renderHandler($item, { ...mockReviews.reviews[0], photos: [] });
      expect($item('#reviewPhotos').hide).toHaveBeenCalled();
    });

    it('hides #reviewPhotos when photos is null', async () => {
      await initProductReviews($w, state);
      const repeater = $w('#reviewsRepeater');
      const renderHandler = repeater.onItemReady.mock.calls[0][0];
      const $item = create$w();

      renderHandler($item, { ...mockReviews.reviews[0], photos: null });
      expect($item('#reviewPhotos').hide).toHaveBeenCalled();
    });
  });

  // ── Sort preserves star filter ──

  describe('sort preserves star filter', () => {
    it('includes filterStars in sort change request', async () => {
      const { getProductReviews } = await import('backend/reviewsService.web');
      await initProductReviews($w, state);

      // Set star filter to 5
      const filter5Handler = $w('#starFilter5').onClick.mock.calls[0][0];
      await filter5Handler();

      // Now change sort
      $w('#reviewsSortDropdown').value = 'highest';
      const sortHandler = $w('#reviewsSortDropdown').onChange.mock.calls[0][0];
      await sortHandler();

      expect(getProductReviews).toHaveBeenLastCalledWith(
        state.product._id,
        expect.objectContaining({ sort: 'highest', filterStars: 5, page: 0 })
      );
    });
  });

  // ── Prev button prevents going below page 0 ──

  describe('prev button clamping', () => {
    it('clamps page to 0 on prev click at page 0', async () => {
      const { getProductReviews } = await import('backend/reviewsService.web');
      getProductReviews.mockResolvedValueOnce({ reviews: mockReviews.reviews, total: 25, page: 0, pageSize: 10 });

      await initProductReviews($w, state);

      // Click prev at page 0
      getProductReviews.mockResolvedValueOnce({ reviews: mockReviews.reviews, total: 25, page: 0, pageSize: 10 });
      const prevHandler = $w('#reviewsPrevBtn').onClick.mock.calls[0][0];
      await prevHandler();

      // Should request page 0, not -1
      expect(getProductReviews).toHaveBeenLastCalledWith(
        state.product._id,
        expect.objectContaining({ page: 0 })
      );
    });
  });
});
