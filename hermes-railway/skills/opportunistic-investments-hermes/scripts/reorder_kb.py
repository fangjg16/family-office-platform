#!/usr/bin/env python3
"""Reorder v2.91 KB display order without editing content panels.

Usage:
  python reorder_kb.py input.html output.html --order snapshot,target-overview,... --reason "user request"
"""
from __future__ import annotations

import argparse
import re
from datetime import date
from pathlib import Path
from kb_config import APPENDICES, CANONICAL, load, replace_config

NUMERALS = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二", "十三"]

NAV_RE = re.compile(r"<li>\s*<button class=\"kb-nav-btn(?P<active> active)?\" data-target=\"(?P<target>[^\"]+)\">.*?</button>\s*</li>", re.S)
SECTION_RE = re.compile(r"(<section class=\"block kb-panel[^\"]*\" id=\"(?P<id>[^\"]+)\".*?>.*?<span class=\"section-num\">)(.*?)(</span>)", re.S)


def reorder_nav(html: str, order: list[str]) -> str:
    allowed = {"overview", *CANONICAL, *APPENDICES}
    items = {m.group("target"): m.group(0) for m in NAV_RE.finditer(html) if m.group("target") in allowed}
    if "overview" not in items:
        raise ValueError("overview nav item not found")
    rendered = [items["overview"]]
    for index, key in enumerate(order):
        if key in items:
            rendered.append(re.sub(r'(<span class="kb-nav-num">).*?(</span>)', rf"\g<1>{NUMERALS[index]}\2", items[key], count=1, flags=re.S))
    for key in APPENDICES:
        if key in items:
            rendered.append(items[key])
    nav_block_re = re.compile(r"(<nav class=\"kb-nav\"[\s\S]*?<ul>)([\s\S]*?)(</ul>)", re.S)
    return nav_block_re.sub(lambda m: m.group(1) + "\n" + "\n".join(rendered) + "\n" + m.group(3), html, count=1)


def renumber_sections(html: str, order: list[str]) -> str:
    number_for = {key: NUMERALS[i] for i, key in enumerate(order)}

    def repl(match: re.Match[str]) -> str:
        key = match.group("id")
        if key not in number_for:
            return match.group(0)
        return match.group(1) + number_for[key] + match.group(4)

    return SECTION_RE.sub(repl, html)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input")
    parser.add_argument("output")
    parser.add_argument("--order", required=True, help="comma-separated canonical v2.91 slot keys")
    parser.add_argument("--reason", default="用户调整展示顺序")
    args = parser.parse_args()

    new_order = [x.strip() for x in args.order.split(",") if x.strip()]
    bad = [x for x in new_order if x not in CANONICAL]
    if bad:
        raise SystemExit(f"Unknown slot keys: {bad}")
    if sorted(new_order) != sorted(CANONICAL):
        raise SystemExit("Order must contain all 13 v2.91 canonical slots exactly once")

    html, cfg = load(args.input)
    before_len = len(html)
    cfg.display_order = new_order
    cfg.config_version += 1
    cfg.history.append(f"{date.today().isoformat()} | reorder | {args.reason}")
    out = replace_config(html, cfg)
    out = reorder_nav(out, new_order)
    out = renumber_sections(out, new_order)
    drift = abs(len(out) - before_len) / max(before_len, 1)
    if drift > 0.08:
        raise SystemExit(f"Refusing reorder: output length drift {drift:.1%} exceeds 8%")
    Path(args.output).write_text(out, encoding="utf-8")
    print(f"OK: reordered {args.output}")


if __name__ == "__main__":
    main()
