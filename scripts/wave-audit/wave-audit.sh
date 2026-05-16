#!/usr/bin/env bash
# cf-6amf (cf-roadmap.3): wave-audit ritual driver.
#
# Usage:
#   scripts/wave-audit/wave-audit.sh <since-date> [<until-date>]
#
# Examples:
#   scripts/wave-audit/wave-audit.sh 2026-05-15           # one day
#   scripts/wave-audit/wave-audit.sh 2026-05-10 2026-05-15  # range
#
# Output (markdown to stdout):
#   - Histogram of all merged PRs in the window
#   - Categorized PR list (numbered)
#   - Suggested deep-audit candidates (substantive bucket only)
#   - Reachability check note for any stacked PRs that didn't land in main
#
# Convention: see docs/audits/CONVENTIONS.md for the categorization rubric +
# rationale. cf-5dto v5 reachability rule (`git merge-base --is-ancestor`)
# applies — only PRs whose merge commit is reachable from origin/main are
# counted; stacked-PR squash-merge gaps surface in the "Excluded" section.
#
# Cross-repo (cf-6amf.fu1): when WAVE_AUDIT_REPO points to a different repo
# than the local clone hosting this script, set WAVE_AUDIT_REPO_ROOT to a
# local clone of that repo so the reachability `git merge-base` runs in the
# correct repo. Without this, a cross-repo run silently false-excludes 100%
# of PRs (the merge SHAs aren't present in the script-hosting repo's
# object DB).

set -euo pipefail

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "Usage: $0 <since-date> [<until-date>]" >&2
  echo "  Dates are YYYY-MM-DD; until-date defaults to since-date." >&2
  exit 1
fi

SINCE="$1"
UNTIL="${2:-$1}"
REPO="${WAVE_AUDIT_REPO:-DreadPirateRobertz/carolina-futons}"

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"

# Resolve the local clone we should run reachability checks against.
# Default: REPO_ROOT (the cfutons monorepo containing this script).
# Override: WAVE_AUDIT_REPO_ROOT (for cross-repo runs against cfw etc.).
# Detection: compare the local repo's gh `nameWithOwner` against $REPO.
# If they differ and no override was given, hard-fail rather than emit a
# false 0/100 reachable count.
LOCAL_NWO="$(cd "$REPO_ROOT" && gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "")"
if [[ -n "${WAVE_AUDIT_REPO_ROOT:-}" ]]; then
  REACHABILITY_ROOT="$WAVE_AUDIT_REPO_ROOT"
elif [[ -n "$LOCAL_NWO" && "$LOCAL_NWO" != "$REPO" ]]; then
  echo "ERROR: cross-repo run detected (WAVE_AUDIT_REPO=$REPO, local=$LOCAL_NWO)" >&2
  echo "       but WAVE_AUDIT_REPO_ROOT is unset. Without a local clone of" >&2
  echo "       $REPO, the reachability check would false-exclude every PR." >&2
  echo "       Fix: WAVE_AUDIT_REPO_ROOT=/path/to/local/clone $0 $*" >&2
  exit 2
else
  REACHABILITY_ROOT="$REPO_ROOT"
fi

# 1. Fetch the wave from gh.
WAVE_JSON="$(mktemp)"
trap 'rm -f "$WAVE_JSON"' EXIT

gh pr list \
  --repo "$REPO" \
  --base main \
  --state merged \
  --search "merged:${SINCE}..${UNTIL}" \
  --json number,title,additions,deletions,files,mergeCommit \
  --limit 100 \
  > "$WAVE_JSON"

PR_COUNT="$(jq 'length' "$WAVE_JSON")"

if [[ "$PR_COUNT" -eq 0 ]]; then
  echo "# Wave audit: ${SINCE} → ${UNTIL}"
  echo
  echo "No PRs merged in this window."
  exit 0
fi

# 2. Reachability filter — drop PRs whose merge commit isn't in origin/main.
# This catches stacked-PR squash gaps (the cf-5dto / a720c6d trap that
# motivated the convention).
REACHED_JSON="$(mktemp)"
EXCLUDED_JSON="$(mktemp)"
trap 'rm -f "$WAVE_JSON" "$REACHED_JSON" "$EXCLUDED_JSON"' EXIT

(
  cd "$REACHABILITY_ROOT"
  git fetch origin main --quiet 2>/dev/null || true
  jq -c '.[]' "$WAVE_JSON" | while read -r row; do
    SHA="$(echo "$row" | jq -r '.mergeCommit.oid // empty')"
    if [[ -z "$SHA" ]] || git merge-base --is-ancestor "$SHA" origin/main 2>/dev/null; then
      echo "$row"
    else
      echo "$row" >&2
    fi
  done > "$REACHED_JSON" 2>"$EXCLUDED_JSON"
)

# Wrap line-delimited JSON back into arrays for downstream tooling.
jq -s '.' "$REACHED_JSON" > "${REACHED_JSON}.arr"
jq -s '.' "$EXCLUDED_JSON" > "${EXCLUDED_JSON}.arr"
mv "${REACHED_JSON}.arr" "$REACHED_JSON"
mv "${EXCLUDED_JSON}.arr" "$EXCLUDED_JSON"

REACHED_COUNT="$(jq 'length' "$REACHED_JSON")"
EXCLUDED_COUNT="$(jq 'length' "$EXCLUDED_JSON")"

# 3. Run the python categorizer.
SUMMARY="$(python3 "$HERE/wave_audit.py" "$REACHED_JSON")"

# 4. Emit the report.
cat <<EOF
# Wave audit: ${SINCE} → ${UNTIL}

**Repo:** \`$REPO\`
**PRs merged in window:** $PR_COUNT
**Reachable from \`origin/main\`:** $REACHED_COUNT
**Excluded (stacked-PR not in main):** $EXCLUDED_COUNT

$SUMMARY
EOF

if [[ "$EXCLUDED_COUNT" -gt 0 ]]; then
  echo
  echo "## Excluded (stacked-PR squash gap)"
  echo
  echo "These PRs have \`state=MERGED\` but their merge commit is NOT reachable"
  echo "from \`origin/main\` — likely a stacked PR that merged into an"
  echo "intermediate branch which was later squash-merged from a pre-stack state."
  echo "(cf-5dto / a720c6d traceability convention.)"
  echo
  jq -r '.[] | "- #\(.number) — \(.title)"' "$EXCLUDED_JSON"
fi
