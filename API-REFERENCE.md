# Carolina Futons - API Reference

All backend web methods are defined in `src/backend/*.web.js` files. They are
callable from frontend page code via standard ES module imports.

## Usage Pattern

```js
// In any page file:
import { functionName } from 'backend/moduleName.web';
const result = await functionName(arg1, arg2);
```

---

## analyticsHelpers.web.js

Product engagement tracking for analytics and "popular products" features.
All methods write to the `ProductAnalytics` CMS collection.

### `trackProductView(productId, productName, category)`

Track a product page view. Creates or updates the analytics record.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `productId` | `string` | Yes | Wix product `_id` |
| `productName` | `string` | Yes | Product display name |
| `category` | `string` | Yes | Product category slug |

- **Permission**: `Anyone`
- **Returns**: `void` (fire-and-forget, errors are logged but not thrown)
- **Side effects**: Inserts or updates `ProductAnalytics` collection record

### `trackAddToCart(productId)`

Track an add-to-cart event. Increments the `addToCartCount` field.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `productId` | `string` | Yes | Wix product `_id` |

- **Permission**: `Anyone`
- **Returns**: `void`
- **Side effects**: Updates `ProductAnalytics.addToCartCount`

### `getMostViewedProducts(limit?)`

Get the most-viewed products across all time for "Popular Products" sections.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | `number` | No | `8` | Max products to return |

- **Permission**: `Anyone`
- **Returns**: `Array<ProductSummary>` — sorted by `viewCount` descending

```js
// ProductSummary shape:
{
  _id: string,
  name: string,
  slug: string,
  price: number,
  formattedPrice: string,
  mainMedia: string,  // Image URL
  viewCount: number,
}
```

### `getTrendingProducts(limit?)`

Get products trending in the last 7 days (most views with recent activity).

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | `number` | No | `6` | Max products to return |

- **Permission**: `Anyone`
- **Returns**: `Array<ProductSummary>` (without `viewCount`)

---

## emailService.web.js

Email functionality for contact form submissions and order notifications.
Uses Wix Triggered Emails and saves records to CMS.

### `sendEmail({ name, email, phone, subject, message })`

Send a contact form submission to the store owner via triggered email.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `string` | Yes | Customer's name |
| `email` | `string` | Yes | Customer's email |
| `phone` | `string` | No | Customer's phone |
| `subject` | `string` | No | Message subject |
| `message` | `string` | Yes | Message body |

- **Permission**: `Anyone`
- **Returns**: `{ success: true }`
- **Throws**: `Error` with user-facing message on failure
- **Side effects**:
  - Sends `contact_form_submission` triggered email to site owner
  - Inserts record into `ContactSubmissions` collection
- **Secrets required**: `SITE_OWNER_CONTACT_ID`
- **Wix setup**: Triggered email template `contact_form_submission` must exist

### `sendOrderNotification(orderDetails)`

Send a new order notification to the store owner.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `orderDetails` | `object` | Yes | Order data object |
| `orderDetails.number` | `string` | Yes | Order number |
| `orderDetails.buyerName` | `string` | Yes | Customer name |
| `orderDetails.total` | `string` | Yes | Order total (formatted) |
| `orderDetails.lineItems` | `Array` | No | Line items array |

- **Permission**: `Anyone`
- **Returns**: `{ success: boolean }`
- **Secrets required**: `SITE_OWNER_CONTACT_ID`
- **Wix setup**: Triggered email template `new_order_notification` must exist

---

## fulfillment.web.js

Order fulfillment workflow: pending orders, UPS shipment creation, tracking
updates, and fulfillment history. Requires `SiteMember` permission for most
operations (admin-only).

### `getPendingOrders(limit?)`

Get orders that are paid but not yet shipped.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | `number` | No | `50` | Max orders to return |

- **Permission**: `SiteMember`
- **Returns**: `Array<PendingOrder>`

```js
// PendingOrder shape:
{
  _id: string,
  number: string,
  createdDate: Date,
  buyerName: string,
  buyerEmail: string,
  shippingAddress: object,
  lineItems: Array<{ name, quantity, sku, price, weight }>,
  subtotal: number,
  shipping: number,
  total: number,
  fulfillmentStatus: string,  // 'NOT_FULFILLED'
  shippingMethod: string,
  buyerNote: string,
}
```

### `fulfillOrder(orderId, packageDetails)`

Create a UPS shipment for an order and save tracking info.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `orderId` | `string` | Yes | Wix order `_id` |
| `packageDetails` | `object` | Yes | Packaging configuration |
| `packageDetails.serviceCode` | `string` | No | UPS service code (default: `'03'` Ground) |
| `packageDetails.packages` | `Array` | No | Package dimensions array |
| `packageDetails.totalWeight` | `number` | No | Total weight in lbs |

- **Permission**: `SiteMember`
- **Returns**: `{ success, trackingNumber, labels, shippingCost }` or `{ success: false, error }`
- **Side effects**:
  - Creates UPS shipment via API
  - Inserts record into `Fulfillments` collection

### `getTrackingUpdate(trackingNumber)`

Get current tracking status for a shipment.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `trackingNumber` | `string` | Yes | UPS tracking number |

- **Permission**: `Anyone`
- **Returns**: UPS tracking response (see `trackShipment` in ups-shipping)
- **Side effects**: Updates `Fulfillments` record with latest status

### `updateAllTracking()`

Batch update tracking for all active (non-delivered, non-returned) shipments.

- **Permission**: `SiteMember`
- **Returns**: `{ success: boolean, updated: number }`

### `getFulfillmentHistory(limit?)`

Get historical fulfillment records.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | `number` | No | `100` | Max records to return |

- **Permission**: `SiteMember`
- **Returns**: `Array<FulfillmentRecord>` — sorted by `createdDate` descending

---

## productRecommendations.web.js

Product recommendation engine powering cross-sell, featured products, and
intelligent "Complete Your Futon" bundling suggestions.

### `getRelatedProducts(productId, categorySlug, limit?)`

Get cross-category product recommendations for a product page.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `productId` | `string` | Yes | — | Current product `_id` (excluded from results) |
| `categorySlug` | `string` | Yes | — | Current product's category slug |
| `limit` | `number` | No | `4` | Max products to return |

- **Permission**: `Anyone`
- **Returns**: `Array<ProductSummary>`
- **Cross-sell logic**:
  - `futon-frames` → suggests mattresses, casegoods
  - `mattresses` → suggests futon frames
  - `murphy-cabinet-beds` → suggests casegoods, platform beds
  - `platform-beds` → suggests casegoods, mattresses
  - `casegoods-accessories` → suggests platform beds, futon frames

### `getCompletionSuggestions(cartProductIds)`

Analyze cart contents and suggest complementary products. Powers "Complete Your
Futon" sections in cart and side cart.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `cartProductIds` | `Array<string>` | Yes | Product IDs currently in cart |

- **Permission**: `Anyone`
- **Returns**: `Array<SuggestionGroup>`

```js
// SuggestionGroup shape:
{
  heading: string,    // e.g., "Complete Your Futon — Add a Mattress"
  products: Array<ProductSummary>,
}
```

- **Bundle logic**:
  - Has frame, no mattress → suggest mattresses
  - Has mattress, no frame → suggest frames
  - Has Murphy bed, no casegoods → suggest casegoods
  - Has platform bed, no casegoods → suggest casegoods
  - No match → suggest newest products as fallback

### `getSameCollection(productId, collections, limit?)`

Get products from the same collection/brand family.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `productId` | `string` | Yes | — | Current product `_id` (excluded) |
| `collections` | `Array<string>` | Yes | — | Collection slugs to match |
| `limit` | `number` | No | `6` | Max products to return |

- **Permission**: `Anyone`
- **Returns**: `Array<ProductSummary>`

### `getFeaturedProducts(limit?)`

Get featured/bestselling products for the homepage.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | `number` | No | `8` | Max products to return |

- **Permission**: `Anyone`
- **Returns**: `Array<ProductSummary>`
- **Logic**: Products with `ribbon === 'Featured'`, falling back to newest products

### `getSaleProducts(limit?)`

Get products currently on sale (with discount > 0).

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | `number` | No | `12` | Max products to return |

- **Permission**: `Anyone`
- **Returns**: `Array<ProductSummary>` — sorted by discount descending

---

## seoHelpers.web.js

SEO utilities for generating JSON-LD structured data, breadcrumb schemas,
FAQ schemas, and SEO-optimized alt text for product images.

### `getProductSchema(product)`

Generate JSON-LD `Product` schema for a product page.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `product` | `object` | Yes | Wix product object |

- **Permission**: `Anyone`
- **Returns**: `string | null` — JSON-LD string for injection into `HtmlComponent`
- **Schema type**: `schema.org/Product` with `Offer`, optional `AggregateRating`

### `getBusinessSchema()`

Generate JSON-LD `FurnitureStore` schema for local business SEO.

- **Permission**: `Anyone`
- **Returns**: `string` — JSON-LD string
- **Schema type**: `schema.org/FurnitureStore` with address, hours, geo coordinates
- **Usage**: Injected on every page via `masterPage.js`

### `getBreadcrumbSchema(breadcrumbs)`

Generate JSON-LD `BreadcrumbList` schema.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `breadcrumbs` | `Array<{ name, url }>` | Yes | Breadcrumb trail items |

- **Permission**: `Anyone`
- **Returns**: `string | null` — JSON-LD string

### `getFaqSchema(faqs)`

Generate JSON-LD `FAQPage` schema for rich results.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `faqs` | `Array<{ question, answer }>` | Yes | FAQ entries |

- **Permission**: `Anyone`
- **Returns**: `string | null` — JSON-LD string

### `generateAltText(product, imageType?)`

Generate SEO-optimized alt text for product images.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `product` | `object` | Yes | — | Product data object |
| `imageType` | `string` | No | `'main'` | One of: `'main'`, `'lifestyle'`, `'detail'`, `'open'` |

- **Permission**: `Anyone`
- **Returns**: `string` — descriptive alt text including brand, finish, and location

---

## ups-shipping.web.js

UPS REST API integration handling OAuth 2.0 authentication, rate calculation,
shipment creation with label generation, package tracking, and address validation.

### `getUPSRates(destinationAddress, packages, orderSubtotal?)`

Get live shipping rates from UPS for given destination and packages.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `destinationAddress` | `object` | Yes | — | Destination address |
| `destinationAddress.name` | `string` | No | — | Recipient name |
| `destinationAddress.addressLine1` | `string` | Yes | — | Street address |
| `destinationAddress.city` | `string` | Yes | — | City |
| `destinationAddress.state` | `string` | Yes | — | State code |
| `destinationAddress.postalCode` | `string` | Yes | — | ZIP code |
| `destinationAddress.country` | `string` | No | `'US'` | Country code |
| `packages` | `Array<PackageSpec>` | Yes | — | Package dimensions/weights |
| `orderSubtotal` | `number` | No | `0` | Order subtotal for free shipping check |

- **Permission**: `Anyone`
- **Returns**: `Array<ShippingRate>` — sorted by cost ascending

```js
// ShippingRate shape:
{
  code: string,            // e.g., 'ups-03' or 'free-ground'
  title: string,           // e.g., 'UPS Ground'
  cost: number,            // Dollar amount
  estimatedDelivery: string,
  currency: string,        // 'USD'
  guaranteedDays: string | null,
}
```

- **Gotcha**: Returns free shipping rate immediately if `orderSubtotal >= $999`
- **Fallback**: Returns estimated flat rates if UPS API fails (regional pricing)

### `createShipment(orderData)`

Create a UPS shipment and generate a shipping label (PDF).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `orderData.orderId` | `string` | Yes | Order reference ID |
| `orderData.recipientName` | `string` | Yes | Recipient full name |
| `orderData.recipientPhone` | `string` | No | Recipient phone |
| `orderData.addressLine1` | `string` | Yes | Street address |
| `orderData.addressLine2` | `string` | No | Address line 2 |
| `orderData.city` | `string` | Yes | City |
| `orderData.state` | `string` | Yes | State code |
| `orderData.postalCode` | `string` | Yes | ZIP code |
| `orderData.country` | `string` | No | Country code (default: `'US'`) |
| `orderData.serviceCode` | `string` | No | UPS service code (default: `'03'` Ground) |
| `orderData.packages` | `Array` | Yes | Package specs with length, width, height, weight |

- **Permission**: `SiteMember`
- **Returns**: `{ success, trackingNumber, labels, totalCharge, currency, billingWeight }`
- **Labels**: Array of `{ trackingNumber, labelBase64, labelFormat: 'PDF' }`

### `trackShipment(trackingNumber)`

Track a package by UPS tracking number.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `trackingNumber` | `string` | Yes | UPS tracking number |

- **Permission**: `Anyone`
- **Returns**: `{ success, trackingNumber, status, statusCode, estimatedDelivery, activities }`

### `validateAddress(address)`

Validate a shipping address with UPS Address Validation API.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `address.addressLine1` | `string` | Yes | Street address |
| `address.city` | `string` | Yes | City |
| `address.state` | `string` | Yes | State code |
| `address.postalCode` | `string` | Yes | ZIP code |
| `address.country` | `string` | No | Country code (default: `'US'`) |

- **Permission**: `Anyone`
- **Returns**: `{ valid: boolean, ambiguous?: boolean, candidates?: Array }`
- **Gotcha**: Defaults to `{ valid: true }` on API errors to avoid blocking checkout

### `getPackageDimensions(category)`

Get default package dimensions for a product category.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `category` | `string` | Yes | Category key (see table below) |

- **Permission**: `Anyone`
- **Returns**: `{ length, width, height, weight }` (inches, lbs)

| Category | Length | Width | Height | Weight |
|----------|--------|-------|--------|--------|
| `futon-frame` | 80 | 40 | 12 | 85 |
| `futon-mattress` | 78 | 54 | 14 | 55 |
| `murphy-bed` | 82 | 60 | 20 | 150 |
| `platform-bed` | 80 | 42 | 8 | 70 |
| `casegoods` | 36 | 20 | 36 | 45 |
| `accessory` | 24 | 18 | 12 | 15 |
| `default` | 48 | 30 | 12 | 50 |

---

## orderTracking.web.js

Customer-facing order tracking. Allows customers to look up orders by order
number + email, view UPS tracking status with timeline, and manage shipping
notification preferences.

### `lookupOrder(orderNumber, email)`

Look up an order by order number and buyer email. Returns order details,
shipping status, UPS tracking activities, delivery timeline, and line items.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `orderNumber` | `string` | Yes | Order number |
| `email` | `string` | Yes | Buyer's email for verification |

- **Permission**: `Anyone`
- **Returns**: `{ success, order, shipping, tracking, timeline, lineItems, totals, notificationsEnabled }`
- **Security**: Email must match order's `buyerInfo.email`

### `subscribeToNotifications(orderNumber, email)`

Opt in to email notifications for shipment updates.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `orderNumber` | `string` | Yes | Order number |
| `email` | `string` | Yes | Buyer's email |

- **Permission**: `Anyone`
- **Returns**: `{ success, alreadySubscribed }`
- **Side effects**: Inserts/updates `TrackingNotifications` collection

### `unsubscribeFromNotifications(orderNumber, email)`

Opt out of email notifications for shipment updates.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `orderNumber` | `string` | Yes | Order number |
| `email` | `string` | Yes | Buyer's email |

- **Permission**: `Anyone`
- **Returns**: `{ success }`

### `getTrackingTimeline(trackingNumber)`

Get current tracking timeline without full order lookup. Used for auto-refresh.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `trackingNumber` | `string` | Yes | UPS tracking number |

- **Permission**: `Anyone`
- **Returns**: `{ success, status, statusCode, fulfillmentStatus, statusLabel, estimatedDelivery, activities, timeline }`

---

## shipping-rates-plugin.js

**Wix eCommerce Service Plugin** — NOT a web module. This file is registered
with Wix as a shipping rates provider and is called automatically during checkout.

### `getShippingRates(options)` (Wix SPI)

Called by Wix during checkout to display available shipping options.

| Parameter | Type | Description |
|-----------|------|-------------|
| `options.lineItems` | `Array` | Cart line items with price, quantity, name, sku |
| `options.shippingDestination` | `object` | Customer's shipping address |
| `options.shippingOrigin` | `object` | Store's origin address |

- **Returns**: `{ shippingRates: Array<WixShippingRate> }`
- **Logic**:
  1. Gets live UPS rates via `getUPSRates()`
  2. Adds local pickup option for Hendersonville area (ZIP 287-289)
  3. Adds local delivery option for SE US (ZIP 270-399)
  4. Falls back to estimated flat rates ($49.99 / $89.99) on error
- **Gotcha**: Function name must be exactly `getShippingRates` — Wix calls it by convention

---

## Common Types

### ProductSummary

Returned by most recommendation functions:

```js
{
  _id: string,
  name: string,
  slug: string,
  price: number,
  formattedPrice: string,         // e.g., "$599.00"
  discountedPrice?: number,
  formattedDiscountedPrice?: string,
  mainMedia: string,              // Image URL
  sku?: string,
  ribbon?: string,                // "Featured", "New", etc.
  collections?: Array<string>,    // Category slugs
}
```

### UPS Service Codes

| Code | Service | Estimated Delivery |
|------|---------|-------------------|
| `01` | UPS Next Day Air | 1 business day |
| `02` | UPS 2nd Day Air | 2 business days |
| `03` | UPS Ground | 3-7 business days |
| `12` | UPS 3 Day Select | 3 business days |
| `13` | UPS Next Day Air Saver | 1 business day (end of day) |
| `14` | UPS Next Day Air Early | Next morning |
| `59` | UPS 2nd Day Air A.M. | 2 business days (morning) |
