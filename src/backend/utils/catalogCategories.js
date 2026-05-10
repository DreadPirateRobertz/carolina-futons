/**
 * @file catalogCategories.js
 * @description Canonical list of catalog category slugs used across the
 * Velo backend (catalogContent, loadCatalogMaster, productVideos) and
 * validated by `scripts/validate-catalog.js`.
 *
 * Extracted from `catalogImport.web.js` per cf-dtu6 so that file can be
 * retired (its 5 webMethods are dead per cf-hpwy v2 detector). Prior to
 * extraction, validate-catalog.js read this list from disk via filesystem
 * path, which made `catalogImport.web.js` un-deletable despite being dead.
 *
 * The script + tests/validateCatalog.test.js now read this single
 * canonical list and confirm the consumer files re-export the same set.
 *
 * @module backend/utils/catalogCategories
 */

// Order is significant: getAllCategories in catalogContent.web.js returns
// these in declared order with sequential sortOrder, and tests pin
// data[11].category === 'pillows-702'. Preserving the original catalogContent
// + productVideos ordering (covers, outdoor-furniture, log-frames, pillows-702)
// rather than the alternative catalogImport / loadCatalogMaster ordering
// (...pillows-702, log-frames) keeps the dashboard ordering stable.
export const VALID_CATEGORIES = [
  'futon-frames',
  'mattresses',
  'murphy-cabinet-beds',
  'platform-beds',
  'casegoods-accessories',
  'front-loading-nesting',
  'wall-hugger-frames',
  'unfinished-wood',
  'covers',
  'outdoor-furniture',
  'log-frames',
  'pillows-702',
];
