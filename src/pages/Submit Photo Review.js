/**
 * Submit Photo Review page (CF-zkdy-ui-submit)
 *
 * Member-facing form for submitting a UGC photo review.
 * Reads productId/productName from URL query params.
 * Validates file type (jpg/png/webp) and size (<= 5MB).
 * Calls submitPhotoReview webMethod on submit.
 */
import { submitPhotoReview } from 'backend/photoReviews.web';
import { trackEvent } from 'public/engagementTracker';
import { announce } from 'public/a11yHelpers';
import { initBackToTop } from 'public/mobileHelpers';
import { initPageSeo } from 'public/pageSeo.js';
import wixLocation from 'wix-location-frontend';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MIN_REVIEW_LENGTH = 10;

let _uploadedFile = null;

$w.onReady(async function () {
  const { productId, productName } = wixLocation.query || {};

  // Populate product name display
  if (productName) {
    $w('#productNameDisplay').text = productName;
  }

  // Init helpers
  initBackToTop();
  initPageSeo();
  trackEvent('page_view', { page: 'photo-review-submit' });

  // Initial UI state
  $w('#validationMessage').collapse();
  $w('#successSection').collapse();
  $w('#submitFormSection').expand();
  $w('#submitBtn').disable();
  $w('#photoPreview').collapse();

  // Configure upload button
  $w('#photoUploadButton').fileType = 'Image';

  // File upload handler
  $w('#photoUploadButton').onChange(async (event) => {
    const file = event.target?.files?.[0];
    if (!file) return;

    // Validate file type
    if (!ACCEPTED_TYPES.includes(file.type)) {
      $w('#validationMessage').text = 'Please upload a jpg, png, or webp image.';
      $w('#validationMessage').expand();
      $w('#submitBtn').disable();
      _uploadedFile = null;
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      $w('#validationMessage').text = 'File too large. Maximum size is 5MB.';
      $w('#validationMessage').expand();
      $w('#submitBtn').disable();
      _uploadedFile = null;
      return;
    }

    // Valid file — clear any prior error, show preview, enable submit
    $w('#validationMessage').collapse();
    _uploadedFile = file;

    const src = file.url || `wix:image://v1/${file.name}`;
    $w('#photoPreview').src = src;
    $w('#photoPreview').expand();
    $w('#submitBtn').enable();
  });

  // Submit handler
  $w('#submitBtn').onClick(async () => {
    const reviewText = ($w('#reviewTextInput').value || '').trim();
    const rating = Number($w('#ratingInput').value) || 0;
    const caption = ($w('#captionInput').value || '').trim();

    // Validate review text
    if (!reviewText) {
      $w('#validationMessage').text = 'Review text is required.';
      $w('#validationMessage').expand();
      return;
    }
    if (reviewText.length < MIN_REVIEW_LENGTH) {
      $w('#validationMessage').text = `Review must be at least 10 characters.`;
      $w('#validationMessage').expand();
      return;
    }

    // Validate rating
    if (!rating) {
      $w('#validationMessage').text = 'Rating is required.';
      $w('#validationMessage').expand();
      return;
    }

    // Disable button during inflight request
    $w('#submitBtn').disable();

    const photoUrl = _uploadedFile?.url || $w('#photoPreview').src || '';

    try {
      const result = await submitPhotoReview({
        productId,
        reviewText,
        rating,
        photoUrl,
        photoCaption: caption,
      });

      if (result.success) {
        trackEvent('photo_review_submit', { productId });
        $w('#successMessage').text = "Thanks! Your photo is in review.";
        $w('#successSection').expand();
        $w('#submitFormSection').collapse();
        announce("Your photo review has been submitted successfully.");
      } else {
        $w('#validationMessage').text = result.error || 'Failed to submit. Please try again.';
        $w('#validationMessage').expand();
        $w('#submitBtn').enable();
      }
    } catch (_err) {
      $w('#validationMessage').text = 'Failed to submit. Please try again.';
      $w('#validationMessage').expand();
      $w('#submitBtn').enable();
    }
  });
});
