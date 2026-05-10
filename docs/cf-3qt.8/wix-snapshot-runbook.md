# cf-3qt.8 — Wix CMS Snapshot Runbook

**Bead:** cf-3qt.8 (acceptance item 1 — "DB snapshot both sites")
**Owner:** millicent (CI/devops) + Stilgar (runs the script with live creds) + melania (gate-keeps)
**Last updated:** 2026-05-10

The cf-3qt migration keeps Wix as the data backend (Wix Studio retires as the rendering layer; the full Wix exit is the deferred `cf-xe2` epic). "Both sites" therefore reduces to one backend — Wix — captured as a point-in-time JSON export. This runbook describes when to run the snapshot, what's in / what's out, and how to use the output during and after the cutover.

---

## What gets captured

`scripts/cutover/snapshot-wix-data.mjs` walks a hard-coded list of load-bearing CMS collections (see `--manifest` for the live list) and writes one JSON file per collection plus a `MANIFEST.md` summary into the output directory:

```
snapshots/<YYYYMMDD-HHMMSS>/
├── MANIFEST.md                     # human-readable summary table
├── SiteContent.json                # Brenda's edits (Path B)
├── ContactSubmissions.json         # form funnel
├── AbandonedCarts.json             # recovery flow
├── EmailQueue.json                 # in-flight transactional emails
├── Fulfillments.json               # shipping ledger
├── GiftCards.json                  # monetary state
├── ReferralCodes.json              # monetary state
├── InventoryLevels.json            # commerce-critical
├── … (37 collections total)
```

Each JSON file has the shape:

```json
{
  "collectionId": "SiteContent",
  "capturedAtIso": "2026-05-10T03:00:00.000Z",
  "items": [ { "_id": "...", "key": "...", "value": "..." }, ... ]
}
```

`_id` is preserved, so a single-row restore is a `wixData.update(collectionId, row)` from a Velo backend webMethod.

---

## What is **not** captured

- **Wix Stores Orders** — captured separately by `capture-order-baseline.mjs` (cf-3qt.8 item 5). Don't double-pull; orders churn fast and the baseline file already encodes the load-bearing aggregate.
- **Wix Members PII** — opted out for consent + retention reasons. If a member-row export is needed for an incident postmortem, file a sibling bead and capture under a separate retention policy.
- **Wix Media Manager binaries** — only the URLs that show up inside CMS rows are captured. The actual asset bytes live in Wix's media CDN; restoring an image needs to come from there (Wix's own dashboard backup is the right tool for media assets).

---

## When to run

**Within the 24h pre-cutover window, after the order-baseline pull but before the DNS TTL drop.** Running before the TTL drop keeps the snapshot reflective of normal traffic patterns; running after the order-baseline pull means the same API key + scope + headers can be reused without re-authenticating.

If the cutover slips by more than 24 hours, **re-run** the script. A snapshot older than the cutover by > 48 hours has higher drift and reduces postmortem value.

---

## How to run

```sh
# Required: Wix REST API key + site ID. Stilgar has these in the
# password manager; the API key needs the same scope as
# capture-order-baseline.mjs plus `Wix Data Read` on every collection
# in the manifest. Easiest is a short-lived "snapshot" key with all-
# read scope, revoked after the cutover.
export WIX_API_KEY=…
export WIX_SITE_ID=…

# Optional: override the output dir or per-collection cap.
# export SNAPSHOT_OUT_DIR=/Users/hal/cutover-snapshot/2026-05-10/
# export SNAPSHOT_LIMIT_PER_COLLECTION=100000

node scripts/cutover/snapshot-wix-data.mjs
```

The script emits one progress line per collection and exits with:

| Exit | Meaning |
| ---: | --- |
| 0 | Snapshot complete; `MANIFEST.md` written |
| 1 | `WIX_API_KEY` or `WIX_SITE_ID` missing |
| 2 | Auth/scope failure (401/403) on a collection. Partial snapshot left in place under the output dir; re-issue the API key with broader scope and re-run with a fresh `SNAPSHOT_OUT_DIR` to avoid the "directory non-empty" guard |
| 3 | Output directory exists and is non-empty (refuse to overwrite) |

A 404 on a single collection (it doesn't exist on this site yet) is **not** an exit-3 condition — it's logged as a `(missing)` line in `MANIFEST.md` and the snapshot continues.

### Preview the manifest without running

```sh
node scripts/cutover/snapshot-wix-data.mjs --manifest
```

Prints the JSON array of collection IDs and exits 0.

---

## How to use during the cutover

1. **Confirm completeness.** Open `MANIFEST.md` immediately after capture. Every load-bearing collection (the funnel + ledger groups) should show `✓` with a non-zero count. The loyalty/engagement collections may legitimately show 0 rows on a low-traffic site — that's fine. Anything `✗` is a real problem; investigate before the cutover proceeds.
2. **Move off-laptop.** Copy the entire output directory to a dedicated cloud drive or attach to the team password manager. The cutover-night on-call should have it accessible without depending on the operator's laptop.
3. **Diff at t+24h.** Re-run the snapshot 24 hours post-cutover into a fresh directory. A pairwise diff (`diff -ru pre/ post/`) flags any unexpected collection-level write during the cutover window. Expected diffs: `ContactSubmissions`, `AbandonedCarts`, `EmailQueue`, `InventoryLog`, `ProductAnalytics` (these churn). Unexpected diffs: `SiteContent`, `Promotions`, `AssemblyGuides`, `Landings`, `ComparisonFeatures` (these are Brenda-edited and should be quiet during the cutover).
4. **Surgical restore path.** Each row in each JSON file has its `_id`. To restore a specific row:
   ```js
   // Velo backend webMethod (admin permission)
   import wixData from 'wix-data';
   const snapshotRow = /* from JSON */;
   await wixData.update('SiteContent', snapshotRow, { suppressAuth: true });
   ```
   Bulk restore from a JSON file is a `for` loop around the same call. There is no single-shot "restore the whole snapshot" command — and there shouldn't be, since the snapshot is a read-only forensic artifact, not a backup-and-restore product.

---

## Sanity checks before relying on the snapshot

The `MANIFEST.md` file is the audit surface. Before considering the snapshot good, scan for:

1. **All mandatory collections show `✓`.** The mandatory subset is enforced by `tests/snapshotWixData.cf3qt8.test.js`: `SiteContent`, `ContactSubmissions`, `AbandonedCarts`, `EmailQueue`, `Fulfillments`, `GiftCards`, `ReferralCodes`, `InventoryLevels`. Any of these showing `✗` is a stop-the-cutover signal.
2. **Total rows count is in the right order of magnitude.** Carolina Futons today has ~hundreds of rows in `ContactSubmissions`, low thousands in `AbandonedCarts` + `EmailQueue` + `InventoryLog`. Order of magnitude < 100 across the whole snapshot is suspicious — usually a wrong site ID.
3. **`SiteContent.json` row count matches the page count Brenda has edited.** If `SiteContent` is `✓` with 0 rows, the collection exists but is empty (cf-4mol initial state) — that's fine and expected pre-launch. If the page is supposed to render Brenda's edits but `SiteContent` is empty, something else is wrong.

---

## Future work

- Optional `--diff PATH_TO_PRIOR_SNAPSHOT` flag that reads a previous snapshot directory + the live API and emits the post-cutover comparison automatically. Out of scope for cf-3qt.8 — a useful follow-up after the first cutover surfaces what diff queries the on-call actually wants.
- Optional integration with the cf-3qt.8 24-hour monitor: snapshot at t+0, t+1h, t+6h, t+24h, surface the diff in the same dashboard the order-rate baseline feeds. Filed as a separate bead if the cutover proves the manual flow is too slow.

---

## Reference

- Parent: cf-3qt.8 (DNS cutover) acceptance item 1
- Sibling runbook: `docs/cf-3qt.8/order-baseline-runbook.md` (item 5)
- API: Wix Data v2 items/query <https://www.wixapis.com/wix-data/v2/items/query>
- Pattern reference: `scripts/cutover/capture-order-baseline.mjs` (same auth headers, same env-var contract, same JSON-and-Markdown output style)
