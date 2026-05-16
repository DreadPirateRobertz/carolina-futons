/**
 * TDD tests pinning logError migration for batch7:
 *   analyticsHelpers.web.js  (6 sites)
 *   liveShowroom.web.js      (4 sites)
 *   orderTracking.web.js     (4 sites)
 *
 * cf-44qt
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── vi.hoisted mocks ─────────────────────────────────────────────────

const { mockLogError } = vi.hoisted(() => ({ mockLogError: vi.fn() }));
const { mockRateLimit } = vi.hoisted(() => ({ mockRateLimit: vi.fn() }));
const { mockTrackShipment } = vi.hoisted(() => ({ mockTrackShipment: vi.fn() }));

// ── Static mocks ─────────────────────────────────────────────────────

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('backend/utils/errorHandler', () => ({ logError: mockLogError }));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : ''),
  validateEmail: (v) => (typeof v === 'string' && v.includes('@') ? v.trim() : ''),
}));

vi.mock('backend/utils/rateLimit', () => ({
  checkRateLimit: mockRateLimit,
}));

vi.mock('backend/ups-shipping.web', () => ({
  trackShipment: mockTrackShipment,
}));

vi.mock('backend/utils/auditLog', () => ({
  logAuditEvent: vi.fn(),
}));

vi.mock('wix-members-backend', () => ({
  currentMember: { getMember: vi.fn().mockResolvedValue(null) },
}));

import { __seed, __setQueryError, __setInsertError, __reset } from './__mocks__/wix-data.js';

// ── Import SUT ───────────────────────────────────────────────────────

const { trackProductView, getMostViewedProducts, getTrendingProducts } =
  await import('../src/backend/analyticsHelpers.web.js');
const { getShowroomStatus, getLiveDisplayProducts, reserveShowroomPiece, cameraHeartbeat } =
  await import('../src/backend/liveShowroom.web.js');
const { lookupOrder, subscribeToNotifications, unsubscribeFromNotifications, getTrackingTimeline } =
  await import('../src/backend/orderTracking.web.js');

// ════════════════════════════════════════════════════════════════════
// analyticsHelpers
// ════════════════════════════════════════════════════════════════════

describe('analyticsHelpers — logError migration', () => {
  beforeEach(() => {
    __reset();
    mockLogError.mockClear();
    mockRateLimit.mockResolvedValue({ allowed: true });
  });

  it('trackProductView calls logError on wix-data failure', async () => {
    __setInsertError('ProductAnalytics', new Error('insert fail'));
    await trackProductView('prod-1', 'Test Product');
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('analyticsHelpers'),
      expect.any(Error),
    );
  });

  it('getMostViewedProducts calls logError on query failure', async () => {
    __setQueryError('ProductAnalytics', new Error('query fail'));
    const r = await getMostViewedProducts();
    expect(r).toEqual([]);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('analyticsHelpers'),
      expect.any(Error),
    );
  });

  it('getTrendingProducts calls logError on query failure', async () => {
    __setQueryError('ProductAnalytics', new Error('query fail'));
    const r = await getTrendingProducts();
    expect(r).toEqual([]);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('analyticsHelpers'),
      expect.any(Error),
    );
  });
});

// ════════════════════════════════════════════════════════════════════
// liveShowroom
// ════════════════════════════════════════════════════════════════════

describe('liveShowroom — logError migration', () => {
  beforeEach(() => {
    __reset();
    mockLogError.mockClear();
    mockRateLimit.mockResolvedValue({ allowed: true });
  });

  it('getShowroomStatus calls logError on query failure', async () => {
    __setQueryError('ShowroomCameras', new Error('db fail'));
    const r = await getShowroomStatus('prod-1');
    expect(r.onDisplay).toBe(false);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('liveShowroom'),
      expect.any(Error),
    );
  });

  it('getLiveDisplayProducts calls logError on query failure', async () => {
    __setQueryError('ShowroomCameras', new Error('db fail'));
    const r = await getLiveDisplayProducts();
    expect(r.productIds).toEqual([]);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('liveShowroom'),
      expect.any(Error),
    );
  });

  it('cameraHeartbeat calls logError on query failure', async () => {
    __setQueryError('ShowroomCameras', new Error('db fail'));
    const r = await cameraHeartbeat('cam-1');
    expect(r.success).toBe(false);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('liveShowroom'),
      expect.any(Error),
    );
  });
});

// ════════════════════════════════════════════════════════════════════
// orderTracking
// ════════════════════════════════════════════════════════════════════

describe('orderTracking — logError migration', () => {
  beforeEach(() => {
    __reset();
    mockLogError.mockClear();
    mockRateLimit.mockResolvedValue({ allowed: true });
    mockTrackShipment.mockResolvedValue({ events: [] });
  });

  it('lookupOrder calls logError on query failure', async () => {
    __setQueryError('Stores/Orders', new Error('db fail'));
    const r = await lookupOrder('ORD-001', 'test@example.com');
    expect(r.success).toBe(false);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('orderTracking'),
      expect.any(Error),
    );
  });

  it('subscribeToNotifications calls logError on query failure', async () => {
    __setQueryError('Stores/Orders', new Error('db fail'));
    const r = await subscribeToNotifications('ORD-001', 'test@example.com');
    expect(r.success).toBe(false);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('orderTracking'),
      expect.any(Error),
    );
  });

  it('getTrackingTimeline calls logError when trackShipment throws', async () => {
    mockTrackShipment.mockRejectedValueOnce(new Error('UPS timeout'));
    const r = await getTrackingTimeline('1Z999AA10123456784');
    expect(r.success).toBe(false);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('orderTracking'),
      expect.any(Error),
    );
  });
});
