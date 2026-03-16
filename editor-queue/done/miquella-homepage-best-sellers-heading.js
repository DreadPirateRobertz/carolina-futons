// TARGET: Homepage — section 5 (Best Sellers)
// DESCRIPTION: Split "BEST SELLERS MOST LOVED ITEMS" into heading + subtitle
// AUTHOR: miquella
// DEPENDS: none
// COMP-ID: comp-lybhw26c (heading h2)

// The heading currently reads "BEST SELLERS MOST LOVED ITEMS" jammed together.
// Update to just "BEST SELLERS" — the "MOST LOVED ITEMS" subtitle should be
// a separate text element or removed.

(function(ds, doc) {
  const ref = { id: 'comp-lybhw26c', type: 'DESKTOP' };
  ds.components.data.update(ref, {
    text: '<h2 class="font_2">BEST SELLERS</h2>'
  });
  return { status: 'ok', changed: ['comp-lybhw26c'], note: 'Removed "MOST LOVED ITEMS" from heading — was template text' };
})(ds, doc);
