#!/usr/bin/env python3
"""Build a cfw inventory: data-slot values, component file basenames,
and a flat keyword corpus we can search for hookup-guide feature names.
"""
from __future__ import annotations
import json
import re
import subprocess
import sys
from pathlib import Path

CFW_SRC = Path("/Users/hal/gt/carolina-futons-web/src")

DATA_SLOT_RE = re.compile(r'data-slot=["\']([^"\']+)["\']')
DATA_TESTID_RE = re.compile(r'data-testid=["\']([^"\']+)["\']')


def collect_files() -> list[Path]:
    out = subprocess.check_output(
        [
            "find",
            str(CFW_SRC),
            "-type",
            "f",
            "(",
            "-name",
            "*.tsx",
            "-o",
            "-name",
            "*.ts",
            "-o",
            "-name",
            "*.jsx",
            "-o",
            "-name",
            "*.js",
            ")",
        ],
        text=True,
    )
    return [Path(p) for p in out.strip().splitlines()]


def main() -> int:
    files = collect_files()
    print(f"scanning {len(files)} cfw src files", file=sys.stderr)

    data_slots: set[str] = set()
    data_testids: set[str] = set()
    component_basenames: set[str] = set()
    file_index: dict[str, str] = {}  # lowered token → first file path
    keyword_index: dict[str, list[str]] = {}  # lowered token → matching files

    for fp in files:
        rel = str(fp.relative_to(CFW_SRC))
        try:
            text = fp.read_text(errors="ignore")
        except Exception:
            continue
        for m in DATA_SLOT_RE.findall(text):
            data_slots.add(m)
        for m in DATA_TESTID_RE.findall(text):
            data_testids.add(m)
        base = fp.stem
        component_basenames.add(base)
        # split CamelCase / kebab-case / snake_case → tokens
        tokens = re.findall(r"[A-Z][a-z]+|[a-z]+", base)
        for tok in tokens:
            tok_l = tok.lower()
            if len(tok_l) < 3:
                continue
            keyword_index.setdefault(tok_l, []).append(rel)

    out_dir = Path("/tmp/cf-ah0m")
    (out_dir / "cfw_data_slots.json").write_text(
        json.dumps(sorted(data_slots), indent=2)
    )
    (out_dir / "cfw_data_testids.json").write_text(
        json.dumps(sorted(data_testids), indent=2)
    )
    (out_dir / "cfw_components.json").write_text(
        json.dumps(sorted(component_basenames), indent=2)
    )
    (out_dir / "cfw_keyword_index.json").write_text(
        json.dumps(
            {k: sorted(set(v))[:8] for k, v in keyword_index.items()},
            indent=2,
            sort_keys=True,
        )
    )
    print(
        f"data_slots={len(data_slots)} data_testids={len(data_testids)} "
        f"components={len(component_basenames)} keywords={len(keyword_index)}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
