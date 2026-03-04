/**
 * @module affiliateHelpers
 * @description Frontend helpers for affiliate/influencer program UI.
 * Provides social sharing tools, link generation, clipboard copy,
 * and dashboard rendering utilities for the affiliate program.
 */
import { colors, spacing, shadows, transitions, fontFamilies } from 'public/designTokens.js';

const SITE_URL = 'https://www.carolinafutons.com';

/**
 * Build a full affiliate tracking URL.
 * @param {string} linkCode - The affiliate link code
 * @param {string} [productId] - Optional product ID for direct product links
 * @returns {string} Full affiliate URL
 */
export function buildAffiliateUrl(linkCode, productId) {
  if (!linkCode) return '';
  if (productId && productId !== '_store') {
    return `${SITE_URL}/product/${productId}?ref=${linkCode}`;
  }
  return `${SITE_URL}?ref=${linkCode}`;
}

/**
 * Copy text to clipboard with fallback for older browsers.
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} True if copy succeeded
 */
export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch (err) {
    console.error('Copy to clipboard failed:', err);
    return false;
  }
}

/**
 * Generate social sharing URLs for an affiliate link.
 * @param {string} affiliateUrl - Full affiliate URL
 * @param {string} [message] - Custom share message
 * @returns {Object} URLs for each social platform
 */
export function getSocialShareUrls(affiliateUrl, message) {
  const defaultMessage = 'Check out these beautiful handcrafted futons from Carolina Futons!';
  const text = message || defaultMessage;
  const encodedUrl = encodeURIComponent(affiliateUrl);
  const encodedText = encodeURIComponent(text);

  return {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`,
    pinterest: `https://pinterest.com/pin/create/button/?url=${encodedUrl}&description=${encodedText}`,
    email: `mailto:?subject=${encodeURIComponent('Carolina Futons - Handcrafted Comfort')}&body=${encodedText}%0A%0A${encodedUrl}`,
  };
}

/**
 * Format a currency amount for display.
 * @param {number} amount - Dollar amount
 * @returns {string} Formatted string like "$1,234.56"
 */
export function formatCurrency(amount) {
  if (typeof amount !== 'number' || isNaN(amount)) return '$0.00';
  return `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

/**
 * Format a percentage for display.
 * @param {number} rate - Percentage value
 * @returns {string} Formatted string like "8.5%"
 */
export function formatPercentage(rate) {
  if (typeof rate !== 'number' || isNaN(rate)) return '0%';
  return `${rate}%`;
}

/**
 * Get tier display info with colors and next-tier requirements.
 * @param {string} tier - Current tier ("starter", "pro", "elite")
 * @param {number} totalRevenue - Total revenue generated
 * @param {number} totalConversions - Total conversions
 * @returns {Object} Tier display info
 */
export function getTierInfo(tier, totalRevenue, totalConversions) {
  const tiers = {
    starter: {
      label: 'Starter',
      color: colors.mountainBlue,
      rate: 5,
      nextTier: 'Pro',
      nextRequirement: `$500 in sales or 20 conversions`,
      salesProgress: Math.min((totalRevenue / 500) * 100, 100),
      conversionProgress: Math.min((totalConversions / 20) * 100, 100),
    },
    pro: {
      label: 'Pro',
      color: colors.sunsetCoral,
      rate: 8,
      nextTier: 'Elite',
      nextRequirement: `$2,000 in sales or 50 conversions`,
      salesProgress: Math.min((totalRevenue / 2000) * 100, 100),
      conversionProgress: Math.min((totalConversions / 50) * 100, 100),
    },
    elite: {
      label: 'Elite',
      color: '#C9A848',
      rate: 12,
      nextTier: null,
      nextRequirement: null,
      salesProgress: 100,
      conversionProgress: 100,
    },
  };

  return tiers[tier] || tiers.starter;
}

/**
 * Initialize the affiliate dashboard section within a page.
 * Sets up event handlers for copy buttons, social sharing, and tab switching.
 * @param {Function} $w - Wix Velo selector function
 * @param {Object} dashboardData - Dashboard data from getAffiliateDashboard
 */
export function initAffiliateDashboard($w, dashboardData) {
  if (!dashboardData || !dashboardData.dashboard) return;

  const d = dashboardData.dashboard;

  try {
    // Summary cards
    setTextSafe($w, '#affiliateEarnings', formatCurrency(d.totalEarned));
    setTextSafe($w, '#affiliateBalance', formatCurrency(d.availableBalance));
    setTextSafe($w, '#affiliateClicks', String(d.totalClicks));
    setTextSafe($w, '#affiliateConversions', String(d.totalConversions));
    setTextSafe($w, '#affiliateRate', formatPercentage(d.conversionRate));
    setTextSafe($w, '#affiliateCommissionRate', formatPercentage(d.commissionRate));
    setTextSafe($w, '#affiliatePending', formatCurrency(d.pendingCommissions));

    // Tier badge
    const tierInfo = getTierInfo(d.tier, d.totalRevenue, d.totalConversions);
    setTextSafe($w, '#affiliateTierLabel', tierInfo.label);
    setStyleSafe($w, '#affiliateTierBadge', 'backgroundColor', tierInfo.color);

    // Tier progress (if not elite)
    if (tierInfo.nextTier) {
      setTextSafe($w, '#affiliateNextTier', `Next: ${tierInfo.nextTier} — ${tierInfo.nextRequirement}`);
    } else {
      collapseSafe($w, '#affiliateTierProgress');
    }
  } catch (err) {
    console.error('[affiliateHelpers] Dashboard init error:', err);
  }
}

/**
 * Initialize affiliate link repeater items.
 * @param {Function} $w - Wix Velo selector function
 * @param {Object} $item - Repeater item scope
 * @param {Object} linkData - Link data from getMyAffiliateLinks
 */
export function initAffiliateLinkItem($w, $item, linkData) {
  try {
    const url = buildAffiliateUrl(linkData.linkCode, linkData.productId);

    setTextSafe($item, '#linkUrl', url);
    setTextSafe($item, '#linkClicks', String(linkData.clicks));
    setTextSafe($item, '#linkConversions', String(linkData.conversions));
    setTextSafe($item, '#linkRevenue', formatCurrency(linkData.revenue));

    // Copy button
    const copyBtn = safeElement($item, '#copyLinkBtn');
    if (copyBtn) {
      copyBtn.onClick(async () => {
        const copied = await copyToClipboard(url);
        if (copied) {
          setTextSafe($item, '#copyLinkBtn', 'Copied!');
          setTimeout(() => setTextSafe($item, '#copyLinkBtn', 'Copy Link'), 2000);
        }
      });
    }

    // Social share buttons
    const shareUrls = getSocialShareUrls(url);
    const fbBtn = safeElement($item, '#shareFacebook');
    if (fbBtn) fbBtn.onClick(() => openInNewTab(shareUrls.facebook));
    const twBtn = safeElement($item, '#shareTwitter');
    if (twBtn) twBtn.onClick(() => openInNewTab(shareUrls.twitter));
    const pinBtn = safeElement($item, '#sharePinterest');
    if (pinBtn) pinBtn.onClick(() => openInNewTab(shareUrls.pinterest));
    const emailBtn = safeElement($item, '#shareEmail');
    if (emailBtn) emailBtn.onClick(() => openInNewTab(shareUrls.email));
  } catch (err) {
    console.error('[affiliateHelpers] Link item init error:', err);
  }
}

// ── Internal Helpers ────────────────────────────────────────────────

function safeElement($w, selector) {
  try {
    const el = $w(selector);
    return el && el.id ? el : null;
  } catch {
    return null;
  }
}

function setTextSafe($w, selector, text) {
  const el = safeElement($w, selector);
  if (el) el.text = text;
}

function setStyleSafe($w, selector, prop, value) {
  const el = safeElement($w, selector);
  if (el && el.style) el.style[prop] = value;
}

function collapseSafe($w, selector) {
  const el = safeElement($w, selector);
  if (el && el.collapse) el.collapse();
}

function openInNewTab(url) {
  try {
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  } catch (err) {
    console.error('openInNewTab error:', err);
  }
}
