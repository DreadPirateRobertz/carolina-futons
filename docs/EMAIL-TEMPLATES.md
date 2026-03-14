# Carolina Futons -- Triggered Email Templates Reference

**Last updated:** 2026-02-21
**Purpose:** Complete reference for all Wix Triggered Email templates required by the Carolina Futons backend codebase. Use this to create templates in Wix Dashboard > Marketing > Triggered Emails.

---

## 1. Overview

Carolina Futons uses **Wix Triggered Emails** (`wix-crm-backend` `triggeredEmails.emailContact()`) to send transactional and marketing emails. Emails are sent by passing a `templateId` string and a `contactId` to the Wix API, along with a `variables` object containing merge fields.

There are two delivery patterns:

1. **Queue-based (EmailQueue CMS)** -- Used by `emailAutomation.web.js`. Emails are inserted into an `EmailQueue` CMS collection with a `scheduledFor` timestamp. A scheduled job calls `processEmailQueue()` every 15-30 minutes to send due emails via `triggeredEmails.emailContact()`. Supports retry with exponential backoff (max 3 attempts), unsubscribe checking, and A/B testing.

2. **Direct send** -- Used by `emailService.web.js` and `notificationService.web.js`. These call `triggeredEmails.emailContact()` immediately without queuing.

3. **CMS-queued (BrowseRecoveryEmails)** -- Used by `browseAbandonment.web.js`. Emails are inserted into a `BrowseRecoveryEmails` CMS collection. A separate processor (not yet implemented in the browse abandonment module) would read pending records and call `triggeredEmails.emailContact()`.

**Total templates to create: 15**

---

## 2. Template IDs -- Complete List

| # | Template ID | Module | Sequence | Step | Delay | Send Method |
|---|------------|--------|----------|------|-------|-------------|
| 1 | `welcome_series_1` | emailAutomation | Welcome | 1 | Immediate | Queue |
| 2 | `welcome_series_2` | emailAutomation | Welcome | 2 | 72 hours (3 days) | Queue |
| 3 | `welcome_series_3` | emailAutomation | Welcome | 3 | 168 hours (7 days) | Queue |
| 4 | `cart_recovery_1` | emailAutomation | Cart Recovery | 1 | 1 hour | Queue |
| 5 | `cart_recovery_2` | emailAutomation | Cart Recovery | 2 | 24 hours (1 day) | Queue |
| 6 | `cart_recovery_3` | emailAutomation | Cart Recovery | 3 | 72 hours (3 days) | Queue |
| 7 | `post_purchase_1` | emailAutomation | Post-Purchase Care | 1 | Immediate | Queue |
| 8 | `post_purchase_2` | emailAutomation | Post-Purchase Care | 2 | 168 hours (7 days) | Queue |
| 9 | `post_purchase_3` | emailAutomation | Post-Purchase Care | 3 | 720 hours (30 days) | Queue |
| 10 | `reengagement_1` | emailAutomation | Re-engagement | 1 | Immediate | Queue |
| 11 | `browse_recovery_1` | browseAbandonment | Browse Recovery | 1 | 2 hours | CMS Queue |
| 12 | `browse_recovery_2` | browseAbandonment | Browse Recovery | 2 | 24 hours (1 day) | CMS Queue |
| 13 | `browse_recovery_3` | browseAbandonment | Browse Recovery | 3 | 48 hours (2 days) | CMS Queue |
| 14 | `contact_form_submission` | emailService | One-off | -- | Immediate | Direct |
| 15 | `new_order_notification` | emailService | One-off | -- | Immediate | Direct |
| 16 | `price_drop_alert` | notificationService | One-off | -- | Immediate | Direct |
| 17 | `back_in_stock_alert` | notificationService | One-off | -- | Immediate | Direct |

**Note:** `inventoryAlerts.web.js` and `wishlistAlerts.web.js` do NOT use triggered emails directly. `wishlistAlerts.web.js` records alerts to a `WishlistAlertsSent` CMS collection; `notificationService.web.js` is the module that actually sends the price drop and back-in-stock triggered emails. `inventoryAlerts.web.js` writes to `LowStockAlerts` CMS only (no email).

---

## 3. Sequence Definitions

### 3.1 Welcome Series (3 emails)

**Source:** `emailAutomation.web.js` -- `SEQUENCES.welcome`
**Trigger:** `wixMembers_onMemberCreated` event (auto-fires when a new site member registers)
**Unsubscribe key:** `welcome`
**A/B Test:** Step 1 subject line (50/50 random split)

| Step | Template ID | Delay | Description |
|------|------------|-------|-------------|
| 1 | `welcome_series_1` | Immediate | Brand story + 10% discount code |
| 2 | `welcome_series_2` | 72 hours | Buying guide |
| 3 | `welcome_series_3` | 168 hours | Social proof + user-generated content |

**A/B variants for step 1:**
- Variant A subject: `Welcome to Carolina Futons -- here's 10% off your first order`
- Variant B subject: `Your 10% welcome gift is inside, {firstName}`

### 3.2 Cart Recovery (3 emails)

**Source:** `emailAutomation.web.js` -- `SEQUENCES.cart_recovery`
**Trigger:** `triggerAbandonedCartRecovery()` scheduled job (finds carts abandoned >1 hour)
**Unsubscribe key:** `cart_recovery`
**Auto-cancel:** If cart is recovered before send, pending emails are cancelled

| Step | Template ID | Delay | Description |
|------|------------|-------|-------------|
| 1 | `cart_recovery_1` | 1 hour | Reminder with cart preview |
| 2 | `cart_recovery_2` | 24 hours | Social proof + reviews |
| 3 | `cart_recovery_3` | 72 hours | Discount incentive (includes discount code) |

**Note:** Delays are measured from the `abandonedAt` timestamp, not from when the job runs.

### 3.3 Post-Purchase Care (3 emails)

**Source:** `emailAutomation.web.js` -- `SEQUENCES.post_purchase`
**Trigger:** `wixEcom_onOrderCreated` event (auto-fires when order is placed)
**Unsubscribe key:** `post_purchase`
**Auto-cancel:** If order is cancelled (`wixEcom_onOrderCanceled`), all pending post-purchase emails for that order are cancelled

| Step | Template ID | Delay | Description |
|------|------------|-------|-------------|
| 1 | `post_purchase_1` | Immediate | Thank you + tracking info |
| 2 | `post_purchase_2` | 168 hours (7 days) | Assembly tips + review request |
| 3 | `post_purchase_3` | 720 hours (30 days) | Care guide + accessory upsell |

### 3.4 Re-engagement (1 email)

**Source:** `emailAutomation.web.js` -- `SEQUENCES.reengagement`
**Trigger:** `triggerReengagement()` scheduled job (finds contacts with no order in 90+ days)
**Unsubscribe key:** `reengagement`

| Step | Template ID | Delay | Description |
|------|------------|-------|-------------|
| 1 | `reengagement_1` | Immediate | "We miss you" + exclusive offer with discount code |

### 3.5 Browse Recovery (3 emails)

**Source:** `browseAbandonment.web.js` -- `RECOVERY_SEQUENCE`
**Trigger:** `triggerBrowseRecovery()` scheduled job (every 30 min). Targets high-intent sessions (>2 min on product pages) where visitor provided email via "Remind Me" popup.
**Unsubscribe key:** `browse_recovery`
**Auto-cancel:** If session is marked as converted, pending recovery emails are cancelled
**Recovery window:** 48 hours from session creation

| Step | Template ID | Delay | Subject Line | Description |
|------|------------|-------|--------------|-------------|
| 1 | `browse_recovery_1` | 2 hours | "Still thinking about it?" | First nudge with viewed products |
| 2 | `browse_recovery_2` | 24 hours | "Your favorites are waiting" | Second reminder |
| 3 | `browse_recovery_3` | 48 hours | "Last chance: items you viewed" | Final urgency email |

### 3.6 Contact Form / Store Owner Notifications (2 templates)

**Source:** `emailService.web.js`
**Trigger:** Direct function call from frontend forms
**Recipient:** Site owner (via `SITE_OWNER_CONTACT_ID` secret)

| Template ID | Description |
|------------|-------------|
| `contact_form_submission` | Forwards contact form data to store owner. Also used for swatch requests. |
| `new_order_notification` | Notifies store owner of new orders. |

### 3.7 Wishlist Alert Notifications (2 templates)

**Source:** `notificationService.web.js`
**Trigger:** `checkWishlistAlerts()` daily scheduled job
**Recipient:** Individual members who wishlisted the product
**Cooldown:** 7 days per member per product per alert type

| Template ID | Description |
|------------|-------------|
| `price_drop_alert` | Notifies member that a wishlisted product dropped >=10% from its 30-day high price |
| `back_in_stock_alert` | Notifies member that a previously out-of-stock wishlisted product is available again |

---

## 4. Variable Reference

### 4.1 `welcome_series_1`, `welcome_series_2`, `welcome_series_3`

| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `firstName` | string | Member's first name | "Sarah" |
| `discountCode` | string | Welcome discount code (from `WELCOME_DISCOUNT_CODE` secret) | "WELCOME10" |
| `email` | string | Member's email address | "sarah@example.com" |
| `subjectLine` | string | A/B test subject line (step 1 only) | "Welcome to Carolina Futons..." |

### 4.2 `cart_recovery_1`, `cart_recovery_2`, `cart_recovery_3`

| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `buyerName` | string | Customer's name | "John" |
| `cartTotal` | string | Cart total as string | "1299.00" |
| `itemSummary` | string | Comma-separated list of items with quantities | "Kodiak Futon Frame (x1), Cover - Blue (x1)" |
| `discountCode` | string | Recovery discount code (step 3 only; from `RECOVERY_DISCOUNT_CODE` secret) | "COMEBACK15" |
| `checkoutId` | string | Wix checkout ID (internal, for dedup) | "abc123..." |
| `email` | string | Buyer's email address | "john@example.com" |

### 4.3 `post_purchase_1`, `post_purchase_2`, `post_purchase_3`

| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `firstName` | string | Buyer's first name | "Mike" |
| `orderNumber` | string | Wix order number | "10042" |
| `total` | string | Order total as string | "899.00" |
| `productNames` | string | Comma-separated product names | "Monterey Futon Frame, Suede Cover" |
| `email` | string | Buyer's email address | "mike@example.com" |

### 4.4 `reengagement_1`

| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `firstName` | string | Customer's first name | "Lisa" |
| `discountCode` | string | Re-engagement discount (from `RECOVERY_DISCOUNT_CODE` secret) | "COMEBACK15" |
| `email` | string | Customer's email address | "lisa@example.com" |

### 4.5 `browse_recovery_1`, `browse_recovery_2`, `browse_recovery_3`

These templates are queued into the `BrowseRecoveryEmails` CMS collection. The collection stores:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `recipientEmail` | string | Visitor's email | "visitor@example.com" |
| `recipientName` | string | Visitor's name (if provided) | "Amy" |
| `products` | string (JSON) | Top 3 viewed products as JSON array | `[{"productId":"...","productName":"Kodiak","price":899}]` |
| `subject` | string | Pre-set subject line from RECOVERY_SEQUENCE | "Still thinking about it?" |

**Note:** The browse recovery module queues to CMS but the actual `triggeredEmails.emailContact()` call for these is not in `browseAbandonment.web.js`. The sending processor will need to parse the `products` JSON and pass variables to the template. Recommended template variables:

| Variable | Type | Description |
|----------|------|-------------|
| `recipientName` | string | Visitor's name |
| `productName1` | string | First viewed product name |
| `productPrice1` | string | First viewed product price |
| `productName2` | string | Second viewed product name (if any) |
| `productPrice2` | string | Second viewed product price (if any) |
| `productName3` | string | Third viewed product name (if any) |
| `productPrice3` | string | Third viewed product price (if any) |

### 4.6 `contact_form_submission`

| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `customerName` | string | Submitter's name | "Jane Doe" |
| `customerEmail` | string | Submitter's email | "jane@example.com" |
| `customerPhone` | string | Phone number (may be empty) | "(828) 555-1234" |
| `subject` | string | Message subject or swatch request label | "Question about delivery" |
| `message` | string | Message body or swatch details | "When will my order arrive?" |
| `submittedAt` | string | Formatted Eastern time timestamp | "Friday, February 21, 2026 at 3:45 PM" |

### 4.7 `new_order_notification`

| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `orderNumber` | string | Order number | "10042" |
| `customerName` | string | Buyer's full name | "John Smith" |
| `total` | string | Formatted order total | "$1,299.00" |
| `itemCount` | string | Number of line items (as string) | "3" |

### 4.8 `price_drop_alert`

| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `productName` | string | Product name | "Kodiak Futon Frame" |
| `previousPrice` | string | Formatted previous (higher) price | "$899.00" |
| `currentPrice` | string | Formatted current (lower) price | "$749.00" |
| `savings` | string | Dollar savings formatted | "$150.00" |
| `productUrl` | string | Full product page URL | "https://www.carolinafutons.com/product-page/kodiak-futon" |
| `productImage` | string | Product main image URL | "https://static.wixstatic.com/..." |

### 4.9 `back_in_stock_alert`

| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `productName` | string | Product name | "Monterey Futon Frame" |
| `productUrl` | string | Full product page URL | "https://www.carolinafutons.com/product-page/monterey-futon" |
| `productImage` | string | Product main image URL | "https://static.wixstatic.com/..." |

---

## 5. Setup Instructions

### Step 1: Create Templates in Wix Dashboard

1. Go to **Dashboard > Marketing & SEO > Marketing Tools > Triggered Emails** (or **Dashboard > Marketing > Triggered Emails**)
2. Click **Create New** for each template ID listed below
3. **CRITICAL:** The template ID you enter in Wix must match **exactly** (case-sensitive, underscores included)
4. Add the variables listed in Section 4 using the Wix template editor's "Add Variable" feature
5. Design each template using Carolina Futons brand tokens:
   - Sand: `#E8D5B7`
   - Espresso: `#3A2518`
   - Mountain Blue: `#5B8FA8`

### Step 2: Templates to Create (ordered by priority for live test)

**Priority 1 -- Required for basic operation:**
1. `contact_form_submission` -- Contact form will break without this
2. `new_order_notification` -- Order alerts to store owner

**Priority 2 -- Welcome flow (fires on new member signup):**
3. `welcome_series_1`
4. `welcome_series_2`
5. `welcome_series_3`

**Priority 3 -- Post-purchase care (fires on order creation):**
6. `post_purchase_1`
7. `post_purchase_2`
8. `post_purchase_3`

**Priority 4 -- Cart recovery (requires scheduled job):**
9. `cart_recovery_1`
10. `cart_recovery_2`
11. `cart_recovery_3`

**Priority 5 -- Browse abandonment (requires scheduled job + "Remind Me" popup):**
12. `browse_recovery_1`
13. `browse_recovery_2`
14. `browse_recovery_3`

**Priority 6 -- Wishlist alerts (requires daily scheduled job):**
15. `price_drop_alert`
16. `back_in_stock_alert`

**Priority 7 -- Re-engagement (requires scheduled job, targets 90-day dormant):**
17. `reengagement_1`

### Step 3: Add Required Secrets

In **Wix Dashboard > Secrets Manager**, create these secrets:

| Secret Key | Description | Example Value |
|-----------|-------------|---------------|
| `SITE_OWNER_CONTACT_ID` | Wix contact ID of the store owner (recipient for contact form + order notifications). Find in Dashboard > Contacts > Site Members | `a1b2c3d4-...` |
| `WELCOME_DISCOUNT_CODE` | Discount code for welcome series emails | `WELCOME10` |
| `RECOVERY_DISCOUNT_CODE` | Discount code for cart recovery + re-engagement emails | `COMEBACK15` |

### Step 4: Set Up Scheduled Jobs

The following functions need to be called on a schedule (via Wix Automations, external cron hitting `/_functions/` HTTP endpoints, or similar):

| Function | Module | Frequency | Purpose |
|----------|--------|-----------|---------|
| `processEmailQueue()` | emailAutomation | Every 15-30 min | Sends due emails from EmailQueue |
| `triggerAbandonedCartRecovery()` | emailAutomation | Every 30-60 min | Finds abandoned carts and queues recovery emails |
| `triggerReengagement()` | emailAutomation | Daily | Finds 90-day dormant contacts |
| `triggerBrowseRecovery()` | browseAbandonment | Every 30 min | Queues browse recovery emails for high-intent sessions |
| `checkWishlistAlerts()` | notificationService | Daily | Detects price drops and restocks, sends alerts |
| `recordPriceSnapshots()` | notificationService | Daily (before checkWishlistAlerts) | Records current prices for comparison |

### Step 5: Create CMS Collections

These collections must exist before email automation will work:

| Collection | Used By | Key Fields |
|-----------|---------|------------|
| `EmailQueue` | emailAutomation | templateId, recipientEmail, recipientContactId, variables, sequenceType, sequenceStep, status, scheduledFor, sentAt, attempt, lastError, abVariant, createdAt |
| `Unsubscribes` | emailAutomation, browseAbandonment | email, sequenceType, unsubscribedAt |
| `EmailEvents` | emailAutomation | emailQueueId, eventType, linkUrl, timestamp |
| `AbandonedCarts` | cartRecovery, emailAutomation | checkoutId, buyerEmail, buyerName, cartTotal, lineItems, abandonedAt, status, recoveryEmailSent |
| `BrowseSessions` | browseAbandonment | sessionId, productsViewed, totalDuration, isHighIntent, hasEmail, visitorEmail, converted, recoveryStep |
| `BrowseRecoveryEmails` | browseAbandonment | sessionId, recipientEmail, step, templateId, subject, products, status, scheduledFor |
| `ContactSubmissions` | emailService | name, email, phone, subject, message, submittedAt, status |
| `PriceHistory` | notificationService, wishlistAlerts | productId, price, comparePrice, inStock, recordedAt |
| `NotificationLog` | notificationService | memberId, productId, productName, alertType, previousPrice, currentPrice, sentAt |
| `WishlistAlertsSent` | wishlistAlerts | memberId, productId, alertType, sentAt, price |
| `WishlistAlertPrefs` | wishlistAlerts | memberId, productId, priceDrops, backInStock |

---

## 6. Source File Reference

| File | Path | Templates Defined |
|------|------|-------------------|
| emailAutomation | `src/backend/emailAutomation.web.js` | welcome_series_1/2/3, cart_recovery_1/2/3, post_purchase_1/2/3, reengagement_1 |
| browseAbandonment | `src/backend/browseAbandonment.web.js` | browse_recovery_1/2/3 |
| emailService | `src/backend/emailService.web.js` | contact_form_submission, new_order_notification |
| notificationService | `src/backend/notificationService.web.js` | price_drop_alert, back_in_stock_alert |
| cartRecovery | `src/backend/cartRecovery.web.js` | (none -- tracks carts, does not send email directly) |
| wishlistAlerts | `src/backend/wishlistAlerts.web.js` | (none -- detects alerts, does not send email directly) |
| inventoryAlerts | `src/backend/inventoryAlerts.web.js` | (none -- CMS-based alerts only, no triggered email) |
