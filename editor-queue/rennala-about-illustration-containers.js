// TARGET: About page
// DESCRIPTION: Add 2 HtmlComponent containers for SVG illustrations
// AUTHOR: rennala
// DEPENDS: none
// PRIORITY: P2 — code already wired in About.js (initAboutIllustrations)
//
// CONTEXT:
// About.js imports initAboutIllustrations($w) from public/AboutIllustrations.js.
// That function injects SVGs via .html property on two HtmlComponent containers:
//   1. #teamPortraitContainer — team portrait SVG (placed near team section)
//   2. #timelineContainer — Blue Ridge timeline SVG (placed near timeline section)
//
// Both use HtmlComponent (NOT Image elements) because SVGs are injected as raw HTML.
//
// MANUAL STEPS (for melania in editor):
//
// 1. Navigate to the About page in Wix Studio editor
//
// 2. ADD FIRST CONTAINER — Team Portrait:
//    - Add Panel → Embed Code → Custom Element (or "HTML iframe")
//    - Set nickname/ID to: teamPortraitContainer
//    - Place it near the team section (near #teamRepeater)
//    - Size: width 100% of section, height ~300px
//    - The Velo code will inject the SVG at runtime via container.html = svgString
//
// 3. ADD SECOND CONTAINER — Timeline:
//    - Add Panel → Embed Code → Custom Element (or "HTML iframe")
//    - Set nickname/ID to: timelineContainer
//    - Place it near the timeline section (near #timelineRepeater)
//    - Size: width 100% of section, height ~200px
//    - The Velo code will inject the SVG at runtime via container.html = svgString
//
// 4. VERIFY nicknames:
//    - Click each HtmlComponent → Properties panel → ID should show:
//      teamPortraitContainer and timelineContainer
//
// WHAT THE CODE DOES:
// src/public/AboutIllustrations.js exports initAboutIllustrations($w):
//   - $w('#teamPortraitContainer').html = getTeamPortraitSvg()
//   - $w('#timelineContainer').html = getTimelineSvg()
// Both SVGs are static content from the Figma pipeline (no runtime generation).
//
// VERIFICATION:
// After adding containers and publishing, preview the About page.
// You should see:
//   - A team portrait illustration near the team section
//   - A Blue Ridge mountain timeline illustration near the business timeline
// If containers are empty, check that nicknames match exactly.

console.log('[rennala] About page illustration containers: MANUAL EDITOR TASK');
console.log('Add 2 HtmlComponent elements: #teamPortraitContainer, #timelineContainer');
