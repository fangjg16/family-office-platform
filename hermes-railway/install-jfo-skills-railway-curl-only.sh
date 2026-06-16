#!/usr/bin/env bash
# Railway 纯 curl 安装 v2.8（不走 hermes skills install 交互）
# export HERMES_HOME=/opt/data
# export HERMES_SKILLS_DIR=/opt/data/skills   # Hermes Gateway 实际读取路径（非 .hermes/skills）
# bash install-jfo-skills-railway-curl-only.sh

set -euo pipefail

RAW="${JFO_SKILLS_RAW_BASE:-https://raw.githubusercontent.com/fangjg16/family-office-platform/main/hermes-railway}"
SKILLS_ROOT="${HERMES_SKILLS_DIR:-/opt/data/skills}"
KB="$SKILLS_ROOT/knowledge-base-generation"

echo "=== JFO skills (curl-only, Railway, v2.8) ==="
echo "RAW=$RAW"
echo "SKILLS_ROOT=$SKILLS_ROOT"

mkdir -p "$SKILLS_ROOT" /opt/data/kb /opt/data/logs

curl_kb() {
  local rel="$1"
  local dest="$2"
  mkdir -p "$(dirname "$dest")"
  curl -fsSL "$RAW/skills/knowledge-base-generation/$rel" -o "$dest"
}

echo "--- knowledge-base-generation (full v2.8 via curl) ---"
mkdir -p "$KB/assets" "$KB/references" "$KB/scripts" "$KB/examples" "$KB/knowledge"
curl_kb "SKILL.md" "$KB/SKILL.md"
curl_kb "examples-kb-data.json" "$KB/examples-kb-data.json"
curl_kb "assets/kb-template.html" "$KB/assets/kb-template.html"
curl_kb "assets/components.html" "$KB/assets/components.html"
for ref in kb-schema.md kb-config.md content-rules.md slot-specific-rules.md slot-rendering-rules.md timeline-rules.md maturity-scoring.md visual-style-guide.md handoff-schema.md; do
  curl_kb "references/$ref" "$KB/references/$ref"
done
curl_kb "kb-template.html" "$KB/kb-template.html" 2>/dev/null || true
curl_kb "knowledge/README.md" "$KB/knowledge/README.md" 2>/dev/null || true
curl_kb "examples/sample-output.html" "$KB/examples/sample-output.html" 2>/dev/null || true
curl_kb "examples/sample-output-reordered.html" "$KB/examples/sample-output-reordered.html" 2>/dev/null || true

install_skill_curl() {
  local name="$1"
  echo "--- $name ---"
  mkdir -p "$SKILLS_ROOT/$name"
  curl -fsSL "$RAW/skills/$name/SKILL.md" -o "$SKILLS_ROOT/$name/SKILL.md"
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

echo ""
echo "=== Verify v2.8 required files ==="
test -f "$KB/SKILL.md"
test -f "$KB/references/kb-schema.md"
test -f "$KB/references/slot-specific-rules.md"
test -f "$KB/references/maturity-scoring.md"
test -f "$KB/references/timeline-rules.md"
test -f "$KB/assets/kb-template.html"
test -f "$KB/assets/components.html"
grep -q revealAnchor "$KB/assets/kb-template.html"
echo "OK: v2.8 KB skill layout verified"
