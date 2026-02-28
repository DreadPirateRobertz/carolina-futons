/**
 * @module socialProofToast
 * @description Frontend helper for displaying social proof toast notifications.
 * Manages display queue, frequency caps, and session state.
 * Import in Product Page.js and Category Page.js.
 */
import { getProductSocialProof, getCategorySocialProof } from 'backend/socialProof.web';
import { isMobile } from 'public/mobileHelpers';
import { announce } from 'public/a11yHelpers';

const SESSION_KEY = 'cf_social_proof';

function getSessionState() {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) return JSON.parse(stored);
  } catch (e) {}
  return { count: 0, lastShown: 0 };
}

function setSessionState(state) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
  } catch (e) {}
}

/**
 * Initialize social proof toast for a product page.
 * Fetches notifications and queues display with frequency caps.
 *
 * @param {Function} $w - Wix selector function
 * @param {string} productId - Current product ID
 * @param {string} [productName] - Product name for display
 */
export async function initProductSocialProof($w, productId, productName) {
  if (!productId) return;

  try {
    const { notifications, config } = await getProductSocialProof(productId, productName);
    if (!notifications || notifications.length === 0) return;

    const state = getSessionState();
    if (state.count >= config.maxPerSession) return;

    // Delay first notification by 3 seconds for better UX
    const timeSinceLast = Date.now() - state.lastShown;
    const delay = Math.max(3000, config.minIntervalMs - timeSinceLast);

    setTimeout(() => {
      showToast($w, notifications[0], config);
    }, delay);
  } catch (e) {}
}

/**
 * Initialize social proof for a category page.
 * Shows aggregate signals (recent sales count, low stock items).
 *
 * @param {Function} $w - Wix selector function
 * @param {string} categorySlug - Current category slug
 */
export async function initCategorySocialProof($w, categorySlug) {
  if (!categorySlug) return;

  try {
    const { recentSalesCount, lowStockProducts, config } = await getCategorySocialProof(categorySlug);

    const state = getSessionState();
    if (state.count >= config.maxPerSession) return;

    const notification = buildCategoryNotification(recentSalesCount, lowStockProducts);
    if (!notification) return;

    setTimeout(() => {
      showToast($w, notification, config);
    }, 5000); // Longer delay on category pages
  } catch (e) {}
}

function buildCategoryNotification(salesCount, lowStockProducts) {
  if (lowStockProducts.length > 0) {
    const item = lowStockProducts[0];
    return {
      type: 'low_stock',
      message: `${item.productName} — only ${item.quantity} left in stock`,
      priority: 2,
      urgency: item.quantity <= 2 ? 'high' : 'medium',
    };
  }

  if (salesCount >= 3) {
    return {
      type: 'recent_purchase',
      message: `${salesCount} orders placed in the last 48 hours`,
      priority: 3,
    };
  }

  return null;
}

function showToast($w, notification, config) {
  const state = getSessionState();
  if (state.count >= config.maxPerSession) return;

  const now = Date.now();
  if (now - state.lastShown < config.minIntervalMs) return;

  try {
    const toastEl = $w('#socialProofToast');
    const toastMsg = $w('#socialProofMessage');
    const toastIcon = $w('#socialProofIcon');
    const toastClose = $w('#socialProofClose');
    if (!toastEl || !toastMsg) return;

    // Set message
    toastMsg.text = notification.message;

    // Set icon based on type
    try {
      if (notification.type === 'low_stock') {
        toastIcon.text = '\u26A0'; // Warning
      } else if (notification.type === 'recent_purchase') {
        toastIcon.text = '\u2705'; // Checkmark
      } else {
        toastIcon.text = '\uD83D\uDC41'; // Eye
      }
    } catch (e) {}

    // Show with animation
    toastEl.show('slide', { duration: 300, direction: 'bottom' });

    // Announce to screen readers
    announce($w, notification.message, 'polite');

    // Update session state
    setSessionState({ count: state.count + 1, lastShown: now });

    // Auto-dismiss
    const dismissTimer = setTimeout(() => {
      try { toastEl.hide('fade', { duration: 300 }); } catch (e) {}
    }, config.autoDismissMs);

    // Manual close
    try {
      toastClose.onClick(() => {
        clearTimeout(dismissTimer);
        try { toastEl.hide('fade', { duration: 200 }); } catch (e) {}
      });
    } catch (e) {}
  } catch (e) {}
}
