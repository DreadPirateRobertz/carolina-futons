/**
 * Tests for FooterSection.js — Footer initialization module
 *
 * Tests the extracted footer logic: 4-column links, newsletter wiring
 * (subscribeToNewsletter), social icons, trust badges, ARIA landmarks,
 * error/empty states.
 *
 * CF-76b1: Footer redesign
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  initFooterColumns,
  initFooterNewsletter,
  initFooterSocial,
  initFooterTrustBadges,
  initFooterPayment,
  initFooterCopyright,
  initFooterAria,
  initFooterLogo,
  buildFooterMountainSVG,
  initMountainDivider,
  initMountainDividerWithSkyWiring,
  applyFooterStyles,
  fixFooterContactFallback,
  initFooter,
} from '../src/public/FooterSection.js';

// ── Mock backend services ───────────────────────────────────────────

vi.mock('backend/newsletterService.web', () => ({
  subscribeToNewsletter: vi.fn().mockResolvedValue({
    success: true,
    discountCode: 'WELCOME10',
  }),
}));

import { subscribeToNewsletter } from 'backend/newsletterService.web';

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/ga4Tracking', () => ({
  fireCustomEvent: vi.fn(),
}));

vi.mock('public/carolinaFutonsLogo', () => ({
  getFooterLogoImageUrl: vi.fn(() => 'https://static.wixstatic.com/media/cf-logo.jpg'),
}));

import { trackEvent } from 'public/engagementTracker';
import { fireCustomEvent } from 'public/ga4Tracking';

// ── Mock helpers ────────────────────────────────────────────────────

function createMockElement(overrides = {}) {
  return {
    text: '',
    src: '',
    alt: '',
    html: '',
    value: '',
    label: '',
    data: [],
    style: { color: '', backgroundColor: '' },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(),
    expand: vi.fn(),
    onClick: vi.fn(),
    onChange: vi.fn(),
    onItemReady: vi.fn(),
    onMouseIn: vi.fn(),
    onMouseOut: vi.fn(),
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

// ── initFooterColumns ───────────────────────────────────────────────

describe('initFooterColumns', () => {
  it('populates shop repeater with link data', () => {
    initFooterColumns($w);
    const repeater = $w('#footerShopRepeater');
    expect(repeater.data.length).toBeGreaterThan(0);
    expect(repeater.data[0]).toHaveProperty('label');
    expect(repeater.data[0]).toHaveProperty('path');
    expect(repeater.data[0]).toHaveProperty('_id');
  });

  it('populates service repeater', () => {
    initFooterColumns($w);
    const repeater = $w('#footerServiceRepeater');
    expect(repeater.data.length).toBeGreaterThan(0);
  });

  it('populates about repeater', () => {
    initFooterColumns($w);
    const repeater = $w('#footerAboutRepeater');
    expect(repeater.data.length).toBeGreaterThan(0);
  });

  it('registers onItemReady for all repeaters', () => {
    initFooterColumns($w);
    expect($w('#footerShopRepeater').onItemReady).toHaveBeenCalledTimes(1);
    expect($w('#footerServiceRepeater').onItemReady).toHaveBeenCalledTimes(1);
    expect($w('#footerAboutRepeater').onItemReady).toHaveBeenCalledTimes(1);
  });

  it('sets store info text fields', () => {
    initFooterColumns($w);
    expect($w('#footerStoreName').text).toContain('Carolina Futons');
    expect($w('#footerStoreAddress').text).toContain('Hendersonville');
    expect($w('#footerStorePhone').text).toMatch(/\d/);
  });

  it('sets phone ARIA label', () => {
    initFooterColumns($w);
    expect($w('#footerStorePhone').accessibility.ariaLabel).toContain('Call');
  });

  it('formats store hours', () => {
    initFooterColumns($w);
    expect($w('#footerStoreHours').text).toContain('Wednesday');
  });

  it('onItemReady sets link text and aria for shop column', () => {
    initFooterColumns($w);
    const cb = $w('#footerShopRepeater').onItemReady.mock.calls[0][0];
    const mockItem = createMockElement();
    const $item = () => mockItem;
    cb($item, { label: 'Futon Frames', path: '/futon-frames' });
    expect(mockItem.text).toBe('Futon Frames');
    expect(mockItem.accessibility.ariaLabel).toContain('Futon Frames');
  });

  it('onItemReady registers onClick that navigates', () => {
    initFooterColumns($w);
    const cb = $w('#footerShopRepeater').onItemReady.mock.calls[0][0];
    const mockItem = createMockElement();
    const $item = () => mockItem;
    cb($item, { label: 'Mattresses', path: '/mattresses' });
    expect(mockItem.onClick).toHaveBeenCalled();
  });

  it('survives when repeater elements are missing (graceful degradation)', () => {
    const broken$w = () => null;
    expect(() => initFooterColumns(broken$w)).not.toThrow();
  });
});

// ── initFooterNewsletter ────────────────────────────────────────────

describe('initFooterNewsletter', () => {
  it('registers click handler on subscribe button', () => {
    initFooterNewsletter($w);
    expect($w('#footerEmailSubmit').onClick).toHaveBeenCalledTimes(1);
  });

  it('sets ARIA labels on email input and submit button', () => {
    initFooterNewsletter($w);
    expect($w('#footerEmailInput').accessibility.ariaLabel).toBeTruthy();
    expect($w('#footerEmailSubmit').accessibility.ariaLabel).toBeTruthy();
  });

  it('calls subscribeToNewsletter on valid email submit', async () => {
    initFooterNewsletter($w);
    $w('#footerEmailInput').value = 'test@example.com';

    const handler = $w('#footerEmailSubmit').onClick.mock.calls[0][0];
    await handler();

    expect(subscribeToNewsletter).toHaveBeenCalledWith(
      'test@example.com',
      { source: 'footer_newsletter' }
    );
  });

  it('shows success message and discount code on successful subscribe', async () => {
    initFooterNewsletter($w);
    $w('#footerEmailInput').value = 'test@example.com';

    const handler = $w('#footerEmailSubmit').onClick.mock.calls[0][0];
    await handler();

    expect($w('#footerEmailSuccess').show).toHaveBeenCalled();
    expect($w('#footerEmailInput').value).toBe('');
  });

  it('disables button and shows loading state during submission', async () => {
    initFooterNewsletter($w);
    $w('#footerEmailInput').value = 'valid@test.com';

    const handler = $w('#footerEmailSubmit').onClick.mock.calls[0][0];
    await handler();

    expect($w('#footerEmailSubmit').disable).toHaveBeenCalled();
  });

  it('shows error for empty email', async () => {
    initFooterNewsletter($w);
    $w('#footerEmailInput').value = '';

    const handler = $w('#footerEmailSubmit').onClick.mock.calls[0][0];
    await handler();

    expect(subscribeToNewsletter).not.toHaveBeenCalled();
    expect($w('#footerEmailError').show).toHaveBeenCalled();
  });

  it('shows error for invalid email format', async () => {
    initFooterNewsletter($w);
    $w('#footerEmailInput').value = 'not-an-email';

    const handler = $w('#footerEmailSubmit').onClick.mock.calls[0][0];
    await handler();

    expect(subscribeToNewsletter).not.toHaveBeenCalled();
    expect($w('#footerEmailError').show).toHaveBeenCalled();
  });

  it('shows error for whitespace-only email', async () => {
    initFooterNewsletter($w);
    $w('#footerEmailInput').value = '   ';

    const handler = $w('#footerEmailSubmit').onClick.mock.calls[0][0];
    await handler();

    expect(subscribeToNewsletter).not.toHaveBeenCalled();
  });

  it('re-enables button on API error', async () => {
    subscribeToNewsletter.mockRejectedValueOnce(new Error('Network error'));
    initFooterNewsletter($w);
    $w('#footerEmailInput').value = 'test@example.com';

    const handler = $w('#footerEmailSubmit').onClick.mock.calls[0][0];
    await handler();

    expect($w('#footerEmailSubmit').enable).toHaveBeenCalled();
    expect($w('#footerEmailSubmit').label).toBe('Subscribe');
  });

  it('handles subscribeToNewsletter returning success:false', async () => {
    subscribeToNewsletter.mockResolvedValueOnce({
      success: false,
      message: 'Invalid email format',
    });
    initFooterNewsletter($w);
    $w('#footerEmailInput').value = 'test@example.com';

    const handler = $w('#footerEmailSubmit').onClick.mock.calls[0][0];
    await handler();

    expect($w('#footerEmailError').text).toBeTruthy();
    expect($w('#footerEmailError').show).toHaveBeenCalled();
    expect($w('#footerEmailSubmit').enable).toHaveBeenCalled();
  });

  it('rejects XSS in email input', async () => {
    initFooterNewsletter($w);
    $w('#footerEmailInput').value = '<script>alert(1)</script>@test.com';

    const handler = $w('#footerEmailSubmit').onClick.mock.calls[0][0];
    await handler();

    expect(subscribeToNewsletter).not.toHaveBeenCalled();
  });

  it('trims whitespace from email before submitting', async () => {
    initFooterNewsletter($w);
    $w('#footerEmailInput').value = '  test@example.com  ';

    const handler = $w('#footerEmailSubmit').onClick.mock.calls[0][0];
    await handler();

    expect(subscribeToNewsletter).toHaveBeenCalledWith(
      'test@example.com',
      { source: 'footer_newsletter' }
    );
  });

  it('survives when email input is missing (graceful degradation)', () => {
    const broken$w = () => null;
    expect(() => initFooterNewsletter(broken$w)).not.toThrow();
  });
});

// ── initFooterSocial ────────────────────────────────────────────────

describe('initFooterSocial', () => {
  it('survives when social bar is missing', () => {
    const broken$w = (sel) => {
      if (sel === 'SocialBar') return { length: 0 };
      return null;
    };
    expect(() => initFooterSocial(broken$w)).not.toThrow();
  });
});

// ── initFooterTrustBadges ───────────────────────────────────────────

describe('initFooterTrustBadges', () => {
  it('populates badge repeater with trust badge data', () => {
    initFooterTrustBadges($w);
    const repeater = $w('#footerBadgeRepeater');
    expect(repeater.data.length).toBeGreaterThan(0);
    expect(repeater.data[0]).toHaveProperty('label');
    expect(repeater.data[0]).toHaveProperty('icon');
  });

  it('onItemReady sets badge icon and label', () => {
    initFooterTrustBadges($w);
    const cb = $w('#footerBadgeRepeater').onItemReady.mock.calls[0][0];
    const mockIcon = createMockElement();
    const mockLabel = createMockElement();
    const $item = (sel) => {
      if (sel === '#badgeIcon') return mockIcon;
      if (sel === '#badgeLabel') return mockLabel;
      return createMockElement();
    };
    cb($item, { label: 'Family Owned Since 1991', icon: '\u2764' });
    expect(mockIcon.text).toBe('\u2764');
    expect(mockLabel.text).toBe('Family Owned Since 1991');
  });

  it('sets ARIA label on badge label element', () => {
    initFooterTrustBadges($w);
    const cb = $w('#footerBadgeRepeater').onItemReady.mock.calls[0][0];
    const mockLabel = createMockElement();
    const $item = (sel) => {
      if (sel === '#badgeLabel') return mockLabel;
      return createMockElement();
    };
    cb($item, { label: 'Secure Checkout', icon: '\uD83D\uDD12' });
    expect(mockLabel.accessibility.ariaLabel).toBe('Secure Checkout');
  });

  it('survives missing badge repeater', () => {
    const broken$w = () => null;
    expect(() => initFooterTrustBadges(broken$w)).not.toThrow();
  });
});

// ── initFooterPayment ───────────────────────────────────────────────

describe('initFooterPayment', () => {
  it('populates payment repeater', () => {
    initFooterPayment($w);
    const repeater = $w('#footerPaymentRepeater');
    expect(repeater.data.length).toBeGreaterThan(0);
    expect(repeater.data[0]).toHaveProperty('name');
  });

  it('onItemReady sets payment icon ARIA label', () => {
    initFooterPayment($w);
    const cb = $w('#footerPaymentRepeater').onItemReady.mock.calls[0][0];
    const mockItem = createMockElement();
    const $item = () => mockItem;
    cb($item, { name: 'visa', icon: 'visa' });
    expect(mockItem.accessibility.ariaLabel).toContain('visa');
  });

  it('survives missing payment repeater', () => {
    const broken$w = () => null;
    expect(() => initFooterPayment(broken$w)).not.toThrow();
  });
});

// ── initFooterCopyright ─────────────────────────────────────────────

describe('initFooterCopyright', () => {
  it('sets copyright text with current year', () => {
    initFooterCopyright($w);
    const year = new Date().getFullYear();
    expect($w('#footerCopyright').text).toContain(String(year));
    expect($w('#footerCopyright').text).toContain('Carolina Futons');
  });

  it('includes "All rights reserved"', () => {
    initFooterCopyright($w);
    expect($w('#footerCopyright').text).toContain('All rights reserved');
  });

  it('survives missing copyright element', () => {
    const broken$w = () => null;
    expect(() => initFooterCopyright(broken$w)).not.toThrow();
  });
});

// ── initFooterAria ──────────────────────────────────────────────────

describe('initFooterAria', () => {
  it('sets contentinfo role on site footer', () => {
    initFooterAria($w);
    expect($w('#siteFooter').accessibility.role).toBe('contentinfo');
  });

  it('survives missing footer element', () => {
    const broken$w = () => null;
    expect(() => initFooterAria(broken$w)).not.toThrow();
  });
});

// ── initFooterLogo (cf-0z2w) ─────────────────────────────────────────

describe('initFooterLogo', () => {
  it('sets ariaLabel on #footerLogo', () => {
    initFooterLogo($w);
    expect($w('#footerLogo').accessibility.ariaLabel).toBe('Carolina Futons - Go to homepage');
  });

  it('wires onClick on #footerLogo to navigate home', () => {
    initFooterLogo($w);
    expect($w('#footerLogo').onClick).toHaveBeenCalled();
  });

  it('sets alt text on #footerLogo', () => {
    initFooterLogo($w);
    expect($w('#footerLogo').alt).toBe('Carolina Futons');
  });

  it('survives missing footer logo element', () => {
    const broken$w = () => null;
    expect(() => initFooterLogo(broken$w)).not.toThrow();
  });
});

// ── BUILD-SPEC footer contact IDs (cf-0z2w) ─────────────────────────

describe('initFooterColumns — BUILD-SPEC contact IDs', () => {
  it('populates #footerPhone with phone number', () => {
    initFooterColumns($w);
    expect($w('#footerPhone').text).toMatch(/\d/);
  });

  it('sets ariaLabel on #footerPhone', () => {
    initFooterColumns($w);
    expect($w('#footerPhone').accessibility.ariaLabel).toContain('Call');
  });

  it('populates #footerAddress with address', () => {
    initFooterColumns($w);
    expect($w('#footerAddress').text).toContain('Hendersonville');
  });

  it('populates #footerHours with hours', () => {
    initFooterColumns($w);
    expect($w('#footerHours').text).toContain('Wednesday');
  });
});

// ── Social bar handled by fixTemplateSocialBar (native Wix SocialBar) ──

// ── initFooterColumns — onItemReady branch coverage ─────────────────

describe('initFooterColumns — onItemReady branches', () => {
  it('service column onItemReady sets aria WITHOUT "Shop" prefix', () => {
    initFooterColumns($w);
    const cb = $w('#footerServiceRepeater').onItemReady.mock.calls[0][0];
    const mockItem = createMockElement();
    const $item = () => mockItem;
    cb($item, { label: 'Shipping Policy', path: '/shipping-policy' });
    expect(mockItem.text).toBe('Shipping Policy');
    expect(mockItem.accessibility.ariaLabel).toBe('Shipping Policy');
  });

  it('about column onItemReady sets aria WITHOUT "Shop" prefix', () => {
    initFooterColumns($w);
    const cb = $w('#footerAboutRepeater').onItemReady.mock.calls[0][0];
    const mockItem = createMockElement();
    const $item = () => mockItem;
    cb($item, { label: 'Our Story', path: '/about' });
    expect(mockItem.accessibility.ariaLabel).toBe('Our Story');
  });

  it('shop column onItemReady sets "Shop" prefix on aria', () => {
    initFooterColumns($w);
    const cb = $w('#footerShopRepeater').onItemReady.mock.calls[0][0];
    const mockItem = createMockElement();
    const $item = () => mockItem;
    cb($item, { label: 'Futon Frames', path: '/futon-frames' });
    expect(mockItem.accessibility.ariaLabel).toBe('Shop Futon Frames');
  });

  it('onItemReady onClick fires dynamic import (fire-and-forget)', () => {
    initFooterColumns($w);
    const cb = $w('#footerShopRepeater').onItemReady.mock.calls[0][0];
    const mockItem = createMockElement();
    const $item = () => mockItem;
    cb($item, { label: 'Sale', path: '/sales' });
    // onClick is wired — the handler does a fire-and-forget dynamic import
    expect(mockItem.onClick).toHaveBeenCalled();
  });

  it('onItemReady survives when $item elements throw', () => {
    initFooterColumns($w);
    const cb = $w('#footerShopRepeater').onItemReady.mock.calls[0][0];
    const $item = () => { throw new Error('no child'); };
    expect(() => cb($item, { label: 'X', path: '/x' })).not.toThrow();
  });

  it('survives when $w always throws', () => {
    const throwing$w = () => { throw new Error('no element'); };
    expect(() => initFooterColumns(throwing$w)).not.toThrow();
  });
});

// ── initFooterNewsletter — deep branch coverage ─────────────────────

describe('initFooterNewsletter — deep branches', () => {
  it('fires trackEvent and fireCustomEvent on success', async () => {
    initFooterNewsletter($w);
    $w('#footerEmailInput').value = 'test@example.com';
    const handler = $w('#footerEmailSubmit').onClick.mock.calls[0][0];
    await handler();
    expect(trackEvent).toHaveBeenCalledWith('newsletter_signup', { source: 'footer' });
    expect(fireCustomEvent).toHaveBeenCalledWith('newsletter_signup', { source: 'footer' });
  });

  it('sets button label to "Subscribed!" on success', async () => {
    initFooterNewsletter($w);
    $w('#footerEmailInput').value = 'test@example.com';
    const handler = $w('#footerEmailSubmit').onClick.mock.calls[0][0];
    await handler();
    expect($w('#footerEmailSubmit').label).toBe('Subscribed!');
  });

  it('sets button label to "Subscribing..." during submission', async () => {
    let labelDuringCall;
    subscribeToNewsletter.mockImplementationOnce(async () => {
      labelDuringCall = $w('#footerEmailSubmit').label;
      return { success: true };
    });
    initFooterNewsletter($w);
    $w('#footerEmailInput').value = 'test@example.com';
    const handler = $w('#footerEmailSubmit').onClick.mock.calls[0][0];
    await handler();
    expect(labelDuringCall).toBe('Subscribing...');
  });

  it('hides error element before valid submission', async () => {
    initFooterNewsletter($w);
    $w('#footerEmailInput').value = 'test@example.com';
    const handler = $w('#footerEmailSubmit').onClick.mock.calls[0][0];
    await handler();
    expect($w('#footerEmailError').hide).toHaveBeenCalled();
  });

  it('handles null value gracefully (optional chaining)', async () => {
    initFooterNewsletter($w);
    $w('#footerEmailInput').value = null;
    const handler = $w('#footerEmailSubmit').onClick.mock.calls[0][0];
    await handler();
    expect(subscribeToNewsletter).not.toHaveBeenCalled();
  });

  it('handles undefined value gracefully', async () => {
    initFooterNewsletter($w);
    delete $w('#footerEmailInput').value;
    const handler = $w('#footerEmailSubmit').onClick.mock.calls[0][0];
    await handler();
    expect(subscribeToNewsletter).not.toHaveBeenCalled();
  });

  it('handles null result from subscribeToNewsletter', async () => {
    subscribeToNewsletter.mockResolvedValueOnce(null);
    initFooterNewsletter($w);
    $w('#footerEmailInput').value = 'test@example.com';
    const handler = $w('#footerEmailSubmit').onClick.mock.calls[0][0];
    await handler();
    expect($w('#footerEmailSubmit').enable).toHaveBeenCalled();
    expect($w('#footerEmailSubmit').label).toBe('Subscribe');
  });

  it('uses default error message when result.message is missing', async () => {
    subscribeToNewsletter.mockResolvedValueOnce({ success: false });
    initFooterNewsletter($w);
    $w('#footerEmailInput').value = 'test@example.com';
    const handler = $w('#footerEmailSubmit').onClick.mock.calls[0][0];
    await handler();
    expect($w('#footerEmailError').text).toContain('failed');
  });

  it('uses custom error message when result.message is provided', async () => {
    subscribeToNewsletter.mockResolvedValueOnce({ success: false, message: 'Already subscribed' });
    initFooterNewsletter($w);
    $w('#footerEmailInput').value = 'test@example.com';
    const handler = $w('#footerEmailSubmit').onClick.mock.calls[0][0];
    await handler();
    expect($w('#footerEmailError').text).toBe('Already subscribed');
  });

  it('returns early when emailInput is null', () => {
    const custom$w = (sel) => {
      if (sel === '#footerEmailInput') return null;
      return createMockElement();
    };
    expect(() => initFooterNewsletter(custom$w)).not.toThrow();
  });

  it('returns early when submitBtn is null', () => {
    const custom$w = (sel) => {
      if (sel === '#footerEmailSubmit') return null;
      return createMockElement();
    };
    expect(() => initFooterNewsletter(custom$w)).not.toThrow();
  });
});

// ── initFooterSocial — fixTemplateSocialBar ─────────────────────────

describe('initFooterSocial — fixTemplateSocialBar', () => {
  it('upgrades http→https in SocialBar links', () => {
    const socialBar = createMockElement({
      links: [
        { url: 'http://facebook.com/old', icon: 'fb', label: 'FB' },
        { url: 'https://twitter.com/x', icon: 'tw', label: 'TW' },
      ],
    });
    const custom$w = (sel) => {
      if (sel === 'SocialBar') return [socialBar];
      if (!$w._els.has(sel)) $w._els.set(sel, createMockElement());
      return $w._els.get(sel);
    };
    initFooterSocial(custom$w);
    expect(socialBar.links[0].url).toMatch(/^https:\/\//);
    expect(socialBar.links[1].url).toMatch(/^https:\/\//);
  });

  it('replaces matching platform URLs with canonical URLs', () => {
    const socialBar = createMockElement({
      links: [
        { url: 'http://www.facebook.com/wrongpage', icon: 'fb', label: 'FB' },
      ],
    });
    const custom$w = (sel) => {
      if (sel === 'SocialBar') return [socialBar];
      if (!$w._els.has(sel)) $w._els.set(sel, createMockElement());
      return $w._els.get(sel);
    };
    initFooterSocial(custom$w);
    expect(socialBar.links[0].url).toContain('carolinafutons');
  });

  it('skips SocialBar with no .links property', () => {
    const barNoLinks = createMockElement();
    delete barNoLinks.links;
    const custom$w = (sel) => {
      if (sel === 'SocialBar') return [barNoLinks];
      if (!$w._els.has(sel)) $w._els.set(sel, createMockElement());
      return $w._els.get(sel);
    };
    expect(() => initFooterSocial(custom$w)).not.toThrow();
  });

  it('handles empty SocialBar array', () => {
    const custom$w = (sel) => {
      if (sel === 'SocialBar') return [];
      if (!$w._els.has(sel)) $w._els.set(sel, createMockElement());
      return $w._els.get(sel);
    };
    expect(() => initFooterSocial(custom$w)).not.toThrow();
  });

  it('handles null SocialBar result', () => {
    const custom$w = (sel) => {
      if (sel === 'SocialBar') return null;
      if (!$w._els.has(sel)) $w._els.set(sel, createMockElement());
      return $w._els.get(sel);
    };
    expect(() => initFooterSocial(custom$w)).not.toThrow();
  });

  it('preserves non-matching link URLs (only fixes http)', () => {
    const socialBar = createMockElement({
      links: [
        { url: 'https://twitter.com/something', icon: 'tw', label: 'TW' },
      ],
    });
    const custom$w = (sel) => {
      if (sel === 'SocialBar') return [socialBar];
      if (!$w._els.has(sel)) $w._els.set(sel, createMockElement());
      return $w._els.get(sel);
    };
    initFooterSocial(custom$w);
    // twitter doesn't match any canonical platform, so URL stays as-is
    expect(socialBar.links[0].url).toBe('https://twitter.com/something');
  });
});

// ── initMountainDivider ─────────────────────────────────────────────

describe('initMountainDivider', () => {
  it('sets SVG html on #footerMountainDivider', () => {
    initMountainDivider($w);
    expect($w('#footerMountainDivider').html).toContain('<svg');
    expect($w('#footerMountainDivider').html).toContain('viewBox="0 0 1440 80"');
    expect($w('#footerMountainDivider').html).toContain('aria-hidden="true"');
  });

  it('includes mountain ridgeline paths', () => {
    initMountainDivider($w);
    expect($w('#footerMountainDivider').html).toContain('haze-footer');
    expect($w('#footerMountainDivider').html).toContain('pine-trees');
    expect($w('#footerMountainDivider').html).toContain('wildflowers');
    expect($w('#footerMountainDivider').html).toContain('birds');
  });

  it('includes preserveAspectRatio="none" for responsive stretch', () => {
    initMountainDivider($w);
    expect($w('#footerMountainDivider').html).toContain('preserveAspectRatio="none"');
  });

  it('returns early when divider element is null', () => {
    const custom$w = () => null;
    expect(() => initMountainDivider(custom$w)).not.toThrow();
  });

  it('survives when $w throws', () => {
    const broken$w = () => { throw new Error('nope'); };
    expect(() => initMountainDivider(broken$w)).not.toThrow();
  });
});

// ── buildFooterMountainSVG ───────────────────────────────────────────

describe('buildFooterMountainSVG', () => {
  const DEFAULT_COLORS = { r1: '#3A2518', r2: '#5B8FA8', r4: '#B8D4E3' };

  it('returns a valid SVG string (starts <svg, ends </svg>)', () => {
    const svg = buildFooterMountainSVG(DEFAULT_COLORS);
    expect(svg.trimStart()).toMatch(/^<svg[\s>]/);
    expect(svg.trimEnd()).toMatch(/<\/svg>$/);
  });

  it('includes viewBox="0 0 1440 80"', () => {
    expect(buildFooterMountainSVG(DEFAULT_COLORS)).toContain('viewBox="0 0 1440 80"');
  });

  it('includes preserveAspectRatio="none"', () => {
    expect(buildFooterMountainSVG(DEFAULT_COLORS)).toContain('preserveAspectRatio="none"');
  });

  it('includes aria-hidden="true"', () => {
    expect(buildFooterMountainSVG(DEFAULT_COLORS)).toContain('aria-hidden="true"');
  });

  it('includes feTurbulence with result="cf-noise"', () => {
    const svg = buildFooterMountainSVG(DEFAULT_COLORS);
    expect(svg).toContain('feTurbulence');
    expect(svg).toContain('result="cf-noise"');
  });

  it('includes feDisplacementMap with in2="cf-noise"', () => {
    const svg = buildFooterMountainSVG(DEFAULT_COLORS);
    expect(svg).toContain('feDisplacementMap');
    expect(svg).toContain('in2="cf-noise"');
  });

  it('applies ridgeColors.r4 to far ridge at opacity 0.22', () => {
    const svg = buildFooterMountainSVG(DEFAULT_COLORS);
    expect(svg).toContain('fill="#B8D4E3"');
    expect(svg).toContain('opacity="0.22"');
  });

  it('applies ridgeColors.r2 to mid ridge at opacity 0.40', () => {
    const svg = buildFooterMountainSVG(DEFAULT_COLORS);
    expect(svg).toContain('fill="#5B8FA8"');
    expect(svg).toContain('opacity="0.40"');
  });

  it('applies ridgeColors.r1 to near ridge at opacity 0.75', () => {
    const svg = buildFooterMountainSVG(DEFAULT_COLORS);
    expect(svg).toContain('fill="#3A2518"');
    expect(svg).toContain('opacity="0.75"');
  });

  it('changes far ridge when ridgeColors.r4 changes', () => {
    const svg1 = buildFooterMountainSVG({ ...DEFAULT_COLORS, r4: '#AABBCC' });
    const svg2 = buildFooterMountainSVG({ ...DEFAULT_COLORS, r4: '#DDEEFF' });
    expect(svg1).toContain('#AABBCC');
    expect(svg2).toContain('#DDEEFF');
    expect(svg1).not.toContain('#DDEEFF');
  });

  it('changes near ridge when ridgeColors.r1 changes', () => {
    const svg = buildFooterMountainSVG({ ...DEFAULT_COLORS, r1: '#112233' });
    expect(svg).toContain('#112233');
  });

  it('retains static decorative groups (birds, pine-trees, wildflowers)', () => {
    const svg = buildFooterMountainSVG(DEFAULT_COLORS);
    expect(svg).toContain('birds');
    expect(svg).toContain('pine-trees');
    expect(svg).toContain('wildflowers');
  });

  it('retains haze-footer filter', () => {
    expect(buildFooterMountainSVG(DEFAULT_COLORS)).toContain('haze-footer');
  });

  it('applies cf-ridge-warp filter to near ridge path', () => {
    expect(buildFooterMountainSVG(DEFAULT_COLORS)).toContain('filter="url(#cf-ridge-warp)"');
  });

  it('falls back to design-token defaults when called with no arguments', () => {
    const svg = buildFooterMountainSVG();
    expect(svg).toContain('opacity="0.22"');
    expect(svg).toContain('opacity="0.40"');
    expect(svg).toContain('opacity="0.75"');
    expect(svg).not.toContain('undefined');
  });

  it('falls back for r1 and r2 when only r4 is provided', () => {
    const svg = buildFooterMountainSVG({ r4: '#AABBCC' });
    expect(svg).not.toContain('"undefined"');
    expect(svg).toContain('#AABBCC');
  });

  it('changes mid ridge when ridgeColors.r2 changes', () => {
    const svg1 = buildFooterMountainSVG({ ...DEFAULT_COLORS, r2: '#223344' });
    const svg2 = buildFooterMountainSVG({ ...DEFAULT_COLORS, r2: '#554433' });
    expect(svg1).toContain('#223344');
    expect(svg2).toContain('#554433');
    expect(svg1).not.toContain('#554433');
  });
});

// ── initMountainDivider — LivingSkyState wiring (CF-6oh) ─────────────

describe('initMountainDivider — LivingSkyState wiring', () => {
  function makeWix({ hasFrame = true, frameHasOnMessage = true } = {}) {
    let handler = null;
    const dividerEl = { html: '' };
    const livingSkyEl = frameHasOnMessage
      ? { onMessage: (fn) => { handler = fn; } }
      : {};
    const mock$w = (sel) => {
      if (sel === '#footerMountainDivider') return dividerEl;
      if (sel === '#livingSkyFrame') return hasFrame ? livingSkyEl : null;
      return null;
    };
    const trigger = (data) => handler && handler({ data });
    return { mock$w, dividerEl, trigger };
  }

  // Canonical LivingSkyState fixture (living-sky.js:280-298)
  function makeState({ r1 = '#3A2518', r2 = '#5B8FA8', r4 = '#5B8FA8', sky0 = '#4A6B8A' } = {}) {
    return {
      skyColors: [sky0, '#3D5A7A', '#2C4B6A', '#1E3A5A'],
      ridgeColors: { r1, r2, r3: '#667788', r4, tree: '#334455' },
      starOpacity: 0,
      cloudOpacity: 0,
      weather: 'clear',
    };
  }

  it('subscribes to #livingSkyFrame onMessage on init', () => {
    const onMessageSpy = vi.fn();
    const dividerEl = { html: '' };
    const mock$w = (sel) => {
      if (sel === '#footerMountainDivider') return dividerEl;
      if (sel === '#livingSkyFrame') return { onMessage: onMessageSpy };
      return null;
    };
    initMountainDivider(mock$w);
    expect(onMessageSpy).toHaveBeenCalledWith(expect.any(Function));
  });

  it('does not throw when #livingSkyFrame is not found', () => {
    const { mock$w } = makeWix({ hasFrame: false });
    expect(() => initMountainDivider(mock$w)).not.toThrow();
  });

  it('does not throw when #livingSkyFrame has no onMessage method', () => {
    const { mock$w } = makeWix({ frameHasOnMessage: false });
    expect(() => initMountainDivider(mock$w)).not.toThrow();
  });

  it('is a no-op when state data is null', () => {
    const { mock$w, dividerEl, trigger } = makeWix();
    initMountainDivider(mock$w);
    const before = dividerEl.html;
    trigger(null);
    expect(dividerEl.html).toBe(before);
  });

  it('is a no-op when state data is undefined', () => {
    const { mock$w, dividerEl, trigger } = makeWix();
    initMountainDivider(mock$w);
    const before = dividerEl.html;
    trigger(undefined);
    expect(dividerEl.html).toBe(before);
  });

  it('updates divider html when valid state arrives (distinct from default)', () => {
    const { mock$w, dividerEl, trigger } = makeWix();
    initMountainDivider(mock$w);
    const before = dividerEl.html;
    // Use r1 distinct from design-token default (colors.espresso = #1E3A5F)
    trigger(makeState({ r1: '#112244' }));
    expect(dividerEl.html).not.toBe(before);
    expect(dividerEl.html).toContain('<svg');
  });

  it('does NOT check e.data.type — consumes state object directly (no type field on LivingSkyState)', () => {
    const { mock$w, dividerEl, trigger } = makeWix();
    initMountainDivider(mock$w);
    trigger(makeState()); // no .type field on LivingSkyState
    expect(dividerEl.html).toContain('<svg');
  });

  it('reflects skyColors[0] as r4 far-ridge color', () => {
    const { mock$w, dividerEl, trigger } = makeWix();
    initMountainDivider(mock$w);
    trigger(makeState({ sky0: '#AABBCC' }));
    expect(dividerEl.html).toContain('#AABBCC');
  });

  it('reflects ridgeColors.r1 and r2 as near/mid ridge colors', () => {
    const { mock$w, dividerEl, trigger } = makeWix();
    initMountainDivider(mock$w);
    trigger(makeState({ r1: '#112233', r2: '#445566' }));
    expect(dividerEl.html).toContain('#112233');
    expect(dividerEl.html).toContain('#445566');
  });

  it('rejects non-hex skyColors[0] (XSS guard)', () => {
    const { mock$w, dividerEl, trigger } = makeWix();
    initMountainDivider(mock$w);
    trigger({ ...makeState(), skyColors: ['<script>bad</script>', '#aaa', '#bbb', '#ccc'] });
    expect(dividerEl.html).not.toContain('<script>');
  });

  it('rejects non-hex ridgeColors.r1 and r2 (XSS guard — safeColor fallback)', () => {
    const { mock$w, dividerEl, trigger } = makeWix();
    initMountainDivider(mock$w);
    trigger({
      ...makeState(),
      ridgeColors: { r1: '<img onerror=x>', r2: 'javascript:alert(1)', r3: '#667788', r4: '#5B8FA8', tree: '#334455' },
    });
    expect(dividerEl.html).not.toContain('onerror');
    expect(dividerEl.html).not.toContain('javascript:');
  });

  it('updated SVG remains valid (starts <svg, ends </svg>)', () => {
    const { mock$w, dividerEl, trigger } = makeWix();
    initMountainDivider(mock$w);
    trigger(makeState());
    expect(dividerEl.html.trimStart()).toMatch(/^<svg[\s>]/);
    expect(dividerEl.html.trimEnd()).toMatch(/<\/svg>$/);
  });

  it('re-renders on every onMessage trigger, not just the first', () => {
    const { mock$w, dividerEl, trigger } = makeWix();
    initMountainDivider(mock$w);
    trigger(makeState({ r1: '#AABBCC' }));
    const after1 = dividerEl.html;
    trigger(makeState({ r1: '#DDEEFF' }));
    expect(dividerEl.html).not.toBe(after1);
    expect(dividerEl.html).toContain('#DDEEFF');
  });
});

// ── applyFooterStyles ───────────────────────────────────────────────

describe('applyFooterStyles', () => {
  it('sets background color on #siteFooter', () => {
    applyFooterStyles($w);
    expect($w('#siteFooter').style.backgroundColor).toBeTruthy();
  });

  it('sets color on heading elements', () => {
    applyFooterStyles($w);
    expect($w('#footerShopHeading').style.color).toBeTruthy();
    expect($w('#footerServiceHeading').style.color).toBeTruthy();
    expect($w('#footerAboutHeading').style.color).toBeTruthy();
    expect($w('#footerInfoHeading').style.color).toBeTruthy();
  });

  it('sets color on store info elements', () => {
    applyFooterStyles($w);
    expect($w('#footerStoreName').style.color).toBeTruthy();
    expect($w('#footerStoreAddress').style.color).toBeTruthy();
    expect($w('#footerStorePhone').style.color).toBeTruthy();
    expect($w('#footerStoreHours').style.color).toBeTruthy();
  });

  it('sets color on copyright text', () => {
    applyFooterStyles($w);
    expect($w('#footerCopyright').style.color).toBeTruthy();
  });

  it('sets newsletter input background and text colors', () => {
    applyFooterStyles($w);
    expect($w('#footerEmailInput').style.backgroundColor).toBeTruthy();
    expect($w('#footerEmailInput').style.color).toBeTruthy();
  });

  it('sets newsletter submit button colors', () => {
    applyFooterStyles($w);
    expect($w('#footerEmailSubmit').style.backgroundColor).toBeTruthy();
    expect($w('#footerEmailSubmit').style.color).toBeTruthy();
  });

  it('registers onItemReady with hover handlers on all 3 link repeaters', () => {
    applyFooterStyles($w);
    expect($w('#footerShopRepeater').onItemReady).toHaveBeenCalled();
    expect($w('#footerServiceRepeater').onItemReady).toHaveBeenCalled();
    expect($w('#footerAboutRepeater').onItemReady).toHaveBeenCalled();
  });

  it('link repeater onItemReady sets color and mouseIn/mouseOut handlers', () => {
    applyFooterStyles($w);
    const cb = $w('#footerShopRepeater').onItemReady.mock.calls[0][0];
    const mockLink = createMockElement();
    const $item = () => mockLink;
    cb($item);
    expect(mockLink.style.color).toBeTruthy();
    expect(mockLink.onMouseIn).toHaveBeenCalled();
    expect(mockLink.onMouseOut).toHaveBeenCalled();
  });

  it('link mouseIn changes to hover color, mouseOut restores base color', () => {
    applyFooterStyles($w);
    const cb = $w('#footerShopRepeater').onItemReady.mock.calls[0][0];
    const mockLink = createMockElement();
    const $item = () => mockLink;
    cb($item);
    const baseColor = mockLink.style.color;
    const mouseInHandler = mockLink.onMouseIn.mock.calls[0][0];
    mouseInHandler();
    const hoverColor = mockLink.style.color;
    expect(hoverColor).not.toBe(baseColor);
    const mouseOutHandler = mockLink.onMouseOut.mock.calls[0][0];
    mouseOutHandler();
    expect(mockLink.style.color).toBe(baseColor);
  });

  // Social bar styling handled by native Wix SocialBar widget

  it('survives when all elements throw', () => {
    const broken$w = () => { throw new Error('nope'); };
    expect(() => applyFooterStyles(broken$w)).not.toThrow();
  });

  it('link hover survives when style set throws', () => {
    applyFooterStyles($w);
    const cb = $w('#footerShopRepeater').onItemReady.mock.calls[0][0];
    const mockLink = createMockElement();
    Object.defineProperty(mockLink, 'style', {
      get() { throw new Error('no style'); },
      configurable: true,
    });
    const $item = () => mockLink;
    // onItemReady itself should not throw
    expect(() => cb($item)).not.toThrow();
  });
});

// ── fixFooterContactFallback ────────────────────────────────────────

describe('fixFooterContactFallback', () => {
  it('replaces wrong template phone number', () => {
    const textEl = createMockElement({ text: 'Call (828) 327-8030 for info' });
    const custom$w = (sel) => {
      if (sel === 'Text') return [textEl];
      return createMockElement();
    };
    fixFooterContactFallback(custom$w);
    expect(textEl.text).not.toContain('(828) 327-8030');
    expect(textEl.text).toMatch(/\d/);
  });

  it('replaces wrong template city', () => {
    const textEl = createMockElement({ text: 'Located in Hickory, NC' });
    const custom$w = (sel) => {
      if (sel === 'Text') return [textEl];
      return createMockElement();
    };
    fixFooterContactFallback(custom$w);
    expect(textEl.text).not.toContain('Hickory, NC');
  });

  it('replaces wrong template hours', () => {
    const textEl = createMockElement({ text: 'Monday-Friday 9:00am - 5:00pm EST' });
    const custom$w = (sel) => {
      if (sel === 'Text') return [textEl];
      return createMockElement();
    };
    fixFooterContactFallback(custom$w);
    expect(textEl.text).not.toContain('Monday-Friday 9:00am - 5:00pm EST');
  });

  it('leaves unrelated text elements untouched', () => {
    const textEl = createMockElement({ text: 'Quality futon frames since 1991' });
    const custom$w = (sel) => {
      if (sel === 'Text') return [textEl];
      return createMockElement();
    };
    fixFooterContactFallback(custom$w);
    expect(textEl.text).toBe('Quality futon frames since 1991');
  });

  it('skips elements with null text', () => {
    const textEl = createMockElement({ text: null });
    const custom$w = (sel) => {
      if (sel === 'Text') return [textEl];
      return createMockElement();
    };
    expect(() => fixFooterContactFallback(custom$w)).not.toThrow();
  });

  it('skips elements with empty text', () => {
    const textEl = createMockElement({ text: '' });
    const custom$w = (sel) => {
      if (sel === 'Text') return [textEl];
      return createMockElement();
    };
    expect(() => fixFooterContactFallback(custom$w)).not.toThrow();
  });

  it('handles multiple wrong values in separate elements', () => {
    const phoneEl = createMockElement({ text: '(828) 327-8030' });
    const cityEl = createMockElement({ text: 'Hickory, NC' });
    const custom$w = (sel) => {
      if (sel === 'Text') return [phoneEl, cityEl];
      return createMockElement();
    };
    fixFooterContactFallback(custom$w);
    expect(phoneEl.text).not.toContain('(828) 327-8030');
    expect(cityEl.text).not.toContain('Hickory, NC');
  });

  it('survives when $w throws', () => {
    const broken$w = () => { throw new Error('nope'); };
    expect(() => fixFooterContactFallback(broken$w)).not.toThrow();
  });

  it('survives when individual text element throws on access', () => {
    const custom$w = (sel) => {
      if (sel === 'Text') {
        return {
          length: 1,
          0: { get text() { throw new Error('no text'); } },
        };
      }
      return createMockElement();
    };
    expect(() => fixFooterContactFallback(custom$w)).not.toThrow();
  });
});

// ── initFooterCopyright — tagline replacement ────────────────────────

describe('initFooterCopyright — tagline replacement', () => {
  it('replaces "Where Comfort Meets Design" tagline in Text elements', () => {
    const textEl = createMockElement({ text: 'Where Comfort Meets Design' });
    const custom$w = (sel) => {
      if (sel === 'Text') return [textEl];
      if (!$w._els.has(sel)) $w._els.set(sel, createMockElement());
      return $w._els.get(sel);
    };
    initFooterCopyright(custom$w);
    expect(textEl.text).toContain('Carolina Futons');
    expect(textEl.text).not.toContain('Where Comfort Meets Design');
  });

  it('leaves non-matching Text elements alone', () => {
    const textEl = createMockElement({ text: 'Some other text' });
    const custom$w = (sel) => {
      if (sel === 'Text') return [textEl];
      if (!$w._els.has(sel)) $w._els.set(sel, createMockElement());
      return $w._els.get(sel);
    };
    initFooterCopyright(custom$w);
    expect(textEl.text).toBe('Some other text');
  });

  it('handles empty Text collection', () => {
    const custom$w = (sel) => {
      if (sel === 'Text') return [];
      if (!$w._els.has(sel)) $w._els.set(sel, createMockElement());
      return $w._els.get(sel);
    };
    expect(() => initFooterCopyright(custom$w)).not.toThrow();
  });

  it('handles null text in Text element', () => {
    const textEl = createMockElement({ text: null });
    const custom$w = (sel) => {
      if (sel === 'Text') return [textEl];
      if (!$w._els.has(sel)) $w._els.set(sel, createMockElement());
      return $w._els.get(sel);
    };
    expect(() => initFooterCopyright(custom$w)).not.toThrow();
  });

  it('survives when $w("Text") throws', () => {
    const custom$w = (sel) => {
      if (sel === 'Text') throw new Error('no type selector');
      if (!$w._els.has(sel)) $w._els.set(sel, createMockElement());
      return $w._els.get(sel);
    };
    expect(() => initFooterCopyright(custom$w)).not.toThrow();
  });
});

// ── initFooterLogo — deep branches ──────────────────────────────────

describe('initFooterLogo — deep branches', () => {
  it('sets src from getFooterLogoImageUrl()', () => {
    initFooterLogo($w);
    expect($w('#footerLogo').src).toBe('https://static.wixstatic.com/media/cf-logo.jpg');
  });

  it('onClick handler is wired (fire-and-forget dynamic import)', () => {
    initFooterLogo($w);
    expect($w('#footerLogo').onClick).toHaveBeenCalled();
  });

  it('onClick handler does not throw when invoked', () => {
    initFooterLogo($w);
    const handler = $w('#footerLogo').onClick.mock.calls[0][0];
    // handler does fire-and-forget dynamic import — should not throw synchronously
    expect(() => handler()).not.toThrow();
  });

  it('survives when src assignment throws', () => {
    const logo = createMockElement();
    Object.defineProperty(logo, 'src', {
      set() { throw new Error('no src'); },
      get() { return ''; },
      configurable: true,
    });
    const custom$w = () => logo;
    expect(() => initFooterLogo(custom$w)).not.toThrow();
  });
});

// ── initFooter (orchestrator) ───────────────────────────────────────

describe('initFooter', () => {
  it('initializes all footer subsections without throwing', () => {
    expect(() => initFooter($w)).not.toThrow();
  });

  it('sets up mountain divider SVG', () => {
    initFooter($w);
    expect($w('#footerMountainDivider').html).toContain('<svg');
  });

  it('sets up shop repeater data', () => {
    initFooter($w);
    expect($w('#footerShopRepeater').data.length).toBeGreaterThan(0);
  });

  it('sets up newsletter subscribe handler', () => {
    initFooter($w);
    expect($w('#footerEmailSubmit').onClick).toHaveBeenCalled();
  });

  it('sets ARIA role on footer', () => {
    initFooter($w);
    expect($w('#siteFooter').accessibility.role).toBe('contentinfo');
  });

  it('sets copyright text', () => {
    initFooter($w);
    expect($w('#footerCopyright').text).toContain('Carolina Futons');
  });

  it('sets footer logo onClick', () => {
    initFooter($w);
    expect($w('#footerLogo').onClick).toHaveBeenCalled();
  });

  it('applies footer styles (background color)', () => {
    initFooter($w);
    expect($w('#siteFooter').style.backgroundColor).toBeTruthy();
  });

  it('survives complete DOM failure (all null)', () => {
    const broken$w = () => null;
    expect(() => initFooter(broken$w)).not.toThrow();
  });

  it('survives $w that always throws', () => {
    const broken$w = () => { throw new Error('boom'); };
    expect(() => initFooter(broken$w)).not.toThrow();
  });
});

// ── buildFooterMountainSVG ───────────────────────────────────────────

describe('buildFooterMountainSVG', () => {
  const ridgeColors = { r1: '#3A2518', r2: '#5C4033', r4: '#5B8FA8' };

  it('returns a string containing <svg>', () => {
    const svg = buildFooterMountainSVG(ridgeColors);
    expect(typeof svg).toBe('string');
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });

  it('includes viewBox, aria-hidden, and preserveAspectRatio', () => {
    const svg = buildFooterMountainSVG(ridgeColors);
    expect(svg).toContain('viewBox="0 0 1440 80"');
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).toContain('preserveAspectRatio="none"');
  });

  it('applies r1 color (near layer) at opacity 0.75', () => {
    const colors = { r1: '#AA1122', r2: '#BB3344', r4: '#CC5566' };
    const svg = buildFooterMountainSVG(colors);
    // Near layer uses r1 at opacity 0.75
    expect(svg).toContain('#AA1122');
    expect(svg).toContain('opacity="0.75"');
  });

  it('applies r2 color (mid layer) at opacity 0.40', () => {
    const colors = { r1: '#AA1122', r2: '#BB3344', r4: '#CC5566' };
    const svg = buildFooterMountainSVG(colors);
    expect(svg).toContain('#BB3344');
    expect(svg).toContain('opacity="0.40"');
  });

  it('applies r4 color (far layer) at opacity 0.22', () => {
    const colors = { r1: '#AA1122', r2: '#BB3344', r4: '#CC5566' };
    const svg = buildFooterMountainSVG(colors);
    expect(svg).toContain('#CC5566');
    expect(svg).toContain('opacity="0.22"');
  });

  it('SVG filter chain: feTurbulence has result="cf-noise"', () => {
    const svg = buildFooterMountainSVG(ridgeColors);
    expect(svg).toContain('result="cf-noise"');
  });

  it('SVG filter chain: feDisplacementMap has in2="cf-noise"', () => {
    const svg = buildFooterMountainSVG(ridgeColors);
    expect(svg).toContain('in2="cf-noise"');
  });

  it('contains birds, pine-trees, and wildflowers decorations', () => {
    const svg = buildFooterMountainSVG(ridgeColors);
    expect(svg).toContain('birds');
    expect(svg).toContain('pine-trees');
    expect(svg).toContain('wildflowers');
  });

  it('falls back to default colors for invalid hex inputs', () => {
    const svg = buildFooterMountainSVG({ r1: 'javascript:bad', r2: '<script>', r4: undefined });
    // Must not contain the invalid values
    expect(svg).not.toContain('javascript:bad');
    expect(svg).not.toContain('<script>');
    // Must still render valid SVG
    expect(svg).toContain('<svg');
  });

  it('works with empty ridgeColors (uses all defaults)', () => {
    const svg = buildFooterMountainSVG({});
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });

  it('works with no argument (uses all defaults)', () => {
    const svg = buildFooterMountainSVG();
    expect(svg).toContain('<svg');
  });
});

// ── initMountainDividerWithSkyWiring ─────────────────────────────────

describe('initMountainDividerWithSkyWiring', () => {
  it('sets #footerMountainDivider.html using state.ridgeColors', () => {
    const state = { ridgeColors: { r1: '#AA1122', r2: '#BB3344', r4: '#CC5566' } };
    initMountainDividerWithSkyWiring($w, state);
    const html = $w('#footerMountainDivider').html;
    expect(html).toContain('#AA1122');
    expect(html).toContain('#BB3344');
    expect(html).toContain('#CC5566');
    expect(html).toContain('<svg');
  });

  it('handles state with no ridgeColors gracefully (uses defaults)', () => {
    initMountainDividerWithSkyWiring($w, {});
    expect($w('#footerMountainDivider').html).toContain('<svg');
  });

  it('handles null state gracefully', () => {
    expect(() => initMountainDividerWithSkyWiring($w, null)).not.toThrow();
  });

  it('handles missing divider element gracefully', () => {
    const custom$w = () => null;
    expect(() => initMountainDividerWithSkyWiring(custom$w, { ridgeColors: {} })).not.toThrow();
  });
});
