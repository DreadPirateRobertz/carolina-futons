# cf-3qt Phase 1 Prep — design system + commerce core

**Author:** godfrey · **Date:** 2026-04-17 · **Owner (downstream):** melania
**Status:** Phase 1 / 2 BLOCKED on Phase 0 (cf-nq7 Next.js + Vercel). This doc
is drop-in ready for the Next.js repo once Phase 0 lands.

Source material:
- Colors/spacing/type: `/Users/hal/gt/cfutons/crew/godfrey/src/public/sharedTokens.js`
- CSS overrides + breakpoints: `/Users/hal/gt/cfutons/crew/godfrey/src/styles/global.css`
- Live-site pixel measurements: `https://www.carolinafutons.com` @ 1440×900 desktop

---

## 1. Tailwind theme (drop into `tailwind.config.ts`)

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}', './app/**/*.{ts,tsx,mdx}'],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: '1rem', sm: '1.5rem', lg: '2rem' },
      screens: { '2xl': '1280px' }, // matches sharedTokens.breakpoints.wide
    },
    screens: {
      // From sharedTokens.breakpoints (min-width convention)
      sm: '480px',   // mobileLarge
      md: '768px',   // tablet
      lg: '1024px',  // desktop
      xl: '1280px',  // wide
      '2xl': '1440px', // ultraWide
    },
    extend: {
      colors: {
        // ── CF brand primary (from sharedTokens.colors) ──────────
        cf: {
          navy: '#1E3A5F',         // espresso — primary text/headings
          'navy-light': '#3D5A80', // espressoLight — secondary text
          blue: '#5B8FA8',         // mountainBlue — accents, links
          'blue-dark': '#3D6B80',  // mountainBlueDark — hover
          'blue-light': '#A8CCD8', // mountainBlueLight — tinted bg
          cta: '#4A7D94',          // sunsetCoral — primary CTA (WCAG AA 4.51:1)
          'cta-hover': '#3D6B80',  // sunsetCoralDark
          'cta-light': '#A8CCD8',  // sunsetCoralLight
          sand: '#F0F4F8',         // sandBase — section bg
          'sand-light': '#F8FAFC', // sandLight — alt rows
          'sand-dark': '#E2E8F0',  // sandDark — borders
        },
        // ── Header/footer chrome (from global.css :root) ─────────
        chrome: {
          'header-top': '#F0F5F8',    // --cf-header-top
          'header-bottom': '#E4EDF2', // --cf-header-bottom
          'header-mobile': '#E8F1F5', // --cf-header-mobile
          'footer-bg': '#1E2A3A',     // --cf-footer-bg
          'footer-text': '#D0DAE4',   // --cf-footer-text
        },
        // ── Semantic ─────────────────────────────────────────────
        success: '#4A7C59',
        error: '#DC2626',
        muted: { DEFAULT: '#646C79', slate: '#64748B' },
        // ── shadcn semantic tokens (point to CSS vars set below) ──
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
      },
      fontFamily: {
        // From sharedTokens.fontFamilies
        heading: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"Source Sans 3"', '"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
      fontSize: {
        // Derived from global.css headings + body
        'display': ['42px', { lineHeight: '1.15', letterSpacing: '-0.01em' }],
        'h1': ['42px', { lineHeight: '1.15', letterSpacing: '-0.01em' }],
        'h2': ['28px', { lineHeight: '1.25', letterSpacing: '0.02em' }],
        'h3': ['18px', { lineHeight: '1.35' }],
        'h4': ['16px', { lineHeight: '1.4' }],
        'body': ['16px', { lineHeight: '1.65' }],
        'body-lg': ['18px', { lineHeight: '1.5' }],
        'body-sm': ['14px', { lineHeight: '1.5' }],
        'caption': ['13px', { lineHeight: '1.4' }],
        // Commerce-specific
        'price': ['24px', { lineHeight: '1.2', letterSpacing: '0' }],
        'price-sm': ['15px', { lineHeight: '1.3' }],
        'nav': ['13px', { lineHeight: '1.3', letterSpacing: '0.04em' }],
      },
      spacing: {
        // From sharedTokens.spacing (4px base unit)
        xs: '4px', sm: '8px', md: '16px', lg: '24px',
        xl: '32px', '2xl': '48px', '3xl': '64px',
      },
      borderRadius: {
        // From sharedTokens.borderRadius
        sm: '4px', md: '8px', lg: '12px', xl: '16px', pill: '9999px',
        // shadcn semantic (point to --radius)
        DEFAULT: 'var(--radius)',
      },
      boxShadow: {
        // From sharedTokens.shadows (navy-tinted)
        card: '0px 2px 12px rgba(30, 58, 95, 0.08)',
        'card-hover': '0px 8px 24px rgba(30, 58, 95, 0.12)',
        nav: '0px 2px 8px rgba(30, 58, 95, 0.06)',
        modal: '0px 16px 48px rgba(30, 58, 95, 0.2)',
        button: '0px 2px 8px rgba(91, 143, 168, 0.3)',
      },
      transitionDuration: {
        fast: '150ms',
        medium: '250ms',
        slow: '400ms',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
```

### `globals.css` — shadcn CSS variables (HSL format)

Put this in `app/globals.css`. HSL values are the CF palette converted:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* HSL breakdowns of CF palette for shadcn runtime theming */
    --background: 0 0% 100%;              /* #FFFFFF */
    --foreground: 213 51% 25%;            /* #1E3A5F navy */
    --card: 0 0% 100%;
    --card-foreground: 213 51% 25%;
    --popover: 0 0% 100%;
    --popover-foreground: 213 51% 25%;
    --primary: 200 32% 43%;               /* #4A7D94 cta */
    --primary-foreground: 0 0% 100%;
    --secondary: 212 28% 93%;             /* #F0F4F8 sand */
    --secondary-foreground: 213 51% 25%;
    --muted: 212 28% 93%;
    --muted-foreground: 215 11% 43%;      /* #646C79 muted */
    --accent: 200 28% 51%;                /* #5B8FA8 blue */
    --accent-foreground: 0 0% 100%;
    --destructive: 0 72% 51%;             /* #DC2626 */
    --destructive-foreground: 0 0% 100%;
    --border: 210 24% 90%;                /* #E2E8F0 */
    --input: 210 24% 90%;
    --ring: 200 32% 43%;                  /* matches --primary */
    --radius: 4px;                         /* cf-sm — matches Wix CSS */
  }

  /* Dark mode deferred — Wix site has no dark mode; Phase 2+ decision */

  body {
    @apply bg-background text-foreground font-sans text-body;
    font-feature-settings: 'rlig' 1, 'calt' 1;
  }

  h1 { @apply font-heading text-h1 text-cf-navy; }
  h2 { @apply font-heading text-h2 text-cf-navy; }
  h3 { @apply font-heading text-h3 text-cf-navy; }
  h4 { @apply font-sans text-h4 text-cf-navy; }

  /* WCAG 2.1 AA focus — matches global.css §9b */
  *:focus-visible {
    outline: 3px solid hsl(var(--ring));
    outline-offset: 2px;
  }

  /* WCAG 2.3.3 reduced motion — matches global.css §32 */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0s !important;
      transition-duration: 0s !important;
    }
  }
}
```

---

## 2. shadcn/ui component inventory

Install via `npx shadcn@latest add <name>`. **After install, re-theme each**
component to use `text-cf-navy`/`bg-cf-cta` etc. — stock shadcn ships with
radix black/white + shadcn neutral defaults.

### Required for Phase 1 (design primitives)

| shadcn component | Replaces Wix pattern (data-hook / class) | Priority |
|---|---|---|
| `button` | `[data-hook="add-to-cart"]`, `[data-hook="load-more-button"]`, `[data-hook="place-order-button"]`, `[data-hook="submit-button"]`, all CTAs | P0 |
| `input` | `[data-hook="text-field-root"] input`, form inputs | P0 |
| `textarea` | `[data-hook="form-root"] textarea` | P0 |
| `label` | `[data-hook="form-root"] label`, `[data-hook="checkout-root"] label` | P0 |
| `card` | Product grid item wrapper, collection card, testimonial card | P0 |
| `badge` | `[data-hook="product-item-ribbon"]`, `[data-hook="sale-discount-badge"]` | P0 |
| `separator` | Section dividers, footer col separators | P0 |
| `skeleton` | Product grid loading, gallery loading, thumbnail preload | P0 |
| `container` (custom layout) | `.section` wrapper | P0 |

### Required for Phase 2 (commerce core)

| shadcn component | Replaces Wix pattern | Priority |
|---|---|---|
| `select` | `[data-hook="sort-floating-dropdown"]`, variant selectors | P0 |
| `dropdown-menu` | Account menu, cart flyout trigger | P0 |
| `sheet` | Mobile menu (`.hamburger-menu-container`), side cart (`[data-hook="side-cart-*"]`) | P0 |
| `dialog` | Quick view, swatch enlarge, confirmation modals | P0 |
| `navigation-menu` | `.horizontal-menu` (25 nav links on live site) | P0 |
| `breadcrumb` | `[data-hook="extended-gallery-breadcrumbs"]` | P0 |
| `accordion` | `[data-hook="info-section-title"]` product info, FAQ | P0 |
| `tabs` | `[data-hook="faq-tab-label"]`, PDP description/specs tabs | P1 |
| `checkbox` | Filter checkboxes on PLP, newsletter opt-in | P0 |
| `radio-group` | Variant swatches (color, size), gift card denominations | P0 |
| `toggle-group` | Swatch selector (single-select color/firmness), quiz options | P1 |
| `progress` | `[data-hook="quiz-progress-bar"]`, checkout step indicator | P1 |
| `form` (react-hook-form + zod) | All form validation (contact, checkout, returns, swatch request) | P0 |
| `sonner` (toast) | Add-to-cart confirmation, a11y announcements (replaces `public/a11yHelpers.js` live regions) | P0 |
| `tooltip` | Price adder hints, terrain surcharge explainer, info icons | P1 |

### Custom (not in shadcn — build ourselves)

| Custom component | Notes |
|---|---|
| `AnnouncementBar` | Rotating sticky top bar. No Wix equivalent in markup; current global.css uses `.header .rich-text:first-child`. Phase 1 build. |
| `Header` | Nav + logo + search + cart. Combines `navigation-menu` + `sheet` (mobile) + custom search input. Phase 1 build. |
| `Footer` | 3-col layout + newsletter form + social links + copyright. Custom grid. Phase 1 build. |
| `Container` | Max-width wrapper (`max-w-[1280px]`, px-md md:px-lg lg:px-xl). Phase 1 build. |
| `Section` | Alternating-background section wrapper (mirrors global.css §16 `.section:nth-child(even)`). Phase 1 build. |
| `ProductGallery` | Main image + thumbnail strip + zoom. Use `embla-carousel-react` (shadcn carousel under the hood). Phase 2. |
| `SwatchPicker` | Color/fabric swatches with price adders + stock dots. Built on `radio-group`. Phase 2. |
| `PriceDisplay` | Handles strike-through, financing pill, savings badge. Phase 2. |
| `DeliveryZoneSelector` | Zip → zone resolver (uses `sharedTokens.shippingConfig.localZones`). Phase 2. |
| `FilterSidebar` | Accordion of checkbox groups for PLP. Built on `accordion` + `checkbox`. Phase 2. |
| `StatusTimeline` | `[data-hook="status-timeline"]` for order tracking + returns. Custom stepper. Phase 5. |

---

## 3. Header + footer pixel specs (live site)

Measured at `https://www.carolinafutons.com` on 2026-04-17.

### Desktop (1440×900)

**Header:**
- Total height: **213px**
- Background: gradient `#F0F5F8 → #E4EDF2` top-to-bottom
- Border-bottom: `3px solid #5B8FA8` (cf-blue)
- Logo: `291×140px` image, top offset 15px from header top
- Nav: `783×29px`, positioned at top:167–196px (below logo block)
- Nav link count: **25** (full menu: Home + Shop + Collections + Content + Help + About)
- Nav link font: `13px, uppercase, letter-spacing 0.04em, font-weight 500` (per global.css §3 — *but live site currently shows 12px Arial default because Wix Studio strips some overrides; Next.js version will apply Tailwind tokens cleanly*)
- Cart icon (`[data-hook="cart-icon-button"]`): `79×32px` at top:166px
- Announcement bar: not currently rendered on live site (element absent) — Phase 1 will add as a sticky `AnnouncementBar` component with rotating messages

**Footer:**
- Total height: **108px** (compact — only 3 columns + newsletter visible; much taller on pages with full footer)
- Background: `#1E2A3A` (cf chrome.footer-bg)
- Top border: `3px inset shadow #5B8FA8` (cf-blue accent bar)
- 6 links in footer rendered; 3 column groups detected
- Link color: `#D0DAE4` (cf chrome.footer-text), hover → `#FFFFFF`
- Headings: `16px, uppercase, letter-spacing 0.05em, font-weight 700`
- Newsletter input: translucent `rgba(255,255,255,0.1)` bg, white text, 4px radius

### Tablet (768) and Mobile (375)

Wix Studio renders the same desktop markup and applies responsive CSS. Key
breakpoint behaviors (from global.css §19, §31):

- `@max-width: 768px`: h1 → 30px, h2 → 22px, product grid → 2 col, header pad-bottom 10px, header bg switches to solid `#E8F1F5` (chrome.header-mobile), footer pad-top → 24px
- `@max-width: 480px`: h1 → 24px, h2 → 20px, product grid → 1 col, all CTA buttons full-width min-h 48px, form inputs font-size forced to 16px (iOS zoom prevention), nav links min-h 44px (touch targets)

**Next.js port should:**
- Keep the `44px` touch-target rule (WCAG 2.5.8) on all mobile interactive elements
- Keep the `16px` input font-size on mobile (iOS zoom)
- Port the header background switch (gradient → solid) at `md:` breakpoint

---

## 4. Out-of-scope for this prep doc

- Blog typography theme (Phase 4 — out of scope per cf-3qt.1)
- Dark mode (no precedent in Wix site; decide in Phase 2+)
- Email template tokens (those live in `src/public/emailTemplates/` — separate system)
- Mobile app tokens (consumed via `design-tokens.json` generated from `sharedTokens.js` — not affected by this migration)

## 5. Decisions from melania (2026-04-17)

1. **Fonts**: `next/font/google` for Playfair Display + Source Sans 3. Self-hosted by Next.js → zero CLS, no third-party cookies.
2. **shadcn path**: `/components/ui/` standard. Theming via Tailwind `cf-*` tokens, not directory nesting.
3. **Announcement bar**: CMS-driven. Create Wix CMS `AnnouncementBar` collection with fields `message`, `linkUrl`, `startDate`, `endDate`, `priority`. Fetch via `@wix/data`. Marketing can update without deploy.
4. **`/design` preview**: Open on Vercel previews; add `<meta name="robots" content="noindex">` to prevent indexing. Cheaper than basic auth, nothing sensitive.
5. **Header search**: Build on Wix Headless Search API (`@wix/stores.products` + `@wix/data` query). Wix Studio front-end search is eliminated — no porting.

**PR #1077 approved** for merge once Phase 0 (`cf-nq7`) repo is live. Drop-in spec for `carolina-futons-web` repo.
