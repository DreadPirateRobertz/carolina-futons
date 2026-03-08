// Accessibility Statement.js - Accessibility Page
// Content is managed through Wix editor, minimal code for responsive behavior
import { initBackToTop } from 'public/mobileHelpers';
import { initPageSeo } from 'public/pageSeo.js';

$w.onReady(function () {
  initPageSeo('accessibility');
  try { initBackToTop($w); } catch (e) {}
});
