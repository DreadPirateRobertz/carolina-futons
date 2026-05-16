/**
 * cf-44qt sibling — mediaGallery.web.js observability cleanup.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const logErrorSpy = vi.fn();
vi.mock('backend/utils/errorHandler', () => ({ logError: logErrorSpy }));

vi.mock('backend/utils/sanitize', () => ({ sanitize: (s) => s }));
vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));
vi.mock('wix-members-backend', () => ({
  currentMember: { getMember: vi.fn(async () => ({ _id: 'member-1', loginEmail: 'm@example.com' })) },
}));
vi.mock('wix-media-backend', () => ({
  mediaManager: {
    listFiles: vi.fn(async () => { throw new Error('mediaManager failure'); }),
    listFolders: vi.fn(async () => { throw new Error('mediaManager failure'); }),
    getFileInfo: vi.fn(async () => { throw new Error('mediaManager failure'); }),
  },
}));

import {
  __reset as resetData,
  __setQueryError,
} from './__mocks__/wix-data.js';

describe('cf-44qt sibling — mediaGallery.web.js observability cleanup', () => {
  beforeEach(() => {
    logErrorSpy.mockClear();
    resetData();
  });

  it('listMediaFolder wires logError on mediaManager failure', async () => {
    const mod = await import('../src/backend/mediaGallery.web.js');
    await mod.listMediaFolder('test-folder');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/mediaGallery/);
    expect(allTags).toMatch(/listMediaFolder/);
  });

  it('listMediaFolders wires logError on mediaManager failure', async () => {
    const mod = await import('../src/backend/mediaGallery.web.js');
    await mod.listMediaFolders();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/mediaGallery/);
    expect(allTags).toMatch(/listMediaFolders/);
  });

  it('getProductMedia wires logError on Stores/Products query throw', async () => {
    __setQueryError('Stores/Products', new Error('wixData failure'));
    const mod = await import('../src/backend/mediaGallery.web.js');
    await mod.getProductMedia('prod-1');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/mediaGallery/);
    expect(allTags).toMatch(/getProductMedia/);
  });

  it('getBatchProductThumbnails wires logError on Stores/Products query throw', async () => {
    __setQueryError('Stores/Products', new Error('wixData failure'));
    const mod = await import('../src/backend/mediaGallery.web.js');
    await mod.getBatchProductThumbnails(['p1', 'p2']);
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/mediaGallery/);
    expect(allTags).toMatch(/getBatchProductThumbnails/);
  });
});
