/**
 * @module QuestShareCard
 * @description Social share card shown on quest completion.
 * Renders an SVG card with the member's badge, quest name, and CF brand,
 * then surfaces a one-tap share action (Web Share API or clipboard fallback).
 *
 * Element IDs (set in Wix editor):
 *   #questShareCard       — container shown on completion
 *   #questShareCardImage  — image element populated with SVG data URL
 *   #questShareCardClose  — dismiss button
 *   #questShareCardShare  — share / copy-link button
 *
 * CF-41x (CF-p6v2 Phase 6 v2)
 *
 * @example
 *   import { showQuestShareCard } from 'public/QuestShareCard.js';
 *   await showQuestShareCard({ questName: 'First Purchase', badgeLabel: '🏅' });
 */

const BRAND = 'Carolina Futons';
const CARD_W = 600;
const CARD_H = 315;

// ── SVG builder ──────────────────────────────────────────────────────

/**
 * Generate an SVG share card as a data URL.
 *
 * @param {object} p
 * @param {string} p.badgeLabel - Badge emoji or short label (e.g. "🏅")
 * @param {string} p.questName  - Quest title displayed on the card
 * @param {string} [p.brand]    - Brand name (defaults to "Carolina Futons")
 * @returns {string} data URL (data:image/svg+xml;base64,...)
 */
export function buildShareCardDataUrl({ badgeLabel, questName, brand = BRAND }) {
  const safe = (s) => String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a1a2e"/>
      <stop offset="100%" stop-color="#16213e"/>
    </linearGradient>
  </defs>
  <rect width="${CARD_W}" height="${CARD_H}" fill="url(#bg)" rx="16"/>
  <text x="300" y="110" font-family="sans-serif" font-size="72" text-anchor="middle" dominant-baseline="middle">${safe(badgeLabel)}</text>
  <text x="300" y="185" font-family="sans-serif" font-size="28" font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${safe(questName)}</text>
  <text x="300" y="230" font-family="sans-serif" font-size="16" fill="#a0aec0" text-anchor="middle" dominant-baseline="middle">Quest Complete</text>
  <text x="300" y="285" font-family="sans-serif" font-size="14" fill="#718096" text-anchor="middle" dominant-baseline="middle">${safe(brand)}</text>
</svg>`;

  const b64 = typeof btoa !== 'undefined'
    ? btoa(unescape(encodeURIComponent(svg)))
    : Buffer.from(svg, 'utf8').toString('base64');
  return `data:image/svg+xml;base64,${b64}`;
}

// ── Share action ─────────────────────────────────────────────────────

/**
 * Share the quest completion using Web Share API, falling back to clipboard.
 * Returns 'shared', 'copied', or 'unavailable'.
 *
 * @param {object} p
 * @param {string} p.questName
 * @param {string} [p.brand]
 * @param {object} [p.navigator] - Injectable for testing
 * @param {object} [p.clipboard] - Injectable clipboard (e.g. navigator.clipboard) for testing
 * @returns {Promise<'shared'|'copied'|'unavailable'>}
 */
export async function shareQuestCompletion({ questName, brand = BRAND, navigator: nav, clipboard: clip } = {}) {
  const navObj = nav ?? (typeof navigator !== 'undefined' ? navigator : null);
  const clipObj = clip ?? (typeof navigator !== 'undefined' ? navigator?.clipboard : null);

  const text = `I just completed the "${questName}" quest on ${brand}! 🎉`;

  if (navObj?.share) {
    try {
      await navObj.share({ title: `${brand} — Quest Complete`, text });
      return 'shared';
    } catch (_) { /* AbortError (user cancelled) or NotAllowedError — fall through to clipboard */ }
  }

  if (clipObj?.writeText) {
    try {
      await clipObj.writeText(text);
      return 'copied';
    } catch (err) {
      console.warn('[QuestShareCard] clipboard write failed:', err?.message ?? err);
    }
  }

  return 'unavailable';
}

// ── $w helpers ───────────────────────────────────────────────────────

function get$w(opts) {
  return opts.$w || globalThis.$w;
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Show the quest share card overlay on quest completion.
 *
 * @param {object} [opts]
 * @param {string}   [opts.questName]  - Quest title (default: '')
 * @param {string}   [opts.badgeLabel] - Badge emoji or label (default: "🏆")
 * @param {Function} [opts.$w]        - Injectable $w for testing
 * @param {object}   [opts.navigator] - Injectable navigator for testing
 * @param {object}   [opts.clipboard] - Injectable clipboard for testing
 * @returns {Promise<void>}
 */
export async function showQuestShareCard(opts = {}) {
  const { questName = '', badgeLabel = '🏆' } = opts;
  const $wFn = get$w(opts);

  let card;
  try {
    card = $wFn('#questShareCard');
    if (!card) return;
  } catch (err) {
    console.warn('[QuestShareCard] failed to get #questShareCard:', err?.message ?? err);
    return;
  }

  // Populate card image
  try {
    const imgEl = $wFn('#questShareCardImage');
    if (imgEl) imgEl.src = buildShareCardDataUrl({ badgeLabel, questName });
  } catch (err) {
    console.warn('[QuestShareCard] image render failed:', err?.message ?? err);
  }

  // Wire close button
  try {
    const closeBtn = $wFn('#questShareCardClose');
    if (closeBtn) closeBtn.onClick(() => {
      try { card.hide(); }
      catch (err) { console.warn('[QuestShareCard] card.hide failed:', err?.message ?? err); }
    });
  } catch (err) {
    console.warn('[QuestShareCard] close button wiring failed:', err?.message ?? err);
  }

  // Wire share button
  try {
    const shareBtn = $wFn('#questShareCardShare');
    if (shareBtn) {
      shareBtn.onClick(async () => {
        try {
          const outcome = await shareQuestCompletion({
            questName,
            navigator: opts.navigator,
            clipboard: opts.clipboard,
          });
          if (outcome === 'unavailable') {
            console.warn('[QuestShareCard] share unavailable — neither Web Share API nor clipboard accessible');
          }
        } catch (err) {
          console.warn('[QuestShareCard] shareQuestCompletion threw:', err?.message ?? err);
        }
      });
    }
  } catch (err) {
    console.warn('[QuestShareCard] share button wiring failed:', err?.message ?? err);
  }

  try { card.show(); } catch (err) {
    console.warn('[QuestShareCard] show failed:', err?.message ?? err);
  }
}
