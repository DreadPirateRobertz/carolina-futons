import { describe, it, expect } from 'vitest';
import {
  PAGES,
  getElementDef,
  getAllElements,
  getUnhookedElements,
} from '../data/pages.js';

describe('PAGES data helpers (S1 stub)', () => {
  it('exports PAGES array', () => {
    expect(Array.isArray(PAGES)).toBe(true);
  });

  it('getElementDef returns null for unknown page', () => {
    expect(getElementDef('NonExistentPage', 'heroTitle')).toBeNull();
  });

  it('getElementDef returns null for unknown element', () => {
    // PAGES is empty in S1 stub — null is expected
    expect(getElementDef('Home', 'heroTitle')).toBeNull();
  });

  it('getAllElements returns empty array for unknown page', () => {
    expect(getAllElements('NonExistentPage')).toEqual([]);
  });

  it('getUnhookedElements returns empty array when no elements defined', () => {
    expect(getUnhookedElements('Home', [])).toEqual([]);
  });
});
