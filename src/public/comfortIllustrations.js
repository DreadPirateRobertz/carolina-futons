/**
 * comfortIllustrations.js — Hand-drawn SVG illustrations for comfort levels.
 *
 * Replaces emoji fallbacks (☁️/⚖️/🧱) with illustrated figures matching
 * the Blue Ridge Mountain aesthetic. Uses brand tokens for all colors.
 *
 * Three levels:
 * - Plush: person sinking into cloud-like cushion
 * - Medium: balanced seated figure
 * - Firm: upright supported figure
 */
import { colors } from 'public/designTokens.js';

/**
 * Build a data URI from raw SVG markup.
 * @param {string} svgMarkup - Raw SVG string.
 * @returns {string} data:image/svg+xml encoded URI.
 */
function toDataUri(svgMarkup) {
  return `data:image/svg+xml,${encodeURIComponent(svgMarkup)}`;
}

// ── SVG Illustrations ───────────────────────────────────────────────

function buildPlushSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <linearGradient id="plushCushion" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${colors.skyGradientTop}" />
      <stop offset="100%" stop-color="${colors.sandLight}" />
    </linearGradient>
  </defs>
  <!-- Cloud-like cushion base -->
  <ellipse cx="100" cy="155" rx="85" ry="35" fill="url(#plushCushion)" stroke="${colors.espresso}" stroke-width="1.5" opacity="0.9" />
  <ellipse cx="60" cy="140" rx="35" ry="22" fill="${colors.sandLight}" stroke="${colors.espresso}" stroke-width="1" opacity="0.7" />
  <ellipse cx="140" cy="140" rx="35" ry="22" fill="${colors.sandLight}" stroke="${colors.espresso}" stroke-width="1" opacity="0.7" />
  <ellipse cx="100" cy="135" rx="40" ry="25" fill="${colors.sandBase}" stroke="${colors.espresso}" stroke-width="1" opacity="0.8" />
  <!-- Person sinking in — relaxed posture -->
  <circle cx="100" cy="72" r="18" fill="${colors.sandBase}" stroke="${colors.espresso}" stroke-width="2" />
  <line x1="100" y1="90" x2="100" y2="130" stroke="${colors.espresso}" stroke-width="2.5" stroke-linecap="round" />
  <!-- Arms draped relaxed -->
  <path d="M100 100 Q80 108 65 120" fill="none" stroke="${colors.espresso}" stroke-width="2" stroke-linecap="round" />
  <path d="M100 100 Q120 108 135 120" fill="none" stroke="${colors.espresso}" stroke-width="2" stroke-linecap="round" />
  <!-- Legs tucked into cushion -->
  <path d="M100 130 Q90 148 75 155" fill="none" stroke="${colors.espresso}" stroke-width="2" stroke-linecap="round" />
  <path d="M100 130 Q110 148 125 155" fill="none" stroke="${colors.espresso}" stroke-width="2" stroke-linecap="round" />
  <!-- Relaxed expression — closed eyes, smile -->
  <path d="M93 70 Q95 68 97 70" fill="none" stroke="${colors.espresso}" stroke-width="1.5" stroke-linecap="round" />
  <path d="M103 70 Q105 68 107 70" fill="none" stroke="${colors.espresso}" stroke-width="1.5" stroke-linecap="round" />
  <path d="M95 77 Q100 80 105 77" fill="none" stroke="${colors.espresso}" stroke-width="1.2" stroke-linecap="round" />
  <!-- Small cloud puffs for softness -->
  <circle cx="45" cy="148" r="8" fill="${colors.offWhite}" opacity="0.5" />
  <circle cx="155" cy="148" r="8" fill="${colors.offWhite}" opacity="0.5" />
</svg>`;
}

function buildMediumSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <linearGradient id="medCushion" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${colors.sandBase}" />
      <stop offset="100%" stop-color="${colors.sandDark}" />
    </linearGradient>
  </defs>
  <!-- Balanced cushion — moderate depth -->
  <rect x="30" y="145" rx="12" ry="12" width="140" height="30" fill="url(#medCushion)" stroke="${colors.espresso}" stroke-width="1.5" />
  <rect x="40" y="140" rx="8" ry="8" width="120" height="12" fill="${colors.sandLight}" stroke="${colors.espresso}" stroke-width="1" />
  <!-- Person seated balanced — upright but comfortable -->
  <circle cx="100" cy="62" r="18" fill="${colors.sandBase}" stroke="${colors.espresso}" stroke-width="2" />
  <line x1="100" y1="80" x2="100" y2="125" stroke="${colors.espresso}" stroke-width="2.5" stroke-linecap="round" />
  <!-- Arms relaxed at sides -->
  <path d="M100 95 Q82 105 72 115" fill="none" stroke="${colors.espresso}" stroke-width="2" stroke-linecap="round" />
  <path d="M100 95 Q118 105 128 115" fill="none" stroke="${colors.espresso}" stroke-width="2" stroke-linecap="round" />
  <!-- Legs bent naturally -->
  <path d="M100 125 Q88 145 78 155" fill="none" stroke="${colors.espresso}" stroke-width="2" stroke-linecap="round" />
  <path d="M100 125 Q112 145 122 155" fill="none" stroke="${colors.espresso}" stroke-width="2" stroke-linecap="round" />
  <!-- Calm expression — open eyes, gentle smile -->
  <circle cx="94" cy="60" r="2" fill="${colors.espresso}" />
  <circle cx="106" cy="60" r="2" fill="${colors.espresso}" />
  <path d="M95 68 Q100 72 105 68" fill="none" stroke="${colors.espresso}" stroke-width="1.2" stroke-linecap="round" />
  <!-- Balance symbol — small scale icon -->
  <line x1="100" y1="28" x2="100" y2="38" stroke="${colors.mountainBlue}" stroke-width="1.5" stroke-linecap="round" />
  <line x1="85" y1="32" x2="115" y2="32" stroke="${colors.mountainBlue}" stroke-width="1.5" stroke-linecap="round" />
  <path d="M85 32 Q82 38 85 38 L90 38 Q87 38 85 32" fill="${colors.mountainBlueLight}" stroke="${colors.mountainBlue}" stroke-width="0.8" />
  <path d="M115 32 Q118 38 115 38 L110 38 Q113 38 115 32" fill="${colors.mountainBlueLight}" stroke="${colors.mountainBlue}" stroke-width="0.8" />
</svg>`;
}

function buildFirmSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <linearGradient id="firmBase" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${colors.sandDark}" />
      <stop offset="100%" stop-color="${colors.espressoLight}" />
    </linearGradient>
  </defs>
  <!-- Firm flat base — solid support -->
  <rect x="25" y="150" rx="4" ry="4" width="150" height="25" fill="url(#firmBase)" stroke="${colors.espresso}" stroke-width="1.5" />
  <rect x="35" y="148" rx="2" ry="2" width="130" height="6" fill="${colors.sandBase}" stroke="${colors.espresso}" stroke-width="1" />
  <!-- Person upright — strong posture -->
  <circle cx="100" cy="55" r="18" fill="${colors.sandBase}" stroke="${colors.espresso}" stroke-width="2" />
  <line x1="100" y1="73" x2="100" y2="120" stroke="${colors.espresso}" stroke-width="2.5" stroke-linecap="round" />
  <!-- Straight spine line for posture emphasis -->
  <line x1="100" y1="73" x2="100" y2="120" stroke="${colors.sunsetCoral}" stroke-width="1" stroke-dasharray="3,3" opacity="0.5" />
  <!-- Arms at sides, confident -->
  <path d="M100 88 Q85 95 78 108" fill="none" stroke="${colors.espresso}" stroke-width="2" stroke-linecap="round" />
  <path d="M100 88 Q115 95 122 108" fill="none" stroke="${colors.espresso}" stroke-width="2" stroke-linecap="round" />
  <!-- Legs firm, planted -->
  <path d="M100 120 Q92 140 85 153" fill="none" stroke="${colors.espresso}" stroke-width="2" stroke-linecap="round" />
  <path d="M100 120 Q108 140 115 153" fill="none" stroke="${colors.espresso}" stroke-width="2" stroke-linecap="round" />
  <!-- Confident expression -->
  <circle cx="94" cy="53" r="2" fill="${colors.espresso}" />
  <circle cx="106" cy="53" r="2" fill="${colors.espresso}" />
  <line x1="95" y1="61" x2="105" y2="61" stroke="${colors.espresso}" stroke-width="1.5" stroke-linecap="round" />
  <!-- Mountain-peak strength motif -->
  <path d="M35 148 L50 130 L65 148" fill="none" stroke="${colors.mountainBlue}" stroke-width="1.2" stroke-linecap="round" opacity="0.6" />
  <path d="M135 148 L150 130 L165 148" fill="none" stroke="${colors.mountainBlue}" stroke-width="1.2" stroke-linecap="round" opacity="0.6" />
</svg>`;
}

// ── Exports ─────────────────────────────────────────────────────────

/**
 * Comfort level illustrations keyed by slug.
 * Each entry contains a data URI SVG, alt text, and slug.
 * @type {Object<string, {svg: string, alt: string, slug: string}>}
 */
export const COMFORT_ILLUSTRATIONS = {
  plush: {
    svg: toDataUri(buildPlushSvg()),
    alt: 'Person sinking into a cloud-like plush cushion, fully relaxed',
    slug: 'plush',
  },
  medium: {
    svg: toDataUri(buildMediumSvg()),
    alt: 'Person seated in balanced position on a medium-firm cushion',
    slug: 'medium',
  },
  firm: {
    svg: toDataUri(buildFirmSvg()),
    alt: 'Person sitting upright with strong posture on a firm supportive base',
    slug: 'firm',
  },
};

/**
 * Get a comfort illustration by slug.
 * @param {string} slug - Comfort level slug (plush, medium, firm).
 * @returns {{svg: string, alt: string, slug: string}|null}
 */
export function getComfortIllustration(slug) {
  if (!slug) return null;
  return COMFORT_ILLUSTRATIONS[slug] || null;
}

/**
 * Get the visual representation for a comfort level.
 * Returns SVG illustration if available, otherwise an empty emoji fallback.
 * @param {string} slug - Comfort level slug.
 * @returns {{src: string, alt: string, type: 'svg'|'emoji'}}
 */
export function getComfortVisual(slug) {
  const illust = getComfortIllustration(slug);
  if (illust) {
    return { src: illust.svg, alt: illust.alt, type: 'svg' };
  }
  return { src: '', alt: '', type: 'emoji' };
}
