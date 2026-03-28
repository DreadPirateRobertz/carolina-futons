# Klaviyo Migration Spike — Carolina Futons

**Date:** 2026-03-28
**Author:** cfutons/crew/rennala
**Bead:** cf-ztoy
**Recommendation:** **LATER** — migrate after hitting 2,500+ contacts or when Wix Automations limits block a revenue-generating workflow.

---

## Executive Summary

At ~1K contacts, Klaviyo's advantages (superior segmentation, deliverability, mobile push) don't justify the migration cost and monthly spend. Wix Automations handles our current 9-email sequences adequately. Revisit when contact list grows past 2,500 or when we need behavioral segmentation that Wix can't do.

---

## Comparison Matrix

| Capability | Wix Automations | Klaviyo | Winner |
|-----------|----------------|---------|--------|
| **Deliverability** | ~95% (shared IP) | ~98% (dedicated IP at scale) | Klaviyo |
| **Segmentation** | Basic (contact properties, purchase history) | Advanced (behavioral, predictive, RFM scoring) | Klaviyo |
| **Email Sequences** | Unlimited, time-based triggers | Unlimited, behavior + time triggers | Klaviyo |
| **Mobile Push** | Not supported | Supported (Klaviyo Push) | Klaviyo |
| **SMS** | Not native (third-party via automations) | Native SMS + MMS | Klaviyo |
| **A/B Testing** | Basic (our custom abTesting.web.js) | Native, multi-variant, auto-winner | Klaviyo |
| **Analytics** | Basic open/click (our custom conversionDashboard) | Revenue attribution, predictive analytics | Klaviyo |
| **Template Builder** | Wix editor (limited) | Drag-and-drop + code editor | Klaviyo |
| **Wix Integration** | Native (zero config) | Via Klaviyo Wix plugin (good but not seamless) | Wix |
| **Setup Complexity** | Zero — already running | Medium — API integration + data migration | Wix |
| **Pricing (1K contacts)** | **$0** (included in Wix plan) | **$30/mo** (Email plan) | Wix |
| **Pricing (2.5K contacts)** | $0 | $45/mo | Wix |
| **Pricing (5K contacts)** | $0 | $60/mo | Wix |
| **Pricing (10K contacts)** | $0 | $100/mo | Wix |

---

## What We Have Today (Wix Automations)

Our email infrastructure is already built and tested:

- **9 email sequences** (welcome 3, cart recovery 3, post-purchase 3) — all wired via `emailAutomation.web.js`
- **A/B testing** — custom `abTesting.web.js` with variant assignment, impression/conversion tracking, statistical significance
- **Analytics** — `conversionDashboard.web.js` with funnel visualization, `analyticsDigest.web.js` with weekly email reports
- **Custom events** — 25-event taxonomy in `customEvents.web.js`
- **Review solicitation** — Day 7 review email with loyalty points incentive
- **Loyalty integration** — tier-up notifications, monthly statements

**Key limitation:** No mobile push notifications, no SMS, no behavioral segmentation (e.g., "browsed mattresses 3x but didn't buy").

---

## What Klaviyo Would Add

### High-Value Additions
1. **Behavioral flows** — "Browsed category X, 3 times, no purchase" → targeted email
2. **Predictive analytics** — Churn risk scoring, expected next order date, lifetime value prediction
3. **Mobile push** — Real-time delivery updates, flash sale alerts, loyalty point reminders
4. **SMS marketing** — Cart recovery via SMS (30-40% open rates vs 20% email)
5. **Revenue attribution** — Direct "this email generated $X revenue" per campaign

### Nice-to-Haves
6. **Signup forms** — Pop-ups, embedded forms, flyouts with A/B testing
7. **Product recommendations** — AI-powered "you might also like" in emails
8. **Dynamic content** — Per-recipient product blocks based on browse history

---

## Migration Effort Estimate

| Task | Effort | Risk |
|------|--------|------|
| Install Klaviyo Wix plugin | 1 hour | Low |
| Migrate contact list (1K) | 2 hours | Low |
| Recreate 9 email sequences | 8 hours | Medium — template redesign |
| Migrate A/B tests | 4 hours | Medium — different A/B model |
| Wire Klaviyo events (replace `trackEvent`) | 4 hours | Medium — API integration |
| Redirect unsubscribe flows | 2 hours | Low |
| Remove old `emailAutomation.web.js` queue logic | 4 hours | High — regression risk |
| QA all sequences | 4 hours | Medium |
| **Total** | **~29 hours** | |

**Calendar time:** 1-2 weeks with testing.

---

## Recommendation: **LATER**

### Why Not Now
1. **Cost:** $30/mo for features we don't yet need at 1K contacts
2. **Migration risk:** 29 hours of work replacing a system that's working
3. **No revenue blocker:** Nothing Klaviyo does that we can't do today with our custom code
4. **Mobile push:** Only valuable with a mobile app (we don't have one)

### When to Migrate
Trigger any of these:
- **Contact list > 2,500** — Klaviyo's segmentation starts paying for itself
- **Cart recovery SMS needed** — SMS has 3x the open rate of email
- **Deliverability drops below 90%** — Wix shared IP becomes a liability
- **Behavioral flow needed** — "Browsed but didn't buy" can't be built in Wix Automations

### Prep for Migration (Do Now, $0 Cost)
1. ✅ Already done: standardized event taxonomy (`customEvents.web.js`)
2. ✅ Already done: centralized email queue (`emailAutomation.web.js`)
3. **TODO:** Add `source` field to all contact records (for Klaviyo list segmentation)
4. **TODO:** Export email performance baselines (open/click rates) for comparison

---

## References

- [Klaviyo Pricing](https://www.klaviyo.com/pricing) — $30/mo for 1K contacts (Email plan)
- [Klaviyo Wix Integration](https://www.klaviyo.com/integrations/wix) — Plugin-based, syncs contacts + orders
- [Wix Automations](https://support.wix.com/en/article/wix-automations-creating-a-new-automation) — Native, no additional cost
- Current email infrastructure: `emailAutomation.web.js`, `emailTemplates.web.js`, `cartRecovery.web.js`
