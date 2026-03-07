/**
 * Empty State Inline SVG Illustrations — Blue Ridge Mountain Aesthetic
 *
 * 8 hand-drawn-style SVG scenes for empty states, using brand tokens.
 * Each illustration uses organic paths, overlapping semi-transparent layers,
 * rich gradients (5+ stops), and 15+ distinct elements per scene.
 *
 * No SVG filter elements (feTurbulence, feDisplacementMap, fractalNoise
 * are deprecated per overseer directive — they produced "too abstract" results).
 * Watercolor feel is achieved through layered opacity, irregular paths,
 * and gradient stacking.
 *
 * @module emptyStateIllustrations
 */

import { colors } from 'public/sharedTokens';

const { sandBase, sandLight, sandDark, espresso, espressoLight, mountainBlue,
  mountainBlueDark, mountainBlueLight, sunsetCoral, sunsetCoralDark,
  sunsetCoralLight, offWhite, skyGradientTop, skyGradientBottom, success, white } = colors;

/**
 * Convert an SVG string to a data URI for use as Wix image src.
 * @param {string} svgString - Raw SVG markup
 * @returns {string} Data URI string, or empty string for falsy input
 */
export function svgToDataUri(svgString) {
  if (!svgString) return '';
  return 'data:image/svg+xml,' + encodeURIComponent(svgString);
}

/**
 * Map of empty state keys to inline SVG strings.
 * Each SVG uses brand tokens, gradients, atmospheric layers,
 * and viewBox for responsive sizing.
 */
export const ILLUSTRATION_SVGS = {
  // Mountain trail at sunrise — warm coral/sand sky with winding path
  cart: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 200" width="100%" height="100%" role="img" aria-labelledby="title-cart">
  <title id="title-cart">Empty cart — a winding mountain trail at sunrise through Blue Ridge foothills</title>
  <defs>
    <linearGradient id="cart-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${sunsetCoral}" stop-opacity="0.35"/>
      <stop offset="18%" stop-color="${sunsetCoralLight}" stop-opacity="0.45"/>
      <stop offset="35%" stop-color="${skyGradientBottom}" stop-opacity="0.5"/>
      <stop offset="55%" stop-color="${sandLight}" stop-opacity="0.6"/>
      <stop offset="75%" stop-color="${skyGradientTop}" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="${offWhite}"/>
    </linearGradient>
  </defs>
  <g id="background">
    <rect width="280" height="200" fill="url(#cart-sky)"/>
    <circle cx="225" cy="42" r="20" fill="${sunsetCoralLight}" opacity="0.5"/>
    <circle cx="225" cy="42" r="13" fill="${skyGradientBottom}" opacity="0.4"/>
    <ellipse cx="55" cy="48" rx="38" ry="11" fill="${offWhite}" opacity="0.4"/>
    <ellipse cx="78" cy="45" rx="24" ry="8" fill="${white}" opacity="0.3"/>
    <ellipse cx="170" cy="32" rx="20" ry="6" fill="${offWhite}" opacity="0.3"/>
    <line x1="95" y1="30" x2="101" y2="24" stroke="${espresso}" stroke-width="0.9" opacity="0.22"/>
    <line x1="101" y1="24" x2="107" y2="30" stroke="${espresso}" stroke-width="0.9" opacity="0.22"/>
    <line x1="145" y1="22" x2="150" y2="17" stroke="${espresso}" stroke-width="0.7" opacity="0.18"/>
    <line x1="150" y1="17" x2="155" y2="22" stroke="${espresso}" stroke-width="0.7" opacity="0.18"/>
  </g>
  <g id="midground">
    <path d="M0 138 Q12 118 28 112 Q42 106 58 114 Q78 95 100 92 Q118 88 138 100 Q158 86 178 90 Q200 84 222 96 Q248 88 268 94 L280 98 L280 158 L0 158Z" fill="${mountainBlueDark}" opacity="0.2"/>
    <path d="M0 148 Q18 132 38 128 Q56 122 76 132 Q98 114 122 112 Q142 108 162 120 Q182 106 202 112 Q222 104 244 114 Q262 108 280 116 L280 168 L0 168Z" fill="${mountainBlue}" opacity="0.28"/>
    <path d="M0 156 Q22 144 45 140 Q68 136 88 144 Q108 130 132 128 Q152 125 172 135 Q192 124 212 128 Q234 122 256 130 Q270 126 280 132 L280 178 L0 178Z" fill="${mountainBlueLight}" opacity="0.22"/>
    <path d="M42 158 L47 138 Q50 130 53 138 L57 158Z" fill="${success}" opacity="0.4"/>
    <path d="M35 142 Q50 126 65 142" fill="${success}" opacity="0.2"/>
    <path d="M232 155 L236 136 Q239 128 242 136 L246 155Z" fill="${success}" opacity="0.35"/>
    <path d="M225 140 Q239 124 253 140" fill="${success}" opacity="0.18"/>
    <path d="M185 158 L188 144 Q190 138 192 144 L195 158Z" fill="${success}" opacity="0.3"/>
  </g>
  <g id="foreground">
    <path d="M0 168 Q28 162 56 164 Q84 160 112 163 Q140 158 168 162 Q196 157 224 161 Q252 156 280 162 L280 200 L0 200Z" fill="${sandDark}" opacity="0.45"/>
    <path d="M105 200 Q114 178 124 170 Q132 163 140 163 Q148 163 156 170 Q166 178 175 200" fill="${espressoLight}" opacity="0.35" stroke="${espresso}" stroke-width="0.5" opacity="0.3"/>
    <circle cx="120" cy="176" r="2.2" fill="${sunsetCoral}" opacity="0.5"/>
    <circle cx="160" cy="174" r="1.8" fill="${sunsetCoralLight}" opacity="0.4"/>
    <circle cx="85" cy="180" r="1.5" fill="${mountainBlueLight}" opacity="0.35"/>
    <circle cx="200" cy="178" r="2" fill="${sunsetCoral}" opacity="0.4"/>
    <path d="M118 184 L120 173 L122 184" stroke="${success}" stroke-width="0.8" fill="none" opacity="0.45"/>
    <path d="M158 182 L160 172 L162 182" stroke="${success}" stroke-width="0.7" fill="none" opacity="0.4"/>
    <path d="M83 188 L85 178 L87 188" stroke="${success}" stroke-width="0.7" fill="none" opacity="0.35"/>
    <path d="M0 186 Q35 181 70 183 Q105 179 140 182 Q175 177 210 181 Q245 177 280 182 L280 200 L0 200Z" fill="${sandBase}" opacity="0.3"/>
  </g>
</svg>`,

  // Misty mountain — cool blue peaks with fog layers
  search: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 200" width="100%" height="100%" role="img" aria-labelledby="title-search">
  <title id="title-search">No results — misty Blue Ridge peaks fading into fog layers</title>
  <defs>
    <linearGradient id="search-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${skyGradientTop}"/>
      <stop offset="18%" stop-color="${mountainBlueLight}" stop-opacity="0.55"/>
      <stop offset="38%" stop-color="${mountainBlue}" stop-opacity="0.25"/>
      <stop offset="55%" stop-color="${sandLight}" stop-opacity="0.45"/>
      <stop offset="78%" stop-color="${offWhite}" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="${offWhite}"/>
    </linearGradient>
    <linearGradient id="search-mist" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${offWhite}" stop-opacity="0"/>
      <stop offset="35%" stop-color="${offWhite}" stop-opacity="0.65"/>
      <stop offset="65%" stop-color="${offWhite}" stop-opacity="0.65"/>
      <stop offset="100%" stop-color="${offWhite}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <g id="background">
    <rect width="280" height="200" fill="url(#search-sky)"/>
    <ellipse cx="195" cy="38" rx="42" ry="13" fill="${offWhite}" opacity="0.42"/>
    <ellipse cx="218" cy="35" rx="28" ry="9" fill="${white}" opacity="0.28"/>
    <ellipse cx="60" cy="44" rx="25" ry="8" fill="${offWhite}" opacity="0.3"/>
    <line x1="55" y1="26" x2="61" y2="20" stroke="${espresso}" stroke-width="0.9" opacity="0.18"/>
    <line x1="61" y1="20" x2="67" y2="26" stroke="${espresso}" stroke-width="0.9" opacity="0.18"/>
    <line x1="145" y1="18" x2="150" y2="13" stroke="${espresso}" stroke-width="0.7" opacity="0.16"/>
    <line x1="150" y1="13" x2="155" y2="18" stroke="${espresso}" stroke-width="0.7" opacity="0.16"/>
    <line x1="240" y1="24" x2="244" y2="20" stroke="${espresso}" stroke-width="0.7" opacity="0.15"/>
    <line x1="244" y1="20" x2="248" y2="24" stroke="${espresso}" stroke-width="0.7" opacity="0.15"/>
  </g>
  <g id="midground">
    <path d="M0 108 Q15 78 32 72 Q48 65 68 82 Q92 52 120 48 Q145 44 168 62 Q188 48 208 52 Q232 56 255 68 Q268 62 280 72 L280 148 L0 148Z" fill="${mountainBlueDark}" opacity="0.18"/>
    <rect y="95" width="280" height="22" fill="url(#search-mist)"/>
    <ellipse cx="75" cy="100" rx="48" ry="9" fill="${offWhite}" opacity="0.5"/>
    <path d="M0 128 Q16 108 34 104 Q52 98 72 112 Q96 84 125 80 Q148 76 172 92 Q192 78 212 82 Q235 86 255 96 Q268 90 280 98 L280 165 L0 165Z" fill="${mountainBlue}" opacity="0.25"/>
    <rect y="118" width="280" height="18" fill="url(#search-mist)" opacity="0.6"/>
    <ellipse cx="200" cy="125" rx="40" ry="8" fill="${offWhite}" opacity="0.45"/>
    <path d="M0 145 Q20 132 42 128 Q62 122 82 134 Q108 112 138 108 Q162 104 186 118 Q208 106 228 110 Q252 114 280 124 L280 178 L0 178Z" fill="${mountainBlueLight}" opacity="0.22"/>
    <ellipse cx="130" cy="140" rx="35" ry="7" fill="${offWhite}" opacity="0.38"/>
  </g>
  <g id="foreground">
    <path d="M0 162 Q35 155 70 158 Q105 152 140 156 Q175 150 210 154 Q245 148 280 155 L280 200 L0 200Z" fill="${sandLight}" opacity="0.45"/>
    <circle cx="95" cy="170" r="2" fill="${sunsetCoral}" opacity="0.4"/>
    <path d="M93 178 L95 168 L97 178" stroke="${success}" stroke-width="0.8" fill="none" opacity="0.35"/>
    <circle cx="185" cy="168" r="1.8" fill="${mountainBlueLight}" opacity="0.38"/>
    <circle cx="55" cy="174" r="1.5" fill="${sunsetCoralLight}" opacity="0.32"/>
    <circle cx="230" cy="172" r="1.6" fill="${sunsetCoral}" opacity="0.3"/>
    <path d="M0 182 Q35 177 70 180 Q105 175 140 178 Q175 173 210 177 Q245 173 280 178 L280 200 L0 200Z" fill="${sandBase}" opacity="0.3"/>
  </g>
</svg>`,

  // Mountain cabin — cozy cabin among trees
  wishlist: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 200" width="100%" height="100%" role="img" aria-labelledby="title-wishlist">
  <title id="title-wishlist">Empty wishlist — a cozy mountain cabin nestled among Blue Ridge pines</title>
  <defs>
    <linearGradient id="wish-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${skyGradientTop}" stop-opacity="0.45"/>
      <stop offset="18%" stop-color="${mountainBlueLight}" stop-opacity="0.35"/>
      <stop offset="38%" stop-color="${sandLight}" stop-opacity="0.55"/>
      <stop offset="58%" stop-color="${sandBase}" stop-opacity="0.45"/>
      <stop offset="78%" stop-color="${skyGradientBottom}" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="${sandLight}"/>
    </linearGradient>
  </defs>
  <g id="background">
    <rect width="280" height="200" fill="url(#wish-sky)"/>
    <ellipse cx="205" cy="34" rx="32" ry="10" fill="${offWhite}" opacity="0.38"/>
    <ellipse cx="222" cy="31" rx="20" ry="7" fill="${white}" opacity="0.28"/>
    <ellipse cx="65" cy="40" rx="22" ry="7" fill="${offWhite}" opacity="0.3"/>
    <line x1="45" y1="24" x2="50" y2="19" stroke="${espresso}" stroke-width="0.8" opacity="0.18"/>
    <line x1="50" y1="19" x2="55" y2="24" stroke="${espresso}" stroke-width="0.8" opacity="0.18"/>
    <line x1="165" y1="16" x2="169" y2="12" stroke="${espresso}" stroke-width="0.7" opacity="0.16"/>
    <line x1="169" y1="12" x2="173" y2="16" stroke="${espresso}" stroke-width="0.7" opacity="0.16"/>
  </g>
  <g id="midground">
    <path d="M0 132 Q18 108 38 102 Q56 96 78 110 Q102 82 128 78 Q152 74 176 92 Q198 78 220 82 Q244 86 264 96 L280 102 L280 165 L0 165Z" fill="${mountainBlue}" opacity="0.22"/>
    <path d="M0 148 Q22 128 46 122 Q68 116 90 130 Q112 104 138 100 Q162 96 186 112 Q208 98 230 102 Q252 106 280 118 L280 178 L0 178Z" fill="${mountainBlueLight}" opacity="0.18"/>
    <path d="M50 160 L55 128 Q59 112 63 128 L67 160Z" fill="${success}" opacity="0.4"/>
    <path d="M42 138 Q59 116 76 138" fill="${success}" opacity="0.22"/>
    <path d="M62 142 Q59 134 56 142" fill="${success}" opacity="0.15"/>
    <path d="M198 158 L203 122 Q207 106 211 122 L215 158Z" fill="${success}" opacity="0.38"/>
    <path d="M190 132 Q207 110 224 132" fill="${success}" opacity="0.2"/>
    <path d="M236 160 L240 132 Q243 120 246 132 L250 160Z" fill="${success}" opacity="0.32"/>
    <path d="M229 138 Q243 122 257 138" fill="${success}" opacity="0.18"/>
    <path d="M85 162 L89 140 Q92 132 95 140 L99 162Z" fill="${success}" opacity="0.3"/>
  </g>
  <g id="foreground">
    <path d="M0 162 Q35 155 70 158 Q105 152 140 156 Q175 150 210 154 Q245 148 280 155 L280 200 L0 200Z" fill="${sandDark}" opacity="0.38"/>
    <polygon points="140,86 108,124 172,124" fill="${espresso}" opacity="0.72"/>
    <polygon points="140,80 102,120 178,120" fill="none" stroke="${espresso}" stroke-width="1" opacity="0.3"/>
    <rect x="120" y="124" width="40" height="32" fill="${espressoLight}" opacity="0.85"/>
    <rect x="132" y="134" width="16" height="22" fill="${sandBase}" opacity="0.9"/>
    <rect x="125" y="128" width="8" height="8" fill="${skyGradientTop}" opacity="0.4"/>
    <rect x="147" y="128" width="8" height="8" fill="${skyGradientTop}" opacity="0.4"/>
    <circle cx="157" cy="114" r="2.8" fill="${sunsetCoral}" opacity="0.55"/>
    <path d="M148 90 Q145 86 148 82 Q146 78 148 75" stroke="${espressoLight}" stroke-width="0.8" fill="none" opacity="0.28"/>
    <path d="M151 92 Q149 88 151 85" stroke="${espressoLight}" stroke-width="0.6" fill="none" opacity="0.22"/>
    <circle cx="90" cy="172" r="1.8" fill="${sunsetCoralLight}" opacity="0.4"/>
    <circle cx="180" cy="170" r="2" fill="${mountainBlueLight}" opacity="0.38"/>
    <circle cx="225" cy="174" r="1.5" fill="${sunsetCoral}" opacity="0.35"/>
    <path d="M88 180 L90 170 L92 180" stroke="${success}" stroke-width="0.7" fill="none" opacity="0.35"/>
    <path d="M0 182 Q35 177 70 179 Q105 175 140 178 Q175 173 210 176 Q245 172 280 177 L280 200 L0 200Z" fill="${sandBase}" opacity="0.3"/>
  </g>
</svg>`,

  // Mountain sunset — warm glow behind peaks
  reviews: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 200" width="100%" height="100%" role="img" aria-labelledby="title-reviews">
  <title id="title-reviews">No reviews yet — a warm mountain sunset glowing behind Blue Ridge peaks</title>
  <defs>
    <linearGradient id="rev-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${mountainBlue}" stop-opacity="0.28"/>
      <stop offset="15%" stop-color="${mountainBlueLight}" stop-opacity="0.25"/>
      <stop offset="32%" stop-color="${sunsetCoralLight}" stop-opacity="0.38"/>
      <stop offset="50%" stop-color="${sunsetCoral}" stop-opacity="0.32"/>
      <stop offset="68%" stop-color="${skyGradientBottom}" stop-opacity="0.5"/>
      <stop offset="85%" stop-color="${sandBase}" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="${sandBase}"/>
    </linearGradient>
    <radialGradient id="rev-sun" cx="50%" cy="58%" r="38%">
      <stop offset="0%" stop-color="${skyGradientBottom}" stop-opacity="0.75"/>
      <stop offset="35%" stop-color="${sunsetCoralLight}" stop-opacity="0.45"/>
      <stop offset="65%" stop-color="${sunsetCoral}" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="${sunsetCoralDark}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <g id="background">
    <rect width="280" height="200" fill="url(#rev-sky)"/>
    <circle cx="140" cy="108" r="55" fill="url(#rev-sun)"/>
    <line x1="75" y1="26" x2="81" y2="20" stroke="${espresso}" stroke-width="0.9" opacity="0.18"/>
    <line x1="81" y1="20" x2="87" y2="26" stroke="${espresso}" stroke-width="0.9" opacity="0.18"/>
    <line x1="195" y1="32" x2="200" y2="27" stroke="${espresso}" stroke-width="0.7" opacity="0.16"/>
    <line x1="200" y1="27" x2="205" y2="32" stroke="${espresso}" stroke-width="0.7" opacity="0.16"/>
    <line x1="38" y1="38" x2="42" y2="34" stroke="${espresso}" stroke-width="0.6" opacity="0.14"/>
    <line x1="42" y1="34" x2="46" y2="38" stroke="${espresso}" stroke-width="0.6" opacity="0.14"/>
  </g>
  <g id="midground">
    <path d="M0 118 Q14 88 30 82 Q46 75 64 92 Q86 60 115 55 Q138 50 160 68 Q180 52 200 58 Q224 62 245 72 Q262 66 280 75 L280 155 L0 155Z" fill="${espresso}" opacity="0.2"/>
    <path d="M0 135 Q16 112 35 106 Q52 100 72 115 Q96 82 128 78 Q152 74 176 92 Q196 78 216 82 Q238 86 258 96 Q270 90 280 98 L280 168 L0 168Z" fill="${espressoLight}" opacity="0.25"/>
    <path d="M0 152 Q22 138 46 132 Q68 126 88 140 Q112 118 140 114 Q164 110 188 125 Q208 112 228 116 Q252 120 280 130 L280 182 L0 182Z" fill="${espresso}" opacity="0.15"/>
    <path d="M58 162 L62 142 Q65 134 68 142 L72 162Z" fill="${success}" opacity="0.28"/>
    <path d="M218 160 L222 140 Q225 132 228 140 L232 160Z" fill="${success}" opacity="0.26"/>
    <path d="M168 164 L171 148 Q173 142 175 148 L178 164Z" fill="${success}" opacity="0.22"/>
  </g>
  <g id="foreground">
    <path d="M0 170 Q35 163 70 166 Q105 160 140 164 Q175 158 210 162 Q245 156 280 163 L280 200 L0 200Z" fill="${sandDark}" opacity="0.45"/>
    <circle cx="115" cy="178" r="2.2" fill="${sunsetCoral}" opacity="0.5"/>
    <path d="M113 186 L115 175 L117 186" stroke="${success}" stroke-width="0.8" fill="none" opacity="0.4"/>
    <circle cx="168" cy="176" r="1.8" fill="${mountainBlueLight}" opacity="0.38"/>
    <circle cx="48" cy="180" r="1.6" fill="${sunsetCoralLight}" opacity="0.35"/>
    <circle cx="235" cy="178" r="2" fill="${sunsetCoral}" opacity="0.4"/>
    <path d="M233 186 L235 176 L237 186" stroke="${success}" stroke-width="0.7" fill="none" opacity="0.35"/>
    <path d="M0 188 Q35 183 70 185 Q105 181 140 184 Q175 179 210 183 Q245 179 280 184 L280 200 L0 200Z" fill="${sandBase}" opacity="0.3"/>
  </g>
</svg>`,

  // Forest path — green-blue trees lining a trail
  category: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 200" width="100%" height="100%" role="img" aria-labelledby="title-category">
  <title id="title-category">Empty category — a forest trail lined with Blue Ridge pines</title>
  <defs>
    <linearGradient id="cat-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${skyGradientTop}" stop-opacity="0.38"/>
      <stop offset="18%" stop-color="${mountainBlueLight}" stop-opacity="0.28"/>
      <stop offset="38%" stop-color="${sandLight}" stop-opacity="0.48"/>
      <stop offset="58%" stop-color="${sandBase}" stop-opacity="0.38"/>
      <stop offset="78%" stop-color="${skyGradientBottom}" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="${sandLight}"/>
    </linearGradient>
  </defs>
  <g id="background">
    <rect width="280" height="200" fill="url(#cat-sky)"/>
    <ellipse cx="175" cy="28" rx="36" ry="11" fill="${offWhite}" opacity="0.38"/>
    <ellipse cx="192" cy="26" rx="22" ry="7" fill="${white}" opacity="0.28"/>
    <line x1="45" y1="20" x2="50" y2="15" stroke="${espresso}" stroke-width="0.8" opacity="0.18"/>
    <line x1="50" y1="15" x2="55" y2="20" stroke="${espresso}" stroke-width="0.8" opacity="0.18"/>
    <line x1="242" y1="16" x2="246" y2="12" stroke="${espresso}" stroke-width="0.7" opacity="0.16"/>
    <line x1="246" y1="12" x2="250" y2="16" stroke="${espresso}" stroke-width="0.7" opacity="0.16"/>
  </g>
  <g id="midground">
    <path d="M0 140 Q22 128 48 122 Q72 116 96 128 Q118 108 142 104 Q166 100 190 114 Q212 102 234 108 Q258 102 280 112 L280 168 L0 168Z" fill="${mountainBlue}" opacity="0.22"/>
    <path d="M22 160 L28 108 Q34 82 40 108 L45 160Z" fill="${mountainBlueDark}" opacity="0.52"/>
    <path d="M14 120 Q34 96 54 120" fill="${success}" opacity="0.28"/>
    <path d="M18 132 Q34 114 50 132" fill="${success}" opacity="0.18"/>
    <path d="M65 158 L70 118 Q76 94 82 118 L86 158Z" fill="${mountainBlueDark}" opacity="0.48"/>
    <path d="M56 128 Q76 104 96 128" fill="${success}" opacity="0.25"/>
    <path d="M60 140 Q76 122 92 140" fill="${success}" opacity="0.16"/>
    <path d="M190 158 L195 112 Q200 88 205 112 L210 158Z" fill="${mountainBlueDark}" opacity="0.52"/>
    <path d="M182 124 Q200 98 218 124" fill="${success}" opacity="0.28"/>
    <path d="M186 136 Q200 118 214 136" fill="${success}" opacity="0.18"/>
    <path d="M235 160 L239 122 Q243 108 247 122 L251 160Z" fill="${mountainBlueDark}" opacity="0.46"/>
    <path d="M228 132 Q243 112 258 132" fill="${success}" opacity="0.22"/>
  </g>
  <g id="foreground">
    <path d="M0 164 Q35 157 70 160 Q105 154 140 158 Q175 152 210 156 Q245 150 280 157 L280 200 L0 200Z" fill="${sandDark}" opacity="0.4"/>
    <path d="M106 200 Q118 166 130 158 Q140 152 150 158 Q162 166 174 200" fill="${sandBase}" opacity="0.42" stroke="${espressoLight}" stroke-width="0.5"/>
    <circle cx="132" cy="168" r="2.2" fill="${sunsetCoral}" opacity="0.48"/>
    <path d="M130 176 L132 165 L134 176" stroke="${success}" stroke-width="0.8" fill="none" opacity="0.4"/>
    <circle cx="118" cy="174" r="1.5" fill="${sunsetCoralLight}" opacity="0.35"/>
    <circle cx="158" cy="172" r="1.8" fill="${mountainBlueLight}" opacity="0.35"/>
    <circle cx="80" cy="178" r="1.4" fill="${sunsetCoral}" opacity="0.3"/>
    <path d="M0 184 Q35 179 70 181 Q105 177 140 180 Q175 175 210 179 Q245 175 280 180 L280 200 L0 200Z" fill="${sandBase}" opacity="0.3"/>
  </g>
</svg>`,

  // Storm clouds over ridge — dark, moody scene
  error: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 200" width="100%" height="100%" role="img" aria-labelledby="title-error">
  <title id="title-error">Error — storm clouds gathering over a dark Blue Ridge ridgeline</title>
  <defs>
    <linearGradient id="err-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${espresso}" stop-opacity="0.38"/>
      <stop offset="18%" stop-color="${espressoLight}" stop-opacity="0.32"/>
      <stop offset="38%" stop-color="${mountainBlueDark}" stop-opacity="0.28"/>
      <stop offset="58%" stop-color="${mountainBlue}" stop-opacity="0.18"/>
      <stop offset="78%" stop-color="${sandDark}" stop-opacity="0.38"/>
      <stop offset="100%" stop-color="${sandDark}" stop-opacity="0.45"/>
    </linearGradient>
    <radialGradient id="err-glow" cx="50%" cy="38%">
      <stop offset="0%" stop-color="${sunsetCoral}" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="${sunsetCoral}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <g id="background">
    <rect width="280" height="200" fill="url(#err-sky)"/>
    <ellipse cx="75" cy="40" rx="58" ry="22" fill="${espressoLight}" opacity="0.48"/>
    <ellipse cx="115" cy="36" rx="48" ry="18" fill="${espresso}" opacity="0.38"/>
    <ellipse cx="175" cy="45" rx="52" ry="18" fill="${espressoLight}" opacity="0.4"/>
    <ellipse cx="155" cy="32" rx="42" ry="15" fill="${espresso}" opacity="0.32"/>
    <ellipse cx="230" cy="38" rx="30" ry="12" fill="${espressoLight}" opacity="0.3"/>
    <line x1="28" y1="22" x2="33" y2="17" stroke="${espresso}" stroke-width="0.8" opacity="0.18"/>
    <line x1="33" y1="17" x2="38" y2="22" stroke="${espresso}" stroke-width="0.8" opacity="0.18"/>
    <line x1="250" y1="20" x2="254" y2="16" stroke="${espresso}" stroke-width="0.7" opacity="0.16"/>
    <line x1="254" y1="16" x2="258" y2="20" stroke="${espresso}" stroke-width="0.7" opacity="0.16"/>
  </g>
  <g id="midground">
    <circle cx="140" cy="68" r="22" fill="url(#err-glow)"/>
    <path d="M138 56 L141 72 L135 72 L139 88" stroke="${sunsetCoral}" stroke-width="1.5" fill="none" opacity="0.55"/>
    <path d="M0 125 Q16 102 34 98 Q52 92 72 106 Q92 78 112 74 Q132 68 152 80 Q172 88 192 98 Q214 86 236 92 Q258 96 280 106 L280 165 L0 165Z" fill="${espresso}" opacity="0.22"/>
    <path d="M0 145 Q22 128 46 124 Q68 118 88 132 Q112 108 138 104 Q162 100 186 115 Q208 102 228 106 Q252 110 280 120 L280 180 L0 180Z" fill="${espressoLight}" opacity="0.28"/>
    <path d="M0 158 Q26 145 52 140 Q78 135 102 148 Q122 130 148 126 Q172 122 196 136 Q218 124 238 128 Q260 132 280 142 L280 190 L0 190Z" fill="${espresso}" opacity="0.15"/>
    <path d="M48 166 L52 148 Q55 140 58 148 L62 166Z" fill="${mountainBlueDark}" opacity="0.32"/>
    <path d="M215 164 L219 146 Q222 138 225 146 L229 164Z" fill="${mountainBlueDark}" opacity="0.28"/>
    <path d="M145 168 L148 152 Q150 146 152 152 L155 168Z" fill="${mountainBlueDark}" opacity="0.25"/>
  </g>
  <g id="foreground">
    <path d="M0 172 Q35 165 70 168 Q105 162 140 166 Q175 160 210 164 Q245 158 280 165 L280 200 L0 200Z" fill="${sandDark}" opacity="0.4"/>
    <circle cx="95" cy="180" r="1.8" fill="${sunsetCoralLight}" opacity="0.32"/>
    <circle cx="190" cy="178" r="2" fill="${mountainBlueLight}" opacity="0.28"/>
    <circle cx="55" cy="182" r="1.4" fill="${sunsetCoral}" opacity="0.25"/>
    <path d="M0 186 Q35 181 70 184 Q105 179 140 182 Q175 177 210 181 Q245 177 280 182 L280 200 L0 200Z" fill="${espressoLight}" opacity="0.28"/>
  </g>
</svg>`,

  // Fog in valley — serene, mysterious mist
  notFound: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 200" width="100%" height="100%" role="img" aria-labelledby="title-notfound">
  <title id="title-notfound">Page not found — fog filling a quiet Blue Ridge valley</title>
  <defs>
    <linearGradient id="nf-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${mountainBlueLight}" stop-opacity="0.38"/>
      <stop offset="18%" stop-color="${skyGradientTop}" stop-opacity="0.28"/>
      <stop offset="38%" stop-color="${mountainBlue}" stop-opacity="0.18"/>
      <stop offset="55%" stop-color="${sandLight}" stop-opacity="0.38"/>
      <stop offset="78%" stop-color="${offWhite}" stop-opacity="0.78"/>
      <stop offset="100%" stop-color="${offWhite}"/>
    </linearGradient>
    <linearGradient id="nf-fog" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${offWhite}" stop-opacity="0"/>
      <stop offset="28%" stop-color="${offWhite}" stop-opacity="0.75"/>
      <stop offset="72%" stop-color="${offWhite}" stop-opacity="0.75"/>
      <stop offset="100%" stop-color="${offWhite}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <g id="background">
    <rect width="280" height="200" fill="url(#nf-sky)"/>
    <ellipse cx="65" cy="34" rx="32" ry="10" fill="${offWhite}" opacity="0.38"/>
    <ellipse cx="215" cy="28" rx="36" ry="10" fill="${offWhite}" opacity="0.32"/>
    <ellipse cx="145" cy="38" rx="20" ry="6" fill="${white}" opacity="0.25"/>
    <line x1="125" y1="18" x2="130" y2="13" stroke="${espresso}" stroke-width="0.8" opacity="0.18"/>
    <line x1="130" y1="13" x2="135" y2="18" stroke="${espresso}" stroke-width="0.8" opacity="0.18"/>
  </g>
  <g id="midground">
    <path d="M0 96 Q14 72 30 68 Q46 62 64 76 Q82 48 105 44 Q125 40 145 52 Q165 55 185 68 Q208 52 230 56 Q255 60 280 74 L280 148 L0 148Z" fill="${mountainBlue}" opacity="0.16"/>
    <rect y="85" width="280" height="28" fill="url(#nf-fog)"/>
    <ellipse cx="85" cy="96" rx="52" ry="10" fill="${offWhite}" opacity="0.52"/>
    <ellipse cx="200" cy="92" rx="38" ry="8" fill="${offWhite}" opacity="0.42"/>
    <path d="M0 124 Q18 108 38 104 Q58 98 78 110 Q98 86 120 82 Q140 78 162 90 Q182 84 202 88 Q225 92 248 102 Q265 98 280 105 L280 162 L0 162Z" fill="${mountainBlueDark}" opacity="0.14"/>
    <rect y="115" width="280" height="22" fill="url(#nf-fog)" opacity="0.65"/>
    <ellipse cx="150" cy="125" rx="45" ry="9" fill="${offWhite}" opacity="0.48"/>
    <path d="M0 148 Q24 136 48 132 Q72 126 96 138 Q118 118 142 114 Q166 110 190 125 Q212 114 234 118 Q258 122 280 132 L280 175 L0 175Z" fill="${mountainBlueLight}" opacity="0.14"/>
    <ellipse cx="70" cy="142" rx="32" ry="7" fill="${offWhite}" opacity="0.4"/>
  </g>
  <g id="foreground">
    <path d="M0 164 Q35 157 70 160 Q105 154 140 158 Q175 152 210 156 Q245 150 280 157 L280 200 L0 200Z" fill="${sandLight}" opacity="0.42"/>
    <circle cx="108" cy="172" r="1.8" fill="${sunsetCoralLight}" opacity="0.32"/>
    <circle cx="175" cy="170" r="2" fill="${mountainBlueLight}" opacity="0.32"/>
    <path d="M173 178 L175 168 L177 178" stroke="${success}" stroke-width="0.8" fill="none" opacity="0.3"/>
    <circle cx="55" cy="175" r="1.4" fill="${sunsetCoral}" opacity="0.28"/>
    <circle cx="230" cy="174" r="1.6" fill="${sunsetCoralLight}" opacity="0.28"/>
    <path d="M0 182 Q35 177 70 179 Q105 175 140 178 Q175 173 210 176 Q245 173 280 178 L280 200 L0 200Z" fill="${sandBase}" opacity="0.3"/>
  </g>
</svg>`,

  // Mountain stream — gentle water flowing between rocks
  sideCart: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 200" width="100%" height="100%" role="img" aria-labelledby="title-sidecart">
  <title id="title-sidecart">Empty side cart — a gentle mountain stream winding through Blue Ridge rocks</title>
  <defs>
    <linearGradient id="sc-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${skyGradientTop}" stop-opacity="0.28"/>
      <stop offset="18%" stop-color="${mountainBlueLight}" stop-opacity="0.25"/>
      <stop offset="38%" stop-color="${sandLight}" stop-opacity="0.45"/>
      <stop offset="58%" stop-color="${sandBase}" stop-opacity="0.38"/>
      <stop offset="78%" stop-color="${skyGradientBottom}" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="${sandLight}"/>
    </linearGradient>
    <linearGradient id="sc-water" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${mountainBlueLight}" stop-opacity="0.55"/>
      <stop offset="50%" stop-color="${mountainBlue}" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="${skyGradientTop}" stop-opacity="0.35"/>
    </linearGradient>
  </defs>
  <g id="background">
    <rect width="280" height="200" fill="url(#sc-sky)"/>
    <ellipse cx="65" cy="34" rx="32" ry="10" fill="${offWhite}" opacity="0.38"/>
    <ellipse cx="82" cy="31" rx="20" ry="7" fill="${white}" opacity="0.28"/>
    <ellipse cx="200" cy="28" rx="24" ry="7" fill="${offWhite}" opacity="0.3"/>
    <line x1="175" y1="20" x2="180" y2="15" stroke="${espresso}" stroke-width="0.8" opacity="0.18"/>
    <line x1="180" y1="15" x2="185" y2="20" stroke="${espresso}" stroke-width="0.8" opacity="0.18"/>
    <line x1="242" y1="26" x2="246" y2="22" stroke="${espresso}" stroke-width="0.7" opacity="0.16"/>
    <line x1="246" y1="22" x2="250" y2="26" stroke="${espresso}" stroke-width="0.7" opacity="0.16"/>
  </g>
  <g id="midground">
    <path d="M0 118 Q22 104 46 98 Q68 92 90 106 Q112 82 138 78 Q162 74 186 90 Q208 78 230 82 Q254 86 280 98 L280 158 L0 158Z" fill="${mountainBlue}" opacity="0.22"/>
    <path d="M0 138 Q22 126 46 120 Q68 114 90 128 Q112 106 138 102 Q162 98 186 114 Q208 102 230 106 Q254 110 280 122 L280 172 L0 172Z" fill="${mountainBlueLight}" opacity="0.18"/>
    <path d="M40 158 L44 136 Q47 128 50 136 L54 158Z" fill="${success}" opacity="0.32"/>
    <path d="M33 140 Q47 124 61 140" fill="${success}" opacity="0.18"/>
    <path d="M220 156 L224 132 Q227 124 230 132 L234 156Z" fill="${success}" opacity="0.28"/>
  </g>
  <g id="foreground">
    <path d="M0 152 Q25 146 50 148 Q72 144 82 150" fill="${sandDark}" opacity="0.35"/>
    <path d="M198 150 Q218 144 242 147 Q265 144 280 150" fill="${sandDark}" opacity="0.35"/>
    <path d="M92 200 Q105 168 118 155 Q130 144 142 144 Q154 144 166 155 Q179 168 192 200" fill="url(#sc-water)"/>
    <path d="M108 162 Q142 152 176 162" fill="none" stroke="${offWhite}" stroke-width="0.8" opacity="0.48"/>
    <path d="M102 175 Q142 165 182 175" fill="none" stroke="${offWhite}" stroke-width="0.6" opacity="0.38"/>
    <path d="M98 188 Q142 178 186 188" fill="none" stroke="${offWhite}" stroke-width="0.5" opacity="0.3"/>
    <ellipse cx="78" cy="162" rx="16" ry="8" fill="${espressoLight}" opacity="0.35"/>
    <ellipse cx="75" cy="160" rx="10" ry="5" fill="${espresso}" opacity="0.2"/>
    <ellipse cx="202" cy="158" rx="14" ry="7" fill="${espressoLight}" opacity="0.3"/>
    <ellipse cx="218" cy="168" rx="10" ry="5" fill="${espresso}" opacity="0.2"/>
    <circle cx="125" cy="158" r="1.8" fill="${offWhite}" opacity="0.52"/>
    <circle cx="155" cy="160" r="1.5" fill="${offWhite}" opacity="0.42"/>
    <circle cx="140" cy="170" r="1.2" fill="${offWhite}" opacity="0.38"/>
    <circle cx="132" cy="178" r="1" fill="${offWhite}" opacity="0.3"/>
    <circle cx="148" cy="182" r="1.1" fill="${offWhite}" opacity="0.28"/>
    <path d="M0 184 Q35 179 70 181 Q105 177 140 180 Q175 175 210 179 Q245 175 280 180 L280 200 L0 200Z" fill="${sandBase}" opacity="0.3"/>
  </g>
</svg>`,
};
