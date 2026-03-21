/**
 * @module giftCardMemberSection
 * @description "My Gift Cards" section for the Member Page.
 * Shows gift cards purchased by the member (for others) and received by them,
 * each in a separate repeater. Hides the section on empty state or auth error.
 *
 * Elements:
 *   #myGiftCardsSection — outer Box container
 *   #purchasedCardsRepeater — repeater for purchased cards
 *   #receivedCardsRepeater — repeater for received cards
 * Per-item (within repeaters):
 *   #gcCardCode — masked card code (e.g. "CF-****-****-****-NPQR")
 *   #gcBalance — remaining balance (e.g. "$50.00")
 *   #gcExpiry — expiration date (e.g. "March 21, 2027")
 *   #gcRecipient — recipient name/masked email (purchased cards only)
 *
 * Designed for full testability in vitest (injectable getters, formatters).
 */

import { formatBalance, formatExpirationDate } from 'public/giftCardHelpers.js';

export const SECTION_ELEMENT = '#myGiftCardsSection';
export const PURCHASED_REPEATER = '#purchasedCardsRepeater';
export const RECEIVED_REPEATER = '#receivedCardsRepeater';

// ── Item renderers ─────────────────────────────────────────────────────

/**
 * Populate a single repeater item for a purchased gift card.
 * @param {Function} $item - Wix per-item selector
 * @param {Object} card - Sanitized card from getMyPurchasedCards
 */
export function renderPurchasedCardItem($item, card) {
  try { $item('#gcCardCode').text = card.maskedCode || '****'; } catch (_) {}
  try { $item('#gcBalance').text = formatBalance(card.balance); } catch (_) {}
  try { $item('#gcExpiry').text = formatExpirationDate(card.expirationDate); } catch (_) {}
  try {
    $item('#gcRecipient').text = card.recipientName || card.recipientEmail || '—';
  } catch (_) {}
}

/**
 * Populate a single repeater item for a received gift card.
 * @param {Function} $item - Wix per-item selector
 * @param {Object} card - Sanitized card from getMyReceivedCards
 */
export function renderReceivedCardItem($item, card) {
  try { $item('#gcCardCode').text = card.maskedCode || '****'; } catch (_) {}
  try { $item('#gcBalance').text = formatBalance(card.balance); } catch (_) {}
  try { $item('#gcExpiry').text = formatExpirationDate(card.expirationDate); } catch (_) {}
  try { $item('#gcRecipient').hide(); } catch (_) {}
}

// ── Section init ───────────────────────────────────────────────────────

/**
 * Initialize the "My Gift Cards" section on the Member Page.
 * Fetches purchased and received cards, wires repeaters, shows/hides section.
 *
 * @param {Function} $wFn - Wix selector ($w)
 * @param {Object} [opts] - Injectable overrides for testability
 * @param {Function} [opts.getPurchased] - Replaces backend getMyPurchasedCards()
 * @param {Function} [opts.getReceived] - Replaces backend getMyReceivedCards()
 * @returns {Promise<{shown: boolean, purchasedCount: number, receivedCount: number}>}
 */
export async function initMyGiftCardsSection($wFn, opts = {}) {
  try {
    // Fetch both card sets in parallel
    const [purchasedResult, receivedResult] = await Promise.all([
      opts.getPurchased
        ? opts.getPurchased()
        : import('backend/giftCards.web').then(m => m.getMyPurchasedCards()),
      opts.getReceived
        ? opts.getReceived()
        : import('backend/giftCards.web').then(m => m.getMyReceivedCards()),
    ]);

    const purchased = (purchasedResult?.success && purchasedResult.cards) || [];
    const received = (receivedResult?.success && receivedResult.cards) || [];

    const total = purchased.length + received.length;

    if (total === 0) {
      try { $wFn(SECTION_ELEMENT).collapse(); } catch (_) {}
      return { shown: false, purchasedCount: 0, receivedCount: 0 };
    }

    // Wire purchased repeater
    if (purchased.length > 0) {
      try {
        const rep = $wFn(PURCHASED_REPEATER);
        rep.onItemReady(($item, itemData) => renderPurchasedCardItem($item, itemData));
        rep.data = purchased.map((card, i) => ({ ...card, _id: card._id || `pur-${i}` }));
        rep.show();
      } catch (_) {}
    } else {
      try { $wFn(PURCHASED_REPEATER).collapse(); } catch (_) {}
    }

    // Wire received repeater
    if (received.length > 0) {
      try {
        const rep = $wFn(RECEIVED_REPEATER);
        rep.onItemReady(($item, itemData) => renderReceivedCardItem($item, itemData));
        rep.data = received.map((card, i) => ({ ...card, _id: card._id || `rec-${i}` }));
        rep.show();
      } catch (_) {}
    } else {
      try { $wFn(RECEIVED_REPEATER).collapse(); } catch (_) {}
    }

    try { $wFn(SECTION_ELEMENT).expand(); } catch (_) {}
    return { shown: true, purchasedCount: purchased.length, receivedCount: received.length };
  } catch (err) {
    console.error('[giftCardMemberSection] init error:', err);
    try { $wFn(SECTION_ELEMENT).collapse(); } catch (_) {}
    return { shown: false, purchasedCount: 0, receivedCount: 0 };
  }
}
