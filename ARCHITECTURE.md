# Carolina Futons - Architecture Guide

## System Overview

Carolina Futons is a Wix Studio e-commerce site for a furniture retailer in
Hendersonville, NC. The codebase uses **Wix Velo** (Wix's JavaScript framework)
with a standard Wix project structure: backend web modules, page-specific code,
and shared public modules.

```
src/
├── backend/                 # Server-side web modules (run on Wix servers)
│   ├── analyticsHelpers.web.js      # Product view/cart tracking
│   ├── emailService.web.js          # Contact form & order notification emails
│   ├── fulfillment.web.js           # Order fulfillment & UPS shipment management
│   ├── productRecommendations.web.js # Cross-sell, featured, and sale products
│   ├── seoHelpers.web.js            # JSON-LD schema & alt text generation
│   ├── shipping-rates-plugin.js     # Wix eCommerce shipping rates plugin
│   └── ups-shipping.web.js          # UPS REST API integration (OAuth 2.0)
│
├── pages/                   # Page-specific frontend code (one per Wix page)
│   ├── masterPage.js                # Global: nav, announcement bar, search, SEO
│   ├── Home.c1dmp.js                # Homepage: hero, featured products, categories
│   ├── Product Page.ve2z7.js        # PDP: variants, gallery, cross-sell, schema
│   ├── Category Page.u0gn0.js       # PLP: filters, sort, grid, quick view
│   ├── Cart Page.mqi5m.js           # Cart: shipping threshold, suggestions
│   ├── Side Cart.ego5s.js           # Slide-out mini cart panel
│   ├── Checkout.psuom.js            # Checkout: trust signals, order notes
│   ├── Thank You Page.dk9x8.js      # Post-purchase: sharing, newsletter, recs
│   ├── About.gar3e.js               # Our Story: timeline, team photos
│   ├── Contact.k14wx.js             # Contact form with validation
│   ├── FAQ.s2c5g.js                 # Accordion FAQ with schema markup
│   ├── Search Results.evr2j.js      # Product search results
│   ├── Search Suggestions Box.gg5mx.js  # Live search autocomplete
│   ├── Fullscreen Page.vu50r.js     # Product videos gallery
│   ├── Shipping Policy.ype8c.js     # Shipping calculator & delivery info
│   ├── Member Page.f00pg.js         # Account: orders, wishlist, settings
│   ├── Accessibility Statement.di5bl.js  # Static accessibility page
│   ├── Privacy Policy.pcvmd.js      # Privacy policy with TOC navigation
│   ├── Refund Policy.jmwgj.js       # Return policy accordion
│   └── Terms & Conditions.z0xvf.js  # Terms with TOC navigation
│
└── public/                  # Shared frontend modules (importable from pages)
    ├── designTokens.js              # Design system: colors, typography, spacing
    └── galleryHelpers.js            # Recently viewed, compare, product badges
```

## How Wix Velo Works

### Backend Web Modules (`*.web.js`)

Files ending in `.web.js` define **web methods** — server-side functions callable
from the frontend. They use `webMethod()` from `wix-web-module` to expose functions
with specific permission levels:

- `Permissions.Anyone` — callable without authentication (public APIs)
- `Permissions.SiteMember` — requires logged-in site member (admin-only ops)

```js
// Backend: export a web method
export const myFunction = webMethod(Permissions.Anyone, async (arg) => { ... });

// Frontend: import and call it
import { myFunction } from 'backend/myModule.web';
const result = await myFunction(arg);
```

### Service Plugins (`shipping-rates-plugin.js`)

Wix supports **service plugins** (formerly SPIs) that hook into platform
functionality. The shipping rates plugin exports a `getShippingRates` function
that Wix calls automatically during checkout to display shipping options.

### Page Code (`src/pages/*.js`)

Each page file runs when its corresponding Wix page loads. The filename includes
a Wix-generated page ID (e.g., `c1dmp` for the homepage). Code uses `$w()` to
select editor elements by their IDs.

- `masterPage.js` — runs on **every** page (global header/footer behavior)
- Other files run only on their specific page

### Public Modules (`src/public/`)

Shared code importable from any page file. Contains design tokens, utility
functions, and client-side state management.

## Data Architecture

### Wix Collections (CMS)

| Collection | Purpose | Access |
|------------|---------|--------|
| `Stores/Products` | Wix Stores product catalog | Read (frontend + backend) |
| `Stores/Orders` | Order data from Wix Stores | Read (backend, SiteMember) |
| `ProductAnalytics` | Custom: view counts, cart tracking | Read/Write (backend) |
| `ContactSubmissions` | Custom: contact form records | Write (backend) |
| `Wishlist` | Custom: saved items per member | Read/Write (frontend) |
| `Fulfillments` | Custom: shipping/tracking records | Read/Write (backend) |

### External Services

| Service | Integration | Auth |
|---------|------------|------|
| UPS REST API | Rates, labels, tracking, address validation | OAuth 2.0 (client credentials) |
| Wix Triggered Emails | Contact form & order notifications | Wix CRM backend |
| Wix Secrets Manager | API keys, account numbers | `wix-secrets-backend` |

## Key Architectural Patterns

### 1. Cross-Sell / Recommendation Engine

Product recommendations flow through `productRecommendations.web.js`:

```
Product Page → getRelatedProducts()     → "You Might Also Like"
            → getSameCollection()       → "More From This Collection"
Cart Page   → getCompletionSuggestions() → "Complete Your Futon"
Homepage    → getFeaturedProducts()     → "Our Favorite Finds"
            → getSaleProducts()         → "Current Deals"
```

The completion engine analyzes cart contents by category and suggests
complementary products (frame + mattress pairing logic).

### 2. SEO Schema Injection

Every page injects JSON-LD structured data via hidden `HtmlComponent` elements:

- `masterPage.js` → `LocalBusiness` schema on all pages
- `Product Page` → `Product` schema with pricing and availability
- `Product Page` → `BreadcrumbList` schema for navigation
- `FAQ` → `FAQPage` schema for rich results
- `About` / `Contact` → additional `LocalBusiness` schema

### 3. Shipping Integration

Two-layer shipping architecture:

1. **Plugin layer** (`shipping-rates-plugin.js`): Wix calls this during checkout
   to display shipping options. It calls the UPS API and adds local
   pickup/delivery options.

2. **Fulfillment layer** (`fulfillment.web.js`): Post-purchase order management.
   Creates UPS shipments, generates labels, and tracks packages.

Both layers share the UPS integration in `ups-shipping.web.js`.

### 4. Design Token System

`designTokens.js` centralizes all visual constants — colors, typography, spacing,
shadows. This ensures consistency between Velo code styling and the Wix Studio
editor configuration documented in `WIX-STUDIO-BUILD-SPEC.md`.

### 5. Element ID Convention

All `$w('#elementId')` references in page code correspond to elements in the
Wix Studio editor. The `WIX-STUDIO-BUILD-SPEC.md` documents every element ID
and its expected type. If code references `$w('#heroTitle')`, an element with
ID `heroTitle` must exist in the editor.

## Error Handling Strategy

The codebase follows a consistent error handling pattern:

- **Non-critical operations** (analytics, SEO schema, optional UI elements):
  silently catch errors to prevent page breakage
- **Critical operations** (email sending, checkout): catch and display user-facing
  error messages with fallback contact info (phone number)
- **Shipping rates**: fall back to estimated flat rates if UPS API fails
- **Element access**: wrapped in try/catch because elements may not exist on all
  page variations or breakpoints

## Configuration

### Wix Secrets Manager

Required secrets (set in Wix Dashboard > Developer Tools > Secrets Manager):

| Secret Key | Purpose |
|------------|---------|
| `UPS_CLIENT_ID` | UPS OAuth 2.0 client ID |
| `UPS_CLIENT_SECRET` | UPS OAuth 2.0 client secret |
| `UPS_ACCOUNT_NUMBER` | UPS shipper account number |
| `UPS_SANDBOX` | Set to `"true"` for test environment |
| `SITE_OWNER_CONTACT_ID` | Wix contact ID for email notifications |

### Business Constants

Key business rules hardcoded across the codebase:

- **Free shipping threshold**: $999 (defined in `ups-shipping.web.js`,
  `shipping-rates-plugin.js`, `Cart Page`, `Side Cart`)
- **Store hours**: Wed-Sat 10am-5pm
- **Store address**: 824 Locust St, Ste 200, Hendersonville, NC 28792
- **Phone**: (828) 252-9449
- **Local delivery ZIP range**: 287-289 (Henderson County area)
- **Regional delivery ZIP range**: 270-399 (SE United States)
