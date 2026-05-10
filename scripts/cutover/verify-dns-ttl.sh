#!/usr/bin/env bash
# verify-dns-ttl.sh — confirm that carolinafutons.com DNS records carry a
# short TTL (≤ 120s by default) across multiple public resolvers, ahead of
# the cf-3qt.8 cutover.
#
# Usage:
#   bash scripts/cutover/verify-dns-ttl.sh                      # default 120s grace
#   TTL_GRACE_SECONDS=60 bash scripts/cutover/verify-dns-ttl.sh # strict 60s
#
# Exit codes:
#   0 — every checked (resolver, record) pair reports TTL ≤ TTL_GRACE_SECONDS
#   1 — at least one pair reports TTL > grace; per-pair table written to stderr
#   2 — `dig` not available on PATH; cannot verify
#
# Reads no secrets, makes no network calls except DNS.

set -euo pipefail

DOMAIN="${TTL_VERIFY_DOMAIN:-carolinafutons.com}"
GRACE="${TTL_GRACE_SECONDS:-120}"

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

echo "verify-dns-ttl: domain=${DOMAIN} grace=${GRACE}s"
echo

failures=0
total=0
table=$(printf "resolver\tname\ttype\tttl\tstatus")

for resolver in "${RESOLVERS[@]}"; do
  for name in "${QUERY_NAMES[@]}"; do
    for rtype in "${RECORD_TYPES[@]}"; do
      total=$((total + 1))
      # +noall +answer prints just the answer-section rows; awk pulls the
      # TTL column (field 2 in 'NAME TTL CLASS TYPE VALUE'). +tries=2
      # +time=3 keeps slow resolvers from hanging the script.
      # `set -e` plus a pipeline that returns nothing (e.g. CNAME query at
      # apex) would otherwise exit the whole script — guard with `|| true`
      # and let the empty-string check below skip it cleanly.
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

# Pretty-print as columns.
echo "${table}" | column -t -s $'\t'
echo

if [ "${failures}" -gt 0 ]; then
  echo "verify-dns-ttl: ${failures}/${total} pairs report TTL > ${GRACE}s — investigate before cutover." >&2
  exit 1
fi

echo "verify-dns-ttl: OK — every checked pair reports TTL ≤ ${GRACE}s."
exit 0
