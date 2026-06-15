#!/usr/bin/env python3
"""Merge a v2.8 JSON handoff into a structured KB JSON file.

Usage:
  python merge_handoff.py kb-data.json handoff.json out.json
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

CANONICAL = {
    "snapshot", "assets", "legal-relationships", "business-model", "capital-structure",
    "comps", "returns", "timeline", "risks", "open-questions", "decision-framework",
}


def main() -> None:
    if len(sys.argv) != 4:
        print(__doc__.strip())
        raise SystemExit(2)
    kb_path, handoff_path, out_path = map(Path, sys.argv[1:])
    kb = json.loads(kb_path.read_text(encoding="utf-8-sig"))
    handoff = json.loads(handoff_path.read_text(encoding="utf-8-sig"))
    targets = handoff.get("targetSlots", [])
    if not targets or any(t not in CANONICAL for t in targets):
        raise SystemExit(f"Invalid targetSlots: {targets}")
    findings = handoff.get("findings", {})
    kb.setdefault("slots", {})
    for slot in targets:
        if slot not in findings:
            continue
        incoming = findings[slot]
        mode = handoff.get("updateMode", "merge")
        if mode == "replace" or slot not in kb["slots"]:
            kb["slots"][slot] = incoming
        elif mode == "merge":
            current = kb["slots"].setdefault(slot, {})
            current.update(incoming)
        else:
            raise SystemExit(f"Invalid updateMode: {mode}")
    existing_source_ids = {s.get("id") for s in kb.setdefault("sources", [])}
    for src in handoff.get("newSources", []):
        sid = src.get("id")
        if sid and sid not in existing_source_ids:
            kb["sources"].append(src)
            existing_source_ids.add(sid)
    terms = set(kb.setdefault("terms", []))
    for term in handoff.get("newTerms", []):
        if term not in terms:
            kb["terms"].append(term)
            terms.add(term)
    kb.setdefault("changelog", []).append({
        "fromSkill": handoff.get("fromSkill", "unknown"),
        "targetSlots": targets,
        "versionBump": handoff.get("versionBump", "minor"),
    })
    out_path.write_text(json.dumps(kb, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"OK: wrote {out_path}")


if __name__ == "__main__":
    main()
