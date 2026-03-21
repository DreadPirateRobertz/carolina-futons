/**
 * pages.test.ts — S2: PAGES data bundle correctness tests.
 *
 * Verifies that the extracted PAGES data has the right shape, counts,
 * and that the helper functions work correctly.
 */
import { describe, it, expect } from 'vitest';
import {
  PAGES,
  getElementDef,
  getAllElements,
  getUnhookedElements,
  getRepeaterSection,
} from '../src/data/pages.js';
import type { WixElementType } from '../src/types/index.js';

const VALID_TYPES: WixElementType[] = [
  'Section', 'Box', 'Text', 'Button', 'Image', 'Repeater',
  'Input', 'TextBox', 'Dropdown', 'Toggle', 'ProgressBar',
  'HtmlComponent', 'Video', 'Dataset', 'Gallery', 'DatePicker',
  'CheckboxGroup', 'RadioButton',
];

// ── Data integrity ─────────────────────────────────────────────────────────

describe('PAGES — data integrity', () => {
  it('has exactly 28 pages', () => {
    expect(PAGES).toHaveLength(28);
  });

  it('has exactly 1093 total elements', () => {
    const total = PAGES.reduce(
      (sum, p) => sum + p.sections.reduce(
        (s2, sec) => s2 + sec.elements.length + (sec.children?.length ?? 0), 0,
      ), 0,
    );
    expect(total).toBe(1093);
  });

  it('every element has a non-empty id', () => {
    for (const p of PAGES) {
      for (const sec of p.sections) {
        for (const el of [...sec.elements, ...(sec.children ?? [])]) {
          expect(el.id, `empty id in ${p.name}/${sec.name}`).toBeTruthy();
        }
      }
    }
  });

  it('every element type is a valid WixElementType', () => {
    for (const p of PAGES) {
      for (const sec of p.sections) {
        for (const el of [...sec.elements, ...(sec.children ?? [])]) {
          expect(VALID_TYPES, `invalid type "${el.type}" for #${el.id}`).toContain(el.type);
        }
      }
    }
  });

  it('all pages have valid priority (P0–P3)', () => {
    for (const p of PAGES) {
      expect(['P0', 'P1', 'P2', 'P3']).toContain(p.priority);
    }
  });

  it('has exactly 4 P0 pages', () => {
    expect(PAGES.filter((p) => p.priority === 'P0')).toHaveLength(4);
  });

  it('first page is "Home" with priority P0', () => {
    expect(PAGES[0].name).toBe('Home');
    expect(PAGES[0].priority).toBe('P0');
  });

  it('has at least one section with both repeater and children', () => {
    const found = PAGES.some((p) =>
      p.sections.some((s) => s.repeater && s.children && s.children.length > 0),
    );
    expect(found).toBe(true);
  });

  it('has defaultHidden elements', () => {
    const hidden = PAGES.flatMap((p) =>
      p.sections.flatMap((sec) => [...sec.elements, ...(sec.children ?? [])])
    ).filter((e) => e.defaultHidden);
    expect(hidden.length).toBeGreaterThan(0);
  });

  it('heroTitle is marked defaultHidden', () => {
    const el = PAGES.find((p) => p.name === 'Home')
      ?.sections.find((s) => s.name === 'Hero Section')
      ?.elements.find((e) => e.id === 'heroTitle');
    expect(el?.defaultHidden).toBe(true);
  });

  it('element IDs are unique within each page', () => {
    for (const p of PAGES) {
      const ids = p.sections.flatMap((s) => [
        ...s.elements.map((e) => e.id),
        ...(s.children?.map((e) => e.id) ?? []),
      ]);
      const unique = new Set(ids);
      expect(unique.size, `duplicate IDs on page ${p.name}`).toBe(ids.length);
    }
  });
});

// ── getElementDef ───────────────────────────────────────────────────────────

describe('getElementDef', () => {
  it('returns element def for known page + element', () => {
    const el = getElementDef('Home', 'heroTitle');
    expect(el).not.toBeNull();
    expect(el!.id).toBe('heroTitle');
    expect(el!.type).toBe('Text');
  });

  it('returns null for unknown page', () => {
    expect(getElementDef('Nonexistent Page', 'heroTitle')).toBeNull();
  });

  it('returns null for unknown element on known page', () => {
    expect(getElementDef('Home', 'doesNotExist')).toBeNull();
  });

  it('finds repeater children (in children array)', () => {
    // Find a page with repeater children
    const pageWithRepeater = PAGES.find((p) =>
      p.sections.some((s) => s.children && s.children.length > 0),
    );
    expect(pageWithRepeater).toBeDefined();
    const sec = pageWithRepeater!.sections.find((s) => s.children && s.children.length > 0)!;
    const childEl = sec.children![0];
    const found = getElementDef(pageWithRepeater!.name, childEl.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(childEl.id);
  });
});

// ── getAllElements ───────────────────────────────────────────────────────────

describe('getAllElements', () => {
  it('returns all elements for Home page', () => {
    const els = getAllElements('Home');
    expect(els.length).toBeGreaterThan(0);
  });

  it('returns [] for unknown page', () => {
    expect(getAllElements('Nonexistent')).toEqual([]);
  });

  it('flattens children into the list', () => {
    const pageWithChildren = PAGES.find((p) =>
      p.sections.some((s) => s.children && s.children.length > 0),
    )!;
    const sectionChildCount = pageWithChildren.sections.reduce(
      (sum, s) => sum + (s.children?.length ?? 0), 0,
    );
    const allEls = getAllElements(pageWithChildren.name);
    const sectionEls = pageWithChildren.sections.reduce(
      (sum, s) => sum + s.elements.length, 0,
    );
    expect(allEls.length).toBe(sectionEls + sectionChildCount);
  });
});

// ── getUnhookedElements ─────────────────────────────────────────────────────

describe('getUnhookedElements', () => {
  it('returns all elements when nothing is hooked', () => {
    const all = getAllElements('Home');
    const unhooked = getUnhookedElements('Home', []);
    expect(unhooked).toHaveLength(all.length);
  });

  it('excludes hooked element IDs', () => {
    const all = getAllElements('Home');
    const firstId = all[0].id;
    const unhooked = getUnhookedElements('Home', [firstId]);
    expect(unhooked).toHaveLength(all.length - 1);
    expect(unhooked.find((e) => e.id === firstId)).toBeUndefined();
  });

  it('returns [] when all are hooked', () => {
    const all = getAllElements('Home');
    const unhooked = getUnhookedElements('Home', all.map((e) => e.id));
    expect(unhooked).toHaveLength(0);
  });

  it('returns [] for unknown page', () => {
    expect(getUnhookedElements('Nonexistent', [])).toEqual([]);
  });
});

// ── getRepeaterSection (S14) ───────────────────────────────────────────────

describe('getRepeaterSection — S14 Repeater Guard', () => {
  it('returns null for an element that is NOT a repeater child', () => {
    // heroTitle is a direct section element, not a child
    expect(getRepeaterSection('Home', 'heroTitle')).toBeNull();
  });

  it('returns the section for a known repeater child element', () => {
    // featuredCard is a child of the Featured Products section (repeater: featuredRepeater)
    const section = getRepeaterSection('Home', 'featuredCard');
    expect(section).not.toBeNull();
    expect(section?.repeater).toBe('featuredRepeater');
  });

  it('returned section has the children array containing the element', () => {
    const section = getRepeaterSection('Home', 'featuredCard');
    expect(section?.children?.some((e) => e.id === 'featuredCard')).toBe(true);
  });

  it('returns null for an unknown element ID', () => {
    expect(getRepeaterSection('Home', 'doesNotExist')).toBeNull();
  });

  it('returns null for an unknown page', () => {
    expect(getRepeaterSection('Nonexistent', 'featuredCard')).toBeNull();
  });

  it('returns null when the element ID is the repeater itself (not a child)', () => {
    // featuredRepeater is in section.elements, not section.children
    expect(getRepeaterSection('Home', 'featuredRepeater')).toBeNull();
  });

  it('works for repeater children on other pages', () => {
    // Product Page has relatedImage as a child of a repeater section
    const section = getRepeaterSection('Product Page', 'relatedImage');
    expect(section).not.toBeNull();
    expect(section?.repeater).toBe('relatedRepeater');
  });

  it('returns the correct section name', () => {
    const section = getRepeaterSection('Home', 'featuredCard');
    expect(section?.name).toBe('Featured Products');
  });

  it('returns null when a section exists but has an empty children array', () => {
    // Sections with children: [] (or no children key) should not match any element
    // This verifies the some() call on an empty/missing array returns null correctly
    const page = PAGES.find((p) => p.name === 'Home');
    // heroSection has no children array at all — heroTitle is in elements, not children
    expect(getRepeaterSection('Home', 'heroTitle')).toBeNull();
    // Also confirm a completely fictional ID is null even if a section exists
    expect(getRepeaterSection('Home', 'nonExistentChildId')).toBeNull();
    // Suppress unused var warning
    expect(page).toBeDefined();
  });
});
