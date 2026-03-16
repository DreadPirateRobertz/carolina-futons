# Spike: Wix CRM + Loyalty Program — Gap Analysis (CF-6wgt)

**Date:** 2026-03-15
**Purpose:** Research Wix CRM contacts import and Loyalty Program earning rules. Identify gaps vs existing implementation.

---

## Key Finding: Loyalty system exists; contacts import needs a script

Carolina Futons has ~2,200 lines of loyalty/CRM code across 6 modules. The loyalty program is built. The gap is a **contacts bulk import script** for 183 contacts.

---

## 1. Existing Codebase

### Loyalty Modules

| File | Lines | Purpose |
|------|-------|---------|
| `loyaltyService.web.js` | 193 | Points account, rewards, redemption via `wix-loyalty.v2` |
| `loyaltyTiers.web.js` | 321 | Spend-based tier system (Bronze/Silver/Gold/Platinum) with CMS-backed history |
| `loyaltyHelpers.js` | 137 | Frontend display helpers (progress bars, tier colors, milestones) |
| `couponsService.web.js` | 210 | Welcome/birthday/tier-upgrade coupon generation via `wix-marketing-backend` |
| `contactSubmissions.web.js` | 91 | Lead capture with rate limiting |
| `emailService.web.js` | 286 | Contact form transactional emails |

### Tier Structure (Already Configured)

| Tier | Min Spend | Discount | Points/$ |
|------|-----------|----------|----------|
| Bronze | $0 | 0% | 1x |
| Silver | $500 | 5% | 1x |
| Gold | $1,500 | 10% | 1x |
| Platinum | $3,000 | 15% | 1x |

### What's Working
- Points-per-dollar earning via `wix-loyalty.v2`
- Tier progression by lifetime spend (CMS-backed)
- Reward redemption -> coupon generation
- Automated coupons (welcome, birthday, tier upgrade)
- 5 test suites

---

## 2. Wix API Findings

### Contacts API — Bulk Import Gap

**Critical:** Wix has NO bulk contact CREATE endpoint. Contacts must be created one-at-a-time:
```
POST /contacts/v4/contacts  (one contact per call)
```

Bulk operations exist only for: update, delete, label, unlabel (all async, return job ID).

For 183 contacts:
1. Script iterates and calls `contacts.createContact()` 183 times
2. Rate limit: ~200 requests/minute (Wix general limit), so ~1 minute total
3. Alternative: Wix Dashboard CSV import (manual, no API)

**Merge Contacts:** Up to 5 sources into 1 target. Irreversible — use Preview Merge first.

**Extended Fields (Custom):** Max 100 per site. Types: Text, Number, Date, URL. Keys immutable.

### Loyalty Program API

| Area | API Available? | What We Use |
|------|---------------|-------------|
| Programs | Activate/Pause/Update (1 per site) | `wix-loyalty.v2` programs |
| Earning Rules | Full CRUD — fixed or conversion rate | `wix-loyalty.v2` accounts.earnPoints |
| Tiers | Full CRUD — rolling window recalculation | CMS-backed custom tiers |
| Accounts | Create, earn/adjust points, bulk adjust | `wix-loyalty.v2` accounts |
| Rewards | CRUD — DISCOUNT_AMOUNT or COUPON_REWARD | `wix-loyalty.v2` rewards |
| Loyalty Coupons | Redeem points -> Wix coupon | `wix-loyalty.v2` coupons |
| Transactions | Read-only history | Not used |
| Bulk Import | CSV-based point migration (max 10 MB) | Not used |

**Earning Rules Details:**
- Non-automated rules for Stores (`stores/OrderPaid`), Bookings, Events
- Supports tier-specific rates via `configsByTier` (e.g., Gold earns 2x)
- Fixed amount or conversion rate (e.g., 1 point per $1 spent)

**No Loyalty SPI** — cannot plug in custom loyalty providers.

---

## 3. Gap Analysis

### Already Covered

| Capability | Implementation | Status |
|-----------|---------------|--------|
| Points earning | `loyaltyService.web.js` via `wix-loyalty.v2` | Complete |
| Tier progression | `loyaltyTiers.web.js` via CMS | Complete |
| Reward redemption | `loyaltyService.web.js` | Complete |
| Coupon generation | `couponsService.web.js` | Complete |
| Lead capture | `contactSubmissions.web.js` | Complete |
| Contact form emails | `emailService.web.js` | Complete |
| Frontend display | `loyaltyHelpers.js` | Complete |

### Gaps

| Gap | Impact | Recommendation |
|-----|--------|----------------|
| **183 contacts bulk import** | Cannot onboard existing customers | Write a script using `contacts.createContact()` in a loop with rate limiting |
| **Earning rules not verified** | Points may not auto-earn on purchase | Verify `stores/OrderPaid` earning rule exists in dashboard |
| **Tier-specific earning rates** | Gold/Platinum don't earn bonus points | Consider `configsByTier` for multiplied earning |
| **Loyalty bulk point import** | Existing customers have no point history | Use CSV import API to seed initial points |

---

## 4. 183 Contacts Import Plan

### Approach: Script with Wix Contacts API

```javascript
// scripts/importContacts.js
import { contacts } from '@wix/crm';

async function importContacts(contactData) {
  const results = { success: 0, failed: 0, errors: [] };
  for (const contact of contactData) {
    try {
      await contacts.createContact({
        info: {
          name: { first: contact.firstName, last: contact.lastName },
          emails: { items: [{ email: contact.email }] },
          phones: contact.phone ? { items: [{ phone: contact.phone }] } : undefined,
          extendedFields: {
            items: {
              'custom.lifetime-spend': contact.lifetimeSpend || '0',
              'custom.loyalty-tier': contact.tier || 'Bronze',
            }
          }
        },
        options: { duplicateContactStrategy: 'SKIP' }
      });
      results.success++;
    } catch (err) {
      results.failed++;
      results.errors.push({ email: contact.email, error: err.message });
    }
    // ~3/sec to stay under 200/min
    await new Promise(r => setTimeout(r, 350));
  }
  return results;
}
```

### Data Required
- Source file with 183 contacts (CSV or JSON)
- Fields: firstName, lastName, email, phone (optional), lifetimeSpend, tier

### Post-Import Steps
1. Label imported contacts (e.g., "Legacy Customer") via bulk label API
2. Seed loyalty points via CSV bulk import API
3. Verify `stores/OrderPaid` earning rule is active
4. Test: place order -> points earned -> tier updated

---

## 5. Sources

- [Contacts API](https://dev.wix.com/docs/api-reference/crm/members-contacts/contacts/contacts/introduction)
- [Create Contact](https://dev.wix.com/docs/api-reference/crm/members-contacts/contacts/contacts/create-contact)
- [Labels API](https://dev.wix.com/docs/api-reference/crm/members-contacts/contacts/labels/introduction)
- [Loyalty Programs](https://dev.wix.com/docs/api-reference/loyalty/loyalty-program/programs/introduction)
- [Loyalty Earning Rules](https://dev.wix.com/docs/api-reference/loyalty/loyalty-program/earning-rules/introduction)
- [Loyalty Accounts](https://dev.wix.com/docs/api-reference/loyalty/loyalty-program/accounts/introduction)
- [Loyalty Rewards](https://dev.wix.com/docs/api-reference/loyalty/loyalty-program/rewards/introduction)
- [Loyalty Tiers](https://dev.wix.com/docs/api-reference/loyalty/loyalty-program/tiers/introduction)
- [Coupons API](https://dev.wix.com/docs/api-reference/stores/coupons/coupons/introduction)
