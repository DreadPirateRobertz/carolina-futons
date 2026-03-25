/**
 * @module NotificationPrefsWidget
 * @description Member notification settings panel with toggle controls
 * for each notification category and a save button.
 *
 * Elements:
 *   #notifTitle        — "Notification Preferences" heading
 *   #notifStreakToggle  — Toggle: streak reminders
 *   #notifQuestToggle   — Toggle: quest alerts
 *   #notifTierToggle    — Toggle: tier updates
 *   #notifPromoToggle   — Toggle: promotional emails
 *   #notifDigestToggle  — Toggle: weekly digest
 *   #notifSaveBtn       — Save button
 *   #notifSaveStatus    — Success/error message after save
 *   #notifError         — Shown on load error
 *
 * CF-rpsx
 */

import {
  getNotificationPrefs as _defaultGetPrefs,
  updateNotificationPrefs as _defaultUpdatePrefs,
} from 'backend/gamificationEventReceiver.web';

const TOGGLE_MAP = [
  { id: '#notifStreakToggle', key: 'streakReminders' },
  { id: '#notifQuestToggle', key: 'questAlerts' },
  { id: '#notifTierToggle', key: 'tierUpdates' },
  { id: '#notifPromoToggle', key: 'promotionalEmails' },
  { id: '#notifDigestToggle', key: 'weeklyDigest' },
];

function showErrorState($w) {
  try { $w('#notifError').show(); } catch {}
  for (const { id } of TOGGLE_MAP) {
    try { $w(id).disable(); } catch {}
  }
  try { $w('#notifSaveBtn').disable(); } catch {}
}

/**
 * Initialise the notification preferences widget.
 *
 * @param {string}   memberId
 * @param {Object}   [opts]
 * @param {Function} [opts.$w]
 * @param {Function} [opts.getNotificationPrefs]
 * @param {Function} [opts.updateNotificationPrefs]
 * @returns {Promise<void>}
 */
export async function initNotificationPrefsWidget(memberId, opts = {}) {
  const $w = opts.$w ?? globalThis.$w;
  const getNotificationPrefs = opts.getNotificationPrefs ?? _defaultGetPrefs;
  const updateNotificationPrefs = opts.updateNotificationPrefs ?? _defaultUpdatePrefs;

  let prefs;
  try {
    prefs = await getNotificationPrefs(memberId);
  } catch (err) {
    console.error('[NotificationPrefsWidget] failed to load preferences', err);
    showErrorState($w);
    return;
  }

  if (prefs && prefs.error) {
    console.error('[NotificationPrefsWidget] backend returned error:', prefs.error);
    showErrorState($w);
    return;
  }

  try { $w('#notifError').hide(); } catch {}
  try { $w('#notifTitle').text = 'Notification Preferences'; } catch {}

  // Populate toggles from prefs
  for (const { id, key } of TOGGLE_MAP) {
    try { $w(id).checked = !!prefs[key]; } catch {}
  }

  // Save button
  try {
    $w('#notifSaveBtn').onClick(async () => {
      const updated = {};
      for (const { id, key } of TOGGLE_MAP) {
        try { updated[key] = !!$w(id).checked; } catch {}
      }

      try {
        const result = await updateNotificationPrefs(memberId, updated);
        if (result && result.error) {
          try { $w('#notifSaveStatus').text = 'Failed to save. Please try again.'; } catch {}
        } else {
          try { $w('#notifSaveStatus').text = 'Preferences saved!'; } catch {}
        }
      } catch {
        try { $w('#notifSaveStatus').text = 'Failed to save. Please try again.'; } catch {}
      }
      try { $w('#notifSaveStatus').show(); } catch {}
    });
  } catch {}
}
