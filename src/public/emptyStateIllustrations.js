/**
 * Empty State Illustrations — Inline SVG scenes with Blue Ridge personality
 *
 * Each illustration is a compact inline SVG encoded as a data URI, suitable for
 * Wix image element `.src` property. Uses brand tokens from sharedTokens.js.
 * Style: hand-drawn/watercolor mountain aesthetic matching design.jpeg.
 */

/**
 * Convert raw SVG markup to a data URI string.
 * @param {string} svg - Raw SVG string
 * @returns {string} Data URI
 */
export function svgToDataUri(svg) {
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

// ── SVG Scenes ──────────────────────────────────────────────────────

const cartSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" role="img">
<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#B8D4E3"/><stop offset="100%" stop-color="#F0C87A"/></linearGradient></defs>
<rect width="200" height="160" fill="#FAF7F2"/>
<rect width="200" height="100" fill="url(#s)"/>
<circle cx="100" cy="38" r="18" fill="#E8845C" opacity="0.7"/>
<circle cx="100" cy="38" r="12" fill="#F0C87A" opacity="0.5"/>
<path d="M0,100 Q25,58 50,72 Q70,48 95,62 Q115,42 140,58 Q165,48 185,65 L200,58 L200,100Z" fill="#5B8FA8" opacity="0.5"/>
<path d="M0,100 Q30,70 55,82 Q80,62 105,78 Q130,58 160,72 Q185,62 200,75 L200,100Z" fill="#3D6B80" opacity="0.4"/>
<path d="M0,100 Q50,94 100,100 Q150,106 200,100 L200,160 L0,160Z" fill="#E8D5B7"/>
<path d="M92,100 Q96,118 102,125 Q108,135 104,148 Q100,158 97,160" stroke="#D4BC96" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.6"/>
<path d="M108,100 Q112,116 108,128 Q104,138 110,150 Q114,158 112,160" stroke="#D4BC96" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.6"/>
<path d="M85,108 Q90,106 100,108 Q110,110 115,108" stroke="#3A2518" stroke-width="0.8" fill="none" opacity="0.2"/>
<path d="M88,122 Q95,120 105,122 Q112,124 118,121" stroke="#3A2518" stroke-width="0.8" fill="none" opacity="0.2"/>
</svg>`;

const searchSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" role="img">
<rect width="200" height="160" fill="#FAF7F2"/>
<rect width="200" height="120" fill="#B8D4E3" opacity="0.4"/>
<path d="M0,120 Q20,65 45,80 Q65,50 90,68 Q110,38 135,55 Q158,42 180,58 L200,48 L200,120Z" fill="#5B8FA8" opacity="0.35"/>
<path d="M0,120 Q30,80 60,90 Q85,70 110,82 Q135,60 165,75 L200,65 L200,120Z" fill="#3D6B80" opacity="0.3"/>
<path d="M0,120 Q40,95 80,105 Q120,85 160,100 L200,90 L200,120Z" fill="#5B8FA8" opacity="0.25"/>
<rect y="88" width="200" height="10" fill="#FAF7F2" opacity="0.6"/>
<rect y="100" width="200" height="8" fill="#F2E8D5" opacity="0.5"/>
<rect y="110" width="200" height="6" fill="#FAF7F2" opacity="0.4"/>
<path d="M0,120 Q50,115 100,120 Q150,125 200,120 L200,160 L0,160Z" fill="#E8D5B7"/>
<circle cx="100" cy="140" r="14" stroke="#3A2518" stroke-width="2" fill="none" opacity="0.5"/>
<line x1="110" y1="150" x2="120" y2="158" stroke="#3A2518" stroke-width="2.5" stroke-linecap="round" opacity="0.5"/>
<path d="M92,138 Q97,135 100,138" stroke="#E8845C" stroke-width="1.5" fill="none" opacity="0.6"/>
<path d="M100,138 Q103,135 108,138" stroke="#E8845C" stroke-width="1.5" fill="none" opacity="0.6"/>
</svg>`;

const wishlistSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" role="img">
<rect width="200" height="160" fill="#FAF7F2"/>
<rect x="45" y="20" width="110" height="130" rx="3" fill="#F2E8D5" stroke="#3A2518" stroke-width="1.5"/>
<rect x="50" y="20" width="100" height="130" rx="2" fill="#FAF7F2" stroke="#3A2518" stroke-width="1"/>
<line x1="100" y1="20" x2="100" y2="150" stroke="#D4BC96" stroke-width="0.8" stroke-dasharray="3,2"/>
<line x1="60" y1="45" x2="95" y2="45" stroke="#E8D5B7" stroke-width="0.5" opacity="0.5"/>
<line x1="60" y1="55" x2="95" y2="55" stroke="#E8D5B7" stroke-width="0.5" opacity="0.5"/>
<line x1="60" y1="65" x2="95" y2="65" stroke="#E8D5B7" stroke-width="0.5" opacity="0.5"/>
<line x1="105" y1="45" x2="140" y2="45" stroke="#E8D5B7" stroke-width="0.5" opacity="0.5"/>
<line x1="105" y1="55" x2="140" y2="55" stroke="#E8D5B7" stroke-width="0.5" opacity="0.5"/>
<line x1="105" y1="65" x2="140" y2="65" stroke="#E8D5B7" stroke-width="0.5" opacity="0.5"/>
<path d="M115,80 C115,74 108,70 108,76 C108,70 101,74 101,80 C101,90 108,96 108,96 C108,96 115,90 115,80Z" fill="#E8845C" opacity="0.7"/>
<path d="M115,80 C115,74 108,70 108,76 C108,70 101,74 101,80 C101,90 108,96 108,96 C108,96 115,90 115,80Z" stroke="#3A2518" stroke-width="1" fill="none" opacity="0.5"/>
<path d="M60,85 Q65,78 70,85 Q75,92 80,85" stroke="#5B8FA8" stroke-width="1.2" fill="none" opacity="0.4"/>
<path d="M62,95 Q67,88 72,95 Q77,102 82,95" stroke="#5B8FA8" stroke-width="1.2" fill="none" opacity="0.3"/>
</svg>`;

const reviewsSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" role="img">
<rect width="200" height="160" fill="#FAF7F2"/>
<rect x="40" y="25" width="120" height="115" rx="2" fill="#FFFFFF" stroke="#3A2518" stroke-width="1.2"/>
<path d="M40,25 L60,32 L80,28 L100,25 L120,30 L140,26 L160,25" fill="none" stroke="#5B8FA8" stroke-width="1.5" opacity="0.6"/>
<path d="M40,28 Q60,22 80,30 Q100,20 120,28 Q140,22 160,28 L160,38 Q140,32 120,38 Q100,30 80,38 Q60,32 40,38Z" fill="#B8D4E3" opacity="0.3"/>
<circle cx="100" cy="30" r="5" fill="#E8845C" opacity="0.5"/>
<line x1="55" y1="52" x2="145" y2="52" stroke="#E8D5B7" stroke-width="1" opacity="0.5"/>
<line x1="55" y1="62" x2="135" y2="62" stroke="#E8D5B7" stroke-width="1" opacity="0.5"/>
<line x1="55" y1="72" x2="140" y2="72" stroke="#E8D5B7" stroke-width="1" opacity="0.5"/>
<line x1="55" y1="82" x2="120" y2="82" stroke="#E8D5B7" stroke-width="1" opacity="0.5"/>
<line x1="55" y1="92" x2="130" y2="92" stroke="#E8D5B7" stroke-width="1" opacity="0.5"/>
<line x1="55" y1="102" x2="110" y2="102" stroke="#E8D5B7" stroke-width="1" opacity="0.5"/>
<path d="M150,90 L155,45 Q155,42 153,42 L149,42 Q147,42 147,45 L143,82" stroke="#3A2518" stroke-width="1.5" fill="none" stroke-linecap="round"/>
<path d="M143,82 L140,88" stroke="#E8845C" stroke-width="1.2" fill="none" stroke-linecap="round"/>
<circle cx="139" cy="90" r="1.5" fill="#3A2518" opacity="0.4"/>
</svg>`;

const categorySvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" role="img">
<defs><linearGradient id="cs" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#B8D4E3"/><stop offset="80%" stop-color="#FAF7F2"/></linearGradient></defs>
<rect width="200" height="160" fill="url(#cs)"/>
<path d="M0,80 Q15,55 30,65 Q50,40 70,52 L70,80Z" fill="#5B8FA8" opacity="0.3"/>
<path d="M130,80 Q150,45 170,55 Q185,38 200,50 L200,80Z" fill="#5B8FA8" opacity="0.3"/>
<path d="M0,80 Q50,76 100,80 Q150,84 200,80 L200,160 L0,160Z" fill="#E8D5B7"/>
<path d="M0,82 Q50,78 100,82 Q150,86 200,82 L200,90 Q150,94 100,90 Q50,86 0,90Z" fill="#D4BC96" opacity="0.3"/>
<circle cx="45" cy="105" r="3" fill="#E8845C" opacity="0.7"/>
<circle cx="48" cy="100" r="2" fill="#E8845C" opacity="0.5"/>
<path d="M46,108 L46,118" stroke="#4A7C59" stroke-width="0.8"/>
<circle cx="85" cy="98" r="2.5" fill="#E8845C" opacity="0.6"/>
<circle cx="88" cy="95" r="2" fill="#F2A882" opacity="0.5"/>
<path d="M86,101 L86,112" stroke="#4A7C59" stroke-width="0.8"/>
<circle cx="130" cy="102" r="3" fill="#E8845C" opacity="0.7"/>
<circle cx="127" cy="99" r="2" fill="#F2A882" opacity="0.4"/>
<path d="M129,105 L129,116" stroke="#4A7C59" stroke-width="0.8"/>
<circle cx="160" cy="100" r="2" fill="#E8845C" opacity="0.5"/>
<path d="M160,103 L160,113" stroke="#4A7C59" stroke-width="0.8"/>
<path d="M65,110 Q70,105 75,110" stroke="#4A7C59" stroke-width="0.8" fill="none" opacity="0.4"/>
<path d="M110,108 Q115,103 120,108" stroke="#4A7C59" stroke-width="0.8" fill="none" opacity="0.4"/>
<path d="M20,115 Q25,110 30,115 Q35,110 40,115" stroke="#3A2518" stroke-width="0.5" fill="none" opacity="0.15"/>
<path d="M155,118 Q160,113 165,118 Q170,113 175,118" stroke="#3A2518" stroke-width="0.5" fill="none" opacity="0.15"/>
</svg>`;

const errorSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" role="img">
<rect width="200" height="160" fill="#FAF7F2"/>
<path d="M0,70 Q50,65 100,70 Q150,75 200,70 L200,160 L0,160Z" fill="#E8D5B7"/>
<path d="M60,130 Q70,120 80,128 Q90,118 100,130 Q110,118 120,128 Q130,120 140,130 L140,140 Q130,135 120,140 Q110,132 100,140 Q90,132 80,140 Q70,135 60,140Z" fill="#5B8FA8" opacity="0.4"/>
<path d="M50,128 Q55,125 60,128 Q65,125 70,128 Q75,125 80,128" stroke="#A8CCD8" stroke-width="0.8" fill="none" opacity="0.5"/>
<path d="M120,128 Q125,125 130,128 Q135,125 140,128 Q145,125 150,128" stroke="#A8CCD8" stroke-width="0.8" fill="none" opacity="0.5"/>
<rect x="30" y="85" width="55" height="6" rx="1" fill="#5C4033" transform="rotate(-3 55 88)"/>
<rect x="30" y="92" width="55" height="3" rx="1" fill="#3A2518" opacity="0.3" transform="rotate(-3 55 93)"/>
<rect x="32" y="80" width="4" height="18" rx="1" fill="#5C4033"/>
<rect x="60" y="78" width="4" height="20" rx="1" fill="#5C4033"/>
<rect x="115" y="83" width="55" height="6" rx="1" fill="#5C4033" transform="rotate(4 142 86)"/>
<rect x="115" y="90" width="55" height="3" rx="1" fill="#3A2518" opacity="0.3" transform="rotate(4 142 91)"/>
<rect x="135" y="78" width="4" height="20" rx="1" fill="#5C4033"/>
<rect x="167" y="80" width="4" height="18" rx="1" fill="#5C4033"/>
<path d="M84,88 L89,95 L93,85 L97,92 L100,88" stroke="#E8845C" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.6"/>
<path d="M100,88 L103,95 L107,84 L111,92 L116,87" stroke="#E8845C" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.6"/>
</svg>`;

const notFoundSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" role="img">
<defs><linearGradient id="ns" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#B8D4E3"/><stop offset="100%" stop-color="#F2E8D5"/></linearGradient></defs>
<rect width="200" height="160" fill="url(#ns)"/>
<path d="M0,90 Q20,55 45,68 Q65,42 90,58 Q115,38 140,52 Q165,40 190,55 L200,50 L200,90Z" fill="#5B8FA8" opacity="0.35"/>
<path d="M0,90 Q35,72 65,82 Q100,65 130,78 Q165,62 200,75 L200,90Z" fill="#3D6B80" opacity="0.3"/>
<path d="M0,90 Q50,86 100,90 Q150,94 200,90 L200,160 L0,160Z" fill="#E8D5B7"/>
<circle cx="90" cy="100" r="6" fill="#3A2518" opacity="0.6"/>
<path d="M90,106 L90,128" stroke="#3A2518" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/>
<path d="M90,112 L82,120" stroke="#3A2518" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
<path d="M90,128 L84,142" stroke="#3A2518" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
<path d="M90,128 L96,142" stroke="#3A2518" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
<rect x="93" y="108" width="22" height="16" rx="1" fill="#FAF7F2" stroke="#3A2518" stroke-width="1" transform="rotate(8 104 116)"/>
<path d="M96,112 L98,118 L102,114 L106,120 L110,113" stroke="#E8845C" stroke-width="0.8" fill="none" transform="rotate(8 104 116)"/>
<path d="M97,120 L112,120" stroke="#5B8FA8" stroke-width="0.6" transform="rotate(8 104 116)"/>
<circle cx="102" cy="112" r="1" fill="#E8845C" opacity="0.6" transform="rotate(8 104 116)"/>
</svg>`;

const sideCartSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" role="img">
<rect width="200" height="160" fill="#FAF7F2"/>
<path d="M65,30 L60,30 Q56,30 55,34 L45,125 Q44,130 48,132 L152,132 Q156,130 155,125 L145,34 Q144,30 140,30 L135,30" stroke="#3A2518" stroke-width="2.5" fill="none" stroke-linecap="round"/>
<path d="M55,34 L45,125 Q44,130 48,132 L152,132 Q156,130 155,125 L145,34Z" fill="#F2E8D5" opacity="0.5"/>
<path d="M75,30 Q80,12 100,10 Q120,12 125,30" stroke="#3A2518" stroke-width="2.5" fill="none" stroke-linecap="round"/>
<path d="M48,132 Q55,138 70,140 Q100,144 130,140 Q145,138 152,132" stroke="#3A2518" stroke-width="1.5" fill="none" opacity="0.3"/>
<path d="M75,65 Q85,58 95,65 Q105,72 115,65 Q125,58 130,65" stroke="#E8D5B7" stroke-width="1.5" fill="none" opacity="0.4"/>
<path d="M80,80 Q90,74 100,80 Q110,86 120,80" stroke="#E8D5B7" stroke-width="1.2" fill="none" opacity="0.3"/>
<path d="M90,95 Q97,90 104,95 Q111,100 118,95" stroke="#E8D5B7" stroke-width="1" fill="none" opacity="0.25"/>
<path d="M80,105 Q90,100 100,105 Q110,110 120,105" stroke="#5B8FA8" stroke-width="0.8" fill="none" opacity="0.2"/>
<circle cx="100" cy="75" r="2" fill="#E8845C" opacity="0.3"/>
</svg>`;

// ── Exports ─────────────────────────────────────────────────────────

export const ILLUSTRATIONS = {
  cart: svgToDataUri(cartSvg),
  search: svgToDataUri(searchSvg),
  wishlist: svgToDataUri(wishlistSvg),
  reviews: svgToDataUri(reviewsSvg),
  category: svgToDataUri(categorySvg),
  error: svgToDataUri(errorSvg),
  notFound: svgToDataUri(notFoundSvg),
  sideCart: svgToDataUri(sideCartSvg),
};
