#!/usr/bin/env python3
"""Merge a v2.91 JSON handoff into a structured KB JSON file.

Usage:
  python merge_handoff.py kb-data.json handoff.json out.json
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

CANONICAL = {
    "snapshot",
    "target-overview",
    "resource-network",
    "industry-market",
    "business-operations",
    "legal-ownership",
    "regulatory-compliance",
    "comps-benchmark",
    "valuation-returns",
    "diligence-gaps",
    "risks-mitigation",
    "timeline-milestones",
    "decision-framework",
}

LEGACY_MAP = {
    "assets": "target-overview",
    "legal-relationships": "legal-ownership",
    "business-model": "business-operations",
    "capital-structure": "valuation-returns",
    "comps": "comps-benchmark",
    "returns": "valuation-returns",
    "timeline": "timeline-milestones",
    "risks": "risks-mitigation",
    "open-questions": "diligence-gaps",
}


def normalize_slot(slot: str) -> str:
    return LEGACY_MAP.get(slot, slot)


def merge_dict(current: dict[str, Any], incoming: dict[str, Any]) -> dict[str, Any]:
    for key, value in incoming.items():
        if isinstance(value, list) and isinstance(current.get(key), list):
            current[key].extend(value)
        elif isinstance(value, dict) and isinstance(current.get(key), dict):
            merge_dict(current[key], value)
        else:
            current[key] = value
    return current


def term_key(term: Any) -> str:
    if isinstance(term, dict):
        return str(term.get("term") or term.get("name") or term)
    return str(term)


def main() -> None:
    if len(sys.argv) != 4:
        print(__doc__.strip())
        raise SystemExit(2)
    kb_path, handoff_path, out_path = map(Path, sys.argv[1:])
    kb = json.loads(kb_path.read_text(encoding="utf-8-sig"))
    handoff = json.loads(handoff_path.read_text(encoding="utf-8-sig"))

    targets = [normalize_slot(x) for x in handoff.get("targetSlots", handoff.get("target-slots", []))]
    if not targets or any(t not in CANONICAL for t in targets):
        raise SystemExit(f"Invalid targetSlots: {targets}")

    raw_findings = handoff.get("findings", {})
    findings = {normalize_slot(key): value for key, value in raw_findings.items()}
    mode = handoff.get("updateMode", handoff.get("update-mode", "merge"))
    kb.setdefault("slots", {})
    for slot in targets:
        if slot not in findings:
            continue
        incoming = findings[slot]
        if mode == "replace" or slot not in kb["slots"]:
            kb["slots"][slot] = incoming
        elif mode == "merge":
            current = kb["slots"].setdefault(slot, {})
            if isinstance(current, dict) and isinstance(incoming, dict):
                merge_dict(current, incoming)
            else:
                kb["slots"][slot] = incoming
        else:
            raise SystemExit(f"Invalid updateMode: {mode}")

    existing_source_ids = {src.get("id") for src in kb.setdefault("sources", []) if isinstance(src, dict)}
    for src in handoff.get("newSources", handoff.get("new-sources", [])):
        sid = src.get("id") if isinstance(src, dict) else None
        if sid and sid not in existing_source_ids:
            kb["sources"].append(src)
            existing_source_ids.add(sid)

    existing_terms = {term_key(term) for term in kb.setdefault("terms", [])}
    for term in handoff.get("newTerms", handoff.get("new-terms", [])):
        key = term_key(term)
        if key not in existing_terms:
            kb["terms"].append(term)
            existing_terms.add(key)

    data_dictionary = handoff.get("dataDictionary", handoff.get("data-dictionary", []))
    if data_dictionary:
        kb.setdefault("dataDictionary", []).extend(data_dictionary if isinstance(data_dictionary, list) else [data_dictionary])

    kb.setdefault("versionLedger", []).append(
        {
            "version": handoff.get("version", ""),
            "time": handoff.get("time", ""),
            "parent": handoff.get("parentVersion", handoff.get("parent-version", "")),
            "source": handoff.get("fromSkill", handoff.get("from-skill", "unknown")),
            "change": "Merged handoff into " + ", ".join(targets),
        }
    )
    out_path.write_text(json.dumps(kb, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"OK: wrote {out_path}")


if __name__ == "__main__":
    main()
