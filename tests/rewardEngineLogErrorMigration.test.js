/**
 * cf-rewardengine-logerror — pins console.error → logError migration in
 * src/backend/rewardEngine.web.js. Local logError wrapper removed.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(
  path.resolve(TEST_DIR, '../src/backend/rewardEngine.web.js'),
  'utf-8',
);

const EXPECTED_PREFIXES = [
  'rewardEngine:generateUniqueCouponCode-exhausted5Retries',
  'rewardEngine:deliverTierPerks-insert',
  'rewardEngine:deliverTierPerks-email',
];

describe('cf-rewardengine-logerror — rewardEngine.web.js console.error → logError', () => {
  it('contains zero console.error calls', () => {
    const matches = SRC.match(/console\.error\s*\(/g) || [];
    expect(matches.length).toBe(0);
  });

  it('local logError(msg, err) wrapper removed', () => {
    expect(SRC).not.toMatch(/^function\s+logError\s*\(/m);
  });

  it('imports logError from backend/utils/errorHandler', () => {
    expect(SRC).toMatch(
      /import\s+\{[^}]*\blogError\b[^}]*\}\s+from\s+['"]backend\/utils\/errorHandler['"]/,
    );
  });

  it.each(EXPECTED_PREFIXES)('uses logError tag prefix %s', (prefix) => {
    expect(SRC).toContain(prefix);
  });

  it('drift guard — every logError call uses the rewardEngine: prefix', () => {
    const tagPattern = /\blogError\s*\(\s*['"`]([^'"`]+)['"`]/g;
    const tags = Array.from(SRC.matchAll(tagPattern), (m) => m[1]);
    expect(tags.length).toBeGreaterThanOrEqual(3);
    const nonPrefixed = tags.filter((t) => !t.startsWith('rewardEngine:'));
    expect(
      nonPrefixed,
      `found logError tags without rewardEngine: prefix: ${nonPrefixed.join(', ')}`,
    ).toEqual([]);
  });
});
