#!/usr/bin/env bash
# JFO 知识网络 PUT — 固定 curl 模板（禁止 Agent 自行拼 curl/python）
# 依赖环境变量 JFO_INTERNAL_KEY
set -euo pipefail

FILE=""
API_BASE=""
PROJECT_ID=""
USER_ID=""
JOB_ID=""
MODE="full"

usage() {
  echo "Usage: jfo_kb_put.sh --file PATH --api-base URL --project-id ID --user-id UID --job-id JID [--mode full|initial|incremental|reorder]" >&2
  exit 2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --file) FILE="$2"; shift 2 ;;
    --api-base) API_BASE="$2"; shift 2 ;;
    --project-id) PROJECT_ID="$2"; shift 2 ;;
    --user-id) USER_ID="$2"; shift 2 ;;
    --job-id) JOB_ID="$2"; shift 2 ;;
    --mode) MODE="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "Unknown arg: $1" >&2; usage ;;
  esac
done

[[ -n "$FILE" && -n "$API_BASE" && -n "$PROJECT_ID" && -n "$USER_ID" && -n "$JOB_ID" ]] || usage
[[ -f "$FILE" ]] || { echo "PRE-PUT FAIL: file not found: $FILE" >&2; exit 1; }
: "${JFO_INTERNAL_KEY:?JFO_INTERNAL_KEY not set}"

if ! grep -qE 'schema-version:[[:space:]]*2\.91' "$FILE"; then
  echo "PRE-PUT FAIL: KB-CONFIG comment must contain line: schema-version: 2.91" >&2
  echo "Copy the <!-- KB-CONFIG ... --> block from assets/kb-template.html (line-oriented, not JSON)." >&2
  exit 1
fi

ENC_PROJECT=$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=""))' "$PROJECT_ID")
ENC_USER=$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=""))' "$USER_ID")
ENC_JOB=$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=""))' "$JOB_ID")
ENC_MODE=$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=""))' "$MODE")

URL="${API_BASE%/}/api/hermes/projects/${ENC_PROJECT}/knowledge-network/current?userId=${ENC_USER}&jobId=${ENC_JOB}&mode=${ENC_MODE}&changelog=hermes-file-put"

HTTP_CODE=$(curl -sS -w '%{http_code}' -o /tmp/jfo_kb_put_resp.json \
  -X PUT \
  -H "Authorization: Bearer ${JFO_INTERNAL_KEY}" \
  -H "Content-Type: text/html; charset=utf-8" \
  --data-binary @"${FILE}" \
  "${URL}")

cat /tmp/jfo_kb_put_resp.json
echo ""

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "PUT FAILED: HTTP ${HTTP_CODE}" >&2
  exit 1
fi

if ! grep -q '"ok"[[:space:]]*:[[:space:]]*true' /tmp/jfo_kb_put_resp.json 2>/dev/null; then
  echo "PUT FAILED: response missing ok:true" >&2
  exit 1
fi

echo "PUT OK"
