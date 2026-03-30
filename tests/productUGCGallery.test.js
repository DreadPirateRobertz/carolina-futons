/**
 * Tests for src/public/ProductUGCGallery.js and the getProductUGCPhotos
 * backend function in src/backend/ugcService.web.js.
 *
 * CF-rw9i.2
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── $w mock ───────────────────────────────────────────────────────────

const elements = new Map();

function createEl(id) {
  return {
    id,
    text: '',
    src: '',
    _expanded: true,
    data: [],
    _itemReadyCb: null,
    _clickHandler: null,
    expand:      vi.fn(function () { this._expanded = true;  return Promise.resolve(); }),
    collapse:    vi.fn(function () { this._expanded = false; return Promise.resolve(); }),
    onClick:     vi.fn(function (fn) { this._clickHandler = fn; }),
    onItemReady: vi.fn(function (cb) { this._itemReadyCb = cb; }),
    _triggerItemReady(items) {
      if (!this._itemReadyCb) return;
      for (const item of items) {
        const $item = (sel) => getEl(`${sel}_${item._id}`);
        this._itemReadyCb($item, item);
      }
    },
  };
}

function getEl(sel) {
  const key = sel.replace(/^#/, '');
  if (!elements.has(key)) elements.set(key, createEl(key));
  return elements.get(key);
}

globalThis.$w = Object.assign((sel) => getEl(sel), { onReady: () => {} });

// ── Backend mocks ─────────────────────────────────────────────────────


// ── Gallery module mock ───────────────────────────────────────────────

const mockGetProductUGCPhotos = vi.fn();

vi.mock('backend/ugcService.web', () => ({
  getProductUGCPhotos: (...a) => mockGetProductUGCPhotos(...a),
}));

// ── Dynamic import (page module needs $w defined first) ───────────────

const { initProductUGCGallery } = await import('../src/public/ProductUGCGallery.js');

// ── Fixtures ──────────────────────────────────────────────────────────

function makePhoto(overrides = {}) {
  return {
    _id: 'ph-1',
    photoUrl: 'wix:image://abc.jpg',
    caption: 'Our living room setup!',
    productId: 'prod-1',
    status: 'approved',
    voteCount: 3,
    submittedAt: '2026-03-01',
    ...overrides,
  };
}

const STATE = { product: { _id: 'prod-1', name: 'Canby Futon' } };

beforeEach(() => {
  elements.clear();
  vi.clearAllMocks();
});

// ── initProductUGCGallery (widget tests) ──────────────────────────────

describe('initProductUGCGallery', () => {
  it('collapses section when no photos', async () => {
    mockGetProductUGCPhotos.mockResolvedValue({ success: true, photos: [], totalCount: 0 });

    await initProductUGCGallery($w, STATE);

    expect(getEl('#pdpUGCSection')._expanded).toBe(false);
  });

  it('expands section and sets count text when photos present', async () => {
    mockGetProductUGCPhotos.mockResolvedValue({
      success: true,
      photos: [makePhoto(), makePhoto({ _id: 'ph-2' })],
      totalCount: 2,
    });

    await initProductUGCGallery($w, STATE);

    expect(getEl('#pdpUGCSection')._expanded).toBe(true);
    expect(getEl('#pdpUGCCount').text).toBe('2 rooms using this');
  });

  it('uses singular "room" for count of 1', async () => {
    mockGetProductUGCPhotos.mockResolvedValue({
      success: true,
      photos: [makePhoto()],
      totalCount: 1,
    });

    await initProductUGCGallery($w, STATE);

    expect(getEl('#pdpUGCCount').text).toBe('1 room using this');
  });

  it('calls getProductUGCPhotos with product ID', async () => {
    mockGetProductUGCPhotos.mockResolvedValue({ success: true, photos: [], totalCount: 0 });

    await initProductUGCGallery($w, STATE);

    expect(mockGetProductUGCPhotos).toHaveBeenCalledWith('prod-1', { limit: 20, sort: 'recent' });
  });

  it('populates repeater items with photo and caption', async () => {
    const photo = makePhoto({ caption: 'Cozy setup' });
    mockGetProductUGCPhotos.mockResolvedValue({ success: true, photos: [photo], totalCount: 1 });

    await initProductUGCGallery($w, STATE);

    const repeater = getEl('#pdpUGCRepeater');
    repeater._triggerItemReady([photo]);

    expect(getEl('#ugcPhoto_ph-1').src).toBe('wix:image://abc.jpg');
    expect(getEl('#ugcCaption_ph-1').text).toBe('Cozy setup');
  });

  it('truncates long captions to 80 chars', async () => {
    const longCaption = 'A'.repeat(100);
    const photo = makePhoto({ caption: longCaption });
    mockGetProductUGCPhotos.mockResolvedValue({ success: true, photos: [photo], totalCount: 1 });

    await initProductUGCGallery($w, STATE);

    const repeater = getEl('#pdpUGCRepeater');
    repeater._triggerItemReady([photo]);

    expect(getEl('#ugcCaption_ph-1').text).toHaveLength(80);
  });

  it('does nothing when state has no product', async () => {
    await initProductUGCGallery($w, { product: null });
    expect(mockGetProductUGCPhotos).not.toHaveBeenCalled();
  });

  it('collapses section on backend failure', async () => {
    mockGetProductUGCPhotos.mockResolvedValue({ success: false, error: 'DB error', photos: [], totalCount: 0 });

    await initProductUGCGallery($w, STATE);

    expect(getEl('#pdpUGCSection')._expanded).toBe(false);
  });

  it('collapses section on unexpected throw', async () => {
    mockGetProductUGCPhotos.mockRejectedValue(new Error('Network error'));

    await initProductUGCGallery($w, STATE);

    expect(getEl('#pdpUGCSection')._expanded).toBe(false);
  });

  it('opens lightbox when photo is clicked', async () => {
    const photo = makePhoto({ caption: 'Great room!' });
    mockGetProductUGCPhotos.mockResolvedValue({ success: true, photos: [photo], totalCount: 1 });

    await initProductUGCGallery($w, STATE);

    const repeater = getEl('#pdpUGCRepeater');
    repeater._triggerItemReady([photo]);

    // Click the photo element
    const photoEl = getEl('#ugcPhoto_ph-1');
    expect(photoEl._clickHandler).toBeTruthy();
    photoEl._clickHandler();

    expect(getEl('#pdpUGCLightbox')._expanded).toBe(true);
    expect(getEl('#pdpUGCLightboxPhoto').src).toBe('wix:image://abc.jpg');
    expect(getEl('#pdpUGCLightboxCaption').text).toBe('Great room!');
  });

  it('closes lightbox on close button click', async () => {
    const photo = makePhoto();
    mockGetProductUGCPhotos.mockResolvedValue({ success: true, photos: [photo], totalCount: 1 });

    await initProductUGCGallery($w, STATE);

    // Open the lightbox
    const repeater = getEl('#pdpUGCRepeater');
    repeater._triggerItemReady([photo]);
    getEl('#ugcPhoto_ph-1')._clickHandler?.();

    // Now close it
    const closeBtn = getEl('#pdpUGCLightboxClose');
    expect(closeBtn._clickHandler).toBeTruthy();
    closeBtn._clickHandler();

    expect(getEl('#pdpUGCLightbox')._expanded).toBe(false);
  });
});
