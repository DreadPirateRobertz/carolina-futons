#!/usr/bin/env python3
"""Forward-drift sweep: list cfw data-slots + data-testids + notable components
that share no token overlap with any hookup-guide feature.

Notable component = a TSX/JSX file basename that isn't a generic React util.
We score each cfw artifact against the union of all guide feature tokens.
Anything with zero token overlap is "drift" — present in cfw, absent from
the guide.
"""
from __future__ import annotations
import json
import re
from pathlib import Path

OUT = Path("/tmp/cf-ah0m")
features = json.loads((OUT / "features.json").read_text())
data_slots = json.loads((OUT / "cfw_data_slots.json").read_text())
data_testids = json.loads((OUT / "cfw_data_testids.json").read_text())
components = json.loads((OUT / "cfw_components.json").read_text())

STOP = {
    "the", "and", "for", "with", "page", "section", "of", "in", "on",
    "a", "an", "to", "by", "or", "is", "new", "core", "main", "global",
    "test", "lib", "data", "utils", "helpers", "types", "config",
    "constants", "index", "client", "server", "tsx", "ts", "js",
}


def stem(t: str) -> str:
    if len(t) > 4 and t.endswith("ies"):
        return t[:-3] + "y"
    if len(t) > 4 and t.endswith("es"):
        return t[:-2]
    if len(t) > 3 and t.endswith("s"):
        return t[:-1]
    return t


def tokens_of(s: str) -> set[str]:
    parts = re.findall(r"[A-Z][a-z]+|[a-z]+|\d+", s)
    return {stem(p.lower()) for p in parts if len(p) >= 3 and p.lower() not in STOP}


# Build the guide-feature universe
guide_tokens: set[str] = set()
for r in features:
    label = r["section"] + " " + (r.get("subfeature") or "")
    guide_tokens |= tokens_of(label)
    for eid in r.get("element_ids", []):
        guide_tokens |= tokens_of(eid)

print(f"guide token universe: {len(guide_tokens)}")

# Drift = cfw artifact with NO token overlap with the guide universe
drift_slots = sorted(
    s for s in data_slots if not (tokens_of(s) & guide_tokens) and tokens_of(s)
)
drift_testids = sorted(
    t for t in data_testids if not (tokens_of(t) & guide_tokens) and tokens_of(t)
)
# components: skip .test, libs, type defs
drift_components = sorted(
    c for c in components
    if not c.endswith(".test")
    and not c.endswith("-types")
    and not c.endswith("-lib")
    and not c.endswith("-data")
    and not c.startswith("use")  # hooks usually internal
    and not (tokens_of(c) & guide_tokens)
    and tokens_of(c)
)

(OUT / "forward_drift.json").write_text(
    json.dumps(
        {
            "data_slots": drift_slots,
            "data_testids": drift_testids,
            "components": drift_components,
        },
        indent=2,
    )
)
print(f"drift: slots={len(drift_slots)} testids={len(drift_testids)} components={len(drift_components)}")
