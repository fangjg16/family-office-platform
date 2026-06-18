#!/usr/bin/env bash
# Railway 纯 curl 安装 Hermes v2.92 skill（opportunistic-investments-hermes）
# export HERMES_HOME=/opt/data
# export HERMES_SKILLS_DIR=/opt/data/skills
# bash install-jfo-skills-v292-curl-only.sh

set -euo pipefail

RAW="${JFO_SKILLS_RAW_BASE:-https://raw.githubusercontent.com/fangjg16/family-office-platform/main/hermes-railway}"
SKILLS_ROOT="${HERMES_SKILLS_DIR:-/opt/data/skills}"
KB="$SKILLS_ROOT/opportunistic-investments-hermes"
PKG="skills/opportunistic-investments-hermes"

echo "=== JFO skills (curl-only, Railway, Hermes v2.92) ==="
echo "RAW=$RAW"
echo "SKILLS_ROOT=$SKILLS_ROOT"
echo "KB=$KB"

mkdir -p "$SKILLS_ROOT" /opt/data/kb /opt/data/logs

curl_kb() {
  local rel="$1"
  local dest="$2"
  mkdir -p "$(dirname "$dest")"
  curl -fsSL "$RAW/$PKG/$rel" -o "$dest"
}

echo "--- opportunistic-investments-hermes (v2.92 full tree via curl) ---"
mkdir -p "$KB/assets" "$KB/references/deep" "$KB/scripts" "$KB/agents"

curl_kb "SKILL.md" "$KB/SKILL.md"
curl_kb "examples-kb-data.json" "$KB/examples-kb-data.json"
curl_kb "sample-output.html" "$KB/sample-output.html"
curl_kb "sample-output-reordered.html" "$KB/sample-output-reordered.html"
curl_kb "assets/kb-template.html" "$KB/assets/kb-template.html"
curl_kb "assets/components.html" "$KB/assets/components.html"
curl_kb "agents/openai.yaml" "$KB/agents/openai.yaml"

for ref in kb-schema.md kb-config.md content-rules.md gotchas.md handoff-schema.md \
  maturity-scoring.md slot-rendering-rules.md slot-specific-rules.md timeline-rules.md; do
  curl_kb "references/$ref" "$KB/references/$ref"
done

for deep in knowledge-base-generation.md project-intake.md public-info-search.md \
  dd-claim-audit.md compliance-check.md risk-matrix.md returns-analysis.md; do
  curl_kb "references/deep/$deep" "$KB/references/deep/$deep"
done

for script in kb_config.py merge_handoff.py render_kb_html.py reorder_kb.py validate_kb_html.py jfo_kb_put.sh; do
  curl_kb "scripts/$script" "$KB/scripts/$script"
done
chmod +x "$KB/scripts/jfo_kb_put.sh" 2>/dev/null || true

install_skill_curl() {
  local name="$1"
  echo "--- $name ---"
  mkdir -p "$SKILLS_ROOT/$name"
  curl -fsSL "$RAW/skills/$name/SKILL.md" -o "$SKILLS_ROOT/$name/SKILL.md" 2>/dev/null || true
  mkdir -p "$SKILLS_ROOT/$name/knowledge"
  curl -fsSL "$RAW/skills/$name/knowledge/README.md" -o "$SKILLS_ROOT/$name/knowledge/README.md" 2>/dev/null || true
}

install_skill_curl jfo-r2-materials

OTHER="project-intake document-reorganize public-info-search term-annotator comp-analysis \
  dd-checklist dd-claim-audit background-check risk-matrix returns-analysis \
  sensitivity-analysis value-creation-plan ic-memo gap-tracking node-monitoring"

for s in $OTHER; do
  install_skill_curl "$s"
done

# 隔离旧 v2.8 skill（避免 Ambiguous skill name 'knowledge-base-generation'）
LEGACY="$SKILLS_ROOT/knowledge-base-generation"
DEPRECATED="$SKILLS_ROOT/knowledge-base-generation_deprecated"
if [ -d "$LEGACY" ] && [ "$(basename "$LEGACY")" = "knowledge-base-generation" ]; then
  echo "Deprecating legacy knowledge-base-generation -> knowledge-base-generation_deprecated"
  rm -rf "$DEPRECATED" 2>/dev/null || true
  mv "$LEGACY" "$DEPRECATED"
  echo "DEPRECATED $(date -u +%Y-%m-%dT%H:%M:%SZ) — use opportunistic-investments-hermes (v2.92)" > "$DEPRECATED/DEPRECATED"
fi

echo ""
echo "=== Verify Hermes v2.92 required files ==="
test -f "$KB/SKILL.md"
grep -q "Hermes v2.92" "$KB/SKILL.md"
test -f "$KB/references/kb-schema.md"
grep -q "v2.91" "$KB/references/kb-schema.md"
test -f "$KB/references/maturity-scoring.md"
test -f "$KB/references/timeline-rules.md"
test -f "$KB/references/deep/knowledge-base-generation.md"
test -f "$KB/references/deep/compliance-check.md"
ls "$KB/references/deep/" | wc -l | grep -q '^7$'
test -f "$KB/scripts/jfo_kb_put.sh"
grep -q 'schema-version: 2.91' "$KB/assets/kb-template.html"
test -f "$KB/assets/kb-template.html"
grep -q revealAnchor "$KB/assets/kb-template.html"
test ! -d "$LEGACY" || echo "WARN: legacy dir still at $LEGACY (expected deprecated)"
echo "OK: Hermes v2.92 skill layout verified at $KB"
