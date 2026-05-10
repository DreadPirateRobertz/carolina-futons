# Email triggers E2E — STAGING_SITE verification plan

**Bead:** cf-w1u1
**Author:** rennala (audit author from cf-icww) — paired with godfrey (Velo) for execution
**Date:** 2026-05-05 (drafted 2026-05-10)
**Sequenced after:** cf-c6g5 (Stilgar batch-copies the 13+ Triggered Email templates into the staging Wix CRM dashboard). Until cf-c6g5 lands, the templates don't exist on staging and every send below would 4xx with `template_not_found`.
**Method:** static read of the dispatch graph (sourced from `docs/email-audit-2026-05-04.md`) plus a copy-paste runbook the staging operator executes once cf-c6g5 is green. Same probe-runbook shape as cf-jvut.
**Output structure:** one row per `triggeredEmails.emailContact` call site → trigger mechanism → expected template + variables → CMS-query check → observed/pass column.

## Pre-run checklist (cf-c6g5 sequencing)

Stilgar runs cf-c6g5 first. The matrix below is testable on staging only when ALL of these are green:

- [ ] Wix CRM Triggered Emails dashboard has all template IDs in the table below registered (one row per `Template ID` column value)
- [ ] Each registered template has the variables listed in `Variables` column (literal `{{var}}` placeholders in the body)
- [ ] `SITE_OWNER_CONTACT_ID` Secret is set to a real CRM contact (owner notifications target this)
- [ ] `WELCOME_DISCOUNT_CODE` Secret is set (welcome series step 1 reads this)
- [ ] `UNSUB_TOKEN_SECRET` is set (every queued email's footer needs an unsub link)
- [ ] `ALERT_CRON_KEY` is set (cron-driven sends below need this on the `X-Cron-Secret` header)
- [ ] cf-m3tj merged + Wix CLI published (mobile challenges — orthogonal but cf-jvut overlaps; flag if not yet)
- [ ] cf-fovb merged + Wix CLI published (multi-shipment fulfillment events)
- [ ] cf-hafn merged + Wix CLI published (contact form auto-reply — see Row 19)

## Tester setup

```bash
export STAGING_BASE_URL="https://staging.carolinafutons.com"   # confirm subdomain with melania
export STAGING_BEARER="<owner-or-test-member-bearer-token>"   # from Wix Headless OAuth
export TEST_MEMBER_ID="<member-id-from-the-bearer-token>"     # the member whose CMS rows we measure
export TEST_PRODUCT_ID="<any-stocked-product-id>"
export TEST_INBOX_PRIMARY="halworker85+test@gmail.com"        # primary capture inbox per Stilgar 2026-05-05
export TEST_INBOX_OWNER="halworker85+owner@gmail.com"         # if available — for owner-notification rows
```

For each row that lands an email: verify the inbox actually receives the email (not just that the CMS row was written). Wix's send queue can quietly drop sends if the template isn't published.

Capture baselines before any trigger:

| Metric | Query | Capture |
|--------|-------|---------|
| `EmailQueue` count for member | `EmailQueue.eq('recipientEmail', TEST_INBOX_PRIMARY).count()` | __ |
| `Unsubscribes` rows for member | `Unsubscribes.eq('email', TEST_INBOX_PRIMARY).count()` | __ |

## Touchpoint matrix

Source rows are sequenced to mirror the cf-icww audit table (`docs/email-audit-2026-05-04.md` §Summary table) so cross-reference is direct. Each row's `Anchor` column references the `triggeredEmails.emailContact(...)` call site.

| #  | Touchpoint                                  | Template ID                          | Trigger (curl / action)                                                                                                                                                                            | Variables                                                              | CMS query post-trigger                                                                                          | Inbox check                                                       | Pass / Fail |
|----|---------------------------------------------|---------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------|--------------|
| 1  | Welcome — exit-intent capture (3-step)      | `welcome_series_1..3`                | Submit exit-intent popup with `TEST_INBOX_PRIMARY` (loads `/` then triggers JS exit-intent flow) — see `src/public/exitIntentCapture.js#submitExitCapture`                                          | `firstName`, `discountCode`, `email`                                   | `EmailQueue.eq('recipientEmail',TEST_INBOX_PRIMARY).eq('sequenceType','welcome')` → 3 rows scheduledFor +0/+72/+168h | step 1 arrives within send-window (see §send-window below)         | __           |
| 2  | Welcome — `triggerWelcomeSeries`            | `welcome_series_1..5`                | While authenticated: POST `${STAGING_BASE_URL}/_functions/triggerWelcomeSeries` (or call from member-page form). Body `{ email, firstName }`                                                       | as Row 1 + `subjectLine` for AB step                                   | 5 EmailQueue rows                                                                                                | step 1 arrives                                                     | __           |
| 3  | Welcome — member signup                     | `welcome_series_1..5`                | Sign up a new test member with `TEST_INBOX_PRIMARY` (Wix Members signup → fires `wixMembers_onMemberCreated`)                                                                                      | as Row 2                                                                | 5 EmailQueue rows                                                                                                | step 1 arrives                                                     | __           |
| 4  | Welcome — `subscribeToNewsletter`           | `welcome_series_*` (post cf-3l0d only)| POST `${STAGING_BASE_URL}/_functions/mailingListSignups` body `{ email: TEST_INBOX_PRIMARY }`. Pre-cf-3l0d: NO welcome queued (F2 gap). Post-cf-3l0d: welcome auto-triggers.                                                                          | n/a (currently)                                                         | `NewsletterSubscribers.eq('email',TEST_INBOX_PRIMARY)` → 1 row; EmailQueue depends on cf-3l0d state              | nothing pre-cf-3l0d                                                | __           |
| 5  | Order confirmation                          | `order_confirmation`                 | Place a test order via cfw checkout → fires `wixEcom_onOrderCreated`. Pre-cf-i23b: F3 gap (template never sends; only Wix Stores' built-in receipt fires)                                              | `firstName`, `orderNumber`, `total`, `itemSummary`, `estimatedDays`, `email` | `EmailQueue` row OR direct send log (`order_confirmation` is sent inline, not queued)                            | order receipt arrives                                              | __           |
| 6  | Shipping notification (parcel)              | `order_shipped`                      | Mark a test order fulfilled via Wix Stores admin → tracking number triggers `wixEcom_onFulfillmentCreated`. POST cf-fovb's wiring required                                                          | `firstName`, `orderNumber`, `trackingNumber`, `trackingUrl`, `carrier`, `email` | (none — direct send)                                                                                              | shipping email with parcel template arrives                        | __           |
| 7  | Shipping notification (LTL freight)         | `freight_shipped`                    | As Row 6 but tracking carrier `XPO Logistics` (or `Estes`, `WWEX`)                                                                                                                                | `firstName`, `orderNumber`, `proNumber`, `trackingUrl`, `carrier`, `email` | (direct send)                                                                                                     | freight email arrives                                              | __           |
| 8  | Delivery confirmation                       | `delivery_confirmation`              | Mark order delivered via Wix Stores admin → `wixEcom_onOrderDelivered` (cf-jmmk). Verifies cf-jmmk wiring on staging                                                                                | `firstName`, `orderNumber`, `email`                                    | (direct send) + post-purchase queue rows                                                                          | delivery email arrives                                             | __           |
| 9  | Post-purchase Day 3 / 7 / 30                | `post_purchase_1..3`                 | Place + advance order to delivered state (Row 8). Fast-forward `EmailQueue.scheduledFor` via admin UI to "now" to test the queue cron                                                              | `firstName`, `orderNumber`, `productNames`, `assemblyGuideUrl`, `reviewUrl`, etc | `EmailQueue.eq('sequenceType','post_purchase')` → 5 rows (3 + Day-14 review reward + Day-15 referral)            | each step arrives after fast-forwarding                            | __           |
| 10 | Post-purchase Day-14 review reward          | `post_purchase_review_reward`        | As Row 9 — fires from cf-jmmk's `wixEcom_onOrderDelivered` chain                                                                                                                                  | `firstName`, `orderNumber`, `productNames`, `reviewUrl`, `pointsReward`, `photoBonusPoints`, `email` | row in EmailQueue                                                                                               | email arrives after fast-forward                                   | __           |
| 11 | Cart abandonment recovery (3-step)          | `cart_recovery_1..3`                 | Add to cart with `TEST_INBOX_PRIMARY`, abandon. Cron `triggerCartRecoveryCron` runs every 30min — short-circuit by POSTing the cron endpoint with `X-Cron-Secret: $ALERT_CRON_KEY`              | `firstName`, cart contents, recoveryUrl, etc                            | 3 EmailQueue rows scheduledFor +1h/+24h/+72h                                                                     | step 1 arrives within 5 min after cron fire                        | __           |
| 12 | Browse recovery                             | `browse_recovery_1`                  | Browse a product as known member, leave. Cron `triggerBrowseRecoveryCron` — same X-Cron-Secret invocation                                                                                          | `firstName`, productName, productUrl                                    | EmailQueue row                                                                                                    | email arrives                                                       | __           |
| 13 | Re-engagement (Day 0 / 7 / 21)              | `reengagement_1..3`                  | Existing member with no activity for X days → `triggerReengagementCron` (POST with cron secret)                                                                                                    | `firstName`, etc                                                        | 3 EmailQueue rows                                                                                                | step 1 arrives                                                     | __           |
| 14 | Winback                                     | (CMS-driven; see audit cf-6k6u correction) | `scanAndTriggerWinbackCron` — POST `/_functions/scanAndTriggerWinbackCron` with cron secret. Real templates load from `EmailSequences` Wix Data collection where `sequenceType='winback'` | per CMS row                                                            | EmailQueue rows + `EmailSequences.eq('sequenceType','winback').eq('active',true)` for the source list           | email arrives                                                      | __           |
| 15 | Review-request (orders + 7d)                | `post_purchase_2`                    | `runReviewRequestEmailsCron` (POST with cron secret) for an order placed exactly 7 days ago                                                                                                        | as Row 10                                                              | EmailQueue row                                                                                                    | email arrives                                                       | __           |
| 16 | Wishlist price-drop alerts                  | `wishlist_price_drop`                | Add product to wishlist → reduce its price via Wix Stores admin → `checkWishlistAlerts` cron                                                                                                       | productName, oldPrice, newPrice, productUrl                            | `WishlistAlerts` row + EmailQueue row                                                                            | email arrives                                                      | __           |
| 17 | Tier milestone                              | `tier_*_approach` / `*_achieved`    | Place an order whose loyalty earn crosses a tier threshold (Mountain Guide @ 500 pts, Summit Master @ 2000 pts) → fires from `events.js#wixEcom_onOrderCreated` (cf-8onx)                          | `firstName`, `pointsToNext`, `nextTier`                                | EmailQueue row                                                                                                    | email arrives                                                      | __           |
| 18 | Contact form (owner notification)           | `contact_form_submission`            | Submit cfw `/contact` with `TEST_INBOX_PRIMARY`. POSTs `${STAGING_BASE_URL}/_functions/contactSubmissions`                                                                                       | `customerName`, `customerEmail`, `customerPhone`, `subject`, `message`, `submittedAt` | `ContactSubmissions` row inserted; direct triggered-email send to `SITE_OWNER_CONTACT_ID`                       | owner inbox receives notification                                  | __           |
| 19 | Contact form (customer auto-reply) — cf-hafn | `contact_form_auto_reply`            | Same as Row 18; cf-hafn fires the customer-side auto-reply after the owner notification                                                                                                            | `customerName`, `subject`, `message`, `replyEta`, `supportPhone`, `email` | (direct send)                                                                                                     | submitter inbox receives "We got your message" auto-reply           | __           |
| 20 | Swatch request (owner notification)         | `contact_form_submission`            | POST `${STAGING_BASE_URL}/_functions/sampleRequests` body `{ name, email, address, productId, productName, swatchNames }`                                                                          | as Row 18                                                              | `ContactSubmissions` row + direct send                                                                           | owner inbox                                                        | __           |
| 21 | Swatch request (customer confirmation)      | `swatch_confirmation`                | As Row 20 — but only fires if a CRM contact already exists for the email (F7 gap pending cf-xdji)                                                                                                  | `customerName`, `productName`, `swatchList`, `estimatedArrival`        | (direct send)                                                                                                     | submitter inbox (only if pre-existing CRM contact)                 | __           |
| 22 | Swatch follow-up sequence                   | `swatch_followup_arrived/decide`     | As Row 20 → fast-forward `EmailQueue.scheduledFor` for `sequenceType=swatch_followup` to "now"                                                                                                     | `firstName`, productName, etc                                          | 2 EmailQueue rows                                                                                                | step 1 arrives                                                     | __           |
| 23 | Consultation follow-up                      | `consultation_followup`              | Trigger via consultation-booking flow on staging                                                                                                                                                  | per template                                                            | EmailQueue row                                                                                                    | email arrives                                                      | __           |
| 24 | Newsletter signup → Klaviyo ESP sync        | (handled by Klaviyo)                 | As Row 4 — captures `_syncToESPInternal(...)` fire-and-forget                                                                                                                                      | n/a                                                                     | Klaviyo dashboard search for `TEST_INBOX_PRIMARY`                                                                | profile appears in Klaviyo within 60s                              | __           |
| 25 | Birthday reward                             | `birthday_reward_*`                  | Set test member's birthday to "today" via member-profile API → next `birthdayRewardService` cron run                                                                                                | `firstName`, rewardCode                                                | EmailQueue row                                                                                                    | email arrives                                                      | __           |
| 26 | Gift card delivery                          | `gift_card_delivered_to_buyer`, `gift_card_delivered_to_recipient` | Purchase a test gift card via cfw checkout → `giftCards.web.js` fires both emails                                                                                                                  | per template                                                            | (direct sends — 2 emails)                                                                                         | both recipients receive their email                                | __           |
| 27 | Fabric sample confirmation/fulfillment      | `fabric_sample_confirmation`, `fabric_sample_fulfillment` | Place fabric-sample request on staging → confirmation immediate; fulfillment when shipped                                                                                                          | per template                                                            | 2 sequential triggered-email sends                                                                                | both arrive                                                        | __           |
| 28 | Product Q&A owner alert                     | `OWNER_EMAIL_TEMPLATE` (constant — record observed value) | Submit product Q&A on staging PDP → `productQA.web.js` notifies owner                                                                                                                              | `customerName`, `question`, productName                                | direct send                                                                                                       | owner inbox                                                        | __           |
| 29 | Restock notification                        | `restock_notification`               | Subscribe to back-in-stock for an OOS test SKU → restock the SKU via Wix Stores admin → `wixStores_onInventoryVariantUpdated`                                                                      | `firstName`, productName, productUrl                                    | EmailQueue row                                                                                                    | email arrives                                                      | __           |
| 30 | Review thank-you                            | `review_thank_you`                   | Submit a product review on staging                                                                                                                                                                | `firstName`, productName, discountCode                                  | direct send                                                                                                       | email arrives                                                      | __           |

(Row 31 from the cf-icww table — `processContentScheduleCron` — was removed in the cf-6k6u correction; not an email touchpoint.)

## Send-window note

`emailQueueService.web.js#processQueue` reschedules outside-window items. The window is configurable; staging often runs 24/7 to make probes faster. If a probe fires near a window boundary, the row may show `scheduledFor` bumped to the next open. Document whether staging's window is wide-open (recommended for this run) or matches production.

## Per-row execution recipe (template)

For each numbered row above, the operator runs:

```bash
# 1. Capture baseline EmailQueue count for the touchpoint's recipient
BASELINE=$(curl -s -X GET "..." | jq '.count')

# 2. Fire the trigger (curl OR UI action documented in the row)
... trigger ...

# 3. Wait the documented time (5s for direct sends; cron-cycle for queue-driven)
sleep 5

# 4. Re-query the CMS for the expected row
... cms query ...

# 5. Inspect the inbox (manual or via IMAP grep)
# 6. Fill the row's Pass / Fail column inline
```

Direct sends (Rows 5, 6, 7, 8, 18, 19, 20, 26, 27, 28, 30) skip the EmailQueue check and rely on inbox arrival + Wix's send log in the dashboard's "Marketing → Triggered Emails → Send History" view.

Queue-driven sends (Rows 1, 2, 3, 9, 10, 11, 12, 13, 14, 15, 22, 25, 29) require `processEmailQueue` to be invoked (or the cron that backs it). For staging, POST `/_functions/processEmailQueueCron` with `X-Cron-Secret: $ALERT_CRON_KEY` to manually drain.

## Run-results template

Once all rows land, paste the captured table into a section like this and commit to close cf-w1u1:

```markdown
## Staging run results — YYYY-MM-DD

Runner: <name>
Wix CLI publish ID: <id>
Templates registered (cf-c6g5): YES / NO — list any missing

### Per-row outcomes
- Row 1 (welcome exit-intent): PASS / FAIL — notes
- Row 2 (welcome triggerWelcomeSeries): …
- … (all 30 rows)

### Findings
- F1 (cf-xdji helper) status: …
- F2 (cf-3l0d auto-trigger) status: …
- F6 (cf-hafn auto-reply): PASS / FAIL
- Any new gaps surfaced beyond cf-icww: …
- Templates flagged for cf-c6g5 follow-up (missing variables, broken layout): …

cf-w1u1 acceptance: PASS / PARTIAL / FAIL
```

If any row fails: file a follow-up bead per failure mode (template-side problem → Stilgar; Velo-side problem → godfrey; my audit was wrong → file as cf-w1u1 audit-correction).

## What this doc does NOT cover

- Render fidelity per template (HTML body looks right, brand chrome present, CTA buttons sized + linked correctly). Stilgar's cf-c6g5 acceptance covers that side; this doc covers DISPATCH (the right template fires with the right variables to the right recipient at the right time).
- Spam-folder placement / deliverability metrics. Klaviyo dashboard + a Mailtrap / SendForensics run on representative templates is a separate workstream.
- Multi-language localisation. All templates are English-only on staging today.
- Throttling under burst load. The 5-min window for `EmailQueueRateLimit` may bunch sends if a probe runs all 30 rows within minutes — pace the run if Wix's dashboard reports rate-limit holds.

## References

- `docs/email-audit-2026-05-04.md` — source of the touchpoint inventory + per-row anchors
- `docs/qa/challenge-reward-e2e-2026-05-05.md` — companion runbook (gamification path) using the same probe pattern
- cf-icww (audit), cf-6k6u (audit corrections), cf-jmmk (onOrderDelivered wiring), cf-fovb (multi-shipment wiring), cf-hafn (contact_form_auto_reply), cf-3l0d (subscribeToNewsletter auto-trigger), cf-xdji (resolveContactId helper) — fix beads referenced inline
