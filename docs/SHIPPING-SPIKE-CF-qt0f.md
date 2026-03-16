# Spike: Wix Shipping API, Delivery Profiles, and UPS Carrier Configuration

**Date:** 2026-03-15
**Purpose:** Research Wix shipping infrastructure for configuring UPS as a carrier for Carolina Futons furniture shipping.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Delivery Profiles REST API](#2-delivery-profiles-rest-api)
3. [Carrier Configuration (UPS)](#3-carrier-configuration-ups)
4. [Native Rate Tables (Dashboard)](#4-native-rate-tables-dashboard)
5. [Shipping Rates SPI (Velo Service Plugin)](#5-shipping-rates-spi-velo-service-plugin)
6. [SDK / Velo Backend Access](#6-sdk--velo-backend-access)
7. [Recommendations for Carolina Futons](#7-recommendations-for-carolina-futons)
8. [Limitations and Gotchas](#8-limitations-and-gotchas)
9. [Sources](#9-sources)

---

## 1. Architecture Overview

Wix eCommerce shipping has three layers:

```
Layer 1: Delivery Profiles API (REST / SDK)
  - Manages profiles, regions, carriers programmatically
  - Up to 99 profiles per site, 100 regions per profile, 25 carriers per region

Layer 2: Native Dashboard Rate Tables
  - Rate-by-weight, rate-by-product, rate-by-price rules
  - Configured in Dashboard > Shipping, delivery & fulfillment
  - NOT directly exposed via REST API for CRUD of rate rules

Layer 3: Shipping Rates SPI (Service Plugin Interface)
  - Custom shipping rate calculation via Velo backend code
  - getShippingRates() called by Wix at cart/checkout time
  - Full control over rate logic, can call external APIs (e.g., UPS REST API directly)
```

### Data Hierarchy

```
Delivery Profile (up to 99 per site)
  └── Delivery Regions (up to 100 per profile)
      ├── Destinations (up to 250 per region) — country + optional subdivisions
      └── Delivery Carriers (up to 25 per region)
          ├── appId (carrier app GUID)
          ├── backupRate { title, amount, active }
          └── additionalCharges [{ description, amount }]
```

### Default Delivery Profile
- Auto-created when Wix Stores is installed
- Cannot be deleted
- Contains "International" (rest-of-world) region + "Domestic" region (if country is set in site settings)
- Both come with native "Free Shipping" carrier pre-configured
- Products without explicit `deliveryProfileId` assignment use this profile

---

## 2. Delivery Profiles REST API

**Base URL:** `https://www.wixapis.com/ecom/v1/delivery-profiles`
**SDK Package:** `@wix/ecom` namespace `deliveryProfile`

### Complete Endpoint List

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/delivery-profiles` | **Create Delivery Profile** |
| `GET` | `/delivery-profiles/{id}` | **Get Delivery Profile** |
| `PATCH` | `/delivery-profiles/{id}` | **Update Delivery Profile** |
| `DELETE` | `/delivery-profiles/{id}` | **Delete Delivery Profile** |
| `POST` | `/delivery-profiles/query` | **Query Delivery Profiles** |
| `POST` | `/delivery-profiles/add-delivery-region` | **Add Delivery Region** |
| `POST` | `/delivery-profiles/update-delivery-region` | **Update Delivery Region** |
| `POST` | `/delivery-profiles/remove-delivery-region` | **Remove Delivery Region** |
| `POST` | `/delivery-profiles/add-delivery-carrier` | **Add Delivery Carrier** |
| `PATCH` | `/delivery-profiles/update-delivery-carrier` | **Update Delivery Carrier** |
| `POST` | `/delivery-profiles/remove-delivery-carrier` | **Remove Delivery Carrier** |
| `POST` | `/delivery-profiles/set-delivery-carrier-active-status` | **Set Carrier Active Status** |
| `GET` | `/delivery-profiles/installed-carriers` | **List Installed Delivery Carriers** |
| `POST` | `/delivery-profiles/{id}/delivery-carriers` | **List Delivery Carriers** (detailed settings) |
| `GET` | `/delivery-profiles/delivery-destination-properties` | **Get Delivery Destination Properties** |
| `GET` | `/delivery-profiles/by-region/{regionId}` | **Get Profile By Region ID** |
| `PATCH` | `/delivery-profiles/update-extended-fields` | **Update Extended Fields** |

### Webhooks / Domain Events

- `Delivery Profile Created`
- `Delivery Profile Updated`
- `Delivery Profile Deleted`
- `Delivery Profile Region Added`
- `Delivery Profile Region Removed`
- `Delivery Profile Region Updated`

### Key Permissions

| Action | Permission |
|--------|-----------|
| Read profiles | `ECOM.DELIVERY_PROFILE_READ` |
| Create profiles | `ECOM.DELIVERY_PROFILE_CREATE` |
| Add carrier | `ECOM.DELIVERY_CARRIER_ADD` |
| Update carrier | `ECOM.DELIVERY_CARRIER_UPDATE` |
| Read carriers | `ECOM.DELIVERY_CARRIER_READ` |

### Create Delivery Profile — Request Schema

```json
POST https://www.wixapis.com/ecom/v1/delivery-profiles

{
  "deliveryProfile": {
    "name": "Furniture Shipping",              // required
    "deliveryRegions": [
      {
        "name": "Domestic",                    // required
        "active": true,                        // default: true
        "destinations": [
          {
            "countryCode": "US",               // required, ISO-3166 alpha-2
            "subdivisions": ["US-CA", "US-NY"] // optional, ISO 3166-2
          }
        ]
      }
    ]
  }
}
```

**Response** includes the full `DeliveryProfile` object with generated `id`, `revision`, `createdDate`, `updatedDate`.

### Add Delivery Carrier — Request Schema

```json
POST https://www.wixapis.com/ecom/v1/delivery-profiles/add-delivery-carrier

{
  "deliveryRegionId": "<DELIVERY_REGION_ID>",
  "deliveryCarrier": {
    "appId": "<CARRIER_APP_ID>",
    "backupRate": {
      "title": "Standard Furniture Shipping",
      "amount": "149.99",                      // required
      "active": true                           // default: false
    },
    "additionalCharges": [
      {
        "description": "Oversized item handling fee",
        "amount": "25.00"
      }
    ]
  }
}
```

**Error codes:**
- `DELIVERY_CARRIER_MISSING_BACKUP_RATE` — backup rate required but not provided
- `UNKNOWN_DELIVERY_CARRIER` — appId does not exist on site
- `CARRIER_ALREADY_EXISTS_IN_REGION` — carrier already assigned

### List Installed Delivery Carriers — Response Schema

```json
GET https://www.wixapis.com/ecom/v1/delivery-profiles/installed-carriers

// Response:
{
  "installedDeliveryCarriers": [
    {
      "id": "<APP_GUID>",                        // This is the appId to use
      "displayName": "UPS Shipping Rates",
      "description": "...",
      "learnMoreUrl": "...",
      "dashboardUrl": "...",
      "fallbackDefinitionMandatory": true,       // Must provide backup rate
      "thumbnailUrl": "...",
      "toggleGetCarrierSettingsEnabled": true
    }
  ]
}
```

### List Delivery Carriers (Detailed) — Response Schema

Returns `dashboardTables` with rate table configuration:

```json
{
  "results": [
    {
      "deliveryCarrierMetadata": { "id": "...", "success": true },
      "deliveryCarrierDetails": {
        "id": "<APP_GUID>",
        "displayName": "UPS Shipping Rates",
        "fallbackDefinitionMandatory": true
      },
      "deliveryCarrierRegionalSettings": [
        {
          "deliveryRegionId": "<REGION_ID>",
          "dashboardTables": [
            {
              "title": "UPS Ground",
              "columns": [
                { "key": "service", "name": "Service" },
                { "key": "rate", "name": "Rate" }
              ],
              "rows": [
                {
                  "key": "<ROW_ID>",
                  "data": { "service": "Ground", "rate": "$12.50" },
                  "active": true
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

### Set Delivery Carrier Active Status

Used to enable/disable specific shipping service rows in a carrier's rate table:

```json
POST https://www.wixapis.com/ecom/v1/delivery-profiles/set-delivery-carrier-active-status

// SDK: wixClient.ecom.deliveryProfile.setDeliveryCarrierActiveStatus(carrierAppId, {
//   rowId: "<ROW_KEY from dashboardTables>",
//   active: true
// })
```

---

## 3. Carrier Configuration (UPS)

### Option A: Third-Party UPS App (Wix App Market)

**App:** "UPS Shipping Rates" by Pavel Web Design LLC
- **Cost:** $4.00/month (yearly billing), 10-day free trial
- **Rating:** 4.0 stars
- **Features:**
  - Live UPS shipping rates via UPS REST API
  - Configurable box sizes
  - Markup/discount adjustments
  - Negotiated UPS account rates support
  - Does NOT print shipping labels
- **Setup:**
  1. Install from Wix App Market
  2. Configure in dashboard: Apps > UPS Rates > Open Dashboard
  3. Set preferred box sizes, markup/discount
  4. Enable per-region in Shipping, delivery & fulfillment settings
  5. Set backup rate for each region (required)

**Alternative UPS App:** "UPS Shipping & Label Printing"
- Supports most currencies
- Includes label printing capability
- Real-time rate calculations

### Option B: Custom Velo SPI (Direct UPS API Integration)

Build a custom shipping rates service plugin that calls the UPS REST API directly. See Section 5.

### Option C: Third-Party Aggregator Apps

- **Shippo** — multi-carrier (most currencies)
- **ShipStation** — multi-carrier (USD only)
- **Easyship** — multi-carrier (most currencies)
- **Shiptheory** — multi-carrier (many currencies)

### Setup Flow for Any Third-Party Carrier App

1. Install the app from Wix App Market
2. Configure the app's own dashboard settings
3. Go to Dashboard > Shipping, delivery & fulfillment
4. For each region, enable the app toggle
5. Enter a backup rate name + amount (mandatory — used when real-time rates unavailable)
6. Save

**Important:** You must enable the app in EACH region individually where you want customers to see it.

### 2025-2026 UPS Rate Changes (Relevant to Furniture)

- UPS implemented 5.9% rate increase effective Dec 22, 2025
- Actual cost increases reach 8-12% with expanded surcharges
- **New cubic volume thresholds:** packages exceeding 10,368 cubic inches trigger Additional Handling Charges (changed from traditional "length + girth" calculation, effective Jan 26, 2026)
- This is highly relevant for furniture items

---

## 4. Native Rate Tables (Dashboard)

Wix provides three native rate table types configured via dashboard only (NOT directly manageable via REST API for the rate rules themselves):

### Rate by Weight
- Set shipping cost tiers based on total cart weight
- Up to **30 weight ranges** per rule
- Each range: min weight, max weight, price
- Optional free shipping threshold (by purchase amount)
- Optional handling fees (via More Actions menu)
- **Prerequisite:** Products must have shipping weights assigned

Example:
```
0-50 lbs:   $15.00
50-100 lbs: $35.00
100-200 lbs: $75.00
200+ lbs:   $149.00
```

### Rate by Product
- Create product groups (e.g., "Futons", "Frames", "Accessories")
- Assign specific shipping rates per group
- Different rates for different product categories

### Rate by Price
- Shipping cost tiers based on cart total
- Common for "free shipping over $X" scenarios

### Native Carriers (Built-in, No App Install Needed)
- **Free Shipping** — pre-configured with default profile
- **Flat Rate** — single fixed rate
- **Rate by Weight** — weight-based tiers
- **Rate by Product** — product-group-based rates
- **Rate by Price** — price-tier-based rates

### Limitations of Native Rate Tables
- Rate rules (weight ranges, product groups, price tiers) are configured ONLY through the Wix dashboard UI
- The Delivery Profiles API manages profiles, regions, and carrier assignments but does NOT create/edit the individual rate rules within native carriers
- For programmatic rate table management, use the Shipping Rates SPI instead

---

## 5. Shipping Rates SPI (Velo Service Plugin)

This is the most powerful option for custom shipping logic. It allows you to implement arbitrary shipping rate calculations in Velo backend code.

### Overview

- Wix calls your `getShippingRates()` function during cart/checkout
- Responses are **cached for 10 minutes** (cache refreshes when options change)
- **10-second timeout** — function must respond within 10 seconds or the call fails
- Rates appear alongside any other configured shipping options

### File Structure (Wix Studio)

```
src/backend/spi/
  └── <plugin-name>/
      ├── <plugin-name>.js          // getShippingRates() implementation
      └── <plugin-name>-config.js   // getConfig() metadata
```

### File Structure (Wix Editor)

Created in the Service Plugins section of the Code sidebar.

### Setup Steps

1. Add Wix Stores app to your site
2. Enable Velo coding (Dev Mode for Editor; Code button for Studio)
3. Navigate to Service Plugins section
4. Select "Shipping Rates" and provide a name (no spaces/special characters)
5. Implement `getShippingRates()` and `getConfig()`
6. Publish your site
7. Navigate to Dashboard > Shipping & Fulfillment settings
8. Toggle plugin under "Installed Apps" for each region
9. Save

### getShippingRates() — Full Signature

```javascript
/**
 * @param {Options} options
 * @param {Context} context
 * @returns {Promise<ShippingRates>}
 */
export const getShippingRates = async (options, context) => {
  // options.lineItems — array of products being shipped
  // options.shippingDestination — customer's shipping address
  // options.shippingOrigin — business address from site settings
  // options.buyerContactDetails — customer contact info
  // options.weightUnit — "KG" or "LB"

  return {
    shippingRates: [
      {
        code: "ups_ground_furniture",
        title: "UPS Ground - Furniture Delivery",
        logistics: {
          deliveryTime: "5-10 business days",
          instructions: "White glove delivery available upon request"
        },
        cost: {
          price: "149.99",
          currency: "USD",       // MUST match site currency
          additionalCharges: [
            {
              type: "HANDLING_FEE",
              details: "Oversized furniture handling surcharge",
              price: "25.00"
            }
          ]
        }
      }
    ]
  };
};
```

### options.lineItems[] — Line Item Structure

```javascript
{
  name: "Carolina Futon Frame",
  quantity: 1,
  catalogReference: {
    catalogItemId: "<PRODUCT_GUID>",
    appId: "215238eb-22a5-4c36-9e7b-e7c08025e04e",  // Wix Stores appId (constant)
    options: { /* variant options */ }
  },
  physicalProperties: {
    weight: 85.5,          // in weightUnit
    sku: "CF-FRAME-001",
    shippable: true
  },
  price: "299.99",
  totalPrice: "299.99",
  priceBeforeDiscount: "349.99",
  totalPriceBeforeDiscount: "349.99",
  taxIncludedInPrice: false
}
```

### options.shippingDestination — Address Structure

```javascript
{
  addressLine: "123 Main St",   // OR streetAddress: { number, name }
  addressLine2: "Apt 4B",
  city: "Los Angeles",
  subdivision: "CA",            // state/province code
  country: "US",                // ISO-3166 alpha-2
  postalCode: "90001"
}
```

### getConfig() — Configuration Function

```javascript
// <plugin-name>-config.js
export const getConfig = () => {
  return {
    name: "Carolina Futons Shipping",
    description: "Custom furniture shipping rates for Carolina Futons"
  };
};
```

### Error Handling

The SPI supports structured error codes:

| Error Code | When to Throw |
|-----------|---------------|
| `GENERIC_ERROR` | Catch-all for unrecoverable errors |
| `PARTIAL_ADDRESS` | Address fields are missing/invalid (prompts user for more info) |
| `INVALID_POSTAL_CODE` | Postal code is invalid |
| `MISSING_POSTAL_CODE` | Postal code not provided |

### Example: Furniture Shipping with UPS API Integration

```javascript
// src/backend/spi/furnitureShipping/furnitureShipping.js
import { fetch } from 'wix-fetch';
import { getSecret } from 'wix-secrets-backend';
import wixData from 'wix-data';

export const getShippingRates = async (options, context) => {
  const { lineItems, shippingDestination, shippingOrigin, weightUnit } = options;

  // 1. Calculate total weight and check for oversized items
  let totalWeight = 0;
  let hasOversizedItem = false;

  for (const item of lineItems) {
    if (item.physicalProperties?.shippable) {
      totalWeight += (item.physicalProperties.weight || 0) * item.quantity;
      // Look up dimensions from a custom collection
      const dims = await wixData.query("ProductDimensions")
        .eq("sku", item.physicalProperties.sku)
        .find();
      if (dims.items.length > 0) {
        const { length, width, height } = dims.items[0];
        if (length * width * height > 10368) {
          hasOversizedItem = true;
        }
      }
    }
  }

  // 2. Call UPS REST API for live rates
  const upsApiKey = await getSecret("UPS_API_KEY");
  const rates = await getUPSRates({
    apiKey: upsApiKey,
    origin: shippingOrigin,
    destination: shippingDestination,
    weight: totalWeight,
    weightUnit,
    oversized: hasOversizedItem
  });

  // 3. Return formatted rates
  return {
    shippingRates: rates.map(rate => ({
      code: `ups_${rate.serviceCode}`,
      title: rate.serviceName,
      logistics: {
        deliveryTime: rate.estimatedDays
      },
      cost: {
        price: rate.totalPrice.toFixed(2),
        currency: "USD",
        additionalCharges: hasOversizedItem ? [{
          type: "HANDLING_FEE",
          details: "Furniture oversized handling",
          price: "35.00"
        }] : []
      }
    }))
  };
};
```

---

## 6. SDK / Velo Backend Access

### Package: `@wix/ecom`, Namespace: `deliveryProfile`

Available methods (mirror the REST API):

```javascript
import { deliveryProfile } from '@wix/ecom';

// CRUD operations
await deliveryProfile.createDeliveryProfile({ name: "...", deliveryRegions: [...] });
await deliveryProfile.getDeliveryProfile(deliveryProfileId);
await deliveryProfile.updateDeliveryProfile(deliveryProfileId, { ... });
await deliveryProfile.deleteDeliveryProfile(deliveryProfileId);
await deliveryProfile.queryDeliveryProfiles();

// Region management
await deliveryProfile.addDeliveryRegion(deliveryProfileId, { deliveryRegion: {...} });
await deliveryProfile.updateDeliveryRegion(deliveryRegionId, { ... });
await deliveryProfile.removeDeliveryRegion(deliveryRegionId);

// Carrier management
await deliveryProfile.addDeliveryCarrier(deliveryRegionId, { deliveryCarrier: {...} });
await deliveryProfile.updateDeliveryCarrier(deliveryRegionId, { deliveryCarrier: {...} });
await deliveryProfile.removeDeliveryCarrier(deliveryRegionId, { appId: "..." });
await deliveryProfile.setDeliveryCarrierActiveStatus(carrierAppId, { rowId, active });

// Discovery
await deliveryProfile.listInstalledDeliveryCarriers();
await deliveryProfile.listDeliveryCarriers(deliveryProfileId, { appIds: [...] });
```

### Assigning Products to Delivery Profiles

Products are assigned to delivery profiles via the Products API using the `deliveryProfileId` field. Products without an explicit assignment use the default delivery profile.

---

## 7. Recommendations for Carolina Futons

### Strategy: Hybrid Approach

For furniture shipping, a combination of approaches is recommended:

#### Tier 1: Custom Velo SPI (Primary — Recommended)

Build a `getShippingRates()` SPI that:
- Looks up product dimensions from a custom CMS collection (by SKU)
- Calculates dimensional weight vs actual weight
- Applies zone-based rate tables stored in a CMS collection
- Adds furniture handling surcharges for oversized items
- Optionally calls UPS REST API for live rates (with fallback to table rates)

**Advantages:**
- Full control over rate logic
- Can implement LTL freight rates for very heavy items (futon frames, mattresses)
- Can show different options: "Standard Delivery" vs "White Glove Delivery"
- Can incorporate product dimensions (not just weight)
- Cached for 10 minutes (acceptable for rate tables that don't change often)

#### Tier 2: Delivery Profiles for Product Segregation

Create separate delivery profiles:
- **"Furniture Shipping"** — for futon frames, mattresses, large items
- **"Accessory Shipping"** — for covers, pillows, small accessories
- Assign products to appropriate profiles via `deliveryProfileId` in Products API

#### Tier 3: UPS App Market App (Optional Supplement)

If live UPS rates are desired without custom code:
- Install "UPS Shipping Rates" ($4/month) or "UPS Shipping & Label Printing"
- Configure box sizes for furniture dimensions
- Set appropriate backup rates ($149+ for furniture)
- Enable per-region

### Data Model for Custom Rate Tables (CMS Collections)

```
Collection: ShippingZones
  - zoneId (text)
  - zoneName (text)
  - states (tags/multi-ref) — list of state codes

Collection: ShippingRates
  - zoneId (reference to ShippingZones)
  - productCategory (text) — "futon-frame", "mattress", "cover", "accessory"
  - minWeight (number)
  - maxWeight (number)
  - baseRate (number)
  - perPoundRate (number)
  - handlingFee (number)
  - deliveryTimeEstimate (text)

Collection: ProductDimensions
  - sku (text)
  - length (number) — inches
  - width (number) — inches
  - height (number) — inches
  - actualWeight (number) — lbs
  - productCategory (text)
```

---

## 8. Limitations and Gotchas

1. **Native rate tables (weight/product/price) are dashboard-only** — no REST API to CRUD individual rate rules within them. The Delivery Profiles API only manages profile/region/carrier assignments.

2. **SPI 10-second timeout** — if calling external APIs (UPS), must be fast. Consider caching UPS rates in a CMS collection and refreshing periodically rather than calling live on every request.

3. **SPI response cached 10 minutes** — rate changes won't reflect until cache expires or cart properties change.

4. **Currency must match** — shipping rate currency in SPI response MUST match the site's configured currency.

5. **Backup rates are mandatory** for most third-party carrier apps. If real-time rates are unavailable and no backup is configured, customers cannot complete checkout.

6. **250 destination limit** across all delivery profiles (total, not per-profile).

7. **Product weight must be set** on each product/variant for weight-based shipping to work. This is set in the product editor, not via the Shipping API.

8. **UPS Additional Handling surcharges** (2026): packages over 10,368 cubic inches trigger extra fees. Furniture items will almost certainly hit this threshold.

9. **LTL Freight** is NOT natively supported by any Wix carrier app. For truly large furniture shipments requiring freight, the custom SPI approach is the only viable option.

10. **Do NOT call** `estimateCartTotals`, `estimateCurrentCartTotals`, or `getCheckout` from within `getShippingRates()` — this causes infinite recursion errors.

11. **Per-region carrier enablement** — when using third-party carrier apps, you must enable them in EACH delivery region individually in the dashboard.

---

## 9. Sources

### Official Wix API Documentation
- [Delivery Profiles API Introduction](https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/shipping-delivery/delivery-profiles/introduction)
- [Delivery Profiles Sample Flows](https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/shipping-delivery/delivery-profiles/sample-flows)
- [Create Delivery Profile](https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/shipping-delivery/delivery-profiles/create-delivery-profile)
- [Add Delivery Carrier](https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/shipping-delivery/delivery-profiles/add-delivery-carrier)
- [Update Delivery Carrier](https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/shipping-delivery/delivery-profiles/update-delivery-carrier)
- [List Installed Delivery Carriers](https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/shipping-delivery/delivery-profiles/list-installed-delivery-carriers)
- [List Delivery Carriers (detailed)](https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/shipping-delivery/delivery-profiles/list-delivery-carriers)
- [Set Delivery Carrier Active Status](https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/shipping-delivery/delivery-profiles/set-delivery-carrier-active-status)

### Shipping Rates SPI
- [Shipping Rates SPI Introduction (REST)](https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/extensions/shipping-rates/shipping-rates-integration-service-plugin/introduction)
- [Get Shipping Rates Method Schema](https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/extensions/shipping-rates/shipping-rates-integration-service-plugin/get-shipping-rates)
- [Velo SPI: Ecom Shipping Rates Introduction](https://dev.wix.com/docs/velo/events-service-plugins/e-commerce/service-plugins/ecom-shipping-rates/introduction)
- [Velo SPI: getShippingRates()](https://dev.wix.com/docs/velo/events-service-plugins/e-commerce/service-plugins/ecom-shipping-rates/get-shipping-rates)
- [Velo Tutorial: eCommerce Shipping Rates Service Plugin](https://dev.wix.com/docs/develop-websites/articles/code-tutorials/wix-e-commerce-stores/e-commerce-shipping-rates-service-plugin)
- [Shipping Rates SPI Sample Flow](https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/extensions/shipping-rates/shipping-rates-integration-service-plugin/sample-flow)

### Wix Help Center
- [Offering Real Time Shipping Rates via Third-Party Apps](https://support.wix.com/en/article/wix-stores-offering-real-time-shipping-rates-via-third-party-apps)
- [Setting Up a Rate by Weight Shipping Rule](https://support.wix.com/en/article/wix-stores-setting-up-a-rate-by-weight-shipping-rule)
- [Setting Up Shipping Rate By Product](https://support.wix.com/en/article/wix-stores-setting-up-shipping-rate-by-product)
- [Backup Shipping Rates for Real Time Calculations](https://support.wix.com/en/article/wix-stores-backup-shipping-rates-for-real-time-shipping-calculations-with-usps)

### Wix App Market
- [UPS Shipping Rates App](https://www.wix.com/app-market/web-solution/ups-rates) — $4/month, by Pavel Web Design LLC

### Third-Party Resources
- [Wix Shipping Overview (ParcelPath)](https://parcelpath.com/wix-shipping/)
- [Wix Shipping Calculator Guide (ParcelPath)](https://parcelpath.com/wix-shipping-calculator/)
