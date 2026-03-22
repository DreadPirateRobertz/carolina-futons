/**
 * Tests for src/public/NotificationPreferences.js
 *
 * Covers: init (logged-in, logged-out, prefs population, member/SMS toggle
 * visibility), save (happy path, error, spinner), unsubscribe all (confirm
 * dialog, cancel, confirm, error), accessible dialog, a11y aria-labels,
 * element nicknames.
 *
 * See CF-n3px for original specification.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────

vi.mock('public/a11yHelpers.js', () => ({
  announce: vi.fn(),
  setupAccessibleDialog: vi.fn(() => ({
    open:  vi.fn(),
    close: vi.fn(),
  })),
}));

vi.mock('backend/notificationPreferences.web.js', () => ({
  getNotificationPreferences: vi.fn(),
  saveNotificationPreferences: vi.fn(),
  unsubscribeAll: vi.fn(),
}));

vi.mock('backend/errorMonitoring.web', () => ({
  logError: vi.fn(),
}));

import { initNotificationPreferences } from '../src/public/NotificationPreferences.js';
import { announce, setupAccessibleDialog } from 'public/a11yHelpers.js';
import {
  getNotificationPreferences,
  saveNotificationPreferences,
  unsubscribeAll,
} from 'backend/notificationPreferences.web.js';
import { logError } from 'backend/errorMonitoring.web';

// ── Test Helpers ──────────────────────────────────────────────────────

function createMockElement() {
  return {
    text:  '',
    label: '',
    value: '',
    checked: false,
    accessibility: {},
    customClassList: { add: vi.fn(), remove: vi.fn() },
    collapse: vi.fn(() => Promise.resolve()),
    expand:   vi.fn(() => Promise.resolve()),
    show:     vi.fn(() => Promise.resolve()),
    hide:     vi.fn(() => Promise.resolve()),
    enable:   vi.fn(),
    disable:  vi.fn(),
    onClick:  vi.fn(),
    onChange: vi.fn(),
  };
}

function createMock$w() {
  const elements = {};
  return vi.fn((selector) => {
    if (!elements[selector]) elements[selector] = createMockElement();
    return elements[selector];
  });
}

function standardSetup() {
  vi.clearAllMocks();
  // Re-stub setupAccessibleDialog to return fresh open/close fns
  setupAccessibleDialog.mockReturnValue({ open: vi.fn(), close: vi.fn() });
  const $w = createMock$w();
  return { $w };
}

const MEMBER_ID = 'member-abc123';

const DEFAULT_PREFS = {
  restock:     true,
  orderUpdate: true,
  promo:       false,
  cfPlus:      true,
  sms:         false,
};

function mockPrefs(overrides = {}) {
  getNotificationPreferences.mockResolvedValue({
    success: true,
    prefs: { ...DEFAULT_PREFS, ...overrides },
  });
}

function getClickHandler(el) {
  const calls = el.onClick.mock.calls;
  if (!calls.length) throw new Error('No onClick handler registered');
  return calls[calls.length - 1][0];
}

// ── initNotificationPreferences — logged out ──────────────────────────

describe('initNotificationPreferences — logged out / no memberId', () => {
  it('returns null when memberId is null', async () => {
    const { $w } = standardSetup();
    const result = await initNotificationPreferences($w, null);
    expect(result).toBeNull();
  });

  it('hides notifPageSection when memberId is missing', async () => {
    const { $w } = standardSetup();
    await initNotificationPreferences($w, null);
    expect($w('#notifPageSection').hide).toHaveBeenCalled();
  });

  it('shows notifLoginPrompt when memberId is missing', async () => {
    const { $w } = standardSetup();
    await initNotificationPreferences($w, null);
    expect($w('#notifLoginPrompt').show).toHaveBeenCalled();
  });

  it('does not call getNotificationPreferences when logged out', async () => {
    const { $w } = standardSetup();
    await initNotificationPreferences($w, null);
    expect(getNotificationPreferences).not.toHaveBeenCalled();
  });
});

// ── initNotificationPreferences — prefs loading ───────────────────────

describe('initNotificationPreferences — loads and populates prefs', () => {
  let $w;

  beforeEach(async () => {
    ({ $w } = standardSetup());
    mockPrefs();
    await initNotificationPreferences($w, MEMBER_ID);
  });

  it('calls getNotificationPreferences (server derives member ID)', () => {
    expect(getNotificationPreferences).toHaveBeenCalled();
  });

  it('shows notifPageSection', () => {
    expect($w('#notifPageSection').show).toHaveBeenCalled();
  });

  it('hides notifLoginPrompt', () => {
    expect($w('#notifLoginPrompt').hide).toHaveBeenCalled();
  });

  it('sets notifRestockToggle.checked from prefs (true)', () => {
    expect($w('#notifRestockToggle').checked).toBe(true);
  });

  it('sets notifOrderToggle.checked from prefs (true)', () => {
    expect($w('#notifOrderToggle').checked).toBe(true);
  });

  it('sets notifPromoToggle.checked from prefs (false)', () => {
    expect($w('#notifPromoToggle').checked).toBe(false);
  });

  it('sets notifCFPlusToggle.checked from prefs (true)', () => {
    expect($w('#notifCFPlusToggle').checked).toBe(true);
  });

  it('sets notifSmsToggle.checked from prefs (false)', () => {
    expect($w('#notifSmsToggle').checked).toBe(false);
  });

  it('hides notifSaveSuccess initially', () => {
    expect($w('#notifSaveSuccess').hide).toHaveBeenCalled();
  });

  it('hides notifSaveError initially', () => {
    expect($w('#notifSaveError').hide).toHaveBeenCalled();
  });

  it('hides notifSaveSpinner initially', () => {
    expect($w('#notifSaveSpinner').hide).toHaveBeenCalled();
  });

  it('hides notifUnsubscribeConfirm initially', () => {
    expect($w('#notifUnsubscribeConfirm').hide).toHaveBeenCalled();
  });
});

// ── CF+ toggle visibility ─────────────────────────────────────────────

describe('initNotificationPreferences — cfPlus toggle visibility', () => {
  it('shows notifCFPlusToggle when isMember is true', async () => {
    const { $w } = standardSetup();
    mockPrefs();
    await initNotificationPreferences($w, MEMBER_ID, { isCFPlusMember: true });
    expect($w('#notifCFPlusToggle').show).toHaveBeenCalled();
    expect($w('#notifCFPlusToggle').hide).not.toHaveBeenCalled();
  });

  it('hides notifCFPlusToggle when isCFPlusMember is false', async () => {
    const { $w } = standardSetup();
    mockPrefs();
    await initNotificationPreferences($w, MEMBER_ID, { isCFPlusMember: false });
    expect($w('#notifCFPlusToggle').hide).toHaveBeenCalled();
  });

  it('hides notifCFPlusToggle by default (no options passed)', async () => {
    const { $w } = standardSetup();
    mockPrefs();
    await initNotificationPreferences($w, MEMBER_ID);
    expect($w('#notifCFPlusToggle').hide).toHaveBeenCalled();
  });
});

// ── SMS toggle visibility ─────────────────────────────────────────────

describe('initNotificationPreferences — SMS toggle visibility', () => {
  it('shows notifSmsToggle when hasPhone is true', async () => {
    const { $w } = standardSetup();
    mockPrefs();
    await initNotificationPreferences($w, MEMBER_ID, { hasPhone: true });
    expect($w('#notifSmsToggle').show).toHaveBeenCalled();
    expect($w('#notifSmsToggle').hide).not.toHaveBeenCalled();
  });

  it('hides notifSmsToggle when hasPhone is false', async () => {
    const { $w } = standardSetup();
    mockPrefs();
    await initNotificationPreferences($w, MEMBER_ID, { hasPhone: false });
    expect($w('#notifSmsToggle').hide).toHaveBeenCalled();
  });

  it('hides notifSmsToggle by default', async () => {
    const { $w } = standardSetup();
    mockPrefs();
    await initNotificationPreferences($w, MEMBER_ID);
    expect($w('#notifSmsToggle').hide).toHaveBeenCalled();
  });
});

// ── aria-labels ───────────────────────────────────────────────────────

describe('initNotificationPreferences — aria-labels on toggles', () => {
  let $w;

  beforeEach(async () => {
    ({ $w } = standardSetup());
    mockPrefs();
    await initNotificationPreferences($w, MEMBER_ID);
  });

  it('sets aria-label on notifRestockToggle', () => {
    expect($w('#notifRestockToggle').accessibility.ariaLabel).toBeTruthy();
  });

  it('sets aria-label on notifOrderToggle', () => {
    expect($w('#notifOrderToggle').accessibility.ariaLabel).toBeTruthy();
  });

  it('sets aria-label on notifPromoToggle', () => {
    expect($w('#notifPromoToggle').accessibility.ariaLabel).toBeTruthy();
  });

  it('sets aria-label on notifCFPlusToggle', () => {
    expect($w('#notifCFPlusToggle').accessibility.ariaLabel).toBeTruthy();
  });

  it('sets aria-label on notifSmsToggle', () => {
    expect($w('#notifSmsToggle').accessibility.ariaLabel).toBeTruthy();
  });
});

// ── save preferences ──────────────────────────────────────────────────

describe('initNotificationPreferences — save happy path', () => {
  let $w;

  beforeEach(async () => {
    ({ $w } = standardSetup());
    mockPrefs();
    saveNotificationPreferences.mockResolvedValue({ success: true });
    await initNotificationPreferences($w, MEMBER_ID);
  });

  it('wires onClick on notifSaveBtn', () => {
    expect($w('#notifSaveBtn').onClick).toHaveBeenCalled();
  });

  it('shows notifSaveSpinner on save', async () => {
    await getClickHandler($w('#notifSaveBtn'))();
    expect($w('#notifSaveSpinner').show).toHaveBeenCalled();
  });

  it('hides notifSaveSpinner after save', async () => {
    await getClickHandler($w('#notifSaveBtn'))();
    expect($w('#notifSaveSpinner').hide).toHaveBeenCalled();
  });

  it('calls saveNotificationPreferences with toggle states (server derives member ID)', async () => {
    await getClickHandler($w('#notifSaveBtn'))();
    expect(saveNotificationPreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        restock:     expect.any(Boolean),
        orderUpdate: expect.any(Boolean),
        promo:       expect.any(Boolean),
        cfPlus:      expect.any(Boolean),
        sms:         expect.any(Boolean),
      })
    );
  });

  it('shows notifSaveSuccess after successful save', async () => {
    await getClickHandler($w('#notifSaveBtn'))();
    expect($w('#notifSaveSuccess').show).toHaveBeenCalled();
  });

  it('hides notifSaveError on successful save', async () => {
    await getClickHandler($w('#notifSaveBtn'))();
    expect($w('#notifSaveError').hide).toHaveBeenCalled();
  });

  it('announces save success', async () => {
    await getClickHandler($w('#notifSaveBtn'))();
    expect(announce).toHaveBeenCalledWith($w, expect.stringMatching(/saved|updated/i));
  });
});

// ── save error ────────────────────────────────────────────────────────

describe('initNotificationPreferences — save error', () => {
  let $w;

  beforeEach(async () => {
    ({ $w } = standardSetup());
    mockPrefs();
    await initNotificationPreferences($w, MEMBER_ID);
  });

  it('shows notifSaveError when saveNotificationPreferences returns success: false', async () => {
    saveNotificationPreferences.mockResolvedValue({ success: false, error: 'DB error' });
    await getClickHandler($w('#notifSaveBtn'))();
    expect($w('#notifSaveError').show).toHaveBeenCalled();
  });

  it('hides notifSaveSuccess on error', async () => {
    saveNotificationPreferences.mockResolvedValue({ success: false, error: 'DB error' });
    await getClickHandler($w('#notifSaveBtn'))();
    expect($w('#notifSaveSuccess').hide).toHaveBeenCalled();
  });

  it('hides notifSaveSpinner even on error', async () => {
    saveNotificationPreferences.mockResolvedValue({ success: false, error: 'DB error' });
    await getClickHandler($w('#notifSaveBtn'))();
    expect($w('#notifSaveSpinner').hide).toHaveBeenCalled();
  });

  it('calls logError when saveNotificationPreferences returns success: false', async () => {
    saveNotificationPreferences.mockResolvedValue({ success: false, error: 'DB error' });
    await getClickHandler($w('#notifSaveBtn'))();
    expect(logError).toHaveBeenCalled();
  });

  it('hides notifSaveSpinner when saveNotificationPreferences throws', async () => {
    saveNotificationPreferences.mockRejectedValue(new Error('network error'));
    await getClickHandler($w('#notifSaveBtn'))();
    expect($w('#notifSaveSpinner').hide).toHaveBeenCalled();
  });

  it('calls logError when saveNotificationPreferences throws', async () => {
    saveNotificationPreferences.mockRejectedValue(new Error('network error'));
    await getClickHandler($w('#notifSaveBtn'))();
    expect(logError).toHaveBeenCalled();
  });

  it('does not throw when saveNotificationPreferences throws', async () => {
    saveNotificationPreferences.mockRejectedValue(new Error('network error'));
    await expect(getClickHandler($w('#notifSaveBtn'))()).resolves.not.toThrow();
  });

  it('announces error when save fails', async () => {
    saveNotificationPreferences.mockResolvedValue({ success: false, error: 'DB error' });
    await getClickHandler($w('#notifSaveBtn'))();
    expect(announce).toHaveBeenCalledWith($w, expect.stringMatching(/error|failed|unable/i));
  });
});

// ── unsubscribe confirm dialog ────────────────────────────────────────

describe('initNotificationPreferences — unsubscribe confirm dialog', () => {
  let $w, dialog;

  beforeEach(async () => {
    ({ $w } = standardSetup());
    dialog = { open: vi.fn(), close: vi.fn() };
    setupAccessibleDialog.mockReturnValue(dialog);
    mockPrefs();
    await initNotificationPreferences($w, MEMBER_ID);
  });

  it('wires onClick on notifUnsubscribeAll', () => {
    expect($w('#notifUnsubscribeAll').onClick).toHaveBeenCalled();
  });

  it('opens confirm dialog when notifUnsubscribeAll clicked', async () => {
    await getClickHandler($w('#notifUnsubscribeAll'))();
    expect(dialog.open).toHaveBeenCalled();
  });

  it('does not call unsubscribeAll backend on initial click', async () => {
    await getClickHandler($w('#notifUnsubscribeAll'))();
    expect(unsubscribeAll).not.toHaveBeenCalled();
  });

  it('wires notifUnsubscribeCancelBtn to close dialog', async () => {
    expect($w('#notifUnsubscribeCancelBtn').onClick).toHaveBeenCalled();
    await getClickHandler($w('#notifUnsubscribeCancelBtn'))();
    expect(dialog.close).toHaveBeenCalled();
  });

  it('calls setupAccessibleDialog with correct panelId', () => {
    expect(setupAccessibleDialog).toHaveBeenCalledWith(
      $w,
      expect.objectContaining({ panelId: '#notifUnsubscribeConfirm' })
    );
  });
});

// ── unsubscribe confirm flow ──────────────────────────────────────────

describe('initNotificationPreferences — unsubscribe confirm + success', () => {
  let $w, dialog;

  beforeEach(async () => {
    ({ $w } = standardSetup());
    dialog = { open: vi.fn(), close: vi.fn() };
    setupAccessibleDialog.mockReturnValue(dialog);
    mockPrefs();
    unsubscribeAll.mockResolvedValue({ success: true });
    await initNotificationPreferences($w, MEMBER_ID);
  });

  it('calls unsubscribeAll backend when confirm button clicked', async () => {
    await getClickHandler($w('#notifUnsubscribeConfirmBtn'))();
    expect(unsubscribeAll).toHaveBeenCalled();
  });

  it('closes dialog after successful unsubscribe', async () => {
    await getClickHandler($w('#notifUnsubscribeConfirmBtn'))();
    expect(dialog.close).toHaveBeenCalled();
  });

  it('refreshes prefs after unsubscribe (calls getNotificationPreferences again)', async () => {
    await getClickHandler($w('#notifUnsubscribeConfirmBtn'))();
    expect(getNotificationPreferences).toHaveBeenCalledTimes(2);
  });

  it('sets all toggles to false after unsubscribe all', async () => {
    // Mock second prefs load returning all-false
    getNotificationPreferences.mockResolvedValueOnce({ success: true, prefs: {
      restock: false, orderUpdate: false, promo: false, cfPlus: false, sms: false,
    }});
    await getClickHandler($w('#notifUnsubscribeConfirmBtn'))();
    expect($w('#notifRestockToggle').checked).toBe(false);
    expect($w('#notifOrderToggle').checked).toBe(false);
  });

  it('announces success after unsubscribe', async () => {
    await getClickHandler($w('#notifUnsubscribeConfirmBtn'))();
    expect(announce).toHaveBeenCalledWith($w, expect.stringMatching(/unsubscribed|removed/i));
  });
});

// ── unsubscribe error ─────────────────────────────────────────────────

describe('initNotificationPreferences — unsubscribe error', () => {
  let $w;

  beforeEach(async () => {
    ({ $w } = standardSetup());
    mockPrefs();
    await initNotificationPreferences($w, MEMBER_ID);
  });

  it('calls logError when unsubscribeAll returns success: false', async () => {
    unsubscribeAll.mockResolvedValue({ success: false, error: 'DB error' });
    await getClickHandler($w('#notifUnsubscribeConfirmBtn'))();
    expect(logError).toHaveBeenCalled();
  });

  it('calls logError when unsubscribeAll throws', async () => {
    unsubscribeAll.mockRejectedValue(new Error('network error'));
    await getClickHandler($w('#notifUnsubscribeConfirmBtn'))();
    expect(logError).toHaveBeenCalled();
  });

  it('does not throw when unsubscribeAll throws', async () => {
    unsubscribeAll.mockRejectedValue(new Error('network error'));
    await expect(getClickHandler($w('#notifUnsubscribeConfirmBtn'))()).resolves.not.toThrow();
  });

  it('shows notifSaveError when unsubscribeAll fails', async () => {
    unsubscribeAll.mockResolvedValue({ success: false, error: 'DB error' });
    await getClickHandler($w('#notifUnsubscribeConfirmBtn'))();
    expect($w('#notifSaveError').show).toHaveBeenCalled();
  });
});

// ── getNotificationPreferences error handling ─────────────────────────

describe('initNotificationPreferences — getNotificationPreferences error', () => {
  it('calls logError when getNotificationPreferences returns success: false', async () => {
    const { $w } = standardSetup();
    getNotificationPreferences.mockResolvedValue({ success: false, error: 'DB error' });
    await initNotificationPreferences($w, MEMBER_ID);
    expect(logError).toHaveBeenCalled();
  });

  it('calls logError when getNotificationPreferences throws', async () => {
    const { $w } = standardSetup();
    getNotificationPreferences.mockRejectedValue(new Error('network error'));
    await initNotificationPreferences($w, MEMBER_ID);
    expect(logError).toHaveBeenCalled();
  });

  it('does not throw when getNotificationPreferences throws', async () => {
    const { $w } = standardSetup();
    getNotificationPreferences.mockRejectedValue(new Error('network error'));
    await expect(initNotificationPreferences($w, MEMBER_ID)).resolves.not.toThrow();
  });
});

// ── element nicknames ─────────────────────────────────────────────────

describe('element nicknames — all required IDs addressed', () => {
  let $w;

  beforeEach(async () => {
    ({ $w } = standardSetup());
    mockPrefs();
    saveNotificationPreferences.mockResolvedValue({ success: true });
    unsubscribeAll.mockResolvedValue({ success: true });
    await initNotificationPreferences($w, MEMBER_ID, { isCFPlusMember: true, hasPhone: true });
  });

  const IDS = [
    '#notifPageSection',
    '#notifLoginPrompt',
    '#notifRestockToggle',
    '#notifOrderToggle',
    '#notifPromoToggle',
    '#notifCFPlusToggle',
    '#notifSmsToggle',
    '#notifSaveBtn',
    '#notifSaveSuccess',
    '#notifSaveError',
    '#notifSaveSpinner',
    '#notifUnsubscribeAll',
    '#notifUnsubscribeConfirm',
    '#notifUnsubscribeConfirmBtn',
    '#notifUnsubscribeCancelBtn',
  ];

  for (const id of IDS) {
    it(`addresses ${id}`, () => {
      expect($w).toHaveBeenCalledWith(id);
    });
  }
});
