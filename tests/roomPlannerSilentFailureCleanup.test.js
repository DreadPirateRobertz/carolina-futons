/**
 * cf-44qt sibling — roomPlanner.web.js observability cleanup.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const logErrorSpy = vi.fn();
vi.mock('backend/utils/errorHandler', () => ({ logError: logErrorSpy }));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (s) => s,
  validateId: (s) => s,
}));
vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));
vi.mock('wix-members-backend', () => ({
  currentMember: { getMember: vi.fn(async () => ({ _id: 'member-1', loginEmail: 'm@example.com' })) },
}));

import {
  __reset as resetData,
  __setQueryError,
  __setInsertError,
} from './__mocks__/wix-data.js';

describe('cf-44qt sibling — roomPlanner.web.js observability cleanup', () => {
  beforeEach(() => {
    logErrorSpy.mockClear();
    resetData();
  });

  it('createRoomLayout wires logError on RoomLayouts insert throw', async () => {
    __setInsertError('RoomLayouts', new Error('wixData failure'));
    const mod = await import('../src/backend/roomPlanner.web.js');
    await mod.createRoomLayout({ name: 'Test Room', roomWidth: 120, roomLength: 144 });
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/roomPlanner/);
    expect(allTags).toMatch(/createRoomLayout/);
  });

  it('shareLayout early-return on missing layoutId does not call logError', async () => {
    const mod = await import('../src/backend/roomPlanner.web.js');
    await mod.shareLayout('', true);
    expect(logErrorSpy).not.toHaveBeenCalled();
  });

  it('saveLayout early-return on missing layoutId does not call logError', async () => {
    const mod = await import('../src/backend/roomPlanner.web.js');
    await mod.saveLayout('', {});
    expect(logErrorSpy).not.toHaveBeenCalled();
  });

  it('getProductDimensions returns the catalog without invoking logError', async () => {
    const mod = await import('../src/backend/roomPlanner.web.js');
    const result = await mod.getProductDimensions();
    expect(result.success).toBe(true);
    expect(logErrorSpy).not.toHaveBeenCalled();
  });
});
