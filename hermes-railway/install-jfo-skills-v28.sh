#!/usr/bin/env bash
# 合域 v2.8 KB + jfo-r2-materials → Railway Hermes（knowledge-base-generation 整目录）
# 用法：bash install-jfo-skills-v28.sh
# Pin: export JFO_SKILLS_RAW_BASE="https://raw.githubusercontent.com/fangjg16/family-office-platform/<sha>/hermes-railway"

set -euo pipefail

RAW="${JFO_SKILLS_RAW_BASE:-https://raw.githubusercontent.com/fangjg16/family-office-platform/main/hermes-railway}"
SKILLS_ROOT="${HERMES_SKILLS_DIR:-$HOME/.hermes/skills}"
KB="$SKILLS_ROOT/knowledge-base-generation"

echo "=== JFO Hermes skills install (v2.8 KB layout) ==="
echo "RAW=$RAW"
echo "SKILLS_ROOT=$SKILLS_ROOT"

uninstall_skill_quiet() {
  local name="$1"
  if [ -t 0 ]; then
    hermes skills uninstall "$name" 2>/dev/null || true
  else
    yes | hermes skills uninstall "$name" 2>/dev/null || true
  fi
}

install_skill_md() {
  local name="$1"
  echo "--- $name (SKILL.md) ---"
  uninstall_skill_quiet "$name"
  hermes skills install "$RAW/skills/$name/SKILL.md" --name "$name" || {
    echo "WARN: hermes install failed for $name, trying curl fallback"
    mkdir -p "$SKILLS_ROOT/$name"
    curl -fsSL "$RAW/skills/$name/SKILL.md" -o "$SKILLS_ROOT/$name/SKILL.md"
  }
}

curl_kb_file() {
  local rel="$1"
  local dest="$2"
  mkdir -p "$(dirname "$dest")"
  curl -fsSL "$RAW/skills/knowledge-base-generation/$rel" -o "$dest"
}

echo "--- knowledge-base-generation (full v2.8 directory) ---"
uninstall_skill_quiet knowledge-base-generation
if hermes skills install "$RAW/skills/knowledge-base-generation" --name knowledge-base-generation 2>/dev/null; then
  echo "OK: hermes directory install"
else
  echo "Fallback: curl manual v2.8 layout"
  mkdir -p "$KB/assets" "$KB/references" "$KB/scripts" "$KB/examples" "$KB/knowledge"
  curl_kb_file "SKILL.md" "$KB/SKILL.md"
  curl_kb_file "examples-kb-data.json" "$KB/examples-kb-data.json"
  curl_kb_file "assets/kb-template.html" "$KB/assets/kb-template.html"
  curl_kb_file "assets/components.html" "$KB/assets/components.html"
  for ref in kb-schema.md kb-config.md content-rules.md slot-specific-rules.md slot-rendering-rules.md timeline-rules.md maturity-scoring.md visual-style-guide.md handoff-schema.md; do
    curl_kb_file "references/$ref" "$KB/references/$ref"
  done
  curl_kb_file "examples/sample-output.html" "$KB/examples/sample-output.html" 2>/dev/null || true
  curl_kb_file "examples/sample-output-reordered.html" "$KB/examples/sample-output-reordered.html" 2>/dev/null || true
fi

# 根目录 kb-template 仅 deprecated 占位；运行时入口为 assets/kb-template.html
if [ ! -f "$KB/assets/kb-template.html" ]; then
  echo "ERROR: missing $KB/assets/kb-template.html"
  exit 1
fi

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
echo "=== Verify knowledge-base-generation (v2.8 required files) ==="
test -f "$KB/SKILL.md"
test -f "$KB/references/kb-schema.md"
test -f "$KB/references/kb-config.md"
test -f "$KB/references/slot-specific-rules.md"
test -f "$KB/references/slot-rendering-rules.md"
test -f "$KB/references/timeline-rules.md"
test -f "$KB/assets/kb-template.html"
test -f "$KB/assets/components.html"
grep -q revealAnchor "$KB/assets/kb-template.html"
echo "OK: all v2.8 required files present"
ls -la "$KB/references" "$KB/assets"

echo ""
echo "=== Installed skills ==="
hermes skills list 2>/dev/null | grep -E 'jfo-r2|project-intake|knowledge-base' || hermes skills list

echo ""
echo "Done. Restart Hermes Gateway; paste SOUL from hermes-railway/SOUL-JFO-KB.md"
