/**
 * @file withRateLimit.js
 * @description Shared test helper that pre-seeds rate limit collections so
 * checkRateLimit() passes through without inserting new records or consuming
 * wixData.query() mock results intended for business logic.
 *
 * ## Problem
 * When a backend endpoint calls checkRateLimit(), it queries + inserts/updates
 * the rate limit collection BEFORE business logic runs. Tests that don't account
 * for this see:
 *   1. __onInsert callbacks triggered by rate limit inserts (not business inserts)
 *   2. wixData.query() mockResolvedValueOnce consumed by rate limit query
 *   3. wixData.insert assertions failing because rate limit inserted first
 *
 * ## Usage
 * ```js
 * import { withRateLimit } from './helpers/withRateLimit';
 *
 * beforeEach(() => {
 *   __reset();
 *   withRateLimit('EmailRateLimit');
 *   // ... your test setup
 * });
 * ```
 *
 * Multiple collections can be seeded:
 * ```js
 * withRateLimit('EmailRateLimit');
 * withRateLimit('AuditLogRateLimit');
 * ```
 *
 * To test rate-limited behavior (blocked):
 * ```js
 * withRateLimit('EmailRateLimit', { blocked: true });
 * ```
 *
 * CF-d6ee
 */

import { __seed } from '../__mocks__/wix-data.js';

/**
 * Pre-seed a rate limit collection with a fresh, passing record.
 * This ensures checkRateLimit() finds an existing record with count < max,
 * updates it (count++), and moves on without inserting.
 *
 * @param {string} collection - Rate limit collection name (e.g. 'EmailRateLimit')
 * @param {Object} [opts]
 * @param {boolean} [opts.blocked=false] - If true, seeds a record at max count to trigger rate limiting
 * @param {number} [opts.max=100] - Max count threshold (record is seeded at max-1 for passing, max for blocked)
 * @param {string} [opts.key='test-key'] - The rate limit key to seed
 */
export function withRateLimit(collection, opts = {}) {
  const { blocked = false, max = 100, key = 'test-key' } = opts;
  const count = blocked ? max : 1;

  __seed(collection, [{
    _id: `rl-seed-${collection}`,
    key,
    count,
    windowStart: new Date(), // Fresh window — won't be expired
  }]);
}

/**
 * Pre-seed multiple rate limit collections at once.
 *
 * @param {string[]} collections - Array of rate limit collection names
 * @param {Object} [opts] - Options passed to each withRateLimit call
 */
export function withRateLimits(collections, opts = {}) {
  for (const collection of collections) {
    withRateLimit(collection, opts);
  }
}

/**
 * For tests using custom wixData mocks (vi.mock('wix-data', () => ...)):
 * Prepend a rate-limit query result before business query results.
 *
 * Usage with mockQueryChain pattern:
 * ```js
 * import { prependRateLimitQuery } from './helpers/withRateLimit';
 *
 * // Before your business query mock:
 * prependRateLimitQuery(mockQueryChain.find);
 * mockQueryChain.find.mockResolvedValueOnce({ items: [...business data...] });
 * ```
 *
 * @param {import('vitest').Mock} findMock - The find mock function to prepend to
 * @param {Object} [opts]
 * @param {boolean} [opts.blocked=false] - If true, returns a record at max count
 * @param {number} [opts.max=100] - Max count threshold
 */
export function prependRateLimitQuery(findMock, opts = {}) {
  const { blocked = false, max = 100 } = opts;
  if (blocked) {
    findMock.mockResolvedValueOnce({
      items: [{ _id: 'rl-mock', key: 'mock-key', count: max, windowStart: new Date() }],
      totalCount: 1,
    });
  } else {
    findMock.mockResolvedValueOnce({ items: [], totalCount: 0 });
  }
}
