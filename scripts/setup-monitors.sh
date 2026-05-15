#!/usr/bin/env bash
# cf-3qt.8.3 — UptimeRobot monitor provisioning for carolinafutons.com
# Run after sourcing secrets.env:
#   source /Users/hal/gt/cfutons/refinery/rig/scripts/secrets.env
#   bash setup-monitors.sh
set -euo pipefail

API="https://api.uptimerobot.com/v2"
KEY="${UPTIMEROBOT_API_KEY:?UPTIMEROBOT_API_KEY is required — see monitoring-setup.md}"
ALERT="${UPTIMEROBOT_ALERT_CONTACT_ID:-}"  # optional; omit to use account default
INTERVAL=300  # 300s = 5min (free tier minimum); change to 60 for Pro

# Monitors to create: "Friendly Name|URL|MonitorType[|KeywordType|KeywordValue]"
# MonitorType: 1 = HTTP(S) up/down (alert on non-2xx + timeout)
#              2 = Keyword (alert on keyword presence/absence)
# KeywordType (only used when MonitorType=2):
#              1 = "exists" — alert when keyword NOT found in response body
#              2 = "not exists" — alert when keyword IS found
#
# /api/health (cf-x6ph + cf-x0ks + cf-ybsf): the endpoint returns the
# JSON envelope `{"status":"ok","uptime":N,"commit":"sha","ts":"..."}`.
# UptimeRobot keyword `"status":"ok"` (the quoted-colon-quoted substring)
# is a stable marker that only appears in a healthy response — the bare
# word `ok` false-positives on any HTML / 404 page that happens to
# contain it. Aligned per cf-ybsf.
declare -a MONITORS=(
  "CF Home|https://carolinafutons.com/|1"
  "CF Futon Frames PLP|https://carolinafutons.com/shop/futon-frames|1"
  "CF Products (Kingston)|https://carolinafutons.com/products/kingston-futon-frame|1"
  "CF Contact|https://carolinafutons.com/contact|1"
  'CF API Health|https://carolinafutons.com/api/health|2|1|"status":"ok"'
)

create_monitor() {
  local name="$1"
  local url="$2"
  local monitor_type="${3:-1}"
  local keyword_type="${4:-}"
  local keyword_value="${5:-}"

  local data="api_key=${KEY}&friendly_name=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${name}'))")&url=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${url}'))")&type=${monitor_type}&interval=${INTERVAL}&format=json"
  if [[ "${monitor_type}" == "2" ]]; then
    if [[ -z "$keyword_type" || -z "$keyword_value" ]]; then
      echo "  ✗ Failed:  ${name} — keyword monitor requires keyword_type + keyword_value"
      return 1
    fi
    data+="&keyword_type=${keyword_type}"
    data+="&keyword_value=$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1]))" "${keyword_value}")"
  fi
  if [[ -n "$ALERT" ]]; then
    data+="&alert_contacts=${ALERT}"
  fi

  local resp
  resp=$(curl -s -X POST "${API}/newMonitor" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "$data")

  local stat
  stat=$(echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('stat','?'))")

  if [[ "$stat" == "ok" ]]; then
    local id
    id=$(echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['monitor']['id'])")
    echo "  ✓ Created: ${name} (id=${id})"
  else
    local err
    err=$(echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error',{}).get('message','unknown'))" 2>/dev/null || echo "$resp")
    echo "  ✗ Failed:  ${name} — ${err}"
  fi
}

echo "UptimeRobot monitor setup — carolinafutons.com"
echo "Interval: ${INTERVAL}s | Alert contact: ${ALERT:-account default}"
echo ""

for entry in "${MONITORS[@]}"; do
  IFS='|' read -r name url monitor_type keyword_type keyword_value <<< "$entry"
  echo "Creating: ${name}"
  create_monitor "$name" "$url" "$monitor_type" "$keyword_type" "$keyword_value"
done

echo ""
echo "Done. Verify at https://uptimerobot.com/dashboard"
