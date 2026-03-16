/**
 * Deep coverage tests for UGC Gallery page.
 * Covers: refreshGallery (via filter/sort callbacks), initSubmitCTA fallback dialog path.
 */
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

vi.mock('wix-location-frontend', () => ({
  default: { path: [] },
  to: vi.fn(() => { throw new Error('Navigation failed'); }),
}));

// ── Import page ──────────────────────────────────────────────────────────────
let getApprovedPhotos, getBeforeAfterPairs, getUGCStats;
let initUGCGallery, renderPhotoCards, mapPhotoForDisplay;
let isMobile;
let trackEvent;
let setupAccessibleDialog;
let prioritizeSections;

beforeAll(async () => {
  await import('../src/pages/UGC Gallery.js');

  ({ getApprovedPhotos, getBeforeAfterPairs, getUGCStats } = await import('backend/ugcService.web'));
  ({ initUGCGallery, renderPhotoCards, mapPhotoForDisplay } = await import('public/UGCGallery.js'));
  ({ isMobile } = await import('public/mobileHelpers'));
  ({ trackEvent } = await import('public/engagementTracker'));
  ({ setupAccessibleDialog } = await import('public/a11yHelpers'));
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
  isMobile.mockReturnValue(false);
  prioritizeSections.mockImplementation(async (sections, opts) => {
    for (const s of sections) {
      try { await s.init(); } catch (e) { if (opts?.onError) opts.onError(s.name, e); }
    }
  });
});

// ── Tests ────────────────────────────────────────────────────────────────────
describe('UGC Gallery page — deep coverage', () => {

  // ── refreshGallery via onFilterChange / onSortChange ───────────────────────

  describe('refreshGallery via onFilterChange', () => {
    it('calls getApprovedPhotos with updated roomType', async () => {
      await onReadyHandler();

      const initCall = initUGCGallery.mock.calls[0];
      const { onFilterChange } = initCall[1];

      getApprovedPhotos.mockResolvedValue({
        success: true,
        photos: [{ _id: 'p2', imageUrl: 'https://cdn/photo2.jpg', roomType: 'bedroom', submittedBy: 'Jane' }],
      });

      await onFilterChange('bedroom');

      // refreshGallery should call getApprovedPhotos with the new roomType
      const lastCall = getApprovedPhotos.mock.calls[getApprovedPhotos.mock.calls.length - 1][0];
      expect(lastCall.roomType).toBe('bedroom');
      expect(lastCall.sort).toBe('recent');
    });
  });

  describe('refreshGallery via onSortChange', () => {
    it('calls getApprovedPhotos with updated sort', async () => {
      await onReadyHandler();

      const initCall = initUGCGallery.mock.calls[0];
      const { onSortChange } = initCall[1];

      getApprovedPhotos.mockResolvedValue({
        success: true,
        photos: [{ _id: 'p1', imageUrl: 'https://cdn/photo1.jpg', roomType: 'living-room', submittedBy: 'John' }],
      });

      await onSortChange('popular');

      const lastCall = getApprovedPhotos.mock.calls[getApprovedPhotos.mock.calls.length - 1][0];
      expect(lastCall.sort).toBe('popular');
    });
  });

  describe('refreshGallery renders photo cards', () => {
    it('calls renderPhotoCards with mapped photos after refresh', async () => {
      await onReadyHandler();

      const { onFilterChange } = initUGCGallery.mock.calls[0][1];
      const refreshedPhotos = [
        { _id: 'p3', imageUrl: 'https://cdn/photo3.jpg', roomType: 'office', submittedBy: 'Mike' },
        { _id: 'p4', imageUrl: 'https://cdn/photo4.jpg', roomType: 'office', submittedBy: 'Sara' },
      ];

      getApprovedPhotos.mockResolvedValue({ success: true, photos: refreshedPhotos });

      await onFilterChange('office');

      expect(renderPhotoCards).toHaveBeenCalledWith($w, refreshedPhotos);
    });
  });

  describe('refreshGallery uses isMobile for limit', () => {
    it('passes limit 12 when isMobile returns true', async () => {
      await onReadyHandler();

      const { onSortChange } = initUGCGallery.mock.calls[0][1];

      isMobile.mockReturnValue(true);
      getApprovedPhotos.mockResolvedValue({
        success: true,
        photos: [{ _id: 'p1', imageUrl: 'https://cdn/photo1.jpg', roomType: 'living-room', submittedBy: 'John' }],
      });

      await onSortChange('popular');

      const lastCall = getApprovedPhotos.mock.calls[getApprovedPhotos.mock.calls.length - 1][0];
      expect(lastCall.limit).toBe(12);
    });

    it('passes limit 24 when isMobile returns false', async () => {
      await onReadyHandler();

      const { onFilterChange } = initUGCGallery.mock.calls[0][1];

      isMobile.mockReturnValue(false);
      getApprovedPhotos.mockResolvedValue({
        success: true,
        photos: [{ _id: 'p1', imageUrl: 'https://cdn/photo1.jpg', roomType: 'living-room', submittedBy: 'John' }],
      });

      await onFilterChange('dorm');

      const lastCall = getApprovedPhotos.mock.calls[getApprovedPhotos.mock.calls.length - 1][0];
      expect(lastCall.limit).toBe(24);
    });
  });

  // ── initSubmitCTA click handler ────────────────────────────────────────────

  describe('initSubmitCTA click handler', () => {
    it('tracks ugc_submit_click event on button click', async () => {
      await onReadyHandler();

      const submitBtn = getEl('#ugcSubmitPhotoBtn');
      const clickHandler = submitBtn.onClick.mock.calls[0][0];

      await clickHandler();

      expect(trackEvent).toHaveBeenCalledWith('ugc_submit_click', { source: 'gallery_page' });
    });
  });

  describe('initSubmitCTA fallback dialog', () => {
    it('opens accessible dialog when navigation fails', async () => {
      await onReadyHandler();

      const submitBtn = getEl('#ugcSubmitPhotoBtn');
      const clickHandler = submitBtn.onClick.mock.calls[0][0];

      // wix-location-frontend.to is mocked to throw, so fallback path runs
      const mockOpen = vi.fn();
      setupAccessibleDialog.mockReturnValue({ open: mockOpen, close: vi.fn() });

      await clickHandler();

      expect(setupAccessibleDialog).toHaveBeenCalledWith($w, {
        panelId: '#ugcSubmitModal',
        closeId: '#ugcSubmitModalClose',
        titleId: '#ugcSubmitModalTitle',
        onClose: expect.any(Function),
      });
      expect(mockOpen).toHaveBeenCalled();
    });
  });

  // ── Empty state from loadGallery ───────────────────────────────────────────

  describe('gallery empty state', () => {
    it('expands #ugcEmptyState when getApprovedPhotos returns failure', async () => {
      getApprovedPhotos.mockResolvedValue({ success: false });

      await onReadyHandler();

      expect(getEl('#ugcEmptyState').expand).toHaveBeenCalled();
    });

    it('expands #ugcEmptyState when getApprovedPhotos returns null', async () => {
      getApprovedPhotos.mockResolvedValue(null);

      await onReadyHandler();

      expect(getEl('#ugcEmptyState').expand).toHaveBeenCalled();
    });
  });
});
