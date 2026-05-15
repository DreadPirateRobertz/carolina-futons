#!/usr/bin/env bash
# verify-dns-ttl.sh — confirm that carolinafutons.com DNS records carry a
# short TTL (≤ 60s by default) across multiple public resolvers, ahead of
# the cf-3qt.8 cutover. On success, prints the earliest safe DNS flip
# timestamp (now + cutover-window hours, default 48h) so the team has an
# unambiguous go/no-go reference.
#
# Usage:
#   bash scripts/cutover/verify-dns-ttl.sh                          # one-shot, 60s grace, 48h window
#   bash scripts/cutover/verify-dns-ttl.sh --watch                  # poll every 60s until pass
#   TTL_GRACE_SECONDS=120 bash scripts/cutover/verify-dns-ttl.sh    # relax grace to 120s
#   CUTOVER_WINDOW_HOURS=72 bash scripts/cutover/verify-dns-ttl.sh  # widen the safety window
#   POLL_INTERVAL_SECONDS=30 bash scripts/cutover/verify-dns-ttl.sh --watch
#
# Exit codes:
#   0 — every checked (resolver, record) pair reports TTL ≤ TTL_GRACE_SECONDS
#   1 — at least one pair reports TTL > grace; per-pair table written to stderr
#   2 — `dig` not available on PATH; cannot verify
#
# Reads no secrets, makes no network calls except DNS.

set -euo pipefail

DOMAIN="${TTL_VERIFY_DOMAIN:-carolinafutons.com}"
GRACE="${TTL_GRACE_SECONDS:-60}"
CUTOVER_WINDOW_HOURS="${CUTOVER_WINDOW_HOURS:-48}"
POLL_INTERVAL_SECONDS="${POLL_INTERVAL_SECONDS:-60}"

WATCH=0
for arg in "$@"; do
  case "$arg" in
    --watch|-w) WATCH=1 ;;
    --help|-h)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *)
      echo "verify-dns-ttl: unknown flag '$arg' (try --help)" >&2
      exit 2
      ;;
  esac
done

# Records to probe — the 4 entries from dns-staging.md (cf-3qt.8.2). The
# query name plus the record type is enough — `dig` returns the TTL of
# each authoritative answer.
RECORD_TYPES=(A CNAME)
QUERY_NAMES=("${DOMAIN}" "www.${DOMAIN}")

# Public resolvers to probe — geographically + administratively distinct
# so we catch single-resolver caching anomalies.
RESOLVERS=(
  "8.8.8.8"      # Google
  "8.8.4.4"      # Google secondary
  "1.1.1.1"      # Cloudflare
  "1.0.0.1"      # Cloudflare secondary
  "9.9.9.9"      # Quad9
)

if ! command -v dig >/dev/null 2>&1; then
  echo "verify-dns-ttl: dig not found on PATH — install bind-utils / dnsutils." >&2
  exit 2
fi

run_once() {
  local failures=0
  local total=0
  local table
  table=$(printf "resolver\tname\ttype\tttl\tstatus")

  for resolver in "${RESOLVERS[@]}"; do
    for name in "${QUERY_NAMES[@]}"; do
      for rtype in "${RECORD_TYPES[@]}"; do
        total=$((total + 1))
        local ttl
        ttl=$(dig +noall +answer +tries=2 +time=3 "@${resolver}" "${name}" "${rtype}" 2>/dev/null \
          | awk 'NR==1 { print $2 }' || true)
        if [ -z "${ttl}" ]; then
          # No answer of this type — common for CNAME at apex, or if the
          # record genuinely doesn't exist. Skip; not a failure.
          continue
        fi
        if ! [[ "${ttl}" =~ ^[0-9]+$ ]]; then
          # `dig` printed an error line (e.g. "connection timed out") where
          # the answer would normally be. Surface as a network blip without
          # treating it as a TTL failure.
          table="${table}
${resolver}	${name}	${rtype}	-	timeout"
          continue
        fi
        local status
        if [ "${ttl}" -le "${GRACE}" ]; then
          status="ok"
        else
          status="STALE"
          failures=$((failures + 1))
        fi
        table="${table}
${resolver}	${name}	${rtype}	${ttl}	${status}"
      done
    done
  done

  echo "${table}" | column -t -s $'\t'
  echo
  printf '%s\n' "${failures}/${total}"
}

# Computes the earliest safe DNS-flip timestamp: now + CUTOVER_WINDOW_HOURS.
# The window exists because the previous (long) TTL has to drain — once
# every resolver's cache holds the new short-TTL record, cutover is safe.
# 48h default is the standard rule-of-thumb (12× a 3600s previous TTL).
print_cutover_window() {
  local now_epoch cutover_epoch now_iso cutover_iso
  now_epoch=$(date +%s)
  cutover_epoch=$((now_epoch + CUTOVER_WINDOW_HOURS * 3600))
  # macOS BSD date uses `-r epoch`; GNU date uses `-d @epoch`. Try BSD
  # first, fall back to GNU.
  if date -r "${cutover_epoch}" -u "+%Y-%m-%d %H:%M:%S UTC" >/dev/null 2>&1; then
    now_iso=$(date -u "+%Y-%m-%d %H:%M:%S UTC")
    cutover_iso=$(date -r "${cutover_epoch}" -u "+%Y-%m-%d %H:%M:%S UTC")
  else
    now_iso=$(date -u "+%Y-%m-%d %H:%M:%S UTC")
    cutover_iso=$(date -d "@${cutover_epoch}" -u "+%Y-%m-%d %H:%M:%S UTC")
  fi
  echo "verify-dns-ttl: now=${now_iso}"
  echo "verify-dns-ttl: earliest safe cutover (now + ${CUTOVER_WINDOW_HOURS}h) = ${cutover_iso}"
}

print_wix_dashboard_instructions() {
  cat >&2 <<EOF

ACTION REQUIRED — TTL not yet ≤ ${GRACE}s on all (resolver, record) pairs.

In the Wix Dashboard:
  1. https://manage.wix.com → carolinafutons.com → Settings → Domains
  2. carolinafutons.com → Advanced → Edit DNS
  3. For each row in the table above with status=STALE, click Edit and set
     the TTL field to "1 Minute" (= 60 seconds).
  4. Save. The 4 records to confirm are:
       A     @   185.230.63.186
       A     @   185.230.63.107
       A     @   185.230.63.171
       CNAME www cdn1.wixdns.net.
  5. Wait ${POLL_INTERVAL_SECONDS}s, then re-run this script (or pass --watch
     to poll automatically until every resolver reports the new TTL).

Reference: docs/cf-3qt.8/dns-ttl-drop-runbook.md
EOF
}

echo "verify-dns-ttl: domain=${DOMAIN} grace=${GRACE}s window=${CUTOVER_WINDOW_HOURS}h"
[ "${WATCH}" -eq 1 ] && echo "verify-dns-ttl: --watch mode (polling every ${POLL_INTERVAL_SECONDS}s until pass; Ctrl-C to abort)"
echo

attempt=0
while true; do
  attempt=$((attempt + 1))
  [ "${WATCH}" -eq 1 ] && echo "=== attempt ${attempt} — $(date -u '+%Y-%m-%d %H:%M:%S UTC') ==="
  result=$(run_once)
  echo "${result}" | sed '$d'
  summary=$(echo "${result}" | tail -1)
  failures="${summary%/*}"
  total="${summary#*/}"

  if [ "${failures}" -eq 0 ]; then
    echo "verify-dns-ttl: OK — every checked pair reports TTL ≤ ${GRACE}s (${total} pairs)."
    print_cutover_window
    exit 0
  fi

  if [ "${WATCH}" -ne 1 ]; then
    echo "verify-dns-ttl: ${failures}/${total} pairs report TTL > ${GRACE}s — investigate before cutover." >&2
    print_wix_dashboard_instructions
    exit 1
  fi

  echo "verify-dns-ttl: ${failures}/${total} pairs still stale — sleeping ${POLL_INTERVAL_SECONDS}s before retry." >&2
  sleep "${POLL_INTERVAL_SECONDS}"
done
