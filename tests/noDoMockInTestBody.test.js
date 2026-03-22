/**
 * noDoMockInTestBody.test.js — CF-fgsw
 *
 * Invariant: vi.doMock() called inside test bodies (describe/it/beforeEach etc.)
 * cannot intercept already-cached modules in Node 20 — the module registry is
 * frozen after first import. This causes silent test flakes under parallel
 * execution. Use vi.mock() at module top-level + mockImplementationOnce() instead.
 *
 * Rule: any vi.doMock() call with 2+ leading spaces (i.e. inside a block) must be
 * tagged with a trailing `// vi-domock-legacy` comment if it is a known pre-existing
 * violation. NEW violations without the tag fail this test immediately.
 *
 * To fix a legacy violation: replace vi.doMock() with top-level vi.mock() +
 * mockImplementationOnce() in the test/beforeEach, then remove the legacy tag.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const TEST_DIR = path.join(process.cwd(), 'tests');

describe('no-domock-in-test-body invariant (CF-fgsw)', () => {
  it('every vi.doMock() inside a test block is either top-level or tagged // vi-domock-legacy', () => {
    const testFiles = fs.readdirSync(TEST_DIR)
      .filter(f => f.endsWith('.test.js') && f !== 'noDoMockInTestBody.test.js')
      .sort();

    const untaggedViolations = [];

    for (const filename of testFiles) {
      const filepath = path.join(TEST_DIR, filename);
      const lines = fs.readFileSync(filepath, 'utf-8').split('\n');

      lines.forEach((line, i) => {
        // Detect vi.doMock() with 2+ leading spaces = inside a block
        if (/^\s{2,}.*vi\.doMock\(/.test(line)) {
          // Allow if explicitly tagged as a known legacy violation
          if (!line.includes('// vi-domock-legacy')) {
            untaggedViolations.push(`${filename}:${i + 1}  ${line.trimStart()}`);
          }
        }
      });
    }

    const msg = untaggedViolations.length === 0 ? '' : [
      '',
      'vi.doMock() called inside test body — Node 20 footgun (module already cached).',
      'Fix: use top-level vi.mock() + mockImplementationOnce() in the test.',
      'If this is a pre-existing violation, add // vi-domock-legacy at end of line.',
      '',
      ...untaggedViolations,
    ].join('\n');

    expect(untaggedViolations, msg).toEqual([]);
  });
});
