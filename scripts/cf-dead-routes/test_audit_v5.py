"""cf-5dto: tests for the v5 detector — 3 FP-shape blind spots surfaced
during cf-4x7e.B3/B4/B5.

Each cf-4x7e revert cost a PR; v5 closes the three shapes that caused them.

1. Non-webMethod export scanning (B-5 trap: comfortTimeline.createTimeline)
2. INTENTIONAL_ANYONE bucket propagation (B-4 trap: cartSessionService)
3. CI-sentinel sub-classification (B-4 trap: loadCatalogMaster)

Run: `python -m pytest scripts/cf-dead-routes/test_audit_v5.py -v`
"""
from __future__ import annotations

import os
import sys
import textwrap
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

os.environ.setdefault("CFUTONS_ROOT", str(HERE))


def _import_audit():
    for mod in list(sys.modules):
        if mod == "audit":
            del sys.modules[mod]
    import audit
    return audit


# ── Enhancement 1: Non-webMethod export scanning ──────────────────────


def test_collect_non_webmethod_exports_finds_async_function(tmp_path):
    """`export async function NAME(...)` is the comfortTimeline.createTimeline
    shape — a backend export that is alive via test-only callers but invisible
    to the v4 webMethod-only scan."""
    audit = _import_audit()
    backend = tmp_path / "src" / "backend"
    backend.mkdir(parents=True)
    (backend / "sample.web.js").write_text(textwrap.dedent("""
        import { Permissions, webMethod } from 'wix-web-module';

        export async function helperA({ orderId }) {
          return { ok: true, orderId };
        }

        export const wmB = webMethod(Permissions.Admin, async () => ({}));
    """))

    out = audit.collect_non_webmethod_exports(backend)
    # Only the async-function export should appear (the webMethod is its own dict)
    assert "helperA" in out
    assert out["helperA"]["kind"] == "async function"
    assert out["helperA"]["file"].endswith("sample.web.js")
    assert "wmB" not in out  # webMethod, not a non-webMethod export


def test_collect_non_webmethod_exports_finds_plain_function(tmp_path):
    """`export function NAME(...)` (non-async) also counts."""
    audit = _import_audit()
    backend = tmp_path / "src" / "backend"
    backend.mkdir(parents=True)
    (backend / "util.web.js").write_text(textwrap.dedent("""
        export function buildTrackingUrl(trackingNumber) {
          return `https://ups.com/track?t=${trackingNumber}`;
        }
    """))

    out = audit.collect_non_webmethod_exports(backend)
    assert "buildTrackingUrl" in out
    assert out["buildTrackingUrl"]["kind"] == "function"


def test_collect_non_webmethod_exports_skips_const_assignments(tmp_path):
    """`export const FOO = 5` is a value export, not a function — outside
    the v5 scope (we care about callable surface that consumers might invoke)."""
    audit = _import_audit()
    backend = tmp_path / "src" / "backend"
    backend.mkdir(parents=True)
    (backend / "consts.web.js").write_text(textwrap.dedent("""
        export const MAX_ITEMS = 50;
        export const _MILESTONES = [1, 7, 14];
        export async function makeBatch(items) { return items; }
    """))

    out = audit.collect_non_webmethod_exports(backend)
    # The function lands; the const exports do not (they're caught by a
    # separate v5 future-work pass if needed).
    assert "makeBatch" in out
    assert "MAX_ITEMS" not in out
    assert "_MILESTONES" not in out


# ── Enhancement 2: INTENTIONAL_ANYONE → bucket propagation ────────────


def test_intentional_anyone_propagates_to_bucket(tmp_path):
    """Methods in INTENTIONAL_ANYONE should bucket as HTTP-EXPOSED-INTENTIONAL
    instead of falling through to DEAD when they have no in-tree callers
    (out-of-tree consumers like cfutons_mobile aren't visible to the scan)."""
    audit = _import_audit()
    info = {
        "file": "src/backend/cartSessionService.web.js",
        "permission": "Anyone",
        "line": 42,
    }
    # No callers anywhere — without v5, this falls through to DEAD.
    row = audit.classify_method(
        name="createSession",
        info=info,
        files=[],
        cfw_files=[],
        http_text="",
        events_text="",
        fs_path_refs={},
        dispatcher_modules={},
    )
    assert "HTTP-EXPOSED-INTENTIONAL" in row["bucket"]
    assert row["bucket"] != ["DEAD"]
    assert row["gap_verdict"] != "UNUSED-CAN-DELETE"


def test_non_allowlisted_anyone_still_dead_when_no_caller(tmp_path):
    """A method NOT in the allowlist but with Permissions.Anyone and zero
    callers still buckets DEAD — the propagation must be allowlist-gated,
    not Permissions.Anyone-gated, otherwise we'd lose the cleanup signal."""
    audit = _import_audit()
    info = {
        "file": "src/backend/randomService.web.js",
        "permission": "Anyone",
        "line": 10,
    }
    row = audit.classify_method(
        name="someUnusedMethod",
        info=info,
        files=[],
        cfw_files=[],
        http_text="",
        events_text="",
        fs_path_refs={},
        dispatcher_modules={},
    )
    assert "HTTP-EXPOSED-INTENTIONAL" not in row["bucket"]
    assert row["bucket"] == ["DEAD"]


# ── Enhancement 3: CI-sentinel filesystem-path read sub-classification ─


def test_classify_fs_path_consumer_test_import():
    """Consumer path matching `tests/*.test.(js|ts)` → FS-PATH-TEST-IMPORT.
    Test-only consumers represent a `keep-because-tested` signal, weaker than
    a script reading the file body as a data source."""
    audit = _import_audit()
    kind = audit.classify_fs_path_consumer("tests/validateCatalog.test.js")
    assert kind == "FS-PATH-TEST-IMPORT"


def test_classify_fs_path_consumer_data_source_script():
    """Consumer path matching `scripts/*.js` → FS-PATH-DATA-SOURCE.
    The loadCatalogMaster trap: validate-catalog.js reads the file body to
    parse VALID_CATEGORIES — deleting the file ENOENTs the tooling."""
    audit = _import_audit()
    kind = audit.classify_fs_path_consumer("scripts/validate-catalog.js")
    assert kind == "FS-PATH-DATA-SOURCE"


def test_classify_fs_path_consumer_data_source_python():
    """Same shape, .py extension — the cf-hpwy detector itself reading
    a manifest file would hit this path."""
    audit = _import_audit()
    kind = audit.classify_fs_path_consumer("scripts/cf-dead-routes/audit.py")
    assert kind == "FS-PATH-DATA-SOURCE"


def test_classify_fs_path_consumer_other_unspecified():
    """Anything not matching tests/ or scripts/ buckets to FS-PATH-OTHER —
    operator inspects manually rather than auto-inferring intent."""
    audit = _import_audit()
    kind = audit.classify_fs_path_consumer("src/some/other/path.js")
    assert kind == "FS-PATH-OTHER"


def test_bucket_reflects_fs_path_sub_classification(tmp_path):
    """When a defining file has both test-import and data-source consumers,
    the row should expose both sub-classifications so the operator can decide
    delete-strategy (test-only is safer to delete after migrating the test;
    data-source requires refactoring the tooling first)."""
    audit = _import_audit()
    fs_path_refs = {
        "loadCatalogMaster": [
            "scripts/validate-catalog.js",
            "tests/validateCatalog.test.js",
        ]
    }
    info = {
        "file": "src/backend/loadCatalogMaster.web.js",
        "permission": "Admin",
        "line": 1,
    }
    row = audit.classify_method(
        name="getCategories",
        info=info,
        files=[],
        cfw_files=[],
        http_text="",
        events_text="",
        fs_path_refs=fs_path_refs,
        dispatcher_modules={},
    )
    assert "FILESYSTEM-PATH-REFERENCED" in row["bucket"]
    # New v5 field: per-consumer sub-classification
    assert "fs_path_consumer_kinds" in row
    kinds = row["fs_path_consumer_kinds"]
    assert "FS-PATH-DATA-SOURCE" in kinds
    assert "FS-PATH-TEST-IMPORT" in kinds
