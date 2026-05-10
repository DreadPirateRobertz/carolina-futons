#!/usr/bin/env python3
"""cf-kull — stage3-velo ↔ cfutons monorepo parity audit.

For each src/ subtree (backend, pages, public), enumerate files in both
repos and report:
  - ONLY-IN-CFUTONS: file present in cfutons monorepo, missing in stage3-velo
    → cfw → Velo callers will 404 if they hit it (cf-w1lg pattern)
  - ONLY-IN-STAGE3:  file present in stage3-velo, missing in cfutons
    → drift in the other direction (Velo edits never made it back)
  - DIFFERS:         same path in both repos but file content differs
    → live divergence; stage3-velo and monorepo are out of sync

Per-file diff is reported as (size_delta, line_delta, sha) so reviewers can
prioritize substantial differences over whitespace/import-order changes.
"""
from __future__ import annotations
import hashlib
import json
import re
from pathlib import Path

CFUTONS = Path("/tmp/cfutons-kull")
STAGE3 = Path("/Users/hal/gt/cfutons/carolina-futons-stage3-velo")

SUBTREES = ["src/backend", "src/pages", "src/public"]


def collect(root: Path, subtree: str) -> dict[str, Path]:
    """Walk subtree, return {relative_path → absolute_path} for .js / .jsx / .ts / .tsx files."""
    out: dict[str, Path] = {}
    base = root / subtree
    if not base.exists():
        return out
    for p in base.rglob("*"):
        if p.is_file() and p.suffix in (".js", ".jsx", ".ts", ".tsx", ".json"):
            rel = str(p.relative_to(root))
            out[rel] = p
    return out


def sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()[:12]


def diff_summary(a: Path, b: Path) -> dict:
    a_text = a.read_text(errors="ignore")
    b_text = b.read_text(errors="ignore")
    return {
        "size_delta": len(a_text) - len(b_text),
        "line_delta": a_text.count("\n") - b_text.count("\n"),
        "cfutons_sha": sha(a),
        "stage3_sha": sha(b),
        "cfutons_lines": a_text.count("\n") + 1,
        "stage3_lines": b_text.count("\n") + 1,
    }


def is_http_function(path: str) -> bool:
    return path.endswith("http-functions.js")


def extract_http_exports(p: Path) -> set[str]:
    text = p.read_text(errors="ignore")
    pat = re.compile(r"^\s*export\s+(?:async\s+)?function\s+(post|get|put|delete|patch|options|use)_(\w+)", re.MULTILINE)
    pat_reexport = re.compile(r"^\s*export\s*\{\s*([^}]+)\s*\}\s*from", re.MULTILINE)
    out: set[str] = set()
    for m in pat.finditer(text):
        out.add(f"{m.group(1)}_{m.group(2)}")
    for m in pat_reexport.finditer(text):
        for n in m.group(1).split(","):
            n = n.strip().split(" as ")[0]
            if re.match(r"^(post|get|put|delete|patch|options|use)_\w+", n):
                out.add(n)
    return out


def main():
    report: dict = {}
    for subtree in SUBTREES:
        cf = collect(CFUTONS, subtree)
        s3 = collect(STAGE3, subtree)

        only_cfutons = sorted(set(cf) - set(s3))
        only_stage3 = sorted(set(s3) - set(cf))
        common = sorted(set(cf) & set(s3))

        differs = []
        same = 0
        for path in common:
            if cf[path].read_bytes() == s3[path].read_bytes():
                same += 1
            else:
                d = diff_summary(cf[path], s3[path])
                d["path"] = path
                differs.append(d)

        # Sort differs by absolute size_delta descending
        differs.sort(key=lambda d: -abs(d["size_delta"]))

        report[subtree] = {
            "only_in_cfutons": only_cfutons,
            "only_in_stage3": only_stage3,
            "differs": differs,
            "identical_count": same,
            "common_count": len(common),
        }

    # Special-case: http-functions.js endpoint diff
    cf_http = CFUTONS / "src/backend/http-functions.js"
    s3_http = STAGE3 / "src/backend/http-functions.js"
    if cf_http.exists() and s3_http.exists():
        cf_endpoints = extract_http_exports(cf_http)
        s3_endpoints = extract_http_exports(s3_http)
        report["http_endpoints"] = {
            "only_in_cfutons": sorted(cf_endpoints - s3_endpoints),
            "only_in_stage3": sorted(s3_endpoints - cf_endpoints),
            "common_count": len(cf_endpoints & s3_endpoints),
            "cfutons_total": len(cf_endpoints),
            "stage3_total": len(s3_endpoints),
        }

    Path("/tmp/cf-kull-results.json").write_text(json.dumps(report, indent=2, default=str))

    print("Subtree summary:")
    for sub, r in report.items():
        if sub == "http_endpoints":
            print(f"\n  HTTP endpoints in http-functions.js:")
            print(f"    cfutons: {r['cfutons_total']}, stage3-velo: {r['stage3_total']}, common: {r['common_count']}")
            print(f"    only-cfutons: {len(r['only_in_cfutons'])} → {r['only_in_cfutons'][:6]}{'...' if len(r['only_in_cfutons'])>6 else ''}")
            print(f"    only-stage3: {len(r['only_in_stage3'])} → {r['only_in_stage3'][:6]}{'...' if len(r['only_in_stage3'])>6 else ''}")
            continue
        print(f"\n  {sub}:")
        print(f"    common files: {r['common_count']} ({r['identical_count']} identical, {len(r['differs'])} differ)")
        print(f"    only in cfutons: {len(r['only_in_cfutons'])}")
        print(f"    only in stage3-velo: {len(r['only_in_stage3'])}")


if __name__ == "__main__":
    main()
