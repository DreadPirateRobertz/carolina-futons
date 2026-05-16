/**
 * @file cf-tok3-wishlistshare-logError.test.js
 * @description TDD red → green for cf-tok3 wishlistShare batch: verify the
 * 4 console.error sites in src/backend/wishlistShare.web.js migrate to the
 * canonical logError from backend/utils/errorHandler.
 *
 * Mayor PACE ALERT 08:59 — small-class logError migration, auto-merge eligible
 * on CI green. Pattern matches cf-44qt batch3 (tests/cf-44qt-logError-batch3.test.js).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  __reset as resetData,
  __setInsertError,
  __setQueryError,
} from './__mocks__/wix-data.js';
import { __reset as resetMembers, __setMember, currentMember } from './__mocks__/wix-members-backend.js';

vi.mock('backend/utils/errorHandler', () => ({ logError: vi.fn() }));

import { logError } from '../src/backend/utils/errorHandler.js';
import { addShareToken, resolveShareToken } from '../src/backend/wishlistShare.web.js';

beforeEach(() => {
  resetData();
  resetMembers();
  logError.mockReset();
});

describe('cf-tok3 wishlistShare — console.error → logError migration', () => {
  describe('addShareToken', () => {
    it('routes getMember failure through logError with wishlistShare.addShareToken.getMember context', async () => {
      currentMember.getMember.mockRejectedValueOnce(new Error('member-svc-down'));
      const result = await addShareToken({});
      expect(result).toEqual({ error: 'auth_failed' });
      expect(logError).toHaveBeenCalledTimes(1);
      const [context, err] = logError.mock.calls[0];
      expect(context).toMatch(/wishlistShare\.addShareToken/);
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe('member-svc-down');
    });

    it('routes wixData.insert failure through logError', async () => {
      __setMember({ _id: 'm1', loginEmail: 'a@b.c', profile: {}, contactDetails: {} });
      __setInsertError('WishlistShareTokens', new Error('insert-failed'));
      const result = await addShareToken({});
      expect(result).toEqual({ error: 'db_failed' });
      expect(logError).toHaveBeenCalledTimes(1);
      const [context, err] = logError.mock.calls[0];
      expect(context).toMatch(/wishlistShare\.addShareToken/);
      expect(err.message).toBe('insert-failed');
    });
  });

  describe('resolveShareToken', () => {
    it('routes outer query throw through logError', async () => {
      __setQueryError('WishlistShareTokens', new Error('query-blew-up'));
      const result = await resolveShareToken('some-token');
      expect(result).toEqual({ valid: false, reason: 'not_found' });
      expect(logError).toHaveBeenCalledTimes(1);
      const [context, err] = logError.mock.calls[0];
      expect(context).toMatch(/wishlistShare\.resolveShareToken/);
      expect(err.message).toBe('query-blew-up');
    });
  });

  describe('console.error elimination (regression guard)', () => {
    it('source file contains zero raw console.error calls (canonical logError only)', async () => {
      const { readFile } = await import('node:fs/promises');
      const src = await readFile(
        new URL('../src/backend/wishlistShare.web.js', import.meta.url),
        'utf8',
      );
      // Strip line comments so the pattern's documentation references
      // (e.g. "// console.error replaced by logError") don't fail the
      // regression guard.
      const stripped = src.replace(/\/\/.*$/gm, '');
      expect(stripped).not.toMatch(/console\.error/);
    });
  });
});
