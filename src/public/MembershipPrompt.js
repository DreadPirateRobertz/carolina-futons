// MembershipPrompt.js — CF+ Membership Upgrade Prompt Modal
// Shows a contextual modal when an anonymous or non-CF+ user attempts to access
// a gated feature (wishlist alerts, swatch request, price match).
// Displays tier benefits, pricing CTA, and an upgrade link to the pricing plans page.
// One-time per browser session — suppressed after first show via wix-storage-frontend.
//
// Element nicknames:
//   membershipPromptModal   — modal/overlay container
//   membershipPromptClose   — modal close button
//   membershipPromptTitle   — context-specific headline
//   membershipPromptBenefits — CF+ benefits list text
//   membershipUpgradeBtn    — upgrade CTA button (links to pricing plans page)

import { setupAccessibleDialog, announce } from 'public/a11yHelpers.js';
import { getBenefitsList } from 'public/membershipHelpers.js';
import { session } from 'wix-storage-frontend';

const SESSION_KEY = 'cf_membership_prompt_shown';
const PRICING_PLANS_URL = '/pricing-plans';

// Context-specific headlines shown in membershipPromptTitle.
const CONTEXT_TITLES = {
  'wishlist-alerts':  'Get back-in-stock alerts — exclusive to CF+ members',
  'swatch-request':   'Request fabric swatches with a CF+ membership',
  'price-match':      'Price match guarantee — exclusive to CF+ members',
};

const FALLBACK_TITLE = 'Unlock exclusive CF+ member benefits';

// ── initMembershipPrompt ──────────────────────────────────────────────

/**
 * Initialize the membership upgrade prompt modal.
 * Call once on page ready on any page that gates CF+ features.
 * Returns the dialog handle for use with showMembershipPrompt().
 *
 * @param {Function} $w - Wix selector function
 * @returns {Object|null} dialog handle ({ open, close })
 */
export function initMembershipPrompt($w) {
  try {
    try { $w('#membershipPromptModal').collapse(); } catch (e) {
      console.warn('[MembershipPrompt] collapse failed:', e?.message);
    }

    try { $w('#membershipPromptModal').accessibility.role = 'dialog'; } catch (e) {
      console.warn('[MembershipPrompt] ARIA role failed:', e?.message);
    }
    try { $w('#membershipPromptModal').accessibility.ariaModal = true; } catch (e) {
      console.warn('[MembershipPrompt] ariaModal failed:', e?.message);
    }

    // Upgrade button links to pricing plans — set once at init.
    try { $w('#membershipUpgradeBtn').link = PRICING_PLANS_URL; } catch (e) {
      console.warn('[MembershipPrompt] upgrade link failed:', e?.message);
    }

    // Benefits list — static, rendered once at init.
    try {
      const benefits = getBenefitsList();
      $w('#membershipPromptBenefits').text = '• ' + benefits.join('\n• ');
    } catch (e) {
      console.warn('[MembershipPrompt] benefits render failed:', e?.message);
    }

    const dialog = setupAccessibleDialog($w, {
      panelId: '#membershipPromptModal',
      closeId: '#membershipPromptClose',
      focusableIds: [
        '#membershipPromptClose',
        '#membershipUpgradeBtn',
      ],
      onClose: () => {
        announce($w, 'Membership prompt closed');
      },
    });

    return dialog;
  } catch (e) {
    console.error('[MembershipPrompt] initMembershipPrompt failed:', e);
    return null;
  }
}

// ── showMembershipPrompt ──────────────────────────────────────────────

/**
 * Show the membership upgrade prompt for a specific gated feature context.
 * No-ops if the prompt has already been shown this session.
 *
 * @param {Function} $w - Wix selector function
 * @param {'wishlist-alerts'|'swatch-request'|'price-match'|string} context - Feature context
 * @param {Object|null} dialog - Dialog handle returned by initMembershipPrompt()
 */
export function showMembershipPrompt($w, context, dialog) {
  try {
    // One-time per session guard — uses SESSION_KEY in wix-storage-frontend session scope.
    if (session.getItem(SESSION_KEY)) return;
    session.setItem(SESSION_KEY, '1');

    // Context-specific title.
    const title = CONTEXT_TITLES[context] || FALLBACK_TITLE;
    try { $w('#membershipPromptTitle').text = title; } catch (e) {
      console.warn('[MembershipPrompt] title render failed:', e?.message);
    }

    announce($w, 'CF+ membership benefits available');
    if (dialog) dialog.open();
  } catch (e) {
    console.error('[MembershipPrompt] showMembershipPrompt failed:', e);
  }
}
