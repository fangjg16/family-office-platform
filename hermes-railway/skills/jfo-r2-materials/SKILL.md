---
name: jfo-r2-materials
description: "Fetch project materials uploaded on the 联合家办 GitHub Pages platform (Cloudflare R2 via Worker). Use BEFORE project-intake, public-info-search, dd-checklist, or any skill that needs to read user-uploaded PDFs. Triggers on \"网站上传的资料\", \"JFO platform\", \"projectId nn-fresh-port\", \"拉取项目资料包\", \"manifest\", \"Cloudflare 资料\", or when user asks intake/research on a platform project."
version: 1.1.0
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

## Step 1 — Resolve projectId, userId, conversationId

From the user message / Worker instructions, extract:

- **projectId** — e.g. `nn-fresh-port` (南宁生鲜港)
- **userId** — uploader account id; default `JFO_DEFAULT_USER_ID`
- **conversationId** — current dialogue id (when user uploads files **in chat**)

**Two scopes:**

| scope | Meaning | Who sees it |
|-------|---------|-------------|
| `package` | 项目资料包（项目总览上传） | 全项目共享 |
| `session` | 本对话内上传的附件 | 仅该 userId + conversationId |

**When the user just uploaded a PDF in the dialogue**, you **must** fetch `scope=session` (or `scope=all`). Do **not** only list `scope=package` — session files will be missing.

## Step 2 — Fetch manifest

**Project package only (shared):**

```http
GET {JFO_API_PUBLIC_BASE}/api/hermes/projects/{projectId}/manifest?scope=package
Authorization: Bearer {JFO_INTERNAL_KEY}
```

**Current dialogue attachments (required when user uploaded in chat):**

```http
GET {JFO_API_PUBLIC_BASE}/api/hermes/projects/{projectId}/manifest?scope=session&userId={userId}&conversationId={conversationId}
Authorization: Bearer {JFO_INTERNAL_KEY}
```

**Both package + current dialogue (recommended for deep tasks):**

```http
GET {JFO_API_PUBLIC_BASE}/api/hermes/projects/{projectId}/manifest?scope=all&userId={userId}&conversationId={conversationId}
Authorization: Bearer {JFO_INTERNAL_KEY}
```

Parse JSON field `files[]`. If empty for package, tell the user to upload **项目资料包** on the website. If session is empty but user claims they uploaded in chat, verify `userId` and `conversationId` match the Worker instructions.

## Step 3 — Fetch each file body

For every file where `parsed` is true (or always try):

```http
GET {textUrl from manifest}
Authorization: Bearer {JFO_INTERNAL_KEY}
```

For `scope=session` files, `textUrl` already includes `?userId=…`.

Use returned `text` as the authoritative document content (same text the website chat uses).

For `parsed: false`, note filename and ask user to re-upload as .txt/.md or text-based PDF.

## Step 4 — Hand off to other skills

After all texts are in context:

1. **Prioritize session attachments** when the user asks about files they just sent in the dialogue.
2. Run **project-intake** (if no KB yet) or **knowledge-base-generation** (update).
3. Do **not** claim you cannot access files — you already loaded them via this bridge.
4. Do **not** read PDFs only from `~/Projects/...` unless user explicitly added local copies.

## Optional: curl one-liner (terminal tool)

```bash
# Package + current dialogue
curl -s -H "Authorization: Bearer $JFO_INTERNAL_KEY" \
  "$JFO_API_PUBLIC_BASE/api/hermes/projects/nn-fresh-port/manifest?scope=all&userId=$JFO_DEFAULT_USER_ID&conversationId=YOUR_CONV_ID"
```

## Errors

| HTTP | Meaning |
|------|---------|
| 401 | `JFO_INTERNAL_KEY` mismatch — fix Railway/Worker secrets |
| 404 | Wrong projectId/documentId or userId |
| empty files (package) | No package uploads for that project |
| empty files (session) | Wrong userId/conversationId or upload not parsed yet |
