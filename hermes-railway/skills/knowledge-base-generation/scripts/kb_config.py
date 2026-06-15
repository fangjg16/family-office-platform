#!/usr/bin/env python3
"""Parse and update KB-CONFIG blocks."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
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

CONFIG_RE = re.compile(r"<!--\s*KB-CONFIG\s*(.*?)\s*-->", re.S)

@dataclass
class KbConfig:
    display_order: list[str]
    project_type: str = "unknown"
    rendering_mode: str = "chinese-only"
    multi_asset: str = "false"
    config_version: int = 1
    history: list[str] = field(default_factory=list)


def parse_config(html: str) -> KbConfig:
    m = CONFIG_RE.search(html)
    if not m:
        raise ValueError("KB-CONFIG block not found")
    body = m.group(1)
    fields: dict[str, str] = {}
    history: list[str] = []
    in_history = False
    for raw in body.splitlines():
        line = raw.rstrip()
        if not line.strip():
            continue
        if line.strip() == "display-order-history:":
            in_history = True
            continue
        if in_history:
            history.append(line.strip())
            continue
        if ":" in line:
            k, v = line.split(":", 1)
            fields[k.strip()] = v.strip()
    order = [x.strip() for x in fields.get("display-order", "").split(",") if x.strip()]
    bad = [x for x in order if x not in CANONICAL]
    if bad:
        raise ValueError(f"unknown slot keys in display-order: {bad}")
    return KbConfig(
        display_order=order,
        project_type=fields.get("project-type", "unknown"),
        rendering_mode=fields.get("rendering-mode", "chinese-only"),
        multi_asset=fields.get("multi-asset", "false"),
        config_version=int(fields.get("config-version", "1") or "1"),
        history=history,
    )


def format_config(cfg: KbConfig) -> str:
    history = "\n".join(f"  {x}" for x in cfg.history) if cfg.history else "  (none)"
    return """<!-- KB-CONFIG
display-order: {order}
project-type: {project_type}
rendering-mode: {rendering_mode}
multi-asset: {multi_asset}
config-version: {version}
display-order-history:
{history}
-->""".format(
        order=", ".join(cfg.display_order),
        project_type=cfg.project_type,
        rendering_mode=cfg.rendering_mode,
        multi_asset=cfg.multi_asset,
        version=cfg.config_version,
        history=history,
    )


def replace_config(html: str, cfg: KbConfig) -> str:
    if not CONFIG_RE.search(html):
        raise ValueError("KB-CONFIG block not found")
    return CONFIG_RE.sub(format_config(cfg), html, count=1)


def load(path: str | Path) -> tuple[str, KbConfig]:
    html = Path(path).read_text(encoding="utf-8-sig")
    return html, parse_config(html)
