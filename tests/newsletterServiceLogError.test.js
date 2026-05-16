/**
 * cf-44qt wave — pin newsletterService.web.js console.error → logError migration.
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

describe('cf-44qt — newsletterService.web.js console.error → logError migration', () => {
  it('contains zero console.error calls', () => {
    const matches = SRC.match(/console\.error\s*\(/g) || [];
    expect(matches.length).toBe(0);
  });

  it('imports logError from backend/utils/errorHandler', () => {
    expect(SRC).toMatch(
      /import\s+\{[^}]*\blogError\b[^}]*\}\s+from\s+['"]backend\/utils\/errorHandler['"]/,
    );
  });

  it('this-PR migration sites use the newsletterService: prefix', () => {
    expect(SRC).toContain("logError('newsletterService:espSync'");
    expect(SRC).toContain("logError('newsletterService:espUnsubscribe'");
    expect(SRC).toContain("logError('newsletterService:subscribe'");
  });
});
