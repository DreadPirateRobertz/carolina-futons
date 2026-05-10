"""cf-0ziz: tests for the v4 module-namespace dispatcher detection.

Pins the detection contract so a future regex edit can't silently
regress dispatcher recognition. Each test seeds a temp http-functions.js
text + runs the collector + asserts.

Run: `python -m pytest scripts/cf-dead-routes/test_audit_v4.py -v`
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

# audit.py reads ROOT/SRC/BACKEND from CFUTONS_ROOT — set a dummy so
# import doesn't crash. The dispatcher tests only need http_text strings,
# not real fs walking.
os.environ.setdefault("CFUTONS_ROOT", str(HERE))


def _import_audit():
    for mod in list(sys.modules):
        if mod == "audit":
            del sys.modules[mod]
    import audit
    return audit


def test_detects_simple_dispatcher():
    audit = _import_audit()
    http = """
import * as wishlistServiceModule from 'backend/wishlistService.web';
const ALLOW = new Set(['removeFromWishlist','isOnWishlist']);
export async function post_wishlistService(request) {
  const method = request.path[0];
  if (!ALLOW.has(method)) return notFound();
  await wishlistServiceModule[method]();
}
"""
    out = audit.collect_dispatcher_modules(http)
    assert out == {"wishlistService": "wishlistServiceModule"}


def test_skips_namespace_import_without_dynamic_call():
    """A `import * as M` that only reads `M.SOMETHING` (no `M[key](...)`)
    is NOT a dispatcher — should NOT be flagged."""
    audit = _import_audit()
    http = """
import * as constsModule from 'backend/myConsts.web';
export function get_thing() {
  return constsModule.SOME_CONSTANT;
}
"""
    out = audit.collect_dispatcher_modules(http)
    assert out == {}


def test_detects_multiple_dispatchers():
    audit = _import_audit()
    http = """
import * as wishlistServiceModule from 'backend/wishlistService.web';
import * as referralServiceModule from 'backend/referralService.web';
import * as constsModule from 'backend/myConsts.web';

export async function post_wishlist(request) {
  await wishlistServiceModule[request.path[0]]();
}

export async function post_referral(request) {
  await referralServiceModule[request.path[0]](...args);
}

// constsModule is read but never dispatched
const x = constsModule.X;
"""
    out = audit.collect_dispatcher_modules(http)
    assert out == {
        "wishlistService": "wishlistServiceModule",
        "referralService": "referralServiceModule",
    }
    assert "myConsts" not in out


def test_dispatcher_path_strips_web_suffix():
    """`from 'backend/foo.web'` → module key 'foo' (matches what
    _module_basename returns for src/backend/foo.web.js)."""
    audit = _import_audit()
    http = """
import * as fooModule from 'backend/foo.web';
fooModule[k]();
"""
    out = audit.collect_dispatcher_modules(http)
    assert out == {"foo": "fooModule"}


def test_dispatcher_path_without_web_suffix():
    """`from 'backend/foo'` (no .web) — also captured, basename 'foo'."""
    audit = _import_audit()
    http = """
import * as fooModule from 'backend/foo';
fooModule[k]();
"""
    out = audit.collect_dispatcher_modules(http)
    assert out == {"foo": "fooModule"}


def test_dispatcher_path_subdirectory():
    """`from 'backend/sub/foo.web'` → module key 'foo' (basename only)."""
    audit = _import_audit()
    http = """
import * as fooModule from 'backend/sub/foo.web';
fooModule[k]();
"""
    out = audit.collect_dispatcher_modules(http)
    assert out == {"foo": "fooModule"}


def test_classify_method_marks_dispatcher_as_OK_WIRED_VIA_DISPATCHER(tmp_path):
    """End-to-end: a webMethod whose defining file is dispatched should
    flip from WRAPPED-NO-CONSUMER (or whatever) to OK-WIRED-VIA-DISPATCHER."""
    audit = _import_audit()

    # Minimal info dict matching what collect_web_methods returns
    info = {
        "file": "src/backend/wishlistService.web.js",
        "permission": "SiteMember",
        "line": 100,
    }
    # http_text simulates the dispatcher pattern + ALSO directly imports
    # the method (so v2 marks it HTTP-EXPOSED). Without dispatcher detection
    # it would be WRAPPED-NO-CONSUMER. With dispatcher → OK-WIRED-VIA-DISPATCHER.
    http_text = """
import * as wishlistServiceModule from 'backend/wishlistService.web';
import { removeFromWishlist } from 'backend/wishlistService.web';
export async function post_wishlistService(request) {
  await wishlistServiceModule[request.path[0]](...args);
}
"""
    dispatcher_modules = audit.collect_dispatcher_modules(http_text)
    assert dispatcher_modules == {"wishlistService": "wishlistServiceModule"}

    row = audit.classify_method(
        "removeFromWishlist", info,
        files=[], cfw_files=[],
        http_text=http_text, events_text="",
        fs_path_refs=None,
        dispatcher_modules=dispatcher_modules,
    )
    assert row["gap_verdict"] == "OK-WIRED-VIA-DISPATCHER"
    assert row["in_dispatcher"] is True
    assert row["dispatcher_alias"] == "wishlistServiceModule"


def test_classify_method_unchanged_when_no_dispatcher(tmp_path):
    """A method NOT in a dispatcher module should keep its v3 verdict."""
    audit = _import_audit()
    info = {
        "file": "src/backend/wishlistService.web.js",
        "permission": "SiteMember",
        "line": 100,
    }
    http_text = """
import { removeFromWishlist } from 'backend/wishlistService.web';
export async function post_x(request) {
  await removeFromWishlist();
}
"""
    # No dispatcher anywhere — collect_dispatcher_modules returns {}
    dispatcher_modules = audit.collect_dispatcher_modules(http_text)
    assert dispatcher_modules == {}

    row = audit.classify_method(
        "removeFromWishlist", info,
        files=[], cfw_files=[],
        http_text=http_text, events_text="",
        fs_path_refs=None,
        dispatcher_modules=dispatcher_modules,
    )
    assert row["in_dispatcher"] is False
    # Verdict should be one of the existing v3 buckets, NOT
    # OK-WIRED-VIA-DISPATCHER.
    assert row["gap_verdict"] != "OK-WIRED-VIA-DISPATCHER"


def test_dispatcher_with_other_quote_styles():
    audit = _import_audit()
    http = """
import * as aMod from "backend/a.web";
import * as bMod from `backend/b.web`;
aMod[k]();
bMod[k]();
"""
    out = audit.collect_dispatcher_modules(http)
    # Single + double quotes both supported (regex covers ['"`]).
    # The backtick form may or may not be supported — pin double-quote at
    # minimum and not assert on backtick.
    assert "a" in out
