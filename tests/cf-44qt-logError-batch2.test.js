/**
 * cf-44qt wave — batch 2: console.error → logError
 * Modules: birthdayMigration, assemblyGuides, blogService,
 *           communityGalleryService, contactSubmissions
 *
 * Pins logError call site + tag for each catch block migrated in this wave.
 * Uses stringContaining so tag-format changes don't break the suite.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks (hoisted before any imports) ──────────────────────────────────────

vi.mock('backend/utils/errorHandler', () => ({ logError: vi.fn() }));

vi.mock('backend/events', () => ({ _parseBirthdayMonthDay: vi.fn() }));

vi.mock('backend/blogContent', () => ({
  getBlogPost: vi.fn(),
  getAllBlogPosts: vi.fn(() => []),
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: vi.fn((s, max) => String(s ?? '').slice(0, max ?? 200)),
  validateEmail: vi.fn((e) => /^[^@]+@[^@]+\.[^@]+$/.test(e)),
  generateUUIDFilename: vi.fn((n) => `uuid-${n}`),
}));

vi.mock('backend/utils/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));

vi.mock('backend/utils/auditLog', () => ({ logAuditEvent: vi.fn() }));

vi.mock('backend/utils/validateSchema', () => ({
  validateSchema: vi.fn().mockReturnValue([]),
}));

// ── Module imports (after vi.mock) ──────────────────────────────────────────

import {
  __seed,
  __setUpdateError,
  __setQueryError,
  __setInsertError,
} from './__mocks__/wix-data.js';
import {
  __setListError as __setBlogListError,
} from './__mocks__/wix-blog-backend.js';

import { backfillBirthdayFields } from '../src/backend/birthdayMigration.web.js';
import {
  getAssemblyGuide,
  getCareTips,
  listAssemblyGuides,
} from '../src/backend/assemblyGuides.web.js';
import {
  getPublishedBlogPosts,
  getRecentPosts,
  getCategories,
} from '../src/backend/blogService.web.js';
import { getGalleryPhotos } from '../src/backend/communityGalleryService.web.js';
import { submitContactForm } from '../src/backend/contactSubmissions.web.js';

let logError;

beforeEach(async () => {
  vi.clearAllMocks();
  ({ logError } = await import('backend/utils/errorHandler'));
  // Restore defaults cleared by clearAllMocks
  const { validateSchema } = await import('backend/utils/validateSchema');
  vi.mocked(validateSchema).mockReturnValue([]);
  const { validateEmail, sanitize } = await import('backend/utils/sanitize');
  vi.mocked(validateEmail).mockImplementation((e) => /^[^@]+@[^@]+\.[^@]+$/.test(e));
  vi.mocked(sanitize).mockImplementation((s, max) => String(s ?? '').slice(0, max ?? 200));
  const { checkRateLimit } = await import('backend/utils/rateLimit');
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true });
});

// ── birthdayMigration ────────────────────────────────────────────────────────

describe('birthdayMigration — logError on update failure', () => {
  it('calls logError when wixData.update throws during backfill', async () => {
    const { _parseBirthdayMonthDay } = await import('backend/events');
    vi.mocked(_parseBirthdayMonthDay).mockReturnValue({ month: 4, day: 12 });

    __seed('Members/PrivateMembersData', [
      { _id: 'm-1', birthday: '1990-04-12', birthday_month: null, birthday_day: null },
    ]);
    __setUpdateError('Members/PrivateMembersData', new Error('Wix data update failed'));

    const result = await backfillBirthdayFields();
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('[birthdayMigration]'),
      expect.any(Error),
    );
    expect(result.errors).toBe(1);
  });
});

// ── assemblyGuides ───────────────────────────────────────────────────────────

describe('assemblyGuides — logError on query failures', () => {
  it('calls logError and returns null when getAssemblyGuide query throws', async () => {
    __setQueryError('AssemblyGuides', new Error('DB down'));
    const result = await getAssemblyGuide('some-sku');
    expect(result).toBeNull();
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('[assemblyGuides]'),
      expect.any(Error),
    );
  });

  it('calls logError and returns defaults when sanitize throws in getCareTips', async () => {
    const { sanitize } = await import('backend/utils/sanitize');
    vi.mocked(sanitize).mockImplementationOnce(() => { throw new Error('sanitize failed'); });
    const result = await getCareTips('futon-frames');
    expect(Array.isArray(result)).toBe(true);
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('[assemblyGuides]'),
      expect.any(Error),
    );
  });

  it('calls logError and returns [] when listAssemblyGuides query throws', async () => {
    __setQueryError('AssemblyGuides', new Error('DB down'));
    const result = await listAssemblyGuides();
    expect(result).toEqual([]);
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('[assemblyGuides]'),
      expect.any(Error),
    );
  });
});

// ── blogService ──────────────────────────────────────────────────────────────

describe('blogService — logError on Wix Blog API failures', () => {
  it('calls logError when getPublishedBlogPosts throws', async () => {
    __setBlogListError(new Error('Blog API down'));
    const result = await getPublishedBlogPosts();
    expect(result.error).toBe(true);
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('[blogService]'),
      expect.any(Error),
    );
  });

  it('calls logError when getRecentPosts throws', async () => {
    __setBlogListError(new Error('Blog API down'));
    const result = await getRecentPosts();
    expect(result).toEqual([]);
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('[blogService]'),
      expect.any(Error),
    );
  });

  it('calls logError when getCategories throws', async () => {
    __setBlogListError(new Error('Blog API down'));
    const result = await getCategories();
    expect(result).toEqual([]);
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('[blogService]'),
      expect.any(Error),
    );
  });
});

// ── communityGalleryService ──────────────────────────────────────────────────

describe('communityGalleryService — logError on query failure', () => {
  it('calls logError when PhotoReviews query throws', async () => {
    __setQueryError('PhotoReviews', new Error('DB down'));
    const result = await getGalleryPhotos(null);
    expect(result.success).toBe(false);
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('[communityGalleryService]'),
      expect.any(Error),
    );
  });
});

// ── contactSubmissions ───────────────────────────────────────────────────────

describe('contactSubmissions — logError on insert failure', () => {
  it('calls logError when wixData.insert throws during form submit', async () => {
    __setInsertError('ContactSubmissions', new Error('DB insert failed'));
    const result = await submitContactForm({ email: 'test@example.com', name: 'Test' });
    expect(result.success).toBe(false);
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('[contactSubmissions]'),
      expect.any(Error),
    );
  });
});
