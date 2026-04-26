/**
 * @module SaleLightbox
 * @description Sale/promo lightbox shown 3s after first home visit.
 * Dismiss state persists 24h in localStorage. Content is CMS-driven via
 * the Promotions collection so copy changes don't require a dev push.
 *
 * Editor elements required:
 *   #saleLightboxOverlay  — full-screen backdrop (Box, initially hidden)
 *   #saleLightboxPanel    — centered dialog (Box)
 *   #saleLightboxClose    — dismiss button (Button/IconButton)
 *   #saleLightboxImage    — hero promo image (Image)
 *   #saleLightboxHeadline — promo headline (Text)
 *   #saleLightboxSubtitle — promo subtitle (Text, optional)
 *   #saleLightboxCountdown — countdown "DD:HH:MM:SS" (Text)
 *   #saleLightboxCTA      — CTA button (Button)
 *
 * CF-0i3p
 */

export const DISMISS_KEY = 'cf_sale_lightbox_dismissed';
export const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000;
export const SHOW_DELAY_MS = 3000;

// ── Storage helpers ──────────────────────────────────────────────────────────

function getStorage(opts) {
  if ('storage' in opts) return opts.storage;
  try { return localStorage; } catch (_) { return null; }
}

/**
 * @param {Object|null} storage
 * @returns {boolean}
 */
export function isDismissed(storage) {
  if (!storage) return false;
  try {
    const raw = storage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    return !isNaN(ts) && (Date.now() - ts) < DISMISS_DURATION_MS;
  } catch (_) { return false; }
}

/**
 * @param {Object|null} storage
 */
export function markDismissed(storage) {
  if (!storage) return;
  try { storage.setItem(DISMISS_KEY, String(Date.now())); } catch (_) {}
}

// ── Countdown ────────────────────────────────────────────────────────────────

/**
 * Format milliseconds remaining as "DD:HH:MM:SS".
 * @param {number} ms
 * @returns {string}
 */
export function formatCountdown(ms) {
  if (ms <= 0) return '00:00:00:00';
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d)}:${pad(h)}:${pad(m)}:${pad(s)}`;
}

/**
 * Tick $w(countdownId).text every second until endDate. Returns cleanup fn.
 * @param {Function} $w
 * @param {string} countdownId
 * @param {Date} endDate
 * @param {Function} [setIntervalFn]
 * @param {Function} [clearIntervalFn]
 * @returns {Function}
 */
export function startCountdown($w, countdownId, endDate, setIntervalFn = setInterval, clearIntervalFn = clearInterval) {
  let timerId = null;

  function tick() {
    const remaining = endDate.getTime() - Date.now();
    try { $w(countdownId).text = formatCountdown(remaining); } catch (_) {}
    if (remaining <= 0) clearIntervalFn(timerId);
  }

  tick();
  timerId = setIntervalFn(tick, 1000);
  return () => clearIntervalFn(timerId);
}

// ── Motion preference ────────────────────────────────────────────────────────

function prefersReducedMotion(opts) {
  if ('prefersReducedMotion' in opts) return opts.prefersReducedMotion;
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; }
}

// ── Main API ─────────────────────────────────────────────────────────────────

/**
 * Initialise the sale lightbox on the home page.
 * No-ops if: already dismissed, no active promo, or overlay element absent.
 *
 * @param {Object} [opts]
 * @param {Function} [opts.$w]                   - Injectable $w
 * @param {Object}   [opts.storage]              - Injectable localStorage (null = skip check)
 * @param {boolean}  [opts.prefersReducedMotion] - Motion override
 * @param {Function} [opts.getActivePromotion]   - Injectable backend call
 * @param {Function} [opts.navigate]             - Injectable navigate(url)
 * @param {Function} [opts.setTimeout]           - Injectable setTimeout
 * @param {Function} [opts.setInterval]          - Injectable setInterval
 * @param {Function} [opts.clearInterval]        - Injectable clearInterval
 * @returns {Promise<void>}
 */
export async function initSaleLightbox(opts = {}) {
  const $wFn          = opts.$w          ?? globalThis.$w;
  const storage       = getStorage(opts);
  const noMotion      = prefersReducedMotion(opts);
  const setTimeoutFn  = opts.setTimeout  ?? setTimeout;
  const siFn          = opts.setInterval ?? setInterval;
  const ciFn          = opts.clearInterval ?? clearInterval;

  if (isDismissed(storage)) return;

  let promo;
  try {
    if (opts.getActivePromotion) {
      promo = await opts.getActivePromotion();
    } else {
      const m = await import('backend/promotions.web');
      promo = await m.getActivePromotion();
    }
  } catch (_) { return; }

  if (!promo) return;

  // Populate content
  try { $wFn('#saleLightboxImage').src = promo.heroImage || ''; } catch (_) {}
  try { $wFn('#saleLightboxHeadline').text = promo.title || 'Spring Sale'; } catch (_) {}
  try { $wFn('#saleLightboxSubtitle').text = promo.subtitle || ''; } catch (_) {}
  try { $wFn('#saleLightboxCTA').label = promo.ctaText || 'Shop Now'; } catch (_) {}

  const dismiss = () => {
    markDismissed(storage);
    try { $wFn('#saleLightboxOverlay').hide('fade', { duration: noMotion ? 0 : 200 }); } catch (_) {
      try { $wFn('#saleLightboxOverlay').hide(); } catch (_) {}
    }
    stopCountdown();
  };

  // Wire CTA
  try {
    $wFn('#saleLightboxCTA').onClick(() => {
      dismiss();
      const url = promo.ctaUrl || '/spring-sale';
      if (opts.navigate) {
        opts.navigate(url);
      } else {
        import('wix-location-frontend').then(({ to }) => to(url)).catch(() => {});
      }
    });
  } catch (_) {}

  // Wire close button and Escape via setupAccessibleDialog
  try {
    const { setupAccessibleDialog } = await import('public/a11yHelpers.js');
    setupAccessibleDialog($wFn, {
      panelId: '#saleLightboxPanel',
      closeId: '#saleLightboxClose',
      titleId: '#saleLightboxHeadline',
      focusableIds: ['#saleLightboxClose', '#saleLightboxCTA'],
      onClose: dismiss,
    });
  } catch (_) {
    // Fallback: wire close button directly
    try { $wFn('#saleLightboxClose').onClick(dismiss); } catch (_) {}
  }

  // Click-outside (overlay backdrop click)
  try {
    $wFn('#saleLightboxOverlay').onClick((event) => {
      try {
        if (event?.target?.id?.includes('saleLightboxOverlay')) dismiss();
      } catch (_) { dismiss(); }
    });
  } catch (_) {}

  // Countdown timer
  let stopCountdown = () => {};
  if (promo.endDate) {
    stopCountdown = startCountdown($wFn, '#saleLightboxCountdown', new Date(promo.endDate), siFn, ciFn);
  } else {
    try { $wFn('#saleLightboxCountdown').hide(); } catch (_) {}
  }

  // Show after 3s delay
  setTimeoutFn(() => {
    if (isDismissed(storage)) return;
    try {
      $wFn('#saleLightboxOverlay').show('fade', { duration: noMotion ? 0 : 400 });
    } catch (_) {
      try { $wFn('#saleLightboxOverlay').show(); } catch (_) {}
    }
  }, SHOW_DELAY_MS);
}
