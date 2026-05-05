# Email Touchpoint Audit — 2026-05-04

**Bead:** cf-icww
**Auditor:** rennala (cfutons crew)
**Method:** Static analysis of `src/backend/`. Live STAGING_SITE / production sends were not verified — see *Verification gaps* at bottom.
**Scope:** all welcome + touch emails dispatched via `triggeredEmails.emailContact` (Wix CRM Triggered Emails).

## Legend

- **Trigger** — is the trigger function actually wired to fire?
- **Send** — does the send call reach `triggeredEmails.emailContact` with the required arguments?
- **Render** — does a template ID exist in the registry?
- **Data-bind** — are all variable names referenced by the trigger free of `undefined`/missing-key risk?

`✅` = looks good statically. `⚠️` = works but has a gap. `❌` = broken / dead path.
**Live render verification** for every row needs STAGING_SITE access (Stilgar) — flagged at end.

## Summary table

| # | Email                                  | Template ID                         | Trigger | Send | Render | Data-bind | Notes |
|---|----------------------------------------|-------------------------------------|---------|------|--------|-----------|-------|
| 1 | Welcome drip — exit-intent capture     | `welcome_series_1..3`               | ✅      | ❌   | ✅     | ⚠️       | F1 — empty `recipientContactId` blocks send |
| 2 | Welcome drip — `triggerWelcomeSeries`  | `welcome_series_1..5`               | ✅      | ❌   | ✅     | ⚠️       | F1 — same root cause |
| 3 | Welcome drip — member signup           | `welcome_series_1..5`               | ✅      | ✅   | ✅     | ✅        | Wired via `events.js#wixMembers_onMemberCreated` |
| 4 | Welcome drip — `subscribeToNewsletter` | (none — never queued)               | ❌      | n/a  | n/a    | n/a       | F2 — webMethod inserts subscriber but never queues welcome |
| 5 | Order confirmation                     | `order_confirmation`                | ❌      | ❌   | ✅     | ✅        | F3 — only-wired handler in `events.js` does not call `sendOrderConfirmation`; the call lives in dead-code copy of `wixEcom_onOrderCreated` inside `emailAutomation.web.js` |
| 6 | Shipping notification (parcel)         | `order_shipped`                     | ❌      | ✅   | ✅     | ✅        | F4 — `wixEcom_onFulfillmentCreated` defined ONLY in `emailAutomation.web.js`; not wired in `events.js` |
| 7 | Shipping notification (LTL freight)    | `freight_shipped`                   | ❌      | ✅   | ✅     | ✅        | F4 — same |
| 8 | Delivery confirmation                  | `delivery_confirmation`             | ❌      | ✅   | ✅     | ✅        | F5 — `wixEcom_onOrderDelivered` defined ONLY in `emailAutomation.web.js` |
| 9 | Post-purchase Day 3 / 7 / 30 / referral| `post_purchase_1..3`, `post_purchase_referral` | ⚠️ | ✅   | ✅     | ✅        | Fires from `events.js#wixEcom_onOrderCreated` so countdown starts at *order* not *delivery* (CF-nkau spec says delivery) |
| 10| Post-purchase Day-14 review reward     | `post_purchase_review_reward`       | ❌      | ✅   | ✅     | ✅        | F5 — depends on `wixEcom_onOrderDelivered` |
| 11| Cart abandonment recovery (3-step)     | `cart_recovery_1..3`                | ✅      | ✅   | ✅     | ✅        | Cron `triggerCartRecoveryCron` + `cartRecovery.web.js` |
| 12| Browse recovery                        | `browse_recovery_1`                 | ✅      | ✅   | ✅     | ✅        | Cron `triggerBrowseRecoveryCron` |
| 13| Re-engagement (Day 0 / 7 / 21)         | `reengagement_1..3`                 | ✅      | ✅   | ✅     | ✅        | Cron `triggerReengagementCron` |
| 14| Winback (UTM-based)                    | (lifecycle templates)               | ✅      | ✅   | ✅     | ✅        | Cron `scanAndTriggerWinbackCron` |
| 15| Review-request (orders + 7d)           | `post_purchase_2`                   | ✅      | ✅   | ✅     | ✅        | Cron `runReviewRequestEmailsCron`; also wired via `jobs.config` |
| 16| Wishlist price-drop alerts             | (in `wishlistAlerts.web.js`)        | ✅      | ✅   | ✅     | ✅        | Cron `checkWishlistAlerts` |
| 17| Tier milestone (gamification)          | `tier_*_approach`/`*_achieved`      | ✅      | ✅   | ✅     | ✅        | Wired via `events.js#wixEcom_onOrderCreated` post-purchase block (CF-8onx) |
| 18| Contact form (owner notification)      | `contact_form_submission`           | ✅      | ✅   | ✅     | ✅        | `emailService.sendEmail` — sends to `SITE_OWNER_CONTACT_ID` |
| 19| Contact form (customer auto-reply)     | (none)                              | ❌      | n/a  | n/a    | n/a       | F6 — no customer-side reply email sent (godfrey's PR #15 path) |
| 20| Swatch request (owner notification)    | `contact_form_submission`           | ✅      | ✅   | ✅     | ✅        | `submitSwatchRequest` |
| 21| Swatch request (customer confirmation) | `swatch_confirmation`               | ⚠️      | ✅   | ✅     | ✅        | F7 — only fires if a CRM contact already exists for the email; new visitors get nothing |
| 22| Swatch follow-up sequence              | `swatch_followup_arrived/decide`    | ✅      | ✅   | ✅     | ✅        | Day 3/10 post-ship via cron |
| 23| Consultation follow-up                 | `consultation_followup`             | ✅      | ✅   | ✅     | ✅        | CF-tcj5 |
| 24| Newsletter signup confirmation         | (Klaviyo handles via ESP)           | ✅      | ✅   | n/a    | n/a       | `subscribeToNewsletter` calls `_syncToESPInternal` (best-effort) |
| 25| Birthday reward                        | `birthday_reward_*`                 | ✅      | ✅   | ✅     | ✅        | `birthdayRewardService.web.js` |
| 26| Gift card delivery                     | (in `giftCards.web.js`)             | ✅      | ✅   | ✅     | ✅        | Two send sites |
| 27| Fabric sample confirmation/fulfillment | `fabric_sample_*`                   | ✅      | ✅   | ✅     | ✅        | `fabricSampleService.web.js` |
| 28| Product Q&A owner alert                | `OWNER_EMAIL_TEMPLATE`              | ✅      | ✅   | ✅     | ✅        | `productQA.web.js` |
| 29| Restock notification                   | `restock_notification`              | ✅      | ✅   | ✅     | ✅        | Triggered from `wixStores_onInventoryVariantUpdated` |
| 30| Review thank-you                       | `review_thank_you`                  | ✅      | ✅   | ✅     | ✅        | `reviewsService.web.js` |
| 31| Content schedule cron                  | (publisher, not email)              | ✅      | n/a  | n/a    | n/a       | `processContentScheduleCron` schedules CMS content; no email side-effect |

## Findings (P0/P1) — broken or dead

### F1 — Welcome series for anonymous + member-self-trigger paths fails to send (P1)
**Where:**
- `src/backend/newsletterService.web.js:453` (`captureExitIntentEmail`) inserts `recipientContactId: ''`
- `src/backend/emailAutomation.web.js:487` (`triggerWelcomeSeries`) inserts `recipientContactId: ''`

**Why it breaks:** `processEmailQueue` calls `sendQueuedEmail` (`emailAutomation.web.js:1485`) which `throw new Error('No contact ID for recipient')` when `recipientContactId` is empty. Items retry until `MAX_RETRIES`, then status='failed'.

**Result:** Exit-intent welcome series and member-self-trigger welcome series never deliver. Member-signup path (F3 ✅) works because `wixMembers_onMemberCreated` passes `member._id` as `contactId`.

**Fix:** Resolve a Wix CRM contact via `contacts.appendOrCreateContact({ emails: [{ email }] })` before queueing, then store the returned `contactId` on the queue row.

### F2 — `subscribeToNewsletter` does not actually queue the welcome series (P1)
**Where:** `src/backend/newsletterService.web.js:333..389` and the comment in `src/backend/styleQuiz.web.js:327` ("subscribeToNewsletter deduplicates silently and triggers the welcome flow").

**Why it breaks:** `subscribeToNewsletter` inserts a `NewsletterSubscribers` row and fires-and-forgets `_syncToESPInternal(...)`. There is no call to `triggerWelcomeSequence`, `triggerWelcomeSeries`, or `enqueueEmail` for `welcome_series_*`. The misleading comment in styleQuiz means callers believe a welcome flow runs.

**Fix:** Either rename `subscribeToNewsletter` to make its scope honest, or call `triggerWelcomeSeries(cleanEmail, '')` (after F1 is fixed) at the success branch.

### F3 — `order_confirmation` template never sends (P0)
**Where:** Two competing definitions of `wixEcom_onOrderCreated`:
- `src/backend/events.js:214` — wired by Wix; calls `triggerPostPurchaseSequence` (Day-3+ care guide), **does NOT call `sendOrderConfirmation`**.
- `src/backend/emailAutomation.web.js:183` — dead code; would call `sendOrderConfirmation` but Wix only auto-registers handlers exported from `backend/events.js`.

**Why it breaks:** Wix Stores' built-in receipt email may still fire (platform-level), but the Velo `order_confirmation` template — the branded one with `firstName`/`orderNumber`/`itemSummary`/`estimatedDays` variables — is dormant. If Velo template was meant to replace the platform default, customers receive a less branded receipt; if it was additive, customers receive *one* receipt instead of two.

**Fix:** Add `sendOrderConfirmation({contactId, email, firstName, orderNumber, total, itemSummary})` at the top of `events.js#wixEcom_onOrderCreated` (after the `if (!email) return` guard). Delete the dead-code copy in `emailAutomation.web.js` to prevent further confusion.

### F4 — Shipping notifications never fire (P0)
**Where:** `wixEcom_onFulfillmentCreated` is defined ONLY in `src/backend/emailAutomation.web.js:218`. `events.js` has no such handler.

**Why it breaks:** Wix auto-registers event handlers from `backend/events.js`. `.web.js` files expose webMethods — exporting a `wix*_on*` name from them is not an event registration. Both `order_shipped` and `freight_shipped` templates never get triggered by tracking-info creation.

**Fix:** Move `wixEcom_onFulfillmentCreated` body into `events.js` (or have `events.js` import-and-call). The send-side functions (`sendShippingNotification`, `sendFreightShippingNotification`) are correct.

### F5 — Delivery confirmation, Day-14 review reward, NPS survey never fire (P0)
**Where:** `wixEcom_onOrderDelivered` is defined ONLY in `src/backend/emailAutomation.web.js:264`. `events.js` has no such handler.

**Why it breaks:** Same as F4. Affects:
- `delivery_confirmation` template (sendDeliveryConfirmation)
- `post_purchase_review_reward` (CF-qy79 Day-14 review prompt)
- NPS survey scheduling (CF-1mlj)
- The "post-purchase sequence starting from delivery date" requirement (CF-nkau spec) — currently the sequence starts from order *creation* via the `events.js` order-created handler.

**Fix:** Add `wixEcom_onOrderDelivered` to `events.js`, copying logic verbatim from `emailAutomation.web.js:264`. Then audit whether the order-created path should still queue post-purchase or whether the Day-3/7/30 timing should reset to delivery date.

### F6 — Contact form has no customer-side reply (P2)
**Where:** `src/backend/emailService.web.js#sendEmail` (line 105+).

**Why it's a gap:** Only the site owner gets `contact_form_submission`. The submitter sees a UI confirmation ("Thanks!") but no email confirmation lands in their inbox — common reason customers re-submit the form. Bead description references "godfrey's PR #15 path" which suggests an auto-reply was planned.

**Fix:** Resolve/append a CRM contact, then call `triggeredEmails.emailContact('contact_form_auto_reply', contactId, { variables: { customerName, originalMessage } })` after the owner notification. Template needs to be created.

### F7 — Swatch confirmation skipped for new visitors (P2)
**Where:** `src/backend/emailService.web.js:259..280`.

**Why it's a gap:** `submitSwatchRequest` fires the customer-side `swatch_confirmation` only if `contacts.queryContacts().eq('primaryInfo.email', cleanEmail)` already returns a hit. First-time submitters (no prior CRM contact) get no email. The owner-side notification fires either way.

**Fix:** Use `contacts.appendOrCreateContact({ emails: [{ email: cleanEmail }] })` first to guarantee a contactId, then send.

## Verification gaps — require STAGING_SITE access

Static analysis cannot prove:
- HTML template renders (no blank emails) — requires triggering each template on staging and inspecting received HTML.
- Variables actually bind (no literal `{{firstName}}` left over) — requires received-email inspection.
- CTA links resolve to the correct production URLs with UTM params intact.
- Send-window throttling (`isInSendWindow`) does not delay transactional emails past their useful TTL.
- Klaviyo ESP sync fires on `subscribeToNewsletter` (best-effort `_syncToESPInternal` swallows errors silently).

Suggested STAGING_SITE acceptance test plan (hand-off to whoever runs it):
1. New visitor → exit-intent popup → confirm `welcome_series_1` arrives. **Expect F1 to surface.**
2. New member signup → confirm `welcome_series_1` arrives. **Expect ✅.**
3. Test order placement → confirm `order_confirmation` arrives. **Expect F3 to surface (template silent).**
4. Mark fulfillment with tracking → confirm `order_shipped` or `freight_shipped` arrives. **Expect F4 (silent).**
5. Mark order delivered → confirm `delivery_confirmation` + Day-14 reward + NPS survey scheduled. **Expect F5 (silent).**
6. Add to cart, abandon → wait 1 hr → confirm `cart_recovery_1`. Should ✅.
7. Submit contact form → confirm owner email arrives, no customer reply. **Expect F6 (no customer email).**
8. Submit swatch request as a brand-new email → confirm only owner side arrives. **Expect F7 (customer email skipped).**

## Recommended fix order

1. **F4 + F5** — copy/move event handlers into `events.js`. Trivial; unblocks the entire post-fulfillment touch funnel.
2. **F3** — add the `sendOrderConfirmation` call in `events.js#wixEcom_onOrderCreated`. Delete the dead handler in `emailAutomation.web.js` to prevent the next maintainer falling for it.
3. **F1** — introduce a single `resolveContactId(email, firstName)` helper that does `contacts.appendOrCreateContact`, and use it at every queue site that currently passes `''`. Same helper fixes F7.
4. **F2** — decide whether `subscribeToNewsletter` should auto-trigger the welcome flow. If yes, add a call after the dedup check (post-F1).
5. **F6** — design + create `contact_form_auto_reply` template; wire up after F1/F7 helper exists.
