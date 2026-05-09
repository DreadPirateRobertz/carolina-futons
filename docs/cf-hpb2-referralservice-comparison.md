# cf-hpb2 — referralService cfw ↔ backend reconciliation

**Bead:** cf-hpb2 (last cf-vtx5.fu held-list item)
**Author:** godfrey, 2026-05-09
**Status:** awaiting Stilgar decision on rename direction

## TL;DR

Of cfw's 4 referralService calls, **only 2 are pure rename mismatches**. The other 2 (`getReferralByCode`, `claimReferral`) have **semantic gaps** beyond names — return shapes and required args diverge. A pure name-shim is insufficient for those two.

| # | cfw call (`r("…")`) | Best backend match | Mismatch class |
|---|---|---|---|
| 1 | `getMyReferralCode` | `getReferralLink` | name only |
| 2 | `getMyReferralStats` | `getReferralStats` | name only |
| 3 | `getReferralByCode` | `getReferralLinkOwnerName` | name + return shape |
| 4 | `claimReferral` | `redeemReferralCode` | name + args + behavior |

## Detailed mapping

### (1) `getMyReferralCode` ↔ `getReferralLink` — pure rename

**cfw `actions/referral.ts`:**
```ts
const res = await callVelo<{ success: boolean; code?: string; error?: string }>({
  method: r("getMyReferralCode"),
  args: [],
  accessToken: session.accessToken,
});
if (!res.success || !res.code) return { success: false, error: res.error ?? "Could not load referral code." };
```

**Backend `referralService.web.js:getReferralLink`:**
- `Permissions.SiteMember`
- Args: `()`
- Returns: `{success: true, code, link, ...}` on success; `{success: false, error}` on auth fail

**Verdict:** Direct shim works — cfw expects `{success, code}`; backend returns `{success, code, link}` (extra `link` field is ignored by cfw, harmless). Just need to map the dispatcher key `getMyReferralCode` → call `getReferralLink`.

### (2) `getMyReferralStats` ↔ `getReferralStats` — pure rename

**cfw:**
```ts
method: r("getMyReferralStats"), args: []
// expects { success, stats?: ReferralStats, error? }
```

**Backend `referralService.web.js:getReferralStats`:**
- `Permissions.SiteMember`
- Args: `()`
- Returns: `{success, stats: {pending, signedUp, completed, …}, error?}`

**Verdict:** Direct shim works. Names diverge purely by the `My` prefix on the cfw side.

### (3) `getReferralByCode` ↔ `getReferralLinkOwnerName` — name AND shape

**cfw:**
```ts
method: r("getReferralByCode"), args: [code]
// expects { success: boolean; referral?: PublicReferral; error?: string }
// where PublicReferral is the public face of a referral row
```

**Backend `referralService.web.js:getReferralLinkOwnerName`:**
- `Permissions.Anyone`
- Args: `(code)`
- Returns: `{success: true, referrerName: '…'}` | `{success: false}` (no error string on the false path)

**Mismatch:**
- cfw expects `referral: PublicReferral` (a structured object)
- backend returns just `referrerName: string`

**Three options:**
- **(a) cfw shrinks expectation** — change `PublicReferral` type to `{referrerName: string}`, treat backend's response as canonical.
- **(b) backend expands** — rename `getReferralLinkOwnerName` to `getReferralByCode`, return a richer `{success, referral: {code, referrerName, …}}` object.
- **(c) dispatcher shim** — call backend, wrap response as `{success, referral: {referrerName: result.referrerName}}`. cfw's `PublicReferral` type still needs to shrink.

**Verdict:** Whatever path, cfw's `PublicReferral` type is currently aspirational (no real fields beyond `referrerName` are populated). Defining what `PublicReferral` should contain is a product decision — at minimum `{referrerName, code}`; possibly also `{discountPercent, expiresAt}`. **Stilgar input needed.**

### (4) `claimReferral` ↔ `redeemReferralCode` — name AND args AND behavior

**cfw:**
```ts
return withMember((m) =>
  callVelo<{ success: boolean; error?: string }>({
    method: r("claimReferral"),
    args: [code],
    accessToken: m.accessToken,
  }),
);
// fire-and-forget: just code, no email/name forwarded
```

**Backend `referralService.web.js:redeemReferralCode`:**
- `Permissions.SiteMember`
- Args: `(code, refereeData = {})` where `refereeData` is `{name, email}`
- Internally **REQUIRES** `refereeData.email` (validateEmail check), errors otherwise
- Side effect: writes a `referee` field on the Referral row; sends a confirmation email

**Mismatch:**
- cfw passes only `code`; backend requires `{email}` for the validateEmail guard
- cfw can't pass email because the auth flow is "logged-in member claiming a referral they followed" — email is implicit from `currentMember.getMember()`, not a form field

**Three options:**
- **(a) cfw expands** — cfw fetches member email from session and passes it in `refereeData`. Easy ~5-line change in cfw, requires cfw redeploy.
- **(b) backend shrinks** — `redeemReferralCode` reads email from `currentMember.getMember()` instead of requiring it in `refereeData`. The webMethod is already `Permissions.SiteMember`, so the member context is available. Keeps cfw's call site clean.
- **(c) dispatcher shim** — wrapper resolves `currentMember` then synthesizes `refereeData = {name: member.contactDetails.firstName + ' ' + ..., email: member.loginEmail}` before forwarding. cfw call site unchanged.

**Verdict:** Option (b) is structurally cleanest — the member context is the source of truth, the explicit `refereeData` arg is redundant and currently obstructs the cfw call site. Option (c) duplicates the resolution at the wrapper layer (defense in depth — same pattern cf-yvs4 added to post_submitSurvey).

## Recommendation

Pure (a) "rename cfw" is **insufficient** because (3) and (4) have shape/arg gaps that need real code, not just a name map.

Pure (b) "rename backend" is **risky** because backend is canonical and other callers (other cfutons modules, jobs.config) may rely on the current names.

**Recommended: combination**

| # | Path |
|---|---|
| 1 (`getMyReferralCode`) | (c) dispatcher allowlist alias `'getMyReferralCode' → getReferralLink` |
| 2 (`getMyReferralStats`) | (c) dispatcher allowlist alias `'getMyReferralStats' → getReferralStats` |
| 3 (`getReferralByCode`) | (c) dispatcher shim — call `getReferralLinkOwnerName`, wrap result as `{success, referral: {referrerName}}`. Stilgar can later expand `PublicReferral` if richer data is wanted. |
| 4 (`claimReferral`) | **(b) recommended** — modify `redeemReferralCode` webMethod to read email from `currentMember.getMember()` instead of requiring it via `refereeData`. cfw call site unchanged. Defense-in-depth IDOR check stays. |

This keeps cfw's call sites unchanged (no cfw redeploy needed for #1, #2, #3), with a single backend webMethod change for #4. Dispatcher carries the name aliasing.

If Stilgar prefers cfw-side rename (option a) for any of #1–#3, that's a single-PR cfw change with a small test fixture refresh — also acceptable.

## Implementation sketch (if Stilgar approves recommendation)

```js
// http-functions.js
import * as _referralServiceModule from 'backend/referralService.web';

const _REFERRAL_METHODS = {
  // (1) + (2): pure name aliases
  getMyReferralCode: _referralServiceModule.getReferralLink,
  getMyReferralStats: _referralServiceModule.getReferralStats,
  // (3): shape shim — wrap referrerName as { referral: { referrerName } }
  getReferralByCode: async (code) => {
    const r = await _referralServiceModule.getReferralLinkOwnerName(code);
    if (!r || r.success === false) return r;
    return { success: true, referral: { referrerName: r.referrerName } };
  },
  // (4): direct alias once redeemReferralCode is updated to read email from
  // currentMember (separate small backend PR, see Option (b) above).
  claimReferral: _referralServiceModule.redeemReferralCode,
};

export async function post_referralService(request) {
  return _veloDispatch(request, _REFERRAL_METHODS, 'referralService');
}
export function options_referralService(request) {
  return response(corsPreflight(request));
}
```

Plus: `redeemReferralCode` change in `referralService.web.js` to drop the
required-`refereeData.email` check and resolve via `currentMember.getMember()`.

## Open questions for Stilgar

1. Do you want `PublicReferral` (cfw type) to grow beyond `{referrerName}`?
2. For `claimReferral`: is the email required to be the *member's* loginEmail (resolved server-side), or genuinely user-supplied (separate field on the cfw page)?
3. Is there any other consumer of `redeemReferralCode` that depends on the current `(code, {email})` arg shape? Spot-check needed before option (b).

## Linked beads

- cf-vtx5 (closed) — original 22-route discovery; held referralService for this rename decision
- cf-jqkg (closed) — the audit doc that surfaced the gap
- cf-bkxh (closed) — the previous held-list item; clean rename-free dispatcher add (sibling case)
