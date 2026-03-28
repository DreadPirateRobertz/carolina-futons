// Loyalty.js - Carolina Futons Rewards Program Explainer Page
// Tier comparison table, points calculator, FAQ, enrollment CTA
// Backend data: loyaltyMarketing.web.js (getTierExplainerData, calculatePointsFromSpend, getLoyaltyFaq, getEnrollmentPrompt)
import { trackEvent } from 'public/engagementTracker';
import { initBackToTop } from 'public/mobileHelpers';
import { announce } from 'public/a11yHelpers';
import { fireCustomEvent } from 'public/ga4Tracking';
import {
  getTierExplainerData,
  calculatePointsFromSpend,
  getLoyaltyFaq,
  getEnrollmentPrompt,
} from 'backend/loyaltyMarketing.web';
import { getMyLoyaltyAccount } from 'backend/loyaltyService.web';

let tierData = null;

$w.onReady(async function () {
  initBackToTop($w);
  trackEvent('page_view', { page: 'loyalty' });

  await Promise.all([
    initHero(),
    initTierTable(),
    initPointsCalculator(),
    initFaq(),
    initEnrollmentCta(),
    initMemberStatus(),
  ]);
});

// ── Hero Section ────────────────────────────────────────────────────

async function initHero() {
  try {
    $w('#loyaltyHeroTitle').text = 'Earn Rewards on Every Purchase';
    $w('#loyaltyHeroSubtitle').text = 'Carolina Futons Rewards — earn points, unlock perks, save on furniture you love.';
  } catch (e) {}
}

// ── Tier Comparison Table ───────────────────────────────────────────

async function initTierTable() {
  try {
    const result = await getTierExplainerData();
    if (!result.success) return;

    tierData = result.tiers;

    $w('#tierRepeater').onItemReady(($item, itemData) => {
      try { $item('#tierName').text = itemData.name; } catch (e) {}
      try { $item('#tierMinSpend').text = itemData.minSpend === 0 ? 'Free' : `$${itemData.minSpend}+ spent`; } catch (e) {}
      try { $item('#tierDiscount').text = itemData.discount; } catch (e) {}
      try { $item('#tierFreeShipping').text = itemData.freeShipping; } catch (e) {}
      try { $item('#tierMultiplier').text = itemData.pointsMultiplier; } catch (e) {}
      try { $item('#tierBirthday').text = itemData.birthdayBonus; } catch (e) {}
      try {
        $item('#tierEarlyAccess').text = itemData.earlyAccess ? '✓ Early Access' : '—';
      } catch (e) {}
    });

    $w('#tierRepeater').data = tierData.map((t, i) => ({ _id: `tier-${i}`, ...t }));
  } catch (e) {
    console.error('[Loyalty] initTierTable error:', e);
  }
}

// ── Points Calculator ───────────────────────────────────────────────

async function initPointsCalculator() {
  try {
    $w('#calcInput').placeholder = 'Enter spend amount ($)';
    $w('#calcButton').onClick(() => runCalculator());
    $w('#calcInput').onKeyPress((event) => {
      if (event.key === 'Enter') runCalculator();
    });
  } catch (e) {}
}

function runCalculator() {
  try {
    const input = $w('#calcInput').value;
    const spend = parseFloat(input);

    if (isNaN(spend) || spend <= 0) {
      $w('#calcResult').text = 'Enter a valid dollar amount.';
      return;
    }

    const result = calculatePointsFromSpend(spend);
    if (!result.success) return;

    const r = result.result;
    $w('#calcResult').text =
      `$${spend} → ${r.totalPoints} points (${r.multiplier} at ${r.tier} tier)`;

    if (r.nextTier && r.spendToNextTier > 0) {
      $w('#calcNextTier').text = `$${r.spendToNextTier} more to reach ${r.nextTier}`;
      $w('#calcNextTier').show();
    } else if (!r.nextTier) {
      $w('#calcNextTier').text = 'You\'re at the top tier!';
      $w('#calcNextTier').show();
    }

    trackEvent('loyalty_calculator', { spend, tier: r.tier, points: r.totalPoints });
    fireCustomEvent('loyalty_enrolled', { source: 'calculator' });
  } catch (e) {
    console.error('[Loyalty] runCalculator error:', e);
  }
}

// ── FAQ Section ─────────────────────────────────────────────────────

async function initFaq() {
  try {
    const result = getLoyaltyFaq();
    if (!result.success) return;

    $w('#faqRepeater').onItemReady(($item, itemData) => {
      try { $item('#faqQuestion').text = itemData.question; } catch (e) {}
      try { $item('#faqAnswer').text = itemData.answer; } catch (e) {}

      try {
        $item('#faqQuestion').onClick(() => {
          const answer = $item('#faqAnswer');
          if (answer.collapsed) {
            answer.expand();
            trackEvent('loyalty_faq_expand', { question: itemData.question });
          } else {
            answer.collapse();
          }
        });
      } catch (e) {}
    });

    $w('#faqRepeater').data = result.faqs.map((faq, i) => ({ _id: `faq-${i}`, ...faq }));
  } catch (e) {
    console.error('[Loyalty] initFaq error:', e);
  }
}

// ── Enrollment CTA ──────────────────────────────────────────────────

async function initEnrollmentCta() {
  try {
    $w('#joinButton').onClick(() => {
      trackEvent('loyalty_join_click', { source: 'loyalty_page' });
      fireCustomEvent('loyalty_enrolled', { source: 'loyalty_page' });
      // Navigate to member signup
      import('wix-location-frontend').then(loc => loc.to('/member-page'));
    });
  } catch (e) {}
}

// ── Member Status (logged-in members see their tier + points) ──────

async function initMemberStatus() {
  try {
    const account = await getMyLoyaltyAccount();
    if (!account || !account.currentTier) {
      // Not a member — show enrollment prompt
      try { $w('#memberStatusSection').collapse(); } catch (e) {}
      return;
    }

    try { $w('#enrollmentSection').collapse(); } catch (e) {}
    try { $w('#memberStatusSection').expand(); } catch (e) {}
    try { $w('#memberTier').text = `Your Tier: ${account.currentTier}`; } catch (e) {}
    try { $w('#memberPoints').text = `${account.totalPoints || 0} points`; } catch (e) {}

    // Show progress to next tier
    if (tierData) {
      const current = tierData.find(t => t.name === account.currentTier);
      if (current && current.nextTier) {
        const progress = current.nextTierMinSpend
          ? Math.min(100, Math.round(((account.totalSpend || 0) / current.nextTierMinSpend) * 100))
          : 100;
        try { $w('#tierProgress').value = progress; } catch (e) {}
        try { $w('#tierProgressLabel').text = `${progress}% to ${current.nextTier}`; } catch (e) {}
      }
    }

    announce(`Your loyalty tier is ${account.currentTier} with ${account.totalPoints || 0} points.`);
  } catch (e) {
    // Not logged in or error — show enrollment CTA
    try { $w('#memberStatusSection').collapse(); } catch (e2) {}
  }
}
