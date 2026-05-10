# cf-khqd cfw-half — Deferred Patch

**Bead:** cf-khqd (CI concurrency `cancel-in-progress`)
**State:** cfutons half **shipped** (PR #1265, merged). cfw half **held locally**, awaiting next cfw merge window per cf-ukc6.
**Author:** millicent (cfutons/crew)
**Date:** 2026-05-10

The cfw half of cf-khqd is the same 10-line concurrency block as PR #1265 added to cfutons, applied to `carolina-futons-web/.github/workflows/ci.yml`. Pushing the cfw half on its own would burn one Vercel preview build for a non-customer-facing infra change — directly counter to the cf-ukc6 standing order ("save credits for Stilgar visual sign-off + final deploys").

This doc preserves the patch text so it can be replayed cleanly when melania opens the next cfw merge window. The patch is verbatim from a local commit on `feat/cf-khqd-cfw-half-concurrency` in a transient cfw clone (`/tmp/cfw-envcheck`).

## How to apply

```sh
# In a fresh cfw clone:
cd /path/to/carolina-futons-web
git checkout main && git pull --rebase
git checkout -b feat/cf-khqd-cfw-half-concurrency

# Apply the patch from this doc (copy the diff block below into a .patch
# file, then `git apply` it; or hand-edit ci.yml — the change is small):
git apply /path/to/cf-khqd-cfw-half.patch
# OR hand-edit and add the concurrency block before the `jobs:` line.

# Verify:
python3 -c 'import yaml; yaml.safe_load(open(".github/workflows/ci.yml"))'

# Bundle with whatever other cfw work is being merged in the same window;
# do NOT push as a standalone PR.
```

## Patch text

```
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index fd548fe..157f2e7 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -17,6 +17,16 @@ on:
 permissions:
   contents: read
 
+# cf-khqd: cancel in-progress runs on the same branch when a new push lands.
+# Force-pushes / fixup commits on a feature branch otherwise leave the prior
+# CI run orphan + burn another Vercel preview build slot — directly contrary
+# to the cf-ukc6 build conservation directive. `github.ref` keys per branch
+# (PR or main), so concurrent PRs run fully in parallel — only same-branch
+# successive pushes cancel the old.
+concurrency:
+  group: ci-${{ github.ref }}
+  cancel-in-progress: true
+
 jobs:
   lint-typecheck-test:
     runs-on: ubuntu-latest
```

## Why this isn't shipped as its own PR right now

| Concern | Resolution |
| --- | --- |
| Vercel build burn per push | A standalone push for this 10-line infra change burns one credit for nothing customer-facing. Bundling with the next cfw merge window means the build that runs anyway also picks up this change. |
| Local commit staleness | The branch lives on a transient `/tmp/cfw-envcheck` clone. If the laptop reboots before the cfw merge window opens, the branch is lost — but **this doc is the recovery artifact**: re-apply the patch to a fresh cfw clone in 30 seconds. |
| Test plan | Same as cfutons #1265: `python3 -c 'import yaml; ...'` parse-clean. Concurrency group keys per branch ref, so PR fan-out is unaffected. |

## Verification post-merge (when it ships)

After the cfw merge window includes this change, confirm:

1. Open a draft PR with two pushes back-to-back. The second push should appear in `gh run list` as starting a new run; the prior run should show `cancelled` instead of completing both.
2. Two concurrent PRs (different branches) should both run their CI in full — the concurrency group keys per branch, not per-workflow.
3. Squash-merge to main: only one CI run on the merged sha; rapid-succession merges (rare) cancel the older.

## Reference

- Bead: cf-khqd (CI concurrency)
- cfutons half: PR #1265 (merged)
- Standing order: cf-ukc6 (Vercel build conservation)
