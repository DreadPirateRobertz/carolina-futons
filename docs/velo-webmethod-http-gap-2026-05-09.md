# Velo webMethod ↔ HTTP-wrapper gap audit — 2026-05-09

**Bead:** cf-jqkg
**Auditor:** rennala
**Method:** Static analysis of `src/backend/**/*.web.js` exports vs `src/backend/http-functions.js` HTTP exports + cross-reference with cfw (`carolina-futons-web`) production call sites.
**Precedent:** godfrey's cf-w1lg discovery (5 missing `/_functions` endpoints in stage3-velo) and rennala's cf-icww F3/F4/F5 (handlers in wrong file). Same shape: code-shaped-correctly-but-unreachable.

## TL;DR

**3 concrete cfw→Velo gaps** where cfw calls a flat `_functions/<name>` URL and Velo has no matching `get_<name>`/`post_<name>` handler. All three are P1: each represents user-facing functionality silently 404-ing in production.

| # | URL                                  | cfw call site                                  | Closest Velo backend                                          | Gap class |
|---|--------------------------------------|------------------------------------------------|---------------------------------------------------------------|-----------|
| 1 | `_functions/recordSpinGrant`         | `src/app/actions/spin.ts#spinWheel`            | `spinRedemptionService.web.js#grantSpin` (function, not webMethod) | **No HTTP wrapper, no webMethod** — needs new wrapper that calls `grantSpin` |
| 2 | `_functions/submitCommunityPhoto`    | `src/app/community-gallery/actions.ts#submitCommunityPhoto` | (no related backend module on cfutons main) | **No backend at all** — needs new collection (`CommunityGallery`?) + handler |
| 3 | `_functions/submitSurvey`            | `src/app/actions/survey.ts#submitSurvey`       | `surveyService.web.js#submitSurveyResponse` (webMethod)        | **webMethod exists, HTTP wrapper missing** — wrap `submitSurveyResponse` (NPS field-name shim required) |

A 4th + 5th candidate (`_functions/contact`, `_functions/wishlistService/...`) are non-issues — see §"Non-gaps".

The wider question — should the 19 `callVelo({ method: '<module>/<method>' })` production paths surface as gaps too — depends on a load-bearing **assumption** about Wix Velo's runtime behaviour. See §"Load-bearing assumption" below.

## Concrete gaps

### Gap 1 — `_functions/recordSpinGrant` (P1)
**Caller:** `carolina-futons-web/src/app/actions/spin.ts#spinWheel` (lines 56–66) — fire-and-forget after a successful spin.

**Velo state:** `src/backend/spinRedemptionService.web.js` exports `grantSpin(memberId)` as a plain async function. No HTTP wrapper at `post_recordSpinGrant`. No webMethod with that name. Comment in `spin.ts` already concedes this: *"the Velo function can be wired later"*.

**User-visible impact:** spins display to users (cfw randomizes locally) but no `SpinGrants` row is recorded. If the prize is meant to be redeemable later (the comment in `spin.ts` and the existence of `redeemSpin(memberId, spinId, ...)` both suggest yes), the customer never sees the prize land in their account.

**Fix recipe:**
1. Add `post_recordSpinGrant(request)` in `src/backend/http-functions.js` that:
   - Reads `currentMember.getMember()` for memberId (cfw forwards no auth header on this fire-and-forget call — see `spin.ts` — so this needs a path or token-based identity, OR cfw must be updated to forward the bearer token).
   - Validates `prizeId` against `SPIN_PRIZES` IDs.
   - Calls `grantSpin(memberId)` — already idempotent / 30-day expiry built in.
   - Returns `{success: true, spinId}` for diagnostics.
2. Add `options_recordSpinGrant` for CORS preflight (matches the existing pattern at `options_trackCustomEvent`).
3. Update `spin.ts` to forward the member's accessToken, OR scope `recordSpinGrant` to anonymous and use a session cookie nonce to prevent replay.

### Gap 2 — `_functions/submitCommunityPhoto` (P1)
**Caller:** `carolina-futons-web/src/app/community-gallery/actions.ts#submitCommunityPhoto`. Posts `{ imageUrl, customerName, location, caption, productSlug }` and expects `{ success: boolean, error?: string }`.

**Velo state:** No backend module references "communityPhoto" anywhere in `src/backend/`. No `CommunityGallery` CMS collection mentioned in the codebase.

**User-visible impact:** the community-gallery submission UI returns a generic "Network error — please check your connection" because the fetch resolves with the Wix 404 HTML body, JSON.parse throws, and the catch block surfaces the network-error fallback. Submitters see a contradictory error after a successful upload.

**Fix recipe:**
1. Stilgar / mayor decision needed: where does the community-gallery photo storage live? Wix Stores doesn't have a native gallery collection; this either needs a custom CMS collection or external storage (Cloudinary etc.).
2. Once collection exists: add `post_submitCommunityPhoto(request)` that validates fields (URL safety on `imageUrl`, length caps on text fields), inserts a row with `status='pending'` for moderation, returns `{success: true}`.
3. Owner-side moderation flow (out of scope for this gap fix — file separately).

### Gap 3 — `_functions/submitSurvey` (P1)
**Caller:** `carolina-futons-web/src/app/actions/survey.ts#submitSurvey`. Posts `{ score, comments, orderId }` (numeric NPS score 0–10).

**Velo state:** `src/backend/surveyService.web.js#submitSurveyResponse` is a webMethod that does the right thing, but it expects a different argument shape and lacks an HTTP wrapper. Also, `currentMember.getMember()` is required by the webMethod for IDOR guarding — fire-and-forget without a bearer token won't authenticate.

**User-visible impact:** cfw NPS form returns the generic error from `survey.ts:42`. Customer sees "Couldn't save your response", post-purchase NPS feedback isn't captured.

**Fix recipe:**
1. Add `post_submitSurvey(request)` in `http-functions.js`:
   - Parse body `{ score, comments, orderId }`
   - Validate: `score` is integer 0–10, `comments` ≤ 2000 chars, `orderId` matches `validateId`
   - Look up the `Survey` row for `orderId` (per `surveyService.web.js#getSurveyForOrder` shape) to confirm the survey is open + addressed to the caller
   - Map cfw shape → webMethod shape: `submitSurveyResponse({ surveyId, score, comments })`
   - Return `{success: true}` on success
2. cfw must forward the member's accessToken so `currentMember.getMember()` works in the webMethod's IDOR check.
3. Add `options_submitSurvey` for CORS preflight.

## Non-gaps (clarified during audit)

- **`_functions/contact`** — only referenced as a scaffolded comment (`src/app/actions/contact.ts:4` says *"blaidd wires Velo /_functions/contact in cf-3qt.4"*) and a placeholder error string. The actual contact form uses `_functions/contactSubmissions`, which exists.
- **`_functions/wishlistService/getWishlist`** etc. — appears only in test fixture files (`src/__tests__/velo-client.test.ts`). Production cfw uses the `callVelo({ method: 'wishlistService/getWishlist' })` shape, which depends on the load-bearing assumption below.
- **`_functions/x`** — bogus capture from a regex test fixture URL.

## Load-bearing assumption — sub-path-routed callVelo

`carolina-futons-web/src/lib/wix/velo-client.ts#callVelo` posts to `/_functions/<module>/<method>` (e.g. `/_functions/loyaltyService/getMyLoyaltyAccount`) with body `{ args: [...] }`. **No corresponding `get_loyaltyService` / `post_loyaltyService` handler exists in `http-functions.js`** for any of the 19 production `<module>/<method>` paths cfw uses:

| Module | Methods called from cfw |
|---|---|
| `gamificationCore` | `getActiveChallenges`, `getActivityFeed`, `getLeaderboard`, `receiveGamificationEvent`, `recordChallengeProgress` |
| `loyaltyService` | `getLeaderboard`, `getMyActivity`, `getMyLoyaltyAccount`, `redeemReward` |
| `pushNotificationService` | `getMyPushPreferences`, `managePushPreferences` |
| `referralService` | `getMyReferralCode`, `getReferralByCode` |
| `styleQuiz` | `captureQuizLead`, `getPersonalizedCopy`, `getQuizRecommendations` |
| `wishlistService` | `addToWishlist`, `getWishlist`, `getWishlistByMemberId` |

There are two readings:

**(A) Wix auto-routes `/_functions/<module>/<method>` to the corresponding webMethod export of `<module>.web.js`.** All of the modules above export webMethods with the called names — this would explain why this pattern is used pervasively in cfw without explicit wrappers. The body shape `{ args: [...] }` matches Wix's webMethod RPC convention exactly. If this auto-routing exists, the 19 paths are not gaps.

**(B) The 19 paths are silently 404-ing in production.** Catastrophic — every loyalty / gamification / wishlist / referral / quiz feature on cfw is broken.

**I cannot confirm (A) vs (B) statically.** The asymmetry — production presumably works; the cfw test suite asserts the URL shape; Velo's `request.path` array is a documented mechanism for sub-path routing — strongly suggests (A) is what's happening. But (A) requires either an undocumented Wix runtime behaviour or a Velo-side dispatcher I missed.

**Verification step (Stilgar / mayor):** smoke-test ONE of these paths from cfw and inspect the response status. `/_functions/loyaltyService/getMyLoyaltyAccount` is a low-risk read with body `{ args: [] }` — if (A), it returns the loyalty account JSON; if (B), 404. Confirm before accepting this audit's "non-gap" classification of the 19 paths.

If (B) turns out to be the truth, the 19 paths each need a `get_<module>` / `post_<module>` dispatcher that:
1. Reads the method name from `request.path[0]`
2. Looks up the corresponding webMethod from a registry
3. Forwards body args + auth, calls it, returns the result

That's a P0 priority bead — escalate immediately on confirmation.

## Bulk stats (raw output for reference)

- Total webMethods across `src/backend/**/*.web.js`: **1041** in 222 files
- By permission: Anyone **482**, SiteMember **271**, Admin **288**
- With explicit HTTP wrapper (`(get|post|options)_<webMethodName>`): **8**
- Imported by name into `http-functions.js` (proxied): **35**
- Anyone/SiteMember webMethods with neither wrapper nor proxy: **726**

The 726-figure is misleading on its own — most internal-facing webMethods are reached from page code within Wix Studio, where Wix's `web-modules` system auto-bridges. This audit deliberately scopes only to **cfw → Velo** reachability, which is what the load-bearing assumption above governs. Raw enumeration data lives at `/tmp/cf-jqkg-audit-output.md` if anyone wants to drill in further.

## Recommended fix order

1. **Resolve the load-bearing assumption.** Stilgar runs the smoke test; if (B), file P0 dispatcher bead immediately.
2. **Gap 1 (recordSpinGrant)** — straightforward HTTP wrapper around `grantSpin`. Spin redemption is half-built; this completes the loop.
3. **Gap 3 (submitSurvey)** — wrapper around existing `submitSurveyResponse` webMethod with field-name shim.
4. **Gap 2 (submitCommunityPhoto)** — needs Stilgar/mayor decision on storage backend before code work.

## Method appendix

Audit script lives at `/tmp/cf-jqkg-audit.js` (not committed — single-use). Reproduce with:
```
node /tmp/cf-jqkg-audit.js /Users/hal/gt/cfutons/crew/rennala
# Output: /tmp/cf-jqkg-audit-output.md
```
Key matchers:
- webMethod regex: `^export const (\w+)\s*=\s*webMethod\s*\(\s*(?:\n\s*)?Permissions\.(\w+)`
- HTTP wrapper regex: `^export\s+(?:async\s+)?function\s+((?:get_|post_|options_)\w+)`
- cfw URL extraction: `grep -rEoh '_functions/[A-Za-z_][A-Za-z0-9_-]*' carolina-futons-web/src/`
- cfw callVelo path extraction: `grep -rEoh 'method:\s*["`+ "`" + `][a-zA-Z]+/[a-zA-Z]+' carolina-futons-web/src/`
