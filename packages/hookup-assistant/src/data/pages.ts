/**
 * PAGES data bundle — stub for S1 scaffold.
 *
 * S2 (CF-4rv2) will replace this stub with the full 28-page / 1,093-element
 * dataset extracted from docs/editor-hookup-guide.html.
 *
 * This module exports the data helpers used by the panel; the actual data
 * array is intentionally empty here so the app compiles and the panel
 * renders its placeholder state.
 */

import type { PageDef, ElementDef } from '../types/index.js';

export const PAGES: PageDef[] = [];

/** Return the ElementDef for a specific element ID on a page, or null. */
export function getElementDef(pageName: string, elementId: string): ElementDef | null {
  const page = PAGES.find((p) => p.name === pageName);
  if (!page) return null;
  for (const section of page.sections) {
    const hit =
      section.elements.find((e) => e.id === elementId) ??
      section.children?.find((e) => e.id === elementId) ??
      null;
    if (hit) return hit;
  }
  return null;
}

/** Return all elements for a page (sections + repeater children flattened). */
export function getAllElements(pageName: string): ElementDef[] {
  const page = PAGES.find((p) => p.name === pageName);
  if (!page) return [];
  return page.sections.flatMap((s) => [
    ...s.elements,
    ...(s.children ?? []),
  ]);
}

/** Return elements not yet hooked (their ID is not in hookedIds). */
export function getUnhookedElements(pageName: string, hookedIds: string[]): ElementDef[] {
  const hookedSet = new Set(hookedIds);
  return getAllElements(pageName).filter((e) => !hookedSet.has(e.id));
}
