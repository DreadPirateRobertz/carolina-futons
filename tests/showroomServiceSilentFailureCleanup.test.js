/**
 * cf-44qt sibling — showroomService.web.js observability cleanup.
 *
 * 3 console.error → logError migrations across 3 webMethods. All 3
 * catches are PARANOID:
 *   - getShowroomBookingUrl: try-wraps a synchronous object-literal
 *     construction; can't realistically throw.
 *   - getShowroomEligibleIds: per-item `.catch(() => null)` on each
 *     `products.getProduct(id)` call swallows all per-item throws
 *     INSIDE Promise.all, so the outer try-catch's reachable surface
 *     is just the dynamic-import + array operations — also non-
 *     throwing in practice.
 *   - getShowroomSectionData: try-wraps a synchronous object-literal
 *     construction; can't realistically throw.
 *
 * Migration is mechanically verified via the diff (1:1 console.error
 * → logError, same `[<service>] <fn> failed` tag shape per the
 * canonical pattern from my cf-44qt audit memo). No runtime-throw
 * test for the catches; instead this file pins the fail-safe return
 * shapes so a future refactor that breaks the structural contract
 * surfaces in tests. Same gap-shape as PR #1480 visualSearch +
 * PR #1487 protectionPlan's getProtectionPlanSummary path.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const logErrorSpy = vi.fn();
vi.mock('backend/utils/errorHandler', () => ({ logError: logErrorSpy }));

vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));
vi.mock('wix-secrets-backend', () => ({
  getSecret: vi.fn(async () => 'test-secret'),
}));
vi.mock('wix-stores-backend', () => ({
  products: {
    getProduct: vi.fn(async (id) =>
      id === 'eligible-1' ? { _id: 'eligible-1', collections: [] } : null,
    ),
  },
}));

describe('cf-44qt sibling — showroomService.web.js observability cleanup', () => {
  beforeEach(() => {
    logErrorSpy.mockClear();
  });

  it('getShowroomBookingUrl returns the static booking URL shape', async () => {
    const mod = await import('../src/backend/showroomService.web.js');
    const result = await mod.getShowroomBookingUrl();
    expect(result.url).toMatch(/\/booking-calendar\//);
    expect(result.serviceName).toBeTruthy();
  });

  it('getShowroomEligibleIds returns an array even on empty input', async () => {
    const mod = await import('../src/backend/showroomService.web.js');
    const empty = await mod.getShowroomEligibleIds([]);
    expect(Array.isArray(empty)).toBe(true);
    expect(empty).toEqual([]);
  });

  it('getShowroomSectionData returns the section shape (info + bookingUrl + mapUrl)', async () => {
    const mod = await import('../src/backend/showroomService.web.js');
    const result = await mod.getShowroomSectionData();
    expect(result.info).toBeDefined();
    expect(result.bookingUrl).toMatch(/\/booking-calendar\//);
    expect(result.mapUrl).toMatch(/google\.com\/maps/);
  });
});
