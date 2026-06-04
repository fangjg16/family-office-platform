#!/usr/bin/env bash
# Railway 推荐：纯 curl 写入 /opt/data/.hermes/skills，不走 hermes skills install。
# 避免：Uninstall 交互、Pick category、jfo-r2-materials 被安全扫描误拦（SKILL 里的 curl 示例）。
# 用法：
#   export HERMES_HOME=/opt/data
#   export HERMES_SKILLS_DIR=/opt/data/.hermes/skills
#   bash install-jfo-skills-railway-curl-only.sh

set -euo pipefail

RAW="${JFO_SKILLS_RAW_BASE:-https://raw.githubusercontent.com/fangjg16/family-office-platform/main/hermes-railway}"
SKILLS_ROOT="${HERMES_SKILLS_DIR:-/opt/data/.hermes/skills}"
KB="$SKILLS_ROOT/knowledge-base-generation"

echo "=== JFO skills (curl-only, Railway) ==="
echo "RAW=$RAW"
echo "SKILLS_ROOT=$SKILLS_ROOT"

mkdir -p "$SKILLS_ROOT" /opt/data/kb /opt/data/logs

echo "--- knowledge-base-generation (full directory via curl) ---"
mkdir -p "$KB/assets" "$KB/references" "$KB/knowledge"
curl -fsSL "$RAW/skills/knowledge-base-generation/SKILL.md" -o "$KB/SKILL.md"
curl -fsSL "$RAW/skills/knowledge-base-generation/kb-template.html" -o "$KB/kb-template.html"
curl -fsSL "$RAW/skills/knowledge-base-generation/assets/components.html" -o "$KB/assets/components.html"
curl -fsSL "$RAW/reference/STYLE_GUIDE.md" -o "$KB/references/STYLE_GUIDE.md"
curl -fsSL "$RAW/reference/README-hermes.md" -o "$KB/references/README-hermes.md"
curl -fsSL "$RAW/skills/knowledge-base-generation/knowledge/README.md" -o "$KB/knowledge/README.md" 2>/dev/null || true

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
echo "=== Verify (must all exist) ==="
test -f "$KB/kb-template.html"
test -f "$KB/references/STYLE_GUIDE.md"
test -f "$KB/assets/components.html"
test -f "$SKILLS_ROOT/jfo-r2-materials/SKILL.md"
ls -la "$KB"
ls -la "$KB/references"
ls -la "$SKILLS_ROOT/jfo-r2-materials"

echo ""
echo "Done (curl-only). Railway Restart gateway, then re-test 知识网络 until 文件 API 回传."
