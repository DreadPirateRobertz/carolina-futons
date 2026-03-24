/**
 * @module ReferralWidget
 * @description Member dashboard widget showing referral link, count,
 * and bonus points status.
 *
 * Elements:
 *   #referralLink        — Referral URL text (hidden on error)
 *   #referralCount       — "N friends referred" (hidden on error)
 *   #referralBonusStatus — Earned pts summary or CTA (hidden on error)
 *   #copyLinkBtn         — Copies referral URL to clipboard (hidden on error)
 *   #referralErrorMsg    — Shown on fetch error
 *
 * CF-ibn7
 */

import { getReferralStatus as _defaultGetReferralStatus } from 'backend/referralService.web';
import { copyToClipboard as _defaultCopyToClipboard } from 'wix-window-frontend';

const POINTS_PER_REFERRAL = 500;

/**
 * Initialise the referral widget.
 *
 * @param {string}   memberId
 * @param {Object}   [opts]
 * @param {Function} [opts.$w]
 * @param {Function} [opts.getReferralStatus]
 * @param {Function} [opts.copyToClipboard]
 */
export async function initReferralWidget(memberId, opts = {}) {
  const $w               = opts.$w ?? globalThis.$w;
  const getReferralStatus = opts.getReferralStatus ?? ((id) => _defaultGetReferralStatus(id));
  const copyToClipboard  = opts.copyToClipboard ?? _defaultCopyToClipboard;

  let status;
  try {
    status = await getReferralStatus(memberId);
  } catch (e) {
    try { $w('#referralErrorMsg').show(); } catch (_) {}
    try { $w('#referralLink').hide(); } catch (_) {}
    try { $w('#referralCount').hide(); } catch (_) {}
    try { $w('#referralBonusStatus').hide(); } catch (_) {}
    try { $w('#copyLinkBtn').hide(); } catch (_) {}
    return;
  }

  const { referralUrl, completedReferrals } = status;

  try { $w('#referralLink').text = referralUrl; } catch (_) {}
  try { $w('#referralCount').text = `${completedReferrals} friends referred`; } catch (_) {}

  const bonusText = completedReferrals > 0
    ? `${completedReferrals} x ${POINTS_PER_REFERRAL} pts earned`
    : `Refer a friend to earn ${POINTS_PER_REFERRAL} pts!`;
  try { $w('#referralBonusStatus').text = bonusText; } catch (_) {}

  try {
    $w('#copyLinkBtn').onClick(async () => {
      try { await copyToClipboard(referralUrl); } catch (_) {}
    });
  } catch (_) {}
}
