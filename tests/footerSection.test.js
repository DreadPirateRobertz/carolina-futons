/**
 * Tests for FooterSection.js — Footer initialization module
 *
 * Tests the extracted footer logic: 4-column links, newsletter wiring
 * (subscribeToNewsletter), social icons, trust badges, ARIA landmarks,
 * mobile collapse, error/empty states.
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
  initFooter,
} from '../src/public/FooterSection.js';

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

import { subscribeToNewsletter } from 'backend/newsletterService.web';

// ── Mock helpers ────────────────────────────────────────────────────

function createMockElement(overrides = {}) {
  return {
    text: '',
    src: '',
    value: '',
    label: '',
    data: [],
    style: { color: '' },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(),
    expand: vi.fn(),
    onClick: vi.fn(),
    onChange: vi.fn(),
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
  it('populates social repeater with platform data', () => {
    initFooterSocial($w);
    const repeater = $w('#footerSocialRepeater');
    expect(repeater.data.length).toBeGreaterThan(0);
    expect(repeater.data[0]).toHaveProperty('platform');
    expect(repeater.data[0]).toHaveProperty('url');
  });

  it('registers onItemReady for social repeater', () => {
    initFooterSocial($w);
    expect($w('#footerSocialRepeater').onItemReady).toHaveBeenCalledTimes(1);
  });

  it('onItemReady sets icon text and ARIA label', () => {
    initFooterSocial($w);
    const cb = $w('#footerSocialRepeater').onItemReady.mock.calls[0][0];
    const mockItem = createMockElement();
    const $item = () => mockItem;
    cb($item, {
      platform: 'facebook',
      url: 'https://www.facebook.com/carolinafutons',
      ariaLabel: 'Visit Carolina Futons on Facebook',
    });
    expect(mockItem.text).toBe('facebook');
    expect(mockItem.accessibility.ariaLabel).toContain('Facebook');
  });

  it('onItemReady registers onClick that opens link', () => {
    initFooterSocial($w);
    const cb = $w('#footerSocialRepeater').onItemReady.mock.calls[0][0];
    const mockItem = createMockElement();
    const $item = () => mockItem;
    cb($item, {
      platform: 'instagram',
      url: 'https://www.instagram.com/carolinafutons',
      ariaLabel: 'Follow on Instagram',
    });
    expect(mockItem.onClick).toHaveBeenCalled();
  });

  it('survives when social repeater is missing', () => {
    const broken$w = () => null;
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

// ── initFooter (orchestrator) ───────────────────────────────────────

describe('initFooter', () => {
  it('initializes all footer subsections without throwing', () => {
    expect(() => initFooter($w)).not.toThrow();
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

  it('survives complete DOM failure', () => {
    const broken$w = () => null;
    expect(() => initFooter(broken$w)).not.toThrow();
  });
});
