# Carolina Futons -- Cross-Platform Design Homogenization Analysis

**Date:** 2026-03-01
**Author:** Melania (Production Manager)
**Scope:** Wix Studio Web + React Native/Expo Mobile App
**Status:** Design Audit -- Pre-Implementation

---

## 1. Executive Summary

- **CTA button color divergence is the most visible brand inconsistency.** The live website uses `#3ECF8E` (green) for primary CTAs despite the spec defining `#4A7D94` (Sunset Coral). The mobile app correctly uses coral. This must be unified to coral across both platforms immediately -- green has no place in the Blue Ridge brand palette.

- **Background treatments are fundamentally misaligned.** The web uses pink/lavender gradients on product pages while the mobile app uses the spec-correct blue/white (`#F0F4F8` / `#FFFFFF`). The lavender tones undermine the Blue Ridge Mountain aesthetic and must be replaced with blue/white colors.

- **Product card architecture is absent on web.** The mobile app has a fully realized `ProductCard` component with badge system, wishlist hearts, star ratings, and structured info layout. The web uses bare image+text repeater items with no card container, no badges, no ratings, and no wishlist indicators. This is the largest feature-parity gap.

- **Mobile navigation is production-ready; web mobile navigation is broken.** The web's horizontal text nav does not collapse to a hamburger menu on mobile viewports, causing logo clipping and nav overflow. The mobile app's bottom tab navigator with cart badge is well-implemented. The web needs a complete mobile nav rewrite.

- **A shared token layer already exists (`sharedTokens.js`) but is underutilized.** The `src/public/sharedTokens.js` file is the cross-platform single source of truth for colors, spacing, border radius, and shadows. The web's `designTokens.js` imports from it correctly. The mobile's `tokens.ts` duplicates the same values but does not import from the shared file (due to the JS/TS boundary). Both platforms are *numerically aligned* on tokens but *visually divergent* in how they apply them.

---

## 2. Design Token Alignment Matrix

### 2.1 Colors

| Token | Web Spec (sharedTokens.js) | Web Live | Mobile (tokens.ts) | Target | Status |
|-------|---------------------------|----------|-----------------------|--------|--------|
| sandBase | `#F0F4F8` | Pink/lavender on product pages | `#F0F4F8` | `#F0F4F8` | WEB DIVERGENT |
| sandLight | `#F8FAFC` | Unknown | `#F8FAFC` | `#F8FAFC` | Aligned |
| sandDark | `#E2E8F0` | Unknown | `#E2E8F0` | `#E2E8F0` | Aligned |
| espresso | `#1E3A5F` | `#1E3A5F` | `#1E3A5F` | `#1E3A5F` | Aligned |
| espressoLight | `#3D5A80` | `#3D5A80` | `#3D5A80` | `#3D5A80` | Aligned |
| mountainBlue | `#5B8FA8` | `#5B8FA8` | `#5B8FA8` | `#5B8FA8` | Aligned |
| sunsetCoral | `#4A7D94` | `#3ECF8E` (GREEN on CTAs) | `#4A7D94` | `#4A7D94` | **WEB CRITICAL** |
| offWhite | `#FFFFFF` | Not used | `#FFFFFF` | `#FFFFFF` | Web missing |
| mauve | `#C9A0A0` | `#C9A0A0` | `#C9A0A0` | `#C9A0A0` | Aligned |
| success | `#4A7C59` | N/A | `#4A7C59` | `#4A7C59` | Aligned |
| error | `#DC2626` | N/A | `#DC2626` | `#DC2626` | Aligned |
| overlay | `rgba(30,58,95,0.6)` | `rgba(30,58,95,0.6)` | `rgba(30,58,95,0.6)` | Same | Aligned |

### 2.2 Typography

| Token | Web (designTokens.js) | Mobile (tokens.ts) | Target | Status |
|-------|----------------------|---------------------|--------|--------|
| Heading Family | Playfair Display (700) | PlayfairDisplay_700Bold | Same font, platform-specific format | Aligned |
| Body Family | Source Sans 3 (400, 600) | SourceSans3_400Regular | Same font | Aligned |
| Hero Title | 56px / 1.1 | 42px / 46lh | Mobile proportionally scaled (~75%) | Aligned |
| H1 | 42px / 1.15 | 34px / 39lh | Mobile ~81% of web | Aligned |
| H2 | 32px / 1.2 | 26px / 31lh | Mobile ~81% of web | Aligned |
| H3 | 24px / 1.3 | 21px / 27lh | Mobile ~88% of web | Aligned |
| H4 | 20px / 1.35 | 18px / 24lh | Mobile 90% of web | Aligned |
| Body | 16px / 1.6 | 15px / 24lh | Mobile ~94% of web | Aligned |
| Caption | 12px / 1.4 | 12px / 17lh | Same base size | Aligned |
| Nav Link | 14px / 1, 600, 0.04em | 13px / 13lh, 600, 0.52ls | Close match | Aligned |
| Button | 15px / 1, 600, 0.04em | 15px / 15lh, 600, 0.6ls | Near-identical | Aligned |

### 2.3 Spacing

| Token | Web (spacing) | Mobile (spacing) | Status |
|-------|--------------|-------------------|--------|
| xs | 4px | 4 | Aligned |
| sm | 8px | 8 | Aligned |
| md | 16px | 16 | Aligned |
| lg | 24px | 24 | Aligned |
| xl | 32px | 32 | Aligned |
| xxl | 48px | 48 | Aligned |
| xxxl | 64px | 64 | Aligned |
| section | 80px | 80 | Aligned |
| pagePadding | 24px | 24 | Aligned |
| pagePaddingDesktop | 80px | N/A (mobile-only) | N/A |
| maxWidth | 1280px | N/A (fluid) | N/A |

### 2.4 Shadows

| Token | Web (CSS string) | Mobile (RN style) | Status |
|-------|-----------------|---------------------|--------|
| card | 0 2px 12px rgba(30,58,95,0.08) | color:#1E3A5F, y:2, radius:12, opacity:0.08 | Aligned (same values, different format) |
| cardHover | 0 8px 24px rgba(30,58,95,0.12) | color:#1E3A5F, y:8, radius:24, opacity:0.12 | Aligned |
| nav | 0 2px 8px rgba(30,58,95,0.06) | color:#1E3A5F, y:2, radius:8, opacity:0.06 | Aligned |
| modal | 0 16px 48px rgba(30,58,95,0.2) | color:#1E3A5F, y:16, radius:48, opacity:0.2 | Aligned |
| button | 0 2px 8px rgba(91,143,168,0.3) | color:#4A7D94, y:2, radius:8, opacity:0.3 | Aligned |

### 2.5 Border Radius

| Token | Web | Mobile | Status |
|-------|-----|--------|--------|
| sm | 4px | 4 | Aligned |
| md | 8px | 8 | Aligned |
| lg | 12px | 12 | Aligned |
| xl | 16px | 16 | Aligned |
| pill | 9999px | 9999 | Aligned |
| card | 12px | 12 | Aligned |
| button | 8px | 8 | Aligned |
| image | 8px | 8 | Aligned |

### 2.6 Transitions / Animations

| Token | Web | Mobile | Status |
|-------|-----|--------|--------|
| fast | 150ms ease | 150ms | Aligned |
| medium | 250ms ease | 250ms | Aligned |
| slow | 400ms ease | 400ms | Aligned |
| cardHover | 300ms cubic-bezier(0.4,0,0.2,1) | 300ms | Web has custom easing; mobile uses default |

---

## 3. Component Parity Checklist

### 3.1 Components on Mobile but NOT on Web

| Component | Mobile File | Functionality | Web Priority |
|-----------|------------|---------------|--------------|
| ProductCard | `src/components/ProductCard.tsx` | Structured card with badge, wishlist, rating, price | **P0 -- Critical** |
| WishlistButton | `src/components/WishlistButton.tsx` | Heart toggle on product cards/detail | **P0 -- Critical** |
| StarRating | `src/components/StarRating.tsx` | 5-star display with review count | **P0 -- Critical** |
| ViewInRoomButton | `src/components/ViewInRoomButton.tsx` | AR "View in Your Room" CTA | P1 -- High |
| ARScreen / ARWebScreen | `src/screens/ARScreen.tsx`, `ARWebScreen.tsx` | Full AR viewer for products | P1 -- High (web has model-viewer) |
| ARFutonOverlay | `src/components/ARFutonOverlay.tsx` | 3D futon overlay on camera feed | P2 -- Medium |
| ARControls | `src/components/ARControls.tsx` | AR interaction controls (rotate, scale) | P2 -- Medium |
| ARProductPicker | `src/components/ARProductPicker.tsx` | Pick product to view in AR | P2 -- Medium |
| SearchBar (with autocomplete) | `src/components/SearchBar.tsx` | Search with suggestions + recent | **P0 -- Critical** |
| CategoryCard | `src/components/CategoryCard.tsx` | Image overlay category cards | P1 -- Web has repeater but no overlay style |
| CategoryFilter | `src/components/CategoryFilter.tsx` | Horizontal filter pills | P1 -- High |
| SortPicker | `src/components/SortPicker.tsx` | Sort dropdown for product lists | P1 -- High |
| ReviewCard | `src/components/ReviewCard.tsx` | Individual review display | Exists on web (spec), but not as component |
| ReviewForm | `src/components/ReviewForm.tsx` | Review submission form | Exists on web (spec) |
| ReviewSummary | `src/components/ReviewSummary.tsx` | Rating distribution summary | Exists on web (spec) |
| RecommendationCarousel | `src/components/RecommendationCarousel.tsx` | Product recommendation slider | P1 -- Web has cross-sell repeater |
| OnboardingScreen | `src/screens/OnboardingScreen.tsx` | First-run onboarding flow | N/A (mobile-only) |
| StoreLocatorScreen | `src/screens/StoreLocatorScreen.tsx` | Map-based store finder | P2 -- Web has contact page |
| StoreDetailScreen | `src/screens/StoreDetailScreen.tsx` | Individual store info | P2 -- Web has contact page |
| StoreCard | `src/components/StoreCard.tsx` | Store listing card | P2 |
| OfflineBanner | `src/components/OfflineBanner.tsx` | Offline state indicator | N/A (mobile-only) |
| PlaneIndicator | `src/components/PlaneIndicator.tsx` | AR plane detection feedback | N/A (mobile-only) |
| SurfaceIndicator | `src/components/SurfaceIndicator.tsx` | AR surface detection feedback | N/A (mobile-only) |
| NotificationPreferencesScreen | `src/screens/NotificationPreferencesScreen.tsx` | Push notification settings | N/A (mobile-only) |

### 3.2 Components on Web but NOT on Mobile

| Component / Feature | Web File | Functionality | Mobile Priority |
|--------------------|----------|---------------|-----------------|
| Announcement Bar | `masterPage.js` (#announcementBar) | Rotating promo messages | P1 -- Could be top banner |
| Exit-Intent Popup | `masterPage.js` (#exitIntentPopup) | Email capture on exit | N/A (mobile-only UX) |
| PWA Install Banner | `masterPage.js` (#installBanner) | Add to home screen prompt | N/A (already native) |
| Promotional Lightbox | `masterPage.js` (#promoOverlay) | Holiday/seasonal promo modal | P2 -- Push notification instead |
| Trust Bar | `Home.js` (#trustBar) | 5 trust signals with icons | **P0 -- Should be on mobile home** |
| Video Showcase | `Home.js` (#videoShowcaseSection) | Product demo video thumbnails | P1 -- Add to product detail |
| Style Quiz CTA | `Home.js` (#quizCTASection) | Quiz recommendation flow | P1 -- Good mobile engagement |
| Swatch Promo Section | `Home.js` (#swatchPromoSection) | Free swatch request CTA | P1 |
| Fabric Swatch Selector | `Product Page.js` (#swatchSection) | 700+ fabric swatch picker | **P0 -- Critical for product page** |
| Financing Calculator | `Product Page.js` (#financingSection) | Payment plan display | P1 -- High for conversion |
| Product Info Accordion | `Product Page.js` | Collapsible specs/care/shipping | P1 -- Mobile detail needs this |
| Breadcrumbs | `Product Page.js` (#breadcrumb1-3) | Navigation hierarchy | P2 -- Mobile uses back button |
| Compare Page | `Compare Page.js` | Side-by-side product comparison | P2 |
| Newsletter Signup | `Home.js` + `Newsletter.js` | Email signup with discount code | P1 |
| Blog / Blog Post | `Blog.js` + `Blog Post.js` | Content marketing | P2 |
| Side Cart | `Side Cart.js` | Slide-out cart panel | N/A -- Mobile has full cart screen |
| Mountain Ridgeline Header | `masterPage.js` | Decorative SVG header element | P2 -- Nice-to-have for brand |
| Quick View Modal | `Home.js` (#featuredQuickViewModal) | In-grid product preview | P1 -- Long-press quick view |

### 3.3 Feature Parity Summary

| Category | Web | Mobile | Gap |
|----------|-----|--------|-----|
| Product Cards | Bare image + text | Full card with badge/wishlist/rating | **Major** |
| Search | Header input only | Autocomplete + recent + suggestions | **Major** |
| AR Visualization | model-viewer (recently added) | Native ARKit/ARCore + WebGL fallback | Web catching up |
| Reviews | Spec exists, needs hookup | Fully built with form + sort + summary | Web behind |
| Navigation (mobile viewport) | Broken | Bottom tabs with cart badge | **Critical** |
| Dark Mode | Not supported | Full dark mode with token inversion | Mobile ahead |
| Wishlist | Backend ready, no UI | Full UI with heart buttons + screen | **Major** |
| Cart UX | Side cart slide-out | Full cart screen | Different but both functional |
| Accessibility | ARIA labels throughout | accessibilityLabel/Role throughout | Both strong |

---

## 4. Critical Divergences (Ranked by Impact)

### RANK 1: CTA Button Color -- Green vs. Coral
**Impact:** Brand identity fragmentation. Users see a different brand on web vs. mobile.
**Web current:** `#3ECF8E` (green) on live site CTAs
**Mobile current:** `#4A7D94` (Sunset Coral) -- correct per brand spec
**Target:** `#4A7D94` everywhere
**Fix:** This is a Wix Studio editor-level fix. Every button element that uses green must be changed to Color 4 (Sunset Coral) in the Wix Studio theme settings. The Velo code in `designTokens.js` already specifies coral correctly -- the editor is overriding it.
**Effort:** Low (editor theme change), zero code changes needed
**Files affected:** Wix Studio theme editor (no file changes)

### RANK 2: Web Mobile Navigation -- Completely Broken
**Impact:** 60%+ of traffic on furniture sites is mobile. Broken nav = lost sales.
**Web current:** Horizontal text nav that overflows on mobile, no hamburger, logo clips
**Mobile current:** Bottom tab bar with 4 tabs (Home, Shop, Cart, Account) + cart badge -- works perfectly
**Target:** Web mobile must implement hamburger menu with slide-out drawer matching the brand aesthetic
**Fix:** In `masterPage.js`, the `#mobileMenuButton` and `#mobileMenuOverlay` elements exist in the spec but are not wired up. Need Wix Studio editor layout for the hamburger icon visibility at mobile breakpoint, plus Velo code to toggle the overlay.
**Effort:** Medium (Wix editor + Velo code)
**Files affected:** `/Users/hal/gt/cfutons/refinery/rig/src/pages/masterPage.js`, Wix Studio editor

### RANK 3: Background Color Treatment
**Impact:** Brand cohesion. Pink/lavender backgrounds feel unrelated to Blue Ridge aesthetic.
**Web current:** Pink/lavender gradients on product pages
**Mobile current:** `sandBase` (#F0F4F8) backgrounds throughout
**Target:** All page backgrounds use `sandBase` (#F0F4F8) or `offWhite` (#FFFFFF). No pink/lavender.
**Fix:** Wix Studio editor: change page background colors to Color 1 (Sand). Consider `offWhite` for content areas that need separation from the sand base.
**Effort:** Low (editor-only)
**Files affected:** Wix Studio page settings

### RANK 4: Product Card Parity
**Impact:** Web product listings look amateur vs. mobile's polished cards. Conversion impact is significant.
**Web current:** Repeater with bare `#featuredImage`, `#featuredName`, `#featuredPrice` -- no card container, no shadow, no badge system, no wishlist, no rating
**Mobile current:** Full `ProductCard` with:
  - White card background with 12px border radius
  - Espresso-tinted card shadow
  - Badge system (Sale=coral, New=mountainBlue, Bestseller=mountainBlue)
  - Wishlist heart button (overlay, top-right)
  - Star rating row (coral stars)
  - Price with strikethrough original
  - Image with 4:3 aspect ratio
**Target:** Web product cards must match mobile's structure
**Fix:** In Wix Studio editor, create card container elements inside the repeater. Add badge, wishlist icon, and rating star elements. Wire via Velo code.
**Effort:** High (new Wix editor elements + Velo code + backend hookup for ratings/wishlist)
**Files affected:** `/Users/hal/gt/cfutons/refinery/rig/src/pages/Home.js`, `/Users/hal/gt/cfutons/refinery/rig/src/pages/Category Page.js`, Wix Studio editor

### RANK 5: Product Photography -- Studio Shots vs. Lifestyle
**Impact:** Every premium competitor (Article, Burrow, Castlery) leads with lifestyle photography. White-background-only product images look discount-brand.
**Web current:** White-background studio shots only
**Mobile current:** Same product images (sourced from same catalog)
**Target:** Add lifestyle hero images for top products. Keep white-background as gallery thumbnails. Lead with lifestyle in hero/gallery first slide.
**Fix:** Photography investment needed (or high-quality renders). Not a code change -- asset change.
**Effort:** High (requires new photography/renders)
**Files affected:** Wix Media Manager, product catalog

### RANK 6: Search Experience Parity
**Impact:** Web has a basic `#headerSearchInput` field. Mobile has full autocomplete with recent searches, suggestions, and fuzzy matching.
**Web current:** Simple search input in header (navigates to Search Results page)
**Mobile current:** `SearchBar` component with: autocomplete dropdown, recent searches with remove/clear, submit handling, visual feedback
**Target:** Web search should have autocomplete suggestions as user types
**Fix:** Enhance `Search Suggestions Box.js` page and wire live search suggestions into the header input via Wix Velo.
**Effort:** Medium
**Files affected:** `/Users/hal/gt/cfutons/refinery/rig/src/pages/Search Suggestions Box.js`, `/Users/hal/gt/cfutons/refinery/rig/src/pages/masterPage.js`

### RANK 7: Trust Bar Missing on Mobile
**Impact:** Trust signals ("Family Owned Since 1991", "700+ Fabric Swatches", "Free Shipping $999+") are powerful conversion drivers. Completely absent on mobile.
**Web current:** 5-item trust bar on homepage with icons
**Mobile current:** No trust signals anywhere
**Target:** Add horizontal scrolling trust bar to mobile HomeScreen, below hero/subtitle
**Fix:** Create `TrustBar` component for mobile, add to `HomeScreen.tsx`
**Effort:** Low
**Files affected:** `/Users/hal/gt/cfutons_mobile/refinery/rig/src/screens/HomeScreen.tsx` (new component needed)

### RANK 8: Dark Mode -- Mobile-Only
**Impact:** Modern user expectation. Mobile has full dark mode via `ThemeProvider.tsx` with inverted color tokens. Web has no dark mode concept.
**Web current:** No dark mode support
**Mobile current:** Full dark mode with inverted sand/espresso palette:
  - `sandBase`: `#1A1410`
  - `espresso`: `#F8FAFC`
  - `white`: `#1A1410`
**Target:** Consider dark mode for web as a future enhancement. Not a launch blocker.
**Effort:** High for web (Wix Studio limitations)
**Files affected:** N/A for now

---

## 5. Unified Design Language Proposal

### 5.1 The "One Brand" Standard

**Brand Identity:** Carolina Futons -- Blue Ridge Mountain Aesthetic
**Tagline:** "Handcrafted Comfort, Mountain Inspired."

#### Color System (Canonical)

| Role | Token | Value | Usage |
|------|-------|-------|-------|
| **Primary Background** | sandBase | `#F0F4F8` | All page backgrounds |
| **Card/Section Background** | sandLight | `#F8FAFC` | Cards, header, tab bar |
| **Content Background** | offWhite | `#FFFFFF` | Product card interiors, modals |
| **Primary Text** | espresso | `#1E3A5F` | Headlines, body text, prices |
| **Secondary Text** | espressoLight | `#3D5A80` | Descriptions, metadata |
| **Primary CTA** | sunsetCoral | `#4A7D94` | All primary buttons, sale badges, active states |
| **Secondary CTA** | mountainBlue | `#5B8FA8` | Links, secondary buttons, "New" badges |
| **Borders** | sandDark | `#E2E8F0` | Dividers, input borders |
| **Muted** | muted | `#646C79` | Placeholder text, disabled states |
| **Accent** | mauve | `#C9A0A0` | Tertiary decorative elements only |
| **BANNED** | green (#3ECF8E) | -- | Remove from all platforms. Not a brand color. |
| **BANNED** | pink/lavender | -- | Remove from all page backgrounds. |

#### Typography System

| Element | Font | Weight | Desktop | Mobile (Native) | Mobile (Web Responsive) |
|---------|------|--------|---------|-----------------|------------------------|
| Hero Title | Playfair Display | 700 | 56px | 42px | 36px |
| H1 | Playfair Display | 700 | 42px | 34px | 28px |
| H2 | Playfair Display | 700 | 32px | 26px | 24px |
| H3 | Source Sans 3 | 600 | 24px | 21px | 20px |
| H4 | Source Sans 3 | 600 | 20px | 18px | 18px |
| Body | Source Sans 3 | 400 | 16px | 15px | 16px |
| Caption | Source Sans 3 | 500 | 12px | 12px | 12px |
| Button | Source Sans 3 | 600 | 15px, 0.04em | 15px, 0.6ls | 14px |

#### Component Standards

**Product Card (Universal)**
- White (`#FFFFFF`) background (or `offWhite` for cards on white sections)
- 12px border radius
- Espresso-tinted shadow: `0 2px 12px rgba(30,58,95,0.08)`
- Hover shadow (web): `0 8px 24px rgba(30,58,95,0.12)`
- Image: 4:3 aspect ratio, `sandLight` placeholder background
- Badge: top-left, 4px radius, white text, color by type (Sale=coral, New=blue, Bestseller=blue)
- Wishlist heart: top-right overlay, coral when active
- Star rating: coral-colored stars, review count in muted text
- Price: espresso, bold. Original price: muted, strikethrough.

**Primary Button**
- Background: `#4A7D94` (Sunset Coral)
- Text: `#FFFFFF`, Source Sans 3 600, 15px
- Border radius: 8px
- Shadow: `0 2px 8px rgba(91,143,168,0.3)`
- Hover (web): darken to `#3D6B80`
- Disabled: 50% opacity

**Secondary Button**
- Background: `#5B8FA8` (Mountain Blue)
- Text: `#FFFFFF`
- Same border radius and shadow pattern

**Ghost Button**
- Background: transparent
- Border: 1px `#3D5A80`
- Text: `#1E3A5F`

**Navigation (Mobile Viewport)**
- Bottom tab bar: `sandLight` background, coral active tint, espressoLight inactive
- Cart badge: coral background, white text
- Web mobile: hamburger menu triggering slide-out nav drawer

**Search**
- Input: `sandLight` background, 12px border radius
- Placeholder: muted text color
- Autocomplete dropdown: `sandLight`, hairline top border
- Recent searches: clock icon + query + remove button

### 5.2 Cross-Platform Token Architecture

```
sharedTokens.js (SOURCE OF TRUTH)
    |
    +-- designTokens.js (web -- adds CSS formatting, grid, SEO, categories)
    |       |
    |       +-- All Wix Velo pages import from here
    |
    +-- tokens.ts (mobile -- adds RN-specific formatting, mobile typography scale)
            |
            +-- ThemeProvider.tsx (adds dark mode inversion)
            +-- All RN components consume via useTheme()
```

The architecture is correct. The gap is in **application**, not **definition**. The tokens are aligned; the Wix Studio editor is overriding them.

---

## 6. Implementation Priority

Ordered by impact-to-effort ratio:

| # | Change | Platform | Effort | Impact | Sprint |
|---|--------|----------|--------|--------|--------|
| 1 | Fix CTA button color: green -> coral | Web (editor) | XS | Critical | Immediate |
| 2 | Fix page backgrounds: lavender -> sand | Web (editor) | XS | Critical | Immediate |
| 3 | Wire mobile hamburger menu | Web (editor + Velo) | M | Critical | Sprint 3 |
| 4 | Add Trust Bar to mobile HomeScreen | Mobile | S | High | Sprint 3 |
| 5 | Build web product card structure (badge + shadow + radius) | Web (editor + Velo) | L | High | Sprint 3 |
| 6 | Add wishlist UI to web product cards | Web (editor + Velo + backend hookup) | L | High | Sprint 3 |
| 7 | Add star ratings to web product cards | Web (editor + Velo + backend hookup) | M | High | Sprint 3 |
| 8 | Enhance web search with autocomplete | Web (Velo) | M | High | Sprint 3 |
| 9 | Add fabric swatch selector to mobile product detail | Mobile | L | High | Sprint 4 |
| 10 | Add financing section to mobile product detail | Mobile | M | Medium | Sprint 4 |
| 11 | Add product info accordion to mobile detail | Mobile | M | Medium | Sprint 4 |
| 12 | Add newsletter signup to mobile | Mobile | S | Medium | Sprint 4 |
| 13 | Add video showcase to mobile product detail | Mobile | M | Medium | Sprint 4 |
| 14 | Invest in lifestyle product photography | Both | XL | High | Ongoing |
| 15 | Replace emoji tab icons with custom SVG icons | Mobile | S | Low | Sprint 4 |
| 16 | Add Style Quiz CTA to mobile HomeScreen | Mobile | S | Medium | Sprint 4 |
| 17 | Add breadcrumb-style navigation to mobile (optional) | Mobile | S | Low | Backlog |
| 18 | Dark mode for web | Web | XL | Low | Backlog |

---

## 7. Recommendations for Dallas (Mobile)

### Must-Do (Sprint 3)

1. **Add TrustBar component to HomeScreen**
   - File: `/Users/hal/gt/cfutons_mobile/refinery/rig/src/screens/HomeScreen.tsx`
   - Create new: `/Users/hal/gt/cfutons_mobile/refinery/rig/src/components/TrustBar.tsx`
   - Display the 5 trust signals as a horizontal ScrollView between subtitle and CTA buttons
   - Use token colors: icon in sunsetCoral, text in espresso, background in sandLight
   - Trust items: "Family Since 1991", "Largest Selection", "700+ Swatches", "Free Shipping $999+", "White Glove Delivery"

2. **Replace emoji tab icons with proper icon set**
   - File: `/Users/hal/gt/cfutons_mobile/refinery/rig/src/navigation/TabNavigator.tsx`
   - Current: emoji strings ('🏠', '🛋️', '🛒', '👤') -- renders inconsistently cross-platform
   - Target: Use `@expo/vector-icons` (Ionicons or Feather) for consistent rendering
   - Home = `home-outline` / `home`, Shop = `grid-outline` / `grid`, Cart = `cart-outline` / `cart`, Account = `person-outline` / `person`

### Should-Do (Sprint 4)

3. **Add fabric swatch selector to ProductDetailScreen**
   - File: `/Users/hal/gt/cfutons_mobile/refinery/rig/src/screens/ProductDetailScreen.tsx`
   - The current fabric selector only shows color circles from the `model.fabrics` array
   - Should add a "700+ Fabric Swatches" section linking to a swatch gallery modal
   - Align with web's `#swatchSection` functionality

4. **Add newsletter signup section**
   - New screen or modal: `NewsletterModal.tsx`
   - "Join the Carolina Futons Family" with email input and 10% discount code
   - Can trigger from Account tab or HomeScreen footer

5. **Add product info accordion to ProductDetailScreen**
   - Below the existing sections, add collapsible panels for:
     - Description (already shown as tagline, needs full text)
     - Dimensions (already shown, but add care instructions)
     - Shipping info (delivery days, white glove options)
     - Materials & Care

6. **Add financing calculator to ProductDetailScreen**
   - Below price section: "As low as $X/mo" teaser
   - Tap to expand: show payment plan options (Pay in 4, 6/12/24 months)
   - Match web's `#financingSection` spec

### Nice-to-Have

7. **Style Quiz integration**
   - Add "Not Sure Where to Start?" card to HomeScreen
   - Link to a WebView or native quiz flow

8. **Ensure dark mode color contrast meets WCAG AA**
   - File: `/Users/hal/gt/cfutons_mobile/refinery/rig/src/theme/ThemeProvider.tsx`
   - Current dark colors may need contrast ratio validation
   - Test: `#E2E8F0` (espressoLight in dark mode) on `#231C15` (sandLight in dark mode) -- verify 4.5:1 minimum

---

## 8. Recommendations for Web Crew

### Immediate (No Code -- Editor Only)

1. **Fix ALL CTA buttons to Sunset Coral (#4A7D94)**
   - In Wix Studio theme: set Color 4 as the primary button color
   - Every green `#3ECF8E` button must become coral
   - Check: hero CTA, add to cart, newsletter submit, swatch request, quiz CTA

2. **Fix ALL page backgrounds to Sand (#F0F4F8) or Off-White (#FFFFFF)**
   - Remove ALL pink/lavender gradients from product pages
   - Page backgrounds: `sandBase` (#F0F4F8)
   - Card/section backgrounds: `sandLight` (#F8FAFC) or `offWhite` (#FFFFFF)

### Sprint 3 (Code + Editor)

3. **Wire the mobile hamburger menu**
   - File: `/Users/hal/gt/cfutons/refinery/rig/src/pages/masterPage.js`
   - Elements `#mobileMenuButton` and `#mobileMenuOverlay` exist in spec
   - Need: Wix editor to show hamburger at mobile breakpoint, hide horizontal nav
   - Velo: toggle overlay with animation, populate with nav links
   - Style: `sandLight` background, espresso text, coral active link

4. **Build proper product card containers in repeaters**
   - Files: `/Users/hal/gt/cfutons/refinery/rig/src/pages/Home.js`, Category Page
   - Wrap each repeater item in a container box with:
     - Background: `#FFFFFF`
     - Border radius: 12px
     - Shadow: card shadow from designTokens
   - Add badge element inside each card (top-left)
   - Add wishlist heart element (top-right)
   - Add star rating text element

5. **Hook up wishlist UI to backend**
   - Backend wishlist service exists (per memory.md: "Backend ready, needs Wix hookup")
   - Add heart icon to each product card in all repeaters
   - Wire toggle to `wishlistService.web.js`

6. **Hook up star ratings to backend**
   - Backend review service exists (per memory.md: "Backend ready, needs Wix hookup")
   - Add rating display (stars + count) to each product card
   - Pull average ratings from review aggregation

7. **Enhance search with autocomplete**
   - File: `/Users/hal/gt/cfutons/refinery/rig/src/pages/Search Suggestions Box.js`
   - Add live product name matching as user types
   - Show recent searches from session storage
   - Style dropdown: `sandLight` background, matching mobile's SearchBar appearance

### Sprint 4 (Polish)

8. **Add hover states to product cards**
   - On mouse-in: elevate shadow to `cardHover`, scale image slightly
   - On mouse-in: show "Quick View" button overlay
   - Match the category card hover (already uses `colors.sunsetCoral` on hover)

9. **Implement category card style matching mobile**
   - Mobile `CategoryCard` uses: full-bleed image + overlay + white title text
   - Web category repeater should match: image background, `overlay` color overlay, white Playfair title at bottom
   - File: `/Users/hal/gt/cfutons/refinery/rig/src/pages/Home.js` (`initCategoryShowcase`)

10. **Add "View in Your Room" AR button to product pages**
    - Web already has `ProductARViewer` component (PR #99 merged)
    - Add coral-outlined "View in Your Room" button matching mobile's `ViewInRoomButton` style
    - File: `/Users/hal/gt/cfutons/refinery/rig/src/pages/Product Page.js`

---

## Appendix A: Source Files Referenced

### Web (Wix Studio + Wix Velo)
- `/Users/hal/gt/cfutons/refinery/rig/src/public/sharedTokens.js` -- Cross-platform token source of truth
- `/Users/hal/gt/cfutons/refinery/rig/src/public/designTokens.js` -- Web design tokens (imports sharedTokens)
- `/Users/hal/gt/cfutons/refinery/rig/src/pages/Home.js` -- Homepage Velo code
- `/Users/hal/gt/cfutons/refinery/rig/src/pages/masterPage.js` -- Global header/footer/nav
- `/Users/hal/gt/cfutons/refinery/rig/src/pages/Product Page.js` -- Product detail Velo code
- `/Users/hal/gt/cfutons/refinery/rig/src/pages/Category Page.js` -- Category listing
- `/Users/hal/gt/cfutons/refinery/rig/src/pages/Search Results.js` -- Search results
- `/Users/hal/gt/cfutons/refinery/rig/WIX-STUDIO-BUILD-SPEC.md` -- Editor build specification

### Mobile (React Native / Expo)
- `/Users/hal/gt/cfutons_mobile/refinery/rig/src/theme/tokens.ts` -- Mobile design tokens
- `/Users/hal/gt/cfutons_mobile/refinery/rig/src/theme/ThemeProvider.tsx` -- Dark mode + theme context
- `/Users/hal/gt/cfutons_mobile/refinery/rig/src/components/ProductCard.tsx` -- Product card component
- `/Users/hal/gt/cfutons_mobile/refinery/rig/src/components/Button.tsx` -- Button component (coral primary)
- `/Users/hal/gt/cfutons_mobile/refinery/rig/src/components/WishlistButton.tsx` -- Wishlist heart toggle
- `/Users/hal/gt/cfutons_mobile/refinery/rig/src/components/SearchBar.tsx` -- Search with autocomplete
- `/Users/hal/gt/cfutons_mobile/refinery/rig/src/components/CategoryCard.tsx` -- Category card with overlay
- `/Users/hal/gt/cfutons_mobile/refinery/rig/src/components/Header.tsx` -- App header
- `/Users/hal/gt/cfutons_mobile/refinery/rig/src/components/ViewInRoomButton.tsx` -- AR "View in Room" CTA
- `/Users/hal/gt/cfutons_mobile/refinery/rig/src/screens/HomeScreen.tsx` -- Home screen
- `/Users/hal/gt/cfutons_mobile/refinery/rig/src/screens/ProductDetailScreen.tsx` -- Product detail screen
- `/Users/hal/gt/cfutons_mobile/refinery/rig/src/navigation/TabNavigator.tsx` -- Bottom tab navigation

### Shared Assets
- `/Users/hal/gt/cfutons/crew/melania/design-vision/DESIGN-VISION.html` -- 42 competitor screenshots
- `/Users/hal/gt/cfutons/crew/melania/design-vision/screenshots/` -- Competitor and current site captures

---

## Appendix B: Competitor Benchmark Summary

| Competitor | CTA Color | Background | Product Cards | Mobile Nav | Photography |
|-----------|-----------|------------|---------------|------------|-------------|
| Article.com | Warm neutral | Off-white/cream | Structured with rating | Hamburger | Lifestyle-first |
| Burrow.com | Blue/neutral | White/warm gray | Configurator cards | Hamburger | Lifestyle + modular |
| Castlery | Warm neutral | Off-white | Image + swatches + rating | Hamburger | Lifestyle + studio |
| West Elm | Black/neutral | White | Grid cards with swatches | Hamburger | Lifestyle-first |
| CB2 | Black | White/gray | Minimal + swatches | Hamburger | Lifestyle-first |
| **Carolina Futons (Web)** | **GREEN (wrong)** | **Pink/lavender (wrong)** | **No card structure** | **BROKEN** | **Studio-only** |
| **Carolina Futons (Mobile)** | **Coral (correct)** | **Sand (correct)** | **Full cards w/ badges** | **Bottom tabs** | **Studio-only** |

**Key takeaway:** The mobile app is closer to competitor standards than the web site. The web site needs to catch up to the mobile app, not the other way around.

---

*This document should be used as the canonical reference for all design-related beads in Sprint 3 and beyond. Every PR that touches UI should be checked against Section 5 (Unified Design Language Proposal).*
