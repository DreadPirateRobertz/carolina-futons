# Shipping Intelligence Layer — Design Spec
**Date:** 2026-03-22
**Status:** Approved for implementation
**Rigs:** cfutons (backend + web), cfutons_mobile (mobile checkout)

---

## Overview

Carolina Futons carries large, heavy furniture — futon frames, murphy beds, mattresses — that spans the full spectrum from parcel to LTL freight. The current codebase has UPS REST API integration for label generation and rate lookup (`ups-shipping.web.js`), but rates are not surfaced on product pages or in bundle quotes. Worldwide Express (SpeedFreight 2.0) handles LTL/pallet when weight exceeds UPS limits.

This layer exposes two public webMethods — `getShippingEstimate` and `calculateBundleQuote` — that surface real carrier rates at the product page and bundle builder, using accurate per-product packaging data and automatically routing to LTL when weight requires it.

---

## Architecture

```
Frontend / Mobile
    │
    ├── getShippingEstimate(productId, zip)       ← single product
    └── calculateBundleQuote(items[], zip)        ← bundle / multi-item

Backend
    │
    ├── ProductShippingProfiles CMS               ← authoritative dims + freight class
    │       productId, weight_lbs, length_in, width_in, height_in,
    │       freightClass (NMFC), requiresPallet, requiresFreight, packagingNotes
    │
    ├── ups-shipping.web.js (existing)            ← parcel + UPS services
    │       getRates(zip, packages[]) → [{code, title, cost, estimatedDelivery}]
    │
    ├── wwex-freight.web.js (new)                 ← LTL / pallet via SpeedFreight 2.0
    │       getLTLRates(origin, destination, packages[]) → [{carrier, cost, transitDays}]
    │
    └── shippingIntelligence.web.js (new, orchestrator)
            getShippingEstimate(productId, zip)
            calculateBundleQuote(items[], zip)
            _resolveProfile(productId)            ← CMS lookup + category fallback
            _routeToCarrier(totalWeight, packages[]) ← parcel vs freight decision
```

---

## ProductShippingProfiles CMS Collection

**Collection name:** `ProductShippingProfiles`

| Field | Type | Notes |
|-------|------|-------|
| `productId` | string | Wix product `_id` — unique index |
| `weight_lbs` | number | Actual packed weight |
| `length_in` | number | Longest dimension |
| `width_in` | number | |
| `height_in` | number | |
| `freightClass` | string | NMFC class (e.g. "150", "200") — required for LTL |
| `requiresPallet` | boolean | Forces LTL routing regardless of weight |
| `requiresFreight` | boolean | Always route to freight, never parcel |
| `customItemFlag` | boolean | Triggers manual pricing review path |
| `packagingNotes` | string | "Ships in 2 boxes", "mattress compressed" |

**Fallback chain:** product profile → category default in `ups-shipping.web.js` → `'default'` dims.
Products without a profile use category defaults; profiles are not required at launch.

---

## Tier Routing Logic

```
totalWeight = sum of all items' weight_lbs

if any item.requiresPallet or any item.requiresFreight:
    → WWEX SpeedFreight (LTL)
elif totalWeight > 150 lbs:
    → WWEX SpeedFreight (LTL)    // UPS max chargeable weight per piece
else:
    → UPS Shop endpoint (parcel)  // all UPS services in one call
```

Both paths return the same shape:
```js
[{
  code: string,          // 'ups-ground' | 'ups-2day' | 'ltl-standard' | 'ltl-guaranteed'
  title: string,         // 'UPS Ground' | 'LTL Freight (XPO)' etc.
  cost: number,          // USD
  estimatedDelivery: string,  // '3–5 business days' | 'Mar 26–28'
  carrier: string,       // 'UPS' | 'XPO' | 'Estes' etc.
  requiresLiftgate: boolean,
  isEstimate: boolean    // true when API unavailable, using cached/fallback
}]
```

---

## `shippingIntelligence.web.js`

### `getShippingEstimate(productId, zip)`

```
Permissions.Anyone  (rate limit: 20/min per IP)

1. Validate zip (5-digit US, handle PR/GU/APO edge cases)
2. _resolveProfile(productId) → ShippingProfile
3. _routeToCarrier(profile.weight_lbs, [profile]) → 'ups' | 'ltl'
4. if 'ups': call ups-shipping getRates(zip, [profile])
   if 'ltl': call wwex-freight getLTLRates(ORIGIN, zip, [profile])
5. Cache result by productId+zip, TTL: 15min
6. Return [{code, title, cost, estimatedDelivery, carrier}]
   Fail-open: return fallback estimate array on any API failure
```

### `calculateBundleQuote(items[], zip)`

```
Permissions.Anyone  (rate limit: 10/min per IP)

items: [{productId, quantity}]

1. Validate zip
2. For each item: _resolveProfile(productId) × quantity → profiles[]
3. totalWeight = sum(profiles[].weight_lbs)
4. _routeToCarrier(totalWeight, profiles[]) → 'ups' | 'ltl'
5. Call appropriate carrier API with all packages
6. Return {
     subtotal: null,           // frontend assembles product prices
     shippingOptions: [...],   // same shape as getShippingEstimate
     estimatedDelivery: string, // from lowest-cost option
     requiresFreight: boolean   // for UX messaging
   }
   Fail-open on API failure
```

---

## `wwex-freight.web.js`

SOAP integration with Worldwide Express SpeedFreight 2.0.
Credentials: `WWEX_USERNAME`, `WWEX_PASSWORD`, `WWEX_ACCOUNT_NUMBER` in Wix Secrets Manager.

```
getLTLRates(originZip, destZip, packages[]):
  - Build SpeedFreight 2.0 SOAP rate request
  - packages[]: each item with weight, dims, freightClass (NMFC)
  - Returns normalized rate array (same shape as UPS response)
  - Fail-open: return [] on SOAP fault (parcel fallback handles UX)
```

NMFC freight class defaults by category if `freightClass` not set in profile:
- futon-frame: class 150
- futon-mattress: class 200
- murphy-bed: class 150
- accessory: class 250

---

## Surface Points

### Product Page (Wix web)
- `#shippingEstimateWidget` — zip input + "Calculate shipping" button
- On submit: calls `getShippingEstimate(productId, zip)`
- Shows all available options with prices + estimated dates
- "Ships from Hendersonville, NC" attribution

### Bundle Builder (Feature 3)
- Calls `calculateBundleQuote(items[], zip)` when bundle is assembled
- Shows estimated shipping as part of the total
- If `requiresFreight: true` — shows "This order ships freight. A carrier will contact you to schedule delivery."

### Mobile Checkout (cfutons_mobile)
- Shows `getShippingEstimate` results in the shipping method selection step
- Exposes all available tiers — customer chooses their preference

### AI Style Consultant (Feature 5)
- `calculateBundleQuote` result feeds into the AI response:
  "Your recommended setup ships to [zip] in 3–5 days for $X (UPS Ground)"

---

## Rate Limiting + Security

- Both webMethods: `Permissions.Anyone`, rate-limited at the IP level
- `getShippingEstimate`: 20 req/min (page loads), `calculateBundleQuote`: 10 req/min (bundle tool)
- Zip validation: reject non-US zips, sanitize input before API calls
- Do NOT expose `_opts` clock injection on either method (standing rule)
- API credentials in Wix Secrets Manager only — never in source

---

## Failure Modes

| Failure | Behavior |
|---------|----------|
| UPS API down | Return fallback estimate array (`isEstimate: true`), never 500 |
| WWEX SOAP fault | Return `[]` for LTL options, show "Contact us for freight quote" |
| Invalid zip | Return `{error: 'invalid_zip', message: '...'}` — never fall through to API |
| Product not in Profiles | Use category default dims — never block the rate call |
| Rate API timeout | Return cached result if available, else fallback |

---

## Implementation Order

1. **`ProductShippingProfiles` CMS collection** — schema + seed data for top 20 products
2. **`shippingIntelligence.web.js`** — UPS path only first (parcel tier complete)
3. **`getShippingEstimate` webMethod** + product page widget (TDD throughout)
4. **`calculateBundleQuote` webMethod** (feeds Bundle Builder)
5. **`wwex-freight.web.js`** — LTL path, SOAP integration, freight tier completes
6. **Mobile checkout** integration (cfutons_mobile)
7. **AI Style Consultant** integration (Feature 5)

---

## Crew Assignment

| Component | Owner |
|-----------|-------|
| `shippingIntelligence.web.js` + `ProductShippingProfiles` CMS | godfrey |
| `wwex-freight.web.js` (SOAP/LTL) | rennala |
| Product page widget (`#shippingEstimateWidget`) | radahn |
| Mobile checkout integration | cfutons_mobile/dallas crew |
| AI Style Consultant wiring (Feature 5) | rennala (backend) |

---

## Not In Scope (v1)

- International shipping (exists separately in `internationalShipping.web.js`)
- Full truckload (TL) — add when order size warrants
- Automated freight class detection from product dims
- Admin UI for managing `ProductShippingProfiles` — staff edits CMS directly in v1
