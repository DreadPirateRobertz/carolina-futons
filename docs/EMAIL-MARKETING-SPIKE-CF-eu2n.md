# Spike: Wix Email Marketing API — Gap Analysis (CF-eu2n)

**Date:** 2026-03-15
**Purpose:** Research Wix Email Marketing API and identify gaps vs existing Carolina Futons implementation.

---

## Key Finding: System Already Built

Carolina Futons has **3,001 lines** of email marketing code across 8 backend modules, plus a Klaviyo ESP integration, 16 triggered email templates, and 14 test files.

---

## 1. Existing Codebase (What We Have)

### Core Modules

| File | Lines | Purpose |
|------|-------|---------|
| `emailAutomation.web.js` | 821 | Multi-sequence automation orchestrator (welcome, cart recovery, post-purchase, re-engagement) |
| `emailTemplates.web.js` | 373 | Template registry, variable validation, performance analytics |
| `newsletterService.web.js` | 293 | Newsletter subscription + Klaviyo ESP sync |
| `emailService.web.js` | 286 | Transactional emails (contact form, swatch requests, order notifications) |
| `notificationService.web.js` | 359 | Wishlist price drop + back-in-stock alerts |
| `wishlistAlerts.web.js` | 539 | Advanced wishlist alerts with price history tracking |
| `cartRecovery.web.js` | 240 | Abandoned cart event handlers + recovery analytics |
| `contactSubmissions.web.js` | 90 | Lead capture form handler |

### Frontend
- `Newsletter.js` (164 lines) — Dedicated signup page with WELCOME10 discount

### Provisioning
- `scripts/provisionEmailTemplates.js` (425 lines) — CLI tool to provision 16 Wix Triggered Email templates

### External Integration
- **Klaviyo** — Profile creation, list subscription, welcome sequence triggering
- Secrets: `ESP_API_KEY`, `ESP_LIST_ID`, `KLAVIYO_WEBHOOK_SECRET`

### Automation Sequences (4)
1. **Welcome Series** — 3 steps: brand story + discount → buying guide → social proof
2. **Abandoned Cart Recovery** — 3 steps: reminder → social proof → discount incentive
3. **Post-Purchase Care** — 3 steps: assembly follow-up → review solicitation → care guide
4. **Re-engagement** — 1 step: "we miss you" + discount

### CMS Collections (13)
EmailQueue, Unsubscribes, EmailEvents, AbandonedCarts, ContactSubmissions, NewsletterSubscribers, PriceHistory, NotificationLog, MemberPreferences, Wishlist, WishlistAlertPrefs, WishlistAlertsSent, InventoryThresholds

---

## 2. Wix Email Marketing API Surface

### Available APIs

| API | What It Does | Programmatic? |
|-----|-------------|---------------|
| **Triggered Emails** (`wix-crm-backend`) | Send event-driven emails with variables | Yes — `emailContact()`, `emailMember()` |
| **Campaign API** (REST) | List, publish, delete campaigns | Partial — cannot CREATE campaigns |
| **Contacts + Labels** (REST/SDK) | Manage contacts, segment with labels | Full CRUD |
| **Email Subscriptions** (REST/SDK) | Manage subscription status, unsubscribe links | Full CRUD |
| **Marketing Consent** (REST) | GDPR/CAN-SPAM consent management | Full CRUD |
| **Automations V2** (REST) | Create automations with existing triggers/actions | Full CRUD |
| **Sender Details/Emails** (REST) | Manage sender identity, domain auth | Full CRUD |
| **Notifications** (REST) | Dashboard/app notifications | Owner-only, not customer-facing |

### Critical Gaps (Things API CANNOT Do)

1. **Cannot create email campaigns programmatically** — must use Dashboard UI
2. **Cannot create/edit triggered email templates via API** — Dashboard only
3. **No Email Marketing SPI** — cannot plug in custom email providers via SPI
4. **No A/B testing API** — must duplicate campaigns manually
5. **No template library API** — cannot browse/apply pre-made templates

### Rate Limits

| Plan | Monthly Emails | Price |
|------|---------------|-------|
| Free | 200 | $0 |
| Core | 5,000 | ~$24/mo |
| Advanced | 1,000,000 | ~$49/mo |

**Important:** Triggered emails continue sending even after quota is exhausted (not blocked).

---

## 3. Gap Analysis: What We Have vs What's Available

### Already Covered (no gaps)

| Capability | Our Implementation | Wix API Used |
|-----------|-------------------|-------------|
| Transactional emails | emailService.web.js | `triggeredEmails.emailContact()` |
| Welcome series | emailAutomation.web.js | `triggeredEmails.emailContact()` + EmailQueue CMS |
| Cart recovery | emailAutomation.web.js + cartRecovery.web.js | `wixEcom_onAbandonedCheckoutCreated` + triggered emails |
| Post-purchase flow | emailAutomation.web.js | `wixEcom_onOrderCreated` + triggered emails |
| Re-engagement | emailAutomation.web.js | triggered emails |
| Newsletter signup | newsletterService.web.js | Klaviyo API + CMS |
| Price drop alerts | notificationService.web.js + wishlistAlerts.web.js | triggered emails + CMS |
| Unsubscribe | emailAutomation.web.js | CMS-based (CAN-SPAM compliant) |
| A/B testing | emailAutomation.web.js | Custom 50/50 split on subject lines |
| Template management | emailTemplates.web.js | 16-template registry with variable schemas |

### Potential Gaps Worth Investigating

| Gap | Impact | Recommendation |
|-----|--------|----------------|
| **Wix Email Subscriptions API** not used | We use CMS-based unsubscribe — Wix has a proper subscription management API with deliverability tracking (bounces, spam complaints) | Consider integrating `@wix/email-subscriptions` for bounce/complaint handling |
| **Marketing Consent API** not used | We handle consent via CMS — Wix has GDPR-compliant consent API with double opt-in support | Consider if GDPR compliance requirements warrant switching |
| **Automations V2 API** not used | Our sequences are custom code — Wix Automations V2 can create automations programmatically with built-in triggers | Our custom approach is more flexible; Automations V2 is simpler but less configurable |
| **Campaign analytics** not used | We track opens/clicks in CMS — Wix Campaign API has detailed per-recipient activity data | Only relevant if we start using Wix campaigns (currently using Klaviyo) |
| **Sender domain authentication** not done | Emails may go to spam without proper DKIM/SPF | Use Sending Domains API to authenticate domain |

---

## 4. Recommendations

### No Major Gaps — System is Production-Ready

The existing implementation is **more comprehensive than what Wix's native email marketing API offers**. We use:
- Klaviyo for ESP (more powerful than Wix's built-in email marketing)
- Custom CMS-based queue with retry logic (more reliable than Wix automations)
- Custom A/B testing (not available in Wix API)
- Custom unsubscribe management (CAN-SPAM compliant)

### Minor Improvements Worth Considering

1. **Sender Domain Auth** — Use Wix Sending Domains API to authenticate the business email domain (improves deliverability)
2. **Email Subscription Status Sync** — Integrate `@wix/email-subscriptions` to sync bounce/complaint data back to our unsubscribe system
3. **Marketing Consent API** — If expanding internationally (GDPR), consider using Wix's consent management alongside our CMS-based approach

### NOT Recommended

- Migrating from Klaviyo to Wix native email marketing (Klaviyo is far more capable)
- Replacing custom automation code with Wix Automations V2 (less flexible)
- Using Wix Campaign API for newsletters (cannot create campaigns programmatically)

---

## 5. Sources

### Wix API Documentation
- [Triggered Emails (Velo)](https://dev.wix.com/docs/velo/apis/wix-crm-backend/triggered-emails/email-contact)
- [Campaign API](https://dev.wix.com/docs/api-reference/business-management/marketing/emails/email-marketing/campaign/introduction)
- [Email Subscriptions](https://dev.wix.com/docs/api-reference/crm/communication/email-subscriptions/introduction)
- [Marketing Consent](https://dev.wix.com/docs/api-reference/business-management/marketing/marketing-consent/introduction)
- [Automations V2](https://dev.wix.com/docs/api-reference/business-management/automations/automations/automations-v2/introduction)
- [Contacts API](https://dev.wix.com/docs/api-reference/crm/members-contacts/contacts/contacts/introduction)
- [Labels API](https://dev.wix.com/docs/api-reference/crm/members-contacts/contacts/labels/introduction)
- [Notifications](https://dev.wix.com/docs/api-reference/business-management/notifications/notifications/introduction)
- [Sender Details](https://dev.wix.com/docs/api-reference/business-management/marketing/emails/sender-details/introduction)
- [Sending Domains](https://dev.wix.com/docs/rest/business-management/marketing/emails/sending-domains/introduction)
- [Rate Limits](https://dev.wix.com/docs/rest/articles/getting-started/rate-limits)
