/**
 * cf-marketingsequences-logerror — pins console.error → logError
 * migration in src/backend/marketingSequences.web.js. NOTE: this file
 * had a LOCAL logError(msg, err) wrapper that internally called
 * console.error. The migration removes the local wrapper AND swaps to
 * the shared errorHandler logError + namespaced tags.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(
  path.resolve(TEST_DIR, '../src/backend/marketingSequences.web.js'),
  'utf-8',
);

const EXPECTED_TAGS = [
  'marketingSequences:triggerWelcomeSequence',
  'marketingSequences:triggerCartAbandonSequence',
  'marketingSequences:triggerReviewRequestSequence',
  'marketingSequences:runReviewRequestEmails',
  'marketingSequences:triggerWinbackSequence',
  'marketingSequences:scanAndTriggerWinback',
];

describe('cf-marketingsequences-logerror — marketingSequences.web.js console.error → logError', () => {
  it('contains zero console.error calls', () => {
    const matches = SRC.match(/console\.error\s*\(/g) || [];
    expect(matches.length).toBe(0);
  });

  it('local logError(msg, err) wrapper removed (was shadowing the shared name)', () => {
    expect(SRC).not.toMatch(/^function\s+logError\s*\(/m);
  });

  it('imports logError from backend/utils/errorHandler', () => {
    expect(SRC).toMatch(
      /import\s+\{[^}]*\blogError\b[^}]*\}\s+from\s+['"]backend\/utils\/errorHandler['"]/,
    );
  });

  it.each(EXPECTED_TAGS)('uses logError tag %s', (tag) => {
    expect(SRC).toContain(`'${tag}'`);
  });

  it('drift guard — every logError call uses the marketingSequences: prefix', () => {
    const tagPattern = /\blogError\s*\(\s*['"`]([^'"`]+)['"`]/g;
    const tags = Array.from(SRC.matchAll(tagPattern), (m) => m[1]);
    expect(tags.length).toBeGreaterThanOrEqual(6);
    const nonPrefixed = tags.filter((t) => !t.startsWith('marketingSequences:'));
    expect(
      nonPrefixed,
      `found logError tags without marketingSequences: prefix: ${nonPrefixed.join(', ')}`,
    ).toEqual([]);
  });
});
