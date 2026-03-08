import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Performance budget: track import count per page module.
 * Flags any page with >20 imports to prevent dependency bloat.
 *
 * Why: Each import in a Wix Velo page module adds to initialization time.
 * Large import counts signal the need to refactor into composite helpers
 * or lazy-load non-critical modules.
 *
 * Bead: CF-7bv
 */

const PAGES_DIR = join(__dirname, '..', 'src', 'pages');
const IMPORT_BUDGET = 20;

// Known over-budget pages with their current counts.
// Each entry caps the allowed count — if a page INCREASES beyond its cap, the test fails.
// To remove a page from the allowlist, refactor it below the budget and delete the entry.
const KNOWN_OVERBUDGET = {
  'Category Page.js': 26,
  'Product Page.js': 22,
};

/**
 * Count static import statements in source text.
 * Matches `import ... from '...'` and `import '...'` patterns.
 * NOTE: Line-commented imports are NOT counted since the regex anchors to
 * line start. However, imports inside block comments that start at column 0
 * WILL be counted. This is acceptable since commented-out imports should be
 * deleted, not left around.
 * @param {string} source - File content or source string
 * @returns {number} Number of static import statements
 */
function countImportsFromSource(source) {
  const importLines = source.match(/^import\s+/gm);
  return importLines ? importLines.length : 0;
}

/**
 * Count static import statements in a file.
 * @param {string} filePath - Absolute path to the file
 * @returns {number} Number of import statements
 */
function countImports(filePath) {
  const content = readFileSync(filePath, 'utf8');
  return countImportsFromSource(content);
}

/**
 * Get all page module files.
 * @returns {Array<{name: string, path: string}>}
 */
function getPageModules() {
  const files = readdirSync(PAGES_DIR).filter(f => f.endsWith('.js'));
  return files.map(f => ({ name: f, path: join(PAGES_DIR, f) }));
}

describe('Import count budget (performance)', () => {
  const pages = getPageModules();

  it('finds page modules to audit', () => {
    expect(pages.length).toBeGreaterThan(0);
  });

  it('no page module exceeds import budget (unless in known allowlist)', () => {
    const violations = [];

    for (const page of pages) {
      const count = countImports(page.path);
      const cap = KNOWN_OVERBUDGET[page.name];

      if (cap !== undefined) {
        // Known over-budget page — fail if it gets WORSE
        if (count > cap) {
          violations.push({
            name: page.name,
            count,
            reason: `exceeded allowlist cap of ${cap}`,
          });
        }
      } else if (count > IMPORT_BUDGET) {
        // New violation — not in allowlist
        violations.push({
          name: page.name,
          count,
          reason: `exceeds budget of ${IMPORT_BUDGET} (add to KNOWN_OVERBUDGET or refactor)`,
        });
      }
    }

    if (violations.length > 0) {
      const report = violations
        .sort((a, b) => b.count - a.count)
        .map(p => `  ${p.name}: ${p.count} imports — ${p.reason}`)
        .join('\n');
      expect.fail(`${violations.length} import budget violation(s):\n${report}`);
    }
  });

  it('allowlisted pages have not been refactored below budget (remove stale entries)', () => {
    const stale = [];

    for (const [name, cap] of Object.entries(KNOWN_OVERBUDGET)) {
      const page = pages.find(p => p.name === name);
      if (!page) {
        console.warn(`KNOWN_OVERBUDGET: '${name}' no longer exists — remove stale entry`);
        continue;
      }
      const count = countImports(page.path);
      if (count <= IMPORT_BUDGET) {
        stale.push({ name, count, cap });
      }
    }

    if (stale.length > 0) {
      const report = stale
        .map(p => `  ${p.name}: now ${p.count} imports (was capped at ${p.cap}) — remove from KNOWN_OVERBUDGET`)
        .join('\n');
      expect.fail(`${stale.length} page(s) now within budget — clean up allowlist:\n${report}`);
    }
  });

  it('logs import counts per page for CI visibility (reporting only)', () => {
    const counts = pages
      .map(p => ({ name: p.name, count: countImports(p.path) }))
      .sort((a, b) => b.count - a.count);

    const summary = counts.map(c => {
      const status = c.count > IMPORT_BUDGET ? 'OVER' : 'ok';
      return `[${status}] ${c.name}: ${c.count}`;
    });
    console.log(`\nImport Budget Report (limit: ${IMPORT_BUDGET}):\n${summary.join('\n')}`);
  });

  it('no page module has zero imports (sanity check)', () => {
    // Every real page module should import at least something
    // Static content pages (Privacy Policy, etc.) may have minimal imports — allow 1+
    const emptyPages = pages.filter(p => countImports(p.path) === 0);

    if (emptyPages.length > 0) {
      const names = emptyPages.map(p => p.name).join(', ');
      expect.fail(`Page(s) with zero imports (likely stubs): ${names}`);
    }
  });

  it('countImportsFromSource counts only static imports', () => {
    // Build source with 'imp' + 'ort' to avoid Vite import analysis parsing
    const imp = 'imp' + 'ort';
    const source = [
      `${imp} { foo } from 'bar';`,           // static — counted
      `${imp} baz from 'qux';`,               // static — counted
      `${imp} 'side-effect';`,                 // static — counted
      `const x = await ${imp}('dynamic');`,    // dynamic — NOT counted
      `export { y } from 'reexport';`,         // re-export — NOT counted
      `// ${imp} { z } from 'commented';`,     // line comment — NOT counted (anchored to ^)
      `const i = '${imp} fake';`,              // mid-line — NOT counted
    ].join('\n');

    expect(countImportsFromSource(source)).toBe(3);
  });

  it('countImportsFromSource counts block-commented imports at line start', () => {
    // Known limitation: block comments with import at line start ARE counted
    const imp = 'imp' + 'ort';
    const source = [
      `${imp} { real } from 'mod';`,
      '/* disabled:',
      `${imp} { dead } from 'old';`,  // starts at line start inside block comment — counted
      '*/',
    ].join('\n');

    // 1 real + 1 inside block comment = 2 (documented limitation)
    expect(countImportsFromSource(source)).toBe(2);
  });

  it('countImportsFromSource returns 0 for empty or import-free content', () => {
    expect(countImportsFromSource('')).toBe(0);
    expect(countImportsFromSource('const x = 1;\nexport default x;')).toBe(0);
    expect(countImportsFromSource('// just comments\n/* block */')).toBe(0);
  });
});
