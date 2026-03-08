/**
 * Tests for navigationHelpers.js — Navigation, layout & footer helpers
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
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
  makeClickable: vi.fn((el, handler, opts) => {
    if (el && el.onClick) el.onClick(handler);
  }),
  createFocusTrap: vi.fn(() => ({ release: vi.fn() })),
}));

vi.mock('public/mobileHelpers', () => ({
  isMobile: vi.fn(() => false),
  getViewport: vi.fn(() => ({ width: 1024 })),
}));

import {
  NAV_LINKS,
  MEGA_MENU_CATEGORIES,
  getActiveNavId,
  applyActiveNavState,
  initMegaMenu,
  initMobileDrawer,
  initMobileAccordions,
  buildBreadcrumbs,
  renderBreadcrumbs,
  breadcrumbsFromPath,
  initAnnouncementBar,
  initBackToTop,
  initFooterAccordions,
  initStickyNav,
} from '../src/public/navigationHelpers.js';

// ── Helper: mock $w ───────────────────────────────────────────────────

function createMock$w(elements = {}) {
  return (id) => {
    if (elements[id]) return elements[id];
    return {
      style: {},
      accessibility: {},
      text: '',
      show: vi.fn(() => Promise.resolve()),
      hide: vi.fn(() => Promise.resolve()),
      onClick: vi.fn(),
      onMouseIn: vi.fn(),
      onMouseOut: vi.fn(),
      onKeyPress: vi.fn(),
      focus: vi.fn(),
      collapse: vi.fn(),
      expand: vi.fn(),
      postMessage: vi.fn(),
    };
  };
}

// ── NAV_LINKS ─────────────────────────────────────────────────────────

describe('NAV_LINKS', () => {
  it('contains home link', () => {
    expect(NAV_LINKS['#navHome']).toBeDefined();
    expect(NAV_LINKS['#navHome'].path).toBe('/');
  });

  it('all entries have path and label', () => {
    Object.values(NAV_LINKS).forEach(link => {
      expect(link).toHaveProperty('path');
      expect(link).toHaveProperty('label');
    });
  });
});

// ── MEGA_MENU_CATEGORIES ──────────────────────────────────────────────

describe('MEGA_MENU_CATEGORIES', () => {
  it('has category groups', () => {
    expect(MEGA_MENU_CATEGORIES.length).toBeGreaterThan(0);
  });

  it('each group has title and items', () => {
    MEGA_MENU_CATEGORIES.forEach(group => {
      expect(group).toHaveProperty('title');
      expect(group).toHaveProperty('items');
      expect(group.items.length).toBeGreaterThan(0);
    });
  });
});

// ── getActiveNavId ────────────────────────────────────────────────────

describe('getActiveNavId', () => {
  it('returns #navHome for /', () => {
    expect(getActiveNavId('/')).toBe('#navHome');
  });

  it('returns matching nav for exact path', () => {
    expect(getActiveNavId('/futon-frames')).toBe('#navFutonFrames');
    expect(getActiveNavId('/mattresses')).toBe('#navMattresses');
    expect(getActiveNavId('/faq')).toBe('#navFAQ');
  });

  it('matches child paths', () => {
    expect(getActiveNavId('/futon-frames/some-product')).toBe('#navFutonFrames');
  });

  it('returns null for unknown paths', () => {
    expect(getActiveNavId('/nonexistent-page')).toBeNull();
  });

  it('returns null for null/undefined', () => {
    expect(getActiveNavId(null)).toBeNull();
    expect(getActiveNavId(undefined)).toBeNull();
  });

  it('strips trailing slash', () => {
    expect(getActiveNavId('/futon-frames/')).toBe('#navFutonFrames');
  });
});

// ── applyActiveNavState ───────────────────────────────────────────────

describe('applyActiveNavState', () => {
  it('sets bold and mountainBlue on active link', () => {
    const activeEl = { style: {}, accessibility: {} };
    const otherEl = { style: {}, accessibility: {} };
    const $w = (id) => {
      if (id === '#navHome') return activeEl;
      return otherEl;
    };
    applyActiveNavState($w, '/');
    expect(activeEl.style.fontWeight).toBe('700');
    expect(activeEl.style.color).toBe('#5B8FA8');
  });

  it('does nothing when no path matches', () => {
    const $w = vi.fn(() => ({ style: {}, accessibility: {} }));
    applyActiveNavState($w, '/nonexistent');
    // No errors thrown
  });
});

// ── initMegaMenu ──────────────────────────────────────────────────────

describe('initMegaMenu', () => {
  it('returns open and close functions', () => {
    const $w = createMock$w();
    const menu = initMegaMenu($w);
    expect(typeof menu.open).toBe('function');
    expect(typeof menu.close).toBe('function');
  });

  it('open and close do not throw', () => {
    const $w = createMock$w();
    const menu = initMegaMenu($w);
    expect(() => menu.open()).not.toThrow();
    expect(() => menu.close()).not.toThrow();
  });
});

// ── initMobileDrawer ──────────────────────────────────────────────────

describe('initMobileDrawer', () => {
  it('returns open and close functions', () => {
    const $w = createMock$w();
    const drawer = initMobileDrawer($w, '/');
    expect(typeof drawer.open).toBe('function');
    expect(typeof drawer.close).toBe('function');
  });

  it('open and close do not throw', () => {
    const $w = createMock$w();
    const drawer = initMobileDrawer($w, '/');
    expect(() => drawer.open()).not.toThrow();
    expect(() => drawer.close()).not.toThrow();
  });
});

// ── initMobileAccordions ──────────────────────────────────────────────

describe('initMobileAccordions', () => {
  it('does not throw with empty sections', () => {
    const $w = createMock$w();
    expect(() => initMobileAccordions($w, [])).not.toThrow();
    expect(() => initMobileAccordions($w, null)).not.toThrow();
  });

  it('initializes accordion sections', () => {
    const header = {
      accessibility: {},
      onClick: vi.fn(),
    };
    const panel = {
      collapse: vi.fn(),
      expand: vi.fn(),
    };
    const $w = (id) => {
      if (id === '#header1') return header;
      if (id === '#panel1') return panel;
      return null;
    };
    initMobileAccordions($w, [{ headerId: '#header1', panelId: '#panel1', label: 'Test' }]);
    expect(panel.collapse).toHaveBeenCalled();
  });
});

// ── renderBreadcrumbs ─────────────────────────────────────────────────

describe('renderBreadcrumbs', () => {
  it('sets text on breadcrumb elements', () => {
    const elements = {};
    const $w = (id) => {
      if (!elements[id]) {
        elements[id] = {
          text: '',
          style: {},
          accessibility: {},
          show: vi.fn(),
          hide: vi.fn(),
          onClick: vi.fn(),
          postMessage: vi.fn(),
        };
      }
      return elements[id];
    };
    renderBreadcrumbs($w, [
      { label: 'Home', path: '/' },
      { label: 'Futon Frames', path: '/futon-frames' },
    ]);
    expect(elements['#breadcrumb1'].text).toBe('Home');
    expect(elements['#breadcrumb2'].text).toBe('Futon Frames');
  });

  it('hides unused breadcrumb slots', () => {
    const elements = {};
    const $w = (id) => {
      if (!elements[id]) {
        elements[id] = {
          text: '',
          style: {},
          accessibility: {},
          show: vi.fn(),
          hide: vi.fn(),
          onClick: vi.fn(),
          postMessage: vi.fn(),
        };
      }
      return elements[id];
    };
    renderBreadcrumbs($w, [{ label: 'Home', path: '/' }]);
    expect(elements['#breadcrumb2'].hide).toHaveBeenCalled();
    expect(elements['#breadcrumb3'].hide).toHaveBeenCalled();
  });

  it('posts schema JSON to #breadcrumbSchemaHtml', () => {
    const elements = {};
    const $w = (id) => {
      if (!elements[id]) {
        elements[id] = {
          text: '',
          style: {},
          accessibility: {},
          show: vi.fn(),
          hide: vi.fn(),
          onClick: vi.fn(),
          postMessage: vi.fn(),
        };
      }
      return elements[id];
    };
    renderBreadcrumbs($w, [{ label: 'Home', path: '/' }]);
    expect(elements['#breadcrumbSchemaHtml'].postMessage).toHaveBeenCalled();
    const schemaJson = elements['#breadcrumbSchemaHtml'].postMessage.mock.calls[0][0];
    const schema = JSON.parse(schemaJson);
    expect(schema['@type']).toBe('BreadcrumbList');
  });

  it('sets ariaCurrent on last breadcrumb', () => {
    const elements = {};
    const $w = (id) => {
      if (!elements[id]) {
        elements[id] = {
          text: '',
          style: {},
          accessibility: {},
          show: vi.fn(),
          hide: vi.fn(),
          onClick: vi.fn(),
          postMessage: vi.fn(),
        };
      }
      return elements[id];
    };
    renderBreadcrumbs($w, [
      { label: 'Home', path: '/' },
      { label: 'Current', path: '/current' },
    ]);
    expect(elements['#breadcrumb2'].accessibility.ariaCurrent).toBe('page');
  });

  it('does not throw when elements are missing', () => {
    const $w = () => null;
    expect(() => renderBreadcrumbs($w, [{ label: 'Home', path: '/' }])).not.toThrow();
  });
});

// ── buildBreadcrumbs ──────────────────────────────────────────────────

describe('buildBreadcrumbs', () => {
  it('returns items and schema', () => {
    const result = buildBreadcrumbs([
      { label: 'Home', path: '/' },
      { label: 'Futon Frames', path: '/futon-frames' },
    ]);
    expect(result.items).toHaveLength(2);
    expect(result.schema['@type']).toBe('BreadcrumbList');
  });

  it('marks last item as isLast', () => {
    const result = buildBreadcrumbs([
      { label: 'Home', path: '/' },
      { label: 'Product', path: '/product' },
    ]);
    expect(result.items[0].isLast).toBe(false);
    expect(result.items[1].isLast).toBe(true);
  });

  it('defaults to Home when empty', () => {
    const result = buildBreadcrumbs([]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].label).toBe('Home');
  });

  it('defaults to Home when null', () => {
    const result = buildBreadcrumbs(null);
    expect(result.items[0].label).toBe('Home');
  });

  it('schema omits item URL for last breadcrumb', () => {
    const result = buildBreadcrumbs([
      { label: 'Home', path: '/' },
      { label: 'Current', path: '/current' },
    ]);
    const lastSchema = result.schema.itemListElement[1];
    expect(lastSchema.item).toBeUndefined();
  });

  it('schema includes URL for non-last breadcrumbs', () => {
    const result = buildBreadcrumbs([
      { label: 'Home', path: '/' },
      { label: 'Current', path: '/current' },
    ]);
    const firstSchema = result.schema.itemListElement[0];
    expect(firstSchema.item).toContain('carolinafutons.com');
  });
});

// ── breadcrumbsFromPath ───────────────────────────────────────────────

describe('breadcrumbsFromPath', () => {
  it('returns just Home for root path', () => {
    const crumbs = breadcrumbsFromPath('/');
    expect(crumbs).toHaveLength(1);
    expect(crumbs[0].label).toBe('Home');
  });

  it('adds matched nav link as second crumb', () => {
    const crumbs = breadcrumbsFromPath('/futon-frames');
    expect(crumbs).toHaveLength(2);
    expect(crumbs[1].label).toBe('Futon Frames');
  });

  it('adds product-level crumb for deep paths', () => {
    const crumbs = breadcrumbsFromPath('/futon-frames/autumn-rosewood');
    expect(crumbs.length).toBeGreaterThanOrEqual(2);
    const last = crumbs[crumbs.length - 1];
    expect(last.label).toContain('Autumn');
  });

  it('title-cases segment names', () => {
    const crumbs = breadcrumbsFromPath('/futon-frames/my-product');
    const last = crumbs[crumbs.length - 1];
    expect(last.label).toBe('My Product');
  });

  it('returns just Home for null path', () => {
    expect(breadcrumbsFromPath(null)).toHaveLength(1);
  });
});

// ── initAnnouncementBar ───────────────────────────────────────────────

describe('initAnnouncementBar', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('returns dismiss, pause, resume functions', () => {
    const $w = createMock$w();
    const bar = initAnnouncementBar($w, ['Free shipping on orders over $999!']);
    expect(typeof bar.dismiss).toBe('function');
    expect(typeof bar.pause).toBe('function');
    expect(typeof bar.resume).toBe('function');
  });

  it('sets initial message text', () => {
    const textEl = { text: '', accessibility: {} };
    const $w = (id) => {
      if (id === '#announcementText') return textEl;
      return {
        style: {},
        accessibility: {},
        show: vi.fn(),
        hide: vi.fn(() => Promise.resolve()),
        onClick: vi.fn(),
      };
    };
    initAnnouncementBar($w, ['Hello World']);
    expect(textEl.text).toBe('Hello World');
  });

  it('dismiss sets session storage flag', () => {
    const $w = createMock$w();
    const bar = initAnnouncementBar($w, ['Message']);
    bar.dismiss();
    expect(sessionStorage.getItem('cf_announcement_dismissed')).toBe('1');
  });

  it('returns early if already dismissed this session', () => {
    sessionStorage.setItem('cf_announcement_dismissed', '1');
    const hideSpy = vi.fn();
    const $w = (id) => {
      if (id === '#announcementBar') return { hide: hideSpy, show: vi.fn(), style: {}, accessibility: {} };
      return { text: '', accessibility: {}, show: vi.fn(), hide: vi.fn(), onClick: vi.fn(), style: {} };
    };
    initAnnouncementBar($w, ['Message']);
    expect(hideSpy).toHaveBeenCalled();
  });
});

// ── initBackToTop ────────────────────────────────────────────────────

describe('initBackToTop', () => {
  it('does not throw with mock $w', () => {
    const $w = createMock$w();
    expect(() => initBackToTop($w)).not.toThrow();
  });

  it('hides button initially', () => {
    const btn = {
      hide: vi.fn(),
      show: vi.fn(),
      accessibility: {},
      onClick: vi.fn(),
    };
    const $w = (id) => {
      if (id === '#backToTop') return btn;
      return createMock$w()(id);
    };
    initBackToTop($w);
    expect(btn.hide).toHaveBeenCalled();
  });

  it('sets aria-label on button', () => {
    const btn = {
      hide: vi.fn(),
      show: vi.fn(),
      accessibility: {},
      onClick: vi.fn(),
    };
    const $w = (id) => {
      if (id === '#backToTop') return btn;
      return createMock$w()(id);
    };
    initBackToTop($w);
    expect(btn.accessibility.ariaLabel).toBe('Back to top');
  });

  it('accepts custom button ID', () => {
    const btn = {
      hide: vi.fn(),
      show: vi.fn(),
      accessibility: {},
      onClick: vi.fn(),
    };
    const $w = (id) => {
      if (id === '#customBtn') return btn;
      return null;
    };
    expect(() => initBackToTop($w, '#customBtn')).not.toThrow();
    expect(btn.hide).toHaveBeenCalled();
  });

  it('handles null button gracefully', () => {
    const $w = () => null;
    expect(() => initBackToTop($w)).not.toThrow();
  });
});

// ── initFooterAccordions ─────────────────────────────────────────────

describe('initFooterAccordions', () => {
  it('does not throw on desktop (isMobile returns false)', () => {
    const $w = createMock$w();
    const columns = [
      { headerId: '#footerH1', contentId: '#footerC1', label: 'About' },
    ];
    expect(() => initFooterAccordions($w, columns)).not.toThrow();
  });

  it('calls initMobileAccordions on mobile', async () => {
    const { isMobile } = await import('public/mobileHelpers');
    isMobile.mockReturnValueOnce(true);

    const header = { accessibility: {}, onClick: vi.fn() };
    const panel = { collapse: vi.fn(), expand: vi.fn() };
    const $w = (id) => {
      if (id === '#footerH1') return header;
      if (id === '#footerC1') return panel;
      return createMock$w()(id);
    };
    const columns = [
      { headerId: '#footerH1', contentId: '#footerC1', label: 'About' },
    ];
    initFooterAccordions($w, columns);
    expect(panel.collapse).toHaveBeenCalled();
  });

  it('remaps contentId to panelId for initMobileAccordions', async () => {
    const { isMobile } = await import('public/mobileHelpers');
    isMobile.mockReturnValueOnce(true);

    const header = { accessibility: {}, onClick: vi.fn() };
    const panel = { collapse: vi.fn(), expand: vi.fn() };
    const $w = (id) => {
      if (id === '#fH') return header;
      if (id === '#fC') return panel;
      return null;
    };
    initFooterAccordions($w, [{ headerId: '#fH', contentId: '#fC', label: 'Help' }]);
    expect(panel.collapse).toHaveBeenCalled();
  });
});

// ── initStickyNav ────────────────────────────────────────────────────

describe('initStickyNav', () => {
  it('does not throw with mock $w', () => {
    const $w = createMock$w();
    expect(() => initStickyNav($w)).not.toThrow();
  });

  it('accepts custom header ID', () => {
    const $w = createMock$w();
    expect(() => initStickyNav($w, '#customHeader')).not.toThrow();
  });

  it('handles null $w element gracefully', () => {
    const $w = () => null;
    expect(() => initStickyNav($w)).not.toThrow();
  });
});
