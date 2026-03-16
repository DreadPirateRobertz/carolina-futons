# CSS & Wix Tricks — Running Notes

## Wix CSS Gotchas (learned the hard way)

### 1. Double-prefix bug
Wix Studio auto-prefixes `wixui-` to all class names. If you write `.wixui-section` in CSS, Wix renders it as `.wixui-wixui-section` → matches NOTHING.
**Fix**: Write `.section` — Wix turns it into `.wixui-section` which is correct.

### 2. colorUnderlay for backgrounds
Wix renders section backgrounds via a child div `[data-testid="colorUnderlay"]`. Targeting `.header` or `.footer` background-color does nothing visible.
**Fix**: Always target `[data-testid="colorUnderlay"]` for header/footer/section backgrounds.

### 3. Positional CSS selectors
Wix mangles attribute values in `[id=...]` selectors. Use suffix match `[id$="suffix"]` or `nth-of-type()` positional selectors to bypass.

### 4. No pseudo-elements
Wix blocks `::before` and `::after` pseudo-elements in global.css. Use `box-shadow` for accent borders instead.

### 5. Collection card text overlap — STILL BROKEN after v7
The template "Shop By Collections" section renders category name text BEHIND the product images. The text is absolutely positioned in the template layout. CSS z-index + background fixes applied in v7 but NOT enough — the template uses absolute positioning that CSS alone can't override fully.
**Root cause**: The Wix template category cards use absolute/fixed positioning for the h3 heading overlay. The heading sits at position:absolute inside the card container, overlapping the product image carousel.
**Options**: (a) Hide the h3 and use a separate text element below, (b) Use CSS to force relative positioning + move text below image, (c) Editor restructure — move the heading element below the image in the section tree.
**Miquella PR #333**: Has a CSS fix for inflated collection headings — may help partially.

### 6. documentServices component IDs
`ds.components.data.update()` silently fails on Section/Container parents. Must target actual WRichText children. Always verify `data.type === "StyledText"` before updating.

### 7. Velo overrides editor text
Announcement bar rotation code in masterPage.js overwrites any editor text changes on page load. For those elements, fix must go in Velo JS, not editor.

### 8. ds.publish() destroys context
Calling `ds.publish()` programmatically triggers page navigation that kills the JS execution context. Use the UI Publish button instead.

## Design Vision Palette Mapping (v7)
| Token | Hex | Role |
|-------|-----|------|
| --cf-espresso | #3A2518 | Primary text, headings |
| --cf-espresso-light | #5C4033 | Secondary text |
| --cf-blue | #5B8FA8 | Mountain blue — CTAs, prices |
| --cf-blue-dark | #3D6B80 | Hover states |
| --cf-coral | #E8845C | Sunset coral — sale badges, newsletter CTA |
| --cf-white | #FAF7F2 | Off-white base (warm) |
| --cf-sand-light | #F2E8D5 | Alternating sections |
| --cf-sand-base | #E8D5B7 | Card/grid backgrounds |
| --cf-sand-dark | #D4BC96 | Borders |
| --cf-footer-bg | #3A2518 | Espresso footer |
| --cf-footer-heading | #E8D5B7 | Sand headings on dark |
| --cf-footer-text | #D4BC96 | Sand body text on dark |

## Illustration Status
- SVG illustrations exist in dev repo branches (comfort, about, contact, cart, onboarding, thank-you)
- NOT uploaded to Wix Media Manager yet
- NOT placed in editor sections
- Need: upload to Media Manager → place in editor → map element IDs for Velo

## Cross-sell / Dynamic Gallery Status
- Backend `productRecommendations.web.js` has: getRelatedProducts, getFeaturedProducts, getSaleProducts, getRecentlyViewed, co-purchase analysis
- Backend `socialProof.web.js` has: recent purchase alerts, low stock, popularity signals
- Home.js references ALL these in `$w.onReady()` but needs element IDs mapped in editor (CF-03jx)
- Product Page needs cross-sell section wired up
