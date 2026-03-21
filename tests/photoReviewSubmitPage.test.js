/**
 * Tests for CF-zkdy-ui-submit: Submit Photo Review page
 *   - Page init: loads product info from URL query params
 *   - File upload: validates type (jpg/png/webp) and size (<= 5MB)
 *   - Form validation: required fields (photo, reviewText, rating)
 *   - Submit flow: calls submitPhotoReview, shows success state
 *   - Error states: submit failure, missing fields
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    src: '',
    alt: '',
    label: '',
    value: '',
    data: [],
    style: { color: '', backgroundColor: '' },
    accessibility: {},
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(),
    expand: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    onClick: vi.fn(),
    onChange: vi.fn(),
    onKeyPress: vi.fn(),
    uploadFiles: vi.fn(),
    fileType: '',
    maxFileSize: 0,
  };
}

function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockElement());
  return elements.get(sel);
}

let onReadyHandler = null;

globalThis.$w = Object.assign(
  (sel) => getEl(sel),
  { onReady: (fn) => { onReadyHandler = fn; } }
);

// ── Mock backend ────────────────────────────────────────────────────

const mockSubmitPhotoReview = vi.fn();

vi.mock('backend/photoReviews.web', () => ({
  submitPhotoReview: (...args) => mockSubmitPhotoReview(...args),
}));

// ── Mock public helpers ─────────────────────────────────────────────

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
}));

vi.mock('public/mobileHelpers', () => ({
  initBackToTop: vi.fn(),
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

// ── Mock wix-location-frontend ──────────────────────────────────────

let _query = { productId: 'prod-abc', productName: 'Eureka Futon Frame' };

vi.mock('wix-location-frontend', () => ({
  default: { get query() { return _query; } },
  get query() { return _query; },
}));

// ── Module under test ───────────────────────────────────────────────

beforeAll(async () => {
  await import('../src/pages/Submit Photo Review.js');
});

beforeEach(() => {
  elements.clear();
  vi.clearAllMocks();
  _query = { productId: 'prod-abc', productName: 'Eureka Futon Frame' };
  mockSubmitPhotoReview.mockResolvedValue({ success: true, id: 'rev-new-001' });
});

// ── Page init ───────────────────────────────────────────────────────

describe('page init', () => {
  it('calls onReady and registers handler', () => {
    expect(onReadyHandler).toBeTypeOf('function');
  });

  it('populates product name from query param on init', async () => {
    await onReadyHandler();
    expect(getEl('#productNameDisplay').text).toBe('Eureka Futon Frame');
  });

  it('shows validation section collapsed on init', async () => {
    await onReadyHandler();
    expect(getEl('#validationMessage').collapse).toHaveBeenCalled();
  });

  it('shows success section collapsed on init', async () => {
    await onReadyHandler();
    expect(getEl('#successSection').collapse).toHaveBeenCalled();
  });

  it('shows form section expanded on init', async () => {
    await onReadyHandler();
    expect(getEl('#submitFormSection').expand).toHaveBeenCalled();
  });

  it('disables submit button until a photo is uploaded', async () => {
    await onReadyHandler();
    expect(getEl('#submitBtn').disable).toHaveBeenCalled();
  });

  it('configures upload button for image file types', async () => {
    await onReadyHandler();
    expect(getEl('#photoUploadButton').fileType).toBe('Image');
  });

  it('tracks page_view on init', async () => {
    const { trackEvent } = await import('public/engagementTracker');
    await onReadyHandler();
    expect(trackEvent).toHaveBeenCalledWith('page_view', { page: 'photo-review-submit' });
  });

  it('handles missing productId gracefully (no crash)', async () => {
    _query = {};
    await expect(onReadyHandler()).resolves.not.toThrow();
  });
});

// ── File upload validation ──────────────────────────────────────────

describe('file upload', () => {
  async function triggerUpload(fileInfo) {
    await onReadyHandler();
    const onChangeHandler = getEl('#photoUploadButton').onChange.mock.calls[0]?.[0];
    if (onChangeHandler) await onChangeHandler({ target: { files: [fileInfo] } });
  }

  it('accepts jpg file and enables submit button', async () => {
    await triggerUpload({ name: 'photo.jpg', size: 1024 * 1024, type: 'image/jpeg' });
    expect(getEl('#submitBtn').enable).toHaveBeenCalled();
  });

  it('accepts png file and enables submit button', async () => {
    await triggerUpload({ name: 'photo.png', size: 500 * 1024, type: 'image/png' });
    expect(getEl('#submitBtn').enable).toHaveBeenCalled();
  });

  it('accepts webp file and enables submit button', async () => {
    await triggerUpload({ name: 'photo.webp', size: 200 * 1024, type: 'image/webp' });
    expect(getEl('#submitBtn').enable).toHaveBeenCalled();
  });

  it('rejects non-image file and shows error', async () => {
    await triggerUpload({ name: 'doc.pdf', size: 100 * 1024, type: 'application/pdf' });
    expect(getEl('#submitBtn').enable).not.toHaveBeenCalled();
    expect(getEl('#validationMessage').text).toMatch(/jpg.*png.*webp|image/i);
    expect(getEl('#validationMessage').expand).toHaveBeenCalled();
  });

  it('rejects file over 5MB and shows error', async () => {
    await triggerUpload({ name: 'huge.jpg', size: 6 * 1024 * 1024, type: 'image/jpeg' });
    expect(getEl('#submitBtn').enable).not.toHaveBeenCalled();
    expect(getEl('#validationMessage').text).toMatch(/5.?mb|too large/i);
    expect(getEl('#validationMessage').expand).toHaveBeenCalled();
  });

  it('accepts file exactly at 5MB limit', async () => {
    await triggerUpload({ name: 'exact.jpg', size: 5 * 1024 * 1024, type: 'image/jpeg' });
    expect(getEl('#submitBtn').enable).toHaveBeenCalled();
  });

  it('shows photo preview src after valid upload', async () => {
    await triggerUpload({ name: 'photo.jpg', size: 1 * 1024 * 1024, type: 'image/jpeg', url: 'wix:image://v1/abc.jpg' });
    expect(getEl('#photoPreview').src).toBeTruthy();
    expect(getEl('#photoPreview').expand).toHaveBeenCalled();
  });

  it('clears previous validation error on new valid upload', async () => {
    await triggerUpload({ name: 'bad.pdf', size: 1024, type: 'application/pdf' });
    await triggerUpload({ name: 'good.jpg', size: 1024, type: 'image/jpeg' });
    expect(getEl('#validationMessage').collapse).toHaveBeenCalled();
  });
});

// ── Form validation ─────────────────────────────────────────────────

describe('form validation on submit', () => {
  async function setup() {
    await onReadyHandler();
    // Simulate a valid upload to enable submit button
    const onChangeHandler = getEl('#photoUploadButton').onChange.mock.calls[0]?.[0];
    if (onChangeHandler) {
      await onChangeHandler({ target: { files: [{ name: 'photo.jpg', size: 1024 * 100, type: 'image/jpeg', url: 'wix:image://v1/abc.jpg' }] } });
    }
  }

  async function clickSubmit() {
    const submitHandler = getEl('#submitBtn').onClick.mock.calls[0]?.[0];
    if (submitHandler) await submitHandler();
  }

  it('shows validation error when reviewText is missing', async () => {
    await setup();
    getEl('#reviewTextInput').value = '';
    getEl('#ratingInput').value = 4;
    await clickSubmit();
    expect(getEl('#validationMessage').text).toMatch(/review text|required/i);
    expect(mockSubmitPhotoReview).not.toHaveBeenCalled();
  });

  it('shows validation error when reviewText is too short (< 10 chars)', async () => {
    await setup();
    getEl('#reviewTextInput').value = 'Too short';
    getEl('#ratingInput').value = 4;
    await clickSubmit();
    expect(getEl('#validationMessage').text).toMatch(/10 char|too short/i);
    expect(mockSubmitPhotoReview).not.toHaveBeenCalled();
  });

  it('accepts reviewText exactly 10 characters (boundary)', async () => {
    await setup();
    getEl('#reviewTextInput').value = '1234567890'; // exactly 10 chars
    getEl('#ratingInput').value = 4;
    await clickSubmit();
    expect(mockSubmitPhotoReview).toHaveBeenCalled();
  });

  it('shows validation error when no photo is uploaded', async () => {
    await onReadyHandler(); // no upload — _uploadedFile stays null
    getEl('#reviewTextInput').value = 'Great futon, love the quality!';
    getEl('#ratingInput').value = 5;
    const submitHandler = getEl('#submitBtn').onClick.mock.calls[0]?.[0];
    if (submitHandler) await submitHandler();
    expect(getEl('#validationMessage').text).toMatch(/photo|upload/i);
    expect(mockSubmitPhotoReview).not.toHaveBeenCalled();
  });

  it('shows validation error when rating is missing', async () => {
    await setup();
    getEl('#reviewTextInput').value = 'This futon is absolutely amazing quality!';
    getEl('#ratingInput').value = 0;
    await clickSubmit();
    expect(getEl('#validationMessage').text).toMatch(/rating|required/i);
    expect(mockSubmitPhotoReview).not.toHaveBeenCalled();
  });
});

// ── Submit flow ─────────────────────────────────────────────────────

describe('submit flow', () => {
  async function setupAndSubmit(overrides = {}) {
    await onReadyHandler();
    const onChangeHandler = getEl('#photoUploadButton').onChange.mock.calls[0]?.[0];
    if (onChangeHandler) {
      await onChangeHandler({ target: { files: [{ name: 'photo.jpg', size: 200 * 1024, type: 'image/jpeg', url: 'wix:image://v1/test.jpg' }] } });
    }
    getEl('#reviewTextInput').value = overrides.reviewText ?? 'Great futon, very comfortable and sturdy!';
    getEl('#ratingInput').value = overrides.rating ?? 5;
    getEl('#captionInput').value = overrides.caption ?? 'My living room setup';
    const submitHandler = getEl('#submitBtn').onClick.mock.calls[0]?.[0];
    if (submitHandler) await submitHandler();
  }

  it('calls submitPhotoReview with correct data', async () => {
    await setupAndSubmit();
    expect(mockSubmitPhotoReview).toHaveBeenCalledWith(expect.objectContaining({
      productId: 'prod-abc',
      reviewText: 'Great futon, very comfortable and sturdy!',
      rating: 5,
    }));
  });

  it('includes photoUrl in the submit call', async () => {
    await setupAndSubmit();
    expect(mockSubmitPhotoReview).toHaveBeenCalledWith(expect.objectContaining({
      photoUrl: expect.any(String),
    }));
  });

  it('includes caption in the submit call', async () => {
    await setupAndSubmit({ caption: 'My cozy corner' });
    expect(mockSubmitPhotoReview).toHaveBeenCalledWith(expect.objectContaining({
      photoCaption: 'My cozy corner',
    }));
  });

  it('shows success section and hides form on successful submit', async () => {
    await setupAndSubmit();
    expect(getEl('#successSection').expand).toHaveBeenCalled();
    expect(getEl('#submitFormSection').collapse).toHaveBeenCalled();
  });

  it('shows success message "Thanks! Your photo is in review."', async () => {
    await setupAndSubmit();
    expect(getEl('#successMessage').text).toMatch(/thanks.*photo.*review|photo.*in review/i);
  });

  it('calls submitPhotoReview once per submit', async () => {
    await setupAndSubmit();
    expect(mockSubmitPhotoReview).toHaveBeenCalledTimes(1);
  });

  it('disables submit button during inflight request', async () => {
    let resolveSubmit;
    mockSubmitPhotoReview.mockReturnValueOnce(new Promise(res => { resolveSubmit = res; }));
    await onReadyHandler();
    const onChangeHandler = getEl('#photoUploadButton').onChange.mock.calls[0]?.[0];
    if (onChangeHandler) await onChangeHandler({ target: { files: [{ name: 'photo.jpg', size: 1024, type: 'image/jpeg', url: 'wix:image://v1/x.jpg' }] } });
    getEl('#reviewTextInput').value = 'Great futon for the price!';
    getEl('#ratingInput').value = 4;
    const submitHandler = getEl('#submitBtn').onClick.mock.calls[0]?.[0];
    submitHandler(); // don't await — check mid-flight
    expect(getEl('#submitBtn').disable).toHaveBeenCalled();
    resolveSubmit({ success: true, id: 'rev-xyz' });
  });

  it('tracks photo_review_submit event on success', async () => {
    const { trackEvent } = await import('public/engagementTracker');
    await setupAndSubmit();
    expect(trackEvent).toHaveBeenCalledWith('photo_review_submit', expect.objectContaining({ productId: 'prod-abc' }));
  });
});

// ── Error states ────────────────────────────────────────────────────

describe('error states', () => {
  async function setupAndSubmit() {
    await onReadyHandler();
    const onChangeHandler = getEl('#photoUploadButton').onChange.mock.calls[0]?.[0];
    if (onChangeHandler) await onChangeHandler({ target: { files: [{ name: 'p.jpg', size: 1024, type: 'image/jpeg', url: 'wix:image://v1/p.jpg' }] } });
    getEl('#reviewTextInput').value = 'Solid quality futon, highly recommend it!';
    getEl('#ratingInput').value = 5;
    const submitHandler = getEl('#submitBtn').onClick.mock.calls[0]?.[0];
    if (submitHandler) await submitHandler();
  }

  it('shows error message on submitPhotoReview failure', async () => {
    mockSubmitPhotoReview.mockResolvedValueOnce({ success: false, error: 'Failed to submit photo review.' });
    await setupAndSubmit();
    expect(getEl('#validationMessage').text).toMatch(/failed|error|try again/i);
    expect(getEl('#validationMessage').expand).toHaveBeenCalled();
    expect(getEl('#successSection').expand).not.toHaveBeenCalled();
  });

  it('keeps form visible on submit failure', async () => {
    mockSubmitPhotoReview.mockResolvedValueOnce({ success: false, error: 'Server error' });
    await setupAndSubmit();
    expect(getEl('#submitFormSection').collapse).not.toHaveBeenCalled();
  });

  it('re-enables submit button after failure', async () => {
    mockSubmitPhotoReview.mockResolvedValueOnce({ success: false, error: 'Server error' });
    await setupAndSubmit();
    // After failure, enable should be called (restore button)
    expect(getEl('#submitBtn').enable).toHaveBeenCalled();
  });

  it('handles network error (thrown exception) gracefully', async () => {
    mockSubmitPhotoReview.mockRejectedValueOnce(new Error('Network timeout'));
    await setupAndSubmit();
    expect(getEl('#validationMessage').text).toMatch(/failed|error|try again/i);
    expect(getEl('#successSection').expand).not.toHaveBeenCalled();
  });
});
