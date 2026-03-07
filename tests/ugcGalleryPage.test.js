/**
 * Integration tests for UGC Gallery page.
 * Verifies the full data flow: backend → mapPhotoForDisplay → frontend rendering.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    src: '',
    alt: '',
    value: '',
    label: '',
    data: [],
    items: [],
    style: { color: '', backgroundColor: '', borderColor: '' },
    accessibility: {},
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(),
    expand: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    onClick: vi.fn(),
    onChange: vi.fn(),
    onItemReady: vi.fn(),
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

// ── Mock backend modules ────────────────────────────────────────────

const mockGetApprovedPhotos = vi.fn();
const mockGetBeforeAfterPairs = vi.fn();
const mockGetUGCStats = vi.fn();

vi.mock('backend/ugcService.web', () => ({
  getApprovedPhotos: (...args) => mockGetApprovedPhotos(...args),
  getBeforeAfterPairs: (...args) => mockGetBeforeAfterPairs(...args),
  getUGCStats: (...args) => mockGetUGCStats(...args),
}));

vi.mock('public/ugcVoting.js', () => ({
  initVoting: vi.fn(),
  handleVoteClick: vi.fn(),
  isVotedByUser: vi.fn(() => false),
  getVotedPhotoIds: vi.fn(() => []),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
  trackGalleryInteraction: vi.fn(),
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
  makeClickable: vi.fn((el, handler) => { if (el && handler) el.onClick(handler); }),
  setupAccessibleDialog: vi.fn(() => ({ open: vi.fn(), close: vi.fn() })),
}));

vi.mock('public/designTokens.js', () => ({
  colors: {
    sandBase: '#E8D5B7', espresso: '#3A2518', mountainBlue: '#5B8FA8',
    sunsetCoral: '#E8845C', white: '#FFFFFF', offWhite: '#FAF7F2',
    sandLight: '#F2E8D5',
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  borderRadius: { sm: '4px', md: '8px', lg: '12px', pill: '999px' },
  shadows: { sm: '0 1px 3px rgba(58,37,24,0.12)', md: '0 4px 12px rgba(58,37,24,0.15)' },
  transitions: { fast: 150, medium: 250, slow: 400 },
}));

vi.mock('public/mobileHelpers', () => ({
  isMobile: vi.fn(() => false),
  collapseOnMobile: vi.fn(),
  initBackToTop: vi.fn(),
  limitForViewport: vi.fn(() => 24),
  onViewportChange: vi.fn(),
}));

vi.mock('public/galleryHelpers.js', () => ({
  initImageLightbox: vi.fn(),
}));

vi.mock('public/performanceHelpers.js', () => ({
  prioritizeSections: vi.fn(async (sections) => {
    for (const s of sections) {
      await s.init();
    }
  }),
}));

vi.mock('wix-location-frontend', () => ({
  to: vi.fn(),
}));

// ── Test fixtures (backend format) ─────────────────────────────────

const backendPhotos = {
  success: true,
  photos: [
    {
      _id: 'photo-1',
      photoUrl: 'https://cdn.example.com/room1.jpg',
      voteCount: 15,
      memberDisplayName: 'Sarah D.',
      caption: 'Love my new futon!',
      productName: 'Kodiak Frame',
      roomType: 'living-room',
      status: 'approved',
      tags: ['lifestyle'],
    },
    {
      _id: 'photo-2',
      photoUrl: 'https://cdn.example.com/room2.jpg',
      voteCount: 8,
      memberDisplayName: 'Tom R.',
      caption: 'Perfect for the dorm',
      productName: 'College Futon',
      roomType: 'dorm',
      status: 'featured',
      tags: ['dorm', 'setup'],
    },
  ],
  totalCount: 2,
};

const backendBeforeAfter = {
  success: true,
  pairs: [
    {
      pairId: 'pair-1',
      before: {
        _id: 'ba-before',
        photoUrl: 'https://cdn.example.com/before.jpg',
        voteCount: 3,
        memberDisplayName: 'Jane',
        caption: 'Before',
        roomType: 'bedroom',
        status: 'approved',
      },
      after: {
        _id: 'ba-after',
        photoUrl: 'https://cdn.example.com/after.jpg',
        voteCount: 12,
        memberDisplayName: 'Jane',
        caption: 'After',
        roomType: 'bedroom',
        status: 'approved',
      },
    },
  ],
};

const backendStats = {
  success: true,
  stats: { total: 42, featured: 5, byRoomType: { 'living-room': 20, bedroom: 12, dorm: 10 } },
};

const emptyPhotos = { success: true, photos: [], totalCount: 0 };
const emptyBeforeAfter = { success: true, pairs: [] };

// ── Tests ───────────────────────────────────────────────────────────

describe('UGC Gallery Page Integration', () => {
  beforeAll(async () => {
    await import('../src/pages/UGC Gallery.js');
  });

  beforeEach(() => {
    elements.clear();
    mockGetApprovedPhotos.mockReset();
    mockGetBeforeAfterPairs.mockReset();
    mockGetUGCStats.mockReset();
  });

  describe('data mapping — backend to frontend field names', () => {
    it('maps photoUrl to imageUrl in repeater data', async () => {
      mockGetApprovedPhotos.mockResolvedValue(backendPhotos);
      mockGetBeforeAfterPairs.mockResolvedValue(emptyBeforeAfter);
      mockGetUGCStats.mockResolvedValue(backendStats);
      await onReadyHandler();

      const repeater = getEl('#ugcRepeater');
      expect(repeater.data).toHaveLength(2);
      expect(repeater.data[0].imageUrl).toBe('https://cdn.example.com/room1.jpg');
      expect(repeater.data[1].imageUrl).toBe('https://cdn.example.com/room2.jpg');
    });

    it('maps voteCount to votes in repeater data', async () => {
      mockGetApprovedPhotos.mockResolvedValue(backendPhotos);
      mockGetBeforeAfterPairs.mockResolvedValue(emptyBeforeAfter);
      mockGetUGCStats.mockResolvedValue(backendStats);
      await onReadyHandler();

      const repeater = getEl('#ugcRepeater');
      expect(repeater.data[0].votes).toBe(15);
      expect(repeater.data[1].votes).toBe(8);
    });

    it('maps memberDisplayName to submittedBy in repeater data', async () => {
      mockGetApprovedPhotos.mockResolvedValue(backendPhotos);
      mockGetBeforeAfterPairs.mockResolvedValue(emptyBeforeAfter);
      mockGetUGCStats.mockResolvedValue(backendStats);
      await onReadyHandler();

      const repeater = getEl('#ugcRepeater');
      expect(repeater.data[0].submittedBy).toBe('Sarah D.');
      expect(repeater.data[1].submittedBy).toBe('Tom R.');
    });

    it('preserves original fields alongside mapped fields', async () => {
      mockGetApprovedPhotos.mockResolvedValue(backendPhotos);
      mockGetBeforeAfterPairs.mockResolvedValue(emptyBeforeAfter);
      mockGetUGCStats.mockResolvedValue(backendStats);
      await onReadyHandler();

      const repeater = getEl('#ugcRepeater');
      expect(repeater.data[0]._id).toBe('photo-1');
      expect(repeater.data[0].caption).toBe('Love my new futon!');
      expect(repeater.data[0].productName).toBe('Kodiak Frame');
      expect(repeater.data[0].roomType).toBe('living-room');
    });
  });

  describe('before/after slider mapping', () => {
    it('maps before/after photo fields for slider', async () => {
      mockGetApprovedPhotos.mockResolvedValue(backendPhotos);
      mockGetBeforeAfterPairs.mockResolvedValue(backendBeforeAfter);
      mockGetUGCStats.mockResolvedValue(backendStats);
      await onReadyHandler();

      const beforeImg = getEl('#beforeImage');
      const afterImg = getEl('#afterImage');
      expect(beforeImg.src).toBe('https://cdn.example.com/before.jpg');
      expect(afterImg.src).toBe('https://cdn.example.com/after.jpg');
    });
  });

  describe('stats display', () => {
    it('shows total and featured counts', async () => {
      mockGetApprovedPhotos.mockResolvedValue(backendPhotos);
      mockGetBeforeAfterPairs.mockResolvedValue(emptyBeforeAfter);
      mockGetUGCStats.mockResolvedValue(backendStats);
      await onReadyHandler();

      expect(getEl('#ugcTotalCount').text).toContain('42');
      expect(getEl('#ugcFeaturedCount').text).toContain('5');
    });
  });

  describe('empty state', () => {
    it('shows empty state when no photos', async () => {
      mockGetApprovedPhotos.mockResolvedValue(emptyPhotos);
      mockGetBeforeAfterPairs.mockResolvedValue(emptyBeforeAfter);
      mockGetUGCStats.mockResolvedValue(backendStats);
      await onReadyHandler();

      expect(getEl('#ugcEmptyState').expand).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('handles backend failure gracefully', async () => {
      mockGetApprovedPhotos.mockResolvedValue({ success: false });
      mockGetBeforeAfterPairs.mockResolvedValue(emptyBeforeAfter);
      mockGetUGCStats.mockResolvedValue(backendStats);
      await onReadyHandler();

      expect(getEl('#ugcEmptyState').expand).toHaveBeenCalled();
    });

    it('handles network exception gracefully', async () => {
      mockGetApprovedPhotos.mockRejectedValue(new Error('Network error'));
      mockGetBeforeAfterPairs.mockResolvedValue(emptyBeforeAfter);
      mockGetUGCStats.mockResolvedValue(backendStats);

      await expect(onReadyHandler()).resolves.not.toThrow();
    });
  });

  describe('before/after section', () => {
    it('collapses before/after section when no pairs', async () => {
      mockGetApprovedPhotos.mockResolvedValue(backendPhotos);
      mockGetBeforeAfterPairs.mockResolvedValue(emptyBeforeAfter);
      mockGetUGCStats.mockResolvedValue(backendStats);
      await onReadyHandler();

      expect(getEl('#ugcBeforeAfterSection').collapse).toHaveBeenCalled();
    });

    it('expands before/after section when pairs exist', async () => {
      mockGetApprovedPhotos.mockResolvedValue(backendPhotos);
      mockGetBeforeAfterPairs.mockResolvedValue(backendBeforeAfter);
      mockGetUGCStats.mockResolvedValue(backendStats);
      await onReadyHandler();

      expect(getEl('#ugcBeforeAfterSection').expand).toHaveBeenCalled();
    });
  });
});
