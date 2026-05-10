# webMethod permissions audit — Anyone + writes — 2026-05-10

**Bead:** cf-32u1
**Auditor:** rennala
**Method:** Multi-line perl regex over `src/backend/*.web.js` to extract `(name, Permissions.X, body)` triples from every `webMethod(...)` definition. Cross-referenced the `Permissions.Anyone + body contains wixData.{insert,update,save,bulkInsert,bulkUpdate,remove}` intersection against the canonical `checkRateLimit` import. Spot-checked the resulting "anonymous-writable, no canonical rate-limit" set.
**Pre-cutover scope:** any `Permissions.Anyone` webMethod that mutates state without rate-limit is exposed to anonymous spam / cost amplification at cutover.

## TL;DR

**907 webMethod definitions across `src/backend/*.web.js`:**
- 441 `Permissions.Anyone` (public, no auth required)
- 230 `Permissions.SiteMember`
- 236 `Permissions.Admin`

**60 of the 441 `Permissions.Anyone` methods write to wixData.** Of those:
- ~30 have canonical `checkRateLimit` protection
- ~6 have local rate-limit re-implementations (wixData-backed, mostly safe)
- ~24 reach `wixData.{insert,update}` without a visible rate-limit guard

**Two P2 findings** with concrete cutover risk + three lower findings.

## Inventory

### Permission distribution
| Permission | Count | Risk class |
|------------|-------|------------|
| `Permissions.Anyone` | 441 | Public — must self-protect (input validation + rate-limit + auth-on-mutation as appropriate) |
| `Permissions.SiteMember` | 230 | Wix-managed auth — calling member identity available via `getMember()` |
| `Permissions.Admin` | 236 | Admin-only — Wix Studio editor / dashboard tools |

### Anyone + writes (60 methods)
Domains:
- **Telemetry / tracking** (~22): `analyticsHelpers`, `abTesting`, `browseAbandonment`, `checkoutOptimization`, `conversionFunnel`, `coreWebVitals`, `customEvents`. Most have rate-limit. Fire-and-forget shape.
- **Session / cart** (~6): `cartSessionService`, `collaborativePlanner`, `guestCheckout`, `liveShowroom`. **Mostly no rate-limit.**
- **CRM / contact capture** (~8): `contactSubmissions`, `swatchRequest`, `priceAlertService`, `inventoryService` (back-in-stock), `unsubscribeService`, `emailService`, `dataService` (review submit), `communityPhoto`. Mixed coverage.
- **Scheduling / booking** (~3): `deliveryScheduling.bookAppointment/cancelAppointment`, `whiteGloveScheduling.requestBooking`. Local rate-limits.
- **AI / generation** (~2): `roomStaging.generateStagedRoom`, `chatbotService.sendMessage`. **No rate-limit on roomStaging.**
- **Misc public mutations** (~19): bundle add, futon-sommelier rate, gift-registry purchase, etc.

### Anyone + writes WITHOUT canonical `checkRateLimit` (24 methods)
| File | Method | Real protection? |
|------|--------|------------------|
| `cartSessionService.web.js` | `createSession` | None visible |
| `cartSessionService.web.js` | `updateCartItems` | None visible |
| `cartSessionService.web.js` | `mergeGuestCart` | None visible |
| `chatbotService.web.js` | `sendMessage` | Has its own gate via CHATBOT_ENABLED + (per cf-3ldu) gamificationRateLimit wrapper for some paths |
| `collaborativePlanner.web.js` | `createSession` | None visible — **F3** |
| `collaborativePlanner.web.js` | `joinSession` | None visible — **F3** |
| `collaborativePlanner.web.js` | `placeItem` | None visible — **F3** |
| `collaborativePlanner.web.js` | `moveItem` | None visible — **F3** |
| `collaborativePlanner.web.js` | `removeItem` | None visible — **F3** |
| `contentScheduler.web.js` | `processContentSchedule` | Cron-key auth (CONTENT_CRON_KEY) — not really anonymous, schedule-driven |
| `deliveryScheduling.web.js` | `bookAppointment` | Local `_checkBookingRateLimit` (wixData-backed) — **F4** plaintext-key |
| `deliveryScheduling.web.js` | `cancelAppointment` | Local `_checkCancellationRateLimit` (wixData-backed) |
| `emailService.web.js` | `sendEmail` | Local `EmailRateLimit` (wixData-backed) |
| `emailService.web.js` | `submitSwatchRequest` | Inherits `_checkRateLimit` per surrounding code |
| `futonSommelier.web.js` | `rateRecommendation` | None visible (read-only side-effect — rating saved) |
| `guestCheckout.web.js` | `saveGuestSession` | None visible |
| `liveShowroom.web.js` | `reserveShowroomPiece` | None visible |
| `liveShowroom.web.js` | `checkReservation` | None visible (read) |
| `priceAlertService.web.js` | `subscribe` | None visible |
| `priceAlertService.web.js` | `unsubscribe` | None visible |
| `protectionPlan.web.js` | `removeProtectionPlan` | None visible |
| `rewardsStore.web.js` | `getRewardsCatalog` | None visible (read-only-ish) |
| `roomStaging.web.js` | `generateStagedRoom` | None visible — **F2** AI cost amplification |
| `swatchRequest.web.js` | `submitSwatchRequest` | None visible — **F1** |

## Findings

### F1 (P2) — `swatchRequest.submitSwatchRequest` has no rate-limit; anonymously writes 3 collections + upserts CRM contact
**Where:** `src/backend/swatchRequest.web.js:175` (`Permissions.Anyone`).

**Body writes:**
- `wixData.insert('SwatchRequests', record)` — line 216
- `wixData.insert('EmailQueue', {...})` — line 143 (queues a confirmation email)
- `upsertContact(contact)` — Wix CRM contact create/update

**Why P2:** anonymous attacker can call this endlessly with rotating fake emails to:
- Bloat the SwatchRequests collection
- Pollute Wix CRM contacts (which counts toward Wix's contact quota — costs $)
- Queue confirmation emails to the spoofed addresses (bounce = sender-rep hit on the cfutons mail domain)

**Note** input validation (`validateContact`, `validateSwatchIds`) is present and reasonably tight, so the attacker can't inject SQL or XSS — the risk is pure-volume spam, not exploit.

**Fix:** add `checkRateLimit('SwatchRequestRateLimit', email, { max: 5, windowMs: 3_600_000 })` at the top of the body. The collection name `SwatchRequestRateLimit` is already in use (per cf-3ldu inventory at `http-functions.js:3208`); reuse the bucket. ~3 lines of churn.

**Cross-ref:** cf-icww (email touchpoints audit) may have already flagged the email-queue-via-anonymous-write angle. Recommend the fix lands as a separate small PR before cutover.

### F2 (P2) — `roomStaging.generateStagedRoom` is anonymous, no rate limit, hits AI image API
**Where:** `src/backend/roomStaging.web.js` (line near top, `Permissions.Anyone`).

**Body:**
- Reads `wixData.get('Stores/Products', productId)` (cheap)
- Calls **`AI_IMAGE_API`** with `AI_IMAGE_API_KEY` (per cf-7pd6 secrets audit)
- Writes `STAGING_CACHE_COLLECTION`

**Why P2 (cost-axis, not security):** AI image generation APIs typically charge per-call. An anonymous attacker — or just a bot crawl with a known endpoint — can exhaust the AI image budget in one session. The cache collection insert mitigates duplicates but the cache key is `(roomImageUrl, productId)` so unique imageUrls bypass the cache trivially.

**Fix options (pick one):**
1. **Add canonical rate-limit:** `checkRateLimit('RoomStagingRateLimit', sessionId, { max: 5, windowMs: 3_600_000 })`. Need a sessionId axis since email may not be available at this surface — `request.headers['x-session-id']` or fall back to extracted IP via `extractTrustedClientIp()`.
2. **Gate behind SiteMember auth** if room-staging is a logged-in feature only.
3. **Daily cap on the AI_IMAGE budget** with a circuit-breaker that returns 503 once exceeded — best for cost control regardless of attacker model.

Recommend (1) for cutover-readiness + add (3) post-cutover as defense-in-depth.

### F3 (P3) — `collaborativePlanner.web.js` exposes 5 anonymous mutators with no rate-limit
**Where:** `createSession`, `joinSession`, `placeItem`, `moveItem`, `removeItem` — all `Permissions.Anyone`, all write wixData.

**Why P3:** lower-impact than F1/F2 because:
- The collection is project-style ("rooms" with placed items) and likely ephemeral
- No PII captured at session creation (sessionId only)
- No outbound email or external-API spend

**Risk vector:** sustained calls bloat the planner-session collection. Wix Velo's wixData has implicit storage limits per collection. At cutover scale + bot traffic, could hit a wall.

**Fix:** add `checkRateLimit('CollabPlannerRateLimit', sessionId, { max: 60, windowMs: 60_000 })` to the 5 mutators. Same `RateLimit` collection name pattern. ~15 lines total.

### F4 (P3) — `deliveryScheduling._checkBookingRateLimit` stores plaintext email at rest
**Where:** `src/backend/deliveryScheduling.web.js:481` — local rate-limit helper that does:
```js
const cleanKey = sanitize(email, 254).toLowerCase();
await wixData.insert(BOOKING_RL_COLLECTION, { key: cleanKey, ...
```

**Issue:** the canonical helper at `utils/rateLimit.js` hashes keys before storing (FNV-1a, line 86-93) per cf-sec1 CMEK compliance. This local re-impl skips the hash, so the booking rate-limit collection contains plaintext customer emails that aren't strictly necessary for the rate-limit logic.

**Why P3 not P2:** Wix-side data-at-rest encryption is on by default; this isn't an open leak. It's a CMEK / privacy-by-design compliance gap rather than a runtime vulnerability.

**Fix:** import `hashRateLimitKey` from `utils/rateLimit` and apply it before insert. Better fix: replace the whole local helper with `checkRateLimit('BookingRateLimit', email, ...)` (same path as cf-3ldu F1/F4 recommendations). Defer to post-cutover hardening sweep.

### F5 (informational) — Anyone-readers may not need explicit listing
**Observation:** the audit only crawled writes. The 441 `Permissions.Anyone` total includes ~380 read-only methods (catalog reads, content fetches, blog posts). These are generally fine — they're meant to be public — but a separate sweep could check for accidental exposure of admin-internal collections via `Permissions.Anyone` reads. Out of scope for this audit.

## Pre-cutover acceptance (cf-3qt.8)

Before DNS flip:
- [ ] **F1 fix** — `swatchRequest.submitSwatchRequest` rate-limited (5/hr per email, reuse `SwatchRequestRateLimit` collection).
- [ ] **F2 fix** — `roomStaging.generateStagedRoom` rate-limited OR gated to SiteMember OR daily-cap circuit-breaker on AI image spend.
- [ ] (optional) **F3 fix** — collaborativePlanner 5-mutator rate-limit (~15 LOC).
- [ ] (optional) **F4** — booking rate-limit migrated to canonical helper (post-cutover OK).

Deferred:
- F5 — exhaustive `Permissions.Anyone` read-side audit. Separate bead if PM wants it.

## Out of scope (file separately if needed)

- **Auth-on-mutation review** — many `Permissions.SiteMember` webMethods accept user-supplied IDs that aren't always validated against the calling member (IDOR risk surface). Separate audit.
- **Admin-method exposure** — 236 `Permissions.Admin` methods. By Wix's auth model these require admin role; verify nothing accidentally `Anyone` that shouldn't be (already covered here for the writes).
- **SiteMember + writes** review — same intersection as Anyone+writes but at the SiteMember tier; possible IDOR (e.g., updating a record by ID without checking owner). Separate audit.
- **cfw-side webMethod proxy security** — cf-vtx5 dispatchers + cf-uwfw HTTP wrappers each forward client-supplied payloads to webMethods; allowlist correctness is a separate scope (partially covered by cf-jqkg).

## References

- `src/backend/utils/rateLimit.js` (canonical helper — hashes keys per cf-sec1)
- cf-3ldu (rate-limit audit) — companion piece; F1 of this audit reuses bucket `SwatchRequestRateLimit` from cf-3ldu inventory
- cf-7pd6 (secrets) — `AI_IMAGE_API_KEY` powers F2's cost concern
- cf-icww (email touchpoints) — flags the swatch-confirmation queue path
- cf-jqkg (cfw→Velo HTTP gaps) — cfw-side allowlist of which webMethods the proxy can call
- cf-3qt.8 (DNS cutover, in_progress) — this audit feeds the Phase-8 readiness checklist
