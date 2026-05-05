# Email Touchpoint Audit — 2026-05-04 (refreshed 2026-05-05; cf-6k6u corrections 2026-05-05 PM)

> **cf-6k6u correction summary** (radahn 5-agent review on merged PR #1140):
> 1. **Row 14 winback template IDs were fabricated.** Earlier revision listed `lifecycle_winback_30d/60d/90d`. Those template IDs do not exist. Real winback templates load at runtime from the `EmailSequences` Wix Data collection via `marketingSequences.web.js#loadActiveSteps('winback')`. Static analysis cannot enumerate them. Row 14 has been corrected.
> 2. **F3/F4/F5 fix recipes did not say to delete the dormant duplicate handler block in `emailAutomation.web.js` (~lines 160–320).** That file exports `wixMembers_onMemberCreated`, `wixEcom_onOrderCreated`, `wixEcom_onFulfillmentCreated`, `wixEcom_onOrderCanceled`, and (post-cf-jmmk) a re-export of `wixEcom_onOrderDelivered` — none of which Wix registers (only `events.js` exports register). An engineer fixing F3 might edit the dormant `emailAutomation.web.js#wixEcom_onOrderCreated` (which already calls `sendOrderConfirmation`) and ship "no behaviour change". Each F3/F4/F5 recipe now explicitly says "**delete the dormant block in `emailAutomation.web.js`**" alongside the events.js wiring step.
>
> Also incorporated: F5 row + status-delta table updated for **cf-jmmk PR #1141 merged** (`cd9a11e5`) — rows 8 + 10 flip to ✅; Row 9 picks up a new dup-queue concern.



**Bead:** cf-icww
**Auditor:** rennala (cfutons crew)
**Method:** Static analysis of `src/backend/` against `main` at `4dabfd96`. Live STAGING_SITE / production sends were not verified — see *Verification gaps* at bottom.
**Scope of detail rows:** all welcome + touch emails dispatched via `triggeredEmails.emailContact` (Wix CRM Triggered Emails). 31 rows total.
**Scope of acceptance test plan (§Verification gaps):** P0/P1 findings only — `✅` rows in the table are statically asserted, not runtime-asserted; STAGING expansion for the `✅` set is out of scope for this audit and tracked as cf-icww.followup-tests.
**In-flight fixes referenced:** cf-i23b (F3, bead closed), cf-icdc (F4, bead closed), cf-jmmk (F5, PR #1141 OPEN), cf-xdji (F1+F7, in_progress). Those landings change F3/F4/F5 row state — see "Status delta vs. PRs in flight" below.

## Wiring contract (load-bearing)

The audit's three P0 findings (F3/F4/F5) and the `✅` on every event-driven row depend on a single Wix Velo contract:

> **Backend event handlers are auto-registered only from `backend/events.js`.** Functions matching the `wix*_on*` naming pattern that live in any other backend file (including `*.web.js` SPI files) are **not** wired into the Wix events bus and will never be invoked by Wix Stores / CRM / Members.

Source: Wix Velo "Backend Events" reference (https://dev.wix.com/docs/velo/api-reference/wix-stores-backend/events) — handlers are registered by exporting from `backend/events.js`. The SPI `.web.js` files expose webMethods, not event subscriptions; an exported `wix*_on*` function in those files is dormant.

If this contract is wrong, F3/F4/F5 collapse. Anyone refuting the audit should refute this contract first.

## Legend

- **Trigger** — does the trigger function actually wire to fire on the source event?
- **Send** — does the send call reach `triggeredEmails.emailContact` with the required arguments when triggered?
- **Render** — does a template ID exist in the registry (in `emailAutomation.web.js#SEQUENCES` or as a literal `'foo'` argument to `emailContact`)?
- **Data-bind** — are all variable names referenced by the trigger free of `undefined`/missing-key risk *at the call site* (template-side render is verified separately on staging — see Verification gaps)?

`✅` static-pass. `⚠️` works but with a caveat. `❌` broken / dead path.

Code refs use **symbol anchors** (function name) rather than line numbers, since lines drift (miquella feedback).

## Summary table

| # | Email                                  | Template ID                          | Trigger | Send | Render | Data-bind | Anchor                                              | Notes |
|---|----------------------------------------|--------------------------------------|---------|------|--------|-----------|-----------------------------------------------------|-------|
| 1 | Welcome drip — exit-intent capture     | `welcome_series_1..3`                | ✅      | ❌   | ✅     | ⚠️        | `newsletterService.web.js#captureExitIntentEmail`   | F1 — `recipientContactId: ''` blocks send |
| 2 | Welcome drip — `triggerWelcomeSeries`  | `welcome_series_1..5`                | ✅      | ❌   | ✅     | ⚠️        | `emailAutomation.web.js#triggerWelcomeSeries`       | F1 — same root cause |
| 3 | Welcome drip — member signup           | `welcome_series_1..5`                | ✅      | ✅   | ✅     | ✅        | `events.js#wixMembers_onMemberCreated`              | Wired correctly |
| 4 | Welcome drip — `subscribeToNewsletter` | (none — never queued)                | ❌      | n/a  | n/a    | n/a       | `newsletterService.web.js#subscribeToNewsletter`    | F2 — webMethod inserts subscriber but never queues welcome |
| 5 | Order confirmation                     | `order_confirmation`                 | ❌      | ❌   | ✅     | ✅        | `events.js#wixEcom_onOrderCreated`                  | F3 — events.js handler does not call `sendOrderConfirmation`; the call lives in dead duplicate at `emailAutomation.web.js#wixEcom_onOrderCreated`. **cf-i23b filed (bead CLOSED 2026-05-05); no merged PR yet — still verify on main.** |
| 6 | Shipping notification (parcel)         | `order_shipped`                      | ❌      | ✅   | ✅     | ✅        | `emailAutomation.web.js#wixEcom_onFulfillmentCreated` | F4 — handler defined only in `.web.js`. `events.js#wixEcom_onOrderFulfilled` exists but only dispatches mobile push + SMS via `notificationOrchestrator`, no email. **cf-icdc filed (bead CLOSED); no merged PR yet.** |
| 7 | Shipping notification (LTL freight)    | `freight_shipped`                    | ❌      | ✅   | ✅     | ✅        | `emailAutomation.web.js#wixEcom_onFulfillmentCreated` | F4 — same |
| 8 | Delivery confirmation                  | `delivery_confirmation`              | ✅      | ✅   | ✅     | ✅        | `events.js#wixEcom_onOrderDelivered` (post-cf-jmmk) | Wired by PR #1141 (merged `cd9a11e5`). Dormant duplicate `wixEcom_onOrderDelivered = handleOrderDelivered` still lingers in `emailAutomation.web.js` — drop in F3/F4 sweep |
| 9 | Post-purchase Day 3 / 7 / 30 / referral| `post_purchase_1..3`, `post_purchase_referral` | ⚠️ | ✅   | ✅     | ✅        | `events.js#wixEcom_onOrderCreated` → `triggerPostPurchaseSequence` | Countdown starts at *order* not *delivery* (CF-nkau spec says delivery). After cf-jmmk lands, both events queue post-purchase → potential duplicates unless one is removed. |
| 10| Post-purchase Day-14 review reward     | `post_purchase_review_reward`        | ✅      | ✅   | ✅     | ✅        | `events.js#wixEcom_onOrderDelivered` (post-cf-jmmk) | Wired by PR #1141. See Row 9 dup-queue concern (post-purchase now queued from both order-created and order-delivered handlers) |
| 11| Cart abandonment recovery (3-step)     | `cart_recovery_1..3`                 | ✅      | ✅   | ✅     | ✅        | `cartRecovery.web.js`, cron `triggerCartRecoveryCron`| |
| 12| Browse recovery                        | `browse_recovery_1`                  | ✅      | ✅   | ✅     | ✅        | `browseAbandonment.web.js`, cron `triggerBrowseRecoveryCron` | |
| 13| Re-engagement (Day 0 / 7 / 21)         | `reengagement_1..3`                  | ✅      | ✅   | ✅     | ✅        | `emailAutomation.web.js#triggerReengagement`, cron `triggerReengagementCron` | |
| 14| Winback (lapsed-customer scan)         | CMS-driven (see Note)                | ✅      | ✅   | ✅     | ✅        | `marketingSequences.web.js#scanAndTriggerWinback`, cron `scanAndTriggerWinbackCron` | Template IDs **not hardcoded** — `loadActiveSteps('winback')` reads them at runtime from the `EmailSequences` Wix Data collection (filtered by `sequenceType='winback'` AND `active=true`, ordered by `step` asc). Static audit cannot list the IDs without dumping the live collection. **CORRECTION (cf-6k6u):** an earlier revision of this row listed `lifecycle_winback_30d/60d/90d` — those IDs were fabricated and do not exist; ignore any fix recipe that hardcodes them. |
| 15| Review-request (orders + 7d)           | `post_purchase_2`                    | ✅      | ✅   | ✅     | ✅        | `emailAutomation.web.js#runReviewRequestEmails`, cron `runReviewRequestEmailsCron` + `jobs.config` daily 10am EST | |
| 16| Wishlist price-drop alerts             | `wishlist_price_drop`                | ✅      | ✅   | ✅     | ✅        | `wishlistAlerts.web.js#checkWishlistAlerts`, cron `checkWishlistAlerts` | Template literal at the `emailContact` call site in `wishlistAlerts.web.js` |
| 17| Tier milestone (gamification)          | `tier_*_approach`/`*_achieved`       | ✅      | ✅   | ✅     | ✅        | `events.js#wixEcom_onOrderCreated` → `checkAndTriggerTierMilestone` | CF-8onx |
| 18| Contact form (owner notification)      | `contact_form_submission`            | ✅      | ✅   | ✅     | ✅        | `emailService.web.js#sendEmail`                     | Sends to `SITE_OWNER_CONTACT_ID` secret |
| 19| Contact form (customer auto-reply)     | (none)                               | ❌      | n/a  | n/a    | n/a       | `emailService.web.js#sendEmail` (gap)               | F6 — no customer-side reply email sent. *PR #15* in the original bead description was an external issue tracker reference; treat as historical, not a code path. |
| 20| Swatch request (owner notification)    | `contact_form_submission`            | ✅      | ✅   | ✅     | ✅        | `emailService.web.js#submitSwatchRequest`           | |
| 21| Swatch request (customer confirmation) | `swatch_confirmation`                | ⚠️      | ✅   | ✅     | ✅        | `emailService.web.js#submitSwatchRequest`           | F7 — only fires if a CRM contact already exists; new visitors get nothing. **cf-xdji in_progress — adds `resolveContactId` helper used by F1 + F7.** |
| 22| Swatch follow-up sequence              | `swatch_followup_arrived/decide`     | ✅      | ✅   | ✅     | ✅        | `emailAutomation.web.js#SEQUENCES.swatch_followup`  | Day 3/10 post-ship via cron |
| 23| Consultation follow-up                 | `consultation_followup`              | ✅      | ✅   | ✅     | ✅        | `emailAutomation.web.js#SEQUENCES.consultation`     | CF-tcj5 |
| 24| Newsletter signup → ESP sync (Klaviyo) | (Klaviyo handles via ESP)            | ✅      | ⚠️   | n/a    | n/a       | `newsletterService.web.js#_syncToESPInternal`       | Caveat — fire-and-forget; `_syncToESPInternal(...)` is `.catch(() => {})`, so silent failures are masked. Cannot statically verify Klaviyo actually receives. (Adjusted from `✅` per silent-failure-hunter feedback.) |
| 25| Birthday reward                        | `birthday_reward_*`                  | ✅      | ✅   | ✅     | ✅        | `birthdayRewardService.web.js`                      | |
| 26| Gift card delivery                     | `gift_card_delivered_to_buyer`, `gift_card_delivered_to_recipient` | ✅ | ✅ | ✅ | ✅ | `giftCards.web.js` (two `emailContact` sites) | |
| 27| Fabric sample confirmation/fulfillment | `fabric_sample_confirmation`, `fabric_sample_fulfillment` | ✅ | ✅ | ✅ | ✅ | `fabricSampleService.web.js`                       | |
| 28| Product Q&A owner alert                | `OWNER_EMAIL_TEMPLATE` (constant)    | ✅      | ✅   | ✅     | ✅        | `productQA.web.js`                                  | |
| 29| Restock notification                   | `restock_notification`               | ✅      | ✅   | ✅     | ✅        | Triggered from `events.js#wixStores_onInventoryVariantUpdated` | |
| 30| Review thank-you                       | `review_thank_you`                   | ✅      | ✅   | ✅     | ✅        | `reviewsService.web.js`                             | |

(Removed prior row 31 "content schedule cron" — `processContentScheduleCron` schedules CMS content publishing, has no `triggeredEmails.emailContact` call site, and is therefore out of scope for this audit. Mentioned originally only because the bead description listed it.)

## Status delta vs. PRs in flight

| Finding | Bead    | Bead status      | PR     | PR status | Audit row will flip when… |
|---------|---------|------------------|--------|-----------|----------------------------|
| F3      | cf-i23b | CLOSED 2026-05-05 | (none on main yet) | n/a    | sendOrderConfirmation called in events.js#wixEcom_onOrderCreated |
| F4      | cf-icdc | CLOSED 2026-05-05 | (none on main yet) | n/a    | events.js exports wixEcom_onFulfillmentCreated calling send{Shipping,Freight}Notification |
| F5      | cf-jmmk | CLOSED 2026-05-05 | #1141  | MERGED `cd9a11e5` | ✅ already flipped — rows 8 + 10 now PASS on current main |
| F1+F7   | cf-xdji | IN_PROGRESS       | (TBD)  | n/a       | resolveContactId helper used at captureExitIntentEmail + triggerWelcomeSeries + submitSwatchRequest |

**Note for the merge gate:** beads CLOSED for F3/F4 without a corresponding merged PR look like bead-trail drift — flag back to mayor. This audit treats current `main` as the source of truth, so F3/F4 remain `❌` until code lands.

## Findings (P0/P1) — broken or dead

### F1 — Welcome series for anonymous + member-self-trigger paths fails to send (P1)
**Where:**
- `newsletterService.web.js#captureExitIntentEmail` inserts `recipientContactId: ''` (in the `wixData.insert('EmailQueue', { … })` block).
- `emailAutomation.web.js#triggerWelcomeSeries` inserts `recipientContactId: ''` (in the per-step `queueEmail({ … })` call).

**Why it breaks:** `processEmailQueue` (`emailAutomation.web.js`, called by `get_processEmailQueueCron`) delegates send to `sendQueuedEmail`, which `throw new Error('No contact ID for recipient')` when `recipientContactId` is empty. Items retry until `MAX_RETRIES`, then `status='failed'`.

**Result:** Exit-intent welcome series and member-self-trigger welcome series never deliver. Member-signup path (Row #3 ✅) works because `wixMembers_onMemberCreated` passes `member._id` as `contactId`.

**Fix in flight:** cf-xdji — `resolveContactId(email, firstName)` helper using `contacts.appendOrCreateContact(...)` from `wix-crm-backend`, called before queueing.

### F2 — `subscribeToNewsletter` does not actually queue the welcome series (P1)
**Where:** `newsletterService.web.js#subscribeToNewsletter`. Comment in `styleQuiz.web.js` (in the `if (!alreadySubscribed)` branch) reads "subscribeToNewsletter deduplicates silently and triggers the welcome flow."

**Why it breaks:** `subscribeToNewsletter` inserts a `NewsletterSubscribers` row and fires-and-forgets `_syncToESPInternal(...)`. There is no call to `triggerWelcomeSequence`, `triggerWelcomeSeries`, or `enqueueEmail` for `welcome_series_*`. The misleading comment in styleQuiz means callers believe a welcome flow runs.

**Decision needed:** rename `subscribeToNewsletter` to make scope honest, OR call `triggerWelcomeSeries(cleanEmail, '')` (post-F1) at the success branch. Tracked at cf-icww.followup-f2.

### F3 — `order_confirmation` template never sends (P0, current main)
**Where:** Two competing definitions of `wixEcom_onOrderCreated`:
- `events.js#wixEcom_onOrderCreated` — wired by Wix; calls `triggerPostPurchaseSequence` (Day-3+ care guide), **does NOT call `sendOrderConfirmation`**.
- `emailAutomation.web.js#wixEcom_onOrderCreated` — dead code; would call `sendOrderConfirmation` but does not run.

**Why it breaks:** Wix Stores' built-in receipt may still fire (platform-level), but the Velo `order_confirmation` template — the branded one with `firstName`/`orderNumber`/`itemSummary`/`estimatedDays` variables — is dormant.

**Fix recipe:**
1. **Add** call to `sendOrderConfirmation({contactId, email, firstName, orderNumber, total, itemSummary})` in `events.js#wixEcom_onOrderCreated` after the existing `if (!email) return` guard.
2. **Delete the dormant block in `emailAutomation.web.js`** — `wixEcom_onOrderCreated` (the duplicate handler) AND its `sendOrderConfirmation({...})` call. Engineering hazard: editing the dormant copy looks like progress (the `sendOrderConfirmation` call is right there) but Wix never invokes it. Removing the dormant block prevents the next maintainer from "fixing" the wrong file.
3. The same removal sweep should also drop the dormant `wixMembers_onMemberCreated`, `wixEcom_onOrderCanceled` blocks in `emailAutomation.web.js` — both are duplicated in `events.js` and only the events.js copies fire.

**Fix in flight:** cf-i23b (bead CLOSED but no PR observed on main as of refresh).

### F4 — Shipping notifications never fire (P0, current main)
**Where:** `wixEcom_onFulfillmentCreated` is defined ONLY in `emailAutomation.web.js`. `events.js` exports `wixEcom_onOrderFulfilled` instead, but that handler dispatches *mobile push* via `orderStatusWebhook.web` and *SMS* via `notificationOrchestrator.web` — no email send.

**Why it breaks:** Wiring contract above. `order_shipped` and `freight_shipped` templates never get triggered by tracking-info creation.

**Fix recipe:**
1. **Add** a `wixEcom_onFulfillmentCreated` (or extend the existing `wixEcom_onOrderFulfilled`) handler in `events.js` that calls `sendShippingNotification(...)` for parcel and `sendFreightShippingNotification(...)` for LTL freight, using the same parcel-vs-LTL split currently in the dormant copy.
2. **Delete the dormant `wixEcom_onFulfillmentCreated` block in `emailAutomation.web.js`** once events.js owns the dispatch. Same engineering hazard as F3: the dormant copy looks complete and a future maintainer may try to "fix" it there.

**Fix in flight:** cf-icdc (bead CLOSED but no PR observed on main as of refresh).

### F5 — Delivery confirmation, Day-14 review reward, NPS survey never fire (P0 → resolved upstream)
**Where:** `wixEcom_onOrderDelivered` was defined ONLY in `emailAutomation.web.js` at original audit time. **Resolved 2026-05-05 by PR #1141 (cf-jmmk merged at `cd9a11e5`)** — `events.js#wixEcom_onOrderDelivered` now dispatches via `handleOrderDelivered`. Rows 8 and 10 flip to `✅` against current main.

**Remaining dormant copy:** `emailAutomation.web.js` still re-exports `wixEcom_onOrderDelivered = handleOrderDelivered` (a no-op duplicate now that events.js owns the dispatch). Recommend dropping the duplicate export as part of the same dormant-block sweep called for in F3/F4.

**Row 9 follow-up concern (new, post-#1141):** Both `wixEcom_onOrderCreated` and `wixEcom_onOrderDelivered` now queue the post-purchase sequence, producing duplicate Day-3/7/30 sends unless `enqueueEmail`'s dedup guard catches them on `sequenceType + orderNumber`. Verify on staging; if duplicates land, file a follow-up bead to remove the order-created branch (delivery-date countdown is the spec-correct trigger per CF-nkau).

### F6 — Contact form has no customer-side reply (P2)
**Where:** `emailService.web.js#sendEmail`.

**Why it's a gap:** Only the site owner gets `contact_form_submission`. The submitter sees a UI confirmation but no email confirmation lands in their inbox — common reason customers re-submit. The "PR #15" reference in the original cf-icww description is an external/historical issue reference, not a code path on current main.

**Fix:** Resolve/append a CRM contact (use cf-xdji's helper once landed), then call `triggeredEmails.emailContact('contact_form_auto_reply', contactId, { variables })`. Template needs to be created. Tracked at cf-icww.followup-f6.

### F7 — Swatch confirmation skipped for new visitors (P2)
**Where:** `emailService.web.js#submitSwatchRequest`.

**Why it's a gap:** `submitSwatchRequest` fires the customer-side `swatch_confirmation` only if `contacts.queryContacts().eq('primaryInfo.email', cleanEmail)` already returns a hit. First-time submitters get no email. The owner-side notification fires either way.

**Fix in flight:** cf-xdji — same `resolveContactId` helper used by F1.

## Verification gaps — require STAGING_SITE access

Static analysis cannot prove:

| Gap                                          | What needs to happen on staging                                          |
|----------------------------------------------|--------------------------------------------------------------------------|
| HTML body actually renders (not blank)       | View raw HTML source of received email; assert `<html>` body is non-empty |
| No literal `{{var}}` left after binding      | Grep raw HTML for `{{` / `}}` / `undefined` / `null` strings              |
| CTA links resolve to correct prod URLs       | Click each CTA in received email; expect `https://www.carolinafutons.com/...` (or `staging.carolinafutons.com` on STAGING_SITE) with intended path |
| UTM params survive end-to-end                | Inspect each CTA href: must contain `utm_source`/`utm_medium`/`utm_campaign` matching template assertion |
| Send-window throttling does not eat TTL      | Trigger a send outside the configured window (`isInSendWindow`); confirm reschedule, then forward-clock test confirms eventual send before TTL |
| Klaviyo ESP sync actually fires (Row 24)     | Subscribe via `subscribeToNewsletter`, then check Klaviyo dashboard for the new profile within 60s |

### P0/P1 acceptance test plan (revised)

Each step lists trigger + arrival assertion + HTML/UTM/throttle expectation. Test order matches Recommended Fix Order so the remediation can be verified iteratively.

1. **F4 (Row 6/7) — shipping email after fulfillment:** Mark a test order fulfilled with parcel tracking. Assert `order_shipped` arrives within 5 min. Open raw source: assert no `{{` substrings, `firstName`/`orderNumber`/`trackingNumber` bound, tracking link host matches carrier (e.g. `ups.com`). Repeat with LTL carrier (`XPO`) for `freight_shipped`.

2. **F5 (Row 8/10) — delivery + Day-14 reward + NPS:** Mark a test order delivered. Assert (a) `delivery_confirmation` arrives within 5 min, (b) `post_purchase_review_reward` queues with `scheduledFor = deliveredAt + 14d` (inspect `EmailQueue`), (c) NPS survey row inserted in `Surveys` with `deliveredAt + 7d`. Open `delivery_confirmation` raw source: assert `firstName`/`orderNumber` bound, no `{{`.

3. **F3 (Row 5) — order confirmation:** Place a test order. Assert `order_confirmation` arrives within 5 min. Verify body shows correct `total` (currency-formatted), `itemSummary` (no `[object Object]`), `estimatedDays` (numeric string).

4. **F1 (Row 1/2) — exit-intent + member-self-trigger welcome:** (a) New-visitor exit-intent submit. Assert `welcome_series_1` arrives within 5 min. Inspect `EmailQueue` row: `recipientContactId` is non-empty (proves `resolveContactId` ran). (b) Member calls `triggerWelcomeSeries` — same assertions.

5. **Welcome member signup (Row 3) — regression check after F1:** New member signup. Assert `welcome_series_1` still arrives. Confirms F1 helper change didn't break the member-signup contactId path.

6. **F6 (Row 19) — contact form auto-reply (after template+wire):** Submit contact form as a brand-new email. Assert (a) owner email arrives at `SITE_OWNER_CONTACT_ID` recipient, (b) customer email arrives at submitter. Body of customer email echoes the original `subject` + `message`.

7. **F7 (Row 21) — swatch confirmation for new visitor:** Submit swatch request from a brand-new email (no prior CRM contact). Assert `swatch_confirmation` arrives at submitter. Verify `swatchList` correctly comma-joined.

8. **F2 (Row 4) — subscribeToNewsletter welcome (decision-dependent):** Submit `subscribeToNewsletter` directly (not exit-intent). Outcome depends on the F2 decision: if "auto-trigger" wins, assert `welcome_series_1` arrives; if "rename" wins, assert no welcome and downstream callers (e.g. styleQuiz) call `triggerWelcomeSeries` directly.

### Cart-abandonment timing knob

Step 6 in the prior plan ("wait 1 hr") was unrealistic for staging tests. `processCartRecovery` reads `scheduledFor` from each `EmailQueue` row — testers can short-circuit by either:
- inserting a queue row with `scheduledFor = now` and `templateId='cart_recovery_1'` directly, or
- calling `processEmailQueue({ now: Date.now() + 3600_000 })` from the wix-jobs runner / admin webMethod console to fast-forward the scheduler.

Document this in the staging runbook so subsequent audits aren't blocked on real-time waits.

## Recommended fix order

1. **F4 + F5** (cf-icdc, cf-jmmk) — copy/move event handlers into `events.js`. cf-jmmk PR #1141 is up; cf-icdc bead is closed but no PR landed yet — flag to mayor for missing-PR drift.
2. **F3** (cf-i23b) — same shape. Bead CLOSED but no merged PR; same drift concern as F4.
3. **F1 + F7** (cf-xdji) — single `resolveContactId(email, firstName)` helper used at every queue/send site that currently passes `''` or skips on missing contact.
4. **F2** — decision then implementation; tracked separately.
5. **F6** — design `contact_form_auto_reply` template, then wire after F1/F7 helper exists.
6. **Row 9 dedupe** (post-F5 merge) — once `wixEcom_onOrderDelivered` lands, dedupe post-purchase queue inserts by `sequenceType + orderNumber` so the order-created and order-delivered handlers don't double-queue.
