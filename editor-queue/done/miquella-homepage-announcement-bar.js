// TARGET: Homepage — header announcement bar
// DESCRIPTION: Update announcement bar text to CF showroom info
// AUTHOR: miquella
// DEPENDS: none
// COMP-ID: comp-kbgakxea_r_comp-ly727283 (announcement text)
// NOTE: The bar shows "Over 700 Fabric Swatches Available In-Store" but
//       the accessibility snapshot showed "Visit Our Showroom: Wed–Sat 10–5, Hendersonville NC"
//       There may be multiple text elements rotating. Update the primary one.

(function(ds, doc) {
  const ref = { id: 'comp-kbgakxea_r_comp-ly727283', type: 'DESKTOP' };
  ds.components.data.update(ref, {
    text: '<p class="font_8">Visit Our Showroom: Wed–Sat 10–5 | 824 Locust St, Hendersonville NC | (828) 252-9449</p>'
  });
  return { status: 'ok', changed: ['comp-kbgakxea_r_comp-ly727283'], note: 'Updated announcement bar with showroom hours + address + phone' };
})(ds, doc);
