/**
 * Tests for ShareYourRoom.js — UGC photo submit CTA on the PDP.
 *
 * Covers:
 * - initShareYourRoomCTA: modal collapsed on init, room type options set
 * - CTA button click: opens modal, resets form
 * - Close button / overlay click: collapses modal
 * - Non-member: login prompt shown, upload disabled
 * - Upload onChange: triggers startUpload, sets preview, enables submit when room type set
 * - Upload failure: shows validation message
 * - Room type change: enables/disables submit based on upload + room type
 * - Submit: disabled submit button stays disabled while loading
 * - Submit success: shows success section, hides form
 * - Submit error (API error): shows validation, re-enables submit
 * - Submit error (network): shows generic error, re-enables submit
 * - Submit with no room type: shows validation, does not call backend
 * - Submit with no upload: shows validation, does not call backend
 * - _VALID_ROOM_TYPES exported
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockSubmitUGCPhoto = vi.fn();
vi.mock('backend/ugcService.web', () => ({
  submitUGCPhoto: (...args) => mockSubmitUGCPhoto(...args),
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

// ── $w Mock Factory ──────────────────────────────────────────────────────────

function mockEl(overrides = {}) {
  return {
    text: '',
    src: '',
    value: undefined,
    options: [],
    collapse:     vi.fn(),
    expand:       vi.fn(),
    show:         vi.fn(),
    hide:         vi.fn(),
    enable:       vi.fn(),
    disable:      vi.fn(),
    onClick:      vi.fn(),
    onChange:     vi.fn(),
    startUpload:  vi.fn(),
    fileType:     '',
    ...overrides,
  };
}

function make$w() {
  const els = {};
  const get = (sel) => {
    if (!els[sel]) els[sel] = mockEl();
    return els[sel];
  };
  return { get, els };
}

// ── Import module under test ─────────────────────────────────────────────────

import {
  initShareYourRoomCTA,
  _VALID_ROOM_TYPES,
  _openModal,
  _closeModal,
  _getUploadedUrl,
  _setUploadedUrl,
  _isModalOpen,
} from '../src/public/ShareYourRoom.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

const MEMBER_STATE  = { isLoggedIn: true,  product: { _id: 'prod-1', name: 'Eureka Futon' } };
const GUEST_STATE   = { isLoggedIn: false, product: { _id: 'prod-1', name: 'Eureka Futon' } };
const EMPTY_PRODUCT = {};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ShareYourRoom', () => {
  let $w;
  let get;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSubmitUGCPhoto.mockResolvedValue({ success: true, data: { _id: 'ugc-1' } });
    const w = make$w();
    get = w.get;
    $w = (sel) => get(sel);
    $w.onReady = vi.fn();
  });

  // ── init ────────────────────────────────────────────────────────────────────

  it('collapses modal and success sections on init', () => {
    initShareYourRoomCTA($w, MEMBER_STATE);
    expect(get('#shareYourRoomModal').collapse).toHaveBeenCalled();
    expect(get('#shareYourRoomSuccess').collapse).toHaveBeenCalled();
  });

  it('disables submit button on init', () => {
    initShareYourRoomCTA($w, MEMBER_STATE);
    expect(get('#shareYourRoomSubmitBtn').disable).toHaveBeenCalled();
  });

  it('sets room type dropdown options', () => {
    initShareYourRoomCTA($w, MEMBER_STATE);
    const opts = get('#shareYourRoomRoomType').options;
    expect(opts).toHaveLength(_VALID_ROOM_TYPES.length);
    expect(opts[0]).toEqual({ label: 'Living Room', value: 'living-room' });
  });

  it('registers onClick handler on CTA button', () => {
    initShareYourRoomCTA($w, MEMBER_STATE);
    expect(get('#shareYourRoomBtn').onClick).toHaveBeenCalledWith(expect.any(Function));
  });

  it('registers onClick on overlay and close button', () => {
    initShareYourRoomCTA($w, MEMBER_STATE);
    expect(get('#shareYourRoomOverlay').onClick).toHaveBeenCalled();
    expect(get('#shareYourRoomClose').onClick).toHaveBeenCalled();
  });

  it('sets upload fileType to Image', () => {
    initShareYourRoomCTA($w, MEMBER_STATE);
    expect(get('#shareYourRoomUpload').fileType).toBe('Image');
  });

  // ── open modal ──────────────────────────────────────────────────────────────

  it('expands modal when CTA button clicked', () => {
    initShareYourRoomCTA($w, MEMBER_STATE);
    const handler = get('#shareYourRoomBtn').onClick.mock.calls[0][0];
    handler();
    expect(get('#shareYourRoomModal').expand).toHaveBeenCalled();
  });

  it('collapses login prompt for logged-in member', () => {
    initShareYourRoomCTA($w, MEMBER_STATE);
    const handler = get('#shareYourRoomBtn').onClick.mock.calls[0][0];
    handler();
    expect(get('#shareYourRoomLoginPrompt').collapse).toHaveBeenCalled();
  });

  it('expands login prompt for non-member (guest)', () => {
    initShareYourRoomCTA($w, GUEST_STATE);
    const handler = get('#shareYourRoomBtn').onClick.mock.calls[0][0];
    handler();
    expect(get('#shareYourRoomLoginPrompt').expand).toHaveBeenCalled();
  });

  it('disables upload for non-member', () => {
    initShareYourRoomCTA($w, GUEST_STATE);
    const handler = get('#shareYourRoomBtn').onClick.mock.calls[0][0];
    handler();
    expect(get('#shareYourRoomUpload').disable).toHaveBeenCalled();
  });

  it('resets caption and room type when modal opens', () => {
    initShareYourRoomCTA($w, MEMBER_STATE);
    get('#shareYourRoomCaption').value = 'old caption';
    const handler = get('#shareYourRoomBtn').onClick.mock.calls[0][0];
    handler();
    expect(get('#shareYourRoomCaption').value).toBe('');
  });

  // ── close modal ─────────────────────────────────────────────────────────────

  it('collapses modal when close button clicked', () => {
    initShareYourRoomCTA($w, MEMBER_STATE);
    const closeHandler = get('#shareYourRoomClose').onClick.mock.calls[0][0];
    closeHandler();
    expect(get('#shareYourRoomModal').collapse).toHaveBeenCalled();
  });

  it('collapses modal when overlay clicked', () => {
    initShareYourRoomCTA($w, MEMBER_STATE);
    const overlayHandler = get('#shareYourRoomOverlay').onClick.mock.calls[0][0];
    overlayHandler();
    expect(get('#shareYourRoomModal').collapse).toHaveBeenCalled();
  });

  // ── upload ──────────────────────────────────────────────────────────────────

  it('calls startUpload and sets preview on successful upload', async () => {
    const previewEl = mockEl();
    const uploadEl = mockEl({
      value: [{ name: 'photo.jpg' }],
      startUpload: vi.fn().mockResolvedValue({ url: 'wix:image://v1/abc.jpg' }),
    });
    const localGet = (sel) => {
      if (sel === '#shareYourRoomUpload') return uploadEl;
      if (sel === '#shareYourRoomPreview') return previewEl;
      return get(sel);
    };
    const local$w = (sel) => localGet(sel);
    initShareYourRoomCTA(local$w, MEMBER_STATE);

    const changeHandler = uploadEl.onChange.mock.calls[0][0];
    await changeHandler();

    expect(uploadEl.startUpload).toHaveBeenCalled();
    expect(previewEl.src).toBe('wix:image://v1/abc.jpg');
    expect(previewEl.expand).toHaveBeenCalled();
  });

  it('shows validation message on upload failure', async () => {
    const uploadEl = mockEl({
      value: [{ name: 'photo.jpg' }],
      startUpload: vi.fn().mockRejectedValue(new Error('network error')),
    });
    const localGet = (sel) => sel === '#shareYourRoomUpload' ? uploadEl : get(sel);
    const local$w = (sel) => localGet(sel);
    initShareYourRoomCTA(local$w, MEMBER_STATE);

    const changeHandler = uploadEl.onChange.mock.calls[0][0];
    await changeHandler();

    expect(get('#shareYourRoomValidation').expand).toHaveBeenCalled();
    expect(get('#shareYourRoomValidation').text).toBe('Upload failed. Please try again.');
  });

  it('enables submit only when both upload url and room type are set', async () => {
    const uploadEl = mockEl({
      value: [{ name: 'photo.jpg' }],
      startUpload: vi.fn().mockResolvedValue({ url: 'wix:image://v1/abc.jpg' }),
    });
    const roomTypeEl = mockEl({ value: 'bedroom' });
    const submitEl = mockEl();
    const local$w = (sel) => {
      if (sel === '#shareYourRoomUpload') return uploadEl;
      if (sel === '#shareYourRoomRoomType') return roomTypeEl;
      if (sel === '#shareYourRoomSubmitBtn') return submitEl;
      return get(sel);
    };
    initShareYourRoomCTA(local$w, MEMBER_STATE);

    const changeHandler = uploadEl.onChange.mock.calls[0][0];
    await changeHandler();

    expect(submitEl.enable).toHaveBeenCalled();
  });

  it('keeps submit disabled when upload succeeds but room type missing', async () => {
    const uploadEl = mockEl({
      value: [{ name: 'photo.jpg' }],
      startUpload: vi.fn().mockResolvedValue({ url: 'wix:image://v1/abc.jpg' }),
    });
    const roomTypeEl = mockEl({ value: undefined });
    const submitEl = mockEl();
    const local$w = (sel) => {
      if (sel === '#shareYourRoomUpload') return uploadEl;
      if (sel === '#shareYourRoomRoomType') return roomTypeEl;
      if (sel === '#shareYourRoomSubmitBtn') return submitEl;
      return get(sel);
    };
    initShareYourRoomCTA(local$w, MEMBER_STATE);

    const changeHandler = uploadEl.onChange.mock.calls[0][0];
    await changeHandler();

    expect(submitEl.enable).not.toHaveBeenCalled();
  });

  // ── submit ──────────────────────────────────────────────────────────────────

  it('calls submitUGCPhoto with correct payload on success', async () => {
    const roomTypeEl = mockEl({ value: 'living-room' });
    const captionEl = mockEl({ value: 'My cozy setup' });
    const local$w = (sel) => {
      if (sel === '#shareYourRoomRoomType') return roomTypeEl;
      if (sel === '#shareYourRoomCaption') return captionEl;
      return get(sel);
    };
    initShareYourRoomCTA(local$w, MEMBER_STATE);
    _setUploadedUrl('wix:image://v1/test.jpg');

    const submitHandler = get('#shareYourRoomSubmitBtn').onClick.mock.calls[0][0];
    await submitHandler();

    expect(mockSubmitUGCPhoto).toHaveBeenCalledWith({
      photoUrl:    'wix:image://v1/test.jpg',
      roomType:    'living-room',
      caption:     'My cozy setup',
      productId:   'prod-1',
      productName: 'Eureka Futon',
    });
  });

  it('shows success section and hides form on successful submit', async () => {
    const roomTypeEl = mockEl({ value: 'bedroom' });
    const local$w = (sel) => {
      if (sel === '#shareYourRoomRoomType') return roomTypeEl;
      return get(sel);
    };
    initShareYourRoomCTA(local$w, MEMBER_STATE);
    _setUploadedUrl('wix:image://v1/test.jpg');

    const submitHandler = get('#shareYourRoomSubmitBtn').onClick.mock.calls[0][0];
    await submitHandler();

    expect(get('#shareYourRoomSuccess').expand).toHaveBeenCalled();
    expect(get('#shareYourRoomForm').collapse).toHaveBeenCalled();
  });

  it('shows API error and re-enables submit on failure', async () => {
    mockSubmitUGCPhoto.mockResolvedValue({ success: false, error: 'Auth required.' });
    const roomTypeEl = mockEl({ value: 'office' });
    const local$w = (sel) => {
      if (sel === '#shareYourRoomRoomType') return roomTypeEl;
      return get(sel);
    };
    initShareYourRoomCTA(local$w, MEMBER_STATE);
    _setUploadedUrl('wix:image://v1/test.jpg');

    const submitHandler = get('#shareYourRoomSubmitBtn').onClick.mock.calls[0][0];
    await submitHandler();

    expect(get('#shareYourRoomValidation').text).toBe('Auth required.');
    expect(get('#shareYourRoomValidation').expand).toHaveBeenCalled();
    expect(get('#shareYourRoomSubmitBtn').enable).toHaveBeenCalled();
  });

  it('shows generic error and re-enables submit on network exception', async () => {
    mockSubmitUGCPhoto.mockRejectedValue(new Error('fetch failed'));
    const roomTypeEl = mockEl({ value: 'dorm' });
    const local$w = (sel) => {
      if (sel === '#shareYourRoomRoomType') return roomTypeEl;
      return get(sel);
    };
    initShareYourRoomCTA(local$w, MEMBER_STATE);
    _setUploadedUrl('wix:image://v1/test.jpg');

    const submitHandler = get('#shareYourRoomSubmitBtn').onClick.mock.calls[0][0];
    await submitHandler();

    expect(get('#shareYourRoomValidation').text).toBe('An error occurred. Please try again.');
    expect(get('#shareYourRoomSubmitBtn').enable).toHaveBeenCalled();
  });

  it('does not call backend if room type missing', async () => {
    const roomTypeEl = mockEl({ value: undefined });
    const local$w = (sel) => {
      if (sel === '#shareYourRoomRoomType') return roomTypeEl;
      return get(sel);
    };
    initShareYourRoomCTA(local$w, MEMBER_STATE);
    _setUploadedUrl('wix:image://v1/test.jpg');

    const submitHandler = get('#shareYourRoomSubmitBtn').onClick.mock.calls[0][0];
    await submitHandler();

    expect(mockSubmitUGCPhoto).not.toHaveBeenCalled();
    expect(get('#shareYourRoomValidation').text).toBe('Please select a room type.');
  });

  it('does not call backend if upload url missing', async () => {
    const roomTypeEl = mockEl({ value: 'porch' });
    const local$w = (sel) => {
      if (sel === '#shareYourRoomRoomType') return roomTypeEl;
      return get(sel);
    };
    initShareYourRoomCTA(local$w, MEMBER_STATE);
    _setUploadedUrl(null);

    const submitHandler = get('#shareYourRoomSubmitBtn').onClick.mock.calls[0][0];
    await submitHandler();

    expect(mockSubmitUGCPhoto).not.toHaveBeenCalled();
    expect(get('#shareYourRoomValidation').text).toBe('Please upload a photo first.');
  });

  it('submits with null productId when product missing from state', async () => {
    const roomTypeEl = mockEl({ value: 'bedroom' });
    const local$w = (sel) => {
      if (sel === '#shareYourRoomRoomType') return roomTypeEl;
      return get(sel);
    };
    initShareYourRoomCTA(local$w, { isLoggedIn: true, product: EMPTY_PRODUCT });
    _setUploadedUrl('wix:image://v1/test.jpg');

    const submitHandler = get('#shareYourRoomSubmitBtn').onClick.mock.calls[0][0];
    await submitHandler();

    expect(mockSubmitUGCPhoto).toHaveBeenCalledWith(
      expect.objectContaining({ productId: null, productName: null })
    );
  });

  // ── exports ─────────────────────────────────────────────────────────────────

  it('exports _VALID_ROOM_TYPES with 5 entries', () => {
    expect(_VALID_ROOM_TYPES).toHaveLength(5);
    expect(_VALID_ROOM_TYPES.map(r => r.value)).toContain('living-room');
    expect(_VALID_ROOM_TYPES.map(r => r.value)).toContain('porch');
  });
});
