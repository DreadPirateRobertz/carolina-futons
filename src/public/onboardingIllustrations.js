/**
 * Onboarding Inline SVG Illustrations — Dark Theme Mobile Scenes
 *
 * 3 editorial-quality SVG scenes for mobile onboarding on dark espresso bg (#1C1410).
 * Uses feTurbulence/feDisplacementMap for watercolor texture, organic hand-drawn paths,
 * paper grain overlays, and rich multi-stop gradients per the illustration quality bar.
 *
 * @module onboardingIllustrations
 */

import { colors } from 'public/sharedTokens';

const { sandBase, sandLight, sandDark, offWhite, mountainBlue,
  mountainBlueDark, mountainBlueLight, sunsetCoral, sunsetCoralLight,
  sunsetCoralDark, skyGradientTop, skyGradientBottom } = colors;

/**
 * Convert an SVG string to a data URI for use as image src.
 * @param {string} svgString - Raw SVG markup
 * @returns {string} Data URI string, or empty string for falsy input
 */
export function svgToDataUri(svgString) {
  if (!svgString) return '';
  return 'data:image/svg+xml,' + encodeURIComponent(svgString);
}

/**
 * Map of onboarding scene keys to inline SVG strings.
 * Designed for transparent bg over dark container (#1C1410).
 * All colors from sharedTokens — zero hardcoded hex.
 */
export const ONBOARDING_SVGS = {

  // Scene 1 — WELCOME: Futon in styled living room, mountain view through window
  welcome: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240" width="100%" height="100%">
  <defs>
    <filter id="w-watercolor" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" seed="1" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <filter id="w-grain" x="0%" y="0%" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" seed="7" result="grain"/>
      <feColorMatrix type="saturate" values="0" in="grain" result="graygrain"/>
      <feBlend in="SourceGraphic" in2="graygrain" mode="multiply"/>
    </filter>
    <linearGradient id="w-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${skyGradientTop}" stop-opacity="0.6"/>
      <stop offset="25%" stop-color="${mountainBlueLight}" stop-opacity="0.5"/>
      <stop offset="50%" stop-color="${skyGradientBottom}" stop-opacity="0.4"/>
      <stop offset="75%" stop-color="${sunsetCoralLight}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${sandBase}" stop-opacity="0.2"/>
    </linearGradient>
    <radialGradient id="w-glow" cx="50%" cy="30%" r="45%">
      <stop offset="0%" stop-color="${sunsetCoralLight}" stop-opacity="0.5"/>
      <stop offset="50%" stop-color="${skyGradientBottom}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${mountainBlue}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="w-floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${sandDark}" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="${sandBase}" stop-opacity="0.3"/>
    </linearGradient>
  </defs>
  <g filter="url(#w-watercolor)">
    <!-- Window frame -->
    <rect x="95" y="25" width="130" height="100" rx="4" fill="none" stroke="${offWhite}" stroke-width="2.5" opacity="0.7"/>
    <line x1="160" y1="25" x2="160" y2="125" stroke="${offWhite}" stroke-width="1.5" opacity="0.5"/>
    <line x1="95" y1="75" x2="225" y2="75" stroke="${offWhite}" stroke-width="1.5" opacity="0.5"/>
    <!-- Sky through window -->
    <rect x="97" y="27" width="126" height="96" rx="2" fill="url(#w-sky)"/>
    <circle cx="160" cy="55" r="35" fill="url(#w-glow)"/>
    <!-- Mountains through window — organic wobble -->
    <path d="M97 85 Q108 62 118 68 Q125 55 135 60 Q142 48 152 55 Q160 42 170 52 Q178 45 188 56 Q195 50 205 62 Q215 58 223 72 L223 123 L97 123Z" fill="${mountainBlueDark}" opacity="0.5"/>
    <path d="M97 95 Q110 78 122 82 Q132 72 145 78 Q155 68 165 75 Q178 65 190 76 Q200 70 212 80 Q220 76 223 85 L223 123 L97 123Z" fill="${mountainBlue}" opacity="0.45"/>
    <!-- Birds in sky (V shapes) -->
    <path d="M120 42 L123 40 L126 42" fill="none" stroke="${offWhite}" stroke-width="0.8" opacity="0.6"/>
    <path d="M185 38 L187 36 L189 38" fill="none" stroke="${offWhite}" stroke-width="0.6" opacity="0.5"/>
    <path d="M145 35 L147 33 L149 35" fill="none" stroke="${offWhite}" stroke-width="0.5" opacity="0.4"/>
    <!-- Sun/moon glow -->
    <circle cx="175" cy="52" r="8" fill="${skyGradientBottom}" opacity="0.6"/>
    <circle cx="175" cy="52" r="5" fill="${sunsetCoral}" opacity="0.5"/>
    <!-- Floor -->
    <rect x="30" y="160" width="260" height="80" fill="url(#w-floor)"/>
    <!-- Futon — cozy, rounded, warm -->
    <path d="M70 155 Q72 130 90 128 Q120 125 160 125 Q200 125 230 128 Q248 130 250 155 L250 175 Q200 180 160 180 Q120 180 70 175Z" fill="${sunsetCoral}" opacity="0.6"/>
    <path d="M80 138 Q120 132 160 132 Q200 132 240 138" fill="none" stroke="${sunsetCoralLight}" stroke-width="1" opacity="0.5"/>
    <!-- Futon back cushion -->
    <path d="M75 128 Q78 105 95 100 Q130 95 160 95 Q190 95 225 100 Q242 105 245 128" fill="${sunsetCoralDark}" opacity="0.5"/>
    <!-- Pillows -->
    <ellipse cx="105" cy="130" rx="18" ry="10" fill="${sandBase}" opacity="0.6"/>
    <ellipse cx="215" cy="130" rx="18" ry="10" fill="${sandLight}" opacity="0.55"/>
    <!-- Side table -->
    <rect x="255" y="135" width="30" height="35" rx="2" fill="${sandDark}" opacity="0.5"/>
    <!-- Lamp on table -->
    <line x1="270" y1="135" x2="270" y2="115" stroke="${sandBase}" stroke-width="1.5" opacity="0.5"/>
    <path d="M260 115 Q270 105 280 115" fill="${skyGradientBottom}" opacity="0.5"/>
    <circle cx="270" cy="112" r="4" fill="${sunsetCoralLight}" opacity="0.4"/>
    <!-- Rug under futon -->
    <ellipse cx="160" cy="185" rx="85" ry="12" fill="${mountainBlueLight}" opacity="0.25"/>
    <!-- Wildflowers at window base -->
    <circle cx="100" cy="122" r="2" fill="${sunsetCoralLight}" opacity="0.5"/>
    <circle cx="108" cy="120" r="1.5" fill="${sandBase}" opacity="0.4"/>
    <circle cx="218" cy="121" r="2" fill="${sunsetCoralLight}" opacity="0.45"/>
    <!-- Stars visible through top window -->
    <circle cx="110" cy="35" r="1" fill="${offWhite}" opacity="0.6"/>
    <circle cx="200" cy="40" r="1.2" fill="${offWhite}" opacity="0.5"/>
  </g>
  <!-- Paper grain overlay -->
  <rect width="320" height="240" filter="url(#w-grain)" opacity="0.08" fill="${offWhite}"/>
</svg>`,

  // Scene 2 — AR PREVIEW: Person holding phone, furniture ghost appearing in room
  arPreview: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240" width="100%" height="100%">
  <defs>
    <filter id="ar-watercolor" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="4" seed="3" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.5" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <filter id="ar-grain" x="0%" y="0%" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="3" seed="12" result="grain"/>
      <feColorMatrix type="saturate" values="0" in="grain" result="graygrain"/>
      <feBlend in="SourceGraphic" in2="graygrain" mode="multiply"/>
    </filter>
    <linearGradient id="ar-room" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${sandDark}" stop-opacity="0.25"/>
      <stop offset="30%" stop-color="${sandBase}" stop-opacity="0.2"/>
      <stop offset="60%" stop-color="${sandLight}" stop-opacity="0.15"/>
      <stop offset="80%" stop-color="${sandDark}" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="${sandBase}" stop-opacity="0.3"/>
    </linearGradient>
    <linearGradient id="ar-screen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${mountainBlueLight}" stop-opacity="0.4"/>
      <stop offset="40%" stop-color="${skyGradientTop}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${mountainBlue}" stop-opacity="0.2"/>
    </linearGradient>
    <radialGradient id="ar-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${sunsetCoralLight}" stop-opacity="0.35"/>
      <stop offset="60%" stop-color="${sunsetCoral}" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="${mountainBlue}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="ar-ghost" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${mountainBlueLight}" stop-opacity="0.4"/>
      <stop offset="50%" stop-color="${skyGradientTop}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${mountainBlue}" stop-opacity="0.15"/>
    </linearGradient>
  </defs>
  <g filter="url(#ar-watercolor)">
    <!-- Room walls — perspective lines -->
    <rect x="10" y="10" width="300" height="220" fill="url(#ar-room)" rx="3"/>
    <path d="M10 10 L80 50" stroke="${sandDark}" stroke-width="0.8" opacity="0.3"/>
    <path d="M310 10 L240 50" stroke="${sandDark}" stroke-width="0.8" opacity="0.3"/>
    <!-- Floor plane -->
    <path d="M30 160 L290 160 L310 230 L10 230Z" fill="${sandDark}" opacity="0.2"/>
    <line x1="80" y1="160" x2="60" y2="230" stroke="${sandBase}" stroke-width="0.5" opacity="0.15"/>
    <line x1="160" y1="160" x2="160" y2="230" stroke="${sandBase}" stroke-width="0.5" opacity="0.15"/>
    <line x1="240" y1="160" x2="260" y2="230" stroke="${sandBase}" stroke-width="0.5" opacity="0.15"/>
    <!-- Window on wall -->
    <rect x="185" y="40" width="60" height="50" rx="2" fill="${skyGradientTop}" opacity="0.25"/>
    <line x1="215" y1="40" x2="215" y2="90" stroke="${offWhite}" stroke-width="0.8" opacity="0.3"/>
    <line x1="185" y1="65" x2="245" y2="65" stroke="${offWhite}" stroke-width="0.8" opacity="0.3"/>
    <!-- Ghost futon (AR projection) — dashed/translucent -->
    <ellipse cx="200" cy="170" rx="55" ry="8" fill="${mountainBlueLight}" opacity="0.15"/>
    <path d="M150 155 Q152 138 168 135 Q184 132 200 132 Q216 132 232 135 Q248 138 250 155 L250 168 Q225 172 200 172 Q175 172 150 168Z" fill="url(#ar-ghost)" stroke="${mountainBlueLight}" stroke-width="1" stroke-dasharray="4 3" opacity="0.6"/>
    <path d="M155 140 Q180 135 200 135 Q220 135 245 140" fill="none" stroke="${skyGradientTop}" stroke-width="0.8" stroke-dasharray="3 2" opacity="0.4"/>
    <!-- AR projection glow -->
    <circle cx="200" cy="150" r="40" fill="url(#ar-glow)"/>
    <!-- AR scan lines -->
    <line x1="155" y1="130" x2="245" y2="130" stroke="${mountainBlueLight}" stroke-width="0.5" stroke-dasharray="2 4" opacity="0.3"/>
    <line x1="150" y1="145" x2="250" y2="145" stroke="${mountainBlueLight}" stroke-width="0.5" stroke-dasharray="2 4" opacity="0.25"/>
    <!-- Hand holding phone -->
    <path d="M85 220 Q82 195 85 175 Q88 165 95 162 Q100 160 105 162 Q110 165 112 175 Q115 195 112 220" fill="${sandBase}" opacity="0.5"/>
    <!-- Phone body -->
    <rect x="72" y="85" width="50" height="95" rx="6" fill="${sandDark}" opacity="0.55" stroke="${offWhite}" stroke-width="1.2"/>
    <!-- Phone screen -->
    <rect x="76" y="92" width="42" height="78" rx="3" fill="url(#ar-screen)"/>
    <!-- Camera lens indicator -->
    <circle cx="97" cy="88" r="2" fill="${offWhite}" opacity="0.4"/>
    <!-- On-screen futon preview (tiny) -->
    <path d="M82 145 Q84 138 90 137 Q97 136 104 137 Q110 138 112 145 L112 150 Q97 152 82 150Z" fill="${sunsetCoralLight}" opacity="0.5"/>
    <!-- AR targeting corners on phone screen -->
    <path d="M80 96 L80 102 L86 102" fill="none" stroke="${sunsetCoral}" stroke-width="1" opacity="0.6"/>
    <path d="M114 96 L114 102 L108 102" fill="none" stroke="${sunsetCoral}" stroke-width="1" opacity="0.6"/>
    <path d="M80 166 L80 160 L86 160" fill="none" stroke="${sunsetCoral}" stroke-width="1" opacity="0.6"/>
    <path d="M114 166 L114 160 L108 160" fill="none" stroke="${sunsetCoral}" stroke-width="1" opacity="0.6"/>
    <!-- Decorative: small plant in corner -->
    <line x1="275" y1="160" x2="275" y2="140" stroke="${sandDark}" stroke-width="1.5" opacity="0.4"/>
    <ellipse cx="275" cy="138" rx="8" ry="5" fill="${mountainBlueLight}" opacity="0.3"/>
    <ellipse cx="275" cy="135" rx="6" ry="4" fill="${mountainBlue}" opacity="0.25"/>
    <!-- Signal waves from phone -->
    <path d="M122 120 Q130 115 130 130" fill="none" stroke="${sunsetCoralLight}" stroke-width="0.8" opacity="0.35"/>
    <path d="M128 115 Q138 108 138 135" fill="none" stroke="${sunsetCoralLight}" stroke-width="0.6" opacity="0.25"/>
  </g>
  <!-- Paper grain overlay -->
  <rect width="320" height="240" filter="url(#ar-grain)" opacity="0.08" fill="${offWhite}"/>
</svg>`,

  // Scene 3 — SHOP WITH CONFIDENCE: Delivery truck arriving, mountain backdrop
  shopWithConfidence: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240" width="100%" height="100%">
  <defs>
    <filter id="sc-watercolor" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" seed="5" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <filter id="sc-grain" x="0%" y="0%" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="3" seed="19" result="grain"/>
      <feColorMatrix type="saturate" values="0" in="grain" result="graygrain"/>
      <feBlend in="SourceGraphic" in2="graygrain" mode="multiply"/>
    </filter>
    <linearGradient id="sc-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${skyGradientTop}" stop-opacity="0.45"/>
      <stop offset="20%" stop-color="${mountainBlueLight}" stop-opacity="0.35"/>
      <stop offset="45%" stop-color="${skyGradientBottom}" stop-opacity="0.3"/>
      <stop offset="70%" stop-color="${sunsetCoralLight}" stop-opacity="0.25"/>
      <stop offset="85%" stop-color="${sandBase}" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="${sandLight}" stop-opacity="0.15"/>
    </linearGradient>
    <radialGradient id="sc-sun" cx="75%" cy="25%" r="30%">
      <stop offset="0%" stop-color="${skyGradientBottom}" stop-opacity="0.6"/>
      <stop offset="40%" stop-color="${sunsetCoralLight}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${sunsetCoral}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="sc-road" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${sandDark}" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="${sandBase}" stop-opacity="0.3"/>
    </linearGradient>
  </defs>
  <g filter="url(#sc-watercolor)">
    <!-- Sky -->
    <rect x="0" y="0" width="320" height="160" fill="url(#sc-sky)"/>
    <circle cx="240" cy="50" r="45" fill="url(#sc-sun)"/>
    <!-- Mountains — organic wobble, layered depth -->
    <path d="M0 110 Q15 85 32 90 Q48 72 65 78 Q82 60 100 68 Q115 52 135 62 Q150 48 168 58 Q185 45 200 55 Q218 42 235 52 Q250 48 268 58 Q285 52 300 65 Q310 60 320 72 L320 160 L0 160Z" fill="${mountainBlueDark}" opacity="0.4"/>
    <path d="M0 125 Q20 105 42 110 Q60 95 82 102 Q100 88 120 96 Q140 82 160 92 Q180 78 200 88 Q220 76 240 86 Q260 80 280 92 Q300 85 320 98 L320 160 L0 160Z" fill="${mountainBlue}" opacity="0.38"/>
    <path d="M0 138 Q30 128 60 132 Q90 124 120 130 Q150 122 180 128 Q210 120 240 128 Q270 122 300 130 Q310 128 320 132 L320 160 L0 160Z" fill="${mountainBlueLight}" opacity="0.25"/>
    <!-- Pine tree silhouettes on ridge -->
    <path d="M42 128 L42 115 Q45 105 48 115 L48 128" fill="${mountainBlueDark}" opacity="0.35"/>
    <path d="M38 118 Q45 108 52 118" fill="${mountainBlue}" opacity="0.25"/>
    <path d="M270 126 L270 112 Q273 100 276 112 L276 126" fill="${mountainBlueDark}" opacity="0.3"/>
    <path d="M266 115 Q273 104 280 115" fill="${mountainBlue}" opacity="0.22"/>
    <!-- Birds in sky -->
    <path d="M180 35 L183 33 L186 35" fill="none" stroke="${offWhite}" stroke-width="0.7" opacity="0.5"/>
    <path d="M210 42 L212 40 L214 42" fill="none" stroke="${offWhite}" stroke-width="0.6" opacity="0.4"/>
    <path d="M150 30 L152 28 L154 30" fill="none" stroke="${offWhite}" stroke-width="0.5" opacity="0.35"/>
    <!-- Road -->
    <path d="M0 190 Q80 175 160 170 Q240 175 320 190 L320 240 L0 240Z" fill="url(#sc-road)"/>
    <path d="M140 190 Q155 180 160 175 Q165 180 180 190" fill="none" stroke="${offWhite}" stroke-width="1" stroke-dasharray="6 4" opacity="0.35"/>
    <!-- House on right — cozy home receiving delivery -->
    <rect x="235" y="130" width="55" height="40" rx="2" fill="${sandBase}" opacity="0.5"/>
    <polygon points="262,105 232,130 292,130" fill="${sunsetCoralDark}" opacity="0.45"/>
    <rect x="252" y="148" width="18" height="22" fill="${sandDark}" opacity="0.4"/>
    <!-- Chimney with smoke -->
    <rect x="275" y="110" width="8" height="20" fill="${sandDark}" opacity="0.4"/>
    <path d="M279 110 Q276 100 280 92 Q283 85 278 78" fill="none" stroke="${offWhite}" stroke-width="1.2" opacity="0.3"/>
    <path d="M279 108 Q282 98 278 90 Q275 82 280 75" fill="none" stroke="${offWhite}" stroke-width="0.8" opacity="0.2"/>
    <!-- Window on house -->
    <rect x="240" y="138" width="10" height="10" rx="1" fill="${skyGradientTop}" opacity="0.4"/>
    <circle cx="245" cy="143" r="2" fill="${sunsetCoralLight}" opacity="0.35"/>
    <!-- Delivery truck — arriving -->
    <rect x="60" y="148" width="75" height="35" rx="3" fill="${mountainBlue}" opacity="0.55"/>
    <rect x="45" y="158" width="20" height="25" rx="2" fill="${mountainBlueLight}" opacity="0.5"/>
    <!-- Truck windshield -->
    <rect x="48" y="161" width="14" height="12" rx="1" fill="${skyGradientTop}" opacity="0.35"/>
    <!-- Truck wheels -->
    <circle cx="75" cy="185" r="7" fill="${sandDark}" opacity="0.5"/>
    <circle cx="75" cy="185" r="3.5" fill="${sandBase}" opacity="0.4"/>
    <circle cx="120" cy="185" r="7" fill="${sandDark}" opacity="0.5"/>
    <circle cx="120" cy="185" r="3.5" fill="${sandBase}" opacity="0.4"/>
    <!-- CF logo on truck (simple mountain icon) -->
    <path d="M85 158 L92 148 L99 158" fill="none" stroke="${offWhite}" stroke-width="1.2" opacity="0.5"/>
    <path d="M92 148 L98 152" fill="none" stroke="${sunsetCoralLight}" stroke-width="0.8" opacity="0.4"/>
    <!-- Package being unloaded -->
    <rect x="140" y="165" width="18" height="16" rx="2" fill="${sandBase}" opacity="0.55"/>
    <path d="M140 173 L158 173" stroke="${sunsetCoral}" stroke-width="0.8" opacity="0.5"/>
    <path d="M149 165 L149 181" stroke="${sunsetCoral}" stroke-width="0.8" opacity="0.5"/>
    <!-- Wildflowers at roadside -->
    <circle cx="195" cy="172" r="2" fill="${sunsetCoralLight}" opacity="0.45"/>
    <circle cx="200" cy="174" r="1.5" fill="${sandBase}" opacity="0.35"/>
    <circle cx="210" cy="170" r="1.8" fill="${sunsetCoralLight}" opacity="0.4"/>
    <!-- Light rays from sun -->
    <line x1="240" y1="50" x2="260" y2="30" stroke="${skyGradientBottom}" stroke-width="0.8" opacity="0.25"/>
    <line x1="240" y1="50" x2="270" y2="40" stroke="${skyGradientBottom}" stroke-width="0.6" opacity="0.2"/>
    <line x1="240" y1="50" x2="255" y2="20" stroke="${sunsetCoralLight}" stroke-width="0.5" opacity="0.15"/>
  </g>
  <!-- Paper grain overlay -->
  <rect width="320" height="240" filter="url(#sc-grain)" opacity="0.08" fill="${offWhite}"/>
</svg>`,
};
