// TARGET: All pages (footer is on masterPage)
// DESCRIPTION: Fix footer "Send" button link — currently goes to homepage, should go to /contact
// AUTHOR: miquella
// DEPENDS: none
// PRIORITY: medium
//
// The "Send" envelope icon in the footer contact section links to the CURRENT PAGE
// instead of the Contact page. This needs to be fixed in the editor.
//
// VERIFIED 2026-03-14:
//   On homepage: links to https://halworker85.wixstudio.com/my-site (homepage)
//   On about page: links to https://halworker85.wixstudio.com/my-site/about (about)
//   This means the link target is likely "current page" or empty — it needs to be
//   set to the Contact page explicitly.
//
// Correct: /my-site/contact

(function(ds, doc) {
  // The Send link is in the footer contact section.
  // MELANIA: Find the link component in the footer that has the envelope icon.
  // Look for a link component whose href points to homepage inside the footer.
  //
  // To find it:
  // const footerRef = { id: 'SITE_FOOTER', type: 'DESKTOP' };
  // const children = ds.components.getChildren(footerRef);
  // Then walk children to find the link with '/about' href.
  //
  // Once found, update the link target:
  // ds.components.data.update(linkRef, { link: { type: 'PageLink', pageId: '<contact-page-id>' } });

  return { status: 'manual', note: 'Find footer Send link and update href from homepage to /contact' };
})(ds, doc);
