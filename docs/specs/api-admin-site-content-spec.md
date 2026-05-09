# `/api/admin/site-content` Endpoint — Spec

**Bead:** cfw-ajk sub-bead 3 (Path B inline-edit save endpoint) / cfw-0tc Linux mirror
**Author:** millicent (cfutons/crew)
**Date:** 2026-05-09
**Status:** Spec — pending review by godfrey + Stilgar
**Depends on:** cfw-ajk sub-bead 1 (owner-mode auth gate spec, PR #1184)

---

## Goal

When Brenda clicks a pencil → edits a string → clicks Save in the inline editor, the browser POSTs `{key, value}` to `/api/admin/site-content`. The server authenticates her as an owner, writes the row to the `SiteContent` Wix CMS collection, busts the read-side cache, and returns 200. Anything else returns a structured error.

Sub-bead 3 implements only this single endpoint. Sub-bead 5 (image upload) is a separate route with separate concerns (multipart, media manager, MIME validation). Sub-bead 7 (product image swap) hits Wix Stores API and is also separate.

---

## Wire contract

### Request

```
POST /api/admin/site-content
Content-Type: application/json
Cookie: <SESSION_COOKIE_NAME>=<wix-session>

{
  "key":   "homepage.hero.title",
  "value": "Welcome to Carolina Futons"
}
```

- `key` (string, required) — dotted path identifying the editable string. Must match `/^[a-z0-9_]+(\.[a-z0-9_]+)*$/i`. Length 1–200. This shape mirrors keys already in the codebase: `footer.tagline`, `hero.headline`, `visit.address.street`. Strict allowlist (no slashes, no spaces) prevents key spoofing into other collections via clever dotted paths.
- `value` (string, required) — the new copy. Length 0–10_000 chars. Empty string is allowed (Brenda may want to clear a field). HTML-looking text is allowed but treated as opaque — see [Sanitization](#sanitization) below.

No other fields. Extra fields are ignored (not echoed in errors).

### Response — 200 OK (write applied)

```json
{
  "ok": true,
  "key": "homepage.hero.title",
  "value": "Welcome to Carolina Futons",
  "wroteRevision": true
}
```

`wroteRevision: false` means the value was already present and the row update was a no-op (idempotent). Cache is still busted on no-ops to keep the contract simple.

### Response — 400 Bad Request

```json
{ "ok": false, "error": "invalid-json"  | "missing-key" | "missing-value" | "invalid-key-format" | "key-too-long" | "value-too-long" }
```

### Response — 401 Unauthorized

```json
{ "ok": false, "error": "not-authenticated" }
```

No session cookie or session expired. Client should redirect to `/login?callbackUrl=/admin/...`.

### Response — 403 Forbidden

```json
{ "ok": false, "error": "not-authorized" }
```

Authenticated but `loginEmail` not in `ADMIN_EMAILS`. Hands off to `requireOwnerMode()` per cfw-ajk.1.

### Response — 502 Bad Gateway

```json
{ "ok": false, "error": "wix-write-failed", "errorId": "<uuid>" }
```

Wix Data API rejected the write or timed out. `errorId` is a server-generated UUID echoed in server logs so support can correlate. Body is intentionally vague — never echo Wix internals to the client.

### Response — 503 Service Unavailable

```json
{ "ok": false, "error": "collection-not-provisioned", "errorId": "<uuid>" }
```

The `SiteContent` collection does not exist on the Wix backend. Distinguishes a "Brenda's site isn't set up yet" failure from a transient outage. Falls back to the same 502 path if Wix's response doesn't make the distinction obvious — the discriminator is best-effort.

---

## Implementation sketch

`src/app/api/admin/site-content/route.ts`:

```ts
import "server-only";

import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { randomUUID } from "node:crypto";

import { requireOwnerMode } from "@/lib/auth/owner-mode";
import { upsertSiteContentItem } from "@/lib/wix/site-content-write";
import { SITE_CONTENT_CACHE_TAG } from "@/lib/cms/site-content";

export const dynamic = "force-dynamic";

const KEY_RE = /^[a-z0-9_]+(\.[a-z0-9_]+)*$/i;
const KEY_MAX = 200;
const VALUE_MAX = 10_000;

export async function POST(request: Request) {
  // 1. Auth — throws Response(401|403) on failure (per cfw-ajk.1).
  let member;
  try {
    member = await requireOwnerMode();
  } catch (resp) {
    if (resp instanceof Response) return resp;
    throw resp;
  }

  // 2. Parse + validate.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("invalid-json");
  }

  const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const rawKey = obj.key;
  const rawValue = obj.value;

  if (typeof rawKey !== "string" || rawKey.length === 0) return badRequest("missing-key");
  if (typeof rawValue !== "string") return badRequest("missing-value");
  if (rawKey.length > KEY_MAX) return badRequest("key-too-long");
  if (rawValue.length > VALUE_MAX) return badRequest("value-too-long");
  if (!KEY_RE.test(rawKey)) return badRequest("invalid-key-format");

  const key = rawKey.trim();
  // Sanitize: strip ASCII control chars 0x00–0x1F (except \t \n) and 0x7F.
  // Catches accidental zero-width / invisible chars from paste. Leaves
  // Unicode + whitespace + emoji intact.
  // eslint-disable-next-line no-control-regex
  const value = rawValue.replace(/[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]/g, "");

  // 3. Write via Wix Data API.
  const errorId = randomUUID();
  let wroteRevision: boolean;
  try {
    wroteRevision = await upsertSiteContentItem({ key, value });
  } catch (err) {
    console.error("[/api/admin/site-content] Wix write failed", {
      errorId,
      memberId: member.contactId,
      key,
    });
    if (isCollectionMissing(err)) {
      return NextResponse.json(
        { ok: false, error: "collection-not-provisioned", errorId },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { ok: false, error: "wix-write-failed", errorId },
      { status: 502 },
    );
  }

  // 4. Bust the read-side cache so Brenda sees her edit on next render.
  // unstable_cache (cf-4mol) keys the cache by tag; revalidateTag flushes
  // all entries.
  revalidateTag(SITE_CONTENT_CACHE_TAG);

  return NextResponse.json({ ok: true, key, value, wroteRevision });
}

function badRequest(error: string) {
  return NextResponse.json({ ok: false, error }, { status: 400 });
}

function isCollectionMissing(err: unknown): boolean {
  // Best-effort discriminator. Wix Data SDK throws a structured error with
  // `details.applicationError.code === "WD_COLLECTION_NOT_FOUND"` when the
  // collection doesn't exist; older responses use 404 with a code in body.
  // Fail open (treat as generic) if the shape is unrecognized.
  if (!err || typeof err !== "object") return false;
  const e = err as Record<string, unknown>;
  const code =
    (e?.details as { applicationError?: { code?: string } } | undefined)?.applicationError?.code;
  return code === "WD_COLLECTION_NOT_FOUND";
}
```

`src/lib/wix/site-content-write.ts`:

```ts
import "server-only";

import { getWixClient } from "@/lib/wix-client";

const COLLECTION_ID = "SiteContent";

interface SiteContentRow {
  _id?: string;
  key: string;
  value: string;
}

/** Insert-or-update a SiteContent row by key. Returns true if any field on
 *  the existing row changed (or it was newly created); false if the value
 *  was already present and no Wix write was issued. */
export async function upsertSiteContentItem({
  key,
  value,
}: {
  key: string;
  value: string;
}): Promise<boolean> {
  const client = getWixClient();
  const existing = await client.items
    .query(COLLECTION_ID)
    .eq("key", key)
    .limit(1)
    .find();
  const row = existing.items[0] as SiteContentRow | undefined;

  if (row && row.value === value) {
    return false;
  }

  if (row?._id) {
    await client.items.update(COLLECTION_ID, { ...row, value });
  } else {
    await client.items.insert(COLLECTION_ID, { key, value });
  }
  return true;
}
```

The `_id` round-trip avoids creating duplicate rows for the same key, which would silently break the reader (`getSiteContent` resolves first match — in the rare case of duplicates, last-write-wins reads are non-deterministic).

---

## Sequence diagram

```
Brenda's        Next.js          requireOwnerMode    Wix Data       Next.js cache
browser         route handler    (cfw-ajk.1)         API
   │                │                  │                │                │
   │ POST {key,val} │                  │                │                │
   ├───────────────▶│                  │                │                │
   │                │ requireOwnerMode │                │                │
   │                ├─────────────────▶│                │                │
   │                │ getCurrentMember + ADMIN_EMAILS check              │
   │                │ — 403 if not admin                                 │
   │                │                  │                │                │
   │                │ validate body    │                │                │
   │                │  — 400 if shape wrong                              │
   │                │                  │                │                │
   │                │ items.query.eq("key").limit(1).find()              │
   │                ├──────────────────────────────────▶│                │
   │                │ {items:[row?]}   │                │                │
   │                │◀──────────────────────────────────┤                │
   │                │                  │                │                │
   │                │ if row.value === value: skip write                 │
   │                │ else: items.update / insert                        │
   │                ├──────────────────────────────────▶│                │
   │                │ ok               │                │                │
   │                │◀──────────────────────────────────┤                │
   │                │                  │                │                │
   │                │ revalidateTag('site-content')                      │
   │                ├───────────────────────────────────────────────────▶│
   │                │                  │                │                │
   │                │ 200 {ok:true,wroteRevision}       │                │
   │◀───────────────┤                  │                │                │
   │                │                                                    │
   │ Optional: page refresh (or React Server-Component re-mount via      │
   │ router.refresh()) to pick up new value from getSiteContent          │
```

Brenda's next page render goes through `getSiteContent(...)` → `unstable_cache` sees the busted tag → fetches the fresh row from Wix → returns the new value. Stale value is gone within one render.

---

## Sanitization

`value` is stored verbatim (minus control chars). It is **not** HTML-escaped or markdown-stripped at write time. Reasons:

1. The reader (`getSiteContent`) hands strings to React, which auto-escapes by default. As long as no consumer of the string uses an unsafe innerHTML sink, XSS via this endpoint is impossible.
2. Brenda may legitimately want to write copy with characters that look like HTML (`'<3 these futons!'`). Escaping at write time corrupts that.
3. Wix CMS rich-text fields handle their own escaping if the column type were `RICH_TEXT`; we use plain `TEXT`.

Defense in depth: every render site that consumes a `SiteContent` value must NOT use React's unsafe innerHTML escape hatch. Add a lint rule (sub-bead 10 in epic) that flags raw-HTML sinks near a `getSiteContent` call.

Control-char strip removes ASCII 0x00–0x1F (except tab `\t = 0x09` and newline `\n = 0x0A`) plus 0x7F. Catches accidental paste of zero-width / invisible characters that some editors insert.

---

## Idempotency + concurrency

- Same `{key, value}` twice in a row: second call returns `wroteRevision: false`, no Wix write issued.
- Two simultaneous edits to the same key (Brenda has two tabs open): last-write-wins. The Wix Data API does not expose a CAS / version handle in the v2 SDK, so we cannot detect the conflict at write time. Acceptable for v1 — admin set is one person.
- Sub-bead 9 (undo / version history) plans an append-only `SiteContentRevisions` collection that captures every accepted write. That gives a manual conflict-recovery path if this ever bites.

---

## Cache invalidation contract

`SITE_CONTENT_CACHE_TAG` is exported from `src/lib/cms/site-content.ts` (line 71 in the audited reader). Reuse, don't fork. `revalidateTag` is called *after* a successful write. If `revalidateTag` itself throws (rare — it's a synchronous path-rewrite under the hood), the route handler still returns 200; the next stale read self-heals at the 5-minute revalidate boundary.

The existing `/api/revalidate` webhook from Wix CMS also fires `revalidateTag(SITE_CONTENT_CACHE_TAG)` on its own (when Brenda or anyone else edits via the Wix dashboard directly). Both code paths converge on the same tag — no special coordination needed.

---

## Audit log (sub-bead 8 — out of scope here)

Once sub-bead 8 lands (a `SiteContentAuditLog` CMS collection), this route handler appends a row after every successful write:

```
{
  memberId: member.contactId,
  memberEmail: member.loginEmail,
  key,
  prevValue: row?.value ?? null,  // captured BEFORE update
  newValue: value,
  changedAt: new Date().toISOString(),
  correlationId: errorId,         // even on success, so failed rollbacks are linkable
}
```

Audit insert is best-effort: a failure does NOT roll back the SiteContent write or fail the user-facing 200. We never want to reject Brenda's edit because the audit log is misconfigured. If audit fails, log the failure and the correlation ID locally; sub-bead 8 spec covers the recovery model.

---

## Test plan

### Unit (vitest, `tests/api/admin/site-content.test.ts`)

- 200 with `wroteRevision: true` when `requireOwnerMode` resolves and the row doesn't exist
- 200 with `wroteRevision: false` when the row exists with the same value
- 200 with `wroteRevision: true` when the row exists with a different value
- 400 for each invalidation branch: `invalid-json`, `missing-key`, `missing-value`, `invalid-key-format`, `key-too-long`, `value-too-long`
- 401 when `requireOwnerMode` throws Response(401)
- 403 when `requireOwnerMode` throws Response(403)
- 502 when the Wix Data write rejects with a generic error
- 503 when the Wix Data write rejects with `WD_COLLECTION_NOT_FOUND`
- `revalidateTag` is called exactly once on success, zero times on every error path
- Audit log row inserted on success (gated until sub-bead 8 lands; vitest mock for now)

### Integration (Playwright, path-gated per cfw #470)

- Login as `brenda@…` → POST `/api/admin/site-content` with `{key:"e2e.smoke.test", value:Date.now().toString()}` → 200
- GET `/` → page renders the new value within one render (after explicit `router.refresh()`)
- POST same `{key, value}` → 200 with `wroteRevision: false`
- POST without cookie → 302 to `/login` (middleware-level redirect from cfw-ajk.1) OR 401 if middleware is bypassed via direct fetch
- POST with non-admin cookie → 403

### Negative tests already enforced by `check-http-endpoint-test-coverage.mjs` (#1181 in cfutons monorepo)

— that gate guards the cfutons Velo backend, not cfw-web. The cfw-web equivalent is the path-gated E2E job + per-PR test coverage on this route handler. Worth flagging that cfw doesn't yet have a "new-endpoint must have a test" gate of its own; if useful, can add one in a follow-up bead.

---

## Security review notes

| Concern | Mitigation |
| --- | --- |
| Authn bypass | `requireOwnerMode` enforces the cookie + email-allowlist check before validation runs. No code path between auth and write skips it. |
| Authz escalation via key path | Strict `KEY_RE` regex blocks any path that isn't lowercase-alphanumeric-underscore-dot. Cannot reach into other collections, cannot inject JSON or operators. |
| Stored XSS | `value` rendered through React default-escape only. No raw-HTML sinks on `SiteContent` reads (verified in cf-4mol). Lint rule planned (sub-bead 10). |
| CSRF | Existing `SESSION_COOKIE_OPTIONS` sets `sameSite: "lax"`. POST from another origin doesn't carry the cookie. No CSRF token needed for v1. Reconsider if cross-origin admin tooling ever exists. |
| Replay (write same value many times) | No-op detection: `wroteRevision: false` on identical value. Audit log dedupes on `(memberId, key, newValue, prev_changedAt)` — sub-bead 8 concern. |
| Rate limit (admin floods) | Defer to sub-bead 8 + middleware. Brenda is one person; floods are bot-only. Edge middleware presence-check in cfw-ajk.1 already filters unauthenticated traffic. |
| Data exfil via error responses | All `errorId` values are server-generated UUIDs, never include any of the input. Wix internals are never echoed. |
| Wix API key leak | Wix Headless `client.items.update` uses the per-request session token, NOT a backend API key. No secret leaves the server boundary on write. |
| Body size (DoS via large value) | `request.json()` honors Vercel's default 4.5 MB limit. `VALUE_MAX = 10_000` chars (~20 KB UTF-16) clamps further. 400 returned for over-limit inputs before the parse completes is not free; consider `Content-Length` short-circuit if the route ever sees abusive traffic. |
| Audit log spoofing | Audit rows write `member.contactId` from the server-side `requireOwnerMode` return value, never from the request body. Brenda cannot impersonate anyone. |

---

## Open questions for godfrey + Stilgar

1. **`SiteContent` collection schema final?** The reader assumes columns `key` (TEXT) and `value` (TEXT). Is that the chosen shape, or do we want `RICH_TEXT` for `value` to allow markdown/inline-HTML down the line? (Recommendation: keep `TEXT` for v1; add a `format` column later if rich text becomes necessary.)
2. **Provisioning?** `provisionCmsCollections.js` (cfutons monorepo) and `provision-stilgar-todos.mjs` (cf-2gux / #1179) cover other collections but not `SiteContent`. Is it expected to be created manually first, auto-created on first write (Wix sometimes does this), or should sub-bead 3 land with a migration script?
3. **Per-key revisions?** Is sub-bead 9 (undo/version history) planned to also live in `SiteContent` (with a `_revision` column), or in a separate `SiteContentRevisions` collection? The sketch above assumes the latter.
4. **Should `key` be machine-validated against an enum?** Today the contract is "any dotted path". A future safety improvement is to enforce that `key` matches one of the known editable strings (compiled from the codebase). Out of scope for v1, but worth flagging as a future tightening.

---

## Reference

- cfw-ajk epic
- cfw-ajk sub-bead 1 spec — owner-mode auth gate (PR #1184, this repo)
- `src/lib/cms/site-content.ts` — reader side (cf-4mol / cfw-66o.2)
- `src/app/api/revalidate/route.ts` — webhook signature pattern, error-id pattern
- `src/app/api/swatch-request/route.ts` — body-validation pattern reference
- cf-yvs4 IDOR-defense lessons codified by cfutons #1181 (`check-http-endpoint-test-coverage`)
