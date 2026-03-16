// TARGET: About page
// DESCRIPTION: Fix heading-content mismatch — headings and body text are swapped
// AUTHOR: miquella
// DEPENDS: none
// PRIORITY: medium
//
// Current state (wrong):
//   "OUR SHOWROOM" → has materials/mattress content
//   "PREMIUM MATERIALS" → has manufacturer content
//   "QUALITY CRAFTSMANSHIP" → has showroom visit content
//
// Correct pairing:
//   "OUR SHOWROOM" → showroom visit content
//   "PREMIUM MATERIALS" → materials/mattress content
//   "QUALITY CRAFTSMANSHIP" → manufacturer content
//
// NOTE: This script swaps the HEADING text to match the existing body content,
// since moving body content is riskier (rich text formatting).

(function(ds, doc) {
  // These comp IDs need to be verified from the editor.
  // The three h3 headings in the About page main content area:
  // comp-lybfa708 area contains "OUR SHOWROOM" heading
  // comp-lybfds6j area contains "PREMIUM MATERIALS" heading
  // comp-lybflhtt area contains "QUALITY CRAFTSMANSHIP" heading
  //
  // MELANIA: Before running, please verify the comp IDs for the three h3 elements.
  // Use: ds.components.getChildren({ id: 'comp-XXX', type: 'DESKTOP' }) to find them.
  //
  // Then update the heading text:
  // Heading 1 → "PREMIUM MATERIALS" (body talks about CertiPUR-US, mattresses)
  // Heading 2 → "QUALITY CRAFTSMANSHIP" (body talks about manufacturers, Night & Day)
  // Heading 3 → "OUR SHOWROOM" (body talks about visiting, white-glove delivery)

  return { status: 'manual', note: 'Verify comp IDs in editor before executing. See comments above.' };
})(ds, doc);
