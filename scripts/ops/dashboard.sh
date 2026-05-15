#!/usr/bin/env bash
# cf-9fqc (Phase 2 of cf-4tqw) — observability dashboard.
#
# THIS IS A TDD STUB. Tests live in tests/ops/dashboard.test.mjs and pin
# the 5 contracts from docs/ops/observability-dashboard-spec.md. This stub
# exits non-zero so all tests are RED; the GREEN implementation lands in
# a follow-up commit once Stilgar provisions the API keys
# (UPTIMEROBOT_API_KEY + SENTRY_AUTH_TOKEN) for the live-API integration
# tests, OR earlier if we ship the fixture-mode path first.
#
# When implementing:
#   1. Make each Contract test pass one at a time
#   2. Do NOT add features beyond what a test requires
#   3. Refactor only after every test is green
#
# Usage (post-impl):
#   bash scripts/ops/dashboard.sh > /tmp/snapshot.md
#   # stdout = YAML summary block; /tmp/snapshot.md = full Markdown doc
#
# Modes:
#   DASHBOARD_TEST_MODE=live      — hit real APIs (default in production)
#   DASHBOARD_TEST_MODE=fixtures  — read canned JSON from
#                                   $DASHBOARD_TEST_FIXTURES_DIR (test only)
#
# Output file: $DASHBOARD_OUTPUT_FILE (default: docs/ops/dashboard-<DATE>.md)

set -u

echo "[dashboard] not yet implemented — TDD red phase (cf-9fqc)" >&2
echo "[dashboard] tests at tests/ops/dashboard.test.mjs pin the 5 contracts" >&2
exit 99
