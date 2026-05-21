/**
 * cf-lifecycleemail-logerror — pins console.error → logError migration
 * in src/backend/lifecycleEmailSender.web.js.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(
  path.resolve(TEST_DIR, '../src/backend/lifecycleEmailSender.web.js'),
  'utf-8',
);

describe('cf-lifecycleemail-logerror — lifecycleEmailSender.web.js console.error → logError', () => {
  it('contains zero console.error calls', () => {
    const matches = SRC.match(/console\.error\s*\(/g) || [];
    expect(matches.length).toBe(0);
  });

  it('imports logError from backend/utils/errorHandler', () => {
    expect(SRC).toMatch(
      /import\s+\{[^}]*\blogError\b[^}]*\}\s+from\s+['"]backend\/utils\/errorHandler['"]/,
    );
  });

  it('uses logError tag lifecycleEmailSender:sendLifecycleEmails', () => {
    expect(SRC).toContain(`'lifecycleEmailSender:sendLifecycleEmails'`);
  });

  it('drift guard — every logError call uses the lifecycleEmailSender: prefix', () => {
    const tagPattern = /\blogError\s*\(\s*['"`]([^'"`]+)['"`]/g;
    const tags = Array.from(SRC.matchAll(tagPattern), (m) => m[1]);
    expect(tags.length).toBeGreaterThanOrEqual(1);
    const nonPrefixed = tags.filter((t) => !t.startsWith('lifecycleEmailSender:'));
    expect(
      nonPrefixed,
      `found logError tags without lifecycleEmailSender: prefix: ${nonPrefixed.join(', ')}`,
    ).toEqual([]);
  });
});
