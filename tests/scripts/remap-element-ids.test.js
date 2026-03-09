/**
 * Element ID Remapping Utility Tests (CF-d6ro)
 *
 * TDD: Tests written FIRST. Script does not exist yet.
 * Covers: mapping parsing, $w selector replacement, selector array replacement,
 * dry-run vs apply mode, summary output, error handling, edge cases.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { remapElementIds, parseMapping, replaceIds } from '../../scripts/remap-element-ids.js';

const TMP_DIR = join(process.cwd(), 'tests', 'scripts', '.tmp-remap');

function setupTmpDir(files = {}) {
  rmSync(TMP_DIR, { recursive: true, force: true });
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = join(TMP_DIR, relPath);
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
    mkdirSync(dir, { recursive: true });
    writeFileSync(fullPath, content, 'utf8');
  }
}

function readTmpFile(relPath) {
  return readFileSync(join(TMP_DIR, relPath), 'utf8');
}

afterEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

// ── parseMapping ─────────────────────────────────────────────────────

describe('parseMapping', () => {
  it('parses valid JSON mapping file', () => {
    setupTmpDir({ 'mapping.json': JSON.stringify({ oldBtn: 'newBtn', oldInput: 'newInput' }) });
    const mapping = parseMapping(join(TMP_DIR, 'mapping.json'));
    expect(mapping).toEqual({ oldBtn: 'newBtn', oldInput: 'newInput' });
  });

  it('throws on non-existent mapping file', () => {
    expect(() => parseMapping('/nonexistent/mapping.json')).toThrow();
  });

  it('throws on invalid JSON', () => {
    setupTmpDir({ 'bad.json': '{ not valid json' });
    expect(() => parseMapping(join(TMP_DIR, 'bad.json'))).toThrow(/invalid/i);
  });

  it('throws on non-object mapping (array)', () => {
    setupTmpDir({ 'arr.json': '["a", "b"]' });
    expect(() => parseMapping(join(TMP_DIR, 'arr.json'))).toThrow();
  });

  it('throws on empty mapping', () => {
    setupTmpDir({ 'empty.json': '{}' });
    expect(() => parseMapping(join(TMP_DIR, 'empty.json'))).toThrow(/empty/i);
  });

  it('throws when mapping values are not strings', () => {
    setupTmpDir({ 'bad-val.json': JSON.stringify({ oldId: 123 }) });
    expect(() => parseMapping(join(TMP_DIR, 'bad-val.json'))).toThrow();
  });

  it('throws when mapping keys are empty strings', () => {
    setupTmpDir({ 'empty-key.json': JSON.stringify({ '': 'newId' }) });
    expect(() => parseMapping(join(TMP_DIR, 'empty-key.json'))).toThrow();
  });
});

// ── replaceIds (pure string transform) ───────────────────────────────

describe('replaceIds', () => {
  const mapping = { oldButton: 'newButton', oldInput: 'newInput' };

  it('replaces $w single-quoted selectors', () => {
    const input = `$w('#oldButton').onClick(() => {});`;
    const result = replaceIds(input, mapping);
    expect(result).toBe(`$w('#newButton').onClick(() => {});`);
  });

  it('replaces $w double-quoted selectors', () => {
    const input = `$w("#oldButton").show();`;
    const result = replaceIds(input, mapping);
    expect(result).toBe(`$w("#newButton").show();`);
  });

  it('replaces multiple occurrences in same line', () => {
    const input = `$w('#oldButton').hide(); $w('#oldInput').value = '';`;
    const result = replaceIds(input, mapping);
    expect(result).toBe(`$w('#newButton').hide(); $w('#newInput').value = '';`);
  });

  it('replaces IDs across multiple lines', () => {
    const input = [
      `const btn = $w('#oldButton');`,
      `const inp = $w('#oldInput');`,
    ].join('\n');
    const result = replaceIds(input, mapping);
    expect(result).toContain(`$w('#newButton')`);
    expect(result).toContain(`$w('#newInput')`);
  });

  it('replaces IDs in selector arrays (single-quoted)', () => {
    const input = `collapseOnMobile($w, ['#oldButton', '#oldInput']);`;
    const result = replaceIds(input, mapping);
    expect(result).toBe(`collapseOnMobile($w, ['#newButton', '#newInput']);`);
  });

  it('replaces IDs in selector arrays (double-quoted)', () => {
    const input = `const ids = ["#oldButton", "#oldInput"];`;
    const result = replaceIds(input, mapping);
    expect(result).toBe(`const ids = ["#newButton", "#newInput"];`);
  });

  it('does not replace IDs that are not in the mapping', () => {
    const input = `$w('#keepMe').show();`;
    const result = replaceIds(input, mapping);
    expect(result).toBe(input);
  });

  it('does not replace partial ID matches', () => {
    const input = `$w('#oldButtonExtra').show();`;
    const result = replaceIds(input, mapping);
    expect(result).toBe(input);
  });

  it('does not replace IDs in comments', () => {
    // Note: basic implementation may still replace in comments.
    // This tests that plain text "oldButton" without $w/#  is NOT replaced.
    const input = `// reference to oldButton in prose`;
    const result = replaceIds(input, mapping);
    expect(result).toBe(input);
  });

  it('handles backtick template literals with $w', () => {
    const input = "const el = $w(`#oldButton`);";
    const result = replaceIds(input, mapping);
    expect(result).toBe("const el = $w(`#newButton`);");
  });

  it('returns original string when no replacements needed', () => {
    const input = `$w('#unrelated').show();`;
    const result = replaceIds(input, mapping);
    expect(result).toBe(input);
  });

  it('returns replacement count', () => {
    const input = `$w('#oldButton').hide(); $w('#oldButton').show(); $w('#oldInput').value;`;
    const { text, count } = replaceIds(input, mapping, { countMode: true });
    expect(text).toContain('#newButton');
    expect(text).toContain('#newInput');
    expect(count).toBe(3);
  });
});

// ── remapElementIds (full pipeline) ──────────────────────────────────

describe('remapElementIds', () => {
  const mappingContent = JSON.stringify({
    oldHeader: 'newHeader',
    oldFooter: 'newFooter',
  });

  it('dry-run does not modify files', () => {
    setupTmpDir({
      'mapping.json': mappingContent,
      'src/pages/Test.js': `$w('#oldHeader').show();`,
    });
    const result = remapElementIds({
      mappingPath: join(TMP_DIR, 'mapping.json'),
      scanDirs: [join(TMP_DIR, 'src')],
      apply: false,
    });
    expect(result.filesChanged).toBe(0);
    expect(result.totalReplacements).toBeGreaterThan(0);
    expect(readTmpFile('src/pages/Test.js')).toBe(`$w('#oldHeader').show();`);
  });

  it('dry-run reports would-be changes accurately', () => {
    setupTmpDir({
      'mapping.json': mappingContent,
      'src/pages/A.js': `$w('#oldHeader').show();\n$w('#oldFooter').hide();`,
      'src/pages/B.js': `$w('#oldHeader').onClick(() => {});`,
    });
    const result = remapElementIds({
      mappingPath: join(TMP_DIR, 'mapping.json'),
      scanDirs: [join(TMP_DIR, 'src')],
      apply: false,
    });
    expect(result.totalReplacements).toBe(3);
    expect(result.fileDetails).toHaveLength(2);
  });

  it('--apply writes modified files', () => {
    setupTmpDir({
      'mapping.json': mappingContent,
      'src/pages/Test.js': `$w('#oldHeader').show();\n$w('#oldFooter').hide();`,
    });
    const result = remapElementIds({
      mappingPath: join(TMP_DIR, 'mapping.json'),
      scanDirs: [join(TMP_DIR, 'src')],
      apply: true,
    });
    expect(result.filesChanged).toBe(1);
    const content = readTmpFile('src/pages/Test.js');
    expect(content).toContain(`$w('#newHeader')`);
    expect(content).toContain(`$w('#newFooter')`);
    expect(content).not.toContain('#oldHeader');
    expect(content).not.toContain('#oldFooter');
  });

  it('skips files with no matching IDs', () => {
    setupTmpDir({
      'mapping.json': mappingContent,
      'src/pages/NoMatch.js': `$w('#unrelated').show();`,
      'src/pages/Match.js': `$w('#oldHeader').show();`,
    });
    const result = remapElementIds({
      mappingPath: join(TMP_DIR, 'mapping.json'),
      scanDirs: [join(TMP_DIR, 'src')],
      apply: true,
    });
    expect(result.filesChanged).toBe(1);
    expect(result.filesScanned).toBe(2);
  });

  it('scans multiple directories', () => {
    setupTmpDir({
      'mapping.json': mappingContent,
      'src/pages/Page.js': `$w('#oldHeader').show();`,
      'tests/page.test.js': `$w('#oldHeader').show();`,
    });
    const result = remapElementIds({
      mappingPath: join(TMP_DIR, 'mapping.json'),
      scanDirs: [join(TMP_DIR, 'src'), join(TMP_DIR, 'tests')],
      apply: true,
    });
    expect(result.filesChanged).toBe(2);
    expect(readTmpFile('src/pages/Page.js')).toContain('#newHeader');
    expect(readTmpFile('tests/page.test.js')).toContain('#newHeader');
  });

  it('only scans .js files', () => {
    setupTmpDir({
      'mapping.json': mappingContent,
      'src/data.json': `{ "id": "#oldHeader" }`,
      'src/page.js': `$w('#oldHeader').show();`,
    });
    const result = remapElementIds({
      mappingPath: join(TMP_DIR, 'mapping.json'),
      scanDirs: [join(TMP_DIR, 'src')],
      apply: true,
    });
    expect(result.filesChanged).toBe(1);
    // JSON file should be untouched
    expect(readTmpFile('src/data.json')).toContain('#oldHeader');
  });

  it('handles deeply nested directory structures', () => {
    setupTmpDir({
      'mapping.json': mappingContent,
      'src/public/helpers/deep/helper.js': `$w('#oldFooter').collapse();`,
    });
    const result = remapElementIds({
      mappingPath: join(TMP_DIR, 'mapping.json'),
      scanDirs: [join(TMP_DIR, 'src')],
      apply: true,
    });
    expect(result.filesChanged).toBe(1);
    expect(readTmpFile('src/public/helpers/deep/helper.js')).toContain('#newFooter');
  });

  it('provides per-file detail in summary', () => {
    setupTmpDir({
      'mapping.json': mappingContent,
      'src/a.js': `$w('#oldHeader').show(); $w('#oldFooter').hide();`,
      'src/b.js': `$w('#oldHeader').click();`,
    });
    const result = remapElementIds({
      mappingPath: join(TMP_DIR, 'mapping.json'),
      scanDirs: [join(TMP_DIR, 'src')],
      apply: false,
    });
    expect(result.fileDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ replacements: 2 }),
        expect.objectContaining({ replacements: 1 }),
      ])
    );
  });

  it('handles selector arrays in apply mode', () => {
    setupTmpDir({
      'mapping.json': mappingContent,
      'src/page.js': `collapseOnMobile($w, ['#oldHeader', '#oldFooter']);`,
    });
    const result = remapElementIds({
      mappingPath: join(TMP_DIR, 'mapping.json'),
      scanDirs: [join(TMP_DIR, 'src')],
      apply: true,
    });
    expect(result.totalReplacements).toBe(2);
    const content = readTmpFile('src/page.js');
    expect(content).toBe(`collapseOnMobile($w, ['#newHeader', '#newFooter']);`);
  });
});

// ── Edge cases & error handling ──────────────────────────────────────

describe('edge cases', () => {
  it('handles empty source files gracefully', () => {
    setupTmpDir({
      'mapping.json': JSON.stringify({ oldId: 'newId' }),
      'src/empty.js': '',
    });
    const result = remapElementIds({
      mappingPath: join(TMP_DIR, 'mapping.json'),
      scanDirs: [join(TMP_DIR, 'src')],
      apply: false,
    });
    expect(result.filesScanned).toBe(1);
    expect(result.filesChanged).toBe(0);
  });

  it('handles scan directory that does not exist', () => {
    setupTmpDir({
      'mapping.json': JSON.stringify({ oldId: 'newId' }),
    });
    expect(() =>
      remapElementIds({
        mappingPath: join(TMP_DIR, 'mapping.json'),
        scanDirs: [join(TMP_DIR, 'nonexistent')],
        apply: false,
      })
    ).toThrow();
  });

  it('preserves file encoding and line endings', () => {
    const content = `$w('#oldId').show();\r\n$w('#oldId').hide();\r\n`;
    setupTmpDir({
      'mapping.json': JSON.stringify({ oldId: 'newId' }),
      'src/crlf.js': content,
    });
    remapElementIds({
      mappingPath: join(TMP_DIR, 'mapping.json'),
      scanDirs: [join(TMP_DIR, 'src')],
      apply: true,
    });
    const result = readTmpFile('src/crlf.js');
    expect(result).toContain('\r\n');
    expect(result).toContain('#newId');
  });

  it('does not double-replace when new ID matches another mapping key', () => {
    // mapping: a→b, b→c should NOT result in a→c
    setupTmpDir({
      'mapping.json': JSON.stringify({ alpha: 'beta', beta: 'gamma' }),
      'src/chain.js': `$w('#alpha').show(); $w('#beta').hide();`,
    });
    remapElementIds({
      mappingPath: join(TMP_DIR, 'mapping.json'),
      scanDirs: [join(TMP_DIR, 'src')],
      apply: true,
    });
    const content = readTmpFile('src/chain.js');
    expect(content).toBe(`$w('#beta').show(); $w('#gamma').hide();`);
  });
});
