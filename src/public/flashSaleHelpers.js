// Flash Sale Timer & Deal Engine — Pure frontend helpers
// Countdown formatting, urgency levels, and deal banner logic.
// All functions are pure (no $w dependency) for testability.
// Page modules wire these to Wix Velo elements.

const HOUR = 3600000;
const DAY = 86400000;
const DEFAULT_CRITICAL_HOURS = 2;
const DEFAULT_URGENT_HOURS = 24;

/**
 * Parse an endDate value into a timestamp. Returns NaN for invalid input.
 * @param {Date|string|number|null|undefined} endDate
 * @returns {number}
 */
function parseEndDate(endDate) {
  if (endDate == null) return NaN;
  if (typeof endDate === 'number') return endDate;
  return new Date(endDate).getTime();
}

/**
 * Format a countdown from now until endDate.
 * @param {Date|string|number|null|undefined} endDate - Target end time.
 * @returns {{ days: number, hours: number, mins: number, secs: number, expired: boolean, totalMs: number, formatted: string }}
 */
export function formatCountdown(endDate) {
  const expired = { days: 0, hours: 0, mins: 0, secs: 0, expired: true, totalMs: 0, formatted: '00:00:00:00' };
  const end = parseEndDate(endDate);
  if (isNaN(end)) return expired;

  const diff = end - Date.now();
  if (diff <= 0) return expired;

  const days = Math.floor(diff / DAY);
  const hours = Math.floor((diff % DAY) / HOUR);
  const mins = Math.floor((diff % HOUR) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  const pad = (n) => String(n).padStart(2, '0');

  return {
    days,
    hours,
    mins,
    secs,
    expired: false,
    totalMs: diff,
    formatted: `${pad(days)}:${pad(hours)}:${pad(mins)}:${pad(secs)}`,
  };
}

/**
 * Determine urgency level based on time remaining.
 * @param {Date|string|number|null|undefined} endDate
 * @param {{ criticalHours?: number, urgentHours?: number }} [options]
 * @returns {'critical' | 'urgent' | 'active' | 'expired'}
 */
export function getUrgencyLevel(endDate, options = {}) {
  const end = parseEndDate(endDate);
  if (isNaN(end)) return 'expired';

  const diff = end - Date.now();
  if (diff <= 0) return 'expired';

  const criticalMs = (options.criticalHours ?? DEFAULT_CRITICAL_HOURS) * HOUR;
  const urgentMs = (options.urgentHours ?? DEFAULT_URGENT_HOURS) * HOUR;

  if (diff <= criticalMs) return 'critical';
  if (diff <= urgentMs) return 'urgent';
  return 'active';
}

/**
 * Generate urgency copy for a deal based on time remaining and discount.
 * @param {{ endDate?: Date|string|number, discountPercent?: number, discountCode?: string } | null} deal
 * @returns {string}
 */
export function getUrgencyMessage(deal) {
  if (!deal || !deal.endDate) return '';

  const level = getUrgencyLevel(deal.endDate);
  if (level === 'expired') return '';

  const pct = deal.discountPercent;
  const discountText = pct ? `${pct}% off` : 'Special offer';

  if (level === 'critical') {
    return `Ending Soon — ${discountText}!`;
  }
  if (level === 'urgent') {
    return `Flash Sale: ${discountText}`;
  }
  return `Sale: ${discountText}`;
}

/**
 * Format a deal into banner display data.
 * @param {{ _id?: string, title?: string, subtitle?: string, endDate?: Date|string|number, discountPercent?: number, discountCode?: string, bannerMessage?: string } | null} deal
 * @returns {{ title: string, subtitle: string, discountText: string, codeText: string, urgencyLevel: string, countdown: object, message: string } | null}
 */
export function formatDealBanner(deal) {
  if (!deal || !deal.endDate) return null;

  const countdown = formatCountdown(deal.endDate);
  if (countdown.expired) return null;

  const level = getUrgencyLevel(deal.endDate);
  const pct = deal.discountPercent;
  const discountText = pct ? `${pct}% off` : '';
  const codeText = deal.discountCode ? `Use code: ${deal.discountCode}` : '';

  const defaultMessage = pct
    ? `${deal.title || 'Flash Sale'} — ${pct}% off`
    : deal.title || 'Flash Sale';

  return {
    title: deal.title || 'Flash Sale',
    subtitle: deal.subtitle || '',
    discountText,
    codeText,
    urgencyLevel: level,
    countdown,
    message: deal.bannerMessage || defaultMessage,
  };
}

/**
 * Build a concise announcement bar message from deal data.
 * @param {{ title?: string, discountPercent?: number, discountCode?: string, endDate?: Date|string|number } | null} deal
 * @returns {string}
 */
export function buildAnnouncementMessage(deal) {
  if (!deal || !deal.endDate) return '';

  const level = getUrgencyLevel(deal.endDate);
  if (level === 'expired') return '';

  const title = deal.title || 'Sale';
  const pct = deal.discountPercent;
  const code = deal.discountCode;

  let msg = '';
  if (level === 'critical') {
    msg = pct
      ? `Ending Soon: ${pct}% off`
      : `Ending Soon: ${title}`;
  } else {
    msg = pct
      ? `${title}: ${pct}% off`
      : title;
  }

  if (code) {
    msg += ` — Use code ${code}`;
  }

  return msg;
}

/**
 * Initialize a countdown timer that updates a Wix element every second.
 * Returns a cleanup function to clear the interval.
 * @param {Function} $w - Wix selector function.
 * @param {string} elementId - Wix element ID (e.g. '#flashCountdown').
 * @param {Date|string|number} endDate - Target end time.
 * @param {{ onExpire?: Function }} [options]
 * @returns {Function} Cleanup function to stop the timer.
 */
export function initCountdownTimer($w, elementId, endDate, options = {}) {
  let intervalId = null;

  function update() {
    try {
      const el = $w(elementId);
      const cd = formatCountdown(endDate);
      if (cd.expired) {
        el.text = 'Sale Ended';
        if (intervalId) clearInterval(intervalId);
        if (options.onExpire) options.onExpire();
        return;
      }
      el.text = cd.formatted;
    } catch (_) {
      // Element may not exist on this page
    }
  }

  update();
  intervalId = setInterval(update, 1000);

  return () => {
    if (intervalId) clearInterval(intervalId);
  };
}

/**
 * Initialize a flash sale banner section on a page.
 * Shows/hides the banner based on active deals and populates content.
 * @param {Function} $w - Wix selector function.
 * @param {{ deal: object, elements?: { banner?: string, title?: string, subtitle?: string, countdown?: string, code?: string, cta?: string } }} config
 * @returns {Function|null} Cleanup function, or null if no deal shown.
 */
export function initFlashSaleBanner($w, config) {
  const { deal, elements = {} } = config;
  const ids = {
    banner: elements.banner || '#flashSaleBanner',
    title: elements.title || '#flashSaleTitle',
    subtitle: elements.subtitle || '#flashSaleSubtitle',
    countdown: elements.countdown || '#flashSaleCountdown',
    code: elements.code || '#flashSaleCode',
    cta: elements.cta || '#flashSaleCta',
  };

  const bannerData = formatDealBanner(deal);
  if (!bannerData) {
    try { $w(ids.banner).collapse(); } catch (_) {}
    return null;
  }

  try {
    const bannerEl = $w(ids.banner);
    bannerEl.expand();
    bannerEl.show('fade', { duration: 250 });
  } catch (_) {}

  try { $w(ids.title).text = bannerData.title; } catch (_) {}
  try { $w(ids.subtitle).text = bannerData.subtitle; } catch (_) {}
  try { $w(ids.code).text = bannerData.codeText; } catch (_) {}
  try {
    if (deal.ctaUrl) {
      $w(ids.cta).label = deal.ctaText || 'Shop Now';
      $w(ids.cta).link = deal.ctaUrl;
    }
  } catch (_) {}

  const cleanup = initCountdownTimer($w, ids.countdown, deal.endDate, {
    onExpire: () => {
      try { $w(ids.banner).collapse(); } catch (_) {}
    },
  });

  return cleanup;
}

/**
 * Initialize urgency badge on a product element.
 * Shows a flash sale urgency message near the product.
 * @param {Function} $w - Wix selector function.
 * @param {{ deal: object, badgeElementId?: string }} config
 * @returns {Function|null} Cleanup function, or null if not shown.
 */
export function initProductUrgencyBadge($w, config) {
  const { deal, badgeElementId = '#flashSaleBadge' } = config;

  if (!deal || !deal.endDate) {
    try { $w(badgeElementId).collapse(); } catch (_) {}
    return null;
  }

  const message = getUrgencyMessage(deal);
  if (!message) {
    try { $w(badgeElementId).collapse(); } catch (_) {}
    return null;
  }

  try {
    const badge = $w(badgeElementId);
    badge.text = message;
    badge.expand();
    badge.show('fade', { duration: 150 });
  } catch (_) {}

  // Update urgency message periodically (urgency level can change)
  const intervalId = setInterval(() => {
    try {
      const msg = getUrgencyMessage(deal);
      if (!msg) {
        $w(badgeElementId).collapse();
        clearInterval(intervalId);
        return;
      }
      $w(badgeElementId).text = msg;
    } catch (_) {
      clearInterval(intervalId);
    }
  }, 60000); // Update every minute

  return () => clearInterval(intervalId);
}
