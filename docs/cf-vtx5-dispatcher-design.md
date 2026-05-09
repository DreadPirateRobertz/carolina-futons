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
