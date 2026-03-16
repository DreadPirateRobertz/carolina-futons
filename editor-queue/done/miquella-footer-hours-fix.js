// TARGET: All pages (footer is on masterPage)
// DESCRIPTION: Fix footer hours text — currently shows "Wed–Fri 10–5 | Sat 10–4", should be "Wed–Sat 10–5"
// AUTHOR: miquella
// DEPENDS: none
// PRIORITY: high
//
// The footer contact section shows outdated hours with separate Saturday entry.
// Hours were consolidated: Wednesday through Saturday, 10 AM to 5 PM.
// The Velo code in footerContent.js already has the correct hours, but the
// footer contact section text is editor-set (not Velo-driven), so it must be
// updated in the editor.
//
// Current (wrong): "Wed–Fri 10–5 | Sat 10–4"
// Correct:         "Wed–Sat 10–5"
//
// VERIFIED from live site snapshot 2026-03-14:
//   Footer contact section ref=e639 (homepage), ref=e295 (about page)
//   Contains paragraph: "Wed–Fri 10–5 | Sat 10–4"

(function(ds, doc) {
  // MELANIA: The hours text is in the footer contact section.
  // Find the text component in SITE_FOOTER that contains "Wed–Fri 10–5 | Sat 10–4"
  //
  // Steps:
  // 1. const footerRef = { id: 'SITE_FOOTER', type: 'DESKTOP' };
  // 2. Walk children to find the text component with hours
  //    ds.components.getChildren(footerRef) → recurse into children
  //    Look for component where ds.components.data.get(ref).text contains "Wed"
  // 3. Update the text:
  //    ds.components.data.update(textRef, {
  //      text: '<p class="font_8" style="font-size:14px">Wed–Sat 10–5</p>'
  //    });
  //
  // Note: Check the existing HTML structure of the text before replacing.
  // Use ds.components.data.get(ref) to see the current rich text HTML.

  return { status: 'manual', note: 'Find footer hours text component and update to "Wed–Sat 10–5"' };
})(ds, doc);
