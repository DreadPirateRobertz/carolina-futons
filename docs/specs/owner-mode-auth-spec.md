# Owner-Mode Auth Gate — Spec

**Bead:** cfw-ajk sub-bead 1 (Path B inline-edit foundation)
**Author:** millicent (cfutons/crew)
**Date:** 2026-05-09
**Status:** Recommendation — pending review by godfrey + Stilgar

---

## Problem

Brenda needs to log into the public cfw site (`carolina-futons-web`) and toggle "owner mode" to reveal pencil icons next to every editable text + image affordance (per cfw-ajk epic, Stilgar 2026-05-09). Server has to reliably distinguish Brenda from any other authenticated visitor before:

- The page server-renders the pencil overlays (UI-side gate).
- The API routes (`/api/admin/site-content`, `/api/admin/image-upload`, etc.) accept writes (server-side gate).

UI-side alone is insufficient — see cf-yvs4 / cf-9ieq IDOR lessons. Both layers must enforce.

---

## Existing auth surface (cfw-web today)

- `/api/auth/session` — Wix Headless OAuth flow (login + signup). Sets `SESSION_COOKIE_NAME` HttpOnly cookie via `serializeSessionTokens` from `@/lib/auth/session`.
- `/api/auth/{login,register,forgot-password}` — Wix Headless OAuth entry points.
- `getCurrentMember()` in `src/lib/wix/members.ts` — server-side accessor that returns the authenticated Wix customer member (or `null`).
- `getWixClientWithTokens()` — per-request Wix SDK client that picks up the session cookie.
- `WIX_CLIENT_ID_HEADLESS` env var (already wired).

**Critical: Wix Studio owner ≠ Wix Headless customer member.** Brenda's Wix dashboard owner role on the parent Studio account is *not* visible to the Headless API. Headless members are a separate identity created when someone registers via the site's OAuth flow. Any "owner" check has to operate on the headless-member identity, and the binding from "this headless member is also Brenda the studio owner" has to come from somewhere external (env list, CMS row, claim attribute, etc.).

---

## Options compared

### (a) Wix Members owner-role check via `getCurrentMember()`

**Idea:** read the authenticated member's role/profile and accept only those tagged as owner/admin.

- **Pro:** zero new infrastructure if a usable role surface exists.
- **Con — fatal:** Wix Headless's `members.getCurrentMember()` returns a `Member` object containing `loginEmail`, `profile`, and a `contactId`. There is no built-in `role: "OWNER"` or `roles: [...]` surface for headless members. Wix Members has a "site role" concept on Studio sites with the Members app, but that exposes only `MEMBER` / `BLOCKED` / `PENDING` for headless customers — not `OWNER` / `ADMIN`.
- **Con:** even if a custom `Roles` collection were added, the binding from member → role is a CMS lookup that's functionally identical to option (b) but with extra moving parts.

**Verdict:** does not solve the problem on its own. Roles can be added on top of (b) if the admin set ever grows beyond the env-list ceiling.

### (b) Custom env-keyed admin allowlist (`ADMIN_EMAILS`) + existing Wix Members session

**Idea:** add `ADMIN_EMAILS=brenda@example.com,stilgar@example.com` as a Vercel env var. The owner-mode helper:

1. Calls existing `getCurrentMember()` (cookies → Wix Headless → Member).
2. Returns `false` if no member or member's `loginEmail` not in `ADMIN_EMAILS`.
3. Returns `true` otherwise.

- **Pro:** reuses 100% of existing auth (login, session cookie, password reset, OAuth flows). No new login UX for Brenda — she logs in via the same `/login` page customers use.
- **Pro:** add/remove admins by editing one env var in the Vercel dashboard. Takes ~30 s + a redeploy.
- **Pro:** server-truth: the env is read at request time (or cached at server start); UI cannot lie about admin state.
- **Pro:** trivial to test — local `.env.local` with `ADMIN_EMAILS=test@local` makes any email pass.
- **Pro:** matches existing pattern — cfw already uses env vars for `WIX_*` secrets, `SESSION_COOKIE_SECRET`, `WIX_WEBHOOK_SECRET`, etc.
- **Con:** every change requires a Vercel redeploy (~1 min). Acceptable given the admin set is ≤ 5 people for the foreseeable future.
- **Con:** admin set is plain-text in the Vercel UI. Not a secret per se, but visible to anyone with project access. Worth noting in the runbook.

### (c) Magic link / passwordless

**Idea:** Brenda enters her email at `/admin/login`. Server emails her a single-use, time-limited token URL. Click → server sets a separate admin-session cookie distinct from the customer session.

- **Pro:** strongest phish resistance (no reusable password).
- **Pro:** distinct identity model — admin session is fully decoupled from customer auth, simpler reasoning about "is this request an admin request."
- **Con:** new infrastructure: token table (Wix CMS or Vercel KV), email sender (Wix Triggered Email or external SMTP), `/api/admin/magic-link/{request,verify}` endpoints, separate cookie + session model.
- **Con:** UX friction — Brenda waits for email each session, links expire, "open in correct browser" gotchas.
- **Con:** Brenda already has a Wix-hosted password-recovery flow (`sendPasswordResetEmail` in `src/lib/wix/auth.ts`) for the customer login. Adding a parallel magic-link flow doubles the auth surface.
- **Con:** dramatic over-engineering for a 1-person admin role.

**Verdict:** save for a future date if the admin set grows large enough or if compliance ever demands password-less. Not for v1.

---

## Recommendation: option (b)

**`ADMIN_EMAILS` env var + existing Wix Members session.** Defer (c) until / unless we have a reason to break out admin auth from customer auth.

If Brenda's email-as-identity model ever needs to expand (multiple admins, role tiers, audit per admin), evolve to a `SiteAdmins` CMS collection (Wix Data) keyed by member ID, with the env list as an emergency fallback. That's the natural growth path; today's complexity isn't worth the future-proofing.

---

## Sequence diagram (option b, end-to-end)

```
Brenda's       Next.js Server         Wix Headless           Wix Data API
browser        (Vercel)               OAuth                  (CMS)
   │               │                     │                       │
   │ GET /         │                     │                       │
   ├──────────────▶│                     │                       │
   │               │ (no session cookie) │                       │
   │ public render │                     │                       │
   │◀──────────────┤                     │                       │
   │               │                     │                       │
   │ Click "Sign in"                     │                       │
   │ POST /api/auth/session              │                       │
   ├──────────────▶│                     │                       │
   │               │ generateOAuthData   │                       │
   │               ├────────────────────▶│                       │
   │               │ getAuthUrl          │                       │
   │               │◀────────────────────┤                       │
   │ {authUrl}     │                     │                       │
   │◀──────────────┤                     │                       │
   │ Redirect      │                     │                       │
   │ ───────────── Wix-hosted login ──── │                       │
   │ Brenda enters her email + password  │                       │
   │ Wix sets a code + redirects         │                       │
   │ GET /api/auth/session?code=…&state= │                       │
   ├──────────────▶│                     │                       │
   │               │ exchange code       │                       │
   │               ├────────────────────▶│                       │
   │               │ {accessToken,…}     │                       │
   │               │◀────────────────────┤                       │
   │ Set-Cookie: wix-session             │                       │
   │◀──────────────┤                     │                       │
   │               │                     │                       │
   │ GET / (cookie present)              │                       │
   ├──────────────▶│                     │                       │
   │               │ getCurrentMember()  │                       │
   │               ├────────────────────▶│                       │
   │               │ {loginEmail,…}      │                       │
   │               │◀────────────────────┤                       │
   │               │                     │                       │
   │               │ isOwnerMode()       │                       │
   │               │  = ADMIN_EMAILS     │                       │
   │               │     .has(email)     │                       │
   │               │  → true             │                       │
   │               │                     │                       │
   │ render with pencil overlays         │                       │
   │◀──────────────┤                     │                       │
   │               │                     │                       │
   │ Click pencil, edit, save            │                       │
   │ POST /api/admin/site-content        │                       │
   │   { key: "homepage.hero.title",     │                       │
   │     value: "Welcome to CF" }        │                       │
   ├──────────────▶│                     │                       │
   │               │ requireOwnerMode()  │                       │
   │               │ — if false: 403     │                       │
   │               │                     │                       │
   │               │ Wix Data update     │                       │
   │               ├────────────────────────────────────────────▶│
   │               │ ok                  │                       │
   │               │◀────────────────────────────────────────────┤
   │               │                     │                       │
   │               │ revalidateTag(      │                       │
   │               │   'site-content')   │                       │
   │ {ok: true}    │                     │                       │
   │◀──────────────┤                     │                       │
```

---

## Module sketch (`src/lib/auth/owner-mode.ts`)

```ts
import { getCurrentMember } from "@/lib/wix/members";

let cachedAdminSet: Set<string> | null = null;

function adminSet(): Set<string> {
  if (cachedAdminSet) return cachedAdminSet;
  const raw = process.env.ADMIN_EMAILS ?? "";
  cachedAdminSet = new Set(
    raw.split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
  return cachedAdminSet;
}

/** True iff the current request is from an authenticated admin. */
export async function isOwnerMode(): Promise<boolean> {
  const member = await getCurrentMember();
  const email = member?.loginEmail?.toLowerCase().trim();
  if (!email) return false;
  return adminSet().has(email);
}

/** Server-side guard for `/api/admin/*` routes. Returns the member if
 * authorized; throws Response(403) if not. Use in App Router route
 * handlers. */
export async function requireOwnerMode() {
  const member = await getCurrentMember();
  const email = member?.loginEmail?.toLowerCase().trim();
  if (!email || !adminSet().has(email)) {
    throw new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return member;
}
```

The cache is process-scoped — Vercel functions keep it across invocations within a single warm container. Env updates require a redeploy, which spawns fresh containers and resets the cache. No invalidation logic needed.

---

## Middleware integration

Add to `middleware.ts`:

```ts
// Block all /admin/* and /api/admin/* requests at the edge if no session
// cookie. Defense-in-depth — the route handlers also enforce, but rejecting
// at the edge avoids spinning up the function for unauthenticated traffic.
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (path.startsWith("/admin") || path.startsWith("/api/admin")) {
    if (!req.cookies.get(SESSION_COOKIE_NAME)) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", path);
      return NextResponse.redirect(loginUrl);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
```

The middleware only checks **cookie presence**, not contents — server route handlers do the actual `requireOwnerMode()` enforcement (via Wix API roundtrip). Two layers; the first short-circuits trivial bot/scraper hits.

---

## Security review notes

| Concern | Mitigation |
| --- | --- |
| UI-only gate trusted by client | Defense-in-depth: middleware **and** route-handler `requireOwnerMode()`. Never rely on client-side `isOwnerMode` UI state for auth decisions. |
| Email comparison bypass | Lowercase + trim both sides at parse time and at lookup time. No regex matching, no domain wildcards in v1. |
| Session cookie theft | Existing `SESSION_COOKIE_OPTIONS` already sets `httpOnly`, `secure`, `sameSite: "lax"`, `path: "/"`. Reuse, don't fork. |
| CSRF on `/api/admin/*` | `sameSite: "lax"` blocks cross-site POSTs from third-party origins. Optionally add a double-submit CSRF token if blaidd's UI does cross-tab admin actions. |
| Replay of `POST /api/admin/site-content` | Wix Data update is idempotent for the same `(key, value)` pair. For destructive operations (image swap, future image-delete) add a server-side correlation ID + audit log entry (sub-bead 8 in epic). |
| Brute-force on `/login` | Wix Headless `/login` is hosted on Wix's infra and inherits their throttling. Not our problem until customer-side login moves in-house. |
| Rate limiting on `/api/admin/*` | Add a simple per-IP + per-member-id token bucket in middleware. Defer to a sub-bead — not blocking for the gate spec itself. |
| Audit log | Sub-bead 8 in cfw-ajk epic — every successful `requireOwnerMode()` mutation writes a row to a `SiteContentAuditLog` CMS collection (member ID, timestamp, key, prev value, new value). Tied into save endpoint, not the gate. |
| Env leak via runtime error | Already mitigated — `ADMIN_EMAILS` is plain-text and reading it via `process.env` doesn't surface in error stacks unless explicitly serialized. Keep it out of any `console.error` paths. |
| ADMIN_EMAILS misconfigured (empty) | Empty `ADMIN_EMAILS` → empty Set → `isOwnerMode()` always returns `false`. Fail closed. |
| Logout invalidation | Existing `/api/auth/session` DELETE handler clears the session cookie. Owner mode follows. |

---

## Test plan (sub-bead deliverable, not part of this spec)

- Unit: `isOwnerMode()` returns false when no member, false when member email not in list, true when in list (case-insensitive). Empty `ADMIN_EMAILS` → all false.
- Unit: `requireOwnerMode()` throws Response(403) for non-admin; returns member object for admin.
- Integration: `/api/admin/site-content` POST returns 403 without cookie, 403 with non-admin cookie, 200 with admin cookie + valid body.
- E2E (Playwright, gated to PRs that touch /admin or /api/admin per #470 path-gated E2E setup): log in as `brenda@…` → see pencils → save edit → verify Wix Data row updated.

---

## Open questions for godfrey + Stilgar

1. **Brenda's actual login email.** Does she already have a Wix Headless member account on cfw, or does she need to register? If yes, what email — and is it the same as her Wix Studio owner email?
2. **Does Stilgar also need owner-mode access** for emergency edits? If yes, his email goes in `ADMIN_EMAILS` too. (Recommendation: yes — same risk profile as Brenda.)
3. **Should owner-mode persist across sessions** or auto-disable on logout? (Recommendation: auto-disable. Once cookie expires, owner status is gone; re-login restores it without a separate "enter owner mode" step.)
4. **Pencils visible by default for admins, or behind a toggle?** Stilgar's quote in the epic: "owner-mode toggle". Implies a toggle. (Recommendation: `?owner=1` query param OR a localStorage flag, both server-confirmed by `isOwnerMode()`. Bias: cookie / localStorage flag, not URL param — URL params leak to analytics.)

---

## Reference

- cfw-ajk epic (this spec is sub-bead 1)
- Existing auth modules: `src/lib/wix/{auth,members}.ts`, `src/lib/auth/session.ts`, `src/app/api/auth/session/route.ts`
- Webhook signature pattern (analogous defense-in-depth approach): `src/app/api/revalidate/route.ts`
- IDOR-defense lessons: cf-yvs4 / #1173, cf-9ieq, codified by the `check-http-endpoint-test-coverage.mjs` gate (#1181)
