# 将本地 opportunistic-investments-hermes 同步到 Railway Hermes（未 push 到 GitHub 时用）
# 用法（在 family-office-platform 根目录）:
#   powershell -ExecutionPolicy Bypass -File hermes-railway/sync-opportunistic-skill-railway.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$SkillSrc = Join-Path $Root "hermes-railway/skills/opportunistic-investments-hermes"
$Tar = "C:\tmp\oih-skill.tgz"

if (-not (Test-Path "C:\tmp")) { New-Item -ItemType Directory -Path "C:\tmp" | Out-Null }

if (-not (Test-Path $SkillSrc)) {
  throw "Skill 目录不存在: $SkillSrc"
}

Write-Host "=== 打包本地 skill ==="
Push-Location (Join-Path $Root "hermes-railway/skills")
try {
  & tar -czf $Tar "opportunistic-investments-hermes"
} finally {
  Pop-Location
}
$bytes = [IO.File]::ReadAllBytes($Tar)
$b64Text = [Convert]::ToBase64String($bytes)
Write-Host " tarball: $([math]::Round($bytes.Length/1KB, 1)) KB -> base64 $([math]::Round($b64Text.Length/1KB, 1)) KB"

Write-Host "=== 上传到 Railway hermes-agent:/opt/data/skills ==="
$remote = 'set -euo pipefail; export HERMES_SKILLS_DIR=/opt/data/skills; mkdir -p "$HERMES_SKILLS_DIR" /opt/data/kb /opt/data/logs; base64 -d | tar -xzf - -C "$HERMES_SKILLS_DIR"; KB="$HERMES_SKILLS_DIR/opportunistic-investments-hermes"; LEGACY="$HERMES_SKILLS_DIR/knowledge-base-generation"; DEPRECATED="$HERMES_SKILLS_DIR/knowledge-base-generation_deprecated"; if [ -d "$LEGACY" ] && [ "$(basename "$LEGACY")" = knowledge-base-generation ]; then rm -rf "$DEPRECATED" 2>/dev/null || true; mv "$LEGACY" "$DEPRECATED"; echo "DEPRECATED $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$DEPRECATED/DEPRECATED"; fi; test -f "$KB/SKILL.md"; test -f "$KB/references/kb-fragment-batch-schema.md"; grep -q "JSON escaping" "$KB/references/kb-fragment-batch-schema.md"; test -f "$KB/examples-kb-fragment-batch-risks-diligence.json"; grep -q "details class=\"oq-group\"" "$KB/examples-kb-fragment-batch-risks-diligence.json"; grep -q "#source-index" "$KB/assets/kb-template.html"; echo "OK: opportunistic-investments-hermes synced"; ls "$KB"/examples-kb-fragment-batch*.json'

$b64Text | railway ssh -s hermes-agent -- bash -lc $remote

Write-Host "=== 完成 ==="
Write-Host "建议: railway ssh -s hermes-agent -- curl -sS http://127.0.0.1:8642/health"
