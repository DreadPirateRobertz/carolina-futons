// TARGET: Site settings
// DESCRIPTION: Change site title from "My Site" to "Carolina Futons"
// AUTHOR: miquella
// DEPENDS: none
// NOTE: This may need to be done via Site Settings > General, not documentServices.
//       If ds approach doesn't work, melania should change it manually in:
//       Editor > Site Settings > General > Site Name

// Try via documentServices siteMetaData if available:
(function(ds, doc) {
  try {
    // Attempt to update site display name
    ds.generalInfo.setSiteName('Carolina Futons');
    return { status: 'ok', changed: ['siteName'], note: 'Site name set to Carolina Futons' };
  } catch (e) {
    return { status: 'manual', error: e.message, note: 'Use Editor > Site Settings > General > Site Name = "Carolina Futons"' };
  }
})(ds, doc);
