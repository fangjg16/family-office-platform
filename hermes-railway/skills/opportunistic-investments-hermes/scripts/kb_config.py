#!/usr/bin/env python3
"""Parse and update v2.91 KB-CONFIG blocks."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

SCHEMA_VERSION = "2.91"

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

APPENDICES = ["source-index", "glossary", "data-dictionary", "version-ledger"]

CONFIG_RE = re.compile(r"<!--\s*KB-CONFIG\s*(.*?)\s*-->", re.S)


@dataclass
class KbConfig:
    display_order: list[str]
    schema_version: str = SCHEMA_VERSION
    project_type: str = "unknown"
    rendering_mode: str = "chinese-only"
    multi_asset: str = "false"
    config_version: int = 1
    parent_version: str = "none"
    generated_at: str = ""
    history: list[str] = field(default_factory=list)


def parse_config(html: str) -> KbConfig:
    match = CONFIG_RE.search(html)
    if not match:
        raise ValueError("KB-CONFIG block not found")
    fields: dict[str, str] = {}
    history: list[str] = []
    in_history = False
    for raw in match.group(1).splitlines():
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
            key, value = line.split(":", 1)
            fields[key.strip()] = value.strip()
    order = [x.strip() for x in fields.get("display-order", "").split(",") if x.strip()]
    bad = [x for x in order if x not in CANONICAL]
    if bad:
        raise ValueError(f"unknown slot keys in display-order: {bad}")
    return KbConfig(
        display_order=order,
        schema_version=fields.get("schema-version", SCHEMA_VERSION),
        project_type=fields.get("project-type", "unknown"),
        rendering_mode=fields.get("rendering-mode", "chinese-only"),
        multi_asset=fields.get("multi-asset", "false"),
        config_version=int(fields.get("config-version", "1") or "1"),
        parent_version=fields.get("parent-version", "none"),
        generated_at=fields.get("generated-at", ""),
        history=history,
    )


def format_config(cfg: KbConfig) -> str:
    history = "\n".join(f"  {x}" for x in cfg.history) if cfg.history else "  (none)"
    return """<!-- KB-CONFIG
schema-version: {schema_version}
display-order: {order}
project-type: {project_type}
rendering-mode: {rendering_mode}
multi-asset: {multi_asset}
config-version: {version}
parent-version: {parent_version}
generated-at: {generated_at}
display-order-history:
{history}
-->""".format(
        schema_version=cfg.schema_version,
        order=", ".join(cfg.display_order),
        project_type=cfg.project_type,
        rendering_mode=cfg.rendering_mode,
        multi_asset=cfg.multi_asset,
        version=cfg.config_version,
        parent_version=cfg.parent_version,
        generated_at=cfg.generated_at,
        history=history,
    )


def replace_config(html: str, cfg: KbConfig) -> str:
    if not CONFIG_RE.search(html):
        raise ValueError("KB-CONFIG block not found")
    return CONFIG_RE.sub(format_config(cfg), html, count=1)


def load(path: str | Path) -> tuple[str, KbConfig]:
    html = Path(path).read_text(encoding="utf-8-sig")
    return html, parse_config(html)
