# cf-6zjo cfw-half — Deferred Patch

**Bead:** cf-6zjo (Vercel preview-deploy exclusion for `chore/coverage-ratchet-bump`)
**Driver:** PR #1287 — cf-ukc6 24h follow-up audit
**State:** Patch held locally on transient cfw clone, awaiting next cfw merge window per cf-ukc6
**Author:** millicent (cfutons/crew)
**Date:** 2026-05-10

## Why this is held, not PR'd directly

A standalone push to cfw burns one Vercel preview build credit. **Ironically, the change being deferred IS the change that would prevent these single-purpose burns.** Bundling with the next cfw merge window means the build that runs anyway also picks up this change, and after that merge, no future ratchet-bump push burns a build either.

## What the patch does

Creates `cfw/vercel.json` with one rule:

```jsonc
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "git": {
    "deploymentEnabled": {
      "main": true,
      "chore/coverage-ratchet-bump": false
    }
  }
}
```

Effect:

| Branch | Before | After |
|---|---|---|
| `main` | production deploy | production deploy (unchanged) |
| `chore/coverage-ratchet-bump` | preview deploy on every force-amend | **no preview deploy** |
| any other branch | preview deploy (default) | preview deploy (unchanged) |

## Quantified impact

Per `docs/vercel-build-conservation-audit-2026-05-10.md` (PR #1287):

- github-actions[bot] burns 56 of 145 preview deploys per day on this single branch
- = **39% of current daily Vercel preview burn**
- = ~1700 fewer preview deploys/month after this lands
- combined with the existing cf-ukc6 human-side rule (already at 85% reduction), this closes the dominant remaining hole

## How to apply

```sh
# In a fresh cfw clone:
cd /path/to/carolina-futons-web
git checkout main && git pull --rebase
git checkout -b feat/cf-6zjo-vercel-exclude-ratchet-branch

# Apply via git apply, OR hand-write the file (it's 9 lines):
git apply /path/to/cf-6zjo-cfw.patch

# Verify JSON parses cleanly:
python3 -c 'import json; json.load(open("vercel.json"))'

# Bundle with whatever other cfw work is being merged in the same window;
# do NOT push as a standalone PR.
```

## Patch text

```
diff --git a/vercel.json b/vercel.json
new file mode 100644
index 0000000..b7e6a4f
--- /dev/null
+++ b/vercel.json
@@ -0,0 +1,9 @@
+{
+  "$schema": "https://openapi.vercel.sh/vercel.json",
+  "git": {
+    "deploymentEnabled": {
+      "main": true,
+      "chore/coverage-ratchet-bump": false
+    }
+  }
+}
```

## Verification post-merge

After the cfw merge window includes this change:

1. **Push a no-op commit to `chore/coverage-ratchet-bump`** (or wait for the next coverage-ratchet auto-PR fire). Confirm:
   - No new Vercel deployment appears for that branch in the dashboard
   - The PR view on github.com shows **no Vercel preview-link comment**
2. **Confirm main deploys still trigger**: the next merge to main produces a production deploy as usual.
3. **Confirm other PR previews still trigger**: a draft PR on a normal feature branch creates its preview link as before.

## Recovery contract

The local commit lives on `feat/cf-6zjo-vercel-exclude-ratchet-branch` in a transient `/tmp/cfw-envcheck` clone. If the laptop reboots, this doc is the 30-second-replay artifact: copy the patch text, hand-write the 9-line `vercel.json`, bundle with the cfw merge.

## Reference

- Driver: PR #1287 (cf-ukc6 follow-up audit)
- Standing order: cf-ukc6 (Vercel build credit conservation)
- Sibling deferred-patch precedent: cf-khqd cfw-half (cfutons PR #1273)
- Vercel docs: <https://vercel.com/docs/git/vercel-for-github#ignore-builds-for-a-branch>
