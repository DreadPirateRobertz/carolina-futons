---
bead: cf-3qt.3
phase: Phase 2 prep (blocked)
author: cfutons/crew/rennala
date: 2026-04-17
owner: cfutons/crew/melania
---

# CF-3qt.3 — Wix OAuth PKCE + Velo webMethod Map (Phase 2 Prep)

> Prep artifact requested by mayor while Phase 2 is blocked.
> Goal: hand melania a one-pager that resolves the two unknowns —
> (1) exact PKCE wire format, (2) what of the existing Velo surface
> is callable from an OAuth-authenticated visitor/member token.

## 1. Site posture — Velo, not Headless

Carolina Futons is a **Wix Velo** site. The PKCE flow lives in the
Wix Headless stack, so cf-3qt.3 is really "expose our Velo backend to
an OAuth-authenticated external client" (mobile app or standalone web
client). Two moving parts:

- **Wix Headless OAuth Apps** (`clientId`) — identifies the external client.
  Must be provisioned via Wix Business Manager → Headless → OAuth Apps.
  No client secret — PKCE replaces it.
- **Velo backend** — serves data. `webMethod` permissions (`Anyone`,
  `SiteMember`, `Admin`) gate what the authenticated identity can call.

## 2. PKCE flow (single source of truth)

Three grant types hit `POST https://www.wixapis.com/oauth2/token`:

| grantType | Required fields | Returns |
|---|---|---|
| `anonymous` | `clientId` | access+refresh (visitor identity) |
| `authorization_code` | `clientId`, `code`, `codeVerifier`, `redirectUri` | access+refresh (member identity) |
| `refresh_token` | `refreshToken` | access+refresh (rotated) |

### Wire sequence for a member login (the `.3` subtask)

```
client                    our server               wix
  │ (1) generate           │                         │
  │  codeVerifier (random) │                         │
  │  codeChallenge =       │                         │
  │   S256(codeVerifier)   │                         │
  │────────────────────────▶                         │
  │ (2) request redirect   │                         │
  │                        │── POST /redirects ─────▶│
  │                        │   {codeChallenge,       │
  │                        │    redirectUri,         │
  │                        │    callbacks:{...}}     │
  │                        │◀──── wixRedirectUrl ────│
  │◀──── redirect URL ─────│                         │
  │ (3) visitor follows    │                         │
  │    URL; logs in at     │                         │
  │    Wix-managed page ───┼────────────────────────▶│
  │◀─ callback?code=OLI… ──┼─────────────────────────│
  │ (4) exchange           │                         │
  │────────────────────────▶                         │
  │                        │── POST /oauth2/token ──▶│
  │                        │   {grantType:           │
  │                        │     authorization_code, │
  │                        │    clientId, code,      │
  │                        │    codeVerifier,        │
  │                        │    redirectUri}         │
  │                        │◀── access+refresh ──────│
  │◀─── tokens ────────────│                         │
```

- `codeVerifier`: 43–128 char random string, URL-safe.
- `codeChallenge`: base64url(SHA-256(codeVerifier)) — the `S256` method.
- `expires_in`: 14400s (4h) in observed responses; refresh rotates.
- Our server MUST NOT see the user's password. We only broker the
  redirect/token dance.

### Canonical docs
- Retrieve Tokens: https://dev.wix.com/docs/api-reference/business-management/headless/authentication/retrieve-tokens
- Create Redirect Session: https://dev.wix.com/docs/api-reference/business-management/headless/redirects/create-redirect-session
- OAuthStrategy (SDK side): https://dev.wix.com/docs/sdk/core-modules/sdk/oauth-strategy
- Auth sample flows: https://dev.wix.com/docs/api-reference/business-management/headless/authentication/sample-flows

### Error surface to plan for

From `/oauth2/token`:
- `invalid_grant` — expired/reused code, redirectUri mismatch, refresh revoked
- `invalid_request` — missing codeVerifier, malformed body
- `unauthorized_client` — clientId not permitted for that grantType
- `invalid_client` — bad clientId

Redirect step uses HTTP 302 with `#error=` fragment for `invalid_request`,
`access_denied`, `server_error`, `temporarily_unavailable`.

## 3. Velo webMethod map (what the token unlocks)

Audited `src/backend/*.web.js` on `main` @ a1f6b55a:

| Permission | webMethod count | Files | Meaning for OAuth client |
|---|---:|---:|---|
| `Anyone` | 501 | 153 | Callable with `anonymous` token (or no token) |
| `SiteMember` | 265 | 77 | **Requires member-identity token** — this is cf-3qt.3's payoff |
| `Admin` | 292 | 105 | Dashboard/cron only — out of OAuth scope |

### 40 files that touch member identity directly
These use `currentMember.getMember()`, `wix-members-backend`, or
`wix-users-backend`. They are the concrete surface the PKCE member
token will drive:

```
reviewsService, sommelierService, gamificationNotifs, challengeService,
referralService, loyaltyService, gamificationCore, notificationService,
memberGamePreferences, comfortTimeline, warrantyService, videoReviewService,
trailPerkService, trailChallengeService, swatchKitService, surveyService,
rewardEngine, deliveryScheduling, customerRoomPhotos, bundleBuilder,
socialStoryScheduler, whiteGloveScheduling, ugcService, tradeInService,
styleQuizService, storeCreditService, smsService, liveChat,
virtualConsultation, loyaltyMarketing, tradeProgram, guestCheckout,
wishlistShare, shippingIntelligence, productQA, emailService,
dataService, crossRigEventReceiver, couponsService, postPurchaseCare
```
(+ `http-functions.js` — HTTP endpoint surface, separate concern)

### Risk: member-identity inference inside webMethods

Many of these call `wixMembersBackend.currentMember.getMember()` **inside**
the webMethod body, not from the request envelope. With OAuth, the
Velo runtime needs to resolve the bearer token to a member identity
before that call returns the correct member. Validate early with a
single end-to-end spike against `wishlistService` (simplest
member-scoped read) before committing to wider rollout.

### Risk: `suppressAuth: true`

CF-rzq (merged 2026-03) added `suppressAuth: true` to wixData calls in
`gamificationCore` to fix SiteMember-permission collections. If PKCE
flow preserves member identity, we should audit which of those calls
can safely drop `suppressAuth` back — otherwise the member token
doesn't actually narrow the data scope and we keep enforcing in-code.

## 4. Decisions (closed by melania 2026-04-17)

1. **Client type** — **Next.js App Router on Vercel** (server-rendered
   web). NOT SPA, NOT mobile. PKCE is handled server-side inside a
   Next.js route handler; the browser never sees `codeVerifier` or
   tokens. Mobile is a separate track with its own OAuth App.
2. **OAuth App provisioning** — **escalated to Stilgar** (owns Wix
   Business Manager). Needs clientId + redirectUris for:
   - `https://web-staging.carolinafutons.com/api/auth/callback`
   - Vercel preview URL pattern (e.g. `https://*.vercel.app/api/auth/callback`)
   - `https://carolinafutons.com/api/auth/callback` — post-cutover
3. **Scope discipline** — **single web OAuth App**. Mobile gets its own
   later; do not share.
4. **Token storage** — refresh token → httpOnly, SameSite=Lax,
   encrypted + signed cookie. **Never localStorage**. Access token is
   server-only; browser code never touches either token.
5. **Logout** — drop refresh cookie, rely on 4h access TTL, redirect
   through Wix logout URL. Document the revoke gap — Wix has no
   documented API revoke endpoint, so tokens linger until natural
   expiry even after logout. Acceptable for Phase 3; revisit if we
   see session-hijack risk.

## 5. First slice (post-decision shape)

With Q1 locked to "Next.js App Router server-side PKCE", the plumbing
splits cleanly: **no Velo code runs the OAuth dance**. The Next.js repo
owns PKCE end-to-end; the Velo side just keeps serving webMethods and
starts trusting the Wix-resolved member identity.

**Blocked on**: Stilgar delivering clientId + approved redirectUris.

### Next.js side (in the cf-3qt repo, not cfutons)
- `app/api/auth/login/route.ts` — GET: generate codeVerifier (random 64
  bytes → base64url), compute codeChallenge (S256), store codeVerifier
  in a signed+encrypted httpOnly cookie (`__Host-cv`, SameSite=Lax, 10
  min TTL). Call Wix Create Redirect Session with codeChallenge and
  redirectUri. 302 to the returned `wixUrl`.
- `app/api/auth/callback/route.ts` — GET: read `code` from query,
  `codeVerifier` from cookie, POST `/oauth2/token` with
  `grantType=authorization_code`. On success, set two cookies:
  `__Host-rt` (refresh, httpOnly, encrypted, 30d) and `__Host-at`
  (access, httpOnly, 4h). Delete `__Host-cv`. 302 to dashboard.
- `middleware.ts` — on any `/account/*` request, if `__Host-at`
  missing or expired, try refresh silently; if refresh fails, 302 to
  `/api/auth/login`.
- `app/api/auth/logout/route.ts` — clear both cookies, 302 to Wix
  logout URL.

### Velo side (this repo)
- **No `oauthBroker.web.js` needed** — deleted from plan.
- Audit one SiteMember webMethod end-to-end to confirm Wix resolves
  the bearer token to `currentMember.getMember()` correctly when the
  call originates from a Next.js server with the OAuth access token.
  Candidate: `wishlistService.getWishlist` (simplest read, existing
  Playwright coverage).
- If member identity resolves cleanly, no further Velo changes needed
  for the proof. Scale by retesting each of the 76 other SiteMember
  files as Phase 3 UI pages get built.

### Playwright proof
Next.js repo integration test:
1. POST login form with test member credentials via `/api/auth/login`
2. Follow 302 chain, land on dashboard
3. Server component fetches wishlist via Velo webMethod
4. Assert response is member-scoped (matches seeded wishlist rows)

### Risk to flag to Stilgar before he provisions
Vercel preview URLs are dynamic (`https://cf-3qt-git-<branch>-<hash>.vercel.app`).
The OAuth App's allowed redirectUri list must support wildcards, OR
we need a stable preview domain (e.g. `preview.carolinafutons.com` with
Vercel branch aliasing). Wix OAuth App docs don't confirm wildcard
support — worth verifying during Stilgar's provisioning run.

### Timeline
- Stilgar provisioning: unknown (blocking)
- Next.js PKCE routes + cookie plumbing: ~1 day crew
- Velo member-identity spike + Playwright: ~0.5 day crew
- Scale to remaining 76 SiteMember files: piecemeal as Phase 3 UI lands
