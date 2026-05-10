#!/usr/bin/env bash
# cf-jzux — Re-runnable cf-3qt.8 cutover-readiness gate checker.
#
# Companion to docs/cf-3qt.8/go-no-go-gate-status-2026-05-10.md, which is a
# point-in-time SNAPSHOT. This script re-derives the gate-status table any
# time, so Stilgar can re-check throughout the morning of cutover as PRs
# land and dependencies progress.
#
# Per-gate states:
#   ✅ CLEAR        — gate satisfied, no action needed
#   ⚠️ PENDING      — PR open or awaiting review/merge
#   ❌ NOT STARTED  — hard cutover blocker
#   ❔ UNKNOWN      — out-of-lane to verify (e.g. needs creds we don't have)
#
# Overall verdict on stdout, full table on stderr. Exit code:
#   0 = GO (every gate ✅ or known-soft-pending)
#   1 = NO-GO (any hard blocker NOT STARTED)
#   2 = HOLD (no blockers but some PENDING reviews; can call GO once those land)
#
# Usage: bash scripts/cutover/check-cutover-readiness.sh
#
# Dependencies: dig, gh, ls, jq optional. No creds required for the gates this
# script can verify. Out-of-lane gates (Sentry connection, baseline capture
# execution) are reported UNKNOWN and surface in the final notes.

set -u
HARD_BLOCKERS=0
SOFT_PENDING=0

CFW_REPO="DreadPirateRobertz/carolina-futons-web"
CFUTONS_REPO="DreadPirateRobertz/carolina-futons"
DOMAIN_APEX="carolinafutons.com"
DOMAIN_WWW="www.carolinafutons.com"

# Print a row. $1=gate name, $2=status emoji, $3=detail
row() {
  printf "%-40s %s  %s\n" "$1" "$2" "$3" >&2
}

clear_gate()    { row "$1" "✅ CLEAR        " "$2"; }
pending_gate()  { row "$1" "⚠️ PENDING      " "$2"; SOFT_PENDING=$((SOFT_PENDING+1)); }
blocker_gate()  { row "$1" "❌ NOT STARTED  " "$2"; HARD_BLOCKERS=$((HARD_BLOCKERS+1)); }
unknown_gate()  { row "$1" "❔ UNKNOWN      " "$2"; }

echo "=== cf-3qt.8 cutover-readiness check $(date -u +%Y-%m-%dT%H:%M:%SZ) ===" >&2
echo "" >&2
printf "%-40s %s  %s\n" "Gate" "Status         " "Detail" >&2
printf "%-40s %s  %s\n" "----" "-------         " "------" >&2

# ── 1. DNS TTL on production records ─────────────────────────────────────
# Query the authoritative nameserver directly to bypass resolver cache decay
# (a 3600s record will return cache-aged values like 2700s from public
# resolvers, which would falsely look "almost dropped").
auth_ns=$(dig +short NS "$DOMAIN_APEX" 2>/dev/null | head -1)
if [ -n "$auth_ns" ]; then
  ttl_apex=$(dig "@$auth_ns" +noall +answer "$DOMAIN_APEX" 2>/dev/null | awk '{print $2}' | head -1)
  ttl_www=$(dig "@$auth_ns" +noall +answer "$DOMAIN_WWW" 2>/dev/null | awk '{print $2}' | head -1)
  if [ -n "$ttl_apex" ] && [ "$ttl_apex" -le 60 ] 2>/dev/null && \
     [ -n "$ttl_www" ] && [ "$ttl_www" -le 60 ] 2>/dev/null; then
    clear_gate "DNS TTL ≤ 60 s (authoritative)" "apex=${ttl_apex}s www=${ttl_www}s via $auth_ns"
  else
    blocker_gate "DNS TTL ≤ 60 s (authoritative)" "apex=${ttl_apex:-?}s www=${ttl_www:-?}s via $auth_ns — needs 48 h lead time after drop"
  fi
else
  unknown_gate "DNS TTL ≤ 60 s (authoritative)" "could not resolve NS for $DOMAIN_APEX"
fi

# ── 2. Order baseline file present ────────────────────────────────────────
if compgen -G "docs/cf-3qt.8/order-baseline-*.json" > /dev/null; then
  baseline_file=$(ls -1 docs/cf-3qt.8/order-baseline-*.json | tail -1)
  clear_gate "Order baseline captured" "$(basename "$baseline_file")"
else
  blocker_gate "Order baseline captured" "no order-baseline-*.json — run scripts/cutover/capture-order-baseline.mjs"
fi

# ── 3. cfw PR #554 (/api/health) merged ──────────────────────────────────
state=$(gh pr view 554 -R "$CFW_REPO" --json state -q '.state' 2>/dev/null)
case "$state" in
  MERGED) clear_gate "/api/health route deployed" "cfw PR #554 merged" ;;
  OPEN)   pending_gate "/api/health route deployed" "cfw PR #554 open — awaiting Stilgar review" ;;
  CLOSED) blocker_gate "/api/health route deployed" "cfw PR #554 closed without merge" ;;
  *)      unknown_gate "/api/health route deployed" "cfw PR #554 state=${state:-?}" ;;
esac

# ── 4. cfw PR #565 (ratchet branch excluded) merged ──────────────────────
state=$(gh pr view 565 -R "$CFW_REPO" --json state -q '.state' 2>/dev/null)
case "$state" in
  MERGED) clear_gate "ratchet branch excluded" "cfw PR #565 merged" ;;
  OPEN)   pending_gate "ratchet branch excluded" "cfw PR #565 open — soft, not a cutover blocker" ;;
  *)      unknown_gate "ratchet branch excluded" "cfw PR #565 state=${state:-?}" ;;
esac

# ── 5. cfw PR #540 (logo) merged ─────────────────────────────────────────
state=$(gh pr view 540 -R "$CFW_REPO" --json state -q '.state' 2>/dev/null)
case "$state" in
  MERGED) clear_gate "Logo restored (cfw PR #540)" "merged" ;;
  OPEN)   pending_gate "Logo restored (cfw PR #540)" "open — awaiting Stilgar visual confirm" ;;
  *)      unknown_gate "Logo restored (cfw PR #540)" "state=${state:-?}" ;;
esac

# ── 6. Vercel Pro plan still active ──────────────────────────────────────
auth_file="$HOME/Library/Application Support/com.vercel.cli/auth.json"
if [ -f "$auth_file" ]; then
  token=$(python3 -c "import json; print(json.load(open('$auth_file')).get('token',''))" 2>/dev/null)
  if [ -n "$token" ]; then
    plan=$(curl -sS "https://api.vercel.com/v2/teams/team_WYNf264wCFjPfeUdTpci07wO" \
             -H "Authorization: Bearer $token" \
             | python3 -c 'import json, sys; d = json.load(sys.stdin).get("billing",{}); print(d.get("plan","?")+":"+d.get("planIteration","?")+":"+d.get("status","?"))' 2>/dev/null)
    if echo "$plan" | grep -q "^pro:.*:active$"; then
      clear_gate "Vercel Pro plan active" "$plan"
    else
      blocker_gate "Vercel Pro plan active" "plan=$plan — was pro:plus:active in cf-3qt.8.32"
    fi
  else
    unknown_gate "Vercel Pro plan active" "no Vercel token in $auth_file — re-run from a logged-in shell"
  fi
else
  unknown_gate "Vercel Pro plan active" "Vercel CLI not authenticated"
fi

# ── 7. cf-3qt.8.31 UptimeRobot status ────────────────────────────────────
status=$(bd show cf-3qt.8.31 2>/dev/null | grep -oE 'IN_PROGRESS|CLOSED|OPEN|HOOKED' | head -1)
case "$status" in
  CLOSED)              clear_gate "UptimeRobot monitors configured" "cf-3qt.8.31 closed" ;;
  IN_PROGRESS|HOOKED)  pending_gate "UptimeRobot monitors configured" "cf-3qt.8.31 $status — godfrey awaits API key from Stilgar" ;;
  *)                   unknown_gate "UptimeRobot monitors configured" "cf-3qt.8.31 status=${status:-?}" ;;
esac

# ── 8. Out-of-lane: Sentry production link ───────────────────────────────
unknown_gate "Sentry connected to prod" "out-of-lane — Stilgar confirms in his dashboard"

# ── verdict ──────────────────────────────────────────────────────────────
echo "" >&2
echo "── verdict ──────────────────────────────────────────────────────────────" >&2
if [ "$HARD_BLOCKERS" -gt 0 ]; then
  echo "🔴 NO-GO — $HARD_BLOCKERS hard blocker(s) NOT STARTED" >&2
  echo "NO-GO ($HARD_BLOCKERS blocker, $SOFT_PENDING pending)"
  exit 1
elif [ "$SOFT_PENDING" -gt 0 ]; then
  echo "🟡 HOLD — 0 hard blockers but $SOFT_PENDING PR(s) PENDING review/merge" >&2
  echo "HOLD (0 blockers, $SOFT_PENDING pending)"
  exit 2
else
  echo "🟢 GO — every checked gate is CLEAR" >&2
  echo "GO"
  exit 0
fi
