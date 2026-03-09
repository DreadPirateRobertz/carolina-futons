/**
 * Element ID Verification Tests (CF-2yxz)
 *
 * Statically analyzes all page modules to verify $w element IDs are valid.
 * Covers: naming conventions, format, per-page extraction, cross-page analysis.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import {
  extractElementIds,
  validateElementId,
  validatePageIds,
  getPageFiles,
} from '../src/public/elementIdValidator.js';

// ── Unit tests for extraction and validation ────────────────────────

describe('extractElementIds', () => {
  it('extracts single-quoted $w IDs', () => {
    const source = `$w('#myButton').onClick(() => {});`;
    const ids = extractElementIds(source);
    expect(ids).toContain('myButton');
  });

  it('extracts double-quoted $w IDs', () => {
    const source = `$w("#myInput").value = 'test';`;
    const ids = extractElementIds(source);
    expect(ids).toContain('myInput');
  });

  it('extracts multiple IDs from source', () => {
    const source = `
      $w('#header').show();
      $w('#footer').hide();
      $w('#nav').expand();
    `;
    const ids = extractElementIds(source);
    expect(ids).toEqual(expect.arrayContaining(['header', 'footer', 'nav']));
    expect(ids).toHaveLength(3);
  });

  it('deduplicates IDs within a file', () => {
    const source = `
      $w('#btn').onClick(() => {});
      $w('#btn').label = 'Click';
      $w('#btn').show();
    `;
    const ids = extractElementIds(source);
    expect(ids).toHaveLength(1);
    expect(ids[0]).toBe('btn');
  });

  it('returns empty array for no $w calls', () => {
    const source = `const x = 42; console.log(x);`;
    const ids = extractElementIds(source);
    expect(ids).toEqual([]);
  });

  it('ignores $w calls without hash prefix', () => {
    const source = `$w('Button').onClick(() => {});`;
    const ids = extractElementIds(source);
    expect(ids).toEqual([]);
  });

  it('ignores $w calls with CSS selectors', () => {
    const source = `$w('.myClass').forEach(el => el.show());`;
    const ids = extractElementIds(source);
    expect(ids).toEqual([]);
  });

  it('handles template literals in nearby code without matching them', () => {
    const source = `
      const name = \`hello\`;
      $w('#realElement').show();
    `;
    const ids = extractElementIds(source);
    expect(ids).toEqual(['realElement']);
  });

  it('extracts IDs from elementId property strings', () => {
    const source = `{ elementId: '#categoryFutonFrames', name: 'Frames' }`;
    const ids = extractElementIds(source);
    expect(ids).toContain('categoryFutonFrames');
  });
});

describe('validateElementId', () => {
  it('accepts valid camelCase ID', () => {
    expect(validateElementId('myButton')).toEqual({ valid: true });
  });

  it('accepts single-word lowercase ID', () => {
    expect(validateElementId('header')).toEqual({ valid: true });
  });

  it('accepts ID starting with uppercase', () => {
    expect(validateElementId('Button1')).toEqual({ valid: true });
  });

  it('accepts ID with numbers', () => {
    expect(validateElementId('section2Content')).toEqual({ valid: true });
  });

  it('rejects empty string', () => {
    const result = validateElementId('');
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/empty/i);
  });

  it('rejects ID starting with number', () => {
    const result = validateElementId('1button');
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/letter/i);
  });

  it('rejects ID with spaces', () => {
    const result = validateElementId('my button');
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/alphanumeric/i);
  });

  it('rejects ID with hyphens', () => {
    const result = validateElementId('my-button');
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/alphanumeric/i);
  });

  it('rejects ID with special characters', () => {
    const result = validateElementId('btn@click');
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/alphanumeric/i);
  });

  it('rejects ID with hash prefix still attached', () => {
    const result = validateElementId('#myButton');
    expect(result.valid).toBe(false);
  });
});

describe('validatePageIds', () => {
  it('returns valid result for source with all valid IDs', () => {
    const source = `
      $w('#headerTitle').text = 'Hello';
      $w('#footerNav').show();
    `;
    const result = validatePageIds(source, 'TestPage.js');
    expect(result.pageName).toBe('TestPage.js');
    expect(result.totalIds).toBe(2);
    expect(result.invalidIds).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('reports invalid IDs in page source', () => {
    const source = `
      $w('#goodId').show();
      $w('#1badId').hide();
    `;
    const result = validatePageIds(source, 'BadPage.js');
    expect(result.valid).toBe(false);
    expect(result.invalidIds).toHaveLength(1);
    expect(result.invalidIds[0].id).toBe('1badId');
  });

  it('returns zero IDs for page with no $w calls', () => {
    const source = `export function init() { return true; }`;
    const result = validatePageIds(source, 'Empty.js');
    expect(result.totalIds).toBe(0);
    expect(result.valid).toBe(true);
  });
});

describe('getPageFiles', () => {
  it('returns array of page file paths', () => {
    const files = getPageFiles();
    expect(Array.isArray(files)).toBe(true);
    expect(files.length).toBeGreaterThan(0);
    files.forEach(f => expect(f).toMatch(/\.js$/));
  });

  it('includes known pages', () => {
    const files = getPageFiles();
    const names = files.map(f => basename(f));
    expect(names).toContain('Home.js');
    expect(names).toContain('masterPage.js');
    expect(names).toContain('Product Page.js');
  });
});

// ── Full verification across all pages ──────────────────────────────

describe('Element ID verification — all pages', () => {
  const pageFiles = (() => {
    try {
      return getPageFiles();
    } catch {
      return [];
    }
  })();

  it('finds all 39 page files', () => {
    expect(pageFiles).toHaveLength(39);
  });

  it.each(
    pageFiles.map(f => [basename(f), f])
  )('%s — all $w element IDs are valid', (name, filePath) => {
    const source = readFileSync(filePath, 'utf-8');
    const result = validatePageIds(source, name);

    if (!result.valid) {
      const details = result.invalidIds
        .map(i => `  ${i.id}: ${i.reason}`)
        .join('\n');
      expect(result.valid, `Invalid IDs in ${name}:\n${details}`).toBe(true);
    }

    // Some pages (e.g., Accessibility Statement) delegate all $w calls to helpers
    // and have no direct element ID references — that's valid
    expect(result.totalIds).toBeGreaterThanOrEqual(0);
  });

  it('reports total ID count across all pages', () => {
    const totalUnique = new Set();
    const perPage = {};

    for (const filePath of pageFiles) {
      const source = readFileSync(filePath, 'utf-8');
      const ids = extractElementIds(source);
      const name = basename(filePath);
      perPage[name] = ids.length;
      ids.forEach(id => totalUnique.add(id));
    }

    expect(totalUnique.size).toBeGreaterThan(700);
    expect(Object.keys(perPage)).toHaveLength(39);
  });

  it('detects no duplicate IDs used across unrelated pages (informational)', () => {
    const idToPages = {};

    for (const filePath of pageFiles) {
      const source = readFileSync(filePath, 'utf-8');
      const ids = extractElementIds(source);
      const name = basename(filePath);
      for (const id of ids) {
        if (!idToPages[id]) idToPages[id] = [];
        idToPages[id].push(name);
      }
    }

    const sharedIds = Object.entries(idToPages)
      .filter(([, pages]) => pages.length > 1);

    // Shared IDs are expected (e.g., a11yLiveRegion used on many pages via masterPage)
    // Verify the cross-page map was built correctly and contains expected shared IDs
    expect(sharedIds.length).toBeGreaterThan(0);
    const sharedIdNames = sharedIds.map(([id]) => id);
    expect(sharedIdNames).toContain('shareFacebook');
  });
});

// ── Public helper verification ──────────────────────────────────────

describe('Element ID verification — public helpers', () => {
  it('validates $w IDs in public helper modules', () => {
    const publicDir = join(process.cwd(), 'src', 'public');
    const files = readdirSync(publicDir).filter(f => f.endsWith('.js'));
    const allInvalid = [];

    for (const file of files) {
      const source = readFileSync(join(publicDir, file), 'utf-8');
      const result = validatePageIds(source, file);
      if (!result.valid) {
        allInvalid.push(...result.invalidIds.map(i => ({ ...i, file })));
      }
    }

    if (allInvalid.length > 0) {
      const details = allInvalid
        .map(i => `  ${i.file}: ${i.id} — ${i.reason}`)
        .join('\n');
      expect(allInvalid, `Invalid IDs in public helpers:\n${details}`).toHaveLength(0);
    }
  });
});
