import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// ── $w mock ──────────────────────────────────────────────────────────────────
const elements = new Map();

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '',
    options: [], data: [],
    style: { color: '', fontWeight: '' },
    accessibility: {},
    hidden: false, collapsed: false,
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(function () { this.collapsed = true; }),
    expand: vi.fn(function () { this.collapsed = false; }),
    scrollTo: vi.fn(), postMessage: vi.fn(),
    onClick: vi.fn(), onChange: vi.fn(), onInput: vi.fn(),
    onItemReady: vi.fn(), onItemClicked: vi.fn(),
    onKeyPress: vi.fn(),
    onReady: vi.fn(() => Promise.resolve()),
    focus: vi.fn(),
    disable: vi.fn(), enable: vi.fn(),
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

// ── Mocks ────────────────────────────────────────────────────────────────────
vi.mock('backend/ugcService.web', () => ({
  getApprovedPhotos: vi.fn(async () => ({
    success: true,
    photos: [{ _id: 'p1', imageUrl: 'https://cdn/photo1.jpg', roomType: 'living-room', submittedBy: 'John' }],
  })),
  getBeforeAfterPairs: vi.fn(async () => ({
    success: true,
    pairs: [{ before: { _id: 'b1', imageUrl: 'before.jpg' }, after: { _id: 'a1', imageUrl: 'after.jpg' } }],
  })),
  getUGCStats: vi.fn(async () => ({
    success: true,
    stats: { total: 42, featured: 5 },
  })),
}));

vi.mock('public/UGCGallery.js', () => ({
  initUGCGallery: vi.fn(),
  renderPhotoCards: vi.fn(),
  buildBeforeAfterSlider: vi.fn(),
  mapPhotoForDisplay: vi.fn((p) => p),
}));

vi.mock('public/ugcVoting.js', () => ({
  initVoting: vi.fn(),
  handleVoteClick: vi.fn(),
  isVotedByUser: vi.fn(),
  getVotedPhotoIds: vi.fn(),
}));

vi.mock('public/mobileHelpers', () => ({
  isMobile: vi.fn(() => false),
  collapseOnMobile: vi.fn(),
  initBackToTop: vi.fn(),
  limitForViewport: vi.fn(() => 24),
  onViewportChange: vi.fn(),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
  makeClickable: vi.fn(),
  setupAccessibleDialog: vi.fn(() => ({ open: vi.fn(), close: vi.fn() })),
}));

vi.mock('public/designTokens.js', () => ({
  colors: {},
  spacing: {},
}));

vi.mock('public/performanceHelpers.js', () => ({
  prioritizeSections: vi.fn(async (sections, opts) => {
    for (const s of sections) {
      try { await s.init(); } catch (e) { if (opts?.onError) opts.onError(s.name, e); }
    }
  }),
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

// ── Import page ──────────────────────────────────────────────────────────────
let getApprovedPhotos, getBeforeAfterPairs, getUGCStats;
let initUGCGallery, renderPhotoCards, buildBeforeAfterSlider, mapPhotoForDisplay;
let initVoting;
let collapseOnMobile, initBackToTop, onViewportChange;
let trackEvent;
let setupAccessibleDialog;
let initPageSeo;
let prioritizeSections;

beforeAll(async () => {
  await import('../src/pages/UGC Gallery.js');

  ({ getApprovedPhotos, getBeforeAfterPairs, getUGCStats } = await import('backend/ugcService.web'));
  ({ initUGCGallery, renderPhotoCards, buildBeforeAfterSlider, mapPhotoForDisplay } = await import('public/UGCGallery.js'));
  ({ initVoting } = await import('public/ugcVoting.js'));
  ({ collapseOnMobile, initBackToTop, onViewportChange } = await import('public/mobileHelpers'));
  ({ trackEvent } = await import('public/engagementTracker'));
  ({ setupAccessibleDialog } = await import('public/a11yHelpers'));
  ({ initPageSeo } = await import('public/pageSeo.js'));
  ({ prioritizeSections } = await import('public/performanceHelpers.js'));
});

beforeEach(() => {
  elements.clear();
  vi.clearAllMocks();

  getApprovedPhotos.mockResolvedValue({
    success: true,
    photos: [{ _id: 'p1', imageUrl: 'https://cdn/photo1.jpg', roomType: 'living-room', submittedBy: 'John' }],
  });
  getBeforeAfterPairs.mockResolvedValue({
    success: true,
    pairs: [{ before: { _id: 'b1', imageUrl: 'before.jpg' }, after: { _id: 'a1', imageUrl: 'after.jpg' } }],
  });
  getUGCStats.mockResolvedValue({
    success: true,
    stats: { total: 42, featured: 5 },
  });
  mapPhotoForDisplay.mockImplementation((p) => p);
  prioritizeSections.mockImplementation(async (sections, opts) => {
    for (const s of sections) {
      try { await s.init(); } catch (e) { if (opts?.onError) opts.onError(s.name, e); }
    }
  });
});

// ── Tests ────────────────────────────────────────────────────────────────────
describe('UGC Gallery page', () => {
  describe('Init', () => {
    it('calls initPageSeo and tracks page_view', async () => {
      await onReadyHandler();

      expect(initPageSeo).toHaveBeenCalledWith('ugcGallery');
      expect(trackEvent).toHaveBeenCalledWith('page_view', { page: 'ugc-gallery' });
    });
  });

  describe('Mobile helpers', () => {
    it('calls collapseOnMobile, initBackToTop, and registers onViewportChange', async () => {
      await onReadyHandler();

      expect(collapseOnMobile).toHaveBeenCalledWith($w, ['#ugcBeforeAfterSection', '#ugcSubmitSection']);
      expect(initBackToTop).toHaveBeenCalledWith($w);
      expect(onViewportChange).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('Stats', () => {
    it('calls getUGCStats and sets total and featured count text', async () => {
      await onReadyHandler();

      expect(getUGCStats).toHaveBeenCalled();
      expect(getEl('#ugcTotalCount').text).toBe('42 Customer Photos');
      expect(getEl('#ugcFeaturedCount').text).toBe('5 Featured');
    });
  });

  describe('Gallery', () => {
    it('calls getApprovedPhotos, initUGCGallery with $w and photos, and initVoting', async () => {
      await onReadyHandler();

      expect(getApprovedPhotos).toHaveBeenCalledWith(
        expect.objectContaining({ sort: 'recent', limit: 24 })
      );
      expect(initUGCGallery).toHaveBeenCalledWith($w, expect.objectContaining({
        photos: [{ _id: 'p1', imageUrl: 'https://cdn/photo1.jpg', roomType: 'living-room', submittedBy: 'John' }],
        onFilterChange: expect.any(Function),
        onSortChange: expect.any(Function),
      }));
      expect(initVoting).toHaveBeenCalledWith($w);
    });
  });

  describe('Gallery skeleton', () => {
    it('shows skeleton before load and hides after', async () => {
      await onReadyHandler();

      const skeleton = getEl('#ugcGallerySkeleton');
      expect(skeleton.show).toHaveBeenCalled();
      expect(skeleton.hide).toHaveBeenCalledWith('fade', { duration: 300 });
    });
  });

  describe('Before/after', () => {
    it('calls getBeforeAfterPairs, buildBeforeAfterSlider, expands section, and tracks event', async () => {
      await onReadyHandler();

      expect(getBeforeAfterPairs).toHaveBeenCalledWith({});
      expect(buildBeforeAfterSlider).toHaveBeenCalledWith(
        $w,
        { _id: 'b1', imageUrl: 'before.jpg' },
        { _id: 'a1', imageUrl: 'after.jpg' }
      );
      expect(getEl('#ugcBeforeAfterSection').expand).toHaveBeenCalled();
      expect(trackEvent).toHaveBeenCalledWith('before_after_loaded', { pairCount: 1 });
    });
  });

  describe('Before/after empty', () => {
    it('collapses section when no pairs returned', async () => {
      getBeforeAfterPairs.mockResolvedValue({ success: true, pairs: [] });

      await onReadyHandler();

      expect(getEl('#ugcBeforeAfterSection').collapse).toHaveBeenCalled();
    });
  });

  describe('Submit CTA', () => {
    it('sets ARIA label on submit button, registers onClick, and expands submit section', async () => {
      await onReadyHandler();

      const submitBtn = getEl('#ugcSubmitPhotoBtn');
      expect(submitBtn.accessibility.ariaLabel).toBe('Share your futon setup photo');
      expect(submitBtn.onClick).toHaveBeenCalledWith(expect.any(Function));
      expect(getEl('#ugcSubmitSection').expand).toHaveBeenCalled();
    });
  });
});
