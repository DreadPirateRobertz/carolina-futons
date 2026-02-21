# Carolina Futons — CMS Collection Schemas

> For cf-n6x catalog scrape: maps scraped product data to CMS collections.
> Generated 2026-02-21 by architect.

## Priority Collections for Catalog Import

These are the collections that need product catalog data imported first.

### Stores/Products (Wix Native)
Wix-managed product catalog. Import via Wix Dashboard CSV or Stores API.
- `name` (text) — Product display name
- `price` (number) — Current price
- `description` (richText) — Full product description
- `images` (mediaGallery) — Product images (use Media Manager)
- `variants` (array) — Size/color/fabric variants
- `collections` (tags) — Category assignments
- `inStock` (boolean) — Availability
- `sku` (text) — SKU code
- `weight` (number) — Shipping weight
- `ribbon` (text) — Badge text ("Sale", "New", etc.)

### FabricSwatches
Fabric options for covers and upholstery.
- `name` (text) — Swatch name (e.g., "Natural Linen")
- `color` (text) — Color description
- `imageUrl` (image) — Swatch thumbnail
- `availableForProducts` (tags) — Product IDs or 'all'
- `priceModifier` (number) — Additional cost for this fabric

### AssemblyGuides
Product assembly instructions and documentation.
- `productId` (text) — Links to Stores/Products
- `title` (text) — Guide title
- `instructions` (richText) — Step-by-step instructions
- `videoUrl` (text) — Assembly video link
- `difficulty` (text) — 'easy', 'moderate', 'difficult'

### ProductBundles
Pre-configured bundle offers.
- `bundleId` (text) — Unique bundle ID
- `bundleName` (text) — Bundle display name
- `primaryProductId` (text) — Primary product
- `bundledProductIds` (text) — CSV of bundled product IDs
- `discountPercent` (number) — Discount percentage
- `isActive` (boolean) — Active status

### BundleTemplates
Curated bundle packages by occasion/tier.
- `name` (text) — Bundle display name
- `productIds` (tags) — Array of product IDs
- `categories` (tags) — Target category slugs
- `basePrice` (number) — Sum of individual prices
- `bundlePrice` (number) — Discounted bundle price
- `discountPercent` (number) — Discount %
- `occasion` (text) — 'back_to_school', 'guest_room', 'small_space', 'outdoor', 'general'
- `tier` (text) — 'starter', 'essentials', 'premium', 'deluxe'
- `isActive` (boolean)
- `priority` (number) — Display order
- `imageUrl` (text) — Hero image
- `minItems` (number) — Minimum items to qualify

### InventoryLevels
Variant-level stock tracking.
- `productId` (text) — Product ID
- `variantId` (text) — Product variant ID
- `sku` (text) — SKU code
- `productName` (text) — Product display name
- `variantLabel` (text) — Variant label (e.g., "Queen / Natural")
- `quantity` (number) — Current stock count
- `threshold` (number) — Low stock alert threshold (default 5)
- `preOrder` (boolean) — Pre-order mode enabled
- `lastRestocked` (dateTime)
- `updatedAt` (dateTime)

### ProductAnalytics
Product performance tracking (seed with zeros on import).
- `productId` (text) — Product ID
- `productName` (text) — Product name
- `category` (text) — Category slug
- `viewCount` (number) — Total views (start at 0)
- `lastViewed` (dateTime)
- `addToCartCount` (number) — Cart adds (start at 0)
- `purchaseCount` (number) — Purchases (start at 0)

### ProductDimensions
Physical dimensions for size guide and room planner.
- `productId` (text) — Product ID
- `width` (number) — Width in inches
- `depth` (number) — Depth in inches
- `height` (number) — Height in inches
- `weight` (number) — Weight in lbs

### ProductSustainability
Eco/sustainability data per product.
- `productId` (text) — Product ID
- `materialSource` (text) — Material sourcing info
- `recyclable` (boolean) — Recyclable materials
- `tradeInEligible` (boolean) — Trade-in program eligible

### Videos
Product video catalog.
- `title` (text) — Video title
- `url` (text) — Video URL (YouTube, Vimeo)
- `productIds` (text) — CSV of related product IDs
- `category` (text) — 'assembly', 'product_feature', 'testimonial', 'care_guide'
- `isActive` (boolean)

### ProductCareGuides
Post-purchase care instructions.
- `productId` (text) — Product ID
- `guideTitle` (text) — Guide title
- `guideContent` (richText) — Care instructions
- `difficulty` (text) — Maintenance difficulty

---

## Supporting Collections (Auto-populated by Backend)

These collections are populated by backend services, not catalog import.
Included for reference so scrape output doesn't conflict.

| Collection | Purpose | Populated By |
|---|---|---|
| EmailQueue | Automated email queue | emailAutomation.web.js |
| EmailEvents | Open/click tracking | emailAutomation.web.js |
| Unsubscribes | Email opt-outs | emailAutomation.web.js |
| AbandonedCarts | Cart recovery | cartRecovery.web.js |
| BrowseSessions | Browse tracking | browseAbandonment.web.js |
| BrowseRecoveryEmails | Browse recovery queue | browseAbandonment.web.js |
| ContactSubmissions | Form submissions | contactSubmissions.web.js |
| SupportTickets | Support tickets | liveChatService.web.js |
| ChatMessages | Chat history | liveChatService.web.js |
| Testimonials | Customer reviews | testimonialService.web.js |
| PhotoReviews | Photo reviews | photoReviews.web.js |
| Fulfillments | Shipment tracking | fulfillment.web.js |
| DeliveryTracking | Delivery status | deliveryExperience.web.js |
| DeliverySchedule | Delivery slots | deliveryScheduling.web.js |
| DeliverySurveys | Post-delivery feedback | deliveryExperience.web.js |
| RoomLayouts | Saved room plans | roomPlanner.web.js |
| AbTests / AbEvents | A/B test data | abTesting.web.js |
| CheckoutAnalytics | Checkout funnel | checkoutOptimization.web.js |
| CompareHistory | Comparison tracking | comparisonService.web.js |
| Wishlist | Saved products | accountDashboard.web.js |
| WishlistAlertPrefs | Alert preferences | wishlistAlerts.web.js |
| WishlistAlertsSent | Alert delivery log | wishlistAlerts.web.js |
| PriceHistory | Price snapshots | wishlistAlerts.web.js |
| BackInStockSignups | Restock alerts | inventoryService.web.js |
| InventoryLog | Stock change audit | inventoryService.web.js |
| NotificationLog | Notification history | notificationService.web.js |
| MemberPreferences | Communication prefs | accountDashboard.web.js |
| CustomerEngagement | Engagement scoring | dataService.web.js |
| Promotions | Campaign data | promotions.web.js |
| ReferralCodes | Referral program | dataService.web.js |
| GiftCards | Gift card management | giftCards.web.js |
| CoPurchasePatterns | Bundle analytics | bundleBuilder.web.js |
| BundleAnalytics | Bundle performance | bundleAnalytics.web.js |
| ProductMedia | Media Manager sync | mediaGallery.web.js |

---

## Scrape Output Format

For the catalog scrape, output JSON with this structure per product:

```json
{
  "name": "Montana Futon Frame - Full Size",
  "sku": "CF-FRAME-MONTANA-F",
  "price": 349.99,
  "description": "Solid hardwood futon frame...",
  "category": "futon-frames",
  "variants": [
    { "label": "Full", "sku": "CF-FRAME-MONTANA-F", "price": 349.99 },
    { "label": "Queen", "sku": "CF-FRAME-MONTANA-Q", "price": 399.99 }
  ],
  "images": ["montana-front.jpg", "montana-side.jpg"],
  "dimensions": { "width": 54, "depth": 38, "height": 33, "weight": 65 },
  "swatches": ["Natural", "Espresso", "Honey Oak"],
  "bundleCompatible": true,
  "sustainability": { "materialSource": "FSC-certified hardwood", "recyclable": true },
  "careGuide": "Dust regularly with dry cloth. Oil wood annually.",
  "assemblyDifficulty": "moderate"
}
```

This maps to: Stores/Products + InventoryLevels + ProductDimensions + FabricSwatches + ProductSustainability + ProductCareGuides.
