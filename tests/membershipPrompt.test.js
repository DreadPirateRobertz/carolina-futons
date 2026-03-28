/**
 * Tests for MembershipPrompt.js
 *
 * Covers: initMembershipPrompt (modal setup, ARIA, accessible dialog, benefits, upgrade link),
 * showMembershipPrompt (context titles, one-time session guard, announce, dialog open).
 *
 * See CF-llrd for original specification.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────

vi.mock('public/a11yHelpers.js', () => ({
  setupAccessibleDialog: vi.fn(),
  announce: vi.fn(),
}));

vi.mock('public/membershipHelpers.js', () => ({
  getBenefitsList: vi.fn(() => [
    'Free shipping on every order',
    '10% member discount on all products',
    'Early access to new arrivals and sales',
  ]),
}));

vi.mock('wix-storage-frontend', () => ({
  session: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
  },
}));

import { initMembershipPrompt, showMembershipPrompt } from '../src/public/MembershipPrompt.js';
import { setupAccessibleDialog, announce } from 'public/a11yHelpers.js';
import { getBenefitsList } from 'public/membershipHelpers.js';
import { session } from 'wix-storage-frontend';

// ── Test Helpers ──────────────────────────────────────────────────────

function createMockElement() {
  return {
    text: '',
    label: '',
    link: '',
    accessibility: {},
    collapse: vi.fn(() => Promise.resolve()),
    expand: vi.fn(() => Promise.resolve()),
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    enable: vi.fn(),
    disable: vi.fn(),
    focus: vi.fn(),
    onClick: vi.fn(),
  };
}

function createMock$w() {
  const elements = {};
  const $w = vi.fn((selector) => {
    if (!elements[selector]) elements[selector] = createMockElement();
    return elements[selector];
  });
  $w._elements = elements;
  return $w;
}

// ── initMembershipPrompt — modal setup ────────────────────────────────

describe('initMembershipPrompt — modal setup', () => {
  let $w, mockDialog;

  beforeEach(() => {
    vi.clearAllMocks();
    $w = createMock$w();
    mockDialog = { open: vi.fn(), close: vi.fn() };
    setupAccessibleDialog.mockReturnValue(mockDialog);
    session.getItem.mockReturnValue(null);
  });

  it('collapses membershipPromptModal on init', () => {
    initMembershipPrompt($w);
    expect($w('#membershipPromptModal').collapse).toHaveBeenCalled();
  });

  it('sets ARIA role dialog on membershipPromptModal', () => {
    initMembershipPrompt($w);
    expect($w('#membershipPromptModal').accessibility.role).toBe('dialog');
  });

  it('sets ariaModal true on membershipPromptModal', () => {
    initMembershipPrompt($w);
    expect($w('#membershipPromptModal').accessibility.ariaModal).toBe(true);
  });

  it('sets membershipUpgradeBtn link to pricing plans page', () => {
    initMembershipPrompt($w);
    expect($w('#membershipUpgradeBtn').link).toContain('/pricing');
  });

  it('populates membershipPromptBenefits with benefit text', () => {
    initMembershipPrompt($w);
    const text = $w('#membershipPromptBenefits').text;
    expect(text).toContain('Free shipping');
    expect(text).toContain('10% member discount');
    expect(text).toMatch(/^• /);
    expect(text).toContain('\n• ');
  });

  it('calls setupAccessibleDialog with correct panel, close, and title IDs', () => {
    initMembershipPrompt($w);
    expect(setupAccessibleDialog).toHaveBeenCalledWith(
      $w,
      expect.objectContaining({
        panelId: '#membershipPromptModal',
        closeId: '#membershipPromptClose',
        titleId: '#membershipPromptTitle',
      })
    );
  });

  it('announces "Membership prompt closed" via onClose callback', () => {
    initMembershipPrompt($w);
    const config = setupAccessibleDialog.mock.calls[0][1];
    config.onClose();
    expect(announce).toHaveBeenCalledWith($w, 'Membership prompt closed');
  });

  it('returns the dialog object', () => {
    const result = initMembershipPrompt($w);
    expect(result).toBe(mockDialog);
  });

  it('returns null when setupAccessibleDialog returns null', () => {
    setupAccessibleDialog.mockReturnValue(null);
    const result = initMembershipPrompt($w);
    expect(result).toBeNull();
  });

  it('returns null and logs error when setupAccessibleDialog throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    setupAccessibleDialog.mockImplementation(() => { throw new Error('dialog setup failed'); });
    const result = initMembershipPrompt($w);
    expect(result).toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('addresses #membershipPromptModal', () => {
    initMembershipPrompt($w);
    expect($w).toHaveBeenCalledWith('#membershipPromptModal');
  });

  it('addresses #membershipPromptClose', () => {
    initMembershipPrompt($w);
    const config = setupAccessibleDialog.mock.calls[0][1];
    expect(config.closeId).toBe('#membershipPromptClose');
  });

  it('addresses #membershipPromptBenefits', () => {
    initMembershipPrompt($w);
    expect($w).toHaveBeenCalledWith('#membershipPromptBenefits');
  });

  it('addresses #membershipUpgradeBtn', () => {
    initMembershipPrompt($w);
    expect($w).toHaveBeenCalledWith('#membershipUpgradeBtn');
  });
});

// ── showMembershipPrompt — context titles ─────────────────────────────

describe('showMembershipPrompt — context titles', () => {
  let $w, mockDialog;

  beforeEach(() => {
    vi.clearAllMocks();
    $w = createMock$w();
    mockDialog = { open: vi.fn(), close: vi.fn() };
    setupAccessibleDialog.mockReturnValue(mockDialog);
    session.getItem.mockReturnValue(null);
    initMembershipPrompt($w);
    vi.clearAllMocks();
    session.getItem.mockReturnValue(null);
  });

  it('addresses #membershipPromptTitle', () => {
    showMembershipPrompt($w, 'wishlist-alerts', mockDialog);
    expect($w).toHaveBeenCalledWith('#membershipPromptTitle');
  });

  it('sets context-specific title for wishlist-alerts', () => {
    showMembershipPrompt($w, 'wishlist-alerts', mockDialog);
    expect($w('#membershipPromptTitle').text).toBeTruthy();
    expect($w('#membershipPromptTitle').text.toLowerCase()).toMatch(/wishlist|alert|stock/);
  });

  it('sets context-specific title for swatch-request', () => {
    showMembershipPrompt($w, 'swatch-request', mockDialog);
    expect($w('#membershipPromptTitle').text).toBeTruthy();
    expect($w('#membershipPromptTitle').text.toLowerCase()).toMatch(/swatch/);
  });

  it('sets context-specific title for price-match', () => {
    showMembershipPrompt($w, 'price-match', mockDialog);
    expect($w('#membershipPromptTitle').text).toBeTruthy();
    expect($w('#membershipPromptTitle').text.toLowerCase()).toMatch(/price.match|price match/i);
  });

  it('uses fallback title for unknown context', () => {
    showMembershipPrompt($w, 'unknown-context', mockDialog);
    expect($w('#membershipPromptTitle').text).toMatch(/unlock|exclusive|CF\+/i);
  });

  it('opens the dialog', () => {
    showMembershipPrompt($w, 'wishlist-alerts', mockDialog);
    expect(mockDialog.open).toHaveBeenCalled();
  });

  it('announces CF+ membership benefits', () => {
    showMembershipPrompt($w, 'wishlist-alerts', mockDialog);
    expect(announce).toHaveBeenCalledWith($w, expect.stringMatching(/CF\+|membership|benefit/i));
  });

  it('does not throw when dialog is null', () => {
    expect(() => showMembershipPrompt($w, 'wishlist-alerts', null)).not.toThrow();
  });

  it('still announces when dialog is null', () => {
    showMembershipPrompt($w, 'wishlist-alerts', null);
    expect(announce).toHaveBeenCalled();
  });
});

// ── showMembershipPrompt — one-time session guard ─────────────────────

describe('showMembershipPrompt — one-time session guard', () => {
  let $w, mockDialog;

  beforeEach(() => {
    vi.clearAllMocks();
    $w = createMock$w();
    mockDialog = { open: vi.fn(), close: vi.fn() };
    setupAccessibleDialog.mockReturnValue(mockDialog);
    session.getItem.mockReturnValue(null);
    initMembershipPrompt($w);
    vi.clearAllMocks();
    session.getItem.mockReturnValue(null);
  });

  it('sets session flag on first show', () => {
    showMembershipPrompt($w, 'wishlist-alerts', mockDialog);
    expect(session.setItem).toHaveBeenCalledWith('cf_membership_prompt_shown', expect.any(String));
  });

  it('does not open dialog when session flag is already set', () => {
    session.getItem.mockReturnValue('1');
    showMembershipPrompt($w, 'wishlist-alerts', mockDialog);
    expect(mockDialog.open).not.toHaveBeenCalled();
  });

  it('does not set title when session flag already set', () => {
    session.getItem.mockReturnValue('1');
    showMembershipPrompt($w, 'wishlist-alerts', mockDialog);
    expect($w('#membershipPromptTitle').text).toBe('');
  });

  it('does not announce when session flag already set', () => {
    session.getItem.mockReturnValue('1');
    showMembershipPrompt($w, 'wishlist-alerts', mockDialog);
    expect(announce).not.toHaveBeenCalled();
  });

  it('opens dialog on first call but not second', () => {
    showMembershipPrompt($w, 'wishlist-alerts', mockDialog);
    expect(mockDialog.open).toHaveBeenCalledTimes(1);

    session.getItem.mockReturnValue('1');
    showMembershipPrompt($w, 'swatch-request', mockDialog);
    expect(mockDialog.open).toHaveBeenCalledTimes(1); // still 1
  });

  it('does not throw when session.getItem throws', () => {
    session.getItem.mockImplementation(() => { throw new Error('storage unavailable'); });
    expect(() => showMembershipPrompt($w, 'wishlist-alerts', mockDialog)).not.toThrow();
  });

  it('reads session storage with the correct key', () => {
    showMembershipPrompt($w, 'wishlist-alerts', mockDialog);
    const [readKey] = session.getItem.mock.calls[0];
    const [writeKey] = session.setItem.mock.calls[0];
    expect(readKey).toBe(writeKey); // consistent key
  });
});
