#!/usr/bin/env python3
"""Validate a v2.91 Project Knowledge Base HTML file.

Usage:
  python validate_kb_html.py path/to/kb.html
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

CANONICAL = [
    "snapshot",
    "target-overview",
    "industry-market",
    "business-operations",
    "legal-ownership",
    "regulatory-compliance",
    "resource-network",
    "comps-benchmark",
    "valuation-returns",
    "diligence-gaps",
    "risks-mitigation",
    "timeline-milestones",
    "decision-framework",
]

APPENDICES = {"source-index", "glossary", "data-dictionary", "version-ledger"}
LEGACY = {"assets", "legal-relationships", "business-model", "capital-structure", "comps", "returns", "timeline", "risks", "open-questions"}


def fail(msg: str) -> None:
    print(f"FAIL: {msg}")
    raise SystemExit(1)


def config_order(html: str) -> list[str]:
    match = re.search(r"<!--\s*KB-CONFIG\s*(.*?)\s*-->", html, re.S)
    if not match:
        fail("missing KB-CONFIG block")
    body = match.group(1)
    if "schema-version: 2.91" not in body:
        fail("KB-CONFIG schema-version must be 2.91")
    order_match = re.search(r"display-order:\s*([^\n]+)", body)
    if not order_match:
        fail("missing KB-CONFIG display-order")
    order = [x.strip() for x in order_match.group(1).split(",") if x.strip()]
    bad = [x for x in order if x not in CANONICAL]
    if bad:
        fail(f"unknown display-order slot keys: {bad}")
    if sorted(order) != sorted(CANONICAL):
        fail("display-order must contain all 13 v2.91 canonical slots exactly once")
    return order


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
    if re.search(r"\{\{[A-Z0-9_]+\}\}", html):
        fail("unresolved template placeholders remain")

    order = config_order(html)
    uncommented = re.sub(r"<!--.*?-->", "", html, flags=re.S)
    nav_targets = re.findall(r'data-target=["\']([^"\']+)["\']', uncommented)
    duplicates = sorted({x for x in nav_targets if nav_targets.count(x) > 1})
    if duplicates:
        fail(f"duplicate nav targets: {duplicates}")
    allowed = {"overview", *CANONICAL, *APPENDICES}
    bad_nav = [x for x in nav_targets if x not in allowed]
    if bad_nav:
        fail(f"unknown nav target: {bad_nav}")

    rendered_core = [key for key in order if re.search(rf'id=["\']{re.escape(key)}["\']', uncommented)]
    if not rendered_core:
        fail("no canonical slot anchors found")
    if len(rendered_core) != len(set(rendered_core)):
        fail("duplicate canonical section anchors")

    legacy_hits = []
    for key in LEGACY:
        if re.search(rf'(?:id|data-target)=["\']{re.escape(key)}["\']', uncommented):
            legacy_hits.append(key)
    if legacy_hits:
        fail(f"legacy v2.8 anchors present: {legacy_hits}")

    for appendix in ["source-index", "glossary", "data-dictionary", "version-ledger"]:
        if appendix not in nav_targets:
            fail(f"missing appendix nav target: {appendix}")
        if not re.search(rf'id=["\']{appendix}["\']', uncommented):
            fail(f"missing appendix section: {appendix}")

    stat_values = re.findall(r'class=["\']stat-value["\']>\s*([^<]+)', uncommented)
    if len(stat_values) >= 3:
        for value in stat_values[:3]:
            if not re.fullmatch(r"\s*\d+(?:\.\d+)?%\s*|—", value):
                fail(f"scorecard values must be percentages, got {value!r}")

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
    if "id=\"timeline-milestones\"" in uncommented and not all(x in uncommented for x in ["8.1 已发生", "8.2 正在推进", "8.3 未来关键节点"]):
        fail("timeline-milestones must render the three timeline sub-blocks")
    print(f"OK: {path} ({len(rendered_core)} v2.91 core slots rendered)")


if __name__ == "__main__":
    main()
