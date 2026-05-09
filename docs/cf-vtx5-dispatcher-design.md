# cf-vtx5 design proposal — module dispatcher pattern

**Bead:** cf-vtx5
**Author:** rennala (paired with godfrey)
**Status:** proposal — godfrey picks pattern, executes the rest
**Refs:** cf-jqkg audit (PR #1160), godfrey's cf-w1lg (5 wrappers) and cf-foo0 fix patterns

## Problem recap

cfw's `callVelo` posts to `/_functions/<module>/<method>` with body `{args: [...]}`. 22 routes are 404-ing because no Velo `get_<module>` / `post_<module>` handlers exist. Every loyalty / gamification / wishlist / referral / quiz / push call from cfw is currently broken.

Affected modules and method counts:

| Module                    | Methods called from cfw                                         | Webmethod self-guards? |
|---------------------------|------------------------------------------------------------------|------------------------|
| `gamificationCore`        | `getActiveChallenges`, `getActivityFeed`, `getLeaderboard`, `receiveGamificationEvent`, `recordChallengeProgress` | yes (most) |
| `loyaltyService`          | `getLeaderboard`, `getMyActivity`, `getMyLoyaltyAccount`, `redeemReward` | yes |
| `wishlistService`         | `addToWishlist`, `getWishlist`, `getWishlistByMemberId`           | yes — `currentMember.getMember()` first line |
| `referralService`         | `getMyReferralCode`, `getReferralByCode`                         | mixed |
| `styleQuiz`               | `captureQuizLead`, `getPersonalizedCopy`, `getQuizRecommendations` | mixed (Anyone for capture) |
| `pushNotificationService` | `getMyPushPreferences`, `managePushPreferences`                  | yes |
| (flat URLs)               | `recordSpinGrant`, `submitCommunityPhoto`, `submitSurvey`         | n/a — gap 1/2/3 from cf-jqkg |

= 19 sub-path routes + 3 flat-URL routes = 22.

## Two patterns

### Pattern A — 22 individual handlers (godfrey's cf-w1lg pattern)
Each route gets its own `post_<name>` handler that imports the webMethod and calls it.

```js
// http-functions.js
import { addToWishlist } from 'backend/wishlistService.web';
export async function post_addToWishlist(request) {
  try {
    const { args = [] } = await request.body.json();
    const result = await addToWishlist(...args);
    return ok({ body: JSON.stringify(result), headers: jsonHeaders(request) });
  } catch (err) {
    return serverError({ body: JSON.stringify({ success: false, error: err.message }), headers: jsonHeaders(request) });
  }
}
```

But cfw posts to `/_functions/wishlistService/addToWishlist`, NOT `/_functions/addToWishlist`. To use Pattern A, **cfw's `callVelo` must change** — drop the module prefix, post to `/_functions/<method>` only. That's a one-line change in `carolina-futons-web/src/lib/wix/velo-client.ts` and a test fixture refresh.

**Pros:**
- Mirrors existing cf-w1lg / cf-foo0 fix shape; godfrey already comfortable with it.
- Each route has explicit per-method validation, error mapping, CORS headers, rate-limit logic.
- Method-name collisions across modules become explicit (`getLeaderboard` exists in both `gamificationCore` and `loyaltyService` — Pattern A forces a disambiguating prefix anyway).

**Cons:**
- 22 near-identical handlers.
- Requires a coordinated cfw change (drop module prefix).
- Method-name collisions need rename in cfw + Velo (`getGamificationLeaderboard` vs `getLoyaltyLeaderboard`).

### Pattern B — One dispatcher per module (`request.path[0]` routing)
One handler per module that reads `request.path[0]` (the method name) from the URL and calls the matching webMethod.

```js
// http-functions.js
import * as wishlistService from 'backend/wishlistService.web';
const WISHLIST_PUBLIC_METHODS = new Set([
  'addToWishlist', 'removeFromWishlist', 'getWishlist',
  'getWishlistByMemberId', 'isOnWishlist',
]);
export async function post_wishlistService(request) {
  const method = request.path?.[0] || '';
  if (!WISHLIST_PUBLIC_METHODS.has(method)) {
    return notFound({ body: JSON.stringify({ error: 'unknown_method', method }), headers: jsonHeaders(request) });
  }
  try {
    const { args = [] } = await request.body.json();
    const result = await wishlistService[method](...args);
    return ok({ body: JSON.stringify(result), headers: jsonHeaders(request) });
  } catch (err) {
    return serverError({ body: JSON.stringify({ success: false, error: err.message }), headers: jsonHeaders(request) });
  }
}
export function options_wishlistService(request) { return response(corsPreflight(request)); }
```

**Pros:**
- 6 handlers (one per module) instead of 19, plus 3 standalone for the flat-URL gaps.
- **No cfw change needed** — `callVelo`'s `/_functions/<module>/<method>` URL already matches the `request.path[0]` pattern.
- Adding a new webMethod to a module = add the name to its allowlist (one line); no new HTTP wrapper.
- Method-name collisions across modules don't exist — namespacing comes for free.

**Cons:**
- Per-method validation has to live inside the webMethod (most already do).
- The allowlist is a small ongoing maintenance burden — but it's also a security feature (explicit "what's reachable from cfw") that Pattern A lacks.
- Slightly different shape from cf-w1lg; new pattern to learn.

## Recommendation: **Pattern B**

- Avoids the cfw refactor (cfw's `callVelo` was already designed around the `<module>/<method>` shape).
- Cuts the wrapper count from 22 to 9 (6 module dispatchers + 3 flat-URL handlers for `recordSpinGrant`, `submitCommunityPhoto`, `submitSurvey`).
- The allowlist makes "what cfw can call" auditable from a single place per module, which is exactly what would have prevented the cf-jqkg silent-404 surface in the first place.
- godfrey's cf-w1lg / cf-foo0 patterns still apply *inside* the dispatcher for body parsing + error mapping; the only new shape is the `request.path[0]` router prefix.

## Reference implementation — `wishlistService` dispatcher

Posted on this branch as a working draft (NOT for merge — godfrey owns the final shape). See `src/backend/http-functions.js` diff for `post_wishlistService` + `options_wishlistService` + matching tests in `tests/wishlistServiceDispatcher.cfvtx5.test.js`.

Validation pattern the dispatcher applies:
1. Ensure `request.path[0]` exists and is in the per-module allowlist Set.
2. Parse body as JSON; require `args` to be an Array (callVelo always sends an Array).
3. Spread `...args` into the webMethod call.
4. Forward the webMethod's return value verbatim — webMethods already use `{success, error}` envelopes consistently.
5. CORS handled the same way as `options_trackCustomEvent` (existing pattern).

## Auth / permissions

Wix's `webMethod` permission gating only applies to **client-side** calls; backend-to-backend calls (which is what an HTTP function → webMethod call is) bypass permission checks. **The dispatcher does not enforce permissions** — it relies on each webMethod's own `currentMember.getMember()` self-guard.

For each module, godfrey should verify every method in its allowlist self-guards before adding it. Spot check: `addToWishlist` line 51 calls `currentMember.getMember()` — ✅. If a method doesn't self-guard, either add the guard inside the webMethod, or skip the method (don't add to allowlist).

For Anyone-permission webMethods (e.g. `styleQuiz#captureQuizLead`), no member guard is needed — they're intentionally callable anonymously. Existing rate-limit code in those methods continues to work.

## Sequencing (proposed)

1. **rennala** — push the `wishlistService` reference implementation + tests on `cf-vtx5-pair-rennala-design`. Hand off.
2. **godfrey** — review Pattern A vs B, pick. If B, replicate the wishlistService shape across `gamificationCore`, `loyaltyService`, `referralService`, `styleQuiz`, `pushNotificationService`. For each: enumerate webMethods, decide allowlist, add dispatcher + options preflight + tests.
3. **godfrey** — fold in the 3 flat-URL gaps from cf-jqkg (`recordSpinGrant`, `submitSurvey`, `submitCommunityPhoto`) — those don't fit the dispatcher pattern; they're standalone wrappers per cf-w1lg.
4. **smoke verify on staging** — Stilgar repeats the 4-route probe; expects 200 instead of 404.

## Cross-cutting decisions godfrey owns

- Whether to enforce a strict `Permissions.Anyone`-only allowlist at the HTTP boundary, OR rely entirely on webMethod self-guards. (My recommendation: rely on self-guards but add a comment in each dispatcher pointing at this audit doc so future maintainers know why permission checks aren't duplicated.)
- Whether the dispatcher should rate-limit at the module level. (Most webMethods already rate-limit individually; module-level rate-limit could double-charge legitimate users. Recommend leaving rate-limit to the webMethod.)
- Method-name allowlist additions for newly-shipped webMethods — process: PR-time review of any new webMethod with `Permissions.Anyone` or `Permissions.SiteMember`, decision recorded in commit message.

## Melania review-pass addenda (2026-05-09)

### CORS — use `backend/utils/cors.js` (godfrey's cf-w1lg helper)

Every dispatcher and standalone wrapper **must** route CORS through `corsHeaders(request, …)` and `corsPreflight(request)` from `backend/utils/cors.js`. The reference implementation does this at:
- `post_wishlistService` line ~1: `corsHeaders(request, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'})`
- `options_wishlistService`: `response(corsPreflight(request))`

The helper handles the Vercel preview wildcard (`carolina-futons-web-git-<branch>-...`), localhost dev, and the production cfw domain — re-implementing it inline would drift. Don't hand-roll Access-Control-Allow-Origin headers in any new dispatcher.

### Field-name shim pattern (for standalone wrappers — cf-jqkg gap 3)

Standalone wrappers (the 3 flat-URL gaps + any future cfw direct-fetch endpoint) often face a payload-shape mismatch between cfw and the Velo webMethod. The shim lives in the wrapper, not the webMethod, so the webMethod's contract stays stable for any other (Wix-internal) callers.

**Worked example: `post_submitSurvey`** (cf-jqkg gap 3)

cfw posts (per `carolina-futons-web/src/app/actions/survey.ts`):
```json
{ "score": 9, "comments": "delivery was fast", "orderId": "ord-123" }
```

`surveyService.web.js#submitSurveyResponse(data)` expects:
```json
{ "orderId": "ord-123", "npsScore": 9, "comment": "delivery was fast" }
```

Shim shape inside the wrapper:
```js
export async function post_submitSurvey(request) {
  const JSON_HEADERS = corsHeaders(request, { 'Content-Type': 'application/json' });
  let body;
  try {
    body = await request.body.json();
  } catch (_) {
    return badRequest({ body: JSON.stringify({ success: false, error: 'invalid_json' }), headers: JSON_HEADERS });
  }
  // cf-vtx5 shim: translate cfw payload shape → submitSurveyResponse contract
  const veloPayload = {
    orderId: body.orderId,
    npsScore: body.score,        // cfw "score" → Velo "npsScore"
    comment: body.comments ?? '', // cfw "comments" → Velo "comment"
  };
  try {
    const result = await submitSurveyResponse(veloPayload);
    return ok({ body: JSON.stringify(result), headers: JSON_HEADERS });
  } catch (err) {
    /* errorId pattern from cf-gkgo */
  }
}
```

**Discipline:** every shim line gets a `// cfw "<field>" → Velo "<field>"` comment so the next maintainer can audit the mapping at a glance. If a shim grows more than 5 lines, the cfw payload is probably mis-shaped — escalate the cfw PR back to fix the source rather than carrying the divergence forever.

### Auth gating — Wix session token verification

cfw's `callVelo` forwards `Authorization: Bearer <accessToken>` when the caller passes an `accessToken` (e.g. `loyaltyService` paths in `carolina-futons-web/src/app/actions/loyalty.ts`). Inside the Velo runtime, `currentMember.getMember()` reads from either the Wix session cookie OR the bearer token — so SiteMember webMethods that already self-guard via `currentMember.getMember()` work without dispatcher-side changes.

**Three classes of cfw call shape, by auth posture:**

| Class                   | cfw signal                                         | Dispatcher / wrapper duty                                                            | Example modules / gaps        |
|-------------------------|----------------------------------------------------|--------------------------------------------------------------------------------------|--------------------------------|
| **Authenticated**        | `accessToken` passed to `callVelo`; `Authorization: Bearer …` header | None — webMethod self-guards via `currentMember.getMember()`. Just verify allowlist  | `loyaltyService`, `gamificationCore`, `wishlistService`, `pushNotificationService`, authenticated `referralService` |
| **Anonymous (rate-limited)** | No `accessToken`; cfw rate-limits at the action layer | None — webMethod is `Permissions.Anyone` and rate-limits internally                  | `styleQuiz#captureQuizLead`, `submitCommunityPhoto` (gap 2), `submitSurvey` (gap 3 — but see note) |
| **Mixed**                | cfw passes accessToken when available, falls back to anon | Webmethod must distinguish — return `{success:false, error:'auth_required'}` for anon when feature requires it | `referralService#getMyReferralCode` (auth) vs `getReferralByCode` (anon) |

**Gotcha for `submitSurvey`:** the webMethod (`submitSurveyResponse`) is `Permissions.SiteMember` and IDOR-guards via `currentMember.getMember()` to confirm the surveyed order belongs to the caller. cfw's `survey.ts` currently makes a direct fetch WITHOUT forwarding the bearer token — so the wrapper will return `{success: false, error: 'Authentication required'}`. Two fixes:
1. cfw side: forward the access token in `survey.ts`'s fetch call (preferred — preserves the IDOR guard).
2. Velo side: relax the webMethod to take `{ orderId, memberToken }` and resolve memberId from a signed token stored on the survey row at delivery time.

Recommend (1); flag this in the cf-vtx5 follow-up so the survey wrapper isn't shipped half-broken.

**For dispatcher-routed modules (`gamificationCore`, `loyaltyService`, etc.):** no special handling — the bearer token threads through Wix's HTTP function runtime to the webMethod's `currentMember` lookup. The reference implementation's wishlistService dispatcher does no auth work and that's correct: `addToWishlist` line 51 calls `currentMember.getMember()` first thing. Spot-check this for every method as you add it to a new module's allowlist.

**Verify pattern:** before adding a method to a module's allowlist, grep its body for `currentMember.getMember()` (SiteMember-protected) OR confirm it's intentionally Anyone (rate-limited + sanitised). Document the choice in a comment next to the allowlist Set entry:

```js
const LOYALTY_SERVICE_ALLOWLIST = new Set([
  // SiteMember — self-guards via currentMember.getMember() in resolveCallerMemberId()
  'getMyLoyaltyAccount',
  'getMyActivity',
  'redeemReward',
  // Anyone — public leaderboard
  'getLeaderboard',
]);
```
