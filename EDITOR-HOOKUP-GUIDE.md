# Editor Hookup Guide — Element ID Map & Manual Work Queue

**Generated**: 2026-03-15 | **Last Updated**: 2026-04-04 (v3.3 — Loyalty Perks Widget (CF-c6el.3) 7 elements on Loyalty page; BundleBuilder PDP module (CF-eqc5.2) 14 elements on Product Page; weekly analytics digest (CF-u30i); mobile nav fix (CF-3zs3); bear Lottie tests (CF-tgsn.3). Previous: v3.2 — Virtual Consultation, Swatch Kit, OG images, Badge SVG fix.)
**Purpose**: Persistent reference for wiring Wix Studio editor elements to Velo code
**Approach**: Skeleton-first — place elements with correct IDs, code + CSS + CMS handle the rest

---

## Dashboard Prerequisites (updated 2026-03-16)

All required dashboard/API configurations are now in place for editor hookup:

| Prerequisite | Status | Details |
|---|---|---|
| **Wix eCommerce app** | INSTALLED | Instance: `0ac4428f-705a-446e-b638-988e94a0e869` |
| **Wix Inbox app** | INSTALLED | Instance: `bb7c1bad-cb6c-44d1-bf35-e5a7fc773ecb` |
| **Wix Pricing Plans app** | INSTALLED | Instance: `d8293f8b-51b0-42c1-9869-7e438381eb26` |
| **Wix Invoices app** | INSTALLED | Instance: `7d4ec574-6d7c-4511-bf41-c063090a508f` |
| **CF+ Monthly plan** | CREATED | Slug: `cf-plus-monthly`, $14.99/mo, ID: `85e98967-6754-4cbb-ac67-f3613ee5ae24` |
| **CF+ Annual plan** | CREATED | Slug: `cf-plus-annual`, $119.99/yr, ID: `d494d2a1-a1e2-43a3-b1bf-4d0474ddb604` |
| **UPS carrier** | CONFIGURED | Live rates + $49.99 fallback |
| **Local Pickup** | CONFIGURED | $0 (Hendersonville showroom) |
| **Local Delivery** | CONFIGURED | $49.99 flat rate |
| **CMS collections** | 28 TOTAL | All collections provisioned on staging |
| **Back In Stock** | BLOCKED | API returns NOT_SUPPORTED — needs manual dashboard toggle |
| **Wix Payments** | CONNECTED | Credit/Debit, Apple Pay, Google Pay, PayPal, Afterpay, Affirm — activates at Premium upgrade |
| **Manual Payments** | CONNECTED | In-store cash/check at Hendersonville showroom |
| **Marketing Tags** | BLOCKED | Staging not Premium — FB Pixel, GA4, TikTok blocked until go-live |

**New backend modules (merged 2026-03-16):**
- `src/backend/membershipService.web.js` — CF+ plan lookup, active membership check, cancel
- `src/public/membershipHelpers.js` — UI display helpers for membership status/CTA
- `src/backend/premiumMembership.web.js` — Premium tier features
- `src/public/premiumMembershipHelpers.js` — Premium display helpers
- Plans expect slugs `cf-plus-monthly` and `cf-plus-annual` (now created on staging)

**Current Dev Release**: v1.0.0 (2026-03-17) — 26,942 tests, 638 files, 65 src files
- Dev: [carolina-futons v1.0.0](https://github.com/DreadPirateRobertz/carolina-futons/releases/tag/v1.0.0)
- Velo: [carolina-futons-stage3-velo v1.0.0](https://github.com/DreadPirateRobertz/carolina-futons-stage3-velo/releases/tag/v1.0.0) (synced 2026-03-17)
- Pages synced to Wix page ID format (19 pages)
- 65 src files synced (backend, public, pages, styles, assets)
- **New PDP modules**: ProductOptions (variant swatches), ProductFinancing (BNPL), ProductReviews (full review system), ProductSizeGuide (dimensions + room fit checker)
- **New Homepage modules (v0.10.0)**: SocialFeedEmbed (Instagram/TikTok/Pinterest), HomeBlogTeasers (3 recent posts)
- **New backend (v0.10.0)**: blogService.web.js (web module wrapper for blog content)

**Sprint 4 modules (merged 2026-03-20-21):**
- `src/backend/socialStoryService.web.js` — scheduled social story cron (Twitter/FB/IG/Pinterest)
- `src/backend/facebookCatalogAlertService.web.js` — FB catalog staleness cron + alerts
- `src/backend/cartRecoveryService.web.js` — per-cart recovery coupons (generateRecoveryCoupon + sendRecoveryEmail)
- `src/backend/topicClusterService.web.js` — /guides/{slug} HTTP endpoint + CMS-driven topic cluster pages
- `src/backend/loyaltyService.web.js` — loyalty points endpoint with IDOR guard
- `src/backend/referralService.web.js` — referral endpoints with anti-hijack guard
- `src/backend/transactionalEmailService.web.js` — order confirmation/shipping/delivery transactional emails
- `src/backend/exitIntentCaptureService.web.js` — exit intent email capture (desktop + mobile)
- `src/public/exitIntentCapture.js` — exit intent popup logic (shouldShowExitIntent, validateCaptureEmail, submitExitCapture)
- `src/backend/styleQuiz.web.js` — S2 implementation (quiz state, scoring, recommendations)
- `src/backend/blogService.web.js` — CMS-driven blog listing via wix-blog-backend (getPublishedBlogPosts)
- `src/backend/pinterestService.web.js` — Pinterest Rich Pins og:tag validation

---

## Rate Limiting Architecture (added v1.0.0 — security hardening)

All write endpoints with `Permissions.Anyone` are rate-limited using the shared `checkRateLimit` utility.

**Utility**: `src/backend/utils/rateLimit.js`
- `checkRateLimit(collection, key, opts)` — DB-backed sliding window
- Fail-open: DB errors never block users (legitimate service outage tolerance)
- Clock injection: `opts.now` for test seams (NEVER pass from frontend — webMethods strip this)
- Default: 3 requests per 60 minutes, configurable via `opts.max` and `opts.windowMs`

**CRITICAL SECURITY RULE**: Never expose `opts` or `_opts` parameters on `Permissions.Anyone` webMethods. This would allow attackers to inject `now=0` to bypass rate limit windows.

**Rate-limited endpoints by collection:**
| Collection | Endpoint | Limit |
|---|---|---|
| `EmailRateLimit` | `sendEmail` (contactForm), `submitSwatchRequest` | 3/hr per email |
| `DeliveryRateLimit` | `scheduleDelivery` | 3/hr per email |
| `QARateLimit` | `insertGuestQuestion` | 3/hr per email |
| `ReviewRateLimit` | `submitReview` | 3/hr per email |
| `PromoRateLimit` | `redeemPromoCode` | 3/hr per email |
| `TrackingRateLimit` | `subscribeToNotifications` | 5/hr per email |

**Security fix applied (v1.0.0)**: Anonymous bucket DoS vector was patched — rate limit keys now use the caller's email/memberId, never `'anonymous'` as a fallback that creates a shared bucket across all callers.

---

## 📋 Editor Hookup Steps — Per-Page Coordination Flow (2026-03-22)

This is the exact sequence Stilgar and melania follow to wire each page. Repeat for every page.

### Who Does What

| Role | Responsibility |
|---|---|
| **Stilgar** | Builds frontend elements in Wix Studio editor (places sections, buttons, galleries, text boxes, etc.) |
| **Melania** | Reads discovery output → builds comp-ID map → generates rename script |

---

### The 6-Step Flow

**Step 1 — Stilgar builds the page frontend**
- Open Wix Studio editor → navigate to the target page
- Add all elements listed in this guide's page section (hero, buttons, gallery, text boxes, etc.)
- Rough sizing is fine — Velo code + CSS handle precise styling
- Repeater children: add elements INSIDE the repeater item template

**Step 2 — Stilgar tells melania the page is ready**
- Message: `"[PageName] is ready for hookup"`
- Include the page ID (see Page ID table below or the discovery script)

**Step 3 — Stilgar runs the Step 1 discovery script**
- Open Chrome DevTools (`F12` or `Cmd+Option+I`) inside the editor
- Switch to the `preview-frame` context (frame selector dropdown in DevTools top bar)
- Paste the **STEP 1: Discovery** script below (update `pageId` to the target page)
- Copy the full console output and paste it to melania

**Step 4 — Melania builds the comp-ID → nickname map**
- Melania reads the discovery output
- Cross-references against the target nicknames in this guide's page section
- Produces the `COMP_ID_MAP` for the rename script (compId → targetNickname)
- Sends the filled-in rename script back to Stilgar

**Step 5 — Stilgar runs the Step 2 rename script**
- Paste the **STEP 2: Rename** script (with the map melania provided) into the preview-frame console
- Script calls `setNickname()` for each element
- Confirm: re-run discovery script → all target nicknames should appear in the "Already Named" list

**Step 6 — Verify and publish**
- Velo code on that page reads elements by nickname — they now connect automatically
- Test page behaviour in preview mode
- Coordinate publish: `gt mail "PUBLISH STARTING"` → publish → `gt mail "PUBLISH DONE"`

---

### Key Constraint

> **Element nicknames MUST match this guide's target names exactly.** The Velo code uses `$w('#nickname')` to reference every element — a single character difference means the element won't connect.

---

## 🚀 Browser Console Rename — Complete Workflow (2026-03-21)

**S0 Recon confirmed**: `documentServices` is directly accessible from the Wix Studio `preview-frame`. No Hookup Assistant needed — rename everything from the browser console right now.

### ⚠️ IMPORTANT: Two Types of Elements

Most elements have **no nickname yet** — `getNickname()` returns `""`. The RENAME_MAP script only works for elements that *already have* an old auto-generated nickname (like `text19`, `box30`).

**For unnamed elements** (the majority): use the **ID-based workflow** (Step 2 below).
**For already-named elements**: use the **RENAME_MAP workflow** (Step 3 below).

---

### Setup — Do This Once

1. Open Wix Studio editor (editor.wix.com)
2. Open Chrome DevTools (`F12` or `Cmd+Option+I`)
3. Click the **frame selector dropdown** in the DevTools top bar (shows the current frame URL) → select `preview-frame`
4. You're now in the documentServices context. Run `window.documentServices` to confirm — should return an object, not undefined.

---

### STEP 1: Discovery — Run First on Every Page

Paste this into the preview-frame console to see **all elements and their current state**:

```javascript
(async () => {
  const ds = window.documentServices;
  const pageId = 'c1dmp'; // ← change to your current page ID (see table below)

  const all = ds.components.getAllComponents({ id: pageId, type: 'Page' });
  const data = all.map(ref => ({
    compId: ref.id,
    currentNick: ds.components.code.getNickname(ref) || '(none — needs ID)',
  }));

  const unnamed = data.filter(d => d.currentNick === '(none — needs ID)');
  const named   = data.filter(d => d.currentNick !== '(none — needs ID)');

  console.log(`📋 PAGE: ${pageId} | Total: ${data.length} | Unnamed: ${unnamed.length} | Already named: ${named.length}`);
  console.log('=== UNNAMED (need IDs — click each in editor to see compId):');
  console.table(unnamed);
  console.log('=== ALREADY NAMED:');
  console.table(named);
})();
```

**Reading the output**: The `compId` column is the Wix component ID (e.g. `comp-abc123`). To identify *which element* each ID belongs to: click the element in the editor → Properties & Events panel → **Element ID** field shows the same `comp-abc123`.

---

### STEP 2: Rename Unnamed Elements (by Component ID)

After clicking elements in the editor to identify them, build your map and run:

```javascript
(async () => {
  const ds = window.documentServices;
  const pageId = 'c1dmp'; // ← must match the page you're on

  // Build this map: click element in editor → Properties panel → Element ID → add here
  // Target nicknames come from EDITOR_HOOKUP_GUIDE.html for each section
  const COMP_ID_MAP = {
    // 'comp-abc123': 'heroTitle',
    // 'comp-def456': 'heroSubtitle',
    // 'comp-ghi789': 'heroCta',
    // ... add all elements for this page
  };

  const all = ds.components.getAllComponents({ id: pageId, type: 'Page' });
  const results = [];

  for (const compRef of all) {
    const target = COMP_ID_MAP[compRef.id];
    if (!target) continue;

    const v = ds.components.code.validateNickname(compRef, target);
    if (v !== 'VALID') {
      results.push({ id: compRef.id, to: target, status: 'SKIP:' + v });
      continue;
    }

    ds.components.code.setNickname(compRef, target);
    await new Promise(r => setTimeout(r, 150));
    const confirmed = ds.components.code.getNickname(compRef);
    results.push({ id: compRef.id, to: target, status: confirmed === target ? '✅ OK' : '❌ FAIL' });
  }

  console.table(results);
  console.log('Done. Re-run Step 1 to verify.');
})();
```

---

### STEP 3: Rename Already-Named Elements (by Current Nickname)

For elements that already have auto-generated nicknames (e.g. `text19 → heroTitle`, `box30 → trustBar`):

```javascript
(async () => {
  const ds = window.documentServices;
  const pageId = 'c1dmp'; // ← change per page

  // Map auto-generated nickname → target nickname
  // Run Step 1 first to see what names already exist
  const RENAME_MAP = {
    // 'text19':        'heroTitle',
    // 'vectorImage8':  'heroSkyline',
    // 'expandableMenu1': 'navMenu',
  };

  const all = ds.components.getAllComponents({ id: pageId, type: 'Page' });
  const results = [];

  for (const compRef of all) {
    const current = ds.components.code.getNickname(compRef);
    const target = RENAME_MAP[current];
    if (!target) continue;

    const v = ds.components.code.validateNickname(compRef, target);
    if (v !== 'VALID') { results.push({ from: current, to: target, status: 'SKIP:' + v }); continue; }

    ds.components.code.setNickname(compRef, target);
    await new Promise(r => setTimeout(r, 150));
    const confirmed = ds.components.code.getNickname(compRef);
    results.push({ from: current, to: target, status: confirmed === target ? '✅' : '❌', id: compRef.id });
  }

  console.table(results);
})();
```

---

### Core API Reference

```javascript
const ds = window.documentServices;

ds.components.getAllComponents({ id: 'c1dmp', type: 'Page' }) // → compRef[]
ds.components.code.getNickname(compRef)                        // → string ('' if none)
ds.components.code.setNickname(compRef, 'heroTitle')          // no return — wait 150ms
ds.components.code.validateNickname(compRef, 'heroTitle')     // → 'VALID' | 'ALREADY_EXISTS' | 'TOO_SHORT' | 'TOO_LONG' | 'INVALID_NAME'
```

### Nickname Rules
- **camelCase alphanumeric only** — `heroTitle`, `footerEmailSubmit`, `box1` ✅
- **No underscores, spaces, or dashes** — `hero_title` ❌ `hero title` ❌
- **No duplicates site-wide** — each nickname must be unique across all pages
- **Case sensitive** — `heroTitle` ≠ `HeroTitle`
- **Allow 150–200ms** after `setNickname` before calling `getNickname` to verify

### Already Named (confirmed working from S0 recon)
These 4 footer elements are already correctly named — skip them:
- `footerContactInfo` ✅
- `footerEmailSubmit` ✅
- `footerNewsletterTitle` ✅
- `footerNewsletterSubtitle` ✅

### All Page IDs (confirmed 2026-03-21)

| Page | Wix ID | URI |
|------|--------|-----|
| **Home** | **c1dmp** | /home |
| **Product Page** | **ve2z7** | /product-page |
| **Category Page** | **u0gn0** | /category-page |
| **Cart Page** | **mqi5m** | /cart-page |
| **Checkout** | **psuom** | /checkout |
| **Search Results** | **evr2j** | /search |
| **FAQ** | **s2c5g** | /faq |
| **About** | **gar3e** | /about |
| **Contact** | **k14wx** | /contact |
| **Shipping Policy** | **ype8c** | /shipping-policy |
| Blog | kkbdq | /blog |
| Post | naud5 | /post |
| Style Quiz | nwjfa | /blank-1 |
| Admin Returns | qoc25 | /blank |
| Member Page | f00pg | /members-area |
| Members | ws9sh | /members |
| Thank You | msuhj | /thank-you |
| Thank You Page | dk9x8 | /thank-you-page |
| White Glove Delivery | *(create)* | /white-glove-delivery |
| Admin Delivery Calendar | *(create)* | /admin-delivery-calendar |
| Plans & Pricing | aggpq | /plans-pricing |
| Paywall | w6yh4 | /paywall |
| Privacy Policy | pcvmd | /privacy-policy |
| Refund Policy | jmwgj | /refund-policy |
| Terms & Conditions | z0xvf | /terms-and-conditions |
| Accessibility | di5bl | /accessibility-statement |
| Checkout | psuom | /checkout |
| Book Online | u3ysd | /book-online |
| Booking Form | xr7ty | /booking-form |
| Service Page | n31or | /service-page |

---

## How to Use This Guide

For each section below:
1. **Add the Wix element** (type listed in "Wix Element" column) to the editor
2. **Rename its ID** via Properties & Events panel (bottom of editor, click element → see `# elementId` field)
3. **Size roughly** — code/CSS handles precise styling, just get it in the right area
4. **Repeater children**: Add elements INSIDE the repeater's item template, rename each child ID

### Wix Element Type Key
| Abbreviation | Wix Studio Element | Where to Find |
|---|---|---|
| **Section** | Section | Add Elements → Section |
| **Box** | Container Box | Add Elements → Container |
| **Text** | Text element | Add Elements → Text |
| **Button** | Button | Add Elements → Button |
| **Image** | Image | Add Elements → Image |
| **Repeater** | Repeater | Add Elements → Lists & Grids → Repeater |
| **Input** | Text Input | Add Elements → Input |
| **TextBox** | Text Box (multiline) | Add Elements → Input → Text Box |
| **Dropdown** | Dropdown | Add Elements → Input → Dropdown |
| **Toggle** | Toggle Switch | Add Elements → Input → Toggle |
| **ProgressBar** | Progress Bar | Add Elements → Decorative |
| **HtmlComponent** | HTML iframe / Embed | Add Elements → Embed → HTML |
| **Video** | Video Player | Add Elements → Video |
| **Dataset** | Wix Dataset | Add Elements → CMS → Dataset |
| **Gallery** | Gallery | Add Elements → Gallery |
| **DatePicker** | Date Picker | Add Elements → Input → Date Picker |
| **CheckboxGroup** | Checkbox Group | Add Elements → Input → Checkbox Group |
| **RadioButton** | Radio Button | Add Elements → Input → Radio |

---

## Page Estimates Summary

| Page | Elements | Repeaters | Est. Manual Work | Priority |
|---|---|---|---|---|
| **Home** | ~75 | 4 + children | 45 min | P0 — above fold |
| **masterPage** (global) | ~105 | 3 + children | 60 min | P0 — every page |
| **Product Page** | ~120 | 11 + children | 90 min | P0 — revenue (expanded: options, financing, reviews, size guide) |
| **Category Page** | ~80 | 6 + children | 60 min | P0 — navigation |
| **Cart Page** | ~45 | 4 + children | 35 min | P1 — checkout flow |
| **Side Cart** | ~30 | 2 + children | 25 min | P1 — checkout flow |
| **Checkout** | ~65 | 6 + children | 50 min | P1 — checkout flow |
| **Search Results** | ~30 | 3 + children | 25 min | P1 — discovery |
| **Member Page** | ~70 | 8 + children | 55 min | P2 — post-login |
| **Contact** | ~40 | 4 + children | 30 min | P2 — support |
| **About** | ~25 | 5 + children | 20 min | P2 — brand |
| **FAQ** | ~15 | 2 + children | 15 min | P2 — support |
| **Thank You** | ~44 | 3 + children | 30 min | P2 — post-purchase |
| **White Glove Delivery** | ~20 | 5 + children | 25 min | P2 — scheduling (NEW CF-y7lp) |
| **Admin Delivery Calendar** | ~15 | 2 + children | 20 min | P2 — admin (NEW CF-y7lp) |
| **Admin A/B Tests** | ~14 | 3 + children | 20 min | P2 — admin (NEW CF-0jk5) |
| **Shipping Policy** | ~20 | 4 + children | 20 min | P3 — info |
| **Fullscreen/Videos** | ~15 | 2 + children | 15 min | P3 — content |
| **Privacy Policy** | ~15 | 2 + children | 10 min | P3 — legal |
| **Terms & Conditions** | ~15 | 2 + children | 10 min | P3 — legal |
| **Refund Policy** | ~5 | 1 + children | 5 min | P3 — legal |
| **Search Suggestions** | ~5 | 1 + children | 5 min | P3 — overlay |
| **Accessibility Stmt** | 0 | 0 | 0 min | Done — no elements |
| **TOTAL** | **~745** | **~64** | **~9.5 hours** | |

---

## HOME PAGE (`Home.c1dmp.js`)

### Hero Section
| Element ID | Wix Element | Notes |
|---|---|---|
| `heroSection` | Section | Full-width, bg set by code (`#3A2518`) |
| `heroBg` | Image | Hero background image, code sets `.src` |
| `heroOverlay` | Box | Transparent overlay, code sets bg color |
| `heroTitle` | Text | H1, code sets text |
| `heroSubtitle` | Text | Subheading, code sets text |
| `heroCTA` | Button | "Shop Now" — code sets label + onClick |
| `heroSkyline` | Box | Mountain skyline animation container |

### Featured Products ⚠️ REPEATER
| Element ID | Wix Element | Notes |
|---|---|---|
| `featuredTitle` | Text | Section heading |
| `featuredSubtitle` | Text | Section subheading |
| `featuredSkeleton` | Box | Loading placeholder, starts visible |
| `featuredRepeater` | **Repeater** | **4 product cards** |
| `featuredQuickViewModal` | Box | Hidden modal dialog |
| `featuredQvImage` | Image | Modal child |
| `featuredQvName` | Text | Modal child |
| `featuredQvPrice` | Text | Modal child |
| `featuredQvViewFull` | Button | Modal child |
| `featuredQvAddToCart` | Button | Modal child |
| `featuredQvClose` | Button | Modal child — X button |

**↳ Inside `featuredRepeater` item template:**
| Child ID | Wix Element | Notes |
|---|---|---|
| `featuredCard` | Box | Card container |
| `featuredImage` | Image | Product image |
| `featuredName` | Text | Product name |
| `featuredPrice` | Text | Current price |
| `featuredOriginalPrice` | Text | Strikethrough price |
| `featuredSaleBadge` | Text | "X% OFF" badge |
| `featuredRibbon` | Text | "New" / "Sale" ribbon |
| `featuredColorText` | Text | "Available in X colors" |
| `featuredSwatchContainer` | Box | Color swatch dots container |
| `featuredQuickViewBtn` | Button | Quick view trigger |

### Sale Products ⚠️ REPEATER
| Element ID | Wix Element | Notes |
|---|---|---|
| `saleSection` | Section | Collapsible — hides if no sales |
| `saleSkeleton` | Box | Loading placeholder |
| `saleRepeater` | **Repeater** | Sale product cards |

**↳ Inside `saleRepeater` item template:**
| Child ID | Wix Element | Notes |
|---|---|---|
| `saleCard` | Box | Card container |
| `saleImage` | Image | Product image |
| `saleName` | Text | Product name |
| `salePrice` | Text | Sale price |
| `saleOrigPrice` | Text | Original price (strikethrough) |

### Category Cards ⚠️ REPEATER
| Element ID | Wix Element | Notes |
|---|---|---|
| `categorySkeleton` | Box | Loading placeholder |
| `categoryRepeater` | **Repeater** | 8 category cards |

**↳ Inside `categoryRepeater` item template:**
| Child ID | Wix Element | Notes |
|---|---|---|
| `categoryCard` | Box | Card with bg image |
| `categoryCardTitle` | Text | Category name |
| `categoryCardTagline` | Text | Category tagline |
| `categoryCardCount` | Text | Product count |
| `categoryCardImage` | Image | Category image |

### Trust Bar ✅ SECTION RENAMED
| Element ID | Wix Element | Notes |
|---|---|---|
| `trustBar` | Box/Section | ✅ Already renamed. Espresso bg `#3A2518`. |
| `trustItem1` | Box | Trust signal container |
| `trustIcon1` | Text | Emoji icon (🚚, etc.) |
| `trustText1` | Text | Signal text |
| `trustItem2` | Box | Trust signal container |
| `trustIcon2` | Text | Emoji icon |
| `trustText2` | Text | Signal text |
| `trustItem3` | Box | Trust signal container |
| `trustIcon3` | Text | Emoji icon |
| `trustText3` | Text | Signal text |
| `trustItem4` | Box | Trust signal container (may be hidden) |
| `trustIcon4` | Text | Emoji icon |
| `trustText4` | Text | Signal text |
| `trustItem5` | Box | Trust signal container |
| `trustIcon5` | Text | Emoji icon |
| `trustText5` | Text | Signal text |

### Testimonials ⚠️ REPEATER
| Element ID | Wix Element | Notes |
|---|---|---|
| `testimonialSection` | Section | Container |
| `testimonialRepeater` | **Repeater** | Rotating testimonials |
| `testimonialSchemaScript` | HtmlComponent | SEO schema injection (code uses `testimonialSchemaScript`) |
| `testimonialSlideshow` | Box | Slideshow wrapper |
| `testimonialPauseBtn` | Button | Pause/play toggle |

**↳ Inside `testimonialRepeater` item template:**
| Child ID | Wix Element | Notes |
|---|---|---|
| `testimonialQuote` | Text | Quote text |
| `testimonialName` | Text | Customer name |
| `testimonialPhoto` | Image | Customer photo |
| `testimonialRating` | Text | Star rating (text) |

### Recently Viewed
| Element ID | Wix Element | Notes |
|---|---|---|
| `recentSection` | Section | Collapsible, expands when data exists |
| `recentRepeater` | **Repeater** | Recently viewed products |

**↳ Repeater children (shared pattern):**
`recentImage` (Image), `recentName` (Text), `recentPrice` (Text), `recentAddToCart` (Button)

### Continue Shopping (NEW v1.2.0+ — PR #665 / CF-ku3x) ⚠️ REPEATER
*Source: `src/public/ContinueShoppingSection.js` — `initContinueShoppingSection($w, { excludeId })`*
*No backend call — reads `ProductHistory` LRU from sessionStorage.*

| Element ID | Wix Element | Notes |
|---|---|---|
| `continueShoppingSection` | Section | **Collapsed/hidden by default** — code shows only when browsing history exists. First-time visitors never see it. |
| `continueShoppingTitle` | Text | Section heading — code sets to "Continue Shopping" |
| `continueShoppingRepeater` | **Repeater** | Horizontal scroll strip — last 1–6 viewed products |

**↳ Inside `continueShoppingRepeater` item template:**
`continueShoppingImage` (Image), `continueShoppingName` (Text), `continueShoppingPrice` (Text), `continueShoppingLink` (Button — navigates to product page)

### Video Showcase
| Element ID | Wix Element | Notes |
|---|---|---|
| `videoShowcaseSection` | Section | Collapsible |
| `videoShowcaseTitle` | Text | Section heading |
| `videoShowcaseSubtitle` | Text | Subheading |
| `viewAllVideosCTA` | Button | Link to videos page |
| `videoThumb1` | Image | Clickable video thumbnail |
| `videoThumb2` | Image | Clickable video thumbnail |
| `videoThumb3` | Image | Clickable video thumbnail |

### Smooth Scroll Triggers
| Element ID | Wix Element | Notes |
|---|---|---|
| `scrollToFeatured` | Button | Scroll to featured section |
| `scrollToCategories` | Button | Scroll to categories |
| `scrollToSale` | Button | Scroll to sale section |
| `scrollToReviews` | Button | Scroll to reviews |

### Quiz CTA
| Element ID | Wix Element | Notes |
|---|---|---|
| `quizCTASection` | Section | Collapsible |
| `quizCTATitle` | Text | "Find Your Perfect Futon" |
| `quizCTASubtitle` | Text | Description |
| `quizCTAButton` | Button | Start quiz |

### Swatch Promo
| Element ID | Wix Element | Notes |
|---|---|---|
| `swatchPromoSection` | Section | Container |
| `swatchPromoTitle` | Text | Heading |
| `swatchPromoSubtitle` | Text | Subheading |
| `swatchPromoCTA` | Button | Order swatches |

### Blog Teasers (CF-iix7)
| Element ID | Wix Element | Notes |
|---|---|---|
| `blogTeaserSection` | HtmlComponent | Blog post cards — code injects HTML grid of 3 recent posts via `HomeBlogTeasers.js` |

### Social Feeds (CF-iix7)
| Element ID | Wix Element | Notes |
|---|---|---|
| `instagramFeedContainer` | HtmlComponent | Instagram embed iframe — code injects via `SocialFeedEmbed.js` |
| `tiktokFeedContainer` | HtmlComponent | TikTok follow card — code injects via `SocialFeedEmbed.js` |
| `pinterestBoardContainer` | HtmlComponent | Pinterest follow card — code injects via `SocialFeedEmbed.js` |

### Newsletter
| Element ID | Wix Element | Notes |
|---|---|---|
| `newsletterSection` | Section | Container |
| `newsletterTitle` | Text | Heading |
| `newsletterSubtitle` | Text | Subheading |
| `newsletterEmail` | Input | Email field |
| `newsletterSubmit` | Button | Subscribe button |
| `newsletterSuccess` | Text | Hidden, shown on success |
| `newsletterError` | Text | Hidden, shown on error |

### Gift Card Section (PR #533 — CF-mwpw)
Add to **Home page**:

| Element ID | Wix Element | Notes |
|---|---|---|
| `giftCardSection` | Section/Box | Hero CTA section for gift cards — collapsed if gift cards disabled |
| `giftCardHeading` | Text | "Give the gift of great furniture" |
| `giftCardDesc` | Text | Description text |
| `giftCardBtn` | Button | "Shop Gift Cards" → links to /gift-cards |

### SEO / Decorative
| Element ID | Wix Element | Notes |
|---|---|---|
| `websiteSchemaHtml` | HtmlComponent | SEO schema |
| `ridgelineHeader` | Box | Mountain skyline illustration |
| `section4` | Section | Collapsible misc section |

---

## MASTER PAGE (`masterPage.js`) — Global, appears on every page

### Accessibility
| Element ID | Wix Element | Notes |
|---|---|---|
| `mainContent` | Section | Skip-nav target |
| `skipToContent` | Button | Skip navigation link |
| `a11yLiveRegion` | Text | Hidden, screen reader announcements |

### Navigation
| Element ID | Wix Element | Notes |
|---|---|---|
| `navHome` | Text | Nav link |
| `navShop` | Text | Nav link |
| `navFutonFrames` | Text | Nav link |
| `navMattresses` | Text | Nav link |
| `navMurphy` | Text | Nav link |
| `navPlatformBeds` | Text | Nav link |
| `navSale` | Text | Nav link |
| `navProductVideos` | Text | Nav link |
| `navGettingItHome` | Text | Nav link |
| `navContact` | Text | Nav link |
| `navFAQ` | Text | Nav link |
| `navAbout` | Text | Nav link |
| `navBlog` | Text | Nav link |
| `navFreeSwatches` | Text | Nav link |
| `siteLogo` | Image | Logo image |
| `headerSearchInput` | Input | Search bar |
| `megaMenuPanel` | Box | Mega menu dropdown panel |
| `desktopNavBar` | Box | Desktop nav container |
| `productTitle` | Text | Read-only, LiveChat context |

### Mobile Drawer
| Element ID | Wix Element | Notes |
|---|---|---|
| `mobileMenuButton` | Button | Hamburger menu toggle |
| `mobileMenuOverlay` | Box | Full-screen mobile drawer |
| `mobileMenuClose` | Button | Close drawer |
| `mobileSearchInput` | Input | Mobile search input |
| `mobileNavHome` | Text | Mobile nav link |
| `mobileNavShop` | Text | Mobile nav link |
| `mobileNavFutonFrames` | Text | Mobile nav link |
| `mobileNavMattresses` | Text | Mobile nav link |
| `mobileNavMurphy` | Text | Mobile nav link |
| `mobileNavPlatformBeds` | Text | Mobile nav link |
| `mobileNavSale` | Text | Mobile nav link |
| `mobileNavContact` | Text | Mobile nav link |
| `mobileNavFAQ` | Text | Mobile nav link |
| `mobileNavAbout` | Text | Mobile nav link |

### Cart (global)
| Element ID | Wix Element | Notes |
|---|---|---|
| `cartIcon` | Image | Cart icon, clickable |
| `cartBadge` | Text | Item count badge |
| `sideCartPanel` | Box | Slide-in panel |
| `justAddedHighlight` | Box | Just-added animation |

### Header Shipping Progress
| Element ID | Wix Element | Notes |
|---|---|---|
| `headerShippingBar` | ProgressBar | Free shipping progress |
| `headerShippingText` | Text | "$X away from free shipping" |
| `headerSkyline` | Box | Mountain skyline illustration |

### Schema
| Element ID | Wix Element | Notes |
|---|---|---|
| `businessSchemaHtml` | HtmlComponent | Business schema |
| `websiteSchemaHtml` | HtmlComponent | Website schema |

### Breadcrumbs
| Element ID | Wix Element | Notes |
|---|---|---|
| `breadcrumb1` | Text | Breadcrumb level 1 |
| `breadcrumb2` | Text | Breadcrumb level 2 |
| `breadcrumb3` | Text | Breadcrumb level 3 |
| `breadcrumbSchemaHtml` | HtmlComponent | Breadcrumb JSON-LD |

### Announcement Bar
*Source: `src/backend/AnnouncementBarService.web.js` — `getActiveAnnouncementBar()` (CF-6y24, NEW v1.1.0+)*
*CMS: `AnnouncementBars` collection — fields: message, linkUrl, backgroundColor, textColor, active, priority, startDate, endDate*
| Element ID | Wix Element | Notes |
|---|---|---|
| `announcementBar` | Box | Container — bg color set from CMS |
| `announcementText` | Text | Message text — rotates through active bars |
| `announcementBarLink` | Button | CTA link — shown when CMS bar has `linkUrl` (HTTPS-only), hidden otherwise. **Updated PR #658 / CF-qw65** |
| `announcementDismiss` | Button | Dismiss button |

### Sticky Nav / Back to Top
| Element ID | Wix Element | Notes |
|---|---|---|
| `headerStrip` | Box | Header container for sticky nav |
| `backToTop` | Button | Back-to-top button |

### Promo Lightbox ⚠️ REPEATER
| Element ID | Wix Element | Notes |
|---|---|---|
| `promoLightbox` | Box | Modal dialog |
| `promoOverlay` | Box | Background overlay |
| `promoClose` | Button | Close X |
| `promoDismiss` | Button | "No thanks" link |
| `promoTitle` | Text | Promo heading |
| `promoSubtitle` | Text | Promo subheading |
| `promoHeroImage` | Image | Promo banner image |
| `promoCode` | Text | Discount code |
| `promoCopyCode` | Button | Copy code button |
| `promoCTA` | Button | Shop now |
| `promoCountdown` | Text | Timer countdown |
| `promoRepeater` | **Repeater** | Featured promo products |
| `promoEmailInput` | Input | Email capture |
| `promoEmailSubmit` | Button | Submit email |

**↳ Inside `promoRepeater` item template:**
`promoImage` (Image), `promoName` (Text), `promoPrice` (Text), `promoOrigPrice` (Text), `promoQuickAdd` (Button)

### Newsletter Modal
| Element ID | Wix Element | Notes |
|---|---|---|
| `newsletterModalTrigger` | Button | Open modal |
| `newsletterModal` | Box | Modal panel |
| `newsletterModalClose` | Button | Close X |
| `newsletterModalOverlay` | Box | Background overlay |
| `newsletterModalEmail` | Input | Email field |
| `newsletterModalSubmit` | Button | Subscribe |
| `newsletterModalError` | Text | Error message |
| `newsletterModalSuccess` | Text | Success message |

### Exit Intent Popup
| Element ID | Wix Element | Notes |
|---|---|---|
| `exitIntentPopup` | Box | Slide-in popup |
| `exitOverlay` | Box | Background overlay |
| `exitClose` | Button | Close X |
| `exitTitle` | Text | Heading |
| `exitSubtitle` | Text | Subheading |
| `exitEmailInput` | Input | Email field |
| `exitEmailSubmit` | Button | Submit |
| `exitEmailError` | Text | Error message |
| `exitSuccess` | Text | Success message |
| `exitSwatchLink` | Button | Swatch link |
| `exitDragHandle` | Box | Mobile bottom sheet handle |

### Footer Accordions (mobile)
| Element ID | Wix Element | Notes |
|---|---|---|
| `footerShopHeader` | Text | Accordion header |
| `footerShopLinks` | Box | Accordion content |
| `footerServiceHeader` | Text | Accordion header |
| `footerServiceLinks` | Box | Accordion content |
| `footerAboutHeader` | Text | Accordion header |
| `footerAboutLinks` | Box | Accordion content |

### PWA Install Banner
| Element ID | Wix Element | Notes |
|---|---|---|
| `installBanner` | Box | Slide-in banner |
| `installBannerText` | Text | Install prompt text |
| `installBannerBtn` | Button | Install button |
| `installBannerDismiss` | Button | Dismiss button |

### Footer ⚠️ REPEATERS
| Element ID | Wix Element | Notes |
|---|---|---|
| `siteFooter` | Section | Footer container |
| `footerLogo` | Image | Footer logo |
| `footerStoreName` | Text | Store name |
| `footerStoreAddress` | Text | Address |
| `footerStorePhone` | Text | Phone |
| `footerStoreHours` | Text | Hours |
| `footerCopyright` | Text | Copyright text |
| `footerMountainDivider` | HtmlComponent | Mountain SVG divider |
| `footerShopHeading` | Text | Column heading |
| `footerShopRepeater` | **Repeater** | Shop links |
| `footerServiceHeading` | Text | Column heading |
| `footerServiceRepeater` | **Repeater** | Service links |
| `footerAboutHeading` | Text | Column heading |
| `footerAboutRepeater` | **Repeater** | About links |
| `footerBadgeRepeater` | **Repeater** | Trust badges |
| `footerPaymentRepeater` | **Repeater** | Payment icons |
| `footerSocialRepeater` | **Repeater** | Social icons |
| `socialFacebook` | Button | Facebook link |
| `socialInstagram` | Button | Instagram link |
| `socialPinterest` | Button | Pinterest link |
| `footerEmailInput` | Input | Newsletter email |
| `footerEmailSubmit` | Button | Newsletter submit |
| `footerEmailError` | Text | Error message |
| `footerEmailSuccess` | Text | Success message |

**↳ Inside `footerShopRepeater` / `footerServiceRepeater` / `footerAboutRepeater`:**
| Child ID | Wix Element | Notes |
|---|---|---|
| `footerLink` | Text | Link text |

**↳ Inside `footerBadgeRepeater`:**
| Child ID | Wix Element | Notes |
|---|---|---|
| `badgeIcon` | Text | Badge icon |
| `badgeLabel` | Text | Badge label |

**↳ Inside `footerPaymentRepeater`:**
`paymentIcon` (Text)

**↳ Inside `footerSocialRepeater`:**
`socialIcon` (Text)

### Living Sky (Phase 7 + Phase 8 COMPLETE ✅)
*Source: `masterPage.js` — dynamic import of `living-sky-wix.js`, 60s tick loop; `src/public/living-sky-component.html` embedded in HtmlComponent*
| Element ID | Wix Element | Notes |
|---|---|---|
| `livingSkyFrame` | HtmlComponent | Animated Living Sky SVG host; receives `LivingSkyState` via `postMessage`; `prefers-reduced-motion` = single render, no tick |

**Integration notes:**
- `masterPage.js` calls `updateSkyToState($w, state)` every 60s, which posts raw state object (no `type` wrapper) to `#livingSkyFrame`
- Consumers subscribe: `$w('#livingSkyFrame').onMessage(e => ...)` — state shape: `{ ridgeColors: {r1–r7, tree}, skyColors: ['#hex',...], starOpacity: 0–1, weather }`

**Phase 8 COMPLETE (2026-03-23) — All 6 illustration modules wired to LivingSkyState via onMessage:**
| Module | File | PR | Status |
|---|---|---|---|
| `footerMountainDivider` | `FooterSection.js` | #752 | ✅ merged |
| `comfortIllustrations` | `comfortIllustrations.js` | #773 | ✅ merged |
| `onboardingIllustrations` | `onboardingIllustrations.js` | #774 | ✅ merged |
| `emptyStateIllustrations` | `emptyStateIllustrations.js` | #775 | ✅ merged |
| `aboutIllustrations` | `aboutIllustrations.js` | #777 | ✅ merged |
| `CartIllustrations` | `CartIllustrations.js` | #776 | ✅ merged |

**catch-path hardening (PR #776 / cf-dnz):** All onMessage handlers have inner try/catch — errors logged to `console.error('[module] onMessage handler failed:')` and suppressed (never propagate). Validated by catch-path tests (#778).

**State shape:** `{ ridgeColors: {r1–r7, tree}, skyColors: ['#hex',...], starOpacity: 0–1, weather: string }`

---

## PRODUCT PAGE (`Product Page.ve2z7.js`)

### Product Info
| Element ID | Wix Element | Notes |
|---|---|---|
| `productDataset` | Dataset | Connect to Stores/Products |
| `productName` | Text | H1 product name |
| `productPrice` | Text | Current price |
| `productMainImage` | Image | Main product image |
| `productDescription` | Text | Product description |
| `productComparePrice` | Text | Original price (hidden if no sale) |
| `addToCartButton` | Button | Add to cart |
| `quantityInput` | Input | Quantity field |
| `quantityMinus` | Button | Decrease qty |
| `quantityPlus` | Button | Increase qty |
| `buyNowButton` | Button | Buy now / express checkout |
| `productHeroSkyline` | Box | Mountain skyline decoration |

### Related Products ⚠️ REPEATER
| Element ID | Wix Element | Notes |
|---|---|---|
| `relatedSection` | Section | Collapsible |
| `relatedRepeater` | **Repeater** | Related product cards |

**↳ Inside `relatedRepeater`:** `relatedImage` (Image), `relatedName` (Text), `relatedPrice` (Text), `relatedBadge` (Text)

### Collection Products ⚠️ REPEATER
| Element ID | Wix Element | Notes |
|---|---|---|
| `collectionSection` | Section | Collapsible |
| `collectionRepeater` | **Repeater** | Same-collection products |

**↳ Inside `collectionRepeater`:** `collectionImage` (Image), `collectionName` (Text), `collectionPrice` (Text)

### Recently Viewed ⚠️ REPEATER
*Source: `src/public/ProductHistory.js` — `trackView(productId)` on page load, `getRecentlyViewed()` to populate repeater*
| Element ID | Wix Element | Notes |
|---|---|---|
| `recentlyViewedSection` | Section | Collapsible |
| `recentlyViewedRepeater` | **Repeater** | Recently viewed products |

**↳ Inside:** `recentImage` (Image), `recentName` (Text), `recentPrice` (Text), `recentAddToCart` (Button)

### Also Bought ⚠️ REPEATER
| Element ID | Wix Element | Notes |
|---|---|---|
| `alsoBoughtSection` | Section | Collapsible |
| `alsoBoughtRepeater` | **Repeater** | Frequently bought together |

**↳ Inside:** `alsoBoughtImage` (Image), `alsoBoughtName` (Text), `alsoBoughtPrice` (Text), `alsoBoughtBadge` (Text), `alsoBoughtAddToCart` (Button)

### Product Options / Variant Swatches (NEW v0.9.0+)
*Source: `src/public/ProductOptions.js`*

| Element ID | Wix Element | Notes |
|---|---|---|
| `sizeDropdown` | Dropdown | Size variant selector |
| `finishDropdown` | Dropdown | Finish/color variant selector |
| `productPrice` | Text | *(shared)* Updated on variant change |
| `productComparePrice` | Text | *(shared)* Strikethrough price |
| `productMainImage` | Image | *(shared)* Updated on variant select |
| `productGallery` | Gallery | Product image gallery |
| `stockStatus` | Text | In Stock / Low Stock / Out of Stock badge |
| `finishSwatches` | Box | Visual swatch dot container |
| `swatchSection` | Section | Collapsible swatch section |
| `swatchCount` | Text | "Showing X of Y available fabrics" |
| `swatchViewAll` | Button | Opens full swatch gallery |
| `swatchRequestLink` | Button | Request free swatch link |

### Financing (v0.9.0+ — `ProductFinancing.js`)

| Element ID | Wix Element | Notes |
|---|---|---|
| `financingSection` | Section | Collapsible financing area |
| `financingTeaser` | Text | "As low as $X/mo" teaser |
| `afterpayMessage` | Text | Afterpay 4-payment breakdown |
| `financingLearnMore` | Button | Opens financing detail overlay |
| `financingOverlay` | Box | Modal overlay background |
| `financingModal` | Box | Modal content container |
| `financingModalTitle` | Text | Modal title (ARIA dialog title) |
| `financingClose` | Button | Close modal — X button |

**⚠️ REPEATER — Financing Plans (`financingRepeater`):**

| Child ID | Wix Element | Notes |
|---|---|---|
| `planLabel` | Text | Plan label (e.g. "Afterpay", "12 months") |
| `planMonthly` | Text | Monthly payment amount |
| `planDescription` | Text | Plan description |
| `planInterest` | Text | Interest/APR display |

**⚠️ REPEATER — Term Pills (`financingTermPills`):**

| Child ID | Wix Element | Notes |
|---|---|---|
| `termMonths` | Text | Term length (e.g. "12mo") |
| `termPayment` | Text | Monthly payment (e.g. "$45/mo") |
| `termZeroBadge` | Box | "0% APR" badge — shown for zero-interest terms |
| `termPill` | Box | Pill container — needs `ariaLabel` |

**⚠️ REPEATER — Financing Detail (`financingDetailRepeater`) — inside modal:**

| Child ID | Wix Element | Notes |
|---|---|---|
| `detailLabel` | Text | Detail label |
| `detailMonthly` | Text | Monthly amount |
| `detailApr` | Text | APR display |
| `detailInterest` | Text | Interest amount |

### Reviews & Ratings (NEW v0.9.0+)
*Source: `src/public/ProductReviews.js`*

| Element ID | Wix Element | Notes |
|---|---|---|
| `reviewsSection` | Section | Collapsible reviews area |
| `reviewsAverage` | Text | Average rating (e.g. "4.5") |
| `reviewsCount` | Text | Total review count |
| `ratingBar1`–`ratingBar5` | Box | Star distribution bars |
| `ratingCount1`–`ratingCount5` | Text | Count per star level |
| `histogramBar1`–`histogramBar5` | Box | Visual histogram bars |
| `histogramPercent1`–`histogramPercent5` | Text | Percentage per star |
| `reviewsSortDropdown` | Dropdown | Sort by: Most Recent, Highest, etc. |
| `reviewsEmptyState` | Box | "No reviews yet" message |
| `reviewSchemaMarkup` | HtmlComponent | JSON-LD structured data |

**⚠️ REPEATER — Review List:**

| Element ID | Wix Element | Notes |
|---|---|---|
| `reviewsRepeater` | **Repeater** | Individual review cards |
| `reviewsNextBtn` | Button | Pagination next |
| `reviewsPrevBtn` | Button | Pagination prev |
| `reviewsPageInfo` | Text | "Page X of Y" |

**Star Filters:**
`starFilterAll` (Button), `starFilter1`–`starFilter5` (Button)

**Review Submission Form:**

| Element ID | Wix Element | Notes |
|---|---|---|
| `reviewSubmitBtn` | Button | Open/submit review form |
| `reviewRatingInput` | Input | Star rating selector |
| `reviewTitleInput` | Input | Review title |
| `reviewBodyInput` | TextBox | Review body text |
| `reviewForm` | Box | Form container (collapses on success) |
| `reviewFormError` | Text | Error message |
| `reviewFormSuccess` | Text | Success message |
| `reviewPhotoUpload` | Button | Upload review photo |
| `reviewPhotoStatus` | Text | Upload status label |
| `reviewPhotoCount` | Text | "X/3 photos" counter |
| `reviewPhotoPreview` | **Repeater** | Photo thumbnail previews |

### Size Guide & Room Fit (NEW v0.9.0+)
*Source: `src/public/ProductSizeGuide.js`*

| Element ID | Wix Element | Notes |
|---|---|---|
| `dimensionSection` | Section | Collapsible dimensions area |
| `dimensionTitle` | Text | "Dimensions" heading |
| `dimensionPlaceholder` | Text | "Coming soon" / error fallback |
| `dimensionGrid` | Box | Dimension data grid |
| `unitToggle` | Toggle | Imperial ↔ Metric switch |
| `productWeight` | Text | "Weight: X lbs" |
| `mattressSize` | Text | "Mattress Size: Full/Queen" |
| `closedDimsLabel` | Text | "Closed (Sofa Position)" |
| `closedDims` | Text | W × D × H closed |
| `openDimsLabel` | Text | "Open (Bed Position)" |
| `openDims` | Text | W × D × H open |
| `seatHeight` | Text | Seat height measurement |
| `dimensionDiagramHtml` | HtmlComponent | SVG dimension diagram |
| `diagramPositionToggle` | Toggle | Closed ↔ Open diagram view |
| `dimensionOverlayBtn` | Button | Toggle dimension overlay |
| `dimensionOverlaySvg` | HtmlComponent | SVG overlay on product image |

**Room Fit Checker:**

| Element ID | Wix Element | Notes |
|---|---|---|
| `roomFitTitle` | Text | "Will It Fit?" heading |
| `doorwayWidth` | Input | Doorway width (inches) |
| `doorwayHeight` | Input | Doorway height (inches) |
| `hallwayWidth` | Input | Hallway width (inches) |
| `roomWidth` | Input | Room width (inches) |
| `roomDepth` | Input | Room depth (inches) |
| `checkFitBtn` | Button | "Check Fit" action |
| `fitResultText` | Text | Fit result summary |
| `fitResultSection` | Box | Result container |
| `roomFitCallout` | Box | Highlighted callout |

**Shipping Dimensions:**
`shippingDimsRow` (Box), `shippingDimsLabel` (Text), `shippingDims` (Text), `shippingWeight` (Text)

**Size Comparison:** ⚠️ REPEATER
`sizeCompareSection` (Section), `sizeCompareTitle` (Text), `sizeCompareRepeater` (Repeater), `sizeComparisonTitle` (Text), `sizeComparisonVisual` (HtmlComponent)

### Sticky Add-to-Cart Bar (NEW v1.2.0+ — PR #664 / CF-gj26)
*Source: `src/public/StickyAtcBar.js` — `initStickyAtcBar($w, state)`*

| Element ID | Wix Element | Notes |
|---|---|---|
| `stickyAtcBar` | Box | **Fixed bottom overlay** — set to Fixed position in editor. Hidden by default; slides in when `#addToCartButton` scrolls out of view. |
| `stickyAtcProductName` | Text | Product name — pre-populated on init |
| `stickyAtcPrice` | Text | Formatted price — pre-populated on init |
| `stickyAtcBtn` | Button | "Add to Cart" CTA — mirrors primary button state (disabled + "Out of Stock" label when unavailable) |

### Product Badge (NEW v1.2.0+ — PR #657 / CF-p56i)
*Source: `src/public/badgeHelpers.js` — `initCmsBadgePDP($w, state)`*
*Backend: `src/backend/badgeService.web.js` — `getProductBadges(productId, productData)`*

| Element ID | Wix Element | Notes |
|---|---|---|
| `pdpBadgeContainer` | Box | Badge wrapper — **hidden by default**; code shows/styles it. Sets `backgroundColor` from badge config. |
| `pdpBadgeText` | Text | Badge label (e.g. "New", "Bestseller", "CF+ Exclusive", "Low Stock", "Sale") |

**CMS collection**: `ProductBadges` (productId, badgeType, active, expiresAt). Computed fallbacks: LOW_STOCK when inventory < 5, SALE when comparePrice is set. Priority: CF_PLUS_EXCLUSIVE > BESTSELLER > NEW > SALE > LOW_STOCK.

### Delivery Estimator (NEW v1.1.0+ — PR #649)
*Source: `src/public/ProductDetails.js` — `initDeliveryEstimate()` + `updateEstimateForZip()`*
*Backend: `src/backend/shippingIntelligence.web.js` — `getDeliveryEstimate(zip, productIds[])`*

| Element ID | Wix Element | Notes |
|---|---|---|
| `deliveryZipInput` | Input | ZIP code entry field |
| `deliveryZipBtn` | Button | "Check Delivery" action button |
| `deliveryEstimateBox` | Box | Container — hidden until result ready |
| `deliveryEstimateText` | Text | Delivery window display (e.g. "Mon Jun 2 – Wed Jun 4") |
| `deliveryEstimateError` | Text | Error message (hidden by default) |
| `whiteGloveNote` | Text | White-glove delivery note (shown when applicable) |

**Behaviour**: ZIP entry → calls `getDeliveryEstimate` → shows estimated delivery window in `deliveryEstimateBox`. White-glove note visible when carrier returns white-glove service. UPS fallback: "2–5 business days". `deliveryEstimateBox` hidden until user submits a ZIP.

---

### Product Info Modal — Care Guide + Dimensions (NEW v1.1.0+ — PR #651)
*Source: `src/public/ProductInfoModal.js` — `initProductInfoModal($w, state)`*
*Backend: `src/backend/catalogContent.web.js` — `getProductSpecs(slug)`*

| Element ID | Wix Element | Notes |
|---|---|---|
| `careGuideBtn` | Button | Opens care guide + dimensions modal |
| `careGuideText` | Text | Short care summary shown below button |
| `dimensionsModal` | Box | Modal overlay container — starts collapsed |
| `dimensionsModalTitle` | Text | Modal title heading |
| `dimensionsModalClose` | Button | Close (X) — keyboard accessible, focus trap |
| `dimensionsText` | Text | Full dimensions + care instructions content |
| `roomWidthInput` | Input | Room width (inches) for fit calculator |
| `roomLengthInput` | Input | Room length (inches) for fit calculator |
| `checkRoomFitBtn` | Button | "Check Fit" — triggers room fit calculation |
| `fitResult` | Text | Fit verdict: ✅ Fits well / ⚠️ Tight / ❌ Too large |

**Behaviour**: Lazy-loads CMS `ProductSpecs` data on first open. Room fit compares product dimensions against inputs, reports clearance. Modal uses `setupAccessibleDialog` with ARIA role="dialog", ariaModal, focus trap.

---

### Promo Banner Carousel (NEW v0.9.0+)
*Source: `src/public/promoBannerCarousel.js`*

Renders promo banners via repeater — element IDs TBD (module uses config-driven approach).

### Collection Card Builder (NEW v0.9.0+)
*Source: `src/public/collectionCardBuilder.js`*

Generates collection card HTML for injection into HtmlComponent elements — no direct $w element IDs (uses postMessage pattern).

### Empty State Builder (NEW v0.9.0+)
*Source: `src/public/emptyStateBuilder.js`*

Generates empty state HTML with mountain illustrations for injection via `$w('#element').postMessage()` — no direct element IDs.

### Social Story Helpers (NEW v0.9.0+)
*Source: `src/public/socialStoryHelpers.js`*

Backend utility for social media story generation — no editor elements needed.

### CF+ Upgrade Prompt Modal — Product Page Instance (NEW v1.2.0+ — PR #666 / CF-llrd)
*Source: `src/public/MembershipPrompt.js` — same 5 elements as Member Page instance*
*Triggered for `swatch-request` and `price-match` contexts on PDP.*

Place the same 5 elements on the Product Page canvas:
`membershipPromptModal` (Box, hidden), `membershipPromptClose` (Button), `membershipPromptTitle` (Text), `membershipPromptBenefits` (Text), `membershipUpgradeBtn` (Button)

> See **Member Page → CF+ Upgrade Prompt Modal** for full nickname/type table.

### Gallery Zoom Lightbox (v1.2.0+ — `GalleryZoomLightbox.js`)

Added to product page via `initGalleryZoomLightbox`. Click the main product image or any gallery thumbnail to open full-size overlay with prev/next navigation, keyboard arrows, mobile swipe, and ARIA accessibility.

| Element ID | Wix Element | Notes |
|---|---|---|
| `zoomLightboxOverlay` | Box | Full-screen modal overlay — hidden by default |
| `zoomLightboxImage` | Image | Full-size product image (updates on nav) |
| `zoomLightboxClose` | Button | Close X button |
| `zoomLightboxPrev` | Button | Previous image — hidden when single image |
| `zoomLightboxNext` | Button | Next image — hidden when single image |
| `zoomLightboxCounter` | Text | "2 / 5" — hidden when single image |

**Behavior:** `zoomLightboxOverlay` starts collapsed (hidden). ARIA dialog role, focus trap, and Escape-to-close wired via `setupAccessibleDialog`. Keyboard ← → navigation when overlay open.

### 360° Spin Viewer (`ProductSpinViewer.js`)

Added to product page via `initProduct360Viewer`. Elements live on **Product Page**:

`viewer360Section` (Box), `viewer360Container` (Box), `viewer360Embed` (HtmlComponent), `view360Btn` (Button), `viewer360Title` (Text), `viewer360Hint` (Text)

### Shipping Intelligence Layer (Sprint 5 — `ShippingIntelligence.js`) ✅ MERGED PR #674

*Source: `src/public/ShippingIntelligence.js` + `src/backend/shippingIntelligence.web.js`*

| Element ID | Wix Element | Notes |
|---|---|---|
| `shippingEstimateBox` | Box | Container — **hidden by default**, shown after successful API call |
| `deliveryEstimateText` | Text | Delivery window, e.g. "Wed Apr 2" or "3–5 business days" |
| `deliveryZoneText` | Text | Option title, e.g. "🚚 Zone 1 Delivery (Free)" or "UPS Ground" |
| `shippingRateBadge` | Text | Badge copy, e.g. "Free Delivery" — hidden when no badge |
| `shippingEstimateSpinner` | Box | Loading indicator — shown during API call |
| `shippingEstimateError` | Text | Error message — **hidden by default** |
| `whiteGloveUpsellBanner` | Box | Upgrade CTA — **hidden by default**, shown for local delivery options |
| `whiteGloveUpsellText` | Text | Upsell copy from `upsellMessage`, e.g. "Upgrade to White Glove (+$99)" |
| `whiteGloveLearnMoreBtn` | Button | Opens white glove modal via accessible dialog |
| `whiteGloveModal` | Box | Modal overlay — **hidden by default**, managed by `setupAccessibleDialog` |
| `whiteGloveModalClose` | Button | Close X inside modal — wired by `setupAccessibleDialog` |
| `whiteGloveModalContent` | Text | In-home setup description copy |

**Behavior:** On product page load, calls `getShippingEstimate(productId, postalCode)` using stored ZIP (session storage or prompt if missing). Shows spinner → replaces with estimate + zone text. If local zone returned, shows white glove upsell banner. Modal is accessible (focus trap, ESC close, ARIA dialog role).

### Live Inventory + Low Stock (Sprint 5 — `LiveInventory.js`)

**Backend:** `inventoryService.web.js` (new)

#### Product Page Elements (added alongside existing product page)
`stockStatusBadge` (Box), `stockStatusText` (Text), `lowStockWarning` (Box), `lowStockCount` (Text), `outOfStockOverlay` (Box), `notifyMeSection` (Box), `notifyMeInput` (Input), `notifyMeBtn` (Button), `notifyMeSuccess` (Text), `notifyMeError` (Text)

**Behavior:**
- `stockStatusBadge` shows "In Stock" / "Low Stock" / "Out of Stock" — color-coded (green/coral/gray).
- `lowStockWarning` + `lowStockCount` visible when qty ≤ threshold (e.g. "Only 3 left!").
- `outOfStockOverlay` disables Add to Cart when qty = 0.
- `notifyMeSection` shown when out of stock — captures email for restock notification.

### Product Q&A Widget (Sprint 5 — `ProductQnA.js`) ✅ MERGED PR #678

**Frontend:** `src/public/ProductQnA.js` — accordion Q&A, customer submit form, paginated load
**Note:** Replaces legacy `ProductQA.js` (#qa* IDs). Use only #qna* IDs below. Consolidation bead CF-qa8c queued.

| Nickname | Type | Notes |
|----------|------|-------|
| `qnaSection` | Box | Container — hidden until items load |
| `qnaAccordion` | Repeater | ⚠️ `onItemReady` BEFORE `.data` |
| `qnaEmpty` | Text | Shown when no approved Q&A |
| `qnaLoadMore` | Button | Pagination — hidden when all loaded |
| `qnaQuestion` | Text | Inside repeater — question text (accordion trigger) |
| `qnaAnswer` | Text | Inside repeater — answer (collapsible panel, needs `id` matching `aria-controls`) |
| `qnaQuestionInput` | TextInput | Ask-a-question input |
| `qnaSubmitBtn` | Button | Submit question |
| `qnaThankYou` | Text | Hidden — shown on successful submit |

**Accessibility:** `qnaQuestion` button gets `aria-expanded` + `aria-controls` pointing to `qnaAnswer` panel. `qnaAnswer` must have matching `id` attribute — both set automatically by `ProductQnA.js`.

### Gift as a Gift CTA (PR #529 — CF-9fv2)
Add to **Product Page**:

| Element ID | Wix Element | Notes |
|---|---|---|
| `giftProductBtn` | Button | "Give as a Gift" CTA — links to Wix Stores gift card flow with product context |

### Price Lock Widget (NEW — CF-tjf0, PR #935)
*Source: `src/public/PriceLockWidget.js` — `initPriceLockWidget($w, state)`*
*Backend: `src/backend/priceLock.web.js`*

CF+ members can lock today's price with a $25 refundable deposit for 30/60/90 days. **All elements must be collapsed/hidden by default.**

| Element ID | Wix Element | Notes |
|---|---|---|
| `priceLockSection` | Section | Container — collapsed by default; expands for CF+ members |
| `priceLockBtn` | Button | "Lock This Price — $25 Deposit" CTA |
| `priceLockBadge` | Box | Active lock badge container |
| `priceLockBadgeText` | Text | "Price locked at $X.XX" |
| `priceLockExpiry` | Text | "Expires in X days • $25 deposit applied at checkout" |
| `priceLockModal` | Box | Tier selector modal overlay |
| `priceLockModalContent` | Box | Modal content box |
| `priceLockClose` | Button | Modal close button |
| `priceLock30` | Button | 30-day tier |
| `priceLock60` | Button | 60-day tier |
| `priceLock90` | Button | 90-day tier |
| `priceLockDeposit` | Text | "$25 refundable deposit" label |
| `priceLockSuccess` | Text | Success message — auto-collapses after 3s |

### Stamped.io Reviews (NEW — CF-gxn1)
*Source: `src/public/ProductReviews.js` + `src/backend/stampedIoService.web.js`*

**Stamped.io is now the PRIMARY review source.** CMS reviews are fallback. Existing `#reviewsSection` element IDs unchanged — see Reviews & Ratings section. One new element needed:

| Element ID | Wix Element | Notes |
|---|---|---|
| `productReviewWidget` | Box | Stamped.io native embed container — place below review form |

**Stilgar TODO (dashboard only):** Install Stamped.io from Wix App Market + add secrets: `STAMPED_API_KEY`, `STAMPED_API_SECRET`, `STAMPED_STORE_HASH`.

### BNPL Widget (CF-nqb5.1 — PR #936 ✅ MERGED 2026-03-29)
*Source: `src/public/BNPLWidget.js` — `initBNPLWidget($w, price)`*

Displays Affirm (price/12) and Klarna (price/4) monthly estimate text on the Product Page. Three elements; all collapsed/hidden until a valid price is available.

| Element ID | Wix Element | Notes |
|---|---|---|
| `bnplContainer` | Box | Wrapper — hidden by default; shown when estimates available |
| `bnplAffirm` | Text | "As low as $X/mo with Affirm" (price ÷ 12) |
| `bnplKlarna` | Text | "4 payments of $X with Klarna" (price ÷ 4) |

**Placement:** Place `#bnplContainer` on Product Page below the price display. Wire via `Product Page.js` orchestrator — called with current product price on page load and on variant change.

### Share Your Room — UGC Photo Submit (CF-rw9i.1 — PR #938 ✅ MERGED 2026-03-29)
*Source: `src/public/ShareYourRoom.js` — `initShareYourRoom($w, productId)`*
*Backend: `src/backend/ugcService.web.js` — `submitUGCPhoto()`*

Members upload a room photo, select a room type, optionally add a caption, then submit for moderation. Non-members see a sign-in prompt. **All modal/overlay elements collapsed by default.**

| Element ID | Wix Element | Notes |
|---|---|---|
| `shareYourRoomBtn` | Button | "Share your room" CTA — visible to all visitors |
| `shareYourRoomOverlay` | Box | Full-screen dimmed overlay — click closes modal |
| `shareYourRoomModal` | Box | Modal container — collapsed by default |
| `shareYourRoomClose` | Button | "×" close button (top-right of modal) |
| `shareYourRoomLoginPrompt` | Box | Sign-in message — shown to guests, collapsed for members |
| `shareYourRoomForm` | Section | Form controls container — collapses on success |
| `shareYourRoomUpload` | UploadButton | `fileType = 'Image'` — required before submit enables |
| `shareYourRoomPreview` | Image | Photo preview — collapsed until file chosen |
| `shareYourRoomRoomType` | Dropdown | Room type selector (Living Room, Bedroom, Office, Studio, Other) |
| `shareYourRoomCaption` | Input | Optional caption (max 300 chars) |
| `shareYourRoomValidation` | Text | Inline error messages — collapsed by default |
| `shareYourRoomSubmitBtn` | Button | "Submit photo" — disabled until upload + roomType set |
| `shareYourRoomSuccess` | Section | "Thanks! Your photo will appear after review." — collapsed by default |

**CMS collection required:** `CustomerRoomPhotos` (photoUrl, caption, productId, roomType, memberEmail, status: pending/approved/rejected, submittedAt, approvedAt, moderatorNotes, likes).

---

## CATEGORY PAGE (`Category Page.u0gn0.js`)

### Hero / Breadcrumb
| Element ID | Wix Element | Notes |
|---|---|---|
| `categoryHeroSection` | Section | Dynamic bg color/image |
| `categoryHeroTitle` | Text | Category name H1 |
| `categoryHeroSubtitle` | Text | Category description |
| `breadcrumbHome` | Text | "Home" breadcrumb link |
| `breadcrumbCurrent` | Text | Current category name |
| `flashSaleBanner` | Box | Collapsible sale banner |

### Product Grid ⚠️ REPEATER
| Element ID | Wix Element | Notes |
|---|---|---|
| `categoryDataset` | Dataset | Stores/Products dataset |
| `productGridRepeater` | **Repeater** | Main product grid |
| `resultCount` | Text | "X products" |
| `sortDropdown` | Dropdown | Sort by options |

**↳ Inside `productGridRepeater`:**
| Child ID | Wix Element |
|---|---|
| `gridCard` | Box |
| `gridImage` | Image |
| `gridName` | Text |
| `gridPrice` | Text |
| `gridOrigPrice` | Text |
| `gridSaleBadge` | Text |
| `gridBadge` | Text | Legacy computed badge (New/Bestseller/Sale) |
| `productBadgeRepeater` | **Box** | CMS-driven badge (v1.2.0+ / CF-p56i) — **must be Box**, not Text, for `backgroundColor` styling |
| `gridBrand` | Text |
| `gridRibbon` | Text |
| `gridFabricBadge` | Text |
| `gridLifestyleBadge` | Text |
| `gridCompareBtn` | Button |
| `quickViewBtn` | Button |
| `gridSwatchPreview` | Box |

### Quick View Modal
| Element ID | Wix Element | Notes |
|---|---|---|
| `quickViewModal` | Box | Hidden modal |
| `qvImage` | Image | Product image |
| `qvName` | Text | Product name |
| `qvPrice` | Text | Price |
| `qvDescription` | Text | Description |
| `qvAddToCart` | Button | Add to cart |
| `qvViewFull` | Button | View full product |
| `qvClose` | Button | Close X |
| `qvSizeSelect` | Dropdown | Size options |

### Filters
| Element ID | Wix Element | Notes |
|---|---|---|
| `filterCategory` | Dropdown | Category filter |
| `filterBrand` | Dropdown | Brand filter |
| `filterPrice` | Dropdown | Price range filter |
| `filterSize` | Dropdown | Size filter |
| `clearFilters` | Button | Clear all filters |
| `filterMaterial` | Dropdown | Material filter |
| `filterColor` | Dropdown | Color filter |
| `filterFeatures` | CheckboxGroup | Feature filters |
| `filterPriceRange` | Dropdown | Price range |
| `filterComfortLevel` | Dropdown | Comfort filter |
| `filterWidthMin` | Input | Min width |
| `filterWidthMax` | Input | Max width |
| `filterDepthMin` | Input | Min depth |
| `filterDepthMax` | Input | Max depth |
| `filterResultCount` | Text | Filter result count |
| `filterLoadingIndicator` | Box | Loading spinner |
| `filterChipsText` | Text | Fallback filter chips text |
| `clearAllFilters` | Button | Clear all |
| `clearAllFiltersChip` | Button | Clear chip |
| `activeFilterChips` | Box | Chips container |
| `filterChipRepeater` | **Repeater** | Active filter chips |

**↳ Inside `filterChipRepeater`:** `chipLabel` (Text), `chipRemove` (Button)

### Mobile Filter Drawer
| Element ID | Wix Element | Notes |
|---|---|---|
| `filterToggleBtn` | Button | Open filter drawer |
| `filterDrawer` | Box | Drawer panel |
| `filterDrawerOverlay` | Box | Background overlay |
| `filterDrawerApply` | Button | Apply filters |
| `mobileSortBar` | Box | Mobile sort bar |

### Empty States
| Element ID | Wix Element | Notes |
|---|---|---|
| `emptyStateSection` | Section | No products |
| `emptyStateTitle` | Text | "No Products" heading |
| `emptyStateMessage` | Text | Helpful message |
| `emptyStateIllustration` | Image | Illustration |
| `noMatchesSection` | Section | No filter matches |
| `noMatchesTitle` | Text | Heading |
| `noMatchesMessage` | Text | Message |
| `noMatchesSuggestion` | Text | Suggestion |

### Comparison Tray (NEW v1.2.0+ — PR #667 / CF-r0dr) — REPLACES Compare Bar
*Source: `src/public/ComparisonTray.js` — `initComparisonTray($w, { navigate })` + `addToCompareTray($w, product)`*
*Fixed overlay tray — up to 3 products. State persisted in sessionStorage across collection pages. Navigates to `/compare?ids=...`.*

> **⚠️ Note**: This replaces the old `compareBar`/`compareRepeater` placeholder. Use the new nicknames below.

| Element ID | Wix Element | Notes |
|---|---|---|
| `comparisonTray` | Box | Fixed overlay tray — **hidden by default**, shown when 1+ products added |
| `comparisonSlot1` | Box | Slot 1 container — hidden when empty |
| `comparisonSlot2` | Box | Slot 2 container — hidden when empty |
| `comparisonSlot3` | Box | Slot 3 container — hidden when empty |
| `comparisonSlotImage1` | Image | Product image for slot 1 |
| `comparisonSlotImage2` | Image | Product image for slot 2 |
| `comparisonSlotImage3` | Image | Product image for slot 3 |
| `comparisonSlotName1` | Text | Product name for slot 1 |
| `comparisonSlotName2` | Text | Product name for slot 2 |
| `comparisonSlotName3` | Text | Product name for slot 3 |
| `comparisonSlotRemove1` | Button | Remove product from slot 1 |
| `comparisonSlotRemove2` | Button | Remove product from slot 2 |
| `comparisonSlotRemove3` | Button | Remove product from slot 3 |
| `compareNowBtn` | Button | Primary CTA — disabled until 2+ products. Navigates to `/compare?ids=...` |
| `clearComparisonBtn` | Button | Clears all slots, hides tray |
| `comparisonCount` | Text | Badge — "N products" (e.g. "2 products") |

### Swatch Filter (NEW v1.2.0+ — PR #670 / CF-wigv)
*Source: `src/public/SwatchFilter.js` — `initSwatchFilter($w, allProducts)`*
*Client-side filter — no backend call. Multi-select (OR logic). State persisted in sessionStorage.*

| Element ID | Wix Element | Notes |
|---|---|---|
| `swatchFilterSection` | Box | Section container — structural landmark; not queried by code |
| `swatchFilterRepeater` | **Repeater** | Color chip strip — populated with unique fabric values + counts |
| `clearFilterBtn` | Button | **Hidden when no filter active**, shown on first chip selection |
| `filterResultCount` | Text | "Showing X of Y products" — updated on every filter change |

**↳ Inside `swatchFilterRepeater` item template:**
`swatchChip` (Box — active state: `swatch-active` CSS class toggled on click), `swatchLabel` (Text — fabric name), `swatchCount` (Text — "(12)")

> **⚠️ Velo order**: `onItemReady` is registered by code BEFORE `.data` is set — don't move or duplicate this wiring.

### Recently Viewed
| Element ID | Wix Element | Notes |
|---|---|---|
| `recentlyViewedTitle` | Text | Section heading |

### SEO
`categorySchemaHtml` (HtmlComponent), `categoryBreadcrumbSchemaHtml` (HtmlComponent), `categoryOgHtml` (HtmlComponent)

---

## CART PAGE (`Cart Page.mqi5m.js`)

### Cart Data
| Element ID | Wix Element | Notes |
|---|---|---|
| `cartDataset` | Dataset | Cart dataset |

### Empty Cart
| Element ID | Wix Element | Notes |
|---|---|---|
| `emptyCartSection` | Section | Shown when cart empty |
| `emptyCartTitle` | Text | "Your Cart is Empty" |
| `emptyCartMessage` | Text | Helpful message |
| `continueShoppingBtn` | Button | Back to shop |

### Shipping Progress
| Element ID | Wix Element | Notes |
|---|---|---|
| `shippingProgressBar` | ProgressBar | Free shipping progress |
| `shippingProgressText` | Text | Progress text |
| `shippingProgressIcon` | Image | Truck icon |

### Tier Discount
| Element ID | Wix Element | Notes |
|---|---|---|
| `tierProgressBar` | ProgressBar | Tier discount progress |
| `tierProgressText` | Text | Progress text |

### Cart Items ⚠️ REPEATER
| Element ID | Wix Element | Notes |
|---|---|---|
| `cartItemsRepeater` | **Repeater** | Cart line items |

**↳ Inside:** `cartItemName` (Text), `cartItemPrice` (Text), `qtyMinus` (Button), `qtyPlus` (Button), `qtyInput` (Input), `removeItem` (Button), `saveForLaterBtn` (Button)

### Cart Totals
`cartSubtotal` (Text), `cartShipping` (Text), `cartTotal` (Text)

### Cross-Sell ⚠️ REPEATER
| Element ID | Wix Element | Notes |
|---|---|---|
| `suggestionsSection` | Section | Collapsible |
| `suggestionsHeading` | Text | Heading |
| `suggestionsSubheading` | Text | Subheading |
| `sugSavingsBadge` | Text | Savings badge |
| `suggestionsRepeater` | **Repeater** | Suggested products |
| `sugBundlePrice` | Text | Bundle price |
| `sugOriginalPrice` | Text | Original price |

**↳ Inside:** `sugImage` (Image), `sugName` (Text), `sugPrice` (Text), `sugAddBtn` (Button)

### Recently Viewed ⚠️ REPEATER
*Source: `src/public/ProductHistory.js` — `getRecentlyViewed()`*
`cartRecentSection` (Section), `cartRecentRepeater` (Repeater)
**↳ Inside:** `cartRecentImage` (Image), `cartRecentName` (Text), `cartRecentPrice` (Text)

### You Might Also Like ⚠️ REPEATER
*Source: `src/public/ProductHistory.js` — `getRecentlyViewed()` (repurposed for upsell slot)*
`youMightAlsoLikeSection` (Section), `youMightAlsoLikeRepeater` (Repeater)
**↳ Inside:** `ymalImage` (Image), `ymalName` (Text), `ymalPrice` (Text), `ymalAddBtn` (Button)

### Financing
`cartFinancingSection` (Section), `financingThreshold` (Text), `cartFinancingTeaser` (Text), `cartAfterpayMessage` (Text)

### Delivery
`cartDeliverySection` (Section)

---

## CHECKOUT (`Checkout.psuom.js`)

### Progress ⚠️ REPEATER
`checkoutProgressNav` (Box), `checkoutProgressRepeater` (Repeater)
**↳ Inside:** `progressStepLabel` (Text), `progressStepNumber` (Text), `progressStepDot` (Box), `progressStepCheck` (Image), `progressStepContainer` (Box)

### Trust Signals ⚠️ REPEATER
`trustRepeater` (Repeater)
**↳ Inside:** `trustText` (Text), `trustIcon` (Image)

### Order Notes
`orderNotesToggle` (Button), `orderNotesField` (TextBox)

### Checkout Summary
`checkoutFreeShipping` (Text), `checkoutItemCount` (Text)

### Payment Methods ⚠️ REPEATER
`paymentMethodsRepeater` (Repeater)
**↳ Inside:** `paymentMethodName` (Text), `paymentMethodIcon` (Image), `paymentBrands` (Text)

### Afterpay / Financing
`checkoutAfterpay` (Section), `afterpayMessage` (Text), `afterpayInstallment` (Text), `checkoutFinancing` (Section), `financingMessage` (Text), `checkoutShippingMessage` (Text)

### Shipping Options ⚠️ REPEATER
`shippingOptionsRepeater` (Repeater)
**↳ Inside:** `shippingOptionLabel` (Text), `shippingOptionPrice` (Text), `shippingOptionDesc` (Text), `shippingOptionDays` (Text), `shippingOptionRadio` (RadioButton)

### Address Validation
`validateAddressBtn` (Button), `addressFullName` (Input), `addressLine1` (Input), `addressCity` (Input), `addressState` (Input), `addressZip` (Input), `addressFullNameError` (Text), `addressLine1Error` (Text), `addressCityError` (Text), `addressStateError` (Text), `addressZipError` (Text), `addressErrors` (Text), `addressSuccess` (Text)

### Delivery Estimate
`checkoutDeliveryEstimate` (Text)

### Order Summary Sidebar ⚠️ REPEATER
`orderSummarySidebar` (Box), `orderSummaryItemsRepeater` (Repeater), `orderSummarySubtotal` (Text), `orderSummaryShipping` (Text), `orderSummaryTax` (Text), `orderSummaryTotal` (Text), `orderSummarySavings` (Text), `orderSummaryStoreCredit` (Text), `orderSummaryStoreCreditRow` (Box)
**↳ Inside:** `summaryItemName` (Text), `summaryItemQty` (Text), `summaryItemPrice` (Text)

### Express Checkout
`expressCheckoutSection` (Section), `expressCheckoutBtn` (Button), `expressSummaryTotal` (Text), `expressSummaryShipping` (Text), `expressSummaryAddress` (Text), `expressSummarySection` (Box)

### Store Credit
`storeCreditApplyBtn` (Button), `storeCreditAppliedAmount` (Text), `storeCreditAppliedSection` (Box)

### Protection Plans ⚠️ NESTED REPEATER
`protectionPlanSection` (Section), `protectionPlanTitle` (Text), `protectionPlanSubtitle` (Text), `protectionPlanRepeater` (Repeater)
**↳ Inside:** `protPlanProductName` (Text), `protPlanProductPrice` (Text), `protPlanTierRepeater` (Repeater — NESTED), `protPlanDecline` (Button)
**↳↳ Inside nested:** `tierName` (Text), `tierPrice` (Text), `tierDuration` (Text), `tierCoverage` (Text), `tierCard` (Box), `tierSelectBtn` (Button), `tierCurrentBadge` (Text)

---

## SIDE CART (`Side Cart.ego5s.js`)

### Panel
`sideCartPanel` (Box), `sideCartTitle` (Text), `sideCartClose` (Button), `sideCartOverlay` (Box), `sideCartEmpty` (Box), `sideCartItems` (Box), `sideCartFooter` (Box), `sideCartSubtotal` (Text), `sideCartCheckout` (Button), `viewFullCart` (Button), `cartIcon` (Image), `cartBadge` (Text), `justAddedHighlight` (Box)

### Items ⚠️ REPEATER
`sideCartRepeater` (Repeater)
**↳ Inside:** `sideItemImage` (Image), `sideItemName` (Text), `sideItemPrice` (Text), `sideItemQty` (Text), `sideQtyMinus` (Button), `sideQtyPlus` (Button), `sideItemLineTotal` (Text), `sideItemVariant` (Text), `sideItemRemove` (Button), `sideSaveForLater` (Button)

### Progress Bars
`sideShippingBar` (ProgressBar), `sideShippingText` (Text), `sideTierBar` (ProgressBar), `sideTierText` (Text)

### Cross-Sell ⚠️ REPEATER
`sideCartSuggestion` (Section), `sideSugLabel` (Text), `sideSugSubheading` (Text), `sideSugSavingsBadge` (Text), `sideSugRepeater` (Repeater), `sideSugBundlePrice` (Text), `sideSugOriginalPrice` (Text)
**↳ Inside:** `sideSugImage` (Image), `sideSugName` (Text), `sideSugPrice` (Text), `sideSugAdd` (Button)

---

## SEARCH RESULTS (`Search Results.evr2j.js`)

### Search Controls
`searchInput` (Input), `searchBtn` (Button), `searchQuery` (Text), `resultCount` (Text), `loadMoreBtn` (Button), `loadingIndicator` (Box)

### Results Grid ⚠️ REPEATER
`searchRepeater` (Repeater)
**↳ Inside:** `searchImage` (Image), `searchName` (Text), `searchPrice` (Text), `searchDesc` (Text), `searchRibbon` (Text), `searchOrigPrice` (Text), `searchAddBtn` (Button), `searchSwatchPreview` (Box), `searchSwatchDot1`–`searchSwatchDot4` (Box)

### Suggestions ⚠️ REPEATER
`suggestionsBox` (Box), `suggestionsRepeater` (Repeater)
**↳ Inside:** `suggestionText` (Text), `suggestionType` (Text)

### Filters
`categoryFilter` (Dropdown), `priceFilter` (Dropdown), `materialFilter` (Dropdown), `colorFilter` (Dropdown), `sortDropdown` (Dropdown), `filterToggleBtn` (Button), `filterSidebar` (Box), `clearFiltersBtn` (Button), `filterBadge` (Text)

### No Results
`noResultsBox` (Box), `noResultsText` (Text), `searchChipsRepeater` (Repeater)
**↳ Inside:** `chipLabel` (Text)

---

## MEMBER PAGE (`Member Page.f00pg.js`)

### Dashboard
`memberWelcome` (Text), `memberOrderCount` (Text), `memberWishCount` (Text), `memberPointsDisplay` (Text), `memberTierDisplay` (Text), `memberErrorFallback` (Box), `memberErrorText` (Text)

### Quick Links
`dashQuickOrders` (Button), `dashQuickWishlist` (Button), `dashQuickSettings` (Button)

### Loyalty ⚠️ REPEATER
*Source: `src/public/LoyaltyDashboard.js` — `initLoyaltyDashboard($w, memberId)` (CF-gkgv, NEW v1.1.0+)*
`tierProgressBar` (ProgressBar), `tierProgressText` (Text), `loyaltyMilestone` (Text), `tierComparisonRepeater` (Repeater)
**↳ Inside:** `tierName` (Text), `tierMinPoints` (Text), `tierBenefits` (Text), `tierCard` (Box), `tierCurrentBadge` (Text)

**Tier Progress + Badge (CF-gkgv):**
| Element ID | Wix Element | Notes |
|---|---|---|
| `loyaltyProgressBar` | ProgressBar | currentPoints/nextTierThreshold (0–100%) |
| `loyaltyTierBadge` | Text | Tier badge icon (✨ Bronze / ⭐ Silver / 🏆 Gold) |
| `tierUpModal` | Box | Milestone popup container — auto-dismissed after 4s |
| `tierUpModalText` | Text | "Congratulations! You reached [Tier]!" message |

### Rewards ⚠️ REPEATER
`rewardsRepeater` (Repeater), `rewardsSection` (Section), `rewardsEmpty` (Text)
**↳ Inside:** `rewardName` (Text), `rewardDescription` (Text), `rewardCost` (Text), `redeemBtn` (Button), `rewardCouponCode` (Text)

### Streak Display (NEW — CF-64k)
*Source: `src/pages/Member Page.js` → `initLoyaltyDashboard()`. Backend: `backend/loyaltyService.web.js` → `getMyStreakData()`*

| Element ID | Wix Element | Notes |
|---|---|---|
| `streakCountChip` | Text | Shows "🔥 N-day streak". **Hidden when streak = 0**. Shown/hidden via `shouldShowStreakChip(currentStreakDays)`. |
| `streakMultiplierBadge` | Text | Shows "Nx points" multiplier badge. **Hidden when multiplier = 1**. Shown only when `streakMultiplier > 1`. |
| `streakToastBox` | Box | Toast notification for streak extension events. Hidden by default; shown after `receiveGamificationEvent` updates streak. |

### Daily Spin Wheel (NEW — CF-spin-wheel Phase 1)
*Source: `src/pages/Member Page.js` — `initSpinSection()` (inline, closure-scoped `$w` + `currentMember._id`). Backend: `backend/spinWheel.web.js`*

| Element ID | Wix Element | Notes |
|---|---|---|
| `spinWheelSection` | Section | Outer container — **collapsed by default**. Expands on `initSpinSection()`. |
| `spinWheelSVG` | HtmlComponent | SVG prize wheel rendered via `innerHTML`. Prizes drawn from `SpinPrizes` CMS (cached in sessionStorage 5 min). |
| `spinButton` | Button | Primary CTA. Labels: "Spin Now!" (eligible) / "Spinning…" (in-flight, disabled) / "Try Again" (after throw) / "Come Back Tomorrow" (ineligible, no bonus) / "Unavailable" (ERROR). |
| `spinCountdown` | Text | Hidden when eligible. Shows "Next spin in Xh Ym Zs" when daily spin used and no bonus available. |
| `spinResultText` | Text | Hidden until spin completes. Fades in (200ms for errors / 300ms for prize win) with prize headline or error message. |
| `spinBonusChip` | Text | Hidden when no bonus spins. Shows "+N bonus" when bonus spins available — fades in (200ms). |
| `spinLottieHub` | Lottie | Idle/loading animation. Plays on init. Stopped during win flow. Skipped if `prefers-reduced-motion`. |
| `spinLottieConfetti` | Lottie | Inline win confetti. Plays after successful spin. Auto-stops after 3s. Skipped if `prefers-reduced-motion`. |
| `spinConfettiOverlay` | Box | Full-screen confetti overlay. Fades in (200ms) on win, fades out (400ms) after 3s. |
| `pendingPrizesRepeater` | Repeater | Pending (unclaimed) prizes. Collapsed when empty. |

**↳ Inside `pendingPrizesRepeater`:**
| Child ID | Wix Element | Notes |
|---|---|---|
| `pendingPrizeLabel` | Text | Prize display name (e.g. "Free Shipping", "15% Off") |

**CMS — SpinPrizes collection** (required for wheel to render prizes):
| Field | Type | Notes |
|---|---|---|
| `active` | Boolean | `true` = included in draw. `false` = never drawn. |
| `weight` | Number | Draw weight (higher = more likely). |
| `prizeType` | Text | `POINTS`, `FREE_SHIPPING`, `DISCOUNT_PCT`, etc. |
| `pointsAwarded` | Number | Points granted (POINTS prizes only). |
| `prizeValue` | Number | Numeric value (DISCOUNT_PCT = percentage; others = TBD). |
| `label` | Text | Display label shown on wheel segment and result. |
| `color` | Text | Hex color for SVG wheel segment (e.g. `#E07B54`). SVG-escaped automatically. |

### Streak Display (NEW — Phase 2 Streak Multipliers)
*Source: `src/public/StreakDisplay.js` — `updateStreakDisplay($elements, data, reducedMotion)`. Called from `Member Page.js` after any point-earning event response.*

| Element ID | Wix Element | Notes |
|---|---|---|
| `streakCountChip` | Text | Hidden when streak < 1 day. Shows "🔥 N-day streak" (compound-modifier form at day 1 and day 7+, space-separated plural for days 2–6). Updated by `buildStreakChipText()`. |
| `streakMultiplierBadge` | Text | Hidden when multiplier = 1× (no active bonus). Shows "N× points" when streak has unlocked a multiplier (day 3 = 1.5×, day 7+ = 2×). Updated by `buildMultiplierBadgeText()`. |
| `streakToastBox` | Text | Transient toast — shown on streak increment or milestone. Auto-hides after 3s (5s on milestone). Skipped entirely when `prefers-reduced-motion` is active. Text set by `buildToastText()`. |

### Order History ⚠️ REPEATER
`ordersRepeater` (Repeater), `orderFilterDropdown` (Dropdown), `ordersLoadMoreBtn` (Button), `ordersRetryBtn` (Button), `ordersLoader` (Box), `ordersError` (Text), `ordersEmpty` (Box), `startReturnBtn` (Button)
**↳ Inside:** `orderNumber` (Text), `orderDate` (Text), `orderTotal` (Text), `orderItemCount` (Text), `orderStatusBadge` (Text), `orderStatus` (Text), `orderDeliveryEta` (Text), `orderTrackBtn` (Button), `orderReorderBtn` (Button), `orderStartReturnBtn` (Button), `orderItemsGallery` (Gallery)

### Wishlist ⚠️ REPEATER
`wishlistRepeater` (Repeater), `wishlistEmpty` (Box), `wishSortDropdown` (Dropdown), `wishShareBtn` (Button), `wishSharePinterest` (Button), `wishShareEmail` (Button), `wishShareFacebook` (Button), `wishAlertHistorySection` (Section), `wishAlertHistoryRepeater` (Repeater)
**↳ Inside `wishlistRepeater`:** `wishImage` (Image), `wishName` (Text), `wishPrice` (Text), `wishStockStatus` (Text), `wishSalePrice` (Text), `wishAddToCartBtn` (Button), `wishViewBtn` (Button), `wishAlertToggle` (Toggle), `wishRemoveBtn` (Button), `wishCard` (Box)
**↳ Inside `wishAlertHistoryRepeater`:** `alertTypeLabel` (Text), `alertProductName` (Text), `alertMessage` (Text), `alertDate` (Text)

### Account / Address / Prefs
`logoutBtn` (Button), `accountSettings` (Section), `addressBook` (Box), `addressRepeater` (Repeater), `addressEmptyState` (Box), `commPrefs` (Box), `prefNewsletter` (Toggle), `prefSaleAlerts` (Toggle), `prefBackInStock` (Toggle)
**↳ Inside `addressRepeater`:** `addressText` (Text)

### Returns Portal (`ReturnsPortal.js`)

Add these elements to the **Member Page** in the editor:

| Element ID | Wix Element | Notes |
|---|---|---|
| `returnFlowSection` | Box | Return flow container, shown/hidden |
| `returnNoOrders` | Text | "No orders" message |
| `returnOrderDropdown` | Dropdown | Select order to return |
| `returnReasonDropdown` | Dropdown | Return reason |
| `returnWindowInfo` | Text | Return window status |
| `returnDetailsInput` | TextBox | Additional details |
| `returnError` | Text | Error message |
| `returnSuccess` | Text | Success message |
| `submitReturnBtn` | Button | Submit return request |
| `cancelReturnBtn` | Button | Cancel return flow |
| `returnsListSection` | Box | Return history container |

**`returnItemsRepeater`** ⚠️ REPEATER — returnable items:

| Child ID | Wix Element | Notes |
|---|---|---|
| `returnItemName` | Text | Item name |
| `returnItemQty` | Text | Quantity |
| `returnItemPrice` | Text | Price |
| `returnItemImage` | Image | Item image |
| `returnItemCheckbox` | CheckboxGroup | Select item to return |
| `returnItemBlockReason` | Text | Why item can't be returned |

**`returnsListRepeater`** ⚠️ REPEATER — return request history:

| Child ID | Wix Element | Notes |
|---|---|---|
| `returnRma` | Text | RMA number |
| `returnOrderNum` | Text | Order number |
| `returnDate` | Text | Request date |
| `returnReason` | Text | Reason |
| `returnStatusBadge` | Text | Status badge |
| `returnTimeline` | Text | Timeline (multiline) |

### CF+ Upgrade Prompt Modal (NEW v1.2.0+ — PR #666 / CF-llrd)
*Source: `src/public/MembershipPrompt.js` — `initMembershipPrompt($w)` + `showMembershipPrompt($w, context, dialog)`*
*Triggered when anonymous or non-CF+ user hits a gated feature (wishlist alerts, swatch request, price match). One-time per browser session.*

| Element ID | Wix Element | Notes |
|---|---|---|
| `membershipPromptModal` | Box | Modal/overlay container — **collapsed/hidden by default** (`collapse()` on init) |
| `membershipPromptClose` | Button | Close button — dismisses modal and announces to screen reader |
| `membershipPromptTitle` | Text | Context-specific headline (e.g. "Get back-in-stock alerts — exclusive to CF+ members") |
| `membershipPromptBenefits` | Text | CF+ benefits list — rendered once at init from `getBenefitsList()` |
| `membershipUpgradeBtn` | Button | Upgrade CTA — links to `/pricing-plans` (set once at init) |

> **⚠️ Placement**: This modal must be placed on every page that gates CF+ features. Currently used on **Member Page** (wishlist-alerts context) and **Product Page** (swatch-request, price-match contexts). Add the same 5 elements to each page's canvas.

---

## CONTACT (`Contact.k14wx.js`)

### Contact Form
`contactName` (Input), `contactEmail` (Input), `contactPhone` (Input), `contactSubject` (Input), `contactMessage` (TextBox), `contactSubmit` (Button), `contactSuccess` (Box), `contactForm` (Box), `contactError` (Text), `contactNameError` (Text), `contactEmailError` (Text), `contactMessageError` (Text), `contactPhoneError` (Text)

### Business Info
`infoAddress` (Text), `infoPhone` (Text), `infoPhoneLink` (Button), `directionsBtn` (Button), `contactFaqLink` (Button), `contactFeatures` (Repeater)
**↳ Inside:** `featureItem` (Text)

### Hours ⚠️ REPEATER
`todayStatus` (Text), `hoursRepeater` (Repeater)
**↳ Inside:** `hourDay` (Text), `hourTime` (Text)

### Appointment ⚠️ FORM
`appointmentBookBtn` (Button), `appointmentName` (Input), `appointmentEmail` (Input), `appointmentPhone` (Input), `appointmentVisitType` (Dropdown), `appointmentDate` (Dropdown), `appointmentTimeSlot` (Dropdown), `appointmentInterests` (TextBox), `appointmentError` (Text), `appointmentConfirmation` (Text), `appointmentForm` (Box), `appointmentSuccess` (Box)

### Social Proof ⚠️ REPEATER
| Element ID | Wix Element | Notes |
|---|---|---|
| `contactTestimonials` | **Repeater** | Customer testimonials |

**↳ Inside `contactTestimonials`:**
| Child ID | Wix Element | Notes |
|---|---|---|
| `testimonialQuote` | Text | Quote text |
| `testimonialAuthor` | Text | Author name |
| `testimonialStars` | Text | Star rating |

### Schema
`contactSchemaHtml` (HtmlComponent), `contactMetaHtml` (HtmlComponent)

---

## ABOUT (`About.gar3e.js`)

`aboutTitle` (Text), `aboutSubtitle` (Text)

### Repeaters
- `brandStoryRepeater` → `storyHeading` (Text), `storyBody` (Text), `storyImage` (Image)
- `teamRepeater` → `teamName` (Text), `teamRole` (Text), `teamBio` (Text)
- `teamGallery` → `polaroidImage` (Image), `polaroidCaption` (Text)
- `timelineRepeater` → `timelineYear` (Text), `timelineTitle` (Text), `timelineDesc` (Text)
- `showroomFeatures` → `featureText` (Text)
- `aboutTestimonials` → `testimonialQuote` (Text), `testimonialAuthor` (Text), `testimonialStars` (Text)

### Showroom Info
`aboutAddress` (Text), `aboutPhone` (Text), `aboutTodayHours` (Text), `aboutDirectionsBtn` (Button)

### Visit CTA
`aboutVisitTitle` (Text), `aboutVisitBody` (Text), `aboutVisitBtn` (Button), `aboutBookBtn` (Button), `aboutFaqLink` (Button), `aboutSchemaHtml` (HtmlComponent)

---

## FAQ (`FAQ.s2c5g.js`)

`faqTitle` (Text), `faqSubtitle` (Text), `faqSearchInput` (Input), `faqNoResults` (Text)

### Category Filters ⚠️ REPEATER
`faqCategoryRepeater` (Repeater) → `categoryLabel` (Text)

### FAQ Accordion ⚠️ REPEATER
`faqRepeater` (Repeater) → `faqQuestion` (Text), `faqAnswer` (Text), `faqToggle` (Text)

### Contact CTA
`faqContactTitle` (Text), `faqContactBody` (Text), `faqContactBtn` (Button), `faqPhoneBtn` (Button)

---

## THANK YOU PAGE (`Thank You Page.dk9x8.js`)

### Order Summary
`thankYouTitle` (Text), `orderNumber` (Text), `thankYouMessage` (Text), `orderContactInfo` (Text)

### Brenda's Message
`brendaMessageSection` (Section), `brendaTitle` (Text), `brendaMessage` (Text)

### Delivery Timeline
`deliveryTimeline` (Section), `deliveryEstimateText` (Text), `step1`–`step4` (Text)

### Social Sharing
`shareText` (Text), `shareFacebook` (Button), `sharePinterest` (Button), `shareInstagram` (Button), `shareTwitter` (Button)

### Newsletter
`newsletterPrompt` (Text), `newsletterEmail` (Input), `newsletterSignup` (Button), `newsletterSuccess` (Text), `newsletterError` (Text)

### Referral
`referralSection` (Section), `referralTitle` (Text), `referralMessage` (Text), `referralCopyBtn` (Button), `referralEmailBtn` (Button)

### Post-Purchase ⚠️ REPEATER
`postPurchaseHeading` (Text), `postPurchaseRepeater` (Repeater)
**↳ Inside:** `ppImage` (Image), `ppName` (Text), `ppPrice` (Text)

### Care / Assembly / Review
`careSequenceInfo` (Section), `careSequenceText` (Text), `assemblyGuideSection` (Section), `assemblyGuideTitle` (Text), `assemblyGuideText` (Text), `assemblyGuideBtn` (Button), `testimonialSection` (Section), `testimonialTitle` (Text), `testimonialPrompt` (Text), `testimonialNameInput` (Input), `testimonialStoryInput` (TextBox), `testimonialSubmitBtn` (Button), `testimonialError` (Text), `testimonialSuccess` (Text), `reviewSection` (Section), `reviewTitle` (Text), `reviewPrompt` (Text), `reviewStar1`–`reviewStar5` (Button), `reviewRating` (Text), `reviewBodyInput` (TextBox), `reviewSubmitBtn` (Button), `reviewSuccess` (Text), `reviewError` (Text)

### White Glove Prompt (NEW — CF-y7lp)
`whiteGlovePromptSection` (Section — collapsed by default), `whiteGlovePromptTitle` (Text), `whiteGlovePromptBody` (Text), `whiteGloveScheduleBtn` (Button → /white-glove-delivery?orderId=)

---

## WHITE GLOVE DELIVERY (`White Glove Delivery.js`) — NEW CF-y7lp

### State Sections (mutually exclusive — one shown at a time)
`wgLoadingSection` (Section), `wgExistingSection` (Section), `wgCalendarSection` (Section), `wgConfirmSection` (Section), `wgErrorSection` (Section), `wgErrorText` (Text)

### Existing Appointment
`existingDateText` (Text), `existingWindowText` (Text), `existingStatusText` (Text), `rescheduleBtn` (Button), `rescheduleNote` (Text — collapsed by default)

### Calendar (Date Picker) ⚠️ REPEATER
`calendarNoSlots` (Text — collapsed by default), `calendarDateRepeater` (Repeater), `calendarBackBtn` (Button)
**↳ Inside:** `calendarDayLabel` (Text), `calendarSelectDayBtn` (Button — disabled when full)

### Window Selector ⚠️ REPEATER
`windowSelectorSection` (Section — collapsed by default), `windowDateLabel` (Text), `windowRepeater` (Repeater), `windowBackBtn` (Button)
**↳ Inside:** `windowLabel` (Text), `windowSpotsText` (Text), `windowSelectBtn` (Button — disabled when full)

### Confirmation
`confirmHeadline` (Text), `confirmSubtext` (Text), `confirmDateText` (Text), `confirmWindowText` (Text), `confirmOrdersBtn` (Button)

---

## ADMIN DELIVERY CALENDAR (`Admin Delivery Calendar.js`) — NEW CF-y7lp

### Appointment Calendar ⚠️ REPEATER
`calendarRangeLabel` (Text), `calendarApptCount` (Text), `calendarEmpty` (Section — collapsed by default), `calendarRepeater` (Repeater), `calendarFromDate` (DatePicker), `calendarToDate` (DatePicker), `calendarFilterBtn` (Button), `calendarFilterError` (Text — collapsed by default)
**↳ Inside:** `apptDate` (Text), `apptWindow` (Text), `apptStatus` (Text), `apptEmail` (Text), `apptPhone` (Text), `apptAddress` (Text), `apptNotes` (Text), `apptOrderId` (Text)

### Block Date Form
`blockDateInput` (DatePicker), `blockReasonInput` (Input), `blockDateSubmitBtn` (Button), `blockFormError` (Text — collapsed by default), `blockFormSuccess` (Text — collapsed by default), `blockedDatesSection` (Section)

---

## ADMIN A/B TESTS (`Admin A-B Tests.js` / `abTestDashboard.web.js`) — NEW CF-0jk5

### Summary Stats
`txtActiveCount` (Text), `txtConcludedCount` (Text), `txtTotalEvents` (Text), `txtReadyToConclude` (Text), `badgeReadyToConclude` (Box/Badge), `txtEmpty` (Text — shown when no experiments exist)

### Experiments ⚠️ REPEATER
`repeaterExperiments` (Repeater)
**↳ Inside:** `barVariant1` (ProgressBar), `barVariant2` (ProgressBar), `lblVariant1` (Text), `lblVariant2` (Text)

### Detail Panel
`panelDetail` (Box/Section — collapsed by default), `btnCloseDetail` (Button), `btnConclude` (Button), `btnRunAutoStop` (Button)

---

## SHIPPING POLICY (`Shipping Policy.ype8c.js`)

### Calculator
`shippingZipInput` (Input), `shippingCalcBtn` (Button), `shippingResult` (Text)

### Delivery Methods ⚠️ REPEATER
`deliveryRepeater` (Repeater) → `deliveryTitle` (Text), `deliveryDesc` (Text)
`assemblyTips` (Text)

### Assembly Guides ⚠️ REPEATER
`assemblyGuidesRepeater` (Repeater) → `guideTitle` (Text), `guideTime` (Text), `guideTools` (Text), `guideSteps` (Text), `guideExpandBtn` (Button)

### Care Tips ⚠️ REPEATER
`careCategoryDropdown` (Dropdown), `careTipsRepeater` (Repeater) → `careTipTitle` (Text), `careTipSummary` (Text), `careTipSteps` (Text), `careTipVideoLink` (Button)

### Delivery Prep
`deliveryTierDropdown` (Dropdown), `deliveryPrepInstructions` (Text), `deliveryPrepTips` (Text)

### Scheduling
`nextAvailableSlot` (Text), `scheduleDeliveryBtn` (Button)

### Schema
`shippingSchemaHtml` (HtmlComponent)

---

## FULLSCREEN / PRODUCT VIDEOS (`Fullscreen Page.vu50r.js`)

`videoPageTitle` (Text), `videoPageSubtitle` (Text), `videoPlayer` (Video), `nowPlayingTitle` (Text), `videoPlayerContainer` (Section), `videoProductLink` (Button), `videoNoResults` (Text)

### Video Grid ⚠️ REPEATER
`videosRepeater` (Repeater) → `videoTitle` (Text), `videoDescription` (Text), `videoThumb` (Image), `videoCategoryBadge` (Text)

### Category Filters ⚠️ REPEATER
`videoCategoryRepeater` (Repeater) → `categoryLabel` (Text)

---

## PRIVACY POLICY (`Privacy Policy.pcvmd.js`)

`policyTitle` (Text), `policyEffectiveDate` (Text), `policyIntro` (Text)
`policyRepeater` (Repeater) → `sectionTitle` (Text), `sectionContent` (Text), `sectionToggle` (Text)
`policyTocRepeater` (Repeater) → `tocLink` (Text)
Anchor sections: `policyCollect`, `policyUse`, `policySharing`, `policyCookies`, `policyRights`, `policySecurity`, `policyChildren`, `policyChanges`, `policyContact` (Sections)

---

## TERMS & CONDITIONS (`Terms & Conditions.z0xvf.js`)

`termsTitle` (Text), `termsEffectiveDate` (Text), `termsIntro` (Text)
`termsRepeater` (Repeater) → `sectionTitle` (Text), `sectionContent` (Text), `sectionToggle` (Text)
`termsTocRepeater` (Repeater) → `tocLink` (Text)
Anchors: `termsAcceptance`, `termsProducts`, `termsOrders`, `termsShipping`, `termsReturns`, `termsWarranties`, `termsIP`, `termsLiability`, `termsGoverning`, `termsContact` (Sections)

---

## REFUND POLICY (`Refund Policy.jmwgj.js`)

`policyRepeater` (Repeater) → `policyTitle` (Text), `policyContent` (Text), `policyToggle` (Text)

---

## SEARCH SUGGESTIONS BOX (`Search Suggestions Box.gg5mx.js`)

`searchInput` (Input), `suggestionsBox` (Box), `suggestionsRepeater` (Repeater)
**↳ Inside:** `sugImage` (Image), `sugName` (Text), `sugPrice` (Text)

---

## COMPARE PAGE (`Compare Page.js`)

**Route**: `/compare?ids=<id1>,<id2>,...` (up to 4 products)

### URL Params / Fetch
`compareGridSection` (Section — opacity skeleton), `compareEmptySection` (Section), `compareErrorSection` (Section), `compareAttrSection` (Section), `compareEmptyShopBtn` (Button), `compareErrorText` (Text)

### Column Rendering ⚠️ REPEATER
`compareSubtitle` (Text), `compareColRepeater` (Repeater) → `compareColImage` (Image), `compareColName` (Text), `compareColPrice` (Text), `compareColOrigPrice` (Text), `compareColBadge` (Text), `compareColAddCart` (Button), `compareColViewBtn` (Button), `compareColRemoveBtn` (Button)

### Attributes Table ⚠️ REPEATER
`compareAttrRepeater` (Repeater) → `compareAttrLabel` (Text), `compareAttrRow` (HtmlComponent — diff-highlighted cells)

### Mobile & Reset
`compareMobileSnapHtml` (HtmlComponent — snap-scroll CSS via postMessage, mobile only), `compareResetBtn` (Button)

### SEO
`compareSchemaHtml` (HtmlComponent — ItemList JSON-LD via postMessage)

---

## FABRIC SWATCHES (`Fabric Swatches.js`)

**Route**: `/swatches` — optional `?product=<slug>` pre-filters by product referral

### Filter Controls
`swatchDataset` (Dataset — FabricSwatches CMS), `swatchSearchInput` (Input — debounced 250ms), `swatchColorFilter` (Dropdown), `swatchMaterialFilter` (Dropdown), `swatchBrandFilter` (Dropdown — client-side), `swatchClearFilters` (Button), `swatchResultCount` (Text — aria-live polite), `swatchEmptyState` (Box — collapsed until 0 results)

### Swatch Grid ⚠️ REPEATER
`swatchGridRepeater` (Repeater — CMS-driven) → `swatchCard` (Box — border on select), `swatchColorDot` (Box — hexColor bg), `swatchImage` (Image), `swatchName` (Text), `swatchMaterial` (Text), `swatchBrand` (Text), `swatchOutOfStock` (Box — expanded when out of stock), `swatchSelectedBadge` (Box — expanded when selected), `swatchSelectBtn` (Button — "Add"/"Remove" toggle, disabled at max-5)

### Selection Tray ⚠️ REPEATER
`swatchTraySection` (Section — collapsed at 0 selections), `swatchTrayTitle` (Text — "Your Selections (N / 5)"), `swatchSelectionRepeater` (Repeater) → `swatchTrayDot` (Box), `swatchTrayName` (Text), `swatchTrayRemove` (Button)
`swatchTrayProceedBtn` (Button — opens form), `swatchTrayClearBtn` (Button — clears all)

### Request Form
`swatchFormOverlay` (Box — collapsible overlay), `swatchFormModal` (Box — accessible dialog), `swatchFormClose` (Button — X close)
`swatchFirstName` (Input), `swatchLastName` (Input), `swatchEmail` (Input), `swatchAddress1` (Input), `swatchAddress2` (Input — optional), `swatchCity` (Input), `swatchState` (Input), `swatchZip` (Input — 5-digit), `swatchPhone` (Input — optional)
`swatchSubmitBtn` (Button — cycles "Send My Swatches"/"Sending..."), `swatchFormError` (Text — collapsed until error), `swatchFormSuccess` (Box — collapsed until success), `swatchSuccessShopBtn` (Button)

### SEO
`swatchSchemaHtml` (HtmlComponent — Service JSON-LD: Free Fabric Swatch Program)

---

## WISHLIST SHARE (`Wishlist Share.js`)

**Route**: `/wishlist-share?token=<token>` — public shareable wishlist

### Token Resolution
`wishlistShareContentSection` (Section — opacity skeleton), `wishlistShareInvalidSection` (Section), `wishlistShareInvalidText` (Text), `wishlistShareShopBtn` (Button — all states), `wishlistShareTitle` (Text — "{ownerName}'s Wishlist"), `wishlistShareSubtitle` (Text — "N item(s)"), `wishlistShareEmptySection` (Section)

### Product Cards ⚠️ REPEATER
`wishlistShareRepeater` (Repeater) → `shareImage` (Image), `shareName` (Text), `shareAddCart` (Button — cycles "Add to Cart"/"Adding..."/"Added!", 2s reset)

### SEO
Dynamic via `wix-seo` API only — no HtmlComponent needed. Valid: OG tags + title. Invalid: noindex.

---

## SUSTAINABILITY (`Sustainability.js`)

### Hero
`sustainHeroHeading` (Text), `sustainHeroSubheading` (Text), `sustainHeroIntro` (RichText)

### Commitment Badges ⚠️ REPEATER
`badgesRepeater` (Repeater)
**↳ Inside:** `badgeLabel` (Text), `badgeDesc` (Text)

### Certifications ⚠️ REPEATER
`certificationsHeading` (Text), `certificationsRepeater` (Repeater)
**↳ Inside:** `certName` (Text), `certDesc` (RichText)

### Materials ⚠️ REPEATER
`materialsHeading` (Text), `materialsDescription` (Text), `materialsRepeater` (Repeater)
**↳ Inside:** `materialTitle` (Text), `materialDesc` (Text)

### Carbon Offset
`carbonOffsetSection` (Box), `carbonHeading` (Text), `carbonDescription` (Text)

### Trade-In Program ⚠️ REPEATER
`tradeInHeading` (Text), `tradeInDescription` (Text), `tradeInEstimate` (Text), `tradeInCondition` (Dropdown or Text), `tradeInStepsRepeater` (Repeater)
**↳ Inside:** `stepNumber` (Text), `stepTitle` (Text), `stepDesc` (Text)

### SEO Schema
`sustainSchemaHtml` (HtmlComponent) — JSON-LD FAQPage/Organization schema

---

## PRICE MATCH GUARANTEE (`Price Match Guarantee.js`)

### Page Header
`priceMatchTitle` (Text), `priceMatchDescription` (RichText)

### Request Form
`pmFormSection` (Box), `pmProductName` (Input), `pmProductId` (Input — hidden), `pmCompetitorSelect` (Dropdown), `pmCompetitorUrl` (Input), `pmOurPrice` (Input), `pmCompetitorPrice` (Input), `pmNotes` (TextBox), `pmSubmitBtn` (Button), `pmFormError` (Text), `pmProductNameError` (Text), `pmCompetitorUrlError` (Text), `pmOurPriceError` (Text), `pmCompetitorPriceError` (Text), `pmCompetitorError` (Text)

### Savings Preview
`pmSavingsPreview` (Box) — shows calculated savings before submit

### Success State
`pmSuccessSection` (Box), `pmSuccessMessage` (Text)

### My Requests ⚠️ REPEATER
`pmRequestsSection` (Box), `pmNewRequestBtn` (Button), `pmRequestsRepeater` (Repeater)
**↳ Inside:** `pmReqDate` (Text), `pmReqProductName` (Text), `pmReqCompetitorName` (Text), `pmReqCompetitorPrice` (Text), `pmReqOurPrice` (Text), `pmReqSavings` (Text), `pmReqStatus` (Text), `pmReqCreditAmount` (Text), `pmReqClaimNumber` (Text), `pmReqAdminNotes` (Text)

### Policy Display ⚠️ REPEATERS
`policyRulesRepeater` (Repeater) → `policyRuleText` (Text)
`policyExclusionsRepeater` (Repeater) → `exclusionText` (Text)

---

## STYLE QUIZ (`Style Quiz.js`)

### Quiz Steps
`quizSection` (Box), `quizStepTitle` (Text), `quizStepSubtitle` (Text), `quizProgressBar` (ProgressBar), `quizProgressText` (Text), `quizOptionsRepeater` (Repeater), `quizNextBtn` (Button), `quizBackBtn` (Button), `quizValidation` (Text), `quizLoadingState` (Box), `quizLoadingText` (Text)

### Options ⚠️ REPEATER
`quizOptionsRepeater` (Repeater)
**↳ Inside:** `optionContainer` (Box), `optionLabel` (Text), `optionDescription` (Text)

### Results
`quizResults` (Box), `resultsTitle` (Text), `resultsSubtitle` (Text), `styleProfileSection` (Box), `styleProfileTitle` (Text), `styleProfileDescription` (Text), `resultMatchBadge` (Text), `resultMatchReason` (Text), `resultsBrowseBtn` (Button), `quizRestartBtn` (Button)

### Results ⚠️ REPEATER
`quizProductsRepeater` (Repeater), `resultsRepeater` (Repeater)
**↳ Inside:** `resultProductImage` (Image), `resultProductName` (Text), `resultProductPrice` (Text), `resultViewBtn` (Button)

### AI Style Consultant (Sprint 5 — `styleConsultant.web.js`)

**Backend:** `styleConsultant.web.js` (new — extends existing Style Quiz backend)

#### AI Results Section (added to existing Style Quiz results area)
`aiConsultSection` (Box), `aiConsultTitle` (Text), `aiConsultResponse` (RichTextBox), `aiConsultShippingEstimate` (Text), `aiConsultLoadingState` (Box), `aiConsultLoadingText` (Text), `aiConsultErrorText` (Text), `aiRecommendedRepeater` (Repeater), `aiConsultShareBtn` (Button), `aiConsultSaveBtn` (Button)

**↳ Inside `aiRecommendedRepeater`:** `aiProductImage` (Image), `aiProductName` (Text), `aiProductPrice` (Text), `aiProductAddBtn` (Button)

**Behavior:**
- After quiz completion, AI analyzes answers + budget + room size → generates personalized recommendation narrative.
- `aiConsultShippingEstimate` shows: "Ships to [zip] in 3–5 days for $X (UPS Ground)" — fed from `calculateBundleQuote`.
- `aiConsultShareBtn` generates shareable link (extends existing share feature).
- `aiConsultSaveBtn` saves consultation to account (if logged in) or prompts email capture.

---

## BLOG (`Blog.js`)

### Header + Filter
`categoryFilterRepeater` (Repeater), `postCount` (Text), `blogPagination` (Box), `nextPageBtn` (Button), `pageIndicator` (Text), `blogEmptyState` (Box)

### Filter Chips ⚠️ REPEATER
`categoryFilterRepeater` (Repeater)
**↳ Inside:** `filterChip` (Box), `filterLabel` (Text)

### Featured Post
`featuredHeroSection` (Box), `featuredHeroLink` (Box), `featuredTitle` (Text), `featuredExcerpt` (Text), `featuredCategory` (Text), `featuredDate` (Text), `featuredReadTime` (Text), `featuredAuthor` (Text)

### Post List ⚠️ REPEATER
`blogListRepeater` (Repeater)
**↳ Inside:** `cardTitle` (Text), `cardExcerpt` (Text), `cardCategory` (Text), `cardDate` (Text), `cardReadTime` (Text), `blogCardLink` (Box)

### Related Products ⚠️ REPEATER
`blogProductsSection` (Box), `blogProductsRepeater` (Repeater)

### Newsletter Capture
`blogNewsletterEmail` (Input), `blogNewsletterSubmit` (Button), `blogNewsletterSuccess` (Text), `blogNewsletterError` (Text)

### SEO
`blogSeoSchema` (HtmlComponent)

---

## BLOG POST (`Blog Post.js`)

### Content
`blogTitle` (Text), `blogBody` (RichText), `blogAuthor` (Text), `blogDate` (Text), `postCategory` (Text), `postDate` (Text), `postReadTime` (Text), `postMetaHtml` (HtmlComponent), `postSeoSchema` (HtmlComponent)

### Author Bio
`authorBioSection` (Box), `authorName` (Text), `authorDescription` (Text), `authorLocation` (Text), `authorEstablished` (Text)

### Share Buttons
`postShareFacebook` (Button), `postShareTwitter` (Button), `postSharePinterest` (Button), `postShareEmail` (Button), `postShareCopyLink` (Button)

### Related Posts ⚠️ REPEATER
`relatedPostsSection` (Box), `relatedPostsRepeater` (Repeater)
**↳ Inside:** `relatedTitle` (Text), `relatedCategory` (Text), `relatedReadTime` (Text), `relatedPostLink` (Box)

### Newsletter Capture
`blogNewsletterInput` (Input), `blogNewsletterSubmit` (Button), `blogNewsletterSuccess` (Text), `blogNewsletterError` (Text)

---

## ROOM PLANNER (`Room Planner.js`)

### Hero
`plannerHeroHeading` (Text), `plannerHeroSubheading` (Text)

### How-To Steps ⚠️ REPEATER
`plannerStepsRepeater` (Repeater)
**↳ Inside:** `stepNumber` (Text), `stepTitle` (Text), `stepDesc` (Text)

### Room Setup
`roomShapeDropdown` (Dropdown), `roomLengthInput` (Input), `roomWidthInput` (Input), `roomDimensionDisplay` (Text), `plannerStatusText` (Text)

### Room Presets ⚠️ REPEATER
`roomPresetsRepeater` (Repeater)
**↳ Inside:** `presetName` (Text), `presetDims` (Text)

### Product Palette ⚠️ REPEATER
`productPaletteRepeater` (Repeater), `plannerProductRepeater` (Repeater)
**↳ Inside:** `plannerProductName` (Text), `plannerProductDims` (Text), `plannerProductCategory` (Text), `plannerProductImage` (Image), `plannerAddBtn` (Button)

### Palette Category ⚠️ REPEATER
`paletteCategoryRepeater` (Repeater)
**↳ Inside:** `paletteCategoryName` (Text)

### Canvas
`plannerCanvas` (HtmlComponent)

### Save/Share
`layoutNameInput` (Input), `saveLayoutBtn` (Button), `shareLayoutBtn` (Button), `shareUrlText` (Text)

---

## COMMUNITY GALLERY (`Community Gallery.js`)

### Gallery Grid ⚠️ REPEATER
`galleryMasonryRepeater` (Repeater)
**↳ Inside:** `galleryPhotoCard` (Box), `galleryPhotoImg` (Image), `galleryCustomerName` (Text), `galleryFeaturedBadge` (Box), `galleryRoomTypeBadge` (Text), `galleryProductLink` (Button)

### Filters ⚠️ REPEATER
`galleryFilterRepeater` (Repeater)
**↳ Inside:** `filterTab` (Box), `filterTabLabel` (Text)

### State
`galleryLoadMoreBtn` (Button), `galleryLoadingSpinner` (Box), `galleryEmptyState` (Box), `galleryEmptyStateText` (Text), `galleryPhotoCount` (Text)

### Lightbox
`galleryLightbox` (Box), `galleryLightboxOverlay` (Box), `galleryLightboxImage` (Image), `galleryLightboxClose` (Button), `galleryLightboxCaption` (Text), `galleryLightboxCustomer` (Text), `galleryLightboxProductLink` (Button)

---

## REFERRAL PAGE (`Referral Page.js`)

### Auth State
`referralLoggedOutBox` (Box), `referralLoginBtn` (Button), `referralMainContent` (Box), `referralErrorFallback` (Box), `referralErrorText` (Text)

### Your Code/Link
`referralCodeText` (Text), `copyCodeBtn` (Button), `referralLinkText` (Text), `copyLinkBtn` (Button), `referralLinkError` (Text)

### Share Buttons
`shareFacebookBtn` (Button), `shareEmailBtn` (Button), `shareSmsBtn` (Button)

### Stats
`referralStatsSection` (Box), `referralStatsEmpty` (Box), `referralStatsCards` (Box), `statTotalFriends` (Text), `statSuccessRate` (Text), `statTotalEarned` (Text), `statAvailableCredit` (Text)

### How It Works ⚠️ REPEATER
`howItWorksRepeater` (Repeater)
**↳ Inside:** `stepIcon` (Image), `stepDescription` (Text)

### History ⚠️ REPEATER
`referralHistorySection` (Box), `referralHistoryEmpty` (Text), `referralHistoryRepeater` (Repeater)
**↳ Inside:** `historyFriendName` (Text), `historyDate` (Text), `historyStatus` (Text), `historyCredit` (Text)

---

## UGC GALLERY (`UGC Gallery.js`)

### Stats
`ugcTotalCount` (Text), `ugcFeaturedCount` (Text)

### Submit
`ugcSubmitSection` (Box), `ugcSubmitPhotoBtn` (Button), `ugcSubmitModal` (Box), `ugcSubmitModalTitle` (Text), `ugcSubmitModalClose` (Button)

### State
`ugcBeforeAfterSection` (Box), `ugcEmptyState` (Box), `ugcGallerySkeleton` (Box)

---

## SUBMIT PHOTO REVIEW (`Submit Photo Review.js`)

### Form
`submitFormSection` (Box), `productNameDisplay` (Text), `ratingInput` (Box), `photoUploadButton` (Button), `photoPreview` (Image), `captionInput` (TextBox), `reviewTextInput` (TextBox), `submitBtn` (Button), `validationMessage` (Text)

### Success
`successSection` (Box), `successMessage` (Text)

---

## TOPIC CLUSTER (`Topic Cluster.js`)

### Breadcrumb ⚠️ REPEATER
`breadcrumbRepeater` (Repeater)
**↳ Inside:** `breadcrumbLabel` (Text)

### Content
`clusterContent` (Box), `pillarIntro` (Text), `notFoundMessage` (Text)

### Content Sections ⚠️ REPEATER
`contentSectionRepeater` (Repeater)
**↳ Inside:** `sectionHeading` (Text), `sectionBody` (RichText)

### FAQ ⚠️ REPEATER
`faqRepeater` (Repeater)
**↳ Inside:** `faqQuestion` (Text), `faqAnswer` (Text)

### Spoke Cards ⚠️ REPEATER
`spokeCardRepeater` (Repeater)
**↳ Inside:** `spokeTitle` (Text), `spokeTypeLabel` (Text), `spokeCardLink` (Box)

### Internal Links ⚠️ REPEATER
`internalLinksRepeater` (Repeater)
**↳ Inside:** `linkItem` (Box), `linkAnchorText` (Text)

### Related Clusters ⚠️ REPEATER
`relatedClusterRepeater` (Repeater)
**↳ Inside:** `relatedClusterTitle` (Text), `relatedClusterLink` (Box)

---

## GIFT CARDS (`Gift Cards.js`)

### Purchase Form
`gcPurchaseForm` (Box), `gcDenomRepeater` (Repeater), `gcPurchaserEmail` (Input), `gcRecipientName` (Input), `gcRecipientEmail` (Input), `gcMessage` (TextBox), `gcPurchaseBtn` (Button), `gcPurchaseError` (Text), `gcPurchaseSuccess` (Box)

### Denominations ⚠️ REPEATER
`gcDenomRepeater` (Repeater)
**↳ Inside:** `gcDenomLabel` (Text)

### Balance Check
`gcCodeInput` (Input), `gcCheckBalanceBtn` (Button), `gcBalanceResult` (Box), `gcBalanceAmount` (Text), `gcBalanceStatus` (Text), `gcBalanceExpiry` (Text), `gcBalanceUsage` (Text), `gcBalanceError` (Text)

---

## Sprint 4 Feature Additions (2026-03-20-21, v1.0.0+)

### Social Media Automation
- **Social story cron** (`socialStoryService.web.js`): Generates + posts scheduled content to Twitter/FB/IG/Pinterest via platform APIs. Runs via Wix cron job.
- **Facebook catalog alert** (`facebookCatalogAlertService.web.js`): Monitors FB product catalog freshness, sends admin alerts when catalog sync lags > threshold.
- **Pinterest Rich Pins** (`pinterestService.web.js`): Validates og:type/og:price/og:availability meta tags on product pages for Pinterest Rich Pin eligibility. Tests in `tests/pinterestRichPins.test.js`.

### Email Automation
- **Transactional emails** (`transactionalEmailService.web.js`): Order confirmation, shipping notification, delivery confirmation using Wix triggered emails. Templates: `order_confirm`, `order_shipped`, `order_delivered`. 62 tests in `tests/transactionalEmail.test.js`.
- **Exit intent capture** (`src/public/exitIntentCapture.js` + `exitIntentCaptureService.web.js`): Desktop (mouseleave) + mobile (scroll velocity) exit intent popup. Offers 10% discount code WELCOME10. Rate-limited, sessionStorage prevents re-show. Tests in `tests/exitIntentCapture.test.js`.
- **Cart recovery** (`cartRecoveryService.web.js`): `generateRecoveryCoupon()` + `sendRecoveryEmail()` — per-cart unique coupons, 10% discount, 24hr expiry. Used by abandoned cart flow.

### Commerce
- **Cart recovery per-cart coupons** (`cartRecoveryService.web.js`): Each recovery email gets a unique coupon code tied to that specific cart ID, preventing coupon sharing. See `tests/cartRecovery.test.js`.
- **Loyalty endpoint** (`loyaltyService.web.js`): Points balance, earn, redeem — all with IDOR guard (member can only access own points). CF-b0u3. See `tests/loyaltyService.test.js`.
- **Referral endpoints** (`referralService.web.js`): Referral link generation, tracking, reward — anti-hijack guard prevents referral farming. CF-kt9w. See `tests/referralService.test.js`.

### Content & SEO
- **Topic cluster pages** (`topicClusterService.web.js` + HTTP endpoint): `/guides/{slug}` CMS-driven pillar content pages. Topic clusters with internalLinks and pillarContent fields. CF-kj47.
- **Blog CMS listing** (`blogService.web.js` updated): `getPublishedBlogPosts(page, perPage)` queries `wix-blog-backend` for live CMS content instead of static data. `Blog.js` wired to live data.
- **Style Quiz S2** (`styleQuiz.web.js` + `src/public/styleQuiz.js`): Full quiz state machine — question flow, scoring, product recommendation matching. CF-g5fa.

### Wix Dashboard Integrations (tracked 2026-03-21)
- **TikTok Pixel**: Installed via Wix Marketing Integrations (PR #505)
- **Pinterest Tag**: Installed via Wix Marketing Integrations (PR #505)
- **Google Analytics 4**: Connected via Wix Analytics (requires Premium for full event tracking)
- **Facebook Pixel**: Configured (requires Premium/Go-live for production events)
- All pixels blocked on staging — need Premium upgrade + custom domain for production tracking

---

## LOCAL SEO CITY PAGE (`Near City Page.js`)

**Route**: `/near/[city-slug]` (dynamic, router-based)
**Source**: `src/pages/Near City Page.js`
**PR**: #522 (CF-kj47), #531 (CF-kljz), #530 (CF-4poq), #528 (CF-gjy4), #536 (CF-54s6)

| Element ID | Wix Element | Notes |
|---|---|---|
| `routerData` | HtmlComponent | Hidden — receives router data via postMessage |
| `localPageContent` | Box/Section | Main content container — hidden if city not found |
| `notFoundMessage` | Text | "City page not found" fallback |
| `cityTitle` | Text | `{city}, {state}` heading |
| `cityHeadline` | Text | SEO headline for the city |
| `directionsText` | Text | Directions description text |
| `directionsBtn` | Button | "Get Directions" → Google Maps link |
| `mapEmbed` | Iframe/Image | Google Maps static embed |
| `homeCityBadge` | Box/Text | "Serving the {city} area" badge — show/hide based on city proximity |

**`featuredProductsRepeater`** ⚠️ REPEATER — city-relevant products:

| Child ID | Wix Element | Notes |
|---|---|---|
| `productImage` | Image | Product image |
| `productName` | Text | Product name |
| `productPrice` | Text | Price display |
| `viewProductBtn` | Button | "View Product" CTA |

**`nearbyAreasRepeater`** ⚠️ REPEATER — cross-links to nearby city pages (PR #536):

| Child ID | Wix Element | Notes |
|---|---|---|
| `nearbyAreaLink` | Button/Link | Link to nearby city page |
| `nearbyAreaLabel` | Text | City name label |

**JSON-LD**: Injected via backend — no editor element needed (uses `wix-seo` module).

---

## REFERRAL SHARE PAGE (`Referral Share.js`)

**Route**: `/referral` (static page)
**Source**: `src/pages/Referral Share.js` (or `public/referralUI.js`)
**PR**: #524 (CF-ld8w)

| Element ID | Wix Element | Notes |
|---|---|---|
| `referralWidget` | Box | Main referral widget container |
| `loadingState` | Box | Spinner/loading state — shown while fetching referral data |
| `errorState` | Box | Error message container |
| `dashboardError` | Text | Error message text |
| `referralLink` | Text/Input | Displays the referral URL for copying |
| `copyBtn` | Button | "Copy Link" — copies referralLink to clipboard |
| `shareButtons` | Box | Social share buttons container |
| `totalReferrals` | Text | "X friends referred" count |
| `earnedRewards` | Text | "You've earned $X" |
| `pendingRewards` | Text | "Pending: $X" |

**Clone candidate**: Member Page (has similar dashboard layout).

---

## SUBMIT PHOTO REVIEW PAGE (`Submit Photo Review.js`)

**Route**: `/submit-review` (static page)
**Source**: `src/pages/Submit Photo Review.js`
**PR**: #532 (CF-zkdy-ui-submit)

| Element ID | Wix Element | Notes |
|---|---|---|
| `submitFormSection` | Box | Main form container — expand/collapse |
| `productNameDisplay` | Text | Pre-filled product name (from query param) |
| `photoUploadButton` | UploadButton | Wix UploadButton for photo selection |
| `photoPreview` | Image | Preview of selected photo — collapsed until file chosen |
| `ratingInput` | StarRating/Slider | Rating (1-5 stars) |
| `reviewTextInput` | TextArea | Review body text |
| `captionInput` | TextInput | Short photo caption |
| `validationMessage` | Text | Inline validation error — expanded on error |
| `submitBtn` | Button | "Submit Photo" — disabled during upload |
| `successSection` | Box | Success state container — collapsed by default |
| `successMessage` | Text | "Thanks! Your photo is in review." |

---

## PAGES THAT NEED CREATING (no frontend code yet)

All major pages now have both backend and frontend code. The following are in development or planned:

| Page | Status | Notes |
|---|---|---|
| Style Quiz | ✅ Frontend + backend complete | S4 (state persistence + share) in progress |
| Blog | ✅ Frontend + backend complete | — |
| Room Planner | ✅ Frontend + backend complete (S1–S7) | — |
| Gift Cards | ✅ Frontend + backend complete | — |
| Local SEO | ✅ Frontend + backend complete | S2 (schema + FAQ) in progress |

---

## Design Tokens (for manual color/font reference)

| Token | Value | Usage |
|---|---|---|
| Espresso | `#3A2518` | Headers, trust bar bg, primary dark |
| Mountain Blue | `#5B8FA8` | Accents, links, CTA secondary |
| Coral | `#E8845C` | Sale badges, urgency, CTA primary |
| Sand Light | `#FAF7F2` | Page backgrounds |
| Sand Medium | `#F5F0E8` | Card backgrounds |
| Cream | `#FFF8F0` | Alternate section bg |

---

## SHIPPING INTELLIGENCE — CMS Reference

**Spec:** `docs/superpowers/specs/2026-03-22-shipping-intelligence-layer-design.md`
**Backend:** `shippingIntelligence.web.js`, `wwex-freight.web.js`
**New CMS collection:** `ProductShippingProfiles` — per-product weight, dims, freight class, handling fee

### ProductShippingProfiles CMS Fields (for reference — edited directly in Wix CMS)

| Field | Type | Notes |
|---|---|---|
| `productId` | string | Wix product `_id` — unique index |
| `weight_lbs` | number | Actual packed weight |
| `length_in` | number | Longest box dimension |
| `width_in` | number | Box width |
| `height_in` | number | Box height |
| `freightClass` | string | NMFC class (`"150"`, `"200"`) — required for LTL quotes |
| `requiresPallet` | boolean | Forces LTL routing regardless of weight |
| `requiresFreight` | boolean | Always route to freight, never parcel |
| `handlingFee_usd` | number | Per-order handling charge (pallet build, oversized surcharge). Added to displayed shipping cost. Default 0. |
| `customItemFlag` | boolean | Triggers manual pricing review path |
| `packagingNotes` | string | e.g. "Ships in 2 boxes", "mattress compressed" |

> **Tier routing:** total weight < 150 lbs AND no pallet flag → UPS parcel. Over 150 lbs OR `requiresPallet` → WWEX SpeedFreight 2.0 LTL.

> **Element IDs:** See **Product Page → Shipping Intelligence Layer** and **Bundle Builder → Bundle Builder Shipping** sections above.

---

## GIFT REGISTRY (`Gift Registry.js`) — NEW CF-easy

*Source: `src/pages/Gift Registry.js` — three modes: list, manage, public view*
*Backend: `src/backend/giftRegistry.web.js`*

Members can create, manage, and share gift registries. A shareable public URL shows registry contents to guests. **All form elements and repeaters must be collapsed by default.**

### Registry List & Create Form

| Element ID | Wix Element | Notes |
|---|---|---|
| `registryCount` | Text | "X registr(y\|ies)" summary label |
| `registryEmptyState` | Box | Empty state — expand when no registries |
| `registryRepeater` | Repeater | One item per registry |
| `registryCreateBtn` | Button | "Create Registry" CTA |
| `registryCreateForm` | Box | Create form container — collapsed by default |
| `registryTitleInput` | TextInput | Registry name field |
| `registryOccasionDropdown` | Dropdown | Occasion selector |
| `registryDatePicker` | DatePicker | Event date |
| `registryMessageInput` | TextBox | Optional message/description |
| `registryPublicToggle` | Toggle | Public/private visibility |
| `registrySubmitBtn` | Button | Submit new registry |
| `registryCancelBtn` | Button | Cancel / collapse form |
| `registryFormError` | Text | Inline error — collapsed by default |

**↳ Inside `registryRepeater`:**

| Child ID | Wix Element | Notes |
|---|---|---|
| `registryItemTitle` | Text | Registry name |
| `registryItemOccasion` | Text | Formatted occasion |
| `registryItemDate` | Text | Event date "MMM D, YYYY" |
| `registryItemCount` | Text | "X item(s)" |
| `registryManageBtn` | Button | Navigate to manage view |

---

## BUNDLE BUILDER (Sprint 5 — `/bundle`) ✅ MERGED PR #677 2026-03-22

**Backend:** `bundleBuilder.web.js` / `bundleService.web.js`
**Frontend:** `src/pages/Bundle.js`

### Page-level Elements
| Nickname | Type | Notes |
|----------|------|-------|
| `bundleHeroSection` | Box | Page hero wrapper |
| `bundleProductRepeater` | Repeater | ⚠️ Product picker grid — `onItemReady` BEFORE `.data` |
| `bundleSummarySection` | Box | Right-rail summary panel |
| `bundleSummaryRepeater` | Repeater | ⚠️ Selected items list — `onItemReady` BEFORE `.data` |
| `bundleTotalPrice` | Text | Shows `$X.XX` — NaN-guarded |
| `bundleDiscountBadge` | Box/Text | Discount % badge, hidden when no discount |
| `bundleAddToCartBtn` | Button | Adds full bundle to cart |
| `bundleEmptyState` | Box | Shown when no products loaded |
| `bundleError` | Text | Error message display |
| `bundleLoader` | Box | Loading spinner overlay |

**↳ Inside `bundleProductRepeater`:** `bundleProductName` (Text), `bundleProductPrice` (Text), `bundleProductImage` (Image), `bundleSelectBtn` (Button — `aria-pressed` toggles), `bundleSelectedBadge` (Box — visible when selected)

**↳ Inside `bundleSummaryRepeater`:** `bundleSummaryName` (Text), `bundleSummaryPrice` (Text), `bundleSummaryRemoveBtn` (Button)

**Accessibility note:** `bundleSelectBtn` uses `aria-pressed` (`'true'`/`'false'`) — Wix sets this via `accessibility.ariaPressed`. Screen readers announce selection state automatically.

### Bundle Builder Shipping

`bundleShippingSection` (Box), `bundleShippingZip` (Input), `bundleShippingBtn` (Button), `bundleShippingResult` (Box), `bundleShippingOptions` (Repeater), `bundleFreightNote` (Text)

**↳ Inside `bundleShippingOptions`:** `bundleOptionTitle` (Text), `bundleOptionCost` (Text), `bundleOptionDelivery` (Text)

---

## CUSTOMER ROOM GALLERY UGC (Sprint 5 — `/rooms`)

**Backend:** `roomGallery.web.js` (new)

### Gallery Grid
`roomGallerySection` (Box), `roomGalleryRepeater` (Repeater), `roomGalleryLoadMoreBtn` (Button), `roomGalleryEmptyState` (Box), `roomGalleryFilterSection` (Box), `roomStyleFilter` (Dropdown), `roomProductFilter` (Dropdown)

**↳ Inside `roomGalleryRepeater`:** `roomPhotoImage` (Image), `roomPhotoCaption` (Text), `roomPhotoProduct` (Text), `roomPhotoLikeBtn` (Button), `roomPhotoLikeCount` (Text), `roomPhotoOwner` (Text)

### Submission Form
`roomSubmitSection` (Box), `roomPhotoUpload` (UploadButton), `roomSubmitCaption` (Input), `roomSubmitProduct` (Dropdown), `roomSubmitStyle` (Dropdown), `roomSubmitEmail` (Input), `roomSubmitBtn` (Button), `roomSubmitSuccess` (Box), `roomSubmitError` (Text), `roomSubmitTerms` (Checkbox)

---

## CMS COLLECTIONS — Sprint 5 New Collections

| Collection | Purpose | Key Fields |
|---|---|---|
| `ProductShippingProfiles` | Per-product packaging data for accurate shipping | productId, weight_lbs, dims, freightClass, handlingFee_usd, requiresPallet |
| `BundleConfigs` | Saved bundle configurations (for sharing + reuse) | bundleId, items[], totalWeight, lastShippingQuote |
| `CustomerRoomPhotos` | UGC room photos + metadata | photoUrl, caption, productId, style, status, likes |
| `ShippingRateCache` | Cached UPS/WWEX rate results (TTL 15min) | productId+zip key, rates[], cachedAt |

## CMS COLLECTIONS — Spin Wheel (CF-spin-wheel Phase 1)

| Collection | Purpose | Key Fields |
|---|---|---|
| `SpinPrizes` | Active prize pool for the spin wheel | active, weight, prizeType, pointsAwarded, prizeValue, label, color |
| `BonusSpinGrants` | Gamification event → bonus spin grant rules | triggerEvent, active, spinsGranted |
| `SpinHistory` | Audit log of all spins (daily + bonus) | memberId, spinDate, spinType, prize, pointsAwarded, prizeType, eventId, createdAt |
| `MemberPendingPrizes` | Unclaimed non-points prizes (e.g. free shipping, discounts) | memberId, prizeType, prizeValue, prizeLabel, spinHistoryId, eventId, claimedAt, createdAt |

Also required: `MemberPoints.bonusSpinsAvailable` (Number field — add to existing `MemberPoints` collection).

## CMS COLLECTIONS — Comfort Timeline (CF-256r, PR #875, 2026-03-28)

| Collection | Purpose | Key Fields |
|---|---|---|
| `ComfortTimelines` | Per-order mattress break-in tracker | orderId (Text, indexed), memberId (Text, indexed), productId (Text), productName (Text), deliveredAt (DateTime), status (Text: active\|complete\|cancelled), currentDay (Number), lastCheckIn (DateTime), comfortLogs (Text/JSON: [{day, rating, notes, loggedAt}]), milestonesCompleted (Text/JSON: [day numbers]), crossSellTriggered (Boolean), supportEscalated (Boolean) |
| `ComfortTimelineRateLimit` | Rate-limit table for logComfortRating | key (Text), count (Number), windowStart (DateTime) |

**Backend methods** (`src/backend/comfortTimeline.web.js`):
- `createTimeline({ orderId, memberId, productId, productName })` — called from `events.js` on order delivered
- `logComfortRating(timelineId, rating, notes)` — SiteMember permission
- `getTimeline(orderId)` — SiteMember permission
- `getMyTimelines()` — SiteMember permission
- `processMilestones(cronSecret)` — Admin permission, runs daily

**Cron job** — add to `vercel.json` or Wix scheduled jobs: `processMilestones` daily at 06:00 UTC.

**No page wiring yet** — Member Dashboard section to show break-in progress is a follow-on task.

---

## CMS COLLECTIONS — Futon Sommelier (CF-ofc0, PR #876, 2026-03-28)

| Collection | Purpose | Key Fields |
|---|---|---|
| `SommelierSessions` | Cached recommendation sessions | sessionKey (Text, indexed), memberId (Text), answers (Text/JSON), recommendations (Text/JSON), reasoning (Text), createdAt (DateTime), feedbackRating (Number) |
| `SommelierRateLimit` | Rate-limit table for getRecommendations | key (Text), count (Number), windowStart (DateTime) |

**Backend methods** (`src/backend/futonSommelier.web.js`):
- `getRecommendations(answers)` — SiteMember permission; returns top-5 scored products with reasoning
- `submitFeedback(sessionId, rating)` — SiteMember permission

**Lifecycle scoring** — rule-based trait matching against product descriptions; no AI API call. Scores across 6 lifestyle factors: primaryUse, petOwner, backIssues, guestFrequency, sunExposure, budget.

**No page wiring yet** — Style Quiz handoff or standalone "Find My Match" page is a follow-on task.

---

## PAGES THAT NEED CREATING (updated Sprint 5)

| Page | Status | Notes |
|---|---|---|
| Style Quiz | ✅ Frontend + backend complete | S5 AI enhancements in progress |
| Blog | ✅ Frontend + backend complete | — |
| Room Planner | ✅ Frontend + backend complete (S1–S7) | — |
| Gift Cards | ✅ Frontend + backend complete | — |
| Local SEO | ✅ Frontend + backend complete | S2 (schema + FAQ) in progress |
| Bundle Builder | ✅ Frontend + backend complete | PR #677 merged 2026-03-22 |
| Live Inventory + Low Stock | ✅ Frontend + backend complete | PR #676 merged 2026-03-22 |
| Product Q&A Widget | ✅ Frontend + backend complete | PR #678 merged 2026-03-22 |
| Customer Room Gallery | 🔄 In review PR #673 — onItemReady fix pending | `/rooms` — Sprint 5 |
| Shipping Intelligence Widget | ✅ Frontend + backend complete | Product page — PR #674 merged 2026-03-22 |
| Comfort Timeline Widget | 🔲 Backend merged (PR #875) — Member Dashboard section TBD | CF-256r — break-in tracker |
| Futon Sommelier Widget | ✅ Wired to StyleQuizResult page (PR #919, cf-p1c9) | CF-ofc0 — lifestyle recommendation engine |
| Personalized Hero | 🔲 Backend merged (commit f0fbb9fd) — Home page hero wiring TBD | CF-tj6f — blocked on Home page hookup |
| Futon Fit Score | 🔲 Backend merged (commit 92ed82b2) — Product card wiring TBD | CF-hx8m — "94% match" badge on product cards |
| AI Room Staging | 🔲 Backend merged (commit 17a72f85) — PDP "See It In Your Room" button TBD | CF-s22f — photo upload + AI composite |
| Live Showroom Camera | 🔲 Backend merged (commit f72ddb7e) — PDP "See It Live" toggle TBD | CF-gt99 — webcam feed + reserve button |
| App Download Banner | 🔲 Backend merged (PR #884) — Android elements need editor wiring | CF-e2ib — iOS auto via meta tag; Android needs #appDownloadBanner |
| Warranty Registration | ✅ Frontend + backend complete (PR #923, cf-46ct) | /warranty-registration — 11 elements |
| NPS/CSAT Survey | ✅ Frontend + backend complete (PR #924, cf-1mlj) | /survey — 4 elements |
| Video Review Grid | ✅ Frontend complete (PR #941, CF-ou66.3) | Product Page — 9 elements |
| Video Review Badge | ✅ Backend gamification (PR #940, CF-ou66.2) | 500pts + badge — no editor elements |
| Trail Perk Unlock | ✅ Backend service (PR #942, CF-mcyh.2) | Free delivery/styling call perks — no editor elements |
| Delivery SMS Notifications | ✅ Backend complete (PR #916, CF-rjxq) | White-glove SMS — no editor elements |
| Content Calendar + Buying Guides | ✅ Backend + CMS (PR #921, cf-6ika) | 12-week calendar + 8 guides — CMS-driven |
| Room Planner Canvas | ✅ HtmlComponent (PR #949, CF-eqc5.3) | Self-contained HTML — drag-and-drop layout |
| BundleBuilder PDP Module | ✅ Frontend complete (PR #955, CF-eqc5.2) | Product Page — 14 elements (11 page + 3 repeater children) |
| Loyalty Perks Widget | ✅ Frontend complete (CF-c6el.3) | Loyalty Page — 7 elements |
| Weekly Analytics Digest | ✅ Backend complete (PR #956, CF-u30i) | Email-only — no editor elements |
| Virtual Consultation | ✅ Frontend + backend complete (PR #917, CF-ym1x) | /virtual-consultation — 19 elements |
| Swatch Kit | ✅ Frontend + backend complete (PR #927, cf-hcp4) | $5 refundable micro-product |
| OG Images | ✅ Complete (PR #928, cf-jdgq) | OG images for 8 buying guides |
| BadgeDisplayWidget SVG | ✅ Fix merged (PR #943, CF-jnk3) | Inline SVG badges, no PNG 404s |

---

## Warranty Registration Page (NEW — cf-46ct, PR #923)

**Route**: `/warranty-registration` | **Source**: `src/pages/Warranty Registration.js` + `src/public/WarrantyWidget.js` | **Backend**: `warrantyService.web.js`

Deep-linked from order confirmation emails: `?product=NAME&productId=ID&orderId=ORDER`

### Page Elements

| Element ID | Type | Purpose |
|---|---|---|
| `#warrantyProductName` | TextInput | Pre-filled product name from URL |
| `#warrantyProductId` | TextInput | Hidden — product ID from URL |
| `#warrantyOrderId` | TextInput | Hidden — order ID from URL |
| `#warrantyPurchaseDate` | DatePicker | Customer selects purchase date (must be within last year) |
| `#warrantySubmitBtn` | Button | "Register Warranty" — disabled during submit |
| `#warrantyLoadingIndicator` | Box | Loading spinner — hidden by default |

### WarrantyWidget Elements (Member Page sidebar)

| Element ID | Type | Purpose |
|---|---|---|
| `#warrantyCtaBtn` | Button | Navigates to /warranty-registration |
| `#warrantyListLoading` | Box | Spinner while fetching warranties |
| `#warrantyRepeater` | Repeater | List of warranty registrations |
| `#warrantyItemPlan` | Text | Repeater child — plan name |
| `#warrantyItemProduct` | Text | Repeater child — product name |
| `#warrantyItemStatus` | Text | Repeater child — Active/Expired/Pending |
| `#warrantyItemExpires` | Text | Repeater child — expiration date |
| `#warrantyItemRegistered` | Text | Repeater child — registration date |

---

## Survey / NPS Page (NEW — cf-1mlj, PR #924)

**Route**: `/survey?orderId=ORDER_ID` | **Source**: `src/pages/Survey.js` | **Backend**: `surveyService.web.js`

Post-purchase email links here. Checks if already surveyed. NPS 0–6 = Detractor, 7–8 = Passive, 9–10 = Promoter.

| Element ID | Type | Purpose |
|---|---|---|
| `#surveyNpsSlider` | Slider | NPS score 0–10, step 1 |
| `#surveyComment` | TextArea | Optional free-text feedback |
| `#surveySubmitBtn` | Button | "Submit Feedback" — hidden after success |
| `#surveyLoadingIndicator` | Box | Loading spinner — hidden by default |

---

## Video Review Grid — Product Page (NEW — CF-ou66.3, PR #941)

**Source**: `src/public/VideoReviewGrid.js` | **Backend**: `videoReviewService.web.js`

TikTok-style horizontal thumbnail row of approved customer video reviews. Clicking opens full-screen HTML5 video player overlay. Section stays collapsed if no videos exist.

| Element ID | Type | Purpose |
|---|---|---|
| `#videoReviewSection` | Box | Container — collapsed unless approved videos exist |
| `#videoReviewTitle` | Text | "Customer Videos" heading |
| `#videoReviewRepeater` | Repeater | Horizontal thumbnail row |
| `#vrThumbnail` | Image | Repeater child — video thumbnail, clickable |
| `#vrPlayIcon` | Image | Repeater child — play button overlay |
| `#vrReviewerName` | Text | Repeater child — reviewer name (truncated 30 chars) |
| `#videoPlayerOverlay` | Box | Page-level dimmed overlay — NOT inside repeater |
| `#videoPlayerEmbed` | HtmlComponent | HTML5 video player — **NOT Wix Video** (wix: URIs need HTML embed) |
| `#closeVideoOverlay` | Button | Close overlay — resets player to about:blank |

---

## Virtual Consultation Page (NEW — CF-ym1x, PR #917)

**Route**: `/virtual-consultation` | **Source**: `src/pages/Virtual Consultation.js` | **Backend**: `virtualConsultation.web.js`

4-step booking flow: designer selection → date/time/type → notes + confirm → confirmation with video link.

### Step 1 — Designer Selection

| Element ID | Type | Purpose |
|---|---|---|
| `#designerRepeater` | Repeater | Designer cards |
| `#designerAvatar` | Image | Repeater child — designer headshot |
| `#designerNameText` | Text | Repeater child — designer name |
| `#designerSpecialtyText` | Text | Repeater child — specialty label |
| `#designerBioText` | Text | Repeater child — short bio |
| `#selectDesignerBtn` | Button | Repeater child — "Book with [Name]" |

### Step 2+3 — Booking Form

| Element ID | Type | Purpose |
|---|---|---|
| `#bookingFormSection` | Box | Hidden until designer chosen |
| `#selectedDesignerName` | Text | "Booking with [name]" |
| `#slotDateDropdown` | Dropdown | Available dates from getAvailableSlots() |
| `#timeSlotDropdown` | Dropdown | Time slots for selected date |
| `#consultationTypeDropdown` | Dropdown | Video Call / Phone Call |
| `#notesInput` | TextInput | Optional customer notes |
| `#bookBtn` | Button | Confirm Booking — disabled during submit |
| `#bookingError` | Text | Inline error — hidden by default |
| `#loadingSpinner` | Image | Loading indicator |

### Step 4 — Confirmation

| Element ID | Type | Purpose |
|---|---|---|
| `#confirmationSection` | Box | Shown after successful booking |
| `#confirmationSummary` | Text | "Confirmed: date at time — type" |
| `#videoCallSection` | Box | Video-only — contains meeting link |
| `#videoCallLinkText` | Text | Video call URL |

---

## BundleBuilder PDP Module (NEW — CF-eqc5.2, PR #955)

**Source**: `src/public/BundleBuilder.js` | **Backend**: `bundleBuilder.web.js`

PDP step picker: loads Frame+Mattress+Cover bundles for the current product, renders options in a repeater, shows live price/savings on selection, and adds chosen bundle to cart. All `$w` access guarded via `safeGet`.

### Page Elements (Product Page)

| Element ID | Type | Purpose |
|---|---|---|
| `#bundleBuilderSection` | Box | Outer container — hidden until bundles load |
| `#bundleOptionRepeater` | Repeater | One card per available bundle — `onItemReady` BEFORE `.data` |
| `#bundleSelectedSummary` | Box | Live-update area — shown after selection |
| `#bundleSelectedName` | Text | Selected bundle display name |
| `#bundleSelectedPrice` | Text | Live bundle price |
| `#bundleSelectedSavings` | Text | Live savings display |
| `#addBundleBtn` | Button | "Add Bundle to Cart" |
| `#bundleBuilderLoading` | Box | Loading indicator — hidden by default |
| `#bundleBuilderError` | Text | Error message display |
| `#bundleAddedConfirmation` | Box | Success message — shown after add to cart |
| `#noBundlesMessage` | Box | Shown when no bundles available for this frame |

**↳ Inside `bundleOptionRepeater`:**

| Child ID | Type | Purpose |
|---|---|---|
| `#bundleOptionName` | Text | Bundle display name |
| `#bundleOptionPrice` | Text | Formatted bundle price |
| `#bundleOptionSavings` | Text | Savings badge ("Save $N") |
| `#selectBundleBtn` | Button | "Select" — triggers bundle selection |

---

## Loyalty Perks Widget (NEW — CF-c6el.3)

**Source**: `src/public/LoyaltyPerksWidget.js` | **Backend**: `rewardEngine.web.js`

Displays tier perks on the Loyalty page with a repeater of current perks and a next-tier teaser showing what they'll unlock at the next level.

### Page Elements (Loyalty Page)

| Element ID | Type | Purpose |
|---|---|---|
| `#perksSection` | Box | Container for the perks display — hidden on error |
| `#perksError` | Text | Error message — hidden by default |
| `#perksRepeater` | Repeater | One item per unlocked perk |
| `#perkNextTierTeaser` | Box | Next-tier teaser section — hidden if already max tier |
| `#perkNextTierName` | Text | Name of the next tier |
| `#perkNextTierPoints` | Text | Points needed to reach next tier |
| `#perkNextTierList` | Text | Comma-separated names of perks unlocked at next tier |
| `#bookAnotherBtn` | Button | Reset form to step 1 |
