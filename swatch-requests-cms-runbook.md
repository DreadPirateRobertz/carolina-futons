# SwatchRequests CMS Collection — Wix Dashboard Runbook

**Bead:** cf-3qt.8.19
**Author:** radahn
**Date:** 2026-05-04
**Audience:** Stilgar (site owner — manual Wix Dashboard work)
**Scope:** Create the `SwatchRequests` Wix CMS collection used by the
`/swatch-request` form (carolinafutons.com Next.js app → Velo backend `_functions/sampleRequests`).

---

## Why this runbook exists

The Velo backend at `src/backend/swatchRequest.web.js` (function
`submitSwatchRequest`, lines 194–211) calls `wixData.insert('SwatchRequests', record)`.
That collection currently does **not exist** in the Wix CMS, so every form
submission lands in the catch path and never persists. This runbook walks
through creating it with the exact schema the Velo code writes.

> **Source of truth:** the field list below is derived directly from the
> `record` object in `swatchRequest.web.js`. If those Velo fields change,
> update this runbook and the dashboard collection together.

---

## Step 1 — Sign in to Wix Dashboard

1. Go to <https://manage.wix.com>.
2. Sign in as `carolinafutons@gmail.com` (credentials in `secrets.env` or
   1Password under "Wix Owner").
3. Open the production Carolina Futons site dashboard.

---

## Step 2 — Create the collection

1. In the left nav: **CMS → Your Collections** (Content Manager).
2. Click **+ Create Collection**.
3. Choose **Start from scratch**.
4. Settings:
   - **Collection Name:** `Swatch Requests`
   - **Collection ID:** `SwatchRequests` *(Wix will auto-derive but verify it
     is exactly this — the Velo code passes the literal string `'SwatchRequests'`)*
   - **What's it for?** *Multiple Items* (one row per submission)
5. Click **Create**.

---

## Step 3 — Add fields

Wix auto-creates `_id`, `_createdDate`, `_updatedDate`, `_owner`, `_publishStatus`.
Add the following fields **in order** (Add Field button at the top of the table view):

| # | Field Key | Display Name | Type | Notes |
|---|-----------|--------------|------|-------|
| 1 | `contactEmail` | Contact Email | **Text** | Validated + lowercased server-side; no Wix-level email validation needed. |
| 2 | `contactName` | Contact Name | **Text** | Concatenated `firstName + ' ' + lastName`. |
| 3 | `contactId` | Wix CRM Contact ID | **Text** | Foreign key into Wix CRM Contacts. May be an empty string when CRM upsert fails. |
| 4 | `swatchIds` | Swatch IDs | **Tags** | Array of FabricSwatches `_id` strings (1–5 entries enforced server-side). |
| 5 | `swatchNames` | Swatch Names | **Tags** | Denormalized human-readable names — admins can read SwatchRequests without joining FabricSwatches. |
| 6 | `shippingAddress` | Shipping Address | **Object** | JSON object: `{ address1, address2?, city, state, zip }`. Optional `address2` is omitted (not null) when blank. |
| 7 | `requestedAt` | Requested At | **Date and Time** | Server-generated `new Date()` at insert time (distinct from `_createdDate` so it survives re-imports). |
| 8 | `status` | Status | **Text** | Lifecycle: `pending` (default at insert) → `shipped` (set when admin marks fulfilled). |
| 9 | `productSlug` | Product Slug (optional) | **Text** | Set when the request originated from a PDP (e.g., `kingston-futon-frame`). Absent when submitted from the standalone `/swatch-request` page. |
| 10 | `shippedAt` | Shipped At | **Date and Time** | Set by `markSwatchRequestShipped` (lines 247–253 of `swatchRequest.web.js`). Leave nullable. |

> **Default value for `status`:** Wix Text fields don't expose a default-value
> UI — the Velo code always sets `status: 'pending'` at insert time, so no
> dashboard configuration is required. Document this so a future admin
> doesn't try to add a default and discover it can't be set.

> **Why `swatchIds` uses Tags, not Multi-Reference:** the Velo code stores
> raw string IDs and never queries via reference joins. Tags keeps the schema
> simple and avoids referential-integrity churn when a swatch is retired.

---

## Step 4 — Set permissions

In the collection settings (gear icon → **Permissions**):

| Action | Role | Why |
|--------|------|-----|
| **Read content** | Admin | PII (names, addresses, emails) — never expose to Site Members or Anyone. |
| **Add content** | Anyone | The `/swatch-request` form submits anonymously. Velo `submitSwatchRequest` is `Permissions.Anyone`; its `wixData.insert` therefore runs as the visitor and needs Add: Anyone on the collection. |
| **Update content** | Admin | Only admins flip `status: pending → shipped`. |
| **Delete content** | Admin | Manual cleanup only. |

Click **Save**.

---

## Step 5 — Note the Collection ID

After saving, the URL will look like:

```
https://manage.wix.com/.../database/collection/SwatchRequests/...
```

The collection ID Wix reports in the URL/settings is the canonical reference.
Capture it and paste below for future agents:

```
SwatchRequests collection ID: __________________________
```

(Add it to `crew/melania/EDITOR-HOOKUP-GUIDE.md` under "CMS collections" once
you have it.)

---

## Step 6 — Smoke-test the form

1. Visit <https://carolinafutons.com/swatch-request>.
2. Pick 2–3 swatches, fill the contact form with a personal/test email
   (the inserted row will be permanent), submit.
3. Back in the Dashboard: **CMS → Swatch Requests** — confirm a new row with
   all 10 fields populated.
4. Check the corresponding `EmailQueue` collection — the same submission
   should enqueue 4 nurture-sequence rows (`swatch_confirmation`,
   `swatch_followup_d3`, `swatch_followup_d7`, `swatch_final_nudge`).

If the form returns the generic
*"We couldn't submit that — please try again in a moment"* error and the row
never appears, check the Wix site logs (**Velo Dev Console → Logs**) — the
most likely cause is an Add: Anyone permission that didn't save.

---

## Acceptance

- [ ] Collection `SwatchRequests` exists with all 10 fields above.
- [ ] Permissions: Read=Admin, Add=Anyone, Update=Admin, Delete=Admin.
- [ ] One real form submission inserts a row visible in the dashboard.
- [ ] The same submission triggers 4 EmailQueue rows.
- [ ] Collection ID captured in `EDITOR-HOOKUP-GUIDE.md`.

---

## References

- Velo backend: `carolina-futons` repo → `src/backend/swatchRequest.web.js`
- Web app form: `carolina-futons-web` repo → `src/app/swatch-request/page.tsx`
  + `src/app/actions/swatch-request.ts`
- Schema: `src/lib/swatch-request/swatch-request-schema.ts`
- Tests: `tests/swatchRequest.test.js` (mocks `wixData.insert('SwatchRequests')`)
