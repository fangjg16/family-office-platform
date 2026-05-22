---
name: jfo-r2-materials
description: "Fetch project materials uploaded on the 联合家办 GitHub Pages platform (Cloudflare R2 via Worker). Use BEFORE project-intake, public-info-search, dd-checklist, or any skill that needs to read user-uploaded PDFs. Triggers on \"网站上传的资料\", \"JFO platform\", \"projectId nn-fresh-port\", \"拉取项目资料包\", \"manifest\", \"Cloudflare 资料\", or when user asks intake/research on a platform project."
version: 1.0.0
metadata:
  hermes:
    tags: [family-office, jfo, r2, materials]
    category: integration
---

# JFO Platform · R2 Materials Bridge

Website uploads live in **Cloudflare R2 + D1**, not in your local project folder.  
You must pull them through the Worker API before any intake or document-reading skill.

## Required environment

| Variable | Example |
|----------|---------|
| `JFO_API_PUBLIC_BASE` | `https://jfo-api.jfo-api.workers.dev` |
| `JFO_INTERNAL_KEY` | same as Worker secret `JFO_INTERNAL_KEY` |
| `JFO_DEFAULT_USER_ID` | `jensen-fang` (uploader account id on the website) |

## Step 1 — Resolve projectId (and userId only for session)

From the user message, extract:

- **projectId** — e.g. `nn-fresh-port` (南宁生鲜港)
- **userId** — only required for `scope=session` or `scope=all`; default `JFO_DEFAULT_USER_ID`

**项目资料包（scope=package）按项目共享**，全组成员看到同一份文件，**不要**要求「谁上传就必须带谁的 userId」。

## Step 2 — Fetch manifest

```http
GET {JFO_API_PUBLIC_BASE}/api/hermes/projects/{projectId}/manifest?scope=package
Authorization: Bearer {JFO_INTERNAL_KEY}
```

（可选：`userId` 仅当同时拉取某人的对话临时文件时使用 `scope=all`。）

Parse JSON field `files[]`. If empty, tell the user to upload **项目资料包** on the website (any team member with upload permission).

## Step 3 — Fetch each file body

For every file where `parsed` is true (or always try):

```http
GET {textUrl from manifest}
Authorization: Bearer {JFO_INTERNAL_KEY}
```

Use returned `text` as the authoritative document content (same text the website chat uses).

For `parsed: false`, note filename and ask user to re-upload as .txt/.md or text-based PDF.

## Step 4 — Hand off to other skills

After all texts are in context:

1. Run **project-intake** (if no KB yet) or **knowledge-base-generation** (update).
2. Do **not** claim you cannot access files — you already loaded them via this bridge.
3. Do **not** read PDFs only from `~/Projects/...` unless user explicitly added local copies.

## Optional: curl one-liner (terminal tool)

```bash
curl -s -H "Authorization: Bearer $JFO_INTERNAL_KEY" \
  "$JFO_API_PUBLIC_BASE/api/hermes/projects/nn-fresh-port/manifest?scope=package"
```

## Errors

| HTTP | Meaning |
|------|---------|
| 401 | `JFO_INTERNAL_KEY` mismatch — fix Railway/Worker secrets |
| 404 | Wrong projectId/documentId or userId |
| empty files | No package uploads for that user on the website |
