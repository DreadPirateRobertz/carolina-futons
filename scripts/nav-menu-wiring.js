/**
 * Nav Menu Wiring — documentServices menu operations
 *
 * COMPLETED 2026-03-14 by rennala via Playwright.
 *
 * Restructured the staging site nav (My Site 3, metaSiteId 3af610bf)
 * from flat category list to production-matching hierarchy:
 *   Home | Shop (dropdown) | Product Videos | Sale | Getting it Home |
 *   Contact | FAQ | About
 *
 * Approach:
 *   1. Access DS via window.frames[0].documentServices (frame 0 in editor)
 *   2. Menu ID: 'dataItem-kd46lbuc' (the "Menu" connected to nav bar)
 *   3. Removed flat category items, re-added all items in correct order
 *   4. Shop dropdown has 4 sub-items using DynamicPageLink (router: routers-ly7249ze)
 *   5. Saved via ds.save()
 *
 * API Notes:
 *   - ds.menu.getAll() returns fresh data; ds.menu.getById() may be cached
 *   - ds.menu.addItem(menuId, item, position) — position param is unreliable,
 *     items get appended. Workaround: remove all, re-add in desired order.
 *   - ds.menu.removeItem(menuId, itemId) works but returns null
 *   - No page URL slug setter via DS API; slug changes require editor UI
 *
 * Still Missing:
 *   - Blog page doesn't exist in editor yet (no Wix Blog app installed)
 *   - Page URL slugs not updated (Fullscreen Page still /fullscreen-page,
 *     Shipping Policy still /shipping-policy). Nav labels are correct though.
 */

// ── Resolved Page IDs (My Site 3 / Stage 3) ─────────────────────────

const PAGE_IDS = {
  home:          '#c1dmp',   // Home
  shopMain:      '#u0gn0',   // Category Page (used as Shop landing)
  productVideos: '#vu50r',   // Fullscreen Page (repurposed for Product Videos)
  gettingItHome: '#ype8c',   // Shipping Policy (repurposed for Getting it Home)
  contact:       '#k14wx',   // Contact
  about:         '#gar3e',   // About
  faq:           '#s2c5g',   // FAQ
  // Sale uses DynamicPageLink (router), not a static page
  // Blog page not yet created
};

// ── Category Router ─────────────────────────────────────────────────
const CATEGORY_ROUTER_ID = 'routers-ly7249ze';

// ── Final Nav Structure (as wired) ──────────────────────────────────
//
//  Pos | Label            | Link Type       | Target
//  ----|------------------|-----------------|----------------------------
//  0   | Home             | PageLink        | #c1dmp
//  1   | Shop (dropdown)  | PageLink        | #u0gn0 (Category Page)
//  1.1 |   Futon Frames   | DynamicPageLink | routers-ly7249ze/futon-frames
//  1.2 |   Mattresses     | DynamicPageLink | routers-ly7249ze/mattresses
//  1.3 |   Murphy Beds    | DynamicPageLink | routers-ly7249ze/murphy-cabinet-beds
//  1.4 |   Platform Beds  | DynamicPageLink | routers-ly7249ze/platform-beds
//  2   | Product Videos   | PageLink        | #vu50r (Fullscreen Page)
//  3   | Sale             | DynamicPageLink | routers-ly7249ze/sales
//  4   | Getting it Home  | PageLink        | #ype8c (Shipping Policy)
//  5   | Contact          | PageLink        | #k14wx
//  6   | FAQ              | PageLink        | #s2c5g
//  7   | About            | PageLink        | #gar3e
//  --  | Blog             | (not wired — page doesn't exist yet)

module.exports = { PAGE_IDS, CATEGORY_ROUTER_ID };
