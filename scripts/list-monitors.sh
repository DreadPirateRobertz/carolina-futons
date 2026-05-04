#!/usr/bin/env bash
# List all UptimeRobot monitors for carolinafutons.com
# Usage: source secrets.env && bash list-monitors.sh
set -euo pipefail

KEY="${UPTIMEROBOT_API_KEY:?UPTIMEROBOT_API_KEY is required}"

curl -s -X POST "https://api.uptimerobot.com/v2/getMonitors" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "api_key=${KEY}&format=json" \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
if d.get('stat') != 'ok':
    print('Error:', d)
    sys.exit(1)
monitors = d.get('monitors', [])
print(f'{'ID':<10} {'Status':<10} {'Interval':<10} Name / URL')
print('-' * 70)
statuses = {0: 'paused', 1: 'not checked', 2: 'up', 8: 'seems down', 9: 'down'}
for m in monitors:
    st = statuses.get(m['status'], str(m['status']))
    print(f\"{m['id']:<10} {st:<10} {m['interval']:<10}s {m['friendly_name']}\")
    print(f\"{'':30} {m['url']}\")
print()
print(f'Total: {len(monitors)} monitors')
"
