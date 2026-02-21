# Secrets Manager & Triggered Email Setup Guide

Two Wix Dashboard tasks that require human hands.

---

## Part 1: Secrets Manager (cf-6ub — P0)

**Location:** Wix Dashboard > Developer Tools > Secrets Manager

### Required Secrets

| Secret Name | Value | Used By |
|-------------|-------|---------|
| `UPS_CLIENT_ID` | UPS Developer Portal OAuth Client ID | ups-shipping.web.js |
| `UPS_CLIENT_SECRET` | UPS Developer Portal OAuth Client Secret | ups-shipping.web.js |
| `UPS_ACCOUNT_NUMBER` | UPS shipper account number | ups-shipping.web.js |
| `UPS_SANDBOX` | `true` or `false` — use sandbox API? | ups-shipping.web.js |
| `SITE_OWNER_CONTACT_ID` | Wix Contact ID of store owner (Brenda) | emailService.web.js |
| `WELCOME_DISCOUNT_CODE` | 10% discount code for welcome email (optional) | emailAutomation.web.js |
| `RECOVERY_DISCOUNT_CODE` | Discount code for cart recovery step 3 (optional) | emailAutomation.web.js |

### How to find SITE_OWNER_CONTACT_ID

1. Go to **Wix Dashboard > Contacts**
2. Find the store owner's contact entry (Brenda Deal / halworker85@gmail.com)
3. Click on the contact — the URL will contain the contact ID
4. Copy the UUID from the URL (e.g., `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)

### Verification Checklist

- [ ] `UPS_CLIENT_ID` exists
- [ ] `UPS_CLIENT_SECRET` exists
- [ ] `UPS_ACCOUNT_NUMBER` exists
- [ ] `UPS_SANDBOX` exists (set to `true` for testing, `false` for production)
- [ ] `SITE_OWNER_CONTACT_ID` exists
- [ ] `WELCOME_DISCOUNT_CODE` exists (optional — welcome emails work without it)
- [ ] `RECOVERY_DISCOUNT_CODE` exists (optional — recovery emails work without it)

---

## Part 2: Triggered Email Templates (cf-1ur — P2)

**Location:** Wix Dashboard > Marketing & SEO > Triggered Emails

### Template 1: contact_form_submission

**Template ID:** `contact_form_submission`
**Purpose:** Notify store owner when someone submits the contact form or swatch request

**Variables (insert as merge tags):**

| Variable | Description | Example |
|----------|-------------|---------|
| `customerName` | Customer's name | Jane Smith |
| `customerEmail` | Customer's email | jane@example.com |
| `customerPhone` | Customer's phone | (828) 555-1234 |
| `subject` | Form subject line | Question about Eureka Frame |
| `message` | Customer's message | Is this frame available in Queen? |
| `submittedAt` | Formatted timestamp | Thursday, February 20, 2026, 3:45 PM |

**Suggested layout:**
```
Subject: New Contact Form: {{subject}}

New submission from {{customerName}}

Email: {{customerEmail}}
Phone: {{customerPhone}}
Subject: {{subject}}

Message:
{{message}}

Submitted: {{submittedAt}}
```

---

### Template 2: new_order_notification

**Template ID:** `new_order_notification`
**Purpose:** Notify store owner when a new order is placed

**Variables:**

| Variable | Description | Example |
|----------|-------------|---------|
| `orderNumber` | Wix order number | 10042 |
| `customerName` | Buyer's name | John Doe |
| `total` | Formatted total | $1,299.00 |
| `itemCount` | Number of line items | 3 |

**Suggested layout:**
```
Subject: New Order #{{orderNumber}} — {{total}}

New order from {{customerName}}

Order: #{{orderNumber}}
Total: {{total}}
Items: {{itemCount}}

View in Wix Dashboard > Store Orders
```

---

### Template 3-12: Email Automation Sequences

These are the sequences defined in emailAutomation.web.js. Create these templates with the listed IDs:

#### Welcome Series (3 templates)

| Template ID | Step | Timing | Description |
|-------------|------|--------|-------------|
| `welcome_series_1` | 1 | Immediately | Brand story + 10% welcome discount |
| `welcome_series_2` | 2 | +72 hours | Buying guide (frame + mattress selection) |
| `welcome_series_3` | 3 | +7 days | Social proof + customer photos |

**Variables available:** `firstName`, `discountCode`, `shopUrl`

#### Cart Recovery Series (3 templates)

| Template ID | Step | Timing | Description |
|-------------|------|--------|-------------|
| `cart_recovery_1` | 1 | +1 hour | Friendly reminder with cart preview |
| `cart_recovery_2` | 2 | +24 hours | Social proof + customer reviews |
| `cart_recovery_3` | 3 | +72 hours | Discount incentive to complete purchase |

**Variables available:** `firstName`, `cartItems`, `cartTotal`, `checkoutUrl`, `discountCode`

#### Post-Purchase Series (3 templates)

| Template ID | Step | Timing | Description |
|-------------|------|--------|-------------|
| `post_purchase_1` | 1 | Immediately | Thank you + tracking info |
| `post_purchase_2` | 2 | +7 days | Assembly tips + review request |
| `post_purchase_3` | 3 | +30 days | Care guide + accessory upsell |

**Variables available:** `firstName`, `orderNumber`, `trackingUrl`, `productName`

#### Re-engagement (1 template)

| Template ID | Step | Timing | Description |
|-------------|------|--------|-------------|
| `reengagement_1` | 1 | Immediately | Win-back offer for inactive customers |

**Variables available:** `firstName`, `discountCode`, `shopUrl`

---

## Template Creation Checklist

- [ ] `contact_form_submission` — 6 variables
- [ ] `new_order_notification` — 4 variables
- [ ] `welcome_series_1` — brand story + discount
- [ ] `welcome_series_2` — buying guide
- [ ] `welcome_series_3` — social proof
- [ ] `cart_recovery_1` — cart reminder
- [ ] `cart_recovery_2` — reviews + social proof
- [ ] `cart_recovery_3` — discount incentive
- [ ] `post_purchase_1` — thank you + tracking
- [ ] `post_purchase_2` — assembly tips + review ask
- [ ] `post_purchase_3` — care guide + upsell
- [ ] `reengagement_1` — win-back offer

**Total: 12 templates**
