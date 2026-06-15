---
name: document-reorganize
description: "Classify, tag, and organize uploaded project documents by type and content. Extracts key metadata, identifies document relationships, and builds a structured project file index. Use when files are uploaded to a project, when a user says \"organize these files\", or when document-level navigation is needed. Triggers on \"organize documents\", \"整理文件\", \"file index\", \"what documents do we have\", \"sort these files\", or automatically when multiple files are uploaded."
---

# Document Reorganize

## Workflow

### Step 1: Inventory All Project Files (user-uploaded AND AI-generated)

List **every** file associated with the project, including both user-uploaded inputs and prior AI-generated outputs.

For each file, extract:
- Filename and format (PDF, DOCX, XLSX, PPTX, image, HTML)
- File size and page count
- Language (Chinese / English / bilingual)
- Upload date (for user files) or generation date (for AI files)
- **Authorship**: `📄 用户上传` (user-uploaded) or `🤖 AI 生成` (AI-generated, including the KB itself, prior IC memos, scraped public-info-search results)

The authorship is determined by:
- Files with `[AI]` filename prefix → AI-generated
- Files whose authorship is in the project's prior AI-output ledger → AI-generated
- Everything else → User-uploaded

Always preserve the distinction. AI-generated files should not be treated as primary evidence for new claims — they are syntheses, and citing them creates risk of circular reasoning.

### Step 2: Document Classification

Classify each document into one of the following categories. Classification is sector-aware:

**Universal Categories (all sectors):**

| Category | Description | Examples |
|----------|-------------|----------|
| **Pitch / IM** | Seller or sponsor marketing materials | 推介书, Information Memorandum, Teaser, 招商手册 |
| **Financial** | Financial models, projections, historical accounts | 投资测算表, Cash flow model, P&L, Balance sheet |
| **Legal** | Contracts, agreements, corporate documents | 合作协议, Sale contract, JV agreement, 股权结构 |
| **Regulatory / Approval** | Government permits, approvals, applications | DA批文, 规划许可证, Environmental assessment |
| **Technical / Design** | Engineering, architectural, or technical reports | 设计方案, Master Plan, 可研报告, Feasibility study |
| **Market Research** | Market studies, competitive analysis, industry data | 市场调研报告, Comparable sales, Industry report |
| **Valuation** | Independent valuations, appraisals | 估价报告, Valuation report, 资产评估 |
| **Meeting / Correspondence** | Minutes, emails, memos | 会议纪要, Email chain, Progress meeting notes |
| **Due Diligence** | DD reports, checklists, findings | 尽调报告, Title search, Environmental audit |
| **Media / Visual** | Photos, renderings, drone footage, maps | 效果图, Site photos, 航拍, Location map |
| **Internal Analysis** | Team's own analysis, notes, knowledge networks | 项目知识网络, 分析报告, Internal memo |
| **Other / Unclassified** | Doesn't fit above categories | Flag for manual review |

**Sector-Specific Additions:**

| Sector | Additional Categories |
|--------|----------------------|
| **Real Estate** | Heritage assessment (CMP), Planning instrument (LEP/SEPP/DCP), Strata plan, Survey |
| **Energy** | Grid connection (GPS), AEMO registration, Equipment spec, PPA/offtake |
| **Biosynthetics** | Patent filings, Clinical data, Regulatory submission (FDA/EMA), Lab results |
| **Technology** | Technical architecture, SOC2/security audit, Product roadmap, User metrics |
| **Trade** | Import/export licenses, Customs documentation, Quality certificates, 动检证 |

### Step 3: Metadata Extraction + Source ID Assignment

For each document, extract structured metadata AND assign a unique source ID:
- **Source ID**: `U-N` (sequential, for user-uploaded) or `A-N` (sequential, for AI-generated). These IDs are referenced everywhere in the KB as `[U-7]` / `[A-3]` inline citations.
- **Title**: Actual document title (not filename)
- **Author / Source**: Who created it (seller, advisor, government, internal, AI)
- **Date**: Document date (not upload date)
- **Version**: If identifiable
- **Key entities mentioned**: Companies, people, locations, amounts
- **Relevance to KB sections**: Which of the 11 KB sections does this document inform?
- **Tooltip excerpts**: For each KB section this document informs, extract a 1–2 sentence representative excerpt (max ~200 chars). These excerpts power the hover tooltips on citations in the KB body — without them, citations are unverifiable without leaving the document.

If a single document informs multiple sections, extract a separate tooltip excerpt for each section it informs.

### Step 4: Relationship Mapping

Identify relationships between documents:
- Documents that reference each other
- Documents that cover the same topic from different sources (potential for cross-verification in `dd-claim-audit`)
- Superseded versions (mark older versions clearly)
- Documents that are attachments/appendices to another document

### Step 5: Gap Identification

Compare the document inventory against the expected document set for the project's sector and stage:
- What document types are present ✅
- What document types are missing but expected ⚪
- What document types would be valuable but optional 🔵

Feed gaps into `gap-tracking`.

### Step 6: Output — Project File Index

Generate a structured file index (rendered as 附录 A · 来源索引 in the KB):

| Source ID | Authorship | Document Title | Category | Source | Date | Language | KB Sections | Notes |
|-----------|-----------|---------------|----------|--------|------|----------|-------------|-------|
| U-1 | 📄 用户上传 | 南宁东盟生鲜食品智慧港项目介绍 | Pitch / IM | Seller | 2022-06 | CN | 一, 二, 四 | 17 pages, covers Phase 1 only |
| U-2 | 📄 用户上传 | 嘉兴中润项目推介 | Pitch / IM | GFS (普冷) | 2022-11 | CN | 一, 二, 四 | 11 pages, 2 sub-projects |
| A-1 | 🤖 AI 生成 | [AI] 南宁智慧港_知识网络 v1.3 | Internal Analysis | This plugin | 2026-05-18 | CN | (synthesis) | Auto-generated KB |

## Output Format

- **Chat**: Markdown — document count by category, top gaps, file index table
- **KB update**: writes to the following Project Knowledge Base section(s) of `[AI] <项目名>_知识网络.html`:
  - 附录 A · 来源索引
- **Section details**:
  - 附录 A: 完整文件索引表 (文件名 / 来源方 / 类型 / 主题 / 关联章节 / 上传日期 / source-ID)
  - 附录 A 中的 source-ID 被其他 section 中的 <sup>[id]</sup> 引用回填
  - Gap analysis: 哪些章节缺乏来源支撑 (馈送给 gap-tracking)
- All KB writes go through `knowledge-base-generation` (single source of truth — no separate layer/section HTML files).
- All output conforms to `../knowledge-base-generation/references/style-guide-v2.7.md`.
## Important Notes

- Preserve original filenames — never rename user files.
- When a document contains information across multiple categories, assign the primary category and note secondary relevance.
- For bilingual documents, note both languages.
- When documents contain contradictory information, flag for `dd-claim-audit`.
- Auto-trigger this skill whenever files are uploaded to a project.
- This skill feeds directly into `knowledge-base-generation` — the file index becomes the source registry for the knowledge base.


## 边界案例提醒

Plugin 安装后 skill 文件只读，Claude 无法在执行过程中自动写入经验。遇到以下情况时，在**本次对话末尾**用固定格式提醒用户，由用户决定是否开启更新会话手动写入 SKILL.md：

- 当前指令未覆盖的特殊情况或边界案例
- 用户给出了纠正或更好的建议
- 发现值得复用的成功模式
- 原有指令存在歧义或冲突

提醒格式：
```
💡 建议写入 SKILL.md：[简短描述发现]
原因：[为什么值得复用]
```
