/**
 * Tests for check-element-id-sync.js (CF-p3ri)
 *
 * Covers: parseElementIds, resolvePageFile, elementIdUsedInSource, runSyncCheck.
 * Uses a temp directory to avoid touching real src/pages files.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import {
  parseElementIds,
  resolvePageFile,
  elementIdUsedInSource,
  runSyncCheck,
} from '../../scripts/check-element-id-sync.js';

const TMP_DIR = join(process.cwd(), 'tests', 'scripts', '.tmp-sync-check');

function setupTmpDir(files = {}) {
  rmSync(TMP_DIR, { recursive: true, force: true });
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = join(TMP_DIR, relPath);
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
    mkdirSync(dir, { recursive: true });
    writeFileSync(fullPath, content, 'utf8');
  }
}

afterEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

// -- parseElementIds ----------------------------------------------------------

describe('parseElementIds', () => {
  it('extracts element IDs for a single page', () => {
    const source = `
      { file: 'Home.js', sections: [{ elements: [
        { id: 'heroSection', type: 'Section' },
        { id: 'heroBg', type: 'Image' },
      ] }] }
    `;
    const results = parseElementIds(source);
    expect(results.map(r => r.elementId)).toContain('heroSection');
    expect(results.map(r => r.elementId)).toContain('heroBg');
    expect(results.every(r => r.pageFile === 'Home.js')).toBe(true);
  });

  it('assigns correct pageFile for each element', () => {
    const source = `
      file: 'Page1.js',
      elements: [{ id: 'btn1', type: 'Button' }],
      file: 'Page2.js',
      elements: [{ id: 'btn2', type: 'Button' }],
    `;
    const results = parseElementIds(source);
    const btn1Entry = results.find(r => r.elementId === 'btn1');
    const btn2Entry = results.find(r => r.elementId === 'btn2');
    expect(btn1Entry?.pageFile).toBe('Page1.js');
    expect(btn2Entry?.pageFile).toBe('Page2.js');
  });

  it('skips multi-file entries', () => {
    const source = `
      file: 'FileA.js + FileB.js',
      elements: [{ id: 'sharedBtn', type: 'Button' }],
    `;
    const results = parseElementIds(source);
    expect(results).toHaveLength(0);
  });

  it('returns empty array for source with no file entries', () => {
    const results = parseElementIds('const x = 1;');
    expect(results).toHaveLength(0);
  });

  it('handles hash-suffixed file names', () => {
    const source = `
      file: 'Home.c1dmp.js',
      elements: [{ id: 'heroSection', type: 'Section' }],
    `;
    const results = parseElementIds(source);
    expect(results[0]?.pageFile).toBe('Home.c1dmp.js');
    expect(results[0]?.elementId).toBe('heroSection');
  });

  it('same id twice in source still appears in output', () => {
    const source = `
      file: 'Page.js',
      elements: [
        { id: 'btn', type: 'Button' },
        { id: 'btn', type: 'Button' },
      ],
    `;
    const results = parseElementIds(source);
    const btns = results.filter(r => r.elementId === 'btn');
    expect(btns.length).toBeGreaterThanOrEqual(1);
  });
});

// -- resolvePageFile ----------------------------------------------------------

describe('resolvePageFile', () => {
  it('returns exact path when file exists verbatim', () => {
    setupTmpDir({ 'pages/Home.js': '// home' });
    const pagesDir = join(TMP_DIR, 'pages');
    const result = resolvePageFile('Home.js', pagesDir);
    expect(result).toBe(join(pagesDir, 'Home.js'));
  });

  it('strips hash segment to find real file', () => {
    setupTmpDir({ 'pages/Home.js': '// home' });
    const pagesDir = join(TMP_DIR, 'pages');
    const result = resolvePageFile('Home.c1dmp.js', pagesDir);
    expect(result).toBe(join(pagesDir, 'Home.js'));
  });

  it('returns null when no matching file exists', () => {
    setupTmpDir({ 'pages/Other.js': '// other' });
    const pagesDir = join(TMP_DIR, 'pages');
    expect(resolvePageFile('NonExistent.js', pagesDir)).toBeNull();
  });

  it('returns null for hash that does not match any file', () => {
    setupTmpDir({ 'pages/About.js': '' });
    const pagesDir = join(TMP_DIR, 'pages');
    expect(resolvePageFile('Missing.xyz99.js', pagesDir)).toBeNull();
  });
});

// -- elementIdUsedInSource ----------------------------------------------------

describe('elementIdUsedInSource', () => {
  it('detects single-quoted $w selector', () => {
    expect(elementIdUsedInSource("$w('#heroSection')", 'heroSection')).toBe(true);
  });

  it('detects double-quoted $w selector', () => {
    expect(elementIdUsedInSource('$w("#heroSection")', 'heroSection')).toBe(true);
  });

  it('returns false when element ID is not used', () => {
    expect(elementIdUsedInSource("$w('#otherBtn')", 'heroSection')).toBe(false);
  });

  it('does not match partial IDs', () => {
    expect(elementIdUsedInSource("$w('#hero')", 'heroSection')).toBe(false);
  });

  it('handles element IDs with camelCase', () => {
    expect(elementIdUsedInSource("$w('#featuredQuickViewBtn')", 'featuredQuickViewBtn')).toBe(true);
  });

  it('returns false on empty source', () => {
    expect(elementIdUsedInSource('', 'heroSection')).toBe(false);
  });
});

// -- runSyncCheck -------------------------------------------------------------

describe('runSyncCheck', () => {
  it('reports zero mismatches when all IDs are present in page source', () => {
    setupTmpDir({
      'packages/hookup-assistant/src/data/pages.ts': `
        export const PAGES = [{
          file: 'Home.js',
          sections: [{ elements: [
            { id: 'heroSection', type: 'Section' },
            { id: 'heroBg', type: 'Image' },
          ]}]
        }];
      `,
      'src/pages/Home.js': `
        $w('#heroSection').show();
        $w('#heroBg').src = url;
      `,
    });
    const { mismatches, checked } = runSyncCheck({ root: TMP_DIR, quiet: true });
    expect(mismatches).toHaveLength(0);
    expect(checked).toBeGreaterThanOrEqual(2);
  });

  it('reports mismatches when IDs are missing from page source', () => {
    setupTmpDir({
      'packages/hookup-assistant/src/data/pages.ts': `
        export const PAGES = [{
          file: 'Home.js',
          sections: [{ elements: [
            { id: 'heroSection', type: 'Section' },
            { id: 'missingBtn', type: 'Button' },
          ]}]
        }];
      `,
      'src/pages/Home.js': `
        $w('#heroSection').show();
      `,
    });
    const { mismatches } = runSyncCheck({ root: TMP_DIR, quiet: true });
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0].elementId).toBe('missingBtn');
  });

  it('skips pages whose source file cannot be resolved', () => {
    setupTmpDir({
      'packages/hookup-assistant/src/data/pages.ts': `
        export const PAGES = [{
          file: 'NoSuchPage.js',
          sections: [{ elements: [{ id: 'btn', type: 'Button' }] }]
        }];
      `,
    });
    const { skipped, checked } = runSyncCheck({ root: TMP_DIR, quiet: true });
    expect(skipped).toContain('NoSuchPage.js');
    expect(checked).toBe(0);
  });

  it('skips multi-file entries at parse time', () => {
    setupTmpDir({
      'packages/hookup-assistant/src/data/pages.ts': `
        export const PAGES = [{
          file: 'SocialFeedEmbed.js + socialStoryHelpers.js',
          sections: [{ elements: [{ id: 'socialFeed', type: 'Box' }] }]
        }];
      `,
    });
    const { checked, skipped } = runSyncCheck({ root: TMP_DIR, quiet: true });
    expect(checked).toBe(0);
    expect(skipped).toHaveLength(0);
  });

  it('resolves hash-suffixed file names to plain page files', () => {
    setupTmpDir({
      'packages/hookup-assistant/src/data/pages.ts': `
        export const PAGES = [{
          file: 'Home.c1dmp.js',
          sections: [{ elements: [{ id: 'heroSection', type: 'Section' }] }]
        }];
      `,
      'src/pages/Home.js': `$w('#heroSection').show();`,
    });
    const { mismatches, checked } = runSyncCheck({ root: TMP_DIR, quiet: true });
    expect(checked).toBe(1);
    expect(mismatches).toHaveLength(0);
  });

  it('throws when pages.ts does not exist', () => {
    setupTmpDir({});
    expect(() => runSyncCheck({ root: TMP_DIR, quiet: true })).toThrow(/pages\.ts not found/);
  });

  it('deduplicates element IDs per page (same ID twice counts once)', () => {
    setupTmpDir({
      'packages/hookup-assistant/src/data/pages.ts': `
        export const PAGES = [{
          file: 'Home.js',
          sections: [{ elements: [
            { id: 'heroSection', type: 'Section' },
            { id: 'heroSection', type: 'Section' },
          ]}]
        }];
      `,
      'src/pages/Home.js': `$w('#heroSection').show();`,
    });
    const { mismatches, checked } = runSyncCheck({ root: TMP_DIR, quiet: true });
    expect(checked).toBe(1);
    expect(mismatches).toHaveLength(0);
  });

  it('returns mismatch details with pageFile and elementId', () => {
    setupTmpDir({
      'packages/hookup-assistant/src/data/pages.ts': `
        export const PAGES = [{
          file: 'Contact.js',
          sections: [{ elements: [{ id: 'contactForm', type: 'Form' }] }]
        }];
      `,
      'src/pages/Contact.js': `// no selectors here`,
    });
    const { mismatches } = runSyncCheck({ root: TMP_DIR, quiet: true });
    expect(mismatches[0]).toMatchObject({ pageFile: 'Contact.js', elementId: 'contactForm' });
  });

  it('handles multiple pages with mixed pass/fail', () => {
    setupTmpDir({
      'packages/hookup-assistant/src/data/pages.ts': `
        export const PAGES = [
          {
            file: 'Home.js',
            sections: [{ elements: [{ id: 'heroSection', type: 'Section' }] }]
          },
          {
            file: 'About.js',
            sections: [{ elements: [{ id: 'aboutMissing', type: 'Box' }] }]
          }
        ];
      `,
      'src/pages/Home.js': `$w('#heroSection').show();`,
      'src/pages/About.js': `// no selectors`,
    });
    const { mismatches, checked } = runSyncCheck({ root: TMP_DIR, quiet: true });
    expect(checked).toBe(2);
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0].pageFile).toBe('About.js');
  });
});
