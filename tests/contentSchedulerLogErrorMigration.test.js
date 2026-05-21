/**
 * cf-contentscheduler-logerror — pins console.error → logError migration
 * in src/backend/contentScheduler.web.js.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(
  path.resolve(TEST_DIR, '../src/backend/contentScheduler.web.js'),
  'utf-8',
);

const EXPECTED_PREFIXES = [
  'contentScheduler:processContentSchedule-action',
  'contentScheduler:processContentSchedule',
  'contentScheduler:getScheduleQueue',
  'contentScheduler:cancelScheduledItem',
  'contentScheduler:getScheduleStats',
];

describe('cf-contentscheduler-logerror — contentScheduler.web.js console.error → logError', () => {
  it('contains zero console.error calls', () => {
    const matches = SRC.match(/console\.error\s*\(/g) || [];
    expect(matches.length).toBe(0);
  });

  it('imports logError from backend/utils/errorHandler', () => {
    expect(SRC).toMatch(
      /import\s+\{[^}]*\blogError\b[^}]*\}\s+from\s+['"]backend\/utils\/errorHandler['"]/,
    );
  });

  it.each(EXPECTED_PREFIXES)('uses logError tag prefix %s', (prefix) => {
    expect(SRC).toContain(prefix);
  });

  it('drift guard — every logError call uses the contentScheduler: prefix', () => {
    const tagPattern = /\blogError\s*\(\s*['"`]([^'"`]+)['"`]/g;
    const tags = Array.from(SRC.matchAll(tagPattern), (m) => m[1]);
    expect(tags.length).toBeGreaterThanOrEqual(5);
    const nonPrefixed = tags.filter((t) => !t.startsWith('contentScheduler:'));
    expect(
      nonPrefixed,
      `found logError tags without contentScheduler: prefix: ${nonPrefixed.join(', ')}`,
    ).toEqual([]);
  });
});
