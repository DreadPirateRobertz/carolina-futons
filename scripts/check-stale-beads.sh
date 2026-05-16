#!/usr/bin/env bash
# check-stale-beads.sh — cf-4hys / cf-sufo
#
# Scans IN_PROGRESS + BLOCKED beads against recent merged PRs to surface beads
# that were shipped but never closed. Prints a STALE/CLEAN verdict per bead.
#
# Usage:
#   ./scripts/check-stale-beads.sh [--limit N] [--repo OWNER/REPO]
#
# Options:
#   --limit N         How many recent merged PRs to scan per repo (default: 50)
#   --repo OWNER/REPO Additional GitHub repo to scan (repeatable; cfutons main
#                     repo and carolina-futons-web are always included)
#
# Exit codes:
#   0  All in-progress/blocked beads are clean
#   1  One or more beads appear stale (merged PR title match found)
#   2  Dependency missing (bd, gh, python3)

set -euo pipefail

LIMIT=50
EXTRA_REPOS=()
MAIN_REPO="DreadPirateRobertz/carolina-futons"
CFW_REPO="DreadPirateRobertz/carolina-futons-web"

while [[ $# -gt 0 ]]; do
  case $1 in
    --limit) LIMIT="$2"; shift 2 ;;
    --repo)  EXTRA_REPOS+=("$2"); shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

for cmd in bd gh python3; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "ERROR: '$cmd' not found in PATH" >&2
    exit 2
  fi
done

# Fetch merged PR titles from one repo, return "number TAB title" lines
fetch_merged() {
  local repo="$1"
  gh pr list \
    --repo "$repo" \
    --state merged \
    --limit "$LIMIT" \
    --json number,title \
    2>/dev/null \
    | python3 -c "
import sys, json
for p in json.load(sys.stdin):
    print(f\"{p['number']}\t{p['title']}\")
" || true
}

ALL_REPOS=("$MAIN_REPO" "$CFW_REPO" "${EXTRA_REPOS[@]}")
MERGED_PRS=""
for repo in "${ALL_REPOS[@]}"; do
  MERGED_PRS+=$(fetch_merged "$repo")$'\n'
done

if [[ -z "${MERGED_PRS// }" ]]; then
  echo "WARNING: No merged PRs returned — check gh auth" >&2
fi

# Pull in-progress (◐) AND blocked (● cf-) beads from bd list --all.
# ◐ only appears as the in_progress status indicator.
# ● appears as both the blocked status indicator (before a cf- bead ID) AND as
# the priority separator (before Pn). Match "● cf-" to target only status-blocked.
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel 2>/dev/null || pwd)
CANDIDATES=$(cd "$REPO_ROOT" && bd list --all 2>/dev/null | grep -E '◐|● cf-' || true)

if [[ -z "$CANDIDATES" ]]; then
  echo "No in-progress or blocked beads found."
  exit 0
fi

STALE_COUNT=0
TOTAL=0

echo "=== Stale-bead audit (last $LIMIT merged PRs, in_progress + blocked) ==="
echo ""

while IFS= read -r line; do
  # bd list format: "[tree-chars] ◐/● cf-xxx.yyy ● Pn Title text"
  # Extract bead ID: first cf-<alnum+dots> token
  BEAD_ID=$(echo "$line" | grep -oE 'cf-[a-z0-9]+(\.[a-z0-9]+)*' | head -1 || true)
  [[ -z "$BEAD_ID" ]] && continue

  # Extract title: everything after the "Pn " priority marker
  BEAD_TITLE=$(echo "$line" | sed 's/.*● P[0-9][0-9]* //' | xargs || true)

  TOTAL=$((TOTAL + 1))
  MATCH=""

  # Search all fetched PR titles for the bead ID (case-insensitive)
  while IFS=$'\t' read -r pr_num pr_title; do
    [[ -z "$pr_num" ]] && continue
    if echo "$pr_title" | grep -qi "$BEAD_ID"; then
      MATCH="PR #$pr_num: $pr_title"
      break
    fi
  done <<< "$MERGED_PRS"

  if [[ -n "$MATCH" ]]; then
    printf "  STALE  %-20s %s\n" "$BEAD_ID" "$BEAD_TITLE"
    printf "         └─ %s\n" "$MATCH"
    STALE_COUNT=$((STALE_COUNT + 1))
  else
    printf "  clean  %-20s %s\n" "$BEAD_ID" "$BEAD_TITLE"
  fi
done <<< "$CANDIDATES"

echo ""
echo "=== Summary: $STALE_COUNT stale / $TOTAL candidates (in_progress + blocked) ==="

if [[ $STALE_COUNT -gt 0 ]]; then
  echo ""
  echo "Run 'cd \$(git rev-parse --show-toplevel) && bd close <bead-id>' for each STALE bead."
  exit 1
fi

exit 0
