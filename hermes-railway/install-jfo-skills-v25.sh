#!/usr/bin/env bash
# 合域 v2.5 + jfo-r2-materials → Railway Hermes（整目录安装 KB，其余 skill 含 knowledge/）
# 用法：bash install-jfo-skills-v25.sh
# 前置：git push 后 Raw 可访问；容器内已安装 hermes CLI

set -euo pipefail

RAW="${JFO_SKILLS_RAW_BASE:-https://raw.githubusercontent.com/fangjg16/family-office-platform/main/hermes-railway}"
SKILLS_ROOT="${HERMES_SKILLS_DIR:-$HOME/.hermes/skills}"
KB="$SKILLS_ROOT/knowledge-base-generation"

echo "=== JFO Hermes skills install (v2.5 layout) ==="
echo "RAW=$RAW"
echo "SKILLS_ROOT=$SKILLS_ROOT"

install_skill_md() {
  local name="$1"
  echo "--- $name (SKILL.md) ---"
  hermes skills uninstall "$name" 2>/dev/null || true
  hermes skills install "$RAW/skills/$name/SKILL.md" --name "$name" || {
    echo "WARN: hermes install failed for $name, trying curl fallback"
    mkdir -p "$SKILLS_ROOT/$name"
    curl -fsSL "$RAW/skills/$name/SKILL.md" -o "$SKILLS_ROOT/$name/SKILL.md"
  }
}

# --- knowledge-base-generation：整目录（模板 + assets + references）---
echo "--- knowledge-base-generation (full directory) ---"
hermes skills uninstall knowledge-base-generation 2>/dev/null || true
if hermes skills install "$RAW/skills/knowledge-base-generation" --name knowledge-base-generation 2>/dev/null; then
  echo "OK: hermes directory install"
else
  echo "Fallback: curl manual layout"
  mkdir -p "$KB/assets" "$KB/references" "$KB/knowledge"
  curl -fsSL "$RAW/skills/knowledge-base-generation/SKILL.md" -o "$KB/SKILL.md"
  curl -fsSL "$RAW/skills/knowledge-base-generation/kb-template.html" -o "$KB/kb-template.html"
  curl -fsSL "$RAW/skills/knowledge-base-generation/assets/components.html" -o "$KB/assets/components.html"
  curl -fsSL "$RAW/reference/STYLE_GUIDE.md" -o "$KB/references/STYLE_GUIDE.md"
  curl -fsSL "$RAW/reference/README-hermes.md" -o "$KB/references/README-hermes.md"
  curl -fsSL "$RAW/skills/knowledge-base-generation/knowledge/README.md" -o "$KB/knowledge/README.md" 2>/dev/null || true
fi

# 确保 references 存在（directory install 可能未含 reference 根文件）
mkdir -p "$KB/references"
if [ ! -f "$KB/references/STYLE_GUIDE.md" ]; then
  curl -fsSL "$RAW/reference/STYLE_GUIDE.md" -o "$KB/references/STYLE_GUIDE.md"
fi
if [ ! -f "$KB/references/README-hermes.md" ]; then
  curl -fsSL "$RAW/reference/README-hermes.md" -o "$KB/references/README-hermes.md"
fi

# --- jfo 桥接 + 其余 15 skill ---
install_skill_md jfo-r2-materials

OTHER="project-intake document-reorganize public-info-search term-annotator comp-analysis \
  dd-checklist dd-claim-audit background-check risk-matrix returns-analysis \
  sensitivity-analysis value-creation-plan ic-memo gap-tracking node-monitoring"

for s in $OTHER; do
  install_skill_md "$s"
  mkdir -p "$SKILLS_ROOT/$s/knowledge"
  curl -fsSL "$RAW/skills/$s/knowledge/README.md" -o "$SKILLS_ROOT/$s/knowledge/README.md" 2>/dev/null || true
done

echo ""
echo "=== Verify knowledge-base-generation ==="
ls -la "$KB"
ls -la "$KB/references" 2>/dev/null || true
ls -la "$KB/assets" 2>/dev/null || true

echo ""
echo "=== Installed skills (grep) ==="
hermes skills list 2>/dev/null | grep -E 'jfo-r2|project-intake|knowledge-base' || hermes skills list

echo ""
echo "Done. Restart Hermes Gateway, then paste SOUL from hermes-railway/SOUL-JFO-KB.md"
