/**
 * Warm illustration palette — hex values used in Blue Ridge Mountain SVG illustrations.
 * These warm colors are intentionally preserved in illustration files even though
 * the UI chrome has shifted to the CF blue/white branding.
 *
 * Also includes Phase 7 LivingSky spec colors (sky gradient + ridge palette from
 * living-sky.js skyTable/ridgeTable at h=12 midday — CF Brand Anchored per spec).
 *
 * Used by illustration test files to allowlist warm hex values in SVG output.
 */
export const WARM_ILLUSTRATION_PALETTE = new Set([
  // Warm Brown / Espresso palette
  '#3A2518',  // espresso (warm brown — ridgelines, dark elements)
  '#E8D5B7',  // sandBase (warm cream — backgrounds)
  '#E8845C',  // sunsetCoral (warm coral — wildflowers, accents)
  '#F2E8D5',  // sandLight (light cream)
  '#F2A882',  // sunsetCoralLight (light coral)
  '#5C4033',  // espressoLight (medium brown)
  '#D4BC96',  // sandDark (darker sand)
  '#FAF7F2',  // offWhite (warm white)
  '#C9A0A0',  // mauve (soft pink — fabric swatches)
  '#C96B44',  // sunsetCoralDark (dark coral)
  // Phase 7 LivingSky sky gradient (skyTable h=12 midday) — spec colors
  '#1A3060',  // sky pre-dawn deep (artistic anchor for top stop)
  '#2858A0',  // sky0 midday
  '#4878A8',  // sky1 midday
  '#88B0C4',  // sky2 midday
  '#A4C8DC',  // sky3 midday (near horizon)
  // Phase 7 LivingSky ridge palette (ridgeTable h=12 midday) — spec colors
  '#AECCD8',  // r4 far ridge — atmospheric pale blue
  '#7AA4BE',  // r3 mid-far ridge — blue-gray
  '#487494',  // r2 mid ridge — darker mountain blue
  '#2E5878',  // r2/r1 interpolated — near-mid ridge
  '#1C4454',  // r1 near ridge — dark teal
  '#0C1C26',  // tree — forest dark
]);
