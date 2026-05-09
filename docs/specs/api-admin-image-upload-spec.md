# `/api/admin/image-upload` endpoint spec

**Bead:** cfw-b59 (cfw-ajk.6)
**Author:** rennala (parallel pickup while cf-xdji ships)
**Status:** spec for implementer — Linux polecat picks up + ships against this contract
**Refs:** cfw-ajk EPIC, cfw-ya0 (.1 auth gate), cfw-nis (.5 EditableImage), cfw-rmh (.7 PDP product image swap), cfw-e3n (.8 audit log), cfw-icc (.10 sanitize/allowlist), cfw-sej (.4 cache invalidation)

## Purpose

Auth-gated multipart endpoint that accepts an image file from `EditableImage` (cfw-ajk.5) or the PDP image-swap UI (cfw-ajk.7), uploads it to Wix Media Manager, updates the corresponding CMS row (SiteContent for site-wide images; products.media.items[N] for product photos via cfw-ajk.7's helper), and returns the resulting media URL so the client can swap the rendered `<Image>` optimistically.

This endpoint is the **single write path** for any image edit Brenda makes from the live site. All image uploads go through here so cfw-ajk.10's validation and cfw-ajk.8's audit log fire consistently.

## Route

```
POST /api/admin/image-upload
Content-Type: multipart/form-data
```

App Router file: `src/app/api/admin/image-upload/route.ts` in `carolina-futons-web`.

## Auth contract

- `await requireOwner(request)` from `@/lib/admin/auth` (cfw-ajk.1) — returns the resolved owner's Wix Member object on success.
- `requireOwner` enforces:
  - Wix session cookie OR Bearer token must validate
  - Member's role includes `Owner`
  - Throws `AdminUnauthorizedError` (→ 401) for no session, `AdminForbiddenError` (→ 403) for non-owner
- The handler MUST NOT trust any header / cookie / form-field claim of identity beyond what `requireOwner` returns. Audit-log rows are written using `member._id` from this call only.

## Request body

`multipart/form-data` with these parts:

| Part | Type | Required | Notes |
|------|------|----------|-------|
| `file` | binary | yes | The image blob. Must be ≤ 8 MB. MIME must start with `image/`. |
| `target` | text (JSON-encoded) | yes | Discriminated union — see below. |

`target` payload shape:

```ts
type Target =
  | { kind: 'site-content'; key: string }                  // → updates SiteContent row's value or imageUrl
  | { kind: 'product-image'; productId: string; index: number }  // → swaps product.media.items[index] via cfw-ajk.7
  | { kind: 'guide-image'; slug: string }                  // → updates Guides CMS row imageUrl
```

Other shapes return `400 invalid_target_kind`.

## Response shapes

All responses are `application/json` with the cf-mgnh dispatcher contract (5-class status mapping). Body always carries `{ success: boolean }` plus contextual fields.

### Success (200)
```json
{
  "success": true,
  "mediaUrl": "https://static.wixstatic.com/media/<id>/v1/fill/.../filename.jpg",
  "wixMediaId": "<id>"
}
```

### Auth failures
- **401** `{ "success": false, "error": "Authentication required" }`
- **403** `{ "success": false, "error": "Owner role required" }`

### Validation failures (400)
Each carries an `error` code so the EditableImage component can surface a useful inline message:
| `error` code | Trigger |
|--------------|---------|
| `invalid_target` | `target` part missing or non-JSON |
| `invalid_target_kind` | discriminator not in the 3-option union |
| `invalid_target_payload` | required fields missing for the chosen kind (e.g. `key` for site-content) |
| `invalid_key` | site-content key fails cfw-ajk.10 allowlist |
| `invalid_product_id` | product-image productId fails sanitize/format |
| `invalid_index` | product-image index < 0 or > existing media length (we swap, not append) |
| `invalid_slug` | guide-image slug fails sanitize |
| `file_missing` | no `file` part in the multipart body |
| `file_too_large` | file > 8 MB (configurable via `ADMIN_IMAGE_MAX_BYTES`) |
| `unsupported_mime` | MIME not in allowlist (PNG, JPEG, WEBP, GIF, AVIF) |
| `mime_mismatch` | claimed MIME doesn't match magic bytes (cfw-ajk.10 polyglot guard) |
| `image_decode_failed` | header parses but dimensions can't be read (likely corrupt/polyglot) |

### Upstream failures (502)
```json
{ "success": false, "error": "wix_media_unavailable", "errorId": "<uuid>" }
```
Logged with full stack against the errorId so support can correlate.

### Unexpected throw (500)
```json
{ "success": false, "error": "server_error", "errorId": "<uuid>" }
```
Same errorId pattern as cf-gkgo + cfw dispatcher contract.

### Rate-limit (429)
Per-owner quota: max **30 uploads / 5 min** to protect Wix Media. Body:
```json
{ "success": false, "error": "rate_limited", "retryAfterSeconds": 60 }
```
`Retry-After` HTTP header set to the same value.

## Server-side flow

```
1. requireOwner(request) → AdminUnauthorizedError (401) | AdminForbiddenError (403) | { _id, email }
2. Read rate-limit state for member._id (Wix Data + 5-min sliding window). Reject 429 if exceeded.
3. Parse multipart with a streaming parser (busboy or Next.js native FormData):
   3a. Reject early if Content-Length > ADMIN_IMAGE_MAX_BYTES (don't buffer)
   3b. Stream file to a Buffer, capping at ADMIN_IMAGE_MAX_BYTES — abort if exceeded
   3c. Read first 16 bytes BEFORE buffering full file → call validateImageFile (cfw-ajk.10)
4. Parse target JSON; validateTarget against discriminator + per-kind helpers
5. Decode image header (sharp.metadata() or image-size) to confirm dimensions are sane
   (max 8000×8000 to reject decompression-bomb files)
6. Virus-scan placeholder hook:
   const verdict = await scanImageBuffer?.(buffer) ?? { ok: true };
   if (!verdict.ok) return 400 'virus_detected' + audit-log entry with verdict
   (Stub for v1; landing real scanner is a follow-up bead — see "Virus-scan integration" below)
7. Upload to Wix Media Manager:
   const { mediaItem } = await mediaManager.upload(
     `Brenda-Admin/${target.kind}/${slugFromTargetMeta(target)}`,
     buffer,
     { mediaType: 'image', mimeType: file.mimeType }
   );
8. Patch the corresponding CMS row:
   - 'site-content' → wixData.update('SiteContent', { ...row, imageUrl: mediaItem.fileUrl })
   - 'product-image' → delegate to updateProductImage({ productId, index, mediaId: mediaItem._id }) per cfw-ajk.7
   - 'guide-image' → wixData.update('Guides', { ...row, imageUrl: mediaItem.fileUrl })
9. invalidate caches (cfw-ajk.4):
   - site-content → invalidateSiteContent()
   - product-image → invalidateImage(productId)
   - guide-image → invalidateGuide(slug)
10. Append audit-log row (cfw-ajk.8) with: actor, target, file size, dimensions, mediaId, mediaUrl
11. Return 200 { success: true, mediaUrl, wixMediaId }
```

Each numbered step is a unit-testable boundary. Recommend extracting steps 3, 4, 5, 7, 8 into pure helpers in `src/lib/admin/image-upload/` so route.ts is a thin orchestration shell.

## Multipart streaming details

**Use a streaming parser.** Next.js's built-in `request.formData()` reads the entire body into memory before exposing it — fine for small forms but a DoS risk if a hostile owner posts a 50 GB body. Two acceptable shapes:

- **Native streaming** via `request.body` ReadableStream + a small custom multipart split. Lower-overhead but more error-prone.
- **busboy** with `request.body` piped through. Battle-tested, minimal API:
  ```ts
  import busboy from 'busboy';
  const bb = busboy({ headers: Object.fromEntries(request.headers), limits: { fileSize: ADMIN_IMAGE_MAX_BYTES, files: 1 } });
  ```
  busboy emits `'limit'` when the file exceeds `fileSize` so the request can be aborted early.

Either way: **abort early on Content-Length > ADMIN_IMAGE_MAX_BYTES**. Don't read a single byte if the header alone exceeds the cap.

Edge / Node runtime: this route MUST run on the Node runtime (`export const runtime = 'nodejs'` in route.ts) — Edge runtime doesn't expose `Buffer` and most multipart parsers depend on Node streams.

## Size limits + MIME allowlist

```ts
const ADMIN_IMAGE_MAX_BYTES = 8 * 1024 * 1024;  // 8 MB
const ADMIN_IMAGE_MAX_DIMENSIONS = { width: 8000, height: 8000 };
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);
```

Justifications:
- 8 MB cap matches Wix Media's recommended upload cap and prevents memory pressure on the Vercel Function runtime (default 1 GB memory; multipart parser + image decode + Wix SDK in flight = real budget).
- 8000×8000 caps decompression-bomb attacks (a 1 MB highly-compressed PNG can decode to gigabytes of pixels).
- AVIF inclusion supports modern phone-camera output without forcing Brenda to convert.
- SVG NOT in the list: SVG is XML and supports embedded scripts. If we ever add it, it MUST be sanitised by `sanitizeSvg()` first — defer to a follow-up bead.

## Virus-scan integration (placeholder)

For v1: ship a stub `scanImageBuffer` that always returns `{ ok: true }`. Document the integration point for a follow-up bead so a real scanner (e.g. Cloudmersive Virus Scan API, or Wix's own moderation if it exposes one) can be dropped in without restructuring the handler.

```ts
// src/lib/admin/image-upload/virus-scan.ts
export interface ScanVerdict { ok: boolean; threat?: string }
export async function scanImageBuffer(buffer: Buffer): Promise<ScanVerdict> {
  // TODO(cfw-ajk.6.followup): wire to a real scanner. Currently stub-passes.
  return { ok: true };
}
```

When a scanner is wired:
- Failure verdict → 400 `virus_detected` + audit-log row tagged with the threat name
- Scanner outage (timeout/5xx from upstream) → 502 `virus_scan_unavailable` (fail-closed; Brenda must retry)

## Cache invalidation contract

Step 9 is non-negotiable: every successful write triggers a `revalidateTag` call so customers see the new image within the 30s SLA Stilgar set. The `invalidate*` helpers are shipped in cfw-ajk.4 (`src/lib/admin/revalidate.ts`). They MUST be awaited — not fire-and-forget — because if revalidation fails Brenda will save, see no change in another tab, and assume her save was lost.

If `invalidateImage` itself throws, we still return 200 (the data layer is updated; cache will eventually expire on its own ISR window) but log a warn with the actor + target so support can spot a pattern.

## Audit-log row shape (cfw-ajk.8 dependency)

```ts
await appendAuditLogRow({
  actorMemberId: member._id,
  actorEmail: member.loginEmail,
  endpoint: 'image-upload',
  targetKey: targetToKey(target), // 'site-content/footer.heroImage' | 'product-image/prod-123#0' | 'guide-image/futon-care'
  valueBefore: prevImageUrl ?? '',
  valueAfter: mediaItem.fileUrl,
  mediaUrl: mediaItem.fileUrl,
  fileBytes: buffer.byteLength,
  fileMime: file.mimeType,
  imageWidth: meta.width,
  imageHeight: meta.height,
  userAgent: request.headers.get('user-agent') ?? '',
  clientIp: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '',
  createdAt: new Date(),
});
```

Per cfw-ajk.8: appendAuditLogRow is fire-and-forget non-blocking — a logging-write failure must NOT roll back the image upload. Logged as a warn with actor + target.

## Acceptance tests (recommended)

The implementing polecat should ship these as Vitest cases against a mocked Wix Media SDK + mocked auth helper. Mirror the cf-vtx5 dispatcher test shape.

| # | Scenario | Expected status | Body |
|---|---------|------------------|------|
| 1 | No auth header / cookie | 401 | `{success:false, error:'Authentication required'}` |
| 2 | Authenticated non-owner | 403 | `{success:false, error:'Owner role required'}` |
| 3 | Owner + valid PNG, target=site-content | 200 | `{success:true, mediaUrl, wixMediaId}`; SiteContent row updated; cache invalidated; audit row written |
| 4 | Owner + valid JPEG, target=product-image | 200 | as above + product.media.items[index] updated via cfw-ajk.7 helper |
| 5 | Owner + 9 MB file | 400 | `file_too_large`; no Wix call made |
| 6 | Owner + Content-Length 50 GB | 400 | `file_too_large`; aborted before reading body |
| 7 | Owner + 1 MB file with `.jpg` extension but PHP magic bytes | 400 | `mime_mismatch` |
| 8 | Owner + file MIME `application/pdf` | 400 | `unsupported_mime` |
| 9 | Owner + 12000×12000 image | 400 | `image_decode_failed` (size guard) |
| 10 | Owner + valid file but `target.key` not in cfw-ajk.10 allowlist | 400 | `invalid_key` |
| 11 | Owner + product-image with index out of bounds | 400 | `invalid_index` |
| 12 | Wix Media SDK throws timeout | 502 | `wix_media_unavailable` + errorId in body and logs |
| 13 | Audit-log write fails | 200 | success path NOT rolled back; warn logged |
| 14 | Cache invalidate fails | 200 | success path NOT rolled back; warn logged |
| 15 | 31st upload from same member in 5 min | 429 | `rate_limited`; Retry-After header set |
| 16 | Virus-scan stub returns ok | 200 | success |

E2E (Playwright on staging cfw):
- [ ] Brenda logs in, toggles owner mode, clicks pencil on the homepage hero image, picks a 2 MB PNG, sees optimistic swap within 1s, hard-refreshes a separate tab within 5s and sees the new image rendered server-side.
- [ ] Same flow with a 9 MB file → inline error, no upload.

## Implementation hand-off

Suggested file layout for the implementing polecat:

```
carolina-futons-web/
├── src/app/api/admin/image-upload/route.ts        # thin orchestration shell
├── src/lib/admin/image-upload/
│   ├── parse-multipart.ts                         # busboy-based streaming parse
│   ├── validate-image.ts                          # MIME/magic-bytes/dimensions
│   ├── upload-to-wix-media.ts                     # @wix/sdk wrapper with retry
│   ├── apply-cms-write.ts                         # discriminated union dispatcher
│   ├── virus-scan.ts                              # stub interface for v1
│   └── rate-limit.ts                              # 30/5min sliding window
└── src/__tests__/api/admin-image-upload.test.ts   # acceptance matrix above
```

Helpers in `src/lib/admin/` are imported by both this endpoint and `cfw-ajk.3` (`/api/admin/site-content`) — keep them framework-agnostic.

## Open questions for Stilgar / mayor before impl starts

1. **Wix Media folder structure** — should uploads land in a single `Brenda-Admin/` folder or per-target subfolders? Spec assumes `Brenda-Admin/{kind}/{slug}/`. Confirm.
2. **Dimensions cap (8000×8000)** — phones can output 12 MP+ images. Document the implicit "we'll resize on display" expectation OR raise the cap. Default in spec: 8000 as a memory-pressure cap; OK to raise to 12000 if Vercel Function memory allows.
3. **AVIF support** — newer iPhones export HEIC by default; we'd want HEIC→JPEG conversion at the edge (Wix's CDN already does this on serve, so storing HEIC is fine if Wix Media accepts the upload). Confirm with godfrey + millicent.
4. **Virus-scan v1 stub** — acceptable to ship without a real scanner? Brenda is a single trusted owner so attack surface is low; risk is supply-chain (a compromised Wix Media browser plugin could swap files). Track as follow-up bead either way.

## Out of scope (file separately if needed)

- Image cropping / rotating UI inside the editor — for v1 Brenda uploads pre-edited files. UI cropping is a polish bead.
- Bulk upload (drag-drop folder of 20 images) — single-file only for v1.
- Background jobs for large image processing — synchronous request/response only for v1.
- SVG support — explicitly excluded; needs sanitisation work first.
