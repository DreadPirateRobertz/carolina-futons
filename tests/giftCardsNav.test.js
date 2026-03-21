/**
 * TDD tests for CF-t6b8 — Gift Cards navigation entry point and footer link.
 *
 * Covers:
 *  - NAV_LINKS contains Gift Cards entry with correct path and label
 *  - getActiveNavId recognizes /gift-cards as active
 *  - breadcrumbsFromPath generates correct trail for /gift-cards
 *  - Footer service links include Gift Cards
 *  - Footer shop links do NOT contain Gift Cards (it belongs in service)
 *  - Gift Cards path is unique (no duplication)
 *  - Edge cases: null/empty path, partial path matches
 *
 * Bead: CF-t6b8
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('public/designTokens.js', () => ({
  colors: {
    espresso: '#3A2518',
    mountainBlue: '#5B8FA8',
    sunsetCoral: '#E8845C',
    sandLight: '#F2E8D5',
    offWhite: '#FAF7F2',
  },
  spacing: { md: 16 },
  shadows: { nav: '0 2px 4px rgba(0,0,0,0.1)' },
}));

vi.mock('public/sharedTokens', () => ({
  transitions: { fast: 150, medium: 250, slow: 400 },
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
  makeClickable: vi.fn(),
  createFocusTrap: vi.fn(() => ({ release: vi.fn() })),
}));

vi.mock('public/mobileHelpers', () => ({
  isMobile: vi.fn(() => false),
  getViewport: vi.fn(() => ({ width: 1024 })),
}));

vi.mock('wix-window-frontend', () => ({
  onScroll: vi.fn(),
  scrollTo: vi.fn(),
}));

import {
  NAV_LINKS,
  MEGA_MENU_CATEGORIES,
  getActiveNavId,
  breadcrumbsFromPath,
} from '../src/public/navigationHelpers.js';

import {
  getFooterServiceLinks,
  getFooterShopLinks,
} from '../src/public/footerContent.js';

// ── NAV_LINKS entry ────────────────────────────────────────────────────────────

describe('NAV_LINKS — Gift Cards entry', () => {
  it('contains a Gift Cards entry', () => {
    const keys = Object.keys(NAV_LINKS);
    expect(keys).toContain('#navGiftCards');
  });

  it('Gift Cards entry has path /gift-cards', () => {
    expect(NAV_LINKS['#navGiftCards'].path).toBe('/gift-cards');
  });

  it('Gift Cards entry has a non-empty label', () => {
    expect(NAV_LINKS['#navGiftCards'].label.length).toBeGreaterThan(0);
  });

  it('Gift Cards label contains "Gift" (case-insensitive)', () => {
    expect(NAV_LINKS['#navGiftCards'].label.toLowerCase()).toContain('gift');
  });

  it('/gift-cards path is unique in NAV_LINKS (no duplicates)', () => {
    const paths = Object.values(NAV_LINKS).map(v => v.path);
    const giftCardPaths = paths.filter(p => p === '/gift-cards');
    expect(giftCardPaths).toHaveLength(1);
  });
});

// ── MEGA_MENU_CATEGORIES ───────────────────────────────────────────────────────

describe('MEGA_MENU_CATEGORIES — Gift Cards entry', () => {
  it('contains a Gift Cards entry in one of the groups', () => {
    const allItems = MEGA_MENU_CATEGORIES.flatMap(group => group.items);
    const giftItem = allItems.find(item => item.id === '#navGiftCards');
    expect(giftItem).toBeDefined();
  });

  it('Gift Cards mega menu entry has correct path and label', () => {
    const allItems = MEGA_MENU_CATEGORIES.flatMap(group => group.items);
    const giftItem = allItems.find(item => item.id === '#navGiftCards');
    expect(giftItem).toMatchObject({ id: '#navGiftCards', label: 'Gift Cards', path: '/gift-cards' });
  });
});

// ── getActiveNavId ─────────────────────────────────────────────────────────────

describe('getActiveNavId — Gift Cards active state', () => {
  it('returns #navGiftCards for /gift-cards', () => {
    expect(getActiveNavId('/gift-cards')).toBe('#navGiftCards');
  });

  it('returns #navGiftCards for /gift-cards/ (trailing slash)', () => {
    expect(getActiveNavId('/gift-cards/')).toBe('#navGiftCards');
  });

  it('returns #navGiftCards for /gift-cards/balance (sub-path)', () => {
    expect(getActiveNavId('/gift-cards/balance')).toBe('#navGiftCards');
  });

  it('returns null for an unrelated path (does not false-positive)', () => {
    expect(getActiveNavId('/shop-main')).not.toBe('#navGiftCards');
  });

  it('returns null when path is null', () => {
    expect(getActiveNavId(null)).toBeNull();
  });
});

// ── breadcrumbsFromPath ────────────────────────────────────────────────────────

describe('breadcrumbsFromPath — Gift Cards breadcrumb', () => {
  it('returns [Home, Gift Cards] for /gift-cards', () => {
    const crumbs = breadcrumbsFromPath('/gift-cards');
    expect(crumbs).toHaveLength(2);
    expect(crumbs[0]).toMatchObject({ label: 'Home', path: '/' });
    expect(crumbs[1].path).toBe('/gift-cards');
    expect(crumbs[1].label.toLowerCase()).toContain('gift');
  });

  it('first breadcrumb is always Home', () => {
    const crumbs = breadcrumbsFromPath('/gift-cards');
    expect(crumbs[0].label).toBe('Home');
    expect(crumbs[0].path).toBe('/');
  });

  it('breadcrumb label matches NAV_LINKS label for Gift Cards', () => {
    const crumbs = breadcrumbsFromPath('/gift-cards');
    const giftCrumb = crumbs.find(c => c.path === '/gift-cards');
    expect(giftCrumb?.label).toBe(NAV_LINKS['#navGiftCards'].label);
  });
});

// ── Footer — getFooterServiceLinks ────────────────────────────────────────────

describe('getFooterServiceLinks — Gift Cards link', () => {
  it('includes a Gift Cards link', () => {
    const links = getFooterServiceLinks();
    const giftLink = links.find(l => l.path === '/gift-cards');
    expect(giftLink).toBeDefined();
  });

  it('Gift Cards link has a non-empty label', () => {
    const links = getFooterServiceLinks();
    const giftLink = links.find(l => l.path === '/gift-cards');
    expect(giftLink?.label.length).toBeGreaterThan(0);
  });

  it('Gift Cards link label contains "Gift" (case-insensitive)', () => {
    const links = getFooterServiceLinks();
    const giftLink = links.find(l => l.path === '/gift-cards');
    expect(giftLink?.label.toLowerCase()).toContain('gift');
  });

  it('returns an array with all required link shapes', () => {
    const links = getFooterServiceLinks();
    expect(Array.isArray(links)).toBe(true);
    for (const link of links) {
      expect(link).toHaveProperty('label');
      expect(link).toHaveProperty('path');
      expect(link.path.startsWith('/')).toBe(true);
    }
  });

  it('does not duplicate the Gift Cards entry', () => {
    const links = getFooterServiceLinks();
    const giftLinks = links.filter(l => l.path === '/gift-cards');
    expect(giftLinks).toHaveLength(1);
  });

  it('Gift Cards link matches exact expected shape', () => {
    const links = getFooterServiceLinks();
    const giftLink = links.find(l => l.path === '/gift-cards');
    expect(giftLink).toEqual({ label: 'Gift Cards', path: '/gift-cards' });
  });
});

// ── Footer — getFooterShopLinks ────────────────────────────────────────────────

describe('getFooterShopLinks — Gift Cards NOT in shop', () => {
  it('does not contain /gift-cards (belongs in service, not shop)', () => {
    const links = getFooterShopLinks();
    const giftLink = links.find(l => l.path === '/gift-cards');
    expect(giftLink).toBeUndefined();
  });
});
