/**
 * TDD tests pinning logError migration for batch8:
 *   completeTheLookService.web.js  (3 sites)
 *   dataService.web.js             (3 sites)
 *   conversionDashboard.web.js     (4 sites)
 *   customizationService.web.js    (4 sites)
 *   deliveryExperience.web.js      (4 sites)
 *
 * cf-44qt
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── vi.hoisted mocks ─────────────────────────────────────────────────

const { mockLogError } = vi.hoisted(() => ({ mockLogError: vi.fn() }));
const { mockGetMember } = vi.hoisted(() => ({ mockGetMember: vi.fn() }));

// ── Static mocks ─────────────────────────────────────────────────────

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('backend/utils/errorHandler', () => ({ logError: mockLogError }));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : ''),
  validateId: (v) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 50) : ''),
  isWixMediaUrl: (v) => (typeof v === 'string' && v.startsWith('wix:')),
}));

vi.mock('wix-members-backend', () => ({
  currentMember: { getMember: mockGetMember },
}));

vi.mock('backend/utils/auditLog', () => ({
  logAuditEvent: vi.fn(),
}));

vi.mock('backend/utils/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));

import { __seed, __setQueryError, __setInsertError, __reset } from './__mocks__/wix-data.js';

// ── Import SUT ───────────────────────────────────────────────────────

const { getCompleteTheLook, createLook } =
  await import('../src/backend/completeTheLookService.web.js');
const { scheduleReviewRequest, getPendingReviewRequests } =
  await import('../src/backend/dataService.web.js');
const { getConversionFunnel, getDashboardSummary } =
  await import('../src/backend/conversionDashboard.web.js');
const { getCustomizationOptions, getSavedConfigurations } =
  await import('../src/backend/customizationService.web.js');
const { getDeliveryStatus, getSurveyStats } =
  await import('../src/backend/deliveryExperience.web.js');

// ════════════════════════════════════════════════════════════════════
// completeTheLookService
// ════════════════════════════════════════════════════════════════════

describe('completeTheLookService — logError migration', () => {
  beforeEach(() => { __reset(); mockLogError.mockClear(); });

  it('getCompleteTheLook calls logError on query failure', async () => {
    __setQueryError('CompleteTheLook', new Error('db fail'));
    const r = await getCompleteTheLook('prod-1');
    expect(r).toBeNull();
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('completeTheLookService'),
      expect.any(Error),
    );
  });

  it('createLook calls logError on insert failure', async () => {
    __setInsertError('CompleteTheLook', new Error('insert fail'));
    const r = await createLook({ productId: 'prod-1', roomItems: [] });
    expect(r.success).toBe(false);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('completeTheLookService'),
      expect.any(Error),
    );
  });
});

// ════════════════════════════════════════════════════════════════════
// dataService
// ════════════════════════════════════════════════════════════════════

describe('dataService — logError migration', () => {
  beforeEach(() => {
    __reset();
    mockLogError.mockClear();
    mockGetMember.mockResolvedValue({ _id: 'mem-1' });
  });

  it('scheduleReviewRequest calls logError on insert failure', async () => {
    __setInsertError('ReviewRequests', new Error('insert fail'));
    const r = await scheduleReviewRequest('ord-1', 'prod-1', 'Test Product');
    expect(r.success).toBe(false);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('dataService'),
      expect.any(Error),
    );
  });

  it('getPendingReviewRequests calls logError on query failure', async () => {
    __setQueryError('ReviewRequests', new Error('query fail'));
    const r = await getPendingReviewRequests();
    expect(Array.isArray(r)).toBe(true);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('dataService'),
      expect.any(Error),
    );
  });
});

// ════════════════════════════════════════════════════════════════════
// conversionDashboard
// ════════════════════════════════════════════════════════════════════

describe('conversionDashboard — logError migration', () => {
  beforeEach(() => { __reset(); mockLogError.mockClear(); });

  it('getConversionFunnel calls logError on query failure', async () => {
    __setQueryError('AnalyticsEvents', new Error('db fail'));
    const r = await getConversionFunnel();
    expect(r.success).toBe(false);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('conversionDashboard'),
      expect.any(Error),
    );
  });

  it('getDashboardSummary calls logError on query failure', async () => {
    __setQueryError('AnalyticsEvents', new Error('db fail'));
    const r = await getDashboardSummary();
    expect(r.success).toBe(false);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('conversionDashboard'),
      expect.any(Error),
    );
  });
});

// ════════════════════════════════════════════════════════════════════
// customizationService
// ════════════════════════════════════════════════════════════════════

describe('customizationService — logError migration', () => {
  beforeEach(() => {
    __reset();
    mockLogError.mockClear();
    mockGetMember.mockResolvedValue({ _id: 'mem-1' });
  });

  it('getCustomizationOptions calls logError on query failure', async () => {
    __setQueryError('FabricSwatches', new Error('db fail'));
    const r = await getCustomizationOptions('prod-1');
    expect(r).toMatchObject({ swatches: [], pricingRules: [] });
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('customizationService'),
      expect.any(Error),
    );
  });

  it('getSavedConfigurations calls logError on query failure', async () => {
    __setQueryError('SavedCustomizations', new Error('db fail'));
    const r = await getSavedConfigurations('prod-1', 'mem-1');
    expect(Array.isArray(r)).toBe(true);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('customizationService'),
      expect.any(Error),
    );
  });
});

// ════════════════════════════════════════════════════════════════════
// deliveryExperience
// ════════════════════════════════════════════════════════════════════

describe('deliveryExperience — logError migration', () => {
  beforeEach(() => { __reset(); mockLogError.mockClear(); });

  it('getDeliveryStatus calls logError on query failure', async () => {
    __setQueryError('DeliveryTracking', new Error('db fail'));
    const r = await getDeliveryStatus('ord-1');
    expect(r.success).toBe(false);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('deliveryExperience'),
      expect.any(Error),
    );
  });

  it('getSurveyStats calls logError on query failure', async () => {
    __setQueryError('DeliverySurveys', new Error('db fail'));
    const r = await getSurveyStats();
    expect(r.success).toBe(false);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('deliveryExperience'),
      expect.any(Error),
    );
  });
});
