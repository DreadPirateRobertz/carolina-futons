# Carolina Futons

E-commerce website for Carolina Futons, built on the Wix Velo platform. Handcrafted mountain furniture with a Blue Ridge aesthetic — futons, sofas, mattresses, and accessories.

Live site: [carolinafutons.com](https://www.carolinafutons.com)

## Architecture

This is a **Wix Velo** codebase — all frontend and backend code runs on the Wix platform. The `$w` selector model replaces traditional DOM manipulation, and backend modules use the `webMethod` pattern for secure client-server calls.

```
src/
├── pages/           39 page modules (Wix Velo $w lifecycle)
│   ├── Home.js, masterPage.js
│   ├── Product Page.js, Category Page.js
│   ├── Cart Page.js, Side Cart.js, Checkout.js
│   ├── Thank You Page.js, Member Page.js
│   └── ... (FAQ, Blog, Referral, UGC Gallery, etc.)
│
├── public/          106 shared frontend helpers & components
│   ├── sharedTokens.js      ← Brand design tokens (cross-platform)
│   ├── designTokens.js      ← Web-specific tokens
│   ├── mobileHelpers.js     ← Responsive utilities
│   ├── a11yHelpers.js       ← Accessibility (WCAG AA)
│   ├── navigationHelpers.js ← Mobile drawer, nav, focus traps
│   ├── Product*.js          ← Product page component modules
│   ├── engagementTracker.js ← GA4 event tracking
│   └── ...
│
├── backend/         91 backend web modules
│   ├── *Service.web.js      ← Business logic (webMethod pattern)
│   ├── utils/
│   │   ├── sanitize.js      ← Input sanitization (XSS, injection)
│   │   ├── errorHandler.js  ← Structured error handling
│   │   ├── mediaHelpers.js  ← Image/media utilities
│   │   └── safeParse.js     ← Safe JSON parsing
│   └── ...
│
├── http-functions.js        ← HTTP endpoints (product feeds)
└── shipping-rates-plugin.js ← Wix SPI shipping calculator

tests/               309 test files, 12,084 tests (Vitest)
content/             Product catalog, CMS content, blog data
docs/                Design docs, plans, guides
```

## Key Features

### E-Commerce
- **Product Page**: Gallery, options/variants, financing calculator, reviews, Q&A, size guide, swatch requests, 360-degree viewer, AR preview
- **Cart & Checkout**: Side cart, cross-sell recommendations, coupon codes, gift cards, estimated delivery, address autocomplete, checkout progress
- **Order Management**: Order tracking, returns portal, fulfillment, delivery scheduling (Wed-Sat slots)

### Shipping & Logistics
- **Wix SPI Integration**: Custom shipping rate calculator (`shipping-rates-plugin.js`)
- **UPS API**: Real-time rates via `ups-shipping.web.js`
- **White-Glove Delivery**: Local $149, regional $249, free on orders > $1,999
- **Delivery Scheduling**: Customer-selected time slots

### Customer Engagement
- **Loyalty Program**: Bronze/Silver/Gold tiers with points, rewards, tier benefits
- **Referral System**: Two-sided referral codes, $50 referrer / $25 referee credits
- **Reviews**: Star ratings, photo reviews, verified purchase badges
- **Social Proof**: Real-time purchase notifications, review count toasts
- **Live Chat**: Proactive triggers, chat routing, hours-aware

### Marketing & SEO
- **Product Feeds**: Facebook Catalog, Pinterest Rich Pins, Google Merchant Center
- **Analytics**: GA4 event tracking, Meta Pixel, TikTok Pixel
- **SEO**: Structured data (JSON-LD), OG tags, Twitter Cards, topic clusters
- **Email**: Cart recovery, post-purchase care, newsletter automation

### Design System
- **Blue Ridge Mountain Aesthetic**: Warm, rustic, hand-illustrated feel
- **Brand Colors**: Sand `#E8D5B7`, Espresso `#3A2518`, Mountain Blue `#5B8FA8`, Coral `#E8845C`
- **Typography**: Playfair Display (headings), Source Sans 3 (body)
- **Design Tokens**: Centralized in `sharedTokens.js` (colors, spacing, shadows, transitions)
- **Responsive**: 6 breakpoints from 320px mobile to 1440px ultraWide

## Setup

### Prerequisites

- Node.js >= 20
- npm

### Install

```bash
git clone git@github.com:DreadPirateRobertz/carolina-futons.git
cd carolina-futons
npm install
```

### Run Tests

```bash
npm test              # Run all 12,084 tests
npx vitest run        # Same thing
npx vitest --watch    # Watch mode
```

## Testing

Tests use **Vitest** with comprehensive Wix platform mocks. All Wix APIs (`wix-data`, `wix-members-backend`, `wix-stores-frontend`, etc.) are mocked in `tests/__mocks__/`. Module aliases in `vitest.config.js` map Wix import paths to mocks.

```bash
npm test                                    # Full suite (309 files, 12,084 tests)
npx vitest run tests/referralService.test.js  # Single file
npx vitest run --reporter=verbose             # Verbose output
```

### Test conventions

- **TDD**: Tests written before implementation
- **Coverage**: Happy path + error states + edge cases + boundary conditions
- **Mocks**: `__seed()` for CMS data, `__setMember()` for auth, `__onInsert()`/`__onUpdate()` for write assertions

## Wix Velo Integration

### How code reaches the live site

This repo is the **development** codebase. Code is deployed to Wix through a separate production repo (`carolina_futons_velO`) using the [wix-velo-mcp](https://github.com/DreadPirateRobertz/wix-velo-mcp) server:

```
carolina-futons (dev)  →  git tag v0.1.0  →  velo_sync v0.1.0  →  carolina_futons_velO (prod)
                                                                         │
                                                                    Wix GitHub Integration
                                                                         │
                                                                    carolinafutons.com
```

Only tagged releases can be synced to production. See [wix-velo-mcp](https://github.com/DreadPirateRobertz/wix-velo-mcp) for deployment tools.

### Code patterns

**Page modules** export `$w.onReady()`:
```javascript
$w.onReady(async function () {
  // Initialize page sections
});
```

**Backend modules** use `webMethod`:
```javascript
import { Permissions, webMethod } from 'wix-web-module';

export const getData = webMethod(Permissions.Anyone, async (input) => {
  const clean = sanitize(input, 100);
  // ... business logic
  return { success: true, data };
});
```

**Frontend helpers** export pure functions or initializers:
```javascript
export function initMobileDrawer($w, currentPath) { ... }
```

### Coding standards

- `webMethod` pattern for all backend exports
- JSDoc on all exported functions
- `try/catch` on all async operations
- All user input sanitized via `backend/utils/sanitize`
- Wix Velo compatible imports only
- No hardcoded colors — use `designTokens.js`

## Project Structure Details

### Design tokens

All brand tokens live in `src/public/sharedTokens.js` (platform-agnostic). Web-specific tokens (typography scale, grid, responsive breakpoints) in `src/public/designTokens.js`.

### Product page architecture

`Product Page.js` is an orchestrator (~550 lines) that delegates to component modules:
- `ProductGallery.js` — Image gallery with zoom, thumbnails
- `ProductOptions.js` — Size, finish, variant selectors
- `ProductDetails.js` — Specs, descriptions, badges
- `ProductReviews.js` — Star ratings, review list, submission
- `ProductFinancing.js` — Monthly payment calculator
- `AddToCart.js` — Cart integration, quantity, stock status

### Content

- `content/catalog-MASTER.json` — 88 products across 9 categories
- `content/about.json` — CMS content (FAQ, shipping, policies)
- `content/blog/` — Blog post content

## License

Private. Carolina Futons proprietary code.
