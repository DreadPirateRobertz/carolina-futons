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

# Monitors to create: "Friendly Name|URL"
declare -a MONITORS=(
  "CF Home|https://carolinafutons.com/"
  "CF Futon Frames PLP|https://carolinafutons.com/shop/futon-frames"
  "CF Products (Kingston)|https://carolinafutons.com/products/kingston-futon-frame"
  "CF Contact|https://carolinafutons.com/contact"
)

create_monitor() {
  local name="$1"
  local url="$2"

  local data="api_key=${KEY}&friendly_name=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${name}'))")&url=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${url}'))")&type=1&interval=${INTERVAL}&format=json"
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
  IFS='|' read -r name url <<< "$entry"
  echo "Creating: ${name}"
  create_monitor "$name" "$url"
done

echo ""
echo "Done. Verify at https://uptimerobot.com/dashboard"
