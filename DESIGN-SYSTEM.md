# Carolina Futons — Cross-Platform Design System

**Version:** 1.0 | **Date:** 2026-02-28 | **Owner:** melania (PM)
**Applies to:** Web (Wix Studio + Velo), Mobile (React Native), Marketing

---

## Source of Truth

| File | Platform | Purpose |
|------|----------|---------|
| `src/public/sharedTokens.js` | **Both** | Colors, spacing, radii, shadows, transitions, breakpoints, business info |
| `src/public/designTokens.js` | Web only | Typography scale, grid, SEO, categories (imports from sharedTokens) |
| Mobile: `design-tokens.json` | Mobile only | Generated from sharedTokens.js for React Native consumption |

**Rule:** Brand tokens (colors, spacing, radii, shadows) ALWAYS come from `sharedTokens.js`. Platform-specific additions live in the platform file. Never hardcode brand values — import them.

---

## Color Palette

### Primary Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `sandBase` | `#E8D5B7` | Page backgrounds, section fills, warm foundation |
| `sandLight` | `#F2E8D5` | Card backgrounds, hover fills, secondary backgrounds |
| `sandDark` | `#D4BC96` | Borders, subtle dividers |
| `espresso` | `#3A2518` | Primary text, headings, dark backgrounds (nav, announcement bar) |
| `espressoLight` | `#5C4033` | Secondary text, body copy on dark backgrounds |
| `mountainBlue` | `#5B8FA8` | Secondary CTAs, links, badges, trust indicators |
| `mountainBlueDark` | `#3D6B80` | Hover state for mountain blue elements |
| `mountainBlueLight` | `#A8CCD8` | Light accent, tag backgrounds |
| `sunsetCoral` | `#E8845C` | **Primary CTA**, sale badges, "Get Free Swatches", urgent actions |
| `sunsetCoralDark` | `#C96B44` | Hover state for coral CTAs |
| `sunsetCoralLight` | `#F2A882` | Light accent, coral tints |
| `offWhite` | `#FAF7F2` | Alternate light background, subtle warmth |
| `white` | `#FFFFFF` | Card surfaces, input fields |

### Semantic Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `success` | `#4A7C59` | Success states, **"Add to Cart"** button, positive feedback |
| `error` | `#E8845C` | Error messages (shares coral for brand cohesion) |
| `muted` | `#999999` | Disabled states, placeholder text |
| `mutedBrown` | `#8B7355` | Tertiary text, muted labels |
| `overlay` | `rgba(58, 37, 24, 0.6)` | Modal overlays, hero image overlay |

### Decorative

| Token | Usage |
|-------|-------|
| `skyGradientTop: #B8D4E3` | Mountain illustration top gradient |
| `skyGradientBottom: #F0C87A` | Mountain illustration bottom gradient |

### Color Usage Rules

- **CTAs:** Coral for primary ("Shop Now", "Get Swatches"), Green for "Add to Cart", Mountain Blue for secondary ("Learn More")
- **Text on dark bg:** White or sandLight — never coral or blue
- **Badges:** "Sale" = coral, "Bestseller" = mountain blue, "New" = espresso on sand
- **BANNED:** No pink (#C9A0A0), no lavender (#D4B5FF), no purple tints. These are caught by `brandPalette.test.js`.

---

## Typography

### Font Families

| Role | Family | Fallbacks |
|------|--------|-----------|
| Headings | **Playfair Display** | Georgia, serif |
| Body | **Source Sans 3** | Helvetica Neue, Arial, sans-serif |

### Type Scale (Web)

| Token | Size | Weight | Line Height | Letter Spacing | Usage |
|-------|------|--------|-------------|----------------|-------|
| `heroTitle` | 56px | 700 | 1.1 | -0.02em | Homepage hero headline |
| `h1` | 42px | 700 | 1.15 | -0.01em | Page titles |
| `h2` | 32px | 700 | 1.2 | 0 | Section headings |
| `h3` | 24px | 600 | 1.3 | 0 | Card titles, subsections |
| `h4` | 20px | 600 | 1.35 | 0 | Feature labels |
| `bodyLarge` | 18px | 400 | 1.6 | 0 | Lead paragraphs |
| `body` | 16px | 400 | 1.6 | 0 | Default body text |
| `bodySmall` | 14px | 400 | 1.5 | 0 | Captions, helper text |
| `caption` | 12px | 500 | 1.4 | 0.02em | Badges, metadata |
| `navLink` | 14px | 600 | 1.0 | 0.04em | Navigation links |
| `price` | 20px | 700 | 1.0 | 0 | Product price display |
| `priceStrike` | 16px | 400 | 1.0 | 0 | Original price (strikethrough) |
| `button` | 15px | 600 | 1.0 | 0.04em | Button labels |

### Type Scale (Mobile — React Native)

Mobile should use the same relative hierarchy but adapted for device sizes:
- Hero: 32-36px (vs 56px web)
- H1: 28-32px
- H2: 24px
- Body: 16px (same)
- Caption: 12px (same)
- Button: 16px (larger tap target)

---

## Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4px | Tight gaps (icon-to-label) |
| `sm` | 8px | Compact spacing (badge padding, inline gaps) |
| `md` | 16px | Default spacing (card padding, form field gaps) |
| `lg` | 24px | Section content gaps, grid gaps |
| `xl` | 32px | Section padding |
| `xxl` | 48px | Major section breaks |
| `xxxl` | 64px | Page-level vertical rhythm |

### Web-Specific Layout

| Token | Value | Usage |
|-------|-------|-------|
| `section` | 80px | Vertical spacing between page sections |
| `pagePadding` | 24px | Mobile horizontal margin |
| `pagePaddingDesktop` | 80px | Desktop horizontal margin |
| `maxWidth` | 1280px | Content max width |
| `gridGap` | 24px | Product grid gap |

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `sm` | 4px | Badges, small tags |
| `md` | 8px | Buttons, inputs |
| `lg` | 12px | Cards, images |
| `xl` | 16px | Modal corners, large containers |
| `pill` | 9999px | Pill buttons, fully rounded |

---

## Shadows

| Token | CSS | Usage |
|-------|-----|-------|
| `card` | `0px 2px 12px rgba(58,37,24,0.08)` | Default card elevation |
| `cardHover` | `0px 8px 24px rgba(58,37,24,0.12)` | Card hover / press state |
| `nav` | `0px 2px 8px rgba(58,37,24,0.06)` | Navigation bar |
| `modal` | `0px 16px 48px rgba(58,37,24,0.2)` | Modals, Quick View |
| `button` | `0px 2px 8px rgba(232,132,92,0.3)` | Coral CTA buttons |

**Note:** All shadow colors use espresso-based RGBA for brand consistency (not generic black).

---

## Transitions

| Token | Value | Usage |
|-------|-------|-------|
| `fast` | 150ms | Hover states, toggle switches |
| `medium` | 250ms | Panel slides, accordion |
| `slow` | 400ms | Modal open/close, page transitions |
| `cardHover` | 300ms cubic-bezier(0.4,0,0.2,1) | Card lift animation |

### Mobile Mapping

- Web hover → Mobile press/active state
- `card` shadow → default state; `cardHover` shadow → press state
- `fast` transition → immediate haptic feedback
- `slow` transition → screen transitions, modal presentations

---

## Breakpoints

| Token | Value | Platform |
|-------|-------|----------|
| `mobile` | 320px | Both |
| `mobileLarge` | 480px | Both |
| `tablet` | 768px | Both |
| `desktop` | 1024px | Web |
| `wide` | 1280px | Web |
| `ultraWide` | 1440px | Web |

---

## Component Patterns

### Product Card (Web — shipped in PR #79)

```
┌─────────────────────────────┐
│  [Product Image]            │  borderRadius: lg (12px)
│                             │  shadow: card → cardHover on hover
│  [Bestseller] [Sale]        │  badge: caption text, sm radius
│                             │
│  Product Name               │  h3 weight, espresso
│  $XXX.XX  $XXX.XX           │  price + priceStrike (coral for sale)
│  3 finishes                 │  bodySmall, mutedBrown
│  [Quick View]               │  button style, mountainBlue bg
└─────────────────────────────┘
  4-column desktop, 2-column mobile
```

**Key elements:**
- Image with SEO alt text: `"{name} — Carolina Futons"`
- Badges: ribbon text (Featured/New/Clearance/Bestseller)
- Sale: show discounted price + original strikethrough + sale badge
- Color swatches: count text ("3 finishes") when productOptions has color-type
- Quick View: opens modal with image, name, price, "View Full Details" + "Add to Cart"
- Click: navigates to `/product-page/{slug}`
- Accessibility: ARIA labels on all interactive elements, keyboard nav via makeClickable

### Product Card (Mobile)

Same data, adapted for touch:
- 2-column grid (no 4-column)
- Quick View → tap opens bottom sheet (not hover modal)
- Swatches → tappable color dots (not just count text)
- Press state = `cardHover` shadow + scale(0.98) transform
- Image aspect ratio: 4:3 consistent

### Hero Section (Web — shipped in PR #80)

```
┌──────────────────────────────────────────────┐
│  [Full-bleed lifestyle photo, 1920x800]      │
│  [Espresso overlay rgba(58,37,24,0.6)]       │
│                                              │
│  "Handcrafted Comfort, Mountain Inspired."   │  heroTitle, white
│  "Premium futons from the Blue Ridge..."     │  bodyLarge, sandLight
│  [Shop Now →]                                │  coral CTA button
│                                              │
│  [ARIA: region landmark]                     │
└──────────────────────────────────────────────┘
  Staggered fade-in: overlay(0ms) → title(200ms) → subtitle(400ms) → CTA(600ms)
```

### Announcement Bar (shipped in PR #75)

- Dark espresso background (`#3A2518`)
- White text, caption size
- Rotating 3-4 messages with transition
- Full width, pinned to top

### Trust Bar (shipped in PR #75)

- 5 icons below hero
- Sand background
- Icon + label pairs
- Horizontal scroll on mobile

---

## Interaction Patterns

| Web Pattern | Mobile Equivalent |
|-------------|-------------------|
| Hover → cardHover shadow | Press → cardHover shadow + haptic |
| Click → navigate | Tap → navigate |
| Hover Quick View button | Long press → bottom sheet |
| Modal overlay (fade 200ms) | Bottom sheet (slide up 300ms) |
| Keyboard Enter → action | Tap → action |
| Focus ring (mountainBlue 2px) | N/A (OS handles focus) |
| Skeleton loading | Shimmer loading (same timing) |

---

## Grid System

| Context | Desktop | Tablet | Mobile |
|---------|---------|--------|--------|
| Product grid | 3 columns, 24px gap | 2 columns, 20px gap | 1 column, 16px gap |
| Featured grid | 4 columns, 24px gap | 2 columns, 20px gap | 2 columns, 16px gap |
| Category cards | 3-4 cards horizontal | 2 columns | 1 column scroll |

---

## Business Data (Single Source of Truth)

| Field | Value |
|-------|-------|
| Phone | (828) 252-9449 |
| Address | 824 Locust St, Ste 200, Hendersonville, NC 28792 |
| Hours | Wed-Sat 10am-5pm |
| Free shipping | Orders $999+ |
| White-glove free | Orders $1,999+ |
| White-glove local | $149 (WNC 287-289) |
| White-glove regional | $249 (Southeast 270-399) |

---

## Accessibility Standards

- **WCAG 2.1 AA** compliance target
- All interactive elements: ARIA labels
- Keyboard navigation: Enter/Space triggers actions
- Focus visible: 2px mountainBlue outline
- `announce()` helper for screen reader live regions
- `makeClickable()` helper wires onClick + keyboard + ARIA
- Color contrast: espresso on sand = 7.2:1 (AAA), white on espresso = 14.8:1 (AAA)

---

## File Organization

```
src/
├── public/
│   ├── sharedTokens.js        ← CROSS-PLATFORM tokens (import here)
│   ├── designTokens.js        ← Web-specific tokens (extends shared)
│   ├── a11yHelpers.js         ← Accessibility utilities
│   ├── mobileHelpers.js       ← Responsive utilities
│   └── placeholderImages.js   ← Image URL management
├── pages/
│   ├── Home.js                ← Homepage (hero, featured, categories)
│   └── Product Page.js        ← Product detail page
└── backend/
    └── productRecommendations.web.js  ← Product data with color/options
```

---

*This is a living document. Updated by melania after each sprint.*
