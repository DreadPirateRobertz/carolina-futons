# Carolina Futons

E-commerce website for Carolina Futons, built on the Wix Velo platform. Handcrafted mountain furniture with a Blue Ridge aesthetic — futons, sofas, mattresses, and accessories.

Live site: [carolinafutons.com](https://www.carolinafutons.com)

## Current Status

**v0.5.0 deployed** to stage3-velo. v0.4.1 released (security hardening). v0.4.0 released (color scheme shift). Running on My Site 3 (Wix Studio Furniture Store #3563 template).

- 12,993 tests passing across 331 test files
- 191 backend files, 41 pages, 232 public utilities
- 71.9% element connectivity (595/827 IDs wired)
- Category card photos now set in Wix Dashboard
- Active branch: `test-coverage-pages-miquella`
- Current PRs: #320 (page-level test coverage, 240 tests), #318 (rennala page tests), #319 (mobile audit, merged)
- Stage3 velo repo: `DreadPirateRobertz/carolina-futons-stage3-velo`
- ID mapping JSONs: `scripts/category-page-mapping.json`, `scripts/masterpage-home-id-mapping.json`
- Template element audit: `docs/TEMPLATE-ELEMENT-AUDIT.md`

## Architecture

This is a **Wix Velo** codebase — all frontend and backend code runs on the Wix platform. The `$w` selector model replaces traditional DOM manipulation, and backend modules use the `webMethod` pattern for secure client-server calls.

```
src/                        464 source files
├── pages/                  Page modules (Wix Velo $w lifecycle)
│   ├── Home.js, masterPage.js
│   ├── Product Page.js, Category Page.js
│   ├── Cart Page.js, Side Cart.js, Checkout.js
│   ├── Thank You Page.js, Member Page.js
│   └── ... (FAQ, Blog, Referral, UGC Gallery, etc.)
│
├── public/          232 shared frontend helpers & components
│   ├── sharedTokens.js      ← Brand design tokens (cross-platform)
│   ├── designTokens.js      ← Web-specific tokens
│   ├── mobileHelpers.js     ← Responsive utilities
│   ├── a11yHelpers.js       ← Accessibility (WCAG AA)
│   ├── navigationHelpers.js ← Mobile drawer, nav, focus traps
│   ├── Product*.js          ← Product page component modules
│   ├── engagementTracker.js ← GA4 event tracking
│   └── ...
│
├── backend/                Backend web modules (webMethod pattern)
│   ├── *Service.web.js     Business logic
│   ├── utils/
│   │   ├── sanitize.js     Input sanitization (XSS, injection)
│   │   ├── errorHandler.js Structured error handling
│   │   └── safeParse.js    Safe JSON parsing
│   └── ...
│
├── http-functions.js       HTTP endpoints (product feeds)
└── shipping-rates-plugin.js  Wix SPI shipping calculator

tests/               331 test files, 12,993 tests (Vitest)
content/             Product catalog, CMS content, blog data
scripts/             Build tools, ID remapping, secret provisioning
docs/                Design docs, plans, guides
design-vision/       Competitor screenshots, design analysis
```

## Documentation

All reference docs live in `docs/`. Root-level docs are actively used operational references.

| Root file | Purpose |
|-----------|---------|
| `WIX-STUDIO-BUILD-SPEC.md` | Element specs for all pages (source of truth) |
| `MASTER-HOOKUP.md` | Deployment checklist — backend, frontend, CMS, secrets |
| `PLUGIN-RECOMMENDATIONS.md` | Wix plugin evaluation and recommendations |
| `SOCIAL-MEDIA-STRATEGY.md` | Social media channels and content strategy |
| `memory.md` | Project context and conventions |

```
docs/
├── guides/                 Design system, Figma workflow, illustration standards
├── plans/                  Feature design docs and implementation plans
├── reports/                Audits (testing CI, token burn, product images)
├── archives/               Historical session reports
├── releases/               Release notes by version
├── ARCHITECTURE.md         System overview (464 files, Wix Velo patterns)
├── API-REFERENCE.md        Backend module API documentation
├── *-BUILD-SPEC.md         Per-page element specifications
├── TEMPLATE-ELEMENT-AUDIT.md  Template vs code element comparison
├── ELEMENT_CONNECTIVITY_REPORT.md  Element wiring verification
├── PAGE_ID_MAP-stage3.md   My Site 3 page IDs
└── ...
```

## Key Features

### E-Commerce
- **Product Page**: Gallery, options/variants, financing calculator, reviews, Q&A, size guide, swatch requests, 360-degree viewer
- **Cart & Checkout**: Side cart, cross-sell, coupon codes, gift cards, estimated delivery, address autocomplete
- **Order Management**: Order tracking, returns portal, fulfillment, delivery scheduling (Wed-Sat slots)

### Shipping & Logistics
- **Wix SPI Integration**: Custom shipping rate calculator (`shipping-rates-plugin.js`)
- **UPS API**: Real-time rates via `ups-shipping.web.js`
- **White-Glove Delivery**: Local $149, regional $249, free on orders > $1,999

### Customer Engagement
- **Loyalty Program**: Bronze/Silver/Gold tiers with points and rewards
- **Referral System**: Two-sided referral codes, $50 referrer / $25 referee credits
- **Reviews**: Star ratings, photo reviews, verified purchase badges
- **Live Chat**: Proactive triggers, chat routing, hours-aware

### Marketing & SEO
- **Product Feeds**: Facebook Catalog, Pinterest Rich Pins, Google Merchant Center
- **Analytics**: GA4 event tracking, Meta Pixel, TikTok Pixel
- **SEO**: Structured data (JSON-LD), OG tags, Twitter Cards
- **Email**: Cart recovery, post-purchase care, newsletter automation

### Design System
- **Blue Ridge Mountain Aesthetic**: Warm, rustic, hand-illustrated feel
- **Brand Colors**: Sand `#E8D5B7`, Espresso `#3A2518`, Mountain Blue `#5B8FA8`, Coral `#E8845C`
- **Typography**: Playfair Display (headings), Source Sans 3 (body)
- **Design Tokens**: Centralized in `sharedTokens.js` (colors, spacing, shadows, transitions)
- **Responsive**: 6 breakpoints from 320px mobile to 1440px ultraWide

## Setup

```bash
git clone git@github.com:DreadPirateRobertz/carolina-futons.git
cd carolina-futons
npm install
npm test          # Run full test suite
```

## Testing

Tests use **Vitest** with comprehensive Wix platform mocks in `tests/__mocks__/`. Module aliases in `vitest.config.js` map Wix import paths to mocks.

- **TDD**: Tests written before implementation
- **Coverage**: Happy path + error states + edge cases + boundary conditions
- **Mocks**: `__seed()` for CMS data, `__setMember()` for auth, `__onInsert()`/`__onUpdate()` for write assertions

## Deployment

This repo is the **development** codebase. Code deploys to Wix through a production repo using [wix-velo-mcp](https://github.com/DreadPirateRobertz/wix-velo-mcp):

```
carolina-futons (dev) → git tag → velo_sync → carolina_futons_velO (prod) → Wix → carolinafutons.com
```

Only tagged releases can be synced to production.

## Coding Standards

- `webMethod` pattern for all backend exports
- JSDoc on all exported functions
- `try/catch` on all async operations
- All user input sanitized via `backend/utils/sanitize`
- Wix Velo compatible imports only
- No hardcoded colors — use `designTokens.js`
- All PRs require review before merge

## License

Private. Carolina Futons proprietary code.
