// TARGET: Contact page
// DESCRIPTION: Add 2 HtmlComponent containers for SVG illustrations
// AUTHOR: rennala
// DEPENDS: none
// PRIORITY: P2 — code already wired in Contact.js (initContactHeroSkyline, initContactShowroomScene)
//
// CONTEXT:
// Contact.js imports and calls:
//   - initContactHeroSkyline($w) from public/ContactIllustrations.js
//   - initContactShowroomScene($w) from public/ContactIllustrations.js
//
// These functions inject SVGs via .html property on HtmlComponent containers:
//   1. #contactHeroSkyline — mountain skyline hero (1440x220 viewBox, sunrise palette)
//   2. #contactShowroomScene — showroom/map scene (400x280 viewBox, cabin + map pin)
//
// Both use HtmlComponent (NOT Image elements) because SVGs are injected as raw HTML.
//
// MANUAL STEPS (for melania in editor):
//
// 1. Navigate to the Contact page in Wix Studio editor
//
// 2. ADD FIRST CONTAINER — Hero Skyline:
//    - Add Panel → Embed Code → Custom Element (or "HTML iframe")
//    - Set nickname/ID to: contactHeroSkyline
//    - Place it at the TOP of the page as a hero/banner element
//    - Size: width 100% (full-width), height ~220px
//    - The SVG is a wide panoramic mountain skyline (1440px viewBox)
//    - The Velo code will inject the SVG at runtime
//
// 3. ADD SECOND CONTAINER — Showroom Scene:
//    - Add Panel → Embed Code → Custom Element (or "HTML iframe")
//    - Set nickname/ID to: contactShowroomScene
//    - Place it near the showroom/location info section
//    - Size: width ~400px (or 50% of section), height ~280px
//    - The SVG shows a mountain cabin with map pin (showroom location)
//    - The Velo code will inject the SVG at runtime
//
// 4. VERIFY nicknames:
//    - Click each HtmlComponent → Properties panel → ID should show:
//      contactHeroSkyline and contactShowroomScene
//
// WHAT THE CODE DOES:
// src/public/ContactIllustrations.js exports:
//   - initContactHeroSkyline($w) → $w('#contactHeroSkyline').html = generateHeroSVG()
//   - initContactShowroomScene($w) → $w('#contactShowroomScene').html = generateShowroomSVG()
// Both SVGs are static content from the Figma pipeline with brand tokens.
// SVGs include accessibility: role="img", aria-labelledby with <title> elements.
//
// VERIFICATION:
// After adding containers and publishing, preview the Contact page.
// You should see:
//   - A warm sunrise mountain skyline banner at the top of the page
//   - A cozy cabin/showroom illustration with map pin near the location info
// If containers are empty, check that nicknames match exactly.

console.log('[rennala] Contact page illustration containers: MANUAL EDITOR TASK');
console.log('Add 2 HtmlComponent elements: #contactHeroSkyline, #contactShowroomScene');
