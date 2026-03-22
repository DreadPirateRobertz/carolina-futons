/**
 * noDoMockInTestBody.test.js — CF-fgsw
 *
 * Invariant: vi.doMock() called inside test bodies (describe/it/beforeEach etc.)
 * does not work as intended. vi.doMock() does not hoist and does not invalidate
 * already-resolved static import bindings at the top of the test file — the
 * importing module receives the original binding regardless of the factory
 * registered mid-suite. This causes the mock to silently no-op, making tests
 * appear to pass while exercising a different implementation than intended.
 *
 * Rule: any vi.doMock() call with 2+ leading spaces (i.e. inside a block) must be
 * tagged with a trailing `// vi-domock-legacy` comment if it is a known pre-existing
 * violation. NEW violations without the tag fail this test immediately.
 *
 * To fix a legacy violation: replace vi.doMock() with top-level vi.mock() +
 * mockImplementationOnce() in the test/beforeEach, then remove the legacy tag.
 * Note: when the legacy code uses different factory shapes per test, the top-level
 * factory must be a superset — this is not always a mechanical refactor.
 */
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';

// Anchor to this file's directory (tests/) regardless of cwd at invocation
const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));

/** Returns violations: lines with indented vi.doMock() that are not tagged or commented out. */
function findViolations(lines) {
  return lines
    .map((line, i) => ({ line, lineNum: i + 1 }))
    .filter(({ line }) =>
      /^\s{2,}(?!\/\/)vi\.doMock\(/.test(line) &&  // vi.doMock( must start the expression
      !line.includes('// vi-domock-legacy')         // not a tagged legacy exception
    );
}

/** Recursively collect .test.js files under a directory, excluding this file. */
function collectTestFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== '__mocks__' && entry.name !== 'fixtures') {
      results.push(...collectTestFiles(fullPath));
    } else if (entry.name.endsWith('.test.js') && entry.name !== 'noDoMockInTestBody.test.js') {
      results.push(fullPath);
    }
  }
  return results;
}

describe('no-domock-in-test-body invariant (CF-fgsw)', () => {
  it('findViolations catches untagged indented vi.doMock() and passes tagged/commented ones', () => {
    const testLines = [
      "  vi.doMock('module', () => ({}));",                         // VIOLATION: indented + untagged
      "  vi.doMock('module', () => ({}));  // vi-domock-legacy",    // allowed: tagged legacy
      "vi.doMock('module', () => ({}));",                           // allowed: top-level (0 indent)
      "  // vi.doMock('module', () => ({}));",                      // allowed: commented-out
    ];
    const violations = findViolations(testLines);
    expect(violations).toHaveLength(1);
    expect(violations[0].lineNum).toBe(1);
  });

  it('every indented vi.doMock() in the test suite is tagged // vi-domock-legacy', () => {
    const testFiles = collectTestFiles(TEST_DIR);

    // Guard against vacuous pass (wrong directory, CI checkout issue)
    expect(testFiles.length, 'too few test files found — scanner may be broken').toBeGreaterThan(50);

    const untaggedViolations = [];

    for (const filepath of testFiles) {
      let lines;
      try {
        lines = fs.readFileSync(filepath, 'utf-8').split('\n');
      } catch (err) {
        throw new Error(`noDoMockInTestBody scanner: failed to read ${path.basename(filepath)}: ${err.message}`);
      }

      for (const { line, lineNum } of findViolations(lines)) {
        untaggedViolations.push(`${path.relative(TEST_DIR, filepath)}:${lineNum}  ${line.trimStart()}`);
      }
    }

    const msg = untaggedViolations.length === 0 ? '' : [
      '',
      'vi.doMock() called inside test body — does not invalidate existing static import bindings.',
      'Fix: use top-level vi.mock() + mockImplementationOnce() in the test.',
      'If this is a pre-existing violation, add // vi-domock-legacy at end of line.',
      '',
      ...untaggedViolations,
    ].join('\n');

    expect(untaggedViolations, msg).toEqual([]);
  });
});
