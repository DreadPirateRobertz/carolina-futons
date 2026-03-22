// NotificationPreferences.js — Notification Preferences page module
// Logged-in members can manage which notifications they receive.
// Shows/hides toggles based on membership tier and phone-on-file status.
// Provides a confirmation dialog before unsubscribing from everything.
//
// Element nicknames:
//   notifPageSection          — Box: page container (hidden if not logged in)
//   notifLoginPrompt          — Box: shown when logged out
//   notifRestockToggle        — Switch: restock alerts
//   notifOrderToggle          — Switch: order status updates
//   notifPromoToggle          — Switch: promotional emails
//   notifCFPlusToggle         — Switch: CF+ membership updates (hidden for non-members)
//   notifSmsToggle            — Switch: SMS notifications (shown only if phone on file)
//   notifSaveBtn              — Button: save preferences
//   notifSaveSuccess          — Text: hidden, shown on save success
//   notifSaveError            — Text: hidden, shown on error
//   notifSaveSpinner          — Box: loading indicator during save
//   notifUnsubscribeAll       — Button: one-click unsubscribe trigger
//   notifUnsubscribeConfirm   — Box: confirmation dialog (ARIA modal)
//   notifUnsubscribeConfirmBtn — Button: confirm unsubscribe inside dialog
//   notifUnsubscribeCancelBtn  — Button: cancel inside dialog

import { announce, setupAccessibleDialog } from 'public/a11yHelpers.js';
import {
  getNotificationPreferences,
  saveNotificationPreferences,
  unsubscribeAll as unsubscribeAllBackend,
} from 'backend/notificationPreferences.web.js';
import { logError } from 'backend/errorMonitoring.web';

// ── initNotificationPreferences ───────────────────────────────────────

/**
 * Initialize the Notification Preferences page module.
 *
 * @param {Function} $w       - Wix selector function
 * @param {string|null} memberId - Current member's ID (null if logged out)
 * @param {Object} [options]
 * @param {boolean} [options.isCFPlusMember=false] - Show CF+ toggle
 * @param {boolean} [options.hasPhone=false]       - Show SMS toggle
 * @returns {Promise<null>}
 */
export async function initNotificationPreferences($w, memberId, options = {}) {
  const { isCFPlusMember = false, hasPhone = false } = options;

  // ── Logged-out guard ───────────────────────────────────────────────
  if (!memberId) {
    try { $w('#notifPageSection').hide(); } catch (e) {
      console.error('[NotifPrefs] hide notifPageSection failed:', e?.message);
    }
    try { $w('#notifLoginPrompt').show(); } catch (e) {
      console.error('[NotifPrefs] show notifLoginPrompt failed:', e?.message);
    }
    return null;
  }

  // ── Logged-in initial state ────────────────────────────────────────
  try { $w('#notifPageSection').show(); } catch (e) {
    console.error('[NotifPrefs] show notifPageSection failed:', e?.message);
  }
  try { $w('#notifLoginPrompt').hide(); } catch (e) {
    console.error('[NotifPrefs] hide notifLoginPrompt failed:', e?.message);
  }
  try { $w('#notifSaveSuccess').hide(); } catch (e) {
    console.error('[NotifPrefs] hide notifSaveSuccess failed:', e?.message);
  }
  try { $w('#notifSaveError').hide(); } catch (e) {
    console.error('[NotifPrefs] hide notifSaveError failed:', e?.message);
  }
  try { $w('#notifSaveSpinner').hide(); } catch (e) {
    console.error('[NotifPrefs] hide notifSaveSpinner failed:', e?.message);
  }
  try { $w('#notifUnsubscribeConfirm').hide(); } catch (e) {
    console.error('[NotifPrefs] hide notifUnsubscribeConfirm failed:', e?.message);
  }

  // ── Conditional toggle visibility ─────────────────────────────────
  try {
    if (isCFPlusMember) {
      $w('#notifCFPlusToggle').show();
    } else {
      $w('#notifCFPlusToggle').hide();
    }
  } catch (e) {
    console.error('[NotifPrefs] notifCFPlusToggle visibility failed:', e?.message);
  }
  try {
    if (hasPhone) {
      $w('#notifSmsToggle').show();
    } else {
      $w('#notifSmsToggle').hide();
    }
  } catch (e) {
    console.error('[NotifPrefs] notifSmsToggle visibility failed:', e?.message);
  }

  // ── Aria labels on toggles ─────────────────────────────────────────
  const ariaLabels = {
    '#notifRestockToggle': 'Restock alerts — notify me when out-of-stock items return',
    '#notifOrderToggle':   'Order status updates — shipping and delivery notifications',
    '#notifPromoToggle':   'Promotional emails — sales, new arrivals, and special offers',
    '#notifCFPlusToggle':  'CF+ membership updates — exclusive member news and benefits',
    '#notifSmsToggle':     'SMS notifications — text alerts for orders and restocks',
  };
  for (const [selector, label] of Object.entries(ariaLabels)) {
    try { $w(selector).accessibility.ariaLabel = label; } catch (e) {
      console.error(`[NotifPrefs] ariaLabel ${selector} failed:`, e?.message);
    }
  }

  // ── Accessible confirm dialog ──────────────────────────────────────
  const dialog = setupAccessibleDialog($w, {
    panelId:  '#notifUnsubscribeConfirm',
    closeId:  '#notifUnsubscribeCancelBtn',
    titleId:  '#notifUnsubscribeConfirm',
    focusableIds: ['#notifUnsubscribeConfirmBtn', '#notifUnsubscribeCancelBtn'],
    onClose: () => {
      announce($w, 'Unsubscribe cancelled');
    },
  });

  // ── Wire cancel button ─────────────────────────────────────────────
  try {
    $w('#notifUnsubscribeCancelBtn').onClick(() => {
      dialog.close();
    });
  } catch (e) {
    console.error('[NotifPrefs] notifUnsubscribeCancelBtn wire failed:', e?.message);
  }

  // ── Wire unsubscribe all trigger ───────────────────────────────────
  try {
    $w('#notifUnsubscribeAll').onClick(() => {
      dialog.open();
    });
  } catch (e) {
    console.error('[NotifPrefs] notifUnsubscribeAll wire failed:', e?.message);
  }

  // ── Wire confirm unsubscribe button ───────────────────────────────
  try {
    $w('#notifUnsubscribeConfirmBtn').onClick(async () => {
      try {
        const result = await unsubscribeAllBackend(memberId);
        if (result?.success) {
          dialog.close();
          announce($w, 'You have been unsubscribed from all notifications');
          await _loadAndPopulate($w, memberId);
        } else {
          _showSaveError($w, result?.error || 'Failed to unsubscribe. Please try again.');
          logError({ context: 'NotifPrefs.unsubscribeAll', message: result?.error || 'unsubscribeAll failed' });
        }
      } catch (e) {
        console.error('[NotifPrefs] unsubscribeAll failed:', e);
        _showSaveError($w, 'Failed to unsubscribe. Please try again.');
        logError({ context: 'NotifPrefs.unsubscribeAll', message: e?.message });
      }
    });
  } catch (e) {
    console.error('[NotifPrefs] notifUnsubscribeConfirmBtn wire failed:', e?.message);
  }

  // ── Wire save button ───────────────────────────────────────────────
  try {
    $w('#notifSaveBtn').onClick(async () => {
      try { $w('#notifSaveSpinner').show(); } catch (e) {
        console.error('[NotifPrefs] show notifSaveSpinner failed:', e?.message);
      }
      try { $w('#notifSaveSuccess').hide(); } catch (e) {
        console.error('[NotifPrefs] hide notifSaveSuccess failed:', e?.message);
      }
      try { $w('#notifSaveError').hide(); } catch (e) {
        console.error('[NotifPrefs] hide notifSaveError failed:', e?.message);
      }

      try {
        const prefs = _gatherPrefs($w);
        const result = await saveNotificationPreferences(memberId, prefs);

        if (result?.success) {
          try { $w('#notifSaveSuccess').show(); } catch (e) {
            console.error('[NotifPrefs] show notifSaveSuccess failed:', e?.message);
          }
          try { $w('#notifSaveError').hide(); } catch (e) {
            console.error('[NotifPrefs] hide notifSaveError failed:', e?.message);
          }
          announce($w, 'Preferences saved successfully');
        } else {
          _showSaveError($w, result?.error || 'Failed to save. Please try again.');
          logError({ context: 'NotifPrefs.savePreferences', message: result?.error || 'save failed' });
        }
      } catch (e) {
        console.error('[NotifPrefs] saveNotificationPreferences failed:', e);
        _showSaveError($w, 'Failed to save. Please try again.');
        logError({ context: 'NotifPrefs.savePreferences', message: e?.message });
      } finally {
        try { $w('#notifSaveSpinner').hide(); } catch (e) {
          console.error('[NotifPrefs] hide notifSaveSpinner failed:', e?.message);
        }
      }
    });
  } catch (e) {
    console.error('[NotifPrefs] notifSaveBtn wire failed:', e?.message);
  }

  // ── Load and populate current preferences ─────────────────────────
  await _loadAndPopulate($w, memberId);

  return null;
}

// ── _loadAndPopulate ──────────────────────────────────────────────────

/**
 * Fetch current prefs from backend and populate toggle states.
 * Calls logError on failure; does not throw.
 *
 * @param {Function} $w
 * @param {string} memberId
 */
async function _loadAndPopulate($w, memberId) {
  try {
    const response = await getNotificationPreferences(memberId);
    if (!response?.success) {
      console.error('[NotifPrefs] getNotificationPreferences returned failure:', response?.error);
      logError({ context: 'NotifPrefs.loadPrefs', message: response?.error || 'load failed' });
      return;
    }
    _populateToggles($w, response.prefs);
  } catch (e) {
    console.error('[NotifPrefs] getNotificationPreferences threw:', e);
    logError({ context: 'NotifPrefs.loadPrefs', message: e?.message });
  }
}

// ── _populateToggles ──────────────────────────────────────────────────

/**
 * Apply prefs object to toggle checked states.
 *
 * @param {Function} $w
 * @param {Object} prefs
 */
function _populateToggles($w, prefs) {
  const map = {
    '#notifRestockToggle': 'restock',
    '#notifOrderToggle':   'orderUpdate',
    '#notifPromoToggle':   'promo',
    '#notifCFPlusToggle':  'cfPlus',
    '#notifSmsToggle':     'sms',
  };
  for (const [selector, key] of Object.entries(map)) {
    try { $w(selector).checked = Boolean(prefs?.[key]); } catch (e) {
      console.error(`[NotifPrefs] ${selector} checked set failed:`, e?.message);
    }
  }
}

// ── _gatherPrefs ──────────────────────────────────────────────────────

/**
 * Read current toggle states and return prefs object.
 *
 * @param {Function} $w
 * @returns {{ restock, orderUpdate, promo, cfPlus, sms }}
 */
function _gatherPrefs($w) {
  const get = (selector) => {
    try { return Boolean($w(selector).checked); } catch (e) {
      console.error(`[NotifPrefs] read ${selector}.checked failed:`, e?.message);
      return false;
    }
  };
  return {
    restock:     get('#notifRestockToggle'),
    orderUpdate: get('#notifOrderToggle'),
    promo:       get('#notifPromoToggle'),
    cfPlus:      get('#notifCFPlusToggle'),
    sms:         get('#notifSmsToggle'),
  };
}

// ── _showSaveError ────────────────────────────────────────────────────

/**
 * Show error message and announce it.
 *
 * @param {Function} $w
 * @param {string} message
 */
function _showSaveError($w, message) {
  try { $w('#notifSaveSuccess').hide(); } catch (e) {
    console.error('[NotifPrefs] hide notifSaveSuccess failed:', e?.message);
  }
  try { $w('#notifSaveError').text = message; } catch (e) {
    console.error('[NotifPrefs] notifSaveError text failed:', e?.message);
  }
  try { $w('#notifSaveError').show(); } catch (e) {
    console.error('[NotifPrefs] show notifSaveError failed:', e?.message);
  }
  announce($w, message);
}
