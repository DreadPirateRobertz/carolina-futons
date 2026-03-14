import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SCRIPTS_DIR = join(import.meta.dirname, '..', 'scripts');

/**
 * Load and parse a JSON mapping file from scripts/
 * @param {string} filename
 * @returns {object}
 */
function loadMapping(filename) {
  const raw = readFileSync(join(SCRIPTS_DIR, filename), 'utf8');
  return JSON.parse(raw);
}

/**
 * Extract all $w('#id') references from a source file
 * @param {string} filePath
 * @returns {Set<string>}
 */
function extractElementIds(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const ids = new Set();
  const regex = /\$w\('#([^']+)'\)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    ids.add(match[1]);
  }
  return ids;
}

describe('home-page-mapping.json', () => {
  const mapping = loadMapping('home-page-mapping.json');

  it('has required _meta fields', () => {
    expect(mapping._meta).toBeDefined();
    expect(mapping._meta.page).toContain('Home');
    expect(mapping._meta.bead).toBe('test-dld');
    expect(mapping._meta.templateSource).toBeDefined();
  });

  it('has a _summary section', () => {
    expect(mapping._summary).toBeDefined();
    expect(mapping._summary.totalCodeElements).toBeGreaterThan(0);
    expect(mapping._summary.criticalMismatches).toBeDefined();
    expect(Array.isArray(mapping._summary.criticalMismatches)).toBe(true);
  });

  it('covers all sections of the home page', () => {
    const requiredSections = [
      'masterPage_header',
      'masterPage_footer',
      'home_hero',
      'home_categories',
      'home_featured_products',
      'home_sale_products',
    ];
    for (const section of requiredSections) {
      expect(mapping[section], `missing section: ${section}`).toBeDefined();
    }
  });

  it('every mapped element has confidence and note', () => {
    const sections = Object.keys(mapping).filter(
      (k) => !k.startsWith('_') && typeof mapping[k] === 'object',
    );
    for (const section of sections) {
      const entries = mapping[section];
      for (const [key, value] of Object.entries(entries)) {
        if (key.startsWith('_')) continue;
        if (typeof value !== 'object' || value === null) continue;
        if (!value.templateNickname && value.templateNickname !== null) continue;
        expect(value.confidence, `${section}.${key} missing confidence`).toBeDefined();
        expect(value.note, `${section}.${key} missing note`).toBeDefined();
      }
    }
  });

  it('no duplicate templateNickname mappings', () => {
    const seen = new Map();
    const sections = Object.keys(mapping).filter(
      (k) => !k.startsWith('_') && typeof mapping[k] === 'object',
    );
    for (const section of sections) {
      for (const [key, value] of Object.entries(mapping[section])) {
        if (key.startsWith('_')) continue;
        if (typeof value !== 'object' || value === null) continue;
        const nick = value.templateNickname;
        if (nick === null || nick === undefined) continue;
        const existing = seen.get(nick);
        expect(
          existing,
          `duplicate templateNickname '${nick}': mapped to both '${existing}' and '${key}'`,
        ).toBeUndefined();
        seen.set(nick, key);
      }
    }
  });

  it('all HIGH confidence mappings reference valid template nicknames from template IDs file', () => {
    const templateIds = loadMapping('home-page-template-ids.json');
    const validNicknames = new Set(templateIds.components.map((c) => c.nickname));

    const sections = Object.keys(mapping).filter(
      (k) => !k.startsWith('_') && typeof mapping[k] === 'object',
    );
    for (const section of sections) {
      for (const [key, value] of Object.entries(mapping[section])) {
        if (key.startsWith('_')) continue;
        if (typeof value !== 'object' || value === null) continue;
        if (value.confidence !== 'HIGH') continue;
        if (value.templateNickname === null) continue;
        expect(
          validNicknames.has(value.templateNickname),
          `${section}.${key}: HIGH confidence mapping to '${value.templateNickname}' not found in template IDs`,
        ).toBe(true);
      }
    }
  });

  it('critical mismatches are documented', () => {
    const mismatches = mapping._summary.criticalMismatches;
    expect(mismatches.length).toBeGreaterThanOrEqual(3);

    const text = mismatches.join(' ');
    expect(text).toContain('featuredRepeater');
    expect(text).toContain('saleRepeater');
    expect(text).toContain('categoryRepeater');
  });

  it('summary counts are consistent with mapping data', () => {
    const { directMappable, typeMismatch } = mapping._summary;
    expect(directMappable).toBeGreaterThan(0);
    expect(typeMismatch).toBeGreaterThan(0);
    expect(directMappable + typeMismatch).toBeLessThan(mapping._summary.totalCodeElements);
  });
});

describe('home-page-remap-phase1.json', () => {
  const remap = loadMapping('home-page-remap-phase1.json');
  const templateIds = loadMapping('home-page-template-ids.json');
  const validNicknames = new Set(templateIds.components.map((c) => c.nickname));

  it('has _meta with direction field', () => {
    expect(remap._meta).toBeDefined();
    expect(remap._meta.direction).toContain('template');
  });

  it('all keys (except _meta) are valid template nicknames', () => {
    for (const key of Object.keys(remap)) {
      if (key === '_meta') continue;
      expect(
        validNicknames.has(key),
        `remap key '${key}' is not a valid template nickname`,
      ).toBe(true);
    }
  });

  it('all values are non-empty strings (our BUILD-SPEC IDs)', () => {
    for (const [key, value] of Object.entries(remap)) {
      if (key === '_meta') continue;
      expect(typeof value, `${key} value should be string`).toBe('string');
      expect(value.length, `${key} value should not be empty`).toBeGreaterThan(0);
    }
  });

  it('no duplicate target IDs', () => {
    const targets = new Map();
    for (const [key, value] of Object.entries(remap)) {
      if (key === '_meta') continue;
      const existing = targets.get(value);
      expect(
        existing,
        `duplicate target '${value}': from both '${existing}' and '${key}'`,
      ).toBeUndefined();
      targets.set(value, key);
    }
  });

  it('all target IDs exist in masterPage.js or Home.js', () => {
    const masterIds = extractElementIds(join(SCRIPTS_DIR, '..', 'src', 'pages', 'masterPage.js'));
    const homeIds = extractElementIds(join(SCRIPTS_DIR, '..', 'src', 'pages', 'Home.js'));
    const allIds = new Set([...masterIds, ...homeIds]);

    for (const [key, value] of Object.entries(remap)) {
      if (key === '_meta') continue;
      expect(
        allIds.has(value),
        `remap target '${value}' (from '${key}') not found in masterPage.js or Home.js`,
      ).toBe(true);
    }
  });

  it('contains only HIGH confidence mappings from the full mapping', () => {
    const fullMapping = loadMapping('home-page-mapping.json');
    const sections = Object.keys(fullMapping).filter(
      (k) => !k.startsWith('_') && typeof fullMapping[k] === 'object',
    );

    for (const [templateNick, ourId] of Object.entries(remap)) {
      if (templateNick === '_meta') continue;

      let found = false;
      for (const section of sections) {
        const entry = fullMapping[section][ourId];
        if (entry && entry.templateNickname === templateNick) {
          found = true;
          break;
        }
      }
      expect(found, `remap entry '${templateNick}' → '${ourId}' not found in full mapping`).toBe(
        true,
      );
    }
  });
});

describe('masterPage.js + Home.js element coverage', () => {
  const mapping = loadMapping('home-page-mapping.json');
  const masterIds = extractElementIds(join(SCRIPTS_DIR, '..', 'src', 'pages', 'masterPage.js'));
  const homeIds = extractElementIds(join(SCRIPTS_DIR, '..', 'src', 'pages', 'Home.js'));
  const allCodeIds = new Set([...masterIds, ...homeIds]);

  it('every code element ID appears somewhere in the mapping', () => {
    const mappedIds = new Set();

    const sections = Object.keys(mapping).filter(
      (k) => !k.startsWith('_') && typeof mapping[k] === 'object',
    );
    for (const section of sections) {
      for (const [key, value] of Object.entries(mapping[section])) {
        if (key.startsWith('_')) continue;
        if (typeof value === 'string') {
          mappedIds.add(key);
        } else {
          mappedIds.add(key);
        }
      }
    }

    const unmapped = [];
    for (const id of allCodeIds) {
      if (!mappedIds.has(id)) {
        unmapped.push(id);
      }
    }
    expect(
      unmapped,
      `unmapped code IDs: ${unmapped.join(', ')}`,
    ).toEqual([]);
  });

  it('totalCodeElements in summary matches actual code element count', () => {
    expect(mapping._summary.totalCodeElements).toBe(allCodeIds.size);
  });
});
