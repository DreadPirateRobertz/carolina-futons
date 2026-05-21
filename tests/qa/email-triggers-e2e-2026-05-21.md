# Email triggers E2E — execution scaffold 2026-05-21

**Bead:** cf-w1u1
**Author:** godfrey (scaffold) — source: rennala's 30-row matrix in `docs/qa/email-triggers-e2e-2026-05-05.md`
**Date:** 2026-05-21
**Sequenced after:** cf-c6g5 (Stilgar registers all templates in Wix CRM Triggered Emails dashboard)
**Blocked on:** staging Velo functions inaccessible until Stilgar publishes backend + provides test member token

---

## Pre-flight

```bash
export STAGING_BASE_URL="https://staging.carolinafutons.com"
export STAGING_BEARER="<owner-or-test-member-bearer-token>"
export TEST_MEMBER_ID="<member-id>"
export TEST_PRODUCT_ID="<any-stocked-product-id>"
export TEST_INBOX="halworker85+test@gmail.com"
export TEST_INBOX_OWNER="halworker85+owner@gmail.com"
export ALERT_CRON_KEY="<from-Wix-Secrets>"
```

Drain the queue before each cron-driven row:
```bash
curl -s -X POST "${STAGING_BASE_URL}/_functions/processEmailQueueCron" \
  -H "X-Cron-Secret: ${ALERT_CRON_KEY}"
```

---

## Touchpoint matrix

| # | Touchpoint | Template ID(s) | Trigger mechanism | Expected recipient | Pass / Fail |
|---|------------|----------------|-------------------|--------------------|-------------|
| 1 | Welcome — exit-intent (3-step) | `welcome_series_1..3` | Submit exit-intent popup with `TEST_INBOX` on `/` | `TEST_INBOX` | __ |
| 2 | Welcome — `triggerWelcomeSeries` | `welcome_series_1..5` | POST `/_functions/triggerWelcomeSeries` `{ email, firstName }` | `TEST_INBOX` | __ |
| 3 | Welcome — member signup | `welcome_series_1..5` | Sign up new test member → `wixMembers_onMemberCreated` | `TEST_INBOX` | __ |
| 4 | Welcome — newsletter signup (post cf-3l0d) | `welcome_series_*` | POST `/_functions/mailingListSignups` `{ email }` | `TEST_INBOX` (only after cf-3l0d) | __ |
| 5 | Order confirmation | `order_confirmation` | Place test order → `wixEcom_onOrderCreated` | `TEST_INBOX` | __ |
| 6 | Shipping — parcel | `order_shipped` | Fulfil order (parcel carrier) → `wixEcom_onFulfillmentCreated` | `TEST_INBOX` | __ |
| 7 | Shipping — LTL freight | `freight_shipped` | Fulfil order (XPO/Estes/WWEX carrier) → `wixEcom_onFulfillmentCreated` | `TEST_INBOX` | __ |
| 8 | Delivery confirmation | `delivery_confirmation` | Mark order delivered → `wixEcom_onOrderDelivered` (cf-jmmk) | `TEST_INBOX` | __ |
| 9 | Post-purchase Day 3 / 7 / 30 | `post_purchase_1..3` | Deliver order (Row 8) → fast-forward `EmailQueue.scheduledFor` → drain queue | `TEST_INBOX` | __ |
| 10 | Post-purchase Day-14 review reward | `post_purchase_review_reward` | As Row 9 | `TEST_INBOX` | __ |
| 11 | Cart abandonment (3-step) | `cart_recovery_1..3` | Add to cart + abandon → POST `/_functions/triggerCartRecoveryCron` | `TEST_INBOX` | __ |
| 12 | Browse recovery | `browse_recovery_1` | Browse product as known member + leave → POST `/_functions/triggerBrowseRecoveryCron` | `TEST_INBOX` | __ |
| 13 | Re-engagement (Day 0 / 7 / 21) | `reengagement_1..3` | Member inactive X days → POST `/_functions/triggerReengagementCron` | `TEST_INBOX` | __ |
| 14 | Winback | CMS-driven (`EmailSequences` where `sequenceType='winback'`) | POST `/_functions/scanAndTriggerWinbackCron` | `TEST_INBOX` | __ |
| 15 | Review request (orders + 7d) | `post_purchase_2` | POST `/_functions/runReviewRequestEmailsCron` for order placed 7d ago | `TEST_INBOX` | __ |
| 16 | Wishlist price-drop alert | `wishlist_price_drop` | Add SKU to wishlist → reduce price via Wix Stores admin → `checkWishlistAlerts` cron | `TEST_INBOX` | __ |
| 17 | Tier milestone (approach / achieved) | `tier_*_approach`, `tier_*_achieved` | Place order crossing 500 pts (Mountain Guide) or 2000 pts (Summit Master) threshold | `TEST_INBOX` | __ |
| 18 | Contact form — owner notification | `contact_form_submission` | POST `/_functions/contactSubmissions` `{ name, email, phone, subject, message }` | `TEST_INBOX_OWNER` (`SITE_OWNER_CONTACT_ID`) | __ |
| 19 | Contact form — customer auto-reply (cf-hafn) | `contact_form_auto_reply` | Same as Row 18 | `TEST_INBOX` (submitter) | __ |
| 20 | Swatch request — owner notification | `contact_form_submission` | POST `/_functions/sampleRequests` `{ name, email, address, productId, swatchNames }` | `TEST_INBOX_OWNER` | __ |
| 21 | Swatch request — customer confirmation | `swatch_confirmation` | As Row 20 (requires pre-existing CRM contact — F7 gap pending cf-xdji) | `TEST_INBOX` | __ |
| 22 | Swatch follow-up sequence | `swatch_followup_arrived`, `swatch_followup_decide` | As Row 20 → fast-forward `EmailQueue` rows for `sequenceType=swatch_followup` | `TEST_INBOX` | __ |
| 23 | Consultation follow-up | `consultation_followup` | Trigger via consultation-booking flow on staging | `TEST_INBOX` | __ |
| 24 | Newsletter → Klaviyo ESP sync | (Klaviyo) | As Row 4 — `_syncToESPInternal` fire-and-forget | Klaviyo profile for `TEST_INBOX` | __ |
| 25 | Birthday reward | `birthday_reward_*` | Set test member birthday to today → next `birthdayRewardService` cron | `TEST_INBOX` | __ |
| 26 | Gift card delivery (buyer + recipient) | `gift_card_delivered_to_buyer`, `gift_card_delivered_to_recipient` | Purchase gift card → `giftCards.web.js` direct sends | `TEST_INBOX` (both roles) | __ |
| 27 | Fabric sample — confirmation + fulfillment | `fabric_sample_confirmation`, `fabric_sample_fulfillment` | Place fabric-sample request → confirm; ship → fulfillment email | `TEST_INBOX` | __ |
| 28 | Product Q&A — owner alert | `OWNER_EMAIL_TEMPLATE` | Submit Q&A on staging PDP → `productQA.web.js` | `TEST_INBOX_OWNER` | __ |
| 29 | Restock notification | `restock_notification` | Subscribe to OOS SKU back-in-stock → restock via Wix Stores admin | `TEST_INBOX` | __ |
| 30 | Review thank-you | `review_thank_you` | Submit product review on staging PDP | `TEST_INBOX` | __ |

---

## Blockers (as of 2026-05-21)

| Blocker | Affects rows | Status |
|---------|-------------|--------|
| Staging Velo functions inaccessible (staging.carolinafutons.com doesn't resolve / `/_functions/` 404) | ALL | Blocked — Stilgar must publish backend |
| Test member token not yet provided | 11, 13, 17 | Blocked — Stilgar |
| cf-c6g5 (template registration) not yet run | ALL | Blocked — sequenced after |
| cf-hafn not merged/published | 19 | Blocked |
| cf-xdji (resolveContactId) not merged/published | 21 | Partial — see F7 gap note |
| cf-3l0d (subscribeToNewsletter auto-trigger) not merged | 4 | Only needed for Row 4 full pass |

---

## Known gaps from cf-icww audit

- **F1** (welcome for anonymous / self-trigger) — cf-xdji contactResolver helper resolves; check status before Row 2/3
- **F2** (newsletter signup doesn't trigger welcome) — Row 4 will fail until cf-3l0d merges
- **F3** (order confirmation never sent) — cf-m6t0 wired `sendOrderConfirmation`; verify Row 5 passes post-merge
- **F6** (contact form auto-reply missing) — cf-hafn; Row 19 gate
- **F7** (swatch confirmation fails for new visitors) — cf-xdji; Row 21 partial-pass expected

---

## Run results (fill in during execution)

Runner: __
Date executed: __
cf-c6g5 status (templates registered): YES / NO
Staging URL confirmed: __

Paste completed matrix above with Pass/Fail filled, then commit to close cf-w1u1.

If any row fails: file follow-up bead — template-side → Stilgar; Velo-side → godfrey; audit-wrong → cf-w1u1 audit-correction.
