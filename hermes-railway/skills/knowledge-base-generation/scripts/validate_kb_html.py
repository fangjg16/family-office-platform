#!/usr/bin/env python3
"""Validate a Project Knowledge Base HTML file.

Usage:
  python validate_kb_html.py path/to/kb.html
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

CANONICAL = [
    "snapshot",
    "assets",
    "legal-relationships",
    "business-model",
    "capital-structure",
    "comps",
    "returns",
    "timeline",
    "risks",
    "open-questions",
    "decision-framework",
]


def fail(msg: str) -> None:
    print(f"FAIL: {msg}")
    raise SystemExit(1)


def main() -> None:
    if len(sys.argv) != 2:
        print(__doc__.strip())
        raise SystemExit(2)
    path = Path(sys.argv[1])
    html = path.read_text(encoding="utf-8-sig")
    if len(html.strip()) < 500:
        fail("HTML is too short to be a full KB page")
    if len(html.encode("utf-8")) > 5 * 1024 * 1024:
        fail("HTML exceeds 5MB")
    if not re.search(r"<!DOCTYPE\s+html|<html[\s>]", html, re.I):
        fail("missing <!DOCTYPE html> or <html>")
    if "kb-shell" not in html:
        fail("missing kb-shell")
    if "KB-CONFIG" not in html:
        fail("missing KB-CONFIG block")
    if re.search(r"\{\{[A-Z0-9_]+\}\}", html):
        fail("unresolved template placeholders remain")
    uncommented = re.sub(r"<!--.*?-->", "", html, flags=re.S)
    anchors = [key for key in CANONICAL if re.search(rf'id=["\']{re.escape(key)}["\']', uncommented)]
    if not anchors:
        fail("no canonical slot anchors found")
    nav_targets = re.findall(r'data-target=["\']([^"\']+)["\']', uncommented)
    duplicates = sorted({x for x in nav_targets if nav_targets.count(x) > 1})
    if duplicates:
        fail(f"duplicate nav targets: {duplicates}")
    for target in nav_targets:
        if target != "overview" and target not in CANONICAL and target not in {"source-index", "glossary"}:
            fail(f"unknown nav target: {target}")
    citation_targets = re.findall(r'href=["\']#(source-(?:U|A)-\d+)["\']', uncommented)
    source_ids = set(re.findall(r'id=["\'](source-(?:U|A)-\d+)["\']', uncommented))
    missing_sources = sorted(set(citation_targets) - source_ids)
    if missing_sources:
        fail(f"citation targets missing appendix anchors: {missing_sources}")
    if citation_targets and "revealAnchor" not in html:
        fail("citation links exist but cross-panel revealAnchor handler is missing")
    active_panels = len(re.findall(r'class=["\'][^"\']*kb-panel[^"\']*active', uncommented))
    if active_panels != 1:
        fail(f"expected exactly one active kb-panel, found {active_panels}")
    print(f"OK: {path} ({len(anchors)} canonical slots rendered)")


if __name__ == "__main__":
    main()
