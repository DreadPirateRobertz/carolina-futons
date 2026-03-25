/**
 * notificationPrefsWidget.test.js
 * CF-rpsx — NotificationPrefsWidget: member notification settings panel
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initNotificationPrefsWidget } from '../src/public/NotificationPrefsWidget.js';

// ── $w mock helpers ──────────────────────────────────────────────────────────

function makeToggle(checked = false) {
  return {
    checked,
    _enabled: true,
    show: vi.fn(function () { this._visible = true; }),
    hide: vi.fn(function () { this._visible = false; }),
    enable: vi.fn(function () { this._enabled = true; }),
    disable: vi.fn(function () { this._enabled = false; }),
    onChange: vi.fn(),
  };
}

function makeEl() {
  return {
    text: '',
    _visible: true,
    show: vi.fn(function () { this._visible = true; }),
    hide: vi.fn(function () { this._visible = false; }),
    enable: vi.fn(function () { this._enabled = true; }),
    disable: vi.fn(function () { this._enabled = false; }),
    onClick: vi.fn(),
  };
}

function make$w() {
  const els = {
    '#notifTitle':        makeEl(),
    '#notifStreakToggle':  makeToggle(),
    '#notifQuestToggle':  makeToggle(),
    '#notifTierToggle':   makeToggle(),
    '#notifPromoToggle':  makeToggle(),
    '#notifDigestToggle': makeToggle(),
    '#notifSaveBtn':      makeEl(),
    '#notifSaveStatus':   makeEl(),
    '#notifError':        makeEl(),
  };

  return (id) => els[id] ?? makeEl();
}

// ── Data helpers ──────────────────────────────────────────────────────────────

const MEMBER_ID = 'mem-notif-1';

function makePrefs(overrides = {}) {
  return {
    streakReminders: true,
    questAlerts: true,
    tierUpdates: false,
    promotionalEmails: false,
    weeklyDigest: true,
    ...overrides,
  };
}

function makeOpts($w, prefs) {
  return {
    $w,
    getNotificationPrefs: vi.fn().mockResolvedValue(prefs),
    updateNotificationPrefs: vi.fn().mockResolvedValue({ success: true }),
  };
}

// ── Loading prefs ────────────────────────────────────────────────────────────

describe('initNotificationPrefsWidget — loading prefs', () => {
  let $w;
  beforeEach(() => { vi.clearAllMocks(); $w = make$w(); });

  it('sets #notifTitle to "Notification Preferences"', async () => {
    const opts = makeOpts($w, makePrefs());
    await initNotificationPrefsWidget(MEMBER_ID, opts);
    expect($w('#notifTitle').text).toBe('Notification Preferences');
  });

  it('passes memberId to getNotificationPrefs', async () => {
    const opts = makeOpts($w, makePrefs());
    await initNotificationPrefsWidget('specific-member', opts);
    expect(opts.getNotificationPrefs).toHaveBeenCalledWith('specific-member');
  });

  it('sets streak toggle checked from prefs', async () => {
    const opts = makeOpts($w, makePrefs({ streakReminders: true }));
    await initNotificationPrefsWidget(MEMBER_ID, opts);
    expect($w('#notifStreakToggle').checked).toBe(true);
  });

  it('sets quest toggle checked from prefs', async () => {
    const opts = makeOpts($w, makePrefs({ questAlerts: false }));
    await initNotificationPrefsWidget(MEMBER_ID, opts);
    expect($w('#notifQuestToggle').checked).toBe(false);
  });

  it('sets tier toggle checked from prefs', async () => {
    const opts = makeOpts($w, makePrefs({ tierUpdates: true }));
    await initNotificationPrefsWidget(MEMBER_ID, opts);
    expect($w('#notifTierToggle').checked).toBe(true);
  });

  it('sets promo toggle checked from prefs', async () => {
    const opts = makeOpts($w, makePrefs({ promotionalEmails: true }));
    await initNotificationPrefsWidget(MEMBER_ID, opts);
    expect($w('#notifPromoToggle').checked).toBe(true);
  });

  it('sets digest toggle checked from prefs', async () => {
    const opts = makeOpts($w, makePrefs({ weeklyDigest: false }));
    await initNotificationPrefsWidget(MEMBER_ID, opts);
    expect($w('#notifDigestToggle').checked).toBe(false);
  });

  it('hides #notifError on successful load', async () => {
    const opts = makeOpts($w, makePrefs());
    await initNotificationPrefsWidget(MEMBER_ID, opts);
    expect($w('#notifError').hide).toHaveBeenCalled();
  });
});

// ── Save button ──────────────────────────────────────────────────────────────

describe('initNotificationPrefsWidget — save', () => {
  let $w;
  beforeEach(() => { vi.clearAllMocks(); $w = make$w(); });

  it('wires #notifSaveBtn onClick', async () => {
    const opts = makeOpts($w, makePrefs());
    await initNotificationPrefsWidget(MEMBER_ID, opts);
    expect($w('#notifSaveBtn').onClick).toHaveBeenCalled();
  });

  it('calls updateNotificationPrefs with memberId and current toggle states on save', async () => {
    const prefs = makePrefs({ streakReminders: true, questAlerts: false });
    const opts = makeOpts($w, prefs);
    await initNotificationPrefsWidget(MEMBER_ID, opts);

    // Simulate user toggling quest alerts on
    $w('#notifQuestToggle').checked = true;

    const handler = $w('#notifSaveBtn').onClick.mock.calls[0][0];
    await handler();

    expect(opts.updateNotificationPrefs).toHaveBeenCalledWith(MEMBER_ID, {
      streakReminders: true,
      questAlerts: true,
      tierUpdates: false,
      promotionalEmails: false,
      weeklyDigest: true,
    });
  });

  it('shows success message after save', async () => {
    const opts = makeOpts($w, makePrefs());
    await initNotificationPrefsWidget(MEMBER_ID, opts);
    const handler = $w('#notifSaveBtn').onClick.mock.calls[0][0];
    await handler();
    expect($w('#notifSaveStatus').text).toBe('Preferences saved!');
    expect($w('#notifSaveStatus').show).toHaveBeenCalled();
  });

  it('shows error message when save fails', async () => {
    const opts = makeOpts($w, makePrefs());
    opts.updateNotificationPrefs.mockRejectedValue(new Error('Save failed'));
    await initNotificationPrefsWidget(MEMBER_ID, opts);
    const handler = $w('#notifSaveBtn').onClick.mock.calls[0][0];
    await handler();
    expect($w('#notifSaveStatus').text).toBe('Failed to save. Please try again.');
    expect($w('#notifSaveStatus').show).toHaveBeenCalled();
  });

  it('shows error message when save returns error shape', async () => {
    const opts = makeOpts($w, makePrefs());
    opts.updateNotificationPrefs.mockResolvedValue({ error: 'forbidden' });
    await initNotificationPrefsWidget(MEMBER_ID, opts);
    const handler = $w('#notifSaveBtn').onClick.mock.calls[0][0];
    await handler();
    expect($w('#notifSaveStatus').text).toBe('Failed to save. Please try again.');
  });
});

// ── Each toggle independently controllable ───────────────────────────────────

describe('initNotificationPrefsWidget — toggle independence', () => {
  let $w;
  beforeEach(() => { vi.clearAllMocks(); $w = make$w(); });

  it('each toggle can be set independently without affecting others', async () => {
    const prefs = makePrefs({
      streakReminders: true,
      questAlerts: false,
      tierUpdates: true,
      promotionalEmails: false,
      weeklyDigest: true,
    });
    const opts = makeOpts($w, prefs);
    await initNotificationPrefsWidget(MEMBER_ID, opts);

    expect($w('#notifStreakToggle').checked).toBe(true);
    expect($w('#notifQuestToggle').checked).toBe(false);
    expect($w('#notifTierToggle').checked).toBe(true);
    expect($w('#notifPromoToggle').checked).toBe(false);
    expect($w('#notifDigestToggle').checked).toBe(true);
  });
});

// ── Error handling ───────────────────────────────────────────────────────────

describe('initNotificationPrefsWidget — error handling', () => {
  let $w, consoleSpy;
  beforeEach(() => {
    vi.clearAllMocks();
    $w = make$w();
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { consoleSpy.mockRestore(); });

  it('does not throw when getNotificationPrefs rejects', async () => {
    const opts = makeOpts($w, makePrefs());
    opts.getNotificationPrefs.mockRejectedValue(new Error('Service down'));
    await expect(initNotificationPrefsWidget(MEMBER_ID, opts)).resolves.not.toThrow();
  });

  it('shows #notifError on getNotificationPrefs rejection', async () => {
    const opts = makeOpts($w, makePrefs());
    opts.getNotificationPrefs.mockRejectedValue(new Error('Service down'));
    await initNotificationPrefsWidget(MEMBER_ID, opts);
    expect($w('#notifError').show).toHaveBeenCalled();
  });

  it('disables all toggles on error', async () => {
    const opts = makeOpts($w, makePrefs());
    opts.getNotificationPrefs.mockRejectedValue(new Error('Service down'));
    await initNotificationPrefsWidget(MEMBER_ID, opts);
    expect($w('#notifStreakToggle').disable).toHaveBeenCalled();
    expect($w('#notifQuestToggle').disable).toHaveBeenCalled();
    expect($w('#notifTierToggle').disable).toHaveBeenCalled();
    expect($w('#notifPromoToggle').disable).toHaveBeenCalled();
    expect($w('#notifDigestToggle').disable).toHaveBeenCalled();
  });

  it('disables save button on error', async () => {
    const opts = makeOpts($w, makePrefs());
    opts.getNotificationPrefs.mockRejectedValue(new Error('Service down'));
    await initNotificationPrefsWidget(MEMBER_ID, opts);
    expect($w('#notifSaveBtn').disable).toHaveBeenCalled();
  });

  it('logs error when getNotificationPrefs rejects', async () => {
    const opts = makeOpts($w, makePrefs());
    opts.getNotificationPrefs.mockRejectedValue(new Error('Service down'));
    await initNotificationPrefsWidget(MEMBER_ID, opts);
    expect(consoleSpy).toHaveBeenCalledWith(
      '[NotificationPrefsWidget] failed to load preferences',
      expect.any(Error),
    );
  });

  it('shows #notifError when getNotificationPrefs returns error shape', async () => {
    const opts = makeOpts($w, makePrefs());
    opts.getNotificationPrefs.mockResolvedValue({ error: 'auth_required' });
    await initNotificationPrefsWidget(MEMBER_ID, opts);
    expect($w('#notifError').show).toHaveBeenCalled();
    expect($w('#notifStreakToggle').disable).toHaveBeenCalled();
  });
});
