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

## 4. Open questions for melania / Phase 2 unblock

1. **Client type** — is cf-3qt.3's caller a native mobile app, a separate
   web SPA, or a server-to-server integration? PKCE vs. Sign On vs.
   Client Credentials splits on this.
2. **OAuth App provisioning** — who owns creating the Wix Headless
   OAuth App and handing us the `clientId` + allowed redirectUris?
3. **Scope discipline** — do we mint one OAuth App for cf-3qt.3, or
   a per-surface app? Affects blast radius of a leaked clientId.
4. **Token storage** — on the client side, spec whether refresh tokens
   live in secure storage (Keychain / httpOnly cookie) vs. localStorage.
   Affects XSS posture for the 265 SiteMember webMethods.
5. **Logout + revoke** — Wix Logout endpoint returns HTML; an API-only
   revoke is not documented. May need to just drop refresh on client
   and rely on 14400s access-token TTL.

## 5. Recommended Phase 2 first slice

Smallest end-to-end proof that unblocks the bead:

1. Provision headless OAuth App, stash `clientId` in site secrets.
2. Add `src/backend/oauthBroker.web.js` with two webMethods (both
   `Permissions.Anyone`):
   - `startLogin(redirectUri)` → generates codeVerifier, returns
     `{wixUrl, verifierId}`; stores codeVerifier keyed by verifierId
     in a short-TTL CMS row (or signed JWT in cookie).
   - `exchangeCode(verifierId, code)` → POSTs to `/oauth2/token`,
     returns tokens.
3. Wire one existing SiteMember webMethod (`wishlistService.getWishlist`)
   to accept a bearer token in the request envelope.
4. Playwright test: login → call wishlist → assert member-scoped
   result. If green, scale to the other 76 SiteMember files.

Estimate: ~2 days of crew time once the clientId is in hand. Bulk of
the cost is in (3)/(4), not the OAuth plumbing itself.
