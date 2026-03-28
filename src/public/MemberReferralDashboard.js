/**
 * @module MemberReferralDashboard
 * @description Referral activity widget for the Member Page. Shows referral
 * stats (friends invited, credits earned) and quick share CTA.
 *
 * Element IDs (on Member Page):
 *   #memberReferralSection   — Container section
 *   #memberReferralStats     — Stats summary box
 *   #memberRefFriends        — Number of friends invited
 *   #memberRefCredits        — Total credits earned
 *   #memberRefPending        — Pending referrals count
 *   #memberRefShareBtn       — Quick share CTA button
 *   #memberRefViewAll        — "View all referrals" link to /referral page
 *
 * CF-heou
 */

import { colors } from 'public/designTokens.js';

/**
 * Initialize the referral dashboard on the Member Page.
 *
 * @param {Function} $w - Wix selector function
 * @param {string} memberId - Current member ID
 */
export async function initMemberReferralDashboard($w, memberId) {
  if (!memberId) {
    try { $w('#memberReferralSection').collapse(); } catch (_) {}
    return;
  }

  try {
    const { getReferralStats, getReferralLink } = await import('backend/referralService.web');
    const [statsResult, linkResult] = await Promise.all([
      getReferralStats(),
      getReferralLink(),
    ]);

    if (!statsResult.success) {
      try { $w('#memberReferralSection').collapse(); } catch (_) {}
      return;
    }

    const stats = statsResult.stats;

    // Populate stats
    try { $w('#memberRefFriends').text = String(stats.totalReferred || 0); } catch (_) {}
    try { $w('#memberRefCredits').text = `$${stats.totalCredited || 0}`; } catch (_) {}
    try { $w('#memberRefPending').text = String(stats.pendingCount || 0); } catch (_) {}

    // Highlight credits if > 0
    try {
      if (stats.totalCredited > 0) {
        $w('#memberRefCredits').style.color = colors.success;
      }
    } catch (_) {}

    // Share button — copies referral link
    if (linkResult.success && linkResult.referralCode) {
      const referralUrl = `https://www.carolinafutons.com?ref=${linkResult.referralCode}`;
      try {
        $w('#memberRefShareBtn').onClick(async () => {
          try {
            const wixWindow = await import('wix-window-frontend');
            await wixWindow.copyToClipboard(referralUrl);
            $w('#memberRefShareBtn').label = 'Link Copied!';
            setTimeout(() => {
              try { $w('#memberRefShareBtn').label = 'Share Your Link'; } catch (_) {}
            }, 3000);
          } catch (_) {}
        });
        $w('#memberRefShareBtn').label = 'Share Your Link';
        try { $w('#memberRefShareBtn').style.backgroundColor = colors.mountainBlue; } catch (_) {}
      } catch (_) {}
    }

    // "View all" link
    try {
      $w('#memberRefViewAll').onClick(() => {
        import('wix-location-frontend').then(({ to }) => { to('/referral'); });
      });
    } catch (_) {}

    // ARIA
    try {
      $w('#memberReferralSection').accessibility.ariaLabel = 'Your referral activity';
    } catch (_) {}

    $w('#memberReferralSection').expand();
  } catch (err) {
    try { $w('#memberReferralSection').collapse(); } catch (_) {}
  }
}
