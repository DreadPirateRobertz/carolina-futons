import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// ═══════════════════════════════════════════════════════════════════
// CF-7bv: Import Count Budget Tests
// Tracks import count per page module and flags if >20 imports.
// Keeps page modules lean to avoid bundle bloat and coupling.
// ═══════════════════════════════════════════════════════════════════

const PAGES_DIR = join(__dirname, '..', 'src', 'pages');
const IMPORT_BUDGET = 20;

/**
 * Count top-level import statements in a JS file.
 * Matches `import ... from '...'` and `import '...'` patterns.
 * @param {string} filePath - Absolute path to the JS file
 * @returns {number} Number of import statements
 */
function countImports(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  let count = 0;
  for (const line of lines) {
    if (/^\s*import\s+/.test(line)) {
      count++;
    }
  }
  return count;
}

/**
 * Get all page module files.
 * @returns {{ name: string, path: string }[]}
 */
function getPageModules() {
  const files = readdirSync(PAGES_DIR).filter((f) => f.endsWith('.js'));
  return files.map((name) => ({
    name,
    path: join(PAGES_DIR, name),
  }));
}

describe('Import Count Budget', () => {
  const pages = getPageModules();

  it('should find page modules to test', () => {
    expect(pages.length).toBeGreaterThan(0);
  });

  describe('each page module must stay within import budget', () => {
    for (const page of pages) {
      it(`${page.name} should have ≤${IMPORT_BUDGET} imports`, () => {
        const count = countImports(page.path);
        expect(
          count,
          `${page.name} has ${count} imports (budget: ${IMPORT_BUDGET}). ` +
            `Consider splitting helpers or lazy-loading modules.`
        ).toBeLessThanOrEqual(IMPORT_BUDGET);
      });
    }
  });

  it('should report import counts for all pages', () => {
    const counts = pages
      .map((p) => ({ name: p.name, count: countImports(p.path) }))
      .sort((a, b) => b.count - a.count);

    const overBudget = counts.filter((c) => c.count > IMPORT_BUDGET);

    // Log summary for visibility
    const summary = counts
      .map((c) => {
        const flag = c.count > IMPORT_BUDGET ? ' ⚠️ OVER BUDGET' : '';
        return `  ${String(c.count).padStart(3)} ${c.name}${flag}`;
      })
      .join('\n');

    // This test always passes — it's for reporting.
    // The per-page tests above enforce the budget.
    expect(summary).toBeDefined();

    // But also assert: track how many are over budget
    if (overBudget.length > 0) {
      console.warn(
        `\n⚠️ ${overBudget.length} page(s) over import budget (>${IMPORT_BUDGET}):\n` +
          overBudget.map((c) => `  ${c.name}: ${c.count} imports`).join('\n')
      );
    }
  });
});

describe('countImports', () => {
  it('counts standard import statements', () => {
    // Verify our counter works on a known file
    const homePath = join(PAGES_DIR, 'Home.js');
    const count = countImports(homePath);
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(50); // sanity upper bound
  });
});
