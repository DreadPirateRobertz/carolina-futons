// Referral Page.js - Invite Friends & Rewards Tracking
// Shareable referral links, how-it-works flow, referral history, and credit summary
import { trackEvent, trackReferralAction } from 'public/engagementTracker';
import { announce } from 'public/a11yHelpers';
import { colors } from 'public/designTokens.js';
import { collapseOnMobile, initBackToTop } from 'public/mobileHelpers';
import {
  formatReferralLink,
  formatCreditAmount,
  getHowItWorksSteps,
  getSocialShareLinks,
  calculateReferralProgress,
  buildReferralHistoryItems,
} from 'public/referralPageHelpers.js';
import { initPageSeo } from 'public/pageSeo.js';

let referralCode = '';
let currentMember = null;

$w.onReady(async function () {
  collapseOnMobile($w, ['#referralHistorySection', '#referralStatsSection']);
  initBackToTop($w);
  initPageSeo('referral');
  trackEvent('page_view', { page: 'referral' });
  await initReferralPage();
});

// ── Main Initialization ─────────────────────────────────────────────

async function initReferralPage() {
  try {
    currentMember = await loadCurrentMember();

    if (!currentMember) {
      showLoggedOutState();
      return;
    }

    const sections = [
      { name: 'howItWorks', init: initHowItWorks },
      { name: 'referralLink', init: initReferralLink },
      { name: 'shareButtons', init: initShareButtons },
      { name: 'stats', init: initReferralStats },
      { name: 'history', init: initReferralHistory },
    ];

    const results = await Promise.allSettled(sections.map(s => s.init()));

    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        console.error(`[ReferralPage] Section "${sections[i].name}" failed:`, result.reason);
      }
    });
  } catch (err) {
    console.error('[ReferralPage] Initialization error:', err);
    showErrorFallback('We had trouble loading the referral page. Please refresh and try again.');
  }
}

// ── Member Data ─────────────────────────────────────────────────────

async function loadCurrentMember() {
  try {
    const { currentMember: memberApi } = await import('wix-members-frontend');
    return await memberApi.getMember();
  } catch (err) {
    console.error('[ReferralPage] Error loading member:', err);
    return null;
  }
}

// ── Logged-Out State ────────────────────────────────────────────────

function showLoggedOutState() {
  try { $w('#referralLoggedOutBox').show(); } catch (e) {}
  try { $w('#referralMainContent').collapse(); } catch (e) {}

  try {
    $w('#referralLoginBtn').onClick(() => {
      import('wix-members-frontend').then(({ authentication }) => {
        authentication.promptLogin();
      });
    });
    try { $w('#referralLoginBtn').accessibility.ariaLabel = 'Log in to access your referral link'; } catch (e) {}
  } catch (e) {}
}

// ── How It Works ────────────────────────────────────────────────────

function initHowItWorks() {
  try {
    const stepsRepeater = $w('#howItWorksRepeater');
    if (!stepsRepeater) return;

    const steps = getHowItWorksSteps();

    stepsRepeater.onItemReady(($item, itemData) => {
      try { $item('#stepTitle').text = itemData.title; } catch (e) {}
      try { $item('#stepDescription').text = itemData.description; } catch (e) {}
      try { $item('#stepIcon').text = itemData.icon; } catch (e) {}
    });

    stepsRepeater.data = steps;
  } catch (e) {
    console.error('[ReferralPage] Error initializing how-it-works:', e);
  }
}

// ── Referral Link ───────────────────────────────────────────────────

async function initReferralLink() {
  try {
    const { getReferralLink } = await import('backend/referralService.web');
    const result = await getReferralLink();

    if (!result.success) {
      console.error('[ReferralPage] getReferralLink failed:', result.error);
      try { $w('#referralLinkError').text = result.error || 'Unable to generate your link.'; } catch (e) {}
      try { $w('#referralLinkError').show(); } catch (e) {}
      return;
    }

    referralCode = result.referralCode;
    const fullLink = formatReferralLink(referralCode);

    try { $w('#referralLinkText').text = fullLink; } catch (e) {}
    try { $w('#referralCodeText').text = referralCode; } catch (e) {}

    // Copy link button
    try {
      $w('#copyLinkBtn').onClick(async () => {
        try {
          const wixWindow = await import('wix-window-frontend');
          await wixWindow.copyToClipboard(fullLink);
          $w('#copyLinkBtn').label = 'Copied!';
          announce($w, 'Referral link copied to clipboard');
          trackReferralAction('copy_link');
          setTimeout(() => {
            try { $w('#copyLinkBtn').label = 'Copy Link'; } catch (e) {}
          }, 3000);
        } catch (err) {
          console.error('[ReferralPage] Copy link error:', err);
        }
      });
      try { $w('#copyLinkBtn').accessibility.ariaLabel = 'Copy your referral link to clipboard'; } catch (e) {}
    } catch (e) {}

    // Copy code button
    try {
      $w('#copyCodeBtn').onClick(async () => {
        try {
          const wixWindow = await import('wix-window-frontend');
          await wixWindow.copyToClipboard(referralCode);
          $w('#copyCodeBtn').label = 'Copied!';
          announce($w, 'Referral code copied to clipboard');
          trackReferralAction('copy_code');
          setTimeout(() => {
            try { $w('#copyCodeBtn').label = 'Copy Code'; } catch (e) {}
          }, 3000);
        } catch (err) {
          console.error('[ReferralPage] Copy code error:', err);
        }
      });
      try { $w('#copyCodeBtn').accessibility.ariaLabel = 'Copy your referral code to clipboard'; } catch (e) {}
    } catch (e) {}

  } catch (e) {
    console.error('[ReferralPage] Error initializing referral link:', e);
  }
}

// ── Social Share Buttons ────────────────────────────────────────────

function initShareButtons() {
  // Defer until referralCode is set (initReferralLink runs concurrently)
  // Re-bind after code is available
  const bindShares = () => {
    if (!referralCode) return;

    const links = getSocialShareLinks(referralCode);
    if (!links.email) return;

    // Email share
    try {
      $w('#shareEmailBtn').onClick(() => {
        import('wix-window-frontend').then((wixWindow) => {
          wixWindow.openUrl(links.email, '_self');
        });
        trackReferralAction('share_email');
      });
      try { $w('#shareEmailBtn').accessibility.ariaLabel = 'Share referral via email'; } catch (e) {}
    } catch (e) {}

    // SMS share
    try {
      $w('#shareSmsBtn').onClick(() => {
        import('wix-window-frontend').then((wixWindow) => {
          wixWindow.openUrl(links.sms, '_self');
        });
        trackReferralAction('share_sms');
      });
      try { $w('#shareSmsBtn').accessibility.ariaLabel = 'Share referral via text message'; } catch (e) {}
    } catch (e) {}

    // Facebook share
    try {
      $w('#shareFacebookBtn').onClick(() => {
        import('wix-window-frontend').then((wixWindow) => {
          wixWindow.openUrl(links.facebook, '_blank');
        });
        trackReferralAction('share_facebook');
      });
      try { $w('#shareFacebookBtn').accessibility.ariaLabel = 'Share referral on Facebook'; } catch (e) {}
    } catch (e) {}
  };

  // Try immediately, then retry after a short delay for link init
  bindShares();
  if (!referralCode) {
    setTimeout(bindShares, 2000);
  }
}

// ── Referral Stats / Progress ───────────────────────────────────────

async function initReferralStats() {
  try {
    const { getReferralStats } = await import('backend/referralService.web');
    const result = await getReferralStats();

    if (!result.success) {
      console.error('[ReferralPage] getReferralStats failed:', result.error);
      return;
    }

    const progress = calculateReferralProgress(result.stats);

    try { $w('#statTotalFriends').text = String(progress.totalFriends); } catch (e) {}
    try { $w('#statSuccessRate').text = `${progress.successRate}%`; } catch (e) {}
    try { $w('#statTotalEarned').text = formatCreditAmount(progress.totalEarned); } catch (e) {}
    try { $w('#statAvailableCredit').text = formatCreditAmount(progress.availableCredit); } catch (e) {}

    // Highlight available credit
    try {
      if (progress.availableCredit > 0) {
        $w('#statAvailableCredit').style.color = colors.success;
      }
    } catch (e) {}

    // Show empty state if no referrals yet
    if (progress.totalFriends === 0) {
      try { $w('#referralStatsEmpty').show(); } catch (e) {}
      try { $w('#referralStatsCards').collapse(); } catch (e) {}
    }
  } catch (e) {
    console.error('[ReferralPage] Error initializing referral stats:', e);
  }
}

// ── Referral History ────────────────────────────────────────────────

async function initReferralHistory() {
  try {
    const historyRepeater = $w('#referralHistoryRepeater');
    if (!historyRepeater) return;

    const { getMyReferrals } = await import('backend/referralService.web');
    const result = await getMyReferrals();

    if (!result.success) {
      console.error('[ReferralPage] getMyReferrals failed:', result.error);
      return;
    }

    const items = buildReferralHistoryItems(result.referrals);

    if (items.length === 0) {
      try { $w('#referralHistoryEmpty').show(); } catch (e) {}
      try { historyRepeater.collapse(); } catch (e) {}
      return;
    }

    historyRepeater.onItemReady(($item, itemData) => {
      try { $item('#historyFriendName').text = itemData.friendName; } catch (e) {}
      try {
        $item('#historyStatus').text = itemData.statusLabel;
        $item('#historyStatus').style.color = itemData.statusColor;
      } catch (e) {}
      try { $item('#historyCredit').text = itemData.creditText; } catch (e) {}
      try { $item('#historyDate').text = itemData.dateText; } catch (e) {}
    });

    historyRepeater.data = items;
  } catch (e) {
    console.error('[ReferralPage] Error initializing referral history:', e);
  }
}

// ── Error Fallback ──────────────────────────────────────────────────

function showErrorFallback(message) {
  try {
    const errorBox = $w('#referralErrorFallback');
    if (errorBox) {
      try { $w('#referralErrorText').text = message; } catch (e) {}
      errorBox.show();
    }
  } catch (e) {
    console.error('[ReferralPage] Could not show error fallback:', e);
  }
}
