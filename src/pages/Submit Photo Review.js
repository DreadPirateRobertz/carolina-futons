/**
 * Submit Photo Review page (CF-zkdy-ui-submit)
 *
 * Member-facing form for submitting a UGC photo review.
 * Reads productId/productName from URL query params.
 * Validates file type (jpg/png/webp) and size (<= 5MB, inclusive).
 * Calls submitPhotoReview webMethod on submit.
 */
import { submitPhotoReview } from 'backend/photoReviews.web';
import { trackEvent } from 'public/engagementTracker';
import { announce } from 'public/a11yHelpers';
import { initBackToTop } from 'public/mobileHelpers';
import { initPageSeo } from 'public/pageSeo.js';
import wixLocation from 'wix-location-frontend';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB (inclusive)
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MIN_REVIEW_LENGTH = 10;

// Module-scoped upload state — reset at the top of onReady on each page load.
let _uploadedFile = null;

function showValidation(message) {
  $w('#validationMessage').text = message;
  $w('#validationMessage').expand();
  announce(message);
}

$w.onReady(async function () {
  // Reset upload state on every page load (handles SPA navigation re-entry)
  _uploadedFile = null;

  const { productId, productName } = wixLocation.query || {};

  if (productName) {
    $w('#productNameDisplay').text = productName;
  }

  initBackToTop($w);
  initPageSeo('photo-review-submit');
  trackEvent('page_view', { page: 'photo-review-submit' });

  $w('#validationMessage').collapse();
  $w('#successSection').collapse();
  $w('#submitFormSection').expand();
  $w('#submitBtn').disable();
  $w('#photoPreview').collapse();

  $w('#photoUploadButton').fileType = 'Image';

  if (!productId) {
    showValidation('Product information is missing. Please return to the product page and try again.');
    return;
  }

  $w('#photoUploadButton').onChange(async (event) => {
    try {
      const file = event.target?.files?.[0];
      if (!file) return;

      if (!ACCEPTED_TYPES.includes(file.type)) {
        showValidation('Please upload a jpg, png, or webp image.');
        $w('#submitBtn').disable();
        _uploadedFile = null;
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        showValidation('File too large. Maximum size is 5MB.');
        $w('#submitBtn').disable();
        _uploadedFile = null;
        return;
      }

      $w('#validationMessage').collapse();
      _uploadedFile = file;

      // file.url is set by Wix after upload completes; fall back to a preview URI for display.
      const src = file.url || `wix:image://v1/${file.name}`;
      $w('#photoPreview').src = src;
      $w('#photoPreview').expand();
      $w('#submitBtn').enable();
    } catch (err) {
      console.error('[photoReview] Error handling file upload:', err);
      showValidation('Unable to load photo preview. Please try again.');
      _uploadedFile = null;
      $w('#submitBtn').disable();
    }
  });

  $w('#submitBtn').onClick(async () => {
    if (!_uploadedFile) {
      showValidation('Please upload a photo before submitting.');
      return;
    }

    const reviewText = ($w('#reviewTextInput').value || '').trim();
    const rating = Number($w('#ratingInput').value) || 0;
    const caption = ($w('#captionInput').value || '').trim();

    if (!reviewText) {
      showValidation('Review text is required.');
      return;
    }
    if (reviewText.length < MIN_REVIEW_LENGTH) {
      showValidation(`Review must be at least ${MIN_REVIEW_LENGTH} characters.`);
      return;
    }
    if (rating < 1 || rating > 5) {
      showValidation('Rating is required.');
      return;
    }

    $w('#submitBtn').disable();

    // file.url may be absent if the file was selected but not yet uploaded by Wix Media Manager;
    // in that case the preview src (set from the same source) is the best available reference.
    const photoUrl = _uploadedFile?.url || $w('#photoPreview').src || '';

    if (!photoUrl) {
      showValidation('Photo upload is not ready. Please wait and try again.');
      $w('#submitBtn').enable();
      return;
    }

    let submitResult;
    try {
      submitResult = await submitPhotoReview({
        productId,
        reviewText,
        rating,
        photoUrl,
        photoCaption: caption,
      });
    } catch (err) {
      console.error('[photoReview] submitPhotoReview threw:', err);
      showValidation('Failed to submit. Please try again.');
      $w('#submitBtn').enable();
      return;
    }

    if (submitResult.success) {
      $w('#successMessage').text = "Thanks! Your photo is in review.";
      $w('#successSection').expand();
      $w('#submitFormSection').collapse();

      // Non-critical side effects — don't let these un-do the success state
      try {
        trackEvent('photo_review_submit', { productId });
        announce("Your photo review has been submitted successfully.");
      } catch (err) {
        console.error('[photoReview] Post-submit tracking failed:', err);
      }
    } else {
      showValidation(submitResult.error || 'Failed to submit. Please try again.');
      $w('#submitBtn').enable();
    }
  });
});
