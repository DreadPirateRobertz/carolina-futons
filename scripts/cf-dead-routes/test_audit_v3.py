"""cf-sq0d: tests for the v3 filesystem-path reference detection.

Pins the four pattern shapes called out in the bead so a future regex
edit can't silently regress detection. Each test seeds a temp repo,
runs the v3 collector, and asserts a backend module is/isn't flagged.

Run: `python -m pytest scripts/cf-dead-routes/test_audit_v3.py -v`
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))


def _make_repo(tmp_path: Path) -> Path:
    """Create a minimal Velo-shaped repo: src/backend + scripts + tests."""
    (tmp_path / "src" / "backend").mkdir(parents=True)
    (tmp_path / "scripts").mkdir()
    (tmp_path / "tests").mkdir()
    return tmp_path


def _run_v3(repo: Path) -> dict[str, list[str]]:
    """Reload audit.py with CFUTONS_ROOT=repo so fresh ROOT/SRC/BACKEND bind."""
    os.environ["CFUTONS_ROOT"] = str(repo)
    # Force a fresh import so module-scope ROOT picks up the new env var.
    for mod in list(sys.modules):
        if mod == "audit":
            del sys.modules[mod]
    import audit  # noqa: WPS433 — intentional late import per test

    files = audit.all_source_files()
    return audit.collect_filesystem_path_refs(files)


def test_pattern_1_fs_readfilesync_with_web_js(tmp_path: Path) -> None:
    """fs.readFileSync('src/backend/foo.web.js') flags `foo`."""
    repo = _make_repo(tmp_path)
    (repo / "src" / "backend" / "foo.web.js").write_text(
        "export const bar = webMethod(Permissions.Anyone, () => 1);\n"
    )
    (repo / "scripts" / "validate.js").write_text(
        "const x = fs.readFileSync('src/backend/foo.web.js', 'utf8');\n"
    )
    refs = _run_v3(repo)
    assert refs["foo"] == ["scripts/validate.js"]


def test_pattern_2_path_resolve_relative(tmp_path: Path) -> None:
    """path.resolve(__dirname, '../../src/backend/foo') flags `foo`."""
    repo = _make_repo(tmp_path)
    (repo / "src" / "backend" / "foo.web.js").write_text(
        "export const bar = webMethod(Permissions.Anyone, () => 1);\n"
    )
    (repo / "tests" / "foo.test.js").write_text(
        "const p = path.resolve(__dirname, '../src/backend/foo.web.js');\n"
    )
    refs = _run_v3(repo)
    assert refs["foo"] == ["tests/foo.test.js"]


def test_pattern_3_vite_raw_import(tmp_path: Path) -> None:
    """import x from 'src/backend/foo?raw' flags `foo`."""
    repo = _make_repo(tmp_path)
    (repo / "src" / "backend" / "foo.web.js").write_text(
        "export const bar = webMethod(Permissions.Anyone, () => 1);\n"
    )
    (repo / "scripts" / "raw-loader.js").write_text(
        "import x from 'src/backend/foo.web.js?raw';\n"
    )
    refs = _run_v3(repo)
    assert refs["foo"] == ["scripts/raw-loader.js"]


def test_pattern_4_quoted_bare_path_in_array(tmp_path: Path) -> None:
    """quoted 'src/backend/foo.web.js' in any context flags `foo`."""
    repo = _make_repo(tmp_path)
    (repo / "src" / "backend" / "foo.web.js").write_text(
        "export const bar = webMethod(Permissions.Anyone, () => 1);\n"
    )
    (repo / "scripts" / "manifest.js").write_text(
        "const files = ['src/backend/foo.web.js', 'src/backend/baz.js'];\n"
    )
    refs = _run_v3(repo)
    assert refs["foo"] == ["scripts/manifest.js"]


def test_self_reference_is_filtered(tmp_path: Path) -> None:
    """A backend file mentioning its own path doesn't count as a consumer."""
    repo = _make_repo(tmp_path)
    (repo / "src" / "backend" / "foo.web.js").write_text(
        "// path: src/backend/foo.web.js\n"
        "export const bar = webMethod(Permissions.Anyone, () => 1);\n"
    )
    refs = _run_v3(repo)
    assert refs["foo"] == []


def test_unrelated_path_not_flagged(tmp_path: Path) -> None:
    """A path that resembles `src/backend/<other>` doesn't flag `foo`."""
    repo = _make_repo(tmp_path)
    (repo / "src" / "backend" / "foo.web.js").write_text(
        "export const bar = webMethod(Permissions.Anyone, () => 1);\n"
    )
    (repo / "src" / "backend" / "baz.web.js").write_text(
        "export const qux = webMethod(Permissions.Anyone, () => 1);\n"
    )
    (repo / "scripts" / "uses-baz.js").write_text(
        "const p = 'src/backend/baz.web.js';\n"
    )
    refs = _run_v3(repo)
    assert refs["foo"] == []
    assert refs["baz"] == ["scripts/uses-baz.js"]


def test_multiple_consumers_all_recorded(tmp_path: Path) -> None:
    """Two consumers of the same backend file are both surfaced."""
    repo = _make_repo(tmp_path)
    (repo / "src" / "backend" / "foo.web.js").write_text(
        "export const bar = webMethod(Permissions.Anyone, () => 1);\n"
    )
    (repo / "scripts" / "a.js").write_text(
        "fs.readFileSync('src/backend/foo.web.js');\n"
    )
    (repo / "tests" / "b.test.js").write_text(
        "import('src/backend/foo.web.js?raw');\n"
    )
    refs = _run_v3(repo)
    assert sorted(refs["foo"]) == ["scripts/a.js", "tests/b.test.js"]


def test_classify_method_demotes_dead_to_filesystem_path(tmp_path: Path) -> None:
    """End-to-end: a DEAD-by-v2 webMethod in a fs-path-referenced file flips
    to FILESYSTEM-PATH-REFERENCED bucket, not DEAD."""
    repo = _make_repo(tmp_path)
    (repo / "src" / "backend" / "foo.web.js").write_text(
        "import { webMethod, Permissions } from 'wix-web-module';\n"
        "export const myDeadMethod = webMethod(Permissions.Anyone, () => 1);\n"
    )
    # No callers in src — but a script reads the file by path.
    (repo / "scripts" / "validate.js").write_text(
        "fs.readFileSync('src/backend/foo.web.js', 'utf8');\n"
    )

    os.environ["CFUTONS_ROOT"] = str(repo)
    for mod in list(sys.modules):
        if mod == "audit":
            del sys.modules[mod]
    import audit

    files = audit.all_source_files()
    methods = audit.collect_web_methods()
    fs_path_refs = audit.collect_filesystem_path_refs(files)

    assert "myDeadMethod" in methods
    row = audit.classify_method(
        "myDeadMethod",
        methods["myDeadMethod"],
        files,
        cfw_files=[],
        http_text="",
        events_text="",
        fs_path_refs=fs_path_refs,
    )
    assert "FILESYSTEM-PATH-REFERENCED" in row["bucket"]
    assert "DEAD" not in row["bucket"]
    assert row["in_filesystem_path"] is True
    assert "scripts/validate.js" in row["filesystem_path_consumers"]


def test_classify_method_unchanged_when_no_fs_path_ref(tmp_path: Path) -> None:
    """A truly DEAD method (no fs-path consumers either) still buckets DEAD."""
    repo = _make_repo(tmp_path)
    (repo / "src" / "backend" / "foo.web.js").write_text(
        "import { webMethod, Permissions } from 'wix-web-module';\n"
        "export const lonely = webMethod(Permissions.Anyone, () => 1);\n"
    )

    os.environ["CFUTONS_ROOT"] = str(repo)
    for mod in list(sys.modules):
        if mod == "audit":
            del sys.modules[mod]
    import audit

    files = audit.all_source_files()
    methods = audit.collect_web_methods()
    fs_path_refs = audit.collect_filesystem_path_refs(files)

    row = audit.classify_method(
        "lonely",
        methods["lonely"],
        files,
        cfw_files=[],
        http_text="",
        events_text="",
        fs_path_refs=fs_path_refs,
    )
    assert row["bucket"] == ["DEAD"]
    assert row["in_filesystem_path"] is False
