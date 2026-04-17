---
epic: cf-3qt
phase: cf-3qt.3 (account / auth — Next.js + Wix Headless OAuth PKCE)
author: cfutons/crew/rennala
status: draft (awaiting Stilgar clientId to execute)
depends-on:
  - docs/superpowers/specs/2026-04-17-cf-3qt-3-oauth-pkce-prep.md
  - docs/cf-3qt/WEBMETHOD-CATALOG.md
date: 2026-04-17
---

# Phase 3 Implementation Plan — Account / Auth Slice

> **Stance**: "clientId + 0min = code." Every decision deferred to Stilgar's
> OAuth App delivery is an env-var assignment. Everything else is already
> mapped to file paths, function signatures, and test scaffolds. When the
> clientId lands, we branch, stash it in Vercel env, and work the checklist.

## 1. Scope

In-scope this phase:

- Server-side PKCE authorization-code flow in **carolina-futons-web**
  (Next.js App Router on Vercel).
- An **httpOnly session cookie** (4h TTL, SameSite=Lax, Secure) that carries
  the Wix Headless member access token.
- A **session-to-member bridge** exposed to Server Actions / Route Handlers
  as `getMember()` / `getMemberId()` / `withMember(fn)`.
- **Server Actions** for 3 domain slices that call existing Velo
  `Permissions.SiteMember` webMethods with the member bearer token:
  - wishlist (4 methods; `updateWishlistStock` is Admin-only, excluded)
  - loyalty (13 methods)
  - gamification (7 member-scoped methods + 1 Anyone `getLeaderboard`
    exposed without auth wrap)
- Playwright coverage: login → member-scoped round-trip → logout.

Explicitly **not** in scope:

- Token refresh (§4 decision: drop-and-reauth at 4h). Revisit if abandonment
  telemetry shows this hurts conversion.
- Cart/checkout flows — morgott owns those in a separate Phase 3 slice.
- Wix-hosted password reset UI — we bounce users to it via OAuth redirect.
- Native mobile client — Dallas rig, separate OAuth App (§4 decision: single
  **web** OAuth App for now).

## 2. File tree — what lands in `carolina-futons-web`

```
carolina-futons-web/
  src/
    app/
      (auth)/
        login/route.ts             ← redirect to Wix OAuth authorize URL
        callback/route.ts          ← exchange code → tokens, set cookie
        logout/route.ts            ← clear cookie
      actions/
        wishlist.ts                ← server actions wrapping wishlistService
        loyalty.ts                 ← server actions wrapping loyaltyService
        gamification.ts            ← server actions wrapping gamificationCore
    lib/
      auth/
        pkce.ts                    ← codeVerifier + codeChallenge (S256)
        oauth-urls.ts              ← builds authorize + token endpoints
        cookie.ts                  ← session cookie name, options, signer
        session.ts                 ← getMember / getMemberId / withMember
        tokens.ts                  ← /oauth2/token POST helper
      wix/
        member-client.ts           ← per-request @wix/sdk OAuthStrategy w/ token (new)
        velo-client.ts             ← thin RPC client for Velo webMethods (new)
      wix-client.ts                ← millicent Phase 0: ANONYMOUS singleton (keep as-is)
  e2e/
    auth.spec.ts                   ← Playwright: login → wishlist → logout
    member-actions.spec.ts         ← Playwright: wishlist/loyalty/gamif actions
  .env.example                     ← append Phase 3 secrets (§3)
```

> **Two Wix clients by design.** millicent's Phase 0 `src/lib/wix-client.ts`
> is an anonymous singleton used for public reads (products, public CMS
> items) from Server Components. Phase 3 adds `src/lib/wix/member-client.ts`
> which is instantiated **per request** with the member bearer token pulled
> from the session cookie. Do not conflate the two — the anonymous client
> must not carry member identity, and the member client must not be cached
> across requests.

## 3. Secrets / env contract

Stilgar delivers, we set in Vercel (prod + preview + dev):

```
WIX_CLIENT_ID_HEADLESS=           # from Stilgar
WIX_OAUTH_REDIRECT_URI=https://<host>/callback
WIX_SITE_ID=                   # existing — for @wix/sdk
SESSION_COOKIE_SECRET=         # 32 bytes, rotate per env
VELO_RPC_BASE=https://<wix-site>/_functions   # Velo webMethod base
```

> **If Stilgar ships earlier than expected**: we only need `WIX_CLIENT_ID_HEADLESS`
> to start wiring; the rest are already known values.

## 4. Auth cookie middleware — the core primitive

File: `lib/auth/cookie.ts`

```ts
// Why: everything else (member identity, server-action auth, Playwright) reads
// through this one primitive. Keep it boring — signed, httpOnly, Lax, Secure,
// 4h. No rotation, no refresh, no silent renew.
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'cf_session';
const SECRET = new TextEncoder().encode(process.env.SESSION_COOKIE_SECRET!);
const TTL_SECONDS = 4 * 60 * 60;

export type SessionPayload = {
  accessToken: string;  // Wix member access token
  memberId: string;     // memoized from first /members/v1/me call
  exp: number;          // epoch seconds
};

export async function setSession(payload: Omit<SessionPayload, 'exp'>) {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const jwt = await new SignJWT({ ...payload, exp })
    .setProtectedHeader({ alg: 'HS256' })
    .sign(SECRET);
  cookies().set(SESSION_COOKIE, jwt, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: TTL_SECONDS,
  });
}

export async function readSession(): Promise<SessionPayload | null> {
  const jar = cookies().get(SESSION_COOKIE);
  if (!jar) return null;
  try {
    const { payload } = await jwtVerify(jar.value, SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;  // bad signature / expired → treat as logged out
  }
}

export function clearSession() {
  cookies().delete(SESSION_COOKIE);
}
```

Notes:
- Signed (not encrypted) JWT. Token is not a secret the user shouldn't see —
  it's the user's own token. Signing prevents tampering.
- `maxAge = 4h` matches Wix Headless access-token TTL (14400s). When it
  expires, `jwtVerify` rejects → user treated as logged out → redirect to
  `/login`.
- Cookie name is `cf_session`. Never `next-auth.session-token` — we're not
  using NextAuth; don't let it look like it.

## 5. OAuth route handlers

### 5.1 `/login` — redirect to Wix authorize

File: `app/(auth)/login/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { makeCodeChallenge } from '@/lib/auth/pkce';
import { buildAuthorizeUrl } from '@/lib/auth/oauth-urls';

export async function GET(req: NextRequest) {
  const codeVerifier = randomBytes(32).toString('base64url');
  const state = randomBytes(16).toString('base64url');
  const codeChallenge = await makeCodeChallenge(codeVerifier);

  // Why: codeVerifier + state MUST survive the redirect without leaking to
  // the client JS. Short-lived httpOnly cookie (10 min) is the standard
  // App Router pattern — no server-side store needed.
  cookies().set('cf_pkce', JSON.stringify({ codeVerifier, state }), {
    httpOnly: true, secure: true, sameSite: 'lax',
    path: '/', maxAge: 600,
  });

  const url = buildAuthorizeUrl({
    clientId: process.env.WIX_CLIENT_ID_HEADLESS!,
    redirectUri: process.env.WIX_OAUTH_REDIRECT_URI!,
    codeChallenge,
    state,
  });
  return NextResponse.redirect(url);
}
```

### 5.2 `/callback` — exchange code for tokens, set session

File: `app/(auth)/callback/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeCode } from '@/lib/auth/tokens';
import { setSession } from '@/lib/auth/cookie';
import { getCurrentMemberId } from '@/lib/wix/member-client';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const pkceJar = cookies().get('cf_pkce');
  if (!code || !state || !pkceJar) return NextResponse.redirect(new URL('/login?err=missing', req.url));

  const { codeVerifier, state: expectedState } = JSON.parse(pkceJar.value);
  if (state !== expectedState) return NextResponse.redirect(new URL('/login?err=state', req.url));
  cookies().delete('cf_pkce');

  const tokens = await exchangeCode({
    code,
    codeVerifier,
    clientId: process.env.WIX_CLIENT_ID_HEADLESS!,
    redirectUri: process.env.WIX_OAUTH_REDIRECT_URI!,
  });

  const memberId = await getCurrentMemberId(tokens.access_token);
  await setSession({ accessToken: tokens.access_token, memberId });
  return NextResponse.redirect(new URL('/account', req.url));
}
```

### 5.3 `/logout`

File: `app/(auth)/logout/route.ts`

```ts
import { NextResponse } from 'next/server';
import { clearSession } from '@/lib/auth/cookie';

export async function POST() {
  clearSession();
  // No Wix /logout redirect — doing a client-side post and letting them stay
  // on our site feels right for UX; Wix access token naturally expires in ≤4h.
  return NextResponse.json({ ok: true });
}
```

## 6. Session-to-member bridge

File: `lib/auth/session.ts`

```ts
import { redirect } from 'next/navigation';
import { readSession, type SessionPayload } from './cookie';

export async function getMember(): Promise<SessionPayload | null> {
  return readSession();
}

export async function getMemberId(): Promise<string | null> {
  return (await readSession())?.memberId ?? null;
}

// Why: server actions are the call site where "must be logged in" is asserted.
// This wrapper redirects to /login if no session, otherwise hands the action
// a guaranteed-non-null member. One redirect policy, one place to change it.
export async function withMember<T>(fn: (m: SessionPayload) => Promise<T>): Promise<T> {
  const m = await readSession();
  if (!m) redirect('/login');
  return fn(m);
}
```

## 7. Velo RPC client

File: `lib/wix/velo-client.ts`

```ts
// Why: existing Velo webMethods stay in place — the Next.js server calls them
// via the /_functions HTTP surface with the member bearer token in the
// Authorization header. Wix's per-webMethod Permissions.SiteMember check
// resolves the token → member identity (see PKCE prep spec §3 risk note).
type RpcArgs<T> = { method: string; args: unknown[]; accessToken?: string; signal?: AbortSignal };

export async function callVelo<T>({ method, args, accessToken, signal }: RpcArgs<T>): Promise<T> {
  const res = await fetch(`${process.env.VELO_RPC_BASE}/${method}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ args }),
    signal,
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`velo ${method} ${res.status}`);
  return res.json() as Promise<T>;
}
```

> **Phase 0 Q1 (carried from PKCE prep)**: confirm Wix accepts the OAuth
> access token on `/_functions/*` for `Permissions.SiteMember` methods.
> First Playwright green light is the proof.

## 8. Server actions — 3 domain slices

Exact signatures sourced from `docs/cf-3qt/WEBMETHOD-CATALOG.md` §
Member-scoped and verified on `main@a1f6b55a`.

### 8.1 `app/actions/wishlist.ts`

```ts
'use server';
import { withMember } from '@/lib/auth/session';
import { callVelo } from '@/lib/wix/velo-client';

export async function addToWishlist(productId: string, name: string, price: number, opts?: { variantId?: string; image?: string }) {
  return withMember(m => callVelo({
    method: 'wishlistService/addToWishlist',
    args: [productId, name, price, opts ?? {}],
    accessToken: m.accessToken,
  }));
}

export async function removeFromWishlist(productId: string) {
  return withMember(m => callVelo({ method: 'wishlistService/removeFromWishlist', args: [productId], accessToken: m.accessToken }));
}

export async function getWishlist() {
  return withMember(m => callVelo({ method: 'wishlistService/getWishlist', args: [], accessToken: m.accessToken }));
}

export async function isOnWishlist(productId: string) {
  return withMember(m => callVelo({ method: 'wishlistService/isOnWishlist', args: [productId], accessToken: m.accessToken }));
}
```

> **Excluded**: `wishlistService.updateWishlistStock` — declared
> `Permissions.Admin` in `src/backend/wishlistService.web.js:208`. It must
> not appear in a member-facing Server Action. If Phase 3 needs stock
> freshness on read (e.g. hydrate `inStock` flags on `getWishlist`
> results), add the join on the server-action read path, not as a
> member-callable write.

### 8.2 `app/actions/loyalty.ts`

13 member-scoped reads + 1 write (`redeemReward`). Same wrapper pattern:

```ts
'use server';
import { withMember } from '@/lib/auth/session';
import { callVelo } from '@/lib/wix/velo-client';

const m = (method: string) => `loyaltyService/${method}`;

export async function getMyLoyaltyAccount()   { return withMember(s => callVelo({ method: m('getMyLoyaltyAccount'),   args: [], accessToken: s.accessToken })); }
export async function getAvailableRewards()   { return withMember(s => callVelo({ method: m('getAvailableRewards'),   args: [], accessToken: s.accessToken })); }
export async function getMyStreakData()       { return withMember(s => callVelo({ method: m('getMyStreakData'),       args: [], accessToken: s.accessToken })); }
export async function getMyDailyQuests()      { return withMember(s => callVelo({ method: m('getMyDailyQuests'),      args: [], accessToken: s.accessToken })); }
export async function getMyAchievements()     { return withMember(s => callVelo({ method: m('getMyAchievements'),     args: [], accessToken: s.accessToken })); }
export async function getMyActivity(limit = 20) {
  return withMember(s => callVelo({ method: m('getMyActivity'), args: [limit], accessToken: s.accessToken }));
}
export async function getMyBurnRate()         { return withMember(s => callVelo({ method: m('getMyBurnRate'),         args: [], accessToken: s.accessToken })); }
export async function getLoyaltyTiers()       { return withMember(s => callVelo({ method: m('getLoyaltyTiers'),       args: [], accessToken: s.accessToken })); }
export async function getLeaderboard(limit = 10) {
  return withMember(s => callVelo({ method: m('getLeaderboard'), args: [limit], accessToken: s.accessToken }));
}
export async function getChallengeCatalog()   { return withMember(s => callVelo({ method: m('getChallengeCatalog'),   args: [], accessToken: s.accessToken })); }
export async function getChallengeLeaderboard(challengeId: string) {
  return withMember(s => callVelo({ method: m('getChallengeLeaderboard'), args: [challengeId], accessToken: s.accessToken }));
}

export async function redeemReward(rewardId: string) {
  // Why: `redeemReward` exists in two backend modules (WEBMETHOD-CATALOG
  // collision note): `loyaltyService.redeemReward(rewardId)` wraps the Wix
  // Loyalty API and auto-creates a coupon; `rewardsStore.redeemReward(memberId, rewardId)`
  // is a lower-level CMS-backed version. We target loyaltyService here —
  // member identity is derived from the bearer token server-side, so the
  // caller does not pass memberId.
  return withMember(s => callVelo({ method: m('redeemReward'), args: [rewardId], accessToken: s.accessToken }));
}
```

### 8.3 `app/actions/gamification.ts`

```ts
'use server';
import { withMember } from '@/lib/auth/session';
import { callVelo } from '@/lib/wix/velo-client';

const g = (method: string) => `gamificationCore/${method}`;

// Member-scoped reads. Several gamificationCore methods accept `memberId` as
// their first positional arg rather than inferring from the bearer token.
// We derive memberId server-side from the session and pass it explicitly so
// the call can't be spoofed with another member's id.
export async function getActiveChallenges() {
  return withMember(s => callVelo({ method: g('getActiveChallenges'), args: [s.memberId], accessToken: s.accessToken }));
}
export async function getStreakData() {
  return withMember(s => callVelo({ method: g('getStreakData'), args: [s.memberId], accessToken: s.accessToken }));
}
export async function getMemberTier() {
  return withMember(s => callVelo({ method: g('getMemberTier'), args: [s.memberId], accessToken: s.accessToken }));
}
export async function getActivityFeed(limit = 20) {
  return withMember(s => callVelo({ method: g('getActivityFeed'), args: [s.memberId, limit], accessToken: s.accessToken }));
}

// Writes — the event ingress + challenge mutations. memberId pulled from
// session; callers never pass it.
export async function recordChallengeProgress(challengeId: string) {
  return withMember(s => callVelo({
    method: g('recordChallengeProgress'),
    args: [{ memberId: s.memberId, challengeId }],
    accessToken: s.accessToken,
  }));
}
export async function recoverStreak() {
  return withMember(s => callVelo({ method: g('recoverStreak'), args: [s.memberId], accessToken: s.accessToken }));
}
export async function receiveGamificationEvent(eventName: string, payload: unknown) {
  return withMember(s => callVelo({
    method: g('receiveGamificationEvent'),
    args: [eventName, payload, s.memberId],
    accessToken: s.accessToken,
  }));
}

// Why: `gamificationCore.getLeaderboard` is Permissions.Anyone — public
// homepage widget surface. Do NOT wrap with withMember; that would force a
// redirect to /login for logged-out visitors. A logged-in caller may still
// pass their memberId to get a highlight row; logged-out callers get the
// leaderboard sans highlight.
export async function getLeaderboardPublic(limit = 10, memberId: string | null = null) {
  return callVelo({
    method: g('getLeaderboard'),
    args: [limit, memberId],
    // no accessToken: Anyone endpoint
  });
}
```

> **Collision note** (from WEBMETHOD-CATALOG): `getLeaderboard` lives in
> BOTH `loyaltyService` (`Permissions.SiteMember`, §8.2) AND `gamificationCore`
> (`Permissions.Anyone`, above). They serve different surfaces — the loyalty
> one is private per-member context, the gamification one is the public
> homepage board. Keep them on distinct import paths:
> `import { getLeaderboard } from '@/app/actions/loyalty';` (member-scoped)
> vs `import { getLeaderboardPublic } from '@/app/actions/gamification';`.

> **`Permissions.Member` audit (non-blocking, carry to Phase 0)**:
> `gamificationCore.receiveGamificationEvent`, `getActiveChallenges`,
> `recordChallengeProgress`, and `recoverStreak` are declared
> `Permissions.Member` — NOT a canonical Velo permission (canonical:
> `Anyone` / `SiteMember` / `Admin`). Wix may silently coerce this, most
> likely to `Anyone`. If so, these become publicly callable with an
> attacker-supplied `memberId`, since they trust the first positional arg.
> Phase 0 Q: confirm coercion behavior and either normalize the source to
> `SiteMember` or move callers through a `callAs` server-only shim.

## 9. First-green Playwright slice

File: `tests/auth.spec.ts`

```ts
import { test, expect } from '@playwright/test';

test('login → wishlist → logout', async ({ page }) => {
  await page.goto('/login');
  // Wix-hosted login page — test account creds in .env.test
  await page.fill('input[name=email]',    process.env.TEST_MEMBER_EMAIL!);
  await page.fill('input[name=password]', process.env.TEST_MEMBER_PASSWORD!);
  await page.click('button[type=submit]');

  await expect(page).toHaveURL(/\/account/);
  const cookie = (await page.context().cookies()).find(c => c.name === 'cf_session');
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe('Lax');

  // Server action round-trip — calls loyaltyService.getMyLoyaltyAccount
  await page.goto('/account');
  await expect(page.getByTestId('loyalty-points')).toBeVisible();

  await page.click('[data-testid=logout]');
  await expect(page).toHaveURL('/');
  const afterLogout = (await page.context().cookies()).find(c => c.name === 'cf_session');
  expect(afterLogout).toBeUndefined();
});
```

This is the bead-closer. When this test goes green against prod Wix, cf-3qt.3
is done.

## 10. Rollout sequence

| Order | Task | Depends on | Duration |
|:-:|---|---|---|
| 1 | Stilgar delivers `WIX_CLIENT_ID_HEADLESS` | (external) | blocking |
| 2 | Set env vars in Vercel (prod/preview/dev) | 1 | 15 min |
| 3 | Land `lib/auth/*` (cookie, pkce, tokens, session) | 2 | 2h |
| 4 | Land `/login` + `/callback` + `/logout` route handlers | 3 | 2h |
| 5 | Land `lib/wix/velo-client.ts` | 2 | 30 min |
| 6 | Land wishlist server actions + smoke | 3, 5 | 1h |
| 7 | Playwright `auth.spec.ts` green against staging | 6 | 1h |
| 8 | Land loyalty + gamification server actions | 7 | 2h |
| 9 | Playwright `member-actions.spec.ts` green | 8 | 1h |
| 10 | Merge to main, smoke-test prod, close cf-3qt.3 | 9 | 30 min |

**Total wall-clock after clientId**: ~1 day for one crew member. 2 days if
we discover Velo `/_functions` doesn't accept the bearer token directly
(Phase 0 Q1) and we have to build `oauthBroker.web.js` as an RPC shim.

## 11. Kill-switch / fallback

If Q1 fails (Velo rejects bearer token):

1. Add `src/backend/oauthBroker.web.js` on the Velo side with two webMethods:
   - `resolveMemberFromToken(accessToken)` — `Permissions.Anyone`, calls
     Wix OAuth introspection and returns `{memberId}`.
   - `callAs(memberId, module, method, args)` — `Permissions.Admin` (internal
     secret, not exposed to browsers), proxies to the target webMethod with
     `suppressAuth` + explicit member filter.
2. `lib/wix/velo-client.ts` starts calling `callAs(memberId, ...)` through
   a shared server-only secret header, bypassing per-method auth.

This is the escape hatch the PKCE prep spec §5 originally proposed. We
don't build it unless Q1 fails — adds attack surface and complexity we'd
rather avoid.

## 12. Open items (non-blocking — do in parallel)

- **`suppressAuth: true` audit** (PKCE prep §3 risk): once the member bearer
  flow is proven, grep `suppressAuth: true` in `src/backend/gamificationCore.web.js`
  and friends; drop calls where the member token now narrows scope at the
  DB layer. Reduces blast radius if cf-rzq-style misconfigs recur.
- **Rate-limit middleware** on `/login` and `/callback` — Vercel edge config,
  30 req/min per IP. Prevents OAuth flood.
- **Observability**: emit `auth.login`, `auth.callback.success/error`,
  `auth.session.expired` events to existing errorMonitoring.web `logError`
  pipeline so we can see real-world failure rates before scaling past
  wishlist/loyalty/gamification.
