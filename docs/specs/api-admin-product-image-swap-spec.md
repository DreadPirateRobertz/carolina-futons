# PDP product image swap spec — variant + product fallback

**Bead:** cfw-rmh (cfw-ajk.7)
**Author:** rennala
**Status:** spec for implementer — extends `EditableImage` (cfw-nis / cfw-ajk.5) and consumes `/api/admin/image-upload` (cfw-b59 / cfw-ajk.6)
**Companion spec:** `docs/specs/api-admin-image-upload-spec.md` (cfw-b59) — read first; this spec assumes its 12-step pipeline + auth contract.

## Purpose

Owner-mode pencil affordance on every image rendered in the PDP gallery. Click → file picker → upload via cfw-b59 → patch the Wix Stores entity (variant.media OR product.media) so customers see the new image within ~30s. Variant-aware: if the rendered gallery image belongs to a specific size/colour variant, the swap targets that variant; otherwise it targets the product's primary media list.

This bead is the cfw-rmh variant **expansion** of the `target = { kind: 'product-image', ... }` slice already roughed out in the cfw-b59 spec. The endpoint stays in `/api/admin/image-upload`; what's new here is:

1. The **target shape gains a variantId field** (optional — present when the gallery item is variant-keyed).
2. A new server helper **`updateProductImage()`** that does variant ID resolution, ifMatch concurrency, and a fallback to product.media when variant.media is empty.
3. Frontend wiring on the PDP — pencil placement on the right gallery item, swap of the rendered `<Image>` after a successful upload.

## Companion-spec deltas vs cfw-b59

cfw-b59 declared this target shape:

```ts
{ kind: 'product-image'; productId: string; index: number }
```

cfw-rmh refines to:

```ts
{
  kind: 'product-image';
  productId: string;
  index: number;
  variantId?: string;       // NEW — present iff the gallery is showing a variant-specific media list
  ifMatchRevision?: number; // NEW — last-seen revision to detect concurrent edits
}
```

Both new fields are **optional** so cfw-b59's existing 12-step pipeline still works for the simpler case (product-level swap). The `updateProductImage` helper branches on whether `variantId` is set.

## Variant ID resolution

Wix Stores represents a product as `Product { _id, productOptions: [{name, choices: [...]}], variants: [{_id, choices, media}], media: { items: [...] } }`. A gallery image rendered on the PDP can come from one of:

1. **`product.media.items[index]`** — the product's primary gallery (shown when no variant is selected, or as fallback)
2. **`product.variants[v].media.items[index]`** — variant-specific gallery (shown when the user has a colour/size selection that maps to a variant)

The PDP server component already knows which case it's in (it's the one driving the `<Image>` source). It MUST forward the right discriminator to `EditableImage`:

```tsx
{/* product-level gallery */}
<EditableImage
  productId={product._id}
  index={i}
  src={item.url} alt={...} width={W} height={H}
/>

{/* variant-specific gallery */}
<EditableImage
  productId={product._id}
  variantId={selectedVariant._id}
  index={i}
  src={item.url} alt={...} width={W} height={H}
/>
```

The component never needs to RESOLVE the variant ID — it receives it from the parent. Resolution is the parent's responsibility (it already does this to render the right images).

### Fallback when variant.media is empty

A variant CAN have an empty `variant.media.items` array (Wix Stores supports inheriting from `product.media`). When the PDP is showing inherited images and the owner clicks the pencil, two reasonable behaviours:

- **A. Promote** — write to `variant.media` for the first time, breaking inheritance for that variant only. Targeted edit; other variants still inherit.
- **B. Pass through** — write to `product.media` instead, affecting every variant that still inherits.

The right call is **A** — the owner clicked an image *while a specific variant was selected*; surprising her by editing the shared media is worse than letting her promote. Document this in the admin guide (cfw-ajk.11).

`updateProductImage` implements (A): if `variantId` is provided AND `variant.media.items.length === 0`, the helper:
1. Reads the inherited `product.media.items[index]` to preserve any siblings the owner ISN'T editing
2. Copies the unchanged siblings into `variant.media.items` and replaces position `index` with the new media
3. Patches the variant only

If `variantId` is omitted, the helper writes straight to `product.media.items[index]` — the simpler product-level case.

## ifMatch concurrency

Two owners editing the same product simultaneously could clobber each other's saves. Wix Stores' update API supports an `ifMatch` revision header (or `revision` property in some SDK shapes — confirm against the live `@wix/stores` SDK version). The flow:

1. PDP server component reads the product → captures `product.revision` → passes it to `EditableImage` as a `productRevision` prop.
2. `EditableImage` forwards `ifMatchRevision: productRevision` in the upload POST body.
3. `updateProductImage` issues the PATCH with `ifMatch: ifMatchRevision`.
4. Wix Stores returns a 409/precondition-failed if the revision is stale.
5. The endpoint maps that to `409 conflict` per the cf-mgnh dispatcher contract:

```json
{
  "success": false,
  "error": "stale_revision",
  "currentRevision": 7,
  "submittedRevision": 5
}
```

cfw-mgnh classifier addition: `409` for `stale_revision` should map cleanly — the existing taxonomy (security/authz/not-found/rate-limit/infra/validation/business) doesn't have a 409 class. Add a `'stale revision' / 'precondition failed'` → 409 case to the existing `_veloDispatchSoftFailStatus` (NOT a new class — extend the not-found bucket OR add a one-line case before the validation check). Document the addition in this PR.

`EditableImage` handles the 409:
- Surface an inline message: "Someone else edited this product while you were uploading. Refresh to see the latest, then try again."
- Do NOT auto-retry (the owner's edit might no longer make sense against the new state)
- Provide a "refresh" button that re-renders the PDP server component

If the PDP doesn't have a revision available (older Wix Stores SDK shapes don't expose it), the helper falls back to read-then-write WITHOUT the ifMatch header and accepts last-write-wins. Document this fallback in the helper's doc comment.

## Multipart contract

Identical to cfw-b59 — the new variant fields are inside the `target` JSON part:

```
POST /api/admin/image-upload
Content-Type: multipart/form-data; boundary=---...

Content-Disposition: form-data; name="file"; filename="hero-2.jpg"
Content-Type: image/jpeg
[binary]

Content-Disposition: form-data; name="target"
{"kind":"product-image","productId":"prod-123","variantId":"variant-9","index":0,"ifMatchRevision":7}
```

No new size limits, MIME rules, virus-scan, or auth — all inherited from cfw-b59.

## Server-side flow

`updateProductImage()` lives at `src/lib/admin/products.ts` per the cfw-b59 file layout. It's called from cfw-b59's step 8 ("Patch the corresponding CMS row") for `target.kind === 'product-image'`.

```
1. Read the product:
   const product = await wixStoresProducts.getProduct(target.productId);
   if (!product) throw new NotFoundError('Product not found');

2. Determine target list + revision:
   - If target.variantId:
     const variant = product.variants.find(v => v._id === target.variantId);
     if (!variant) throw new NotFoundError('Variant not found for product');
     mediaList = variant.media?.items ?? [];
     scope = 'variant';
   - else:
     mediaList = product.media?.items ?? [];
     scope = 'product';

3. Bounds check:
   if (target.index < 0 || target.index >= mediaList.length) {
     // Special-case: variant inheritance — fall through to product.media
     if (scope === 'variant' && mediaList.length === 0) {
       mediaList = product.media?.items ?? [];
       // STILL bounds-check against the inherited list
       if (target.index < 0 || target.index >= mediaList.length) {
         throw new InvalidIndexError();
       }
       // Promote: clone product list into variant, then mutate at index
       newVariantList = [...mediaList];
       newVariantList[target.index] = { _id: uploadedMediaId, url: uploadedMediaUrl };
       return patchVariant(target.productId, target.variantId, newVariantList, target.ifMatchRevision);
     }
     throw new InvalidIndexError();
   }

4. Build the new list:
   const newList = [...mediaList];
   newList[target.index] = { _id: uploadedMediaId, url: uploadedMediaUrl };

5. Patch:
   - scope === 'variant' → patchVariant(productId, variantId, newList, ifMatch)
   - scope === 'product' → patchProduct(productId, newList, ifMatch)

6. Each patcher:
   try {
     return await wixStoresProducts.updateProduct(productId, { ... }, { ifMatch: target.ifMatchRevision });
   } catch (err) {
     if (err.code === 'PRECONDITION_FAILED' || err.status === 409) {
       throw new StaleRevisionError({ submittedRevision: target.ifMatchRevision, currentRevision: <re-read from product> });
     }
     throw err;
   }
```

Extract each error class into `src/lib/admin/products/errors.ts`:

```ts
export class NotFoundError extends Error { constructor(msg) { super(msg); this.name = 'NotFoundError'; }}
export class InvalidIndexError extends Error { constructor() { super('index out of bounds'); this.name = 'InvalidIndexError'; }}
export class StaleRevisionError extends Error {
  constructor(public detail: { submittedRevision: number; currentRevision: number }) {
    super('stale revision');
    this.name = 'StaleRevisionError';
  }
}
```

The cfw-b59 endpoint wraps these and maps to HTTP statuses:

| Helper error | HTTP | `error` body field |
|--------------|------|---------------------|
| `NotFoundError('Product')` | 404 | `'product_not_found'` |
| `NotFoundError('Variant')` | 404 | `'variant_not_found'` |
| `InvalidIndexError` | 400 | `'invalid_index'` |
| `StaleRevisionError` | 409 | `'stale_revision'` (+ `currentRevision` in body) |
| Other Wix upstream throw | 502 | `'wix_stores_unavailable'` + errorId |

cf-mgnh classifier addition for the 409 case is a one-line extension to the existing helper:

```js
// existing not-found block
if (lowered.includes('not found') || lowered.includes('no record')) return 404;

// NEW: cfw-rmh — concurrency conflict
if (lowered.includes('stale revision') || lowered.includes('precondition failed')) return 409;
```

## Frontend wiring (PDP)

The PDP gallery is a React Server Component. Owner-mode rendering happens client-side via `EditableImage` (cfw-nis). The required parent change is small but precise:

```tsx
// Before
<ProductGallery>
  {product.media.items.map((item, i) => <Image key={i} src={item.url} ... />)}
</ProductGallery>

// After
<ProductGallery>
  {(activeVariant?.media?.items ?? product.media.items).map((item, i) => (
    <EditableImage
      key={i}
      productId={product._id}
      variantId={activeVariant?._id}              // undefined when product-level
      index={i}
      productRevision={product.revision}          // forwarded for ifMatch
      src={item.url} alt={item.alt} width={W} height={H}
    />
  ))}
</ProductGallery>
```

Pencil placement: top-right corner of the gallery item, with `mix-blend-mode: difference` or a translucent backdrop so it stays visible against light AND dark images. Reuse blaidd's pencil component from cfw-bn8 (EditableText) — same icon, same z-index strategy.

When the active variant changes, the gallery component re-renders against the new mediaList — pencils stay attached to the right indices because `index` is bound to the new array's positions, not a stable image ID. Acceptable for v1; if owners report confusion (pencil on image A jumps to image B after variant switch), we can stabilise to media-id keys in a follow-up.

## Behavior on stale revision (409)

When `EditableImage` sees a 409 response, the user-visible flow:

1. Inline error: "Someone else just updated this product. Refresh to load the latest version, then upload again." (no auto-retry — see ifMatch section).
2. The previously-rendered image stays in place (no optimistic swap, no flicker).
3. A "Refresh product" button surfaces. Click → `router.refresh()` (Next.js App Router) — re-runs the PDP server component, fetches the latest product, the new revision propagates via `productRevision` prop.
4. After refresh the owner can re-attempt the upload.

## Acceptance tests

Mirror cfw-b59's matrix shape; add the variant + concurrency rows.

| # | Scenario | Expected |
|---|---------|----------|
| 1 | Owner + product-level swap (no variantId) → product.media.items[0] replaced | 200 + `mediaUrl`; product CMS updated; revalidateTag(`product-${id}`) fires |
| 2 | Owner + variant swap (variant has its own media) → variant.media.items[0] replaced | 200; variant CMS updated; product.media untouched |
| 3 | Owner + variant swap when variant.media is empty (inheritance) → variant.media populated from product.media with target index replaced | 200; variant.media now has full list with new image at index; product.media untouched |
| 4 | Owner + index out of bounds (both lists < index) | 400 `invalid_index` |
| 5 | Owner + variantId references a variant that doesn't exist on the product | 404 `variant_not_found` |
| 6 | Owner + productId references a product that doesn't exist | 404 `product_not_found` |
| 7 | Owner submits ifMatchRevision=5 but current revision is 7 | 409 `stale_revision` + `currentRevision: 7` in body |
| 8 | Owner submits no ifMatchRevision (older client) | 200 last-write-wins (no precondition) |
| 9 | Wix Stores SDK throws timeout | 502 `wix_stores_unavailable` + errorId logged |
| 10 | Variant has its own media but the OWNER has the product-level gallery rendered (variantId omitted) | 200 — writes to product.media; variant.media unchanged |
| 11 | Cache invalidate fails | 200 (success path NOT rolled back); warn logged |
| 12 | Audit-log row written for both product-level and variant-level swaps with `targetKey` discriminating them (`prod-123#0` vs `prod-123/variant-9#0`) | row present in `AdminAuditLog` |

E2E (Playwright on staging cfw):
- [ ] Brenda picks a colour variant on a PDP, clicks pencil on the second gallery image, picks a 1.5 MB JPEG, sees optimistic swap within 1s. Hard-refresh another tab → variant gallery shows new image; product-level gallery (no variant selected) unchanged.
- [ ] Two browser tabs open as owner, both navigate to same PDP. Tab A swaps image 0 → 200. Tab B (with stale revision) swaps image 1 → 409 with refresh CTA. Click refresh → Tab B re-renders with Tab A's image at 0; second swap on image 1 succeeds.

## Open questions for Stilgar / mayor before impl

1. **Variant inheritance promotion** — spec defaults to (A) "promote inherited list into variant.media on first edit". Confirm vs (B) write-through to product.media. (A) seems safer per the rationale above; flag if you disagree.
2. **Pencil placement after variant change** — index-keyed for v1 (pencils may "jump" if the new variant's mediaList has fewer items). Acceptable, or wait for media-id-keyed stabilisation?
3. **`@wix/stores` SDK ifMatch shape** — confirm the SDK version used by cfw exposes the precondition header (some shapes use a `revision` body field instead). godfrey is closest to the SDK surface.
4. **Multi-image bulk swap** — out of scope for v1; file separately if Brenda asks.

## Implementation hand-off

Suggested file additions:

```
carolina-futons-web/
├── src/lib/admin/products/
│   ├── update-product-image.ts        # main helper (variant + product + inheritance)
│   ├── errors.ts                      # NotFoundError | InvalidIndexError | StaleRevisionError
│   └── __tests__/update-product-image.test.ts  # acceptance matrix above (mocked Wix Stores SDK)
└── src/components/admin/EditableImage.product.tsx  # variant of EditableImage with productId/variantId/index props
```

The dispatcher (cfw-b59 `/api/admin/image-upload`) remains the single endpoint. Only its `case 'product-image':` branch grows to call this new helper.

Cache-tag plan: every successful patch invalidates `product-${productId}` (already shipped via cfw-sej `invalidateImage(productId)`). Variant-level swaps still invalidate the product tag — finer-grained variant tags are out of scope for v1.

## Out of scope (file separately if needed)

- Reorder gallery images (drag-and-drop within the gallery).
- Add a NEW image slot (we only swap existing slots — Brenda must add slots via Wix Stores admin first; document in cfw-ajk.11 admin guide).
- Bulk variant edit (apply the same image to all variants of a colour).
- Image cropping in-browser.
