# Frontend Hookup Guide — Wix Studio Integration

**Last updated**: 2026-03-04
**Purpose**: Everything the human needs to wire frontend code to Wix Studio editor elements.

---

## How This Works

All frontend code is written in Wix Velo (`src/pages/*.js`, `src/public/*.js`, `src/backend/*.web.js`). The code references Wix Studio elements by `$w('#elementId')`. For the code to work, matching elements must exist in the Wix Studio editor with the exact same IDs.

**The master spec**: `WIX-STUDIO-BUILD-SPEC.md` (2,033 lines) defines every element ID, type, and section.

---

## Current State Summary

### Pages with Code Complete + Audit Done

| Page | Code File | IDs in Code | IDs Matched to Spec | Gap | Audit Doc |
|------|-----------|-------------|---------------------|-----|-----------|
| **Home** | `Home.js` | 85+ | 60 | 25 IN CODE ONLY | `hookup-audit-homepage.md` |
| **Product Page** | `Product Page.js` | 142+ | ~100 | 42 IN CODE ONLY | `hookup-audit-product.md` |
| **Category Page** | `Category Page.js` | 68 | 61 | 7 IN CODE ONLY | `hookup-audit-browse-pages.md` |
| **Cart Page** | `Cart Page.js` | 34 | 30 | 4 IN CODE ONLY | `hookup-audit-commerce-pages.md` |
| **Side Cart** | `Side Cart.js` | 31 | 27 | 3 IN CODE ONLY | `hookup-audit-commerce-pages.md` |
| **Checkout** | `Checkout.js` | 60 | 35 | 25 IN CODE ONLY | `hookup-audit-commerce-pages.md` |
| **Member Page** | `Member Page.js` | 48 | 46 | 2 IN CODE ONLY | `hookup-audit-commerce-pages.md` |
| **Thank You** | `Thank You Page.js` | 46 | 34 | 12 IN CODE ONLY | `hookup-audit-commerce-pages.md` |
| **Order Tracking** | `Order Tracking.js` | 44 | 44 | 0 | `hookup-audit-commerce-pages.md` |
| **Blog** | `Blog.js` | 15 | 15 | 0 | `hookup-audit-content-pages.md` |
| **Blog Post** | `Blog Post.js` | 20+ | 20+ | TBD | `hookup-audit-content-pages.md` |
| **Search Results** | `Search Results.js` | 33 | 7 | 26 IN CODE ONLY | `hookup-audit-browse-pages.md` |
| **masterPage** | `masterPage.js` | 35+ | 18+ | TBD | See PR #145 hookup |
| **FAQ** | `FAQ.js` | 8 | 5 | 3 IN CODE ONLY | `hookup-audit-browse-pages.md` |

### Pages Missing from BUILD-SPEC (need spec sections added)

| Page | Code File | IDs in Code | Notes |
|------|-----------|-------------|-------|
| Style Quiz | `Style Quiz.js` | 25 | Entire page missing from spec |
| Compare Page | `Compare.js` | 24 | Entire page missing from spec |
| Returns | `Returns.js` | 51 | Entire page missing from spec |
| Admin Returns | `Admin Returns.js` | 57 | Entire page missing from spec |
| Newsletter | `Newsletter.js` | TBD | Content page |
| About | `About.js` | TBD | Content page |
| Contact | `Contact.js` | TBD | Content page |

---

## Wix Studio Hookup Steps (Per Page)

### Step 1: Open the page in Wix Studio Editor

### Step 2: Reference the audit doc for that page
Each audit doc has a table mapping `$w('#id')` → element type → notes.

### Step 3: For each element ID in the audit:

1. **If element exists in editor** → Verify its ID matches exactly (case-sensitive)
2. **If element is missing** → Add it with the correct type and ID:
   - `Text` → Text element
   - `Image` → Image element
   - `Button` → Button element
   - `Repeater` → Repeater element
   - `Section` → Section (strip) element
   - `Input` → Text Input element
   - `HtmlComponent` → HTML iFrame element (for SVG injection)
   - `Box` → Container box
   - `Dropdown` → Dropdown element
   - `RichText` → Rich Text element

### Step 4: Set element properties
- Initial visibility: Check audit notes for "Hidden default" or "Collapsed default"
- For repeaters: Add child elements with their repeater-child IDs

---

## Illustration Integration

### SVG Illustrations → HtmlComponent Elements

Illustrations are injected via `$w('#containerId').html = svgString`. This requires an **HtmlComponent** element in Wix Studio.

| Module | Init Function | Container ID(s) | Page |
|--------|--------------|------------------|------|
| `MountainSkyline.js` | `initMountainSkylineHeader($w)` | `#mountainSkyline` | masterPage (header) |
| `comfortIllustrations.js` | Via `ComfortStoryCards.js` | `#comfortIllustrationSvg` | Product Page |
| `onboardingIllustrations.js` | Direct assignment | Container varies | Onboarding flow |
| `emptyStateIllustrations.js` | Via page-level init | Container varies | Multiple pages |
| `aboutIllustrations.js` | `initAboutIllustrations($w)` | `#teamPortraitContainer`, `#timelineContainer` | About page |
| `contactIllustrations.js` | `initContactHeroSkyline($w)`, `initContactShowroomScene($w)` | `#contactHeroSkyline`, `#contactShowroomScene` | Contact page |
| `CartIllustrations.js` | `initCartSkyline($w)`, `initEmptyCartIllustration($w)` | `#cartHeroSkyline`, `#emptyCartIllustration` | Cart page |

**For each illustration container:**
1. Add an **HtmlComponent** element in Wix Studio
2. Set its ID to match the container ID above
3. Set width to 100% of parent
4. Set appropriate height (skylines: 200px, scenes: 280px)
5. The code will inject the SVG at runtime via `$w.onReady`

---

## Global Elements (masterPage.js)

These elements appear on EVERY page:

### Header
| ID | Type | Function |
|----|------|----------|
| `#siteTitle` | Text | Logo/site name |
| `#siteLogo` | Image | Logo image |
| `#navRepeater` | Repeater | Navigation links |
| `#mobileDrawer` | Box | Mobile navigation drawer |
| `#mobileDrawerToggle` | Button | Hamburger menu button |
| `#megaMenuContainer` | Box | Desktop mega menu |
| `#mountainSkyline` | HtmlComponent | Mountain skyline header decoration |
| `#cartIcon` | Button | Cart icon in header |
| `#cartBadge` | Text | Cart item count badge |
| `#searchInput` | Input | Search bar |
| `#announcementBar` | Box | Top announcement strip |
| `#announcementText` | Text | Announcement message |

### Footer
| ID | Type | Function |
|----|------|----------|
| `#footerLogo` | Image | Footer logo |
| `#footerPhone` | Text | Phone number |
| `#footerAddress` | Text | Physical address |
| `#footerHours` | Text | Business hours |
| `#socialFacebook` | Button | Facebook link |
| `#socialInstagram` | Button | Instagram link |
| `#socialPinterest` | Button | Pinterest link |
| `#newsletterEmail` | Input | Newsletter signup |
| `#newsletterSubmit` | Button | Newsletter submit |

---

## Design Tokens → Wix Studio Editor

When setting colors in Wix Studio editor:

| Token | Hex | Use For |
|-------|-----|---------|
| Sand (primary bg) | `#E8D5B7` | Page backgrounds, card backgrounds |
| Espresso (text) | `#3A2518` | All body text, headings |
| Mountain Blue | `#5B8FA8` | Links, secondary elements |
| Sunset Coral | `#E8845C` | ALL CTA buttons, sale badges |
| Off White | `#FAF7F2` | Alternate section backgrounds |
| Sand Light | `#F2E8D5` | Hover states, subtle backgrounds |

**CTA buttons are ALWAYS Sunset Coral `#E8845C`** — never green, never blue.

---

## Typography in Wix Studio

| Element | Font | Weight | Size |
|---------|------|--------|------|
| H1 | Playfair Display | Bold | 48px (desktop), 32px (mobile) |
| H2 | Playfair Display | Bold | 36px (desktop), 28px (mobile) |
| H3 | Playfair Display | SemiBold | 28px (desktop), 22px (mobile) |
| Body | Source Sans 3 | Regular | 16px |
| Small | Source Sans 3 | Regular | 14px |
| Button | Source Sans 3 | SemiBold | 16px |

---

## Backend Services (Already Built)

These backend modules are ready — they wire up automatically when the frontend elements exist:

| Service | File | What It Does |
|---------|------|-------------|
| Shipping rates | `shipping-rates-plugin.js` | SPI for checkout shipping calc |
| UPS integration | `ups-shipping.web.js` | Real UPS rate API |
| Fulfillment | `fulfillment.web.js` | Order fulfillment workflow |
| Delivery scheduling | `deliveryScheduling.web.js` | Wed-Sat delivery slots |
| Assembly guides | `assemblyGuides.web.js` | Product assembly PDFs |
| Loyalty service | `loyaltyService.web.js` | Bronze/Silver/Gold tiers |
| Coupons | `couponsService.web.js` | Promo code validation |
| Cart recovery | `cartRecovery.web.js` | Abandoned cart emails |
| Gift cards | `giftCards.web.js` | Gift card purchase/redeem |
| Product recommendations | `productRecommendations.web.js` | Cross-sell/upsell logic |
| Live chat | `liveChatService.web.js` | Customer support chat |
| Analytics | `analyticsHelpers.web.js` | GA4 event tracking |
| SEO | `seoHelpers.web.js` | OG tags, Rich Pins, Twitter Cards |
| Pinterest catalog | `pinterestCatalogSync.web.js` | Pinterest feed validation |
| Photo reviews | `photoReviews.web.js` | Customer photo uploads |
| Sustainability | `sustainability.web.js` | Eco certifications |

---

## Quick Reference: What's Done vs What's Needed

### Done (Code Complete)
- All 28 page modules written and tested (7,500+ tests)
- All backend services implemented
- Design token system (sharedTokens → designTokens)
- Illustration system (6 modules, expanding to 10+)
- Mobile responsive helpers
- Accessibility helpers (ARIA, focus traps, announcements)
- Cart/checkout/payment flow
- Search autocomplete
- Social media feeds (Pinterest, Facebook, Google)
- Analytics (GA4, TikTok Pixel)

### Needed in Wix Studio
- Create all elements with matching IDs per audit docs
- Set initial visibility states per audit notes
- Configure datasets (Stores/Products, etc.)
- Upload hero/product photography
- Configure Wix Apps (Stores, Members, Blog)
- Set responsive breakpoints matching our token system
- Wire up custom fonts (Playfair Display, Source Sans 3)
