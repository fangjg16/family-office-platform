---
name: jfo-r2-materials
description: "Hermes bridge to 联合家办 platform materials (Cloudflare R2/D1 via Worker). Confirm manifest + current KB first; fetch file bodies on-demand by task type — not blind full-corpus download. Use before project-intake, knowledge-base-generation, dd, valuation, or any skill needing uploaded evidence. scope=all = package + current conversation session attachments."
version: 1.2.0
metadata:
  hermes:
    tags: [family-office, jfo, r2, materials]
    category: integration
---

# JFO Platform · R2 Materials Bridge

Website uploads live in **Cloudflare R2 + D1**, not in a Cowork local project folder.  
This skill is the Hermes equivalent of **「先确认项目事实来源，再分析」** — manifest is always light; **textUrl bodies are on-demand by task**, not mechanical full download of every file.

## Platform reading policy (Worker instructions align)

1. **Confirm sources first**: `projectId`, package manifest, session manifest (if dialogue uploads), current KB HTML (if task touches knowledge network).
2. **manifest** — default GET (lightweight file list + `parsed` flags + `textUrl`).
3. **textUrl** — only for files relevant to the current task; see task table below.
4. **Never** conclude from filenames alone or without reading evidence.
5. **Session priority**: if user uploaded in chat, use `scope=session` or `scope=all` — not package-only.
6. **scope=all** = project package **plus** current `userId` + `conversationId` session attachments.

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

## Step 3 — Fetch file bodies **on demand** (not all files)

After manifest, pull **only** bodies needed for the current task:

| Task | Read |
|------|------|
| project_intake / initial or full KB | Main diligence files; session attachments in full; package as needed for coverage |
| incremental KB | Current KB + files tied to named slots + new session uploads |
| reorder KB | **Current KB only** — no package/session bodies |
| ic_memo | Current KB first; raw files only if KB lacks key facts |
| valuation / risk / dd | Current KB + relevant excerpts (financial, legal, contracts) |
| public_info_search | manifest + KB as context; then external search |

```http
GET {textUrl from manifest — selected files only}
Authorization: Bearer {JFO_INTERNAL_KEY}
```

For `parsed: false`, note filename and ask user to re-upload as .txt/.md or text-based PDF.

Worker may pre-inject a **task-scoped excerpt** block — use as starting point; supplement via manifest + targeted textUrl when gaps remain.

## Step 4 — Hand off to other skills

1. **Prioritize session attachments** when the user just uploaded in the dialogue.
2. Run **project-intake** (if no KB) or **knowledge-base-generation** (update/reorder per mode).
3. Knowledge network HTML: `GET/PUT .../knowledge-network/current?format=raw` + ` ```html ` fallback in the same reply.
4. Do **not** claim files are inaccessible after manifest confirms they exist.
5. Do **not** read from `~/Projects/...` unless user explicitly added local copies (Cowork-only path; not this platform).

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
