/**
 * @module GamificationTourOverlay
 * @description Shows the gamification discovery tour overlay to logged-in
 * members on their first visit. Suppressed via localStorage so it fires
 * once per browser (not per session). No-ops gracefully for visitors.
 *
 * Element IDs (set in Wix editor):
 *   #gamificationTourOverlay  — container shown/hidden
 *   #gamificationTourClose    — button that dismisses the overlay
 *   #gamificationTourCta      — "Start First Challenge" button (deep link)
 *
 * CF-z2vj  CF-08fa
 *
 * @example
 *   // In Home.js sections array (dynamic import to stay within import budget):
 *   { name: 'gamificationTour', init: async () => {
 *       const { initGamificationTourOverlay } = await import('public/GamificationTourOverlay.js');
 *       await initGamificationTourOverlay();
 *     }, critical: false }
 */

const TOUR_KEY = 'cf_gamification_tour_shown';

// ── Internal helpers ─────────────────────────────────────────────────

/**
 * Resolve injectable $w from opts or fall back to globalThis.$w.
 * @param {Object} opts
 * @returns {Function}
 */
function get$w(opts) {
  return opts.$w || globalThis.$w;
}

/**
 * Resolve injectable localStorage from opts or fall back to the global.
 * Returns null if localStorage is unavailable (SSR or blocked storage).
 * @param {Object} opts
 * @returns {Object|null}
 */
function getStorage(opts) {
  if ('storage' in opts) return opts.storage;
  try { return localStorage; } catch (_) { return null; }
}

/**
 * Fetch the current member using injectable fn or wix-members-frontend.
 * Returns null if no member is logged in or the call fails.
 * @param {Object} opts
 * @returns {Promise<Object|null>}
 */
async function fetchMember(opts) {
  if (opts.getMember) {
    try { return await opts.getMember(); } catch (_) { return null; }
  }
  try {
    const { currentMember } = await import('wix-members-frontend');
    return await currentMember.getMember();
  } catch (_) {
    return null; // Visitor or auth unavailable
  }
}

/**
 * Navigate to the challenges page using injectable fn or wix-location-frontend.
 * Best-effort: silently swallows errors so a navigation failure never crashes
 * the overlay or leaves it in a broken state.
 * @param {Object} opts
 * @returns {Promise<void>}
 */
async function navigateToChallenges(opts) {
  if (opts.navigate) {
    try { await opts.navigate('/challenges'); } catch (_) {}
    return;
  }
  try {
    const { to } = await import('wix-location-frontend');
    to('/challenges');
  } catch (_) {}
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Initialise the gamification tour overlay on the Home page.
 * Shows the overlay if:
 *   1. The current visitor is a logged-in member.
 *   2. The tour has not been shown before (localStorage key absent).
 *
 * Sets the localStorage key before showing so a race between tab opens
 * doesn't cause a double-show.
 *
 * @param {Object} [opts]
 * @param {Function} [opts.$w]          - Injectable $w for testing
 * @param {Function} [opts.getMember]   - Injectable member fetch for testing
 * @param {Object}   [opts.storage]     - Injectable localStorage for testing
 *                                        (pass null to disable storage check)
 * @param {Function} [opts.navigate]    - Injectable navigate(path) for testing
 * @returns {Promise<void>}
 */
export async function initGamificationTourOverlay(opts = {}) {
  const $wFn    = get$w(opts);
  const storage = getStorage(opts);

  // Suppress if already shown in a previous session
  if (storage) {
    try {
      if (storage.getItem(TOUR_KEY)) return;
    } catch (_) { /* storage unreadable — proceed */ }
  }

  // Only show for logged-in members
  const member = await fetchMember(opts);
  if (!member?._id) return;

  try {
    const overlay = $wFn('#gamificationTourOverlay');
    if (!overlay) return;

    // Mark shown only after confirming the overlay exists — if the editor
    // element is absent we must not consume the one-time flag permanently.
    if (storage) {
      try { storage.setItem(TOUR_KEY, '1'); } catch (_) { /* non-fatal */ }
    }

    // Wire dismiss button — best-effort; overlay still shows if button absent
    try {
      const closeBtn = $wFn('#gamificationTourClose');
      if (closeBtn) closeBtn.onClick(() => { try { overlay.hide(); } catch (_) {} });
    } catch (_) {}

    // Wire CTA: "Start First Challenge" — navigates to /challenges and closes overlay
    try {
      const ctaBtn = $wFn('#gamificationTourCta');
      if (ctaBtn) ctaBtn.onClick(() => {
        try { overlay.hide(); } catch (_) {}
        navigateToChallenges(opts);
      });
    } catch (_) {}

    overlay.show();
  } catch (err) {
    console.warn('[GamificationTourOverlay] show failed:', err?.message ?? err);
  }
}
