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


# ── cf-5dto.fu1: arrow + function-expression export shapes ───────────


def test_collect_non_webmethod_exports_finds_arrow_async_const(tmp_path):
    """`export const FOO = async (x) => {...}` — modern arrow-async-const.
    If anyone refactors a webMethod-adjacent helper to this shape, v5
    must still see it. miquella silent-failure-hunter Finding 4 motivated
    this broadening."""
    audit = _import_audit()
    backend = tmp_path / "src" / "backend"
    backend.mkdir(parents=True)
    (backend / "arrow.web.js").write_text(textwrap.dedent("""
        export const fetchUserData = async (id) => {
          return { id, ok: true };
        };
    """))
    out = audit.collect_non_webmethod_exports(backend)
    assert "fetchUserData" in out
    assert out["fetchUserData"]["kind"] == "async arrow"


def test_collect_non_webmethod_exports_finds_arrow_sync_const(tmp_path):
    """`export const FOO = (x) => {...}` — sync arrow-const."""
    audit = _import_audit()
    backend = tmp_path / "src" / "backend"
    backend.mkdir(parents=True)
    (backend / "sync.web.js").write_text(textwrap.dedent("""
        export const formatPrice = (cents) => `$${(cents/100).toFixed(2)}`;
    """))
    out = audit.collect_non_webmethod_exports(backend)
    assert "formatPrice" in out
    assert out["formatPrice"]["kind"] == "arrow"


def test_collect_non_webmethod_exports_finds_function_expression_const(tmp_path):
    """`export const FOO = function(x) {...}` and async variant."""
    audit = _import_audit()
    backend = tmp_path / "src" / "backend"
    backend.mkdir(parents=True)
    (backend / "fnexpr.web.js").write_text(textwrap.dedent("""
        export const calculate = function(x, y) {
          return x + y;
        };
        export const asyncCalc = async function(x) {
          return await x;
        };
    """))
    out = audit.collect_non_webmethod_exports(backend)
    assert "calculate" in out
    assert out["calculate"]["kind"] == "function expression"
    assert "asyncCalc" in out
    assert out["asyncCalc"]["kind"] == "async function expression"


def test_collect_non_webmethod_exports_does_not_match_value_const_or_call(tmp_path):
    """Negative-case pin: must NOT match value-const or function-call-result.
    Guards against the broadened regex accidentally swallowing constants."""
    audit = _import_audit()
    backend = tmp_path / "src" / "backend"
    backend.mkdir(parents=True)
    (backend / "values.web.js").write_text(textwrap.dedent("""
        export const CONFIG = { maxRetries: 3, timeout: 5000 };
        export const COUNT = computeCount();
        export const ITEMS = [1, 2, 3];
        export const result = something.method();
        export const klass = SomeClass;
    """))
    out = audit.collect_non_webmethod_exports(backend)
    assert "CONFIG" not in out
    assert "COUNT" not in out
    assert "ITEMS" not in out
    assert "result" not in out
    assert "klass" not in out


# ── cf-5dto.fu1: FS-path test-import path broadening ─────────────────


def test_classify_fs_path_consumer_cfw_style_underscore_tests():
    """cfw uses `src/__tests__/foo.test.tsx` — classify as TEST-IMPORT."""
    audit = _import_audit()
    assert audit.classify_fs_path_consumer("src/__tests__/Header.test.tsx") == "FS-PATH-TEST-IMPORT"


def test_classify_fs_path_consumer_test_tsx_extension():
    """`.tsx` test files (cfw-style React component tests)."""
    audit = _import_audit()
    assert audit.classify_fs_path_consumer("tests/Component.test.tsx") == "FS-PATH-TEST-IMPORT"
    assert audit.classify_fs_path_consumer("tests/Component.spec.tsx") == "FS-PATH-TEST-IMPORT"


def test_classify_fs_path_consumer_mjs_cjs_test_files():
    """Modern Node test runners may emit `.mjs` / `.cjs`."""
    audit = _import_audit()
    assert audit.classify_fs_path_consumer("tests/foo.test.mjs") == "FS-PATH-TEST-IMPORT"
    assert audit.classify_fs_path_consumer("tests/foo.test.cjs") == "FS-PATH-TEST-IMPORT"


def test_classify_fs_path_consumer_nested_test_roots():
    """Monorepo / nested packages — match `__tests__/` anywhere OR
    `tests/` under a package root."""
    audit = _import_audit()
    assert audit.classify_fs_path_consumer("packages/foo/__tests__/bar.test.ts") == "FS-PATH-TEST-IMPORT"
    assert audit.classify_fs_path_consumer("packages/foo/tests/bar.test.js") == "FS-PATH-TEST-IMPORT"


def test_classify_fs_path_consumer_other_still_fallthrough():
    """Negative-case pin: non-test, non-script paths still OTHER."""
    audit = _import_audit()
    assert audit.classify_fs_path_consumer("src/components/Foo.tsx") == "FS-PATH-OTHER"
    assert audit.classify_fs_path_consumer("docs/example.md") == "FS-PATH-OTHER"


# ── Constant-pin: lock each trap symbol into INTENTIONAL_ANYONE ────────
# miquella test-analyzer CR: a future refactor that removes an allowlist
# entry silently re-introduces the trap. Pin each by name.


def test_allowlist_pins_cartSessionService_createSession():
    audit = _import_audit()
    assert "cartSessionService.createSession" in audit.INTENTIONAL_ANYONE


def test_allowlist_pins_cartSessionService_updateCartItems():
    audit = _import_audit()
    assert "cartSessionService.updateCartItems" in audit.INTENTIONAL_ANYONE


def test_allowlist_pins_ups_shipping_trackShipment():
    audit = _import_audit()
    assert "ups-shipping.trackShipment" in audit.INTENTIONAL_ANYONE


def test_allowlist_pins_pinterestCatalogSync_generatePinContent():
    audit = _import_audit()
    assert "pinterestCatalogSync.generatePinContent" in audit.INTENTIONAL_ANYONE


def test_allowlist_pins_emailService_sendSwatchConfirmationEmail():
    audit = _import_audit()
    assert "emailService.sendSwatchConfirmationEmail" in audit.INTENTIONAL_ANYONE


# ── Tightened allowlist gate (CR finding 2) ────────────────────────────


def test_admin_permission_with_allowlist_entry_is_NOT_intentional():
    """If a method is allowlisted but its permission is Admin (not Anyone),
    the allowlist semantic doesn't apply — the entry exists for the
    Permissions.Anyone case. miquella code-reviewer + silent-failure-hunter
    flagged that the gate was name-only. v5 now requires BOTH permission ==
    'Anyone' AND allowlist membership."""
    audit = _import_audit()
    info = {
        "file": "src/backend/cartSessionService.web.js",
        "permission": "Admin",  # hardened away from Anyone
        "line": 42,
    }
    row = audit.classify_method(
        name="createSession",  # still allowlisted by name
        info=info,
        files=[],
        cfw_files=[],
        http_text="",
        events_text="",
        fs_path_refs={},
        dispatcher_modules={},
    )
    # The allowlist should NOT apply — gate requires permission==Anyone.
    assert "HTTP-EXPOSED-INTENTIONAL" not in row["bucket"]
    assert row["gap_verdict"] != "OK-INTENTIONAL-ANYONE"


# ── Combinatorial precedence (CR test-analyzer + code-reviewer) ────────


def test_allowlist_does_not_short_circuit_dispatcher_signal():
    """An allowlisted-Anyone method that's ALSO reachable via a namespace
    dispatcher should still surface OK-WIRED-VIA-DISPATCHER (the real
    in-tree signal), not flatten to OK-INTENTIONAL-ANYONE.

    silent-failure-hunter Finding 2: the allowlist short-circuit was
    masking caller-graph signal. v5 now makes OK-INTENTIONAL-ANYONE a
    fallback verdict only when the row would otherwise be UNUSED-CAN-DELETE."""
    audit = _import_audit()
    info = {
        "file": "src/backend/cartSessionService.web.js",
        "permission": "Anyone",
        "line": 42,
    }
    # Simulate a dispatcher mapping that hits cartSessionService.
    row = audit.classify_method(
        name="createSession",
        info=info,
        files=[],
        cfw_files=[],
        http_text="",
        events_text="",
        fs_path_refs={},
        dispatcher_modules={"cartSessionService": "cartSessionServiceModule"},
    )
    # Bucket carries BOTH classifications.
    assert "HTTP-EXPOSED-INTENTIONAL" in row["bucket"]
    # Gap-verdict surfaces the dispatcher signal, NOT OK-INTENTIONAL-ANYONE.
    assert row["gap_verdict"] == "OK-WIRED-VIA-DISPATCHER"


def test_allowlist_does_not_short_circuit_cfw_high_signal():
    """If an allowlisted method has a cfw_high reference but no in-tree
    HTTP wrapper, the row should surface GAP-CFW-WANTS, not silently
    flatten to OK-INTENTIONAL-ANYONE. The cfw caller is a real signal."""
    audit = _import_audit()
    # Build a synthetic cfw file that references the method via /_functions/<name>
    import tempfile
    with tempfile.TemporaryDirectory() as td:
        cfw_dir = Path(td) / "src"
        cfw_dir.mkdir()
        (cfw_dir / "cart-fetch.ts").write_text(
            "fetch('/_functions/createSession', { method: 'POST' });"
        )
        # Repoint CFW_SRC for the test.
        audit.CFW_SRC = cfw_dir
        info = {
            "file": "src/backend/cartSessionService.web.js",
            "permission": "Anyone",
            "line": 42,
        }
        row = audit.classify_method(
            name="createSession",
            info=info,
            files=[],
            cfw_files=audit.collect_cfw_files(),
            http_text="",  # no HTTP wrapper
            events_text="",
            fs_path_refs={},
            dispatcher_modules={},
        )
    # Bucket still carries HTTP-EXPOSED-INTENTIONAL.
    assert "HTTP-EXPOSED-INTENTIONAL" in row["bucket"]
    # But gap-verdict surfaces the cfw signal, NOT a silent OK.
    assert row["gap_verdict"] == "GAP-CFW-WANTS"


# ── Main() integration smoke (CR finding 1) ────────────────────────────


def test_main_emits_non_webmethod_inventory_to_stderr(tmp_path, capsys):
    """The whole point of collect_non_webmethod_exports is that operators
    SEE it via the production tool. miquella code-reviewer caught that v1
    of the PR defined the helper but never wired it into main(). v5 now
    invokes it from main() and prints the count to stderr."""
    audit = _import_audit()

    # Build a minimal fixture repo
    src = tmp_path / "src" / "backend"
    src.mkdir(parents=True)
    (src / "sample.web.js").write_text(
        "import { Permissions, webMethod } from 'wix-web-module';\n"
        "export async function helperA() {}\n"
        "export const wmB = webMethod(Permissions.Admin, async () => ({}));\n"
    )
    (tmp_path / "src" / "backend" / "http-functions.js").write_text("")
    (tmp_path / "src" / "backend" / "events.js").write_text("")

    # Point audit at the fixture
    import os as _os
    _os.environ["CFUTONS_ROOT"] = str(tmp_path)
    Path("/tmp/cf-dead-routes").mkdir(exist_ok=True)
    audit = _import_audit()  # reload with new ROOT

    rc = audit.main()
    assert rc == 0
    captured = capsys.readouterr()
    # Stderr must announce the inventory + count
    assert "Non-webMethod function exports in src/backend" in captured.err
    assert "1" in captured.err  # the helperA count


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


# ── cf-5dto.2 (cf-5dto.fu2): combinatorial precedence tests ────────────
#
# Per the miquella test-analyzer review: each v5 fix-path is unit-tested
# in isolation, but two-shape overlaps weren't pinned. These tests cover
# the bucket interactions that determine which signal wins when an entry
# matches multiple paths.


def test_allowlist_plus_fs_path_data_source(tmp_path):
    """Bucket interaction #1: allowlisted Anyone method WITH fs_path_refs
    populated. Both signals must surface on the bucket array — operators
    need to see the allowlist reasoning AND the FS-PATH-DATA-SOURCE
    sub-class so they understand the cleanup cost (refactor tooling
    first) before treating the row as out-of-tree-consumer-only.

    Pins the bucket shape, not the verdict — verdict precedence is
    separately tightened by cf-5dto.fu1 (#1349); this test stays valid
    pre- and post-merge because bucket assignment is invariant."""
    audit = _import_audit()
    info = {
        # cartSessionService.createSession is in INTENTIONAL_ANYONE
        # per the production allowlist.
        "file": "src/backend/cartSessionService.web.js",
        "permission": "Anyone",
        "line": 1,
    }
    # fs_path_refs is keyed by MODULE BASENAME (not method name) per
    # _module_basename(defining_file) → cartSessionService.
    row = audit.classify_method(
        name="createSession",
        info=info,
        files=[],
        cfw_files=[],
        http_text="",
        events_text="",
        fs_path_refs={
            "cartSessionService": ["scripts/seed-fixtures.js"],
        },
        dispatcher_modules={},
    )
    # Both signals must coexist on the bucket list.
    assert "HTTP-EXPOSED-INTENTIONAL" in row["bucket"]
    assert "FILESYSTEM-PATH-REFERENCED" in row["bucket"]
    assert row["fs_path_consumer_kinds"] == ["FS-PATH-DATA-SOURCE"]
    # in_filesystem_path flag must reflect the consumer presence so
    # downstream summary code (which reads the row dict, not the bucket
    # array) sees the same signal.
    assert row["in_filesystem_path"] is True


def test_allowlist_plus_dispatcher_bucket_shape(tmp_path):
    """Bucket interaction #2: allowlisted Anyone method WITH in_dispatcher.
    Both the dispatcher signal AND the allowlist signal must show in the
    bucket list. The dispatcher signal is load-bearing — if the dispatcher
    were removed, the method would lose WIRED status and the operator
    needs that signal visible distinct from the allowlist fallback.

    Pins bucket shape; verdict precedence is cf-5dto.fu1 (#1349) territory."""
    audit = _import_audit()
    info = {
        "file": "src/backend/cartSessionService.web.js",
        "permission": "Anyone",
        "line": 1,
    }
    row = audit.classify_method(
        name="createSession",
        info=info,
        files=[],
        cfw_files=[],
        http_text="",
        events_text="",
        fs_path_refs={},
        # Simulate a dispatcher that owns the cartSessionService surface.
        # Key is the defining-file's module basename.
        dispatcher_modules={"cartSessionService": "post_cartSession"},
    )
    # Both signals coexist:
    assert "DISPATCHER-WRAPPED" in row["bucket"]
    assert "HTTP-EXPOSED-INTENTIONAL" in row["bucket"]
    # in_http_via_dispatcher auto-sets in_http, so HTTP-EXPOSED is also in.
    assert "HTTP-EXPOSED" in row["bucket"]
    assert row["in_http_via_dispatcher"] is True


def test_non_webmethod_inventory_independent_of_webmethod_rows(tmp_path):
    """Bucket interaction #3: a backend .web.js with BOTH a webMethod
    AND a non-webMethod export. The non-WM inventory must populate
    regardless of webMethod presence — a future revert that scopes
    the non-WM scan to "files with no webMethods" would silently miss
    the comfortTimeline.createTimeline shape (the B-5 trap)."""
    audit = _import_audit()
    src = tmp_path / "mixed.web.js"
    src.write_text(textwrap.dedent("""\
        import { Permissions, webMethod } from 'wix-web-module';

        export const liveMethod = webMethod(Permissions.Admin, async () => {});

        // Non-webMethod export sharing the same file — should still be inventoried.
        export async function createTimeline(orderId) {
          return { orderId };
        }
    """))
    out = audit.collect_non_webmethod_exports(backend_root=tmp_path)
    # The webMethod (liveMethod) is NOT a non-webMethod export — should
    # not appear in this inventory. The helper SHOULD.
    assert "createTimeline" in out
    assert out["createTimeline"]["kind"] in ("async function", "function")
    assert "liveMethod" not in out


# Note: a "allowlist + cfw_low" precedence test was considered for this
# interaction but `cfw_references` requires fixtures inside CFW_SRC.parent
# (fp.relative_to call), and the verdict precedence change between pre-
# and post-#1349 makes any concrete assertion fragile across the merge
# boundary. The two signals it would pin (HTTP-EXPOSED-INTENTIONAL bucket
# + has_cfw_low flag) are already covered by
# test_allowlist_plus_fs_path_data_source + the existing
# cfw_references unit tests. cf-5dto.fu1 (#1349) is where the verdict
# precedence change is pinned with a real fixture.


def test_fs_path_refs_mixed_kinds_both_surface(tmp_path):
    """Bucket interaction #5: fs_path_refs containing MIXED kinds
    (test-import + data-source). Both sub-classifications must appear
    in fs_path_consumer_kinds, ordered consistently so downstream
    consumers (operator triage scripts) can rely on set membership.

    Pins the de-duplication + ordering invariants on top of the existing
    test_bucket_reflects_fs_path_sub_classification coverage. fs_path_refs
    is keyed by module basename (_module_basename(defining_file))."""
    audit = _import_audit()
    fs_path_refs = {
        # Keyed by module basename — loadCatalogMaster from
        # src/backend/loadCatalogMaster.web.js.
        "loadCatalogMaster": [
            "tests/cat1.test.js",
            "scripts/validate.js",
            "tests/cat2.spec.ts",
            "scripts/seed.py",
            # Same data-source file twice — must not double-count.
            "scripts/validate.js",
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
    kinds = row["fs_path_consumer_kinds"]
    # Both kinds present.
    assert "FS-PATH-DATA-SOURCE" in kinds
    assert "FS-PATH-TEST-IMPORT" in kinds
    # De-duplication: each kind appears at most once even though the
    # source list has scripts/validate.js twice.
    assert len(kinds) == len(set(kinds))
