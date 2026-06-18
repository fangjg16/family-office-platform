#!/usr/bin/env python3
"""Poll Hermes Gateway run status (Railway SSH: RUN_ID=run_xxx python3 poll-run.py)."""
import json
import os
import urllib.request

run_id = os.environ.get("RUN_ID", "")
if not run_id:
    raise SystemExit("Set RUN_ID env var")
key = os.environ["API_SERVER_KEY"]
url = f"http://127.0.0.1:8642/v1/runs/{run_id}"
req = urllib.request.Request(url, headers={"Authorization": f"Bearer {key}"})
with urllib.request.urlopen(req, timeout=30) as resp:
    d = json.loads(resp.read())
out = str(d.get("output") or d.get("result") or "")
print("status:", d.get("status"))
print("error:", d.get("error"))
for k in ("created_at", "started_at", "completed_at", "updated_at"):
    if d.get(k):
        print(f"{k}:", d[k])
print("output_len:", len(out))
print("has_html_fence:", "```html" in out.lower())
print("has_put_ok:", "ok: true" in out.lower() or "KB-PUT-OK" in out)
meta = d.get("metadata") or {}
if meta:
    print("metadata:", json.dumps(meta)[:500])
for key in ("tool_calls", "steps", "messages", "events"):
    v = d.get(key)
    if isinstance(v, list):
        print(f"{key}_count:", len(v))
        break
print("keys:", sorted(d.keys()))
