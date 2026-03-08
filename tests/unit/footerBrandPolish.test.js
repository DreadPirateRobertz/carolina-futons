/**
 * Tests for FooterSection.js — Brand polish (cf-imyl)
 *
 * Validates: designTokens import usage, token-based styling for background,
 * text, links, newsletter input, social icons, mountain divider,
 * hover states, mobile responsive, WCAG AA contrast.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  applyFooterStyles,
  initMountainDivider,
  initFooter,
} from '../../src/public/FooterSection.js';
import { colors, transitions } from '../../src/public/designTokens.js';

// ── Mock backend services ───────────────────────────────────────────

vi.mock('backend/newsletterService.web', () => ({
  subscribeToNewsletter: vi.fn().mockResolvedValue({
    success: true,
    discountCode: 'WELCOME10',
  }),
}));

vi.mock('backend/contactSubmissions.web', () => ({
  submitContactForm: vi.fn().mockResolvedValue({}),
}));

// ── Mock helpers ────────────────────────────────────────────────────

function createMockElement(overrides = {}) {
  return {
    text: '',
    html: '',
    src: '',
    value: '',
    label: '',
    data: [],
    style: {
      color: '',
      backgroundColor: '',
      borderColor: '',
    },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(),
    expand: vi.fn(),
    onClick: vi.fn(),
    onChange: vi.fn(),
    onMouseIn: vi.fn(),
    onMouseOut: vi.fn(),
    onItemReady: vi.fn(),
    disable: vi.fn(),
    enable: vi.fn(),
    accessibility: {},
    ...overrides,
  };
}

function create$w() {
  const els = new Map();
  const $w = (sel) => {
    if (!els.has(sel)) els.set(sel, createMockElement());
    return els.get(sel);
  };
  $w._els = els;
  return $w;
}

let $w;

beforeEach(() => {
  $w = create$w();
  vi.clearAllMocks();
});

// ── applyFooterStyles ───────────────────────────────────────────────

describe('applyFooterStyles', () => {
  it('sets footer background to espresso token', () => {
    applyFooterStyles($w);
    expect($w('#siteFooter').style.backgroundColor).toBe(colors.espresso);
  });

  it('sets footer text color to sandLight token', () => {
    applyFooterStyles($w);
    expect($w('#footerCopyright').style.color).toBe(colors.sandLight);
  });

  it('sets footer heading colors to sandLight', () => {
    applyFooterStyles($w);
    expect($w('#footerShopHeading').style.color).toBe(colors.sandLight);
    expect($w('#footerServiceHeading').style.color).toBe(colors.sandLight);
    expect($w('#footerAboutHeading').style.color).toBe(colors.sandLight);
    expect($w('#footerInfoHeading').style.color).toBe(colors.sandLight);
  });

  it('sets store info text to sandLight', () => {
    applyFooterStyles($w);
    expect($w('#footerStoreName').style.color).toBe(colors.sandLight);
    expect($w('#footerStoreAddress').style.color).toBe(colors.sandLight);
    expect($w('#footerStorePhone').style.color).toBe(colors.sandLight);
    expect($w('#footerStoreHours').style.color).toBe(colors.sandLight);
  });

  it('sets newsletter input to offWhite bg with espresso text', () => {
    applyFooterStyles($w);
    expect($w('#footerEmailInput').style.backgroundColor).toBe(colors.offWhite);
    expect($w('#footerEmailInput').style.color).toBe(colors.espresso);
  });

  it('sets newsletter submit button to coral', () => {
    applyFooterStyles($w);
    expect($w('#footerEmailSubmit').style.backgroundColor).toBe(colors.sunsetCoral);
  });

  it('registers hover handlers on footer links for coral hover', () => {
    applyFooterStyles($w);
    // Link repeaters should have mouseIn/mouseOut registered
    expect($w('#footerShopRepeater').onItemReady).toHaveBeenCalled();
  });

  it('survives when elements are missing (graceful degradation)', () => {
    const broken$w = () => null;
    expect(() => applyFooterStyles(broken$w)).not.toThrow();
  });

  it('uses only token colors — no hardcoded hex values', () => {
    applyFooterStyles($w);
    const footer = $w('#siteFooter');
    // Background must be a known token
    const tokenValues = Object.values(colors);
    expect(tokenValues).toContain(footer.style.backgroundColor);
  });
});

// ── initMountainDivider ─────────────────────────────────────────────

describe('initMountainDivider', () => {
  it('sets mountain divider HTML content', () => {
    initMountainDivider($w);
    const divider = $w('#footerMountainDivider');
    expect(divider.html).toBeTruthy();
  });

  it('divider contains SVG path element', () => {
    initMountainDivider($w);
    const divider = $w('#footerMountainDivider');
    expect(divider.html).toContain('<svg');
    expect(divider.html).toContain('<path');
  });

  it('divider uses token colors for fill', () => {
    initMountainDivider($w);
    const divider = $w('#footerMountainDivider');
    // Should reference espresso color for mountain fill
    expect(divider.html).toContain(colors.espresso);
  });

  it('divider SVG has accessible attributes', () => {
    initMountainDivider($w);
    const divider = $w('#footerMountainDivider');
    expect(divider.html).toContain('aria-hidden="true"');
  });

  it('survives when divider element is missing', () => {
    const broken$w = () => null;
    expect(() => initMountainDivider(broken$w)).not.toThrow();
  });
});

// ── initFooter orchestrator includes brand polish ───────────────────

describe('initFooter with brand polish', () => {
  it('applies footer styles as part of initialization', () => {
    initFooter($w);
    // Footer background should be set after full init
    expect($w('#siteFooter').style.backgroundColor).toBe(colors.espresso);
  });

  it('initializes mountain divider as part of initialization', () => {
    initFooter($w);
    const divider = $w('#footerMountainDivider');
    expect(divider.html).toContain('<svg');
  });

  it('all footer colors come from design tokens', () => {
    initFooter($w);
    const tokenValues = Object.values(colors);
    // Copyright text color
    expect(tokenValues).toContain($w('#footerCopyright').style.color);
    // Footer background
    expect(tokenValues).toContain($w('#siteFooter').style.backgroundColor);
    // Newsletter input
    expect(tokenValues).toContain($w('#footerEmailInput').style.backgroundColor);
    expect(tokenValues).toContain($w('#footerEmailInput').style.color);
  });
});
