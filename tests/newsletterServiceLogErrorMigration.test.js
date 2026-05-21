/**
 * cf-newsletter-logerror — pins console.error → logError migration in
 * src/backend/newsletterService.web.js.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(
  path.resolve(TEST_DIR, '../src/backend/newsletterService.web.js'),
  'utf-8',
);

const EXPECTED_TAGS = [
  'newsletterService:syncToESP-internal',
  'newsletterService:unsubscribeFromESP',
  'newsletterService:subscribeToNewsletter',
];

describe('cf-newsletter-logerror — newsletterService.web.js console.error → logError', () => {
  it('contains zero console.error calls', () => {
    const matches = SRC.match(/console\.error\s*\(/g) || [];
    expect(matches.length).toBe(0);
  });

  it('imports logError from backend/utils/errorHandler', () => {
    expect(SRC).toMatch(
      /import\s+\{[^}]*\blogError\b[^}]*\}\s+from\s+['"]backend\/utils\/errorHandler['"]/,
    );
  });

  it.each(EXPECTED_TAGS)('uses logError tag %s', (tag) => {
    expect(SRC).toContain(`'${tag}'`);
  });

  it('drift guard — every logError call uses the newsletterService: prefix', () => {
    const tagPattern = /\blogError\s*\(\s*['"`]([^'"`]+)['"`]/g;
    const tags = Array.from(SRC.matchAll(tagPattern), (m) => m[1]);
    expect(tags.length).toBeGreaterThanOrEqual(3);
    const nonPrefixed = tags.filter((t) => !t.startsWith('newsletterService:'));
    expect(
      nonPrefixed,
      `found logError tags without newsletterService: prefix: ${nonPrefixed.join(', ')}`,
    ).toEqual([]);
  });
});
