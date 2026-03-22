/**
 * roomGallery.test.js
 *
 * Unit tests for src/public/RoomGallery.js
 *
 * Covers:
 *  - renderRoomPhotos: empty → section hidden / emptyState shown
 *  - renderRoomPhotos: photos → repeater.data populated, section expanded
 *  - onItemReady: image, caption, submitter, likeCount wired correctly
 *  - onItemReady: missing fields gracefully default to empty strings
 *  - initRoomFilter: filter tabs call onFilterChange with roomType/null
 *  - initRoomFilter: "All" tab passes null
 *  - Like button: calls voteForPhoto on click, updates count on success
 *  - Like button: backend failure logs error, does not throw
 *  - initRoomSubmitForm: submit with no upload shows error status
 *  - initRoomSubmitForm: submit with no caption shows error status
 *  - initRoomSubmitForm: submit with invalid roomType shows error status
 *  - initRoomSubmitForm: valid submit calls submitUGCPhoto, shows success
 *  - initRoomSubmitForm: submitUGCPhoto backend error shows error status
 *  - initRoomGallery: orchestrates render, filter, submit form
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('backend/ugcService.web', () => ({
  voteForPhoto: vi.fn().mockResolvedValue({ success: true, voted: true, voteCount: 5 }),
  submitUGCPhoto: vi.fn().mockResolvedValue({ success: true }),
  getApprovedPhotos: vi.fn().mockResolvedValue({ success: true, photos: [] }),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('backend/errorMonitoring.web', () => ({
  logError: vi.fn(),
}));

import {
  renderRoomPhotos,
  initRoomFilter,
  initRoomSubmitForm,
  initRoomGallery,
} from '../src/public/RoomGallery.js';
import { voteForPhoto, submitUGCPhoto, getApprovedPhotos } from 'backend/ugcService.web';
import { logError } from 'backend/errorMonitoring.web';
import { trackEvent } from 'public/engagementTracker';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePhoto(overrides = {}) {
  return {
    _id: 'photo-1',
    photoUrl: 'https://example.com/room.jpg',
    caption: 'My cozy living room',
    memberDisplayName: 'Jane',
    roomType: 'living-room',
    voteCount: 3,
    ...overrides,
  };
}

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', data: [],
    style: { backgroundColor: '', color: '', borderColor: '' },
    accessibility: { ariaLabel: '' },
    expand: vi.fn(), collapse: vi.fn(),
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    onClick: vi.fn(),
    onChange: vi.fn(),
    onItemReady: vi.fn(),
    disable: vi.fn(), enable: vi.fn(),
  };
}

function create$w() {
  const els = new Map();
  return (sel) => {
    if (!els.has(sel)) els.set(sel, createMockElement());
    return els.get(sel);
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('RoomGallery', () => {
  let $w;

  beforeEach(() => {
    vi.clearAllMocks();
    $w = create$w();
  });

  // ── renderRoomPhotos ────────────────────────────────────────────────

  describe('renderRoomPhotos', () => {
    it('collapses section and shows emptyState when photos is empty', () => {
      renderRoomPhotos($w, []);
      expect($w('#roomGallerySection').collapse).toHaveBeenCalled();
      expect($w('#roomGalleryEmptyState').expand).toHaveBeenCalled();
    });

    it('collapses section and shows emptyState when photos is null', () => {
      renderRoomPhotos($w, null);
      expect($w('#roomGallerySection').collapse).toHaveBeenCalled();
    });

    it('sets repeater.data to photos array', () => {
      const photos = [makePhoto({ _id: 'p1' }), makePhoto({ _id: 'p2' })];
      renderRoomPhotos($w, photos);
      expect($w('#roomGalleryRepeater').data).toEqual(photos);
    });

    it('expands section and collapses emptyState when photos present', () => {
      renderRoomPhotos($w, [makePhoto()]);
      expect($w('#roomGallerySection').expand).toHaveBeenCalled();
      expect($w('#roomGalleryEmptyState').collapse).toHaveBeenCalled();
    });

    it('registers onItemReady on the repeater', () => {
      renderRoomPhotos($w, [makePhoto()]);
      expect($w('#roomGalleryRepeater').onItemReady).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  // ── onItemReady ─────────────────────────────────────────────────────

  describe('onItemReady', () => {
    function getOnItemReadyCb(photos) {
      renderRoomPhotos($w, photos);
      return $w('#roomGalleryRepeater').onItemReady.mock.calls[0][0];
    }

    it('sets image src and alt from photoUrl and caption', () => {
      const photo = makePhoto({ photoUrl: 'https://example.com/room.jpg', caption: 'Nice room' });
      const cb = getOnItemReadyCb([photo]);
      const $item = create$w();
      cb($item, photo);
      expect($item('#roomGalleryImage').src).toBe('https://example.com/room.jpg');
      expect($item('#roomGalleryImage').alt).toBe('Nice room');
    });

    it('falls back to "Customer room photo" alt when caption is empty', () => {
      const photo = makePhoto({ caption: '' });
      const cb = getOnItemReadyCb([photo]);
      const $item = create$w();
      cb($item, photo);
      expect($item('#roomGalleryImage').alt).toBe('Customer room photo');
    });

    it('sets caption text', () => {
      const photo = makePhoto({ caption: 'My cozy space' });
      const cb = getOnItemReadyCb([photo]);
      const $item = create$w();
      cb($item, photo);
      expect($item('#roomGalleryCaption').text).toBe('My cozy space');
    });

    it('sets submitter name', () => {
      const photo = makePhoto({ memberDisplayName: 'Alex' });
      const cb = getOnItemReadyCb([photo]);
      const $item = create$w();
      cb($item, photo);
      expect($item('#roomGallerySubmitter').text).toBe('Alex');
    });

    it('sets like count text from voteCount', () => {
      const photo = makePhoto({ voteCount: 7 });
      const cb = getOnItemReadyCb([photo]);
      const $item = create$w();
      cb($item, photo);
      expect($item('#roomGalleryLikeCount').text).toBe('7');
    });

    it('defaults like count to 0 when voteCount is missing', () => {
      const photo = makePhoto({ voteCount: undefined });
      const cb = getOnItemReadyCb([photo]);
      const $item = create$w();
      cb($item, photo);
      expect($item('#roomGalleryLikeCount').text).toBe('0');
    });

    it('wires like button onClick', () => {
      const photo = makePhoto();
      const cb = getOnItemReadyCb([photo]);
      const $item = create$w();
      cb($item, photo);
      expect($item('#roomGalleryLikeBtn').onClick).toHaveBeenCalledWith(expect.any(Function));
    });

    it('sets aria-pressed to false on like button initially', () => {
      const photo = makePhoto();
      const cb = getOnItemReadyCb([photo]);
      const $item = create$w();
      cb($item, photo);
      expect($item('#roomGalleryLikeBtn').accessibility.ariaPressed).toBe(false);
    });

    it('sets aria-pressed to true after successful vote', async () => {
      voteForPhoto.mockResolvedValueOnce({ success: true, voted: true, voteCount: 4 });
      const photo = makePhoto();
      const cb = getOnItemReadyCb([photo]);
      const $item = create$w();
      cb($item, photo);
      const handler = $item('#roomGalleryLikeBtn').onClick.mock.calls[0][0];
      await handler();
      expect($item('#roomGalleryLikeBtn').accessibility.ariaPressed).toBe(true);
    });

    it('sets aria-pressed to false after toggle-off vote', async () => {
      voteForPhoto.mockResolvedValueOnce({ success: true, voted: false, voteCount: 2 });
      const photo = makePhoto();
      const cb = getOnItemReadyCb([photo]);
      const $item = create$w();
      cb($item, photo);
      const handler = $item('#roomGalleryLikeBtn').onClick.mock.calls[0][0];
      await handler();
      expect($item('#roomGalleryLikeBtn').accessibility.ariaPressed).toBe(false);
    });

    it('like button click calls voteForPhoto with photoId', async () => {
      const photo = makePhoto({ _id: 'photo-abc' });
      const cb = getOnItemReadyCb([photo]);
      const $item = create$w();
      cb($item, photo);
      const handler = $item('#roomGalleryLikeBtn').onClick.mock.calls[0][0];
      await handler();
      expect(voteForPhoto).toHaveBeenCalledWith('photo-abc');
    });

    it('like button updates count on successful vote', async () => {
      voteForPhoto.mockResolvedValueOnce({ success: true, voted: true, voteCount: 8 });
      const photo = makePhoto({ _id: 'photo-abc' });
      const cb = getOnItemReadyCb([photo]);
      const $item = create$w();
      cb($item, photo);
      const handler = $item('#roomGalleryLikeBtn').onClick.mock.calls[0][0];
      await handler();
      expect($item('#roomGalleryLikeCount').text).toBe('8');
    });

    it('like button logs error and does not throw on backend failure', async () => {
      voteForPhoto.mockRejectedValueOnce(new Error('Network error'));
      const photo = makePhoto({ _id: 'photo-xyz', voteCount: 3 });
      const cb = getOnItemReadyCb([photo]);
      const $item = create$w();
      cb($item, photo);
      const handler = $item('#roomGalleryLikeBtn').onClick.mock.calls[0][0];
      await expect(handler()).resolves.not.toThrow();
      expect(logError).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('[RoomGallery]') })
      );
    });

    it('like button reverts count to original on backend failure', async () => {
      voteForPhoto.mockRejectedValueOnce(new Error('Network error'));
      const photo = makePhoto({ _id: 'photo-xyz', voteCount: 3 });
      const cb = getOnItemReadyCb([photo]);
      const $item = create$w();
      cb($item, photo);
      const handler = $item('#roomGalleryLikeBtn').onClick.mock.calls[0][0];
      await handler();
      expect($item('#roomGalleryLikeCount').text).toBe('3');
    });
  });

  // ── initRoomFilter ──────────────────────────────────────────────────

  describe('initRoomFilter', () => {
    it('wires click handlers on all filter tab elements', () => {
      const onFilter = vi.fn();
      initRoomFilter($w, onFilter);
      // At minimum: All + 5 room types = 6 tabs
      const tabIds = ['#roomFilterAll', '#roomFilterLivingRoom', '#roomFilterBedroom',
        '#roomFilterOffice', '#roomFilterDorm', '#roomFilterPorch'];
      for (const id of tabIds) {
        expect($w(id).onClick).toHaveBeenCalled();
      }
    });

    it('"All" tab click passes null to onFilterChange', () => {
      const onFilter = vi.fn();
      initRoomFilter($w, onFilter);
      const handler = $w('#roomFilterAll').onClick.mock.calls[0][0];
      handler();
      expect(onFilter).toHaveBeenCalledWith(null);
    });

    it('"Living Room" tab click passes "living-room" to onFilterChange', () => {
      const onFilter = vi.fn();
      initRoomFilter($w, onFilter);
      const handler = $w('#roomFilterLivingRoom').onClick.mock.calls[0][0];
      handler();
      expect(onFilter).toHaveBeenCalledWith('living-room');
    });

    it('"Bedroom" tab click passes "bedroom" to onFilterChange', () => {
      const onFilter = vi.fn();
      initRoomFilter($w, onFilter);
      const handler = $w('#roomFilterBedroom').onClick.mock.calls[0][0];
      handler();
      expect(onFilter).toHaveBeenCalledWith('bedroom');
    });

    it('does not throw if onFilterChange is not a function', () => {
      expect(() => initRoomFilter($w, null)).not.toThrow();
    });
  });

  // ── initRoomSubmitForm ──────────────────────────────────────────────

  describe('initRoomSubmitForm', () => {
    function getSubmitHandler() {
      initRoomSubmitForm($w);
      return $w('#roomSubmitBtn').onClick.mock.calls[0][0];
    }

    beforeEach(() => {
      // Default: valid form state
      $w('#roomPhotoUpload').value = 'wix:image://v1/abc123.jpg/photo.jpg#originWidth=800&originHeight=600';
      $w('#roomCaptionInput').value = 'My cozy setup';
      $w('#roomRoomTypeDropdown').value = 'bedroom';
    });

    it('wires onClick on submit button', () => {
      initRoomSubmitForm($w);
      expect($w('#roomSubmitBtn').onClick).toHaveBeenCalledWith(expect.any(Function));
    });

    it('shows error status when photo upload is empty', async () => {
      $w('#roomPhotoUpload').value = '';
      const handler = getSubmitHandler();
      await handler();
      expect($w('#roomSubmitStatus').text).toMatch(/photo/i);
      expect(submitUGCPhoto).not.toHaveBeenCalled();
    });

    it('shows error status when caption is empty', async () => {
      $w('#roomCaptionInput').value = '';
      const handler = getSubmitHandler();
      await handler();
      expect($w('#roomSubmitStatus').text).toMatch(/caption/i);
      expect(submitUGCPhoto).not.toHaveBeenCalled();
    });

    it('shows error status when room type is not selected', async () => {
      $w('#roomRoomTypeDropdown').value = '';
      const handler = getSubmitHandler();
      await handler();
      expect($w('#roomSubmitStatus').text).toMatch(/room type/i);
      expect(submitUGCPhoto).not.toHaveBeenCalled();
    });

    it('calls submitUGCPhoto with correct fields on valid submit', async () => {
      const handler = getSubmitHandler();
      await handler();
      expect(submitUGCPhoto).toHaveBeenCalledWith({
        photoUrl: $w('#roomPhotoUpload').value,
        caption: 'My cozy setup',
        roomType: 'bedroom',
      });
    });

    it('shows success status after successful submit', async () => {
      submitUGCPhoto.mockResolvedValueOnce({ success: true });
      const handler = getSubmitHandler();
      await handler();
      expect($w('#roomSubmitStatus').text).toMatch(/thank|success|submitted/i);
    });

    it('shows error status when submitUGCPhoto returns success:false', async () => {
      submitUGCPhoto.mockResolvedValueOnce({ success: false, error: 'Invalid photo' });
      const handler = getSubmitHandler();
      await handler();
      expect($w('#roomSubmitStatus').text).toMatch(/invalid photo/i);
    });

    it('shows error status and logs on submitUGCPhoto throw', async () => {
      submitUGCPhoto.mockRejectedValueOnce(new Error('Server down'));
      const handler = getSubmitHandler();
      await expect(handler()).resolves.not.toThrow();
      expect($w('#roomSubmitStatus').text).toMatch(/error|failed/i);
      expect(logError).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('[RoomGallery]') })
      );
    });

    it('disables submit button during submission and re-enables on completion', async () => {
      let resolveSubmit;
      submitUGCPhoto.mockImplementationOnce(() => new Promise(r => { resolveSubmit = r; }));
      initRoomSubmitForm($w);
      const handler = $w('#roomSubmitBtn').onClick.mock.calls[0][0];
      const promise = handler();
      expect($w('#roomSubmitBtn').disable).toHaveBeenCalled();
      resolveSubmit({ success: true });
      await promise;
      expect($w('#roomSubmitBtn').enable).toHaveBeenCalled();
    });
  });

  // ── initRoomGallery ─────────────────────────────────────────────────

  describe('initRoomGallery', () => {
    it('renders photos passed via opts.photos', () => {
      const photos = [makePhoto({ _id: 'p1' }), makePhoto({ _id: 'p2' })];
      initRoomGallery($w, { photos });
      expect($w('#roomGalleryRepeater').data).toEqual(photos);
    });

    it('initializes filter tabs', () => {
      initRoomGallery($w, { photos: [makePhoto()] });
      expect($w('#roomFilterAll').onClick).toHaveBeenCalled();
    });

    it('initializes submit form', () => {
      initRoomGallery($w, { photos: [] });
      expect($w('#roomSubmitBtn').onClick).toHaveBeenCalled();
    });

    it('handles empty photos gracefully', () => {
      expect(() => initRoomGallery($w, {})).not.toThrow();
    });

    it('does not throw when opts is omitted', () => {
      expect(() => initRoomGallery($w)).not.toThrow();
    });

    it('filter tab click re-queries getApprovedPhotos with roomType', async () => {
      const filtered = [makePhoto({ _id: 'p-filtered', roomType: 'bedroom' })];
      getApprovedPhotos.mockResolvedValueOnce({ success: true, photos: filtered });
      initRoomGallery($w, { photos: [] });
      const handler = $w('#roomFilterBedroom').onClick.mock.calls[0][0];
      await handler();
      expect(getApprovedPhotos).toHaveBeenCalledWith({ roomType: 'bedroom' });
      expect($w('#roomGalleryRepeater').data).toEqual(filtered);
    });

    it('"All" filter tab re-queries without roomType filter', async () => {
      getApprovedPhotos.mockResolvedValueOnce({ success: true, photos: [] });
      initRoomGallery($w, { photos: [] });
      const handler = $w('#roomFilterAll').onClick.mock.calls[0][0];
      await handler();
      expect(getApprovedPhotos).toHaveBeenCalledWith({});
    });

    it('filter callback logs error on getApprovedPhotos failure', async () => {
      getApprovedPhotos.mockRejectedValueOnce(new Error('Network error'));
      initRoomGallery($w, { photos: [] });
      const handler = $w('#roomFilterBedroom').onClick.mock.calls[0][0];
      await expect(handler()).resolves.not.toThrow();
      expect(logError).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('[RoomGallery]') })
      );
    });
  });
});
