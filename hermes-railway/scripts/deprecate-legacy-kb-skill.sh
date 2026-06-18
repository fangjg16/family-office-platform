#!/usr/bin/env bash
# 一次性：将 legacy knowledge-base-generation 迁出 skills 扫描路径
set -euo pipefail
SKILLS_ROOT="${HERMES_SKILLS_DIR:-/opt/data/skills}"
LEGACY="$SKILLS_ROOT/knowledge-base-generation"
DEPRECATED="$SKILLS_ROOT/knowledge-base-generation_deprecated"
if [ -d "$LEGACY" ]; then
  echo "Moving $LEGACY -> $DEPRECATED"
  rm -rf "$DEPRECATED" 2>/dev/null || true
  mv "$LEGACY" "$DEPRECATED"
  echo "DEPRECATED $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$DEPRECATED/DEPRECATED"
  echo "OK: legacy skill deprecated"
else
  echo "OK: no legacy dir at $LEGACY"
fi
ls -la "$SKILLS_ROOT" | grep -E 'knowledge-base|opportunistic' || true
