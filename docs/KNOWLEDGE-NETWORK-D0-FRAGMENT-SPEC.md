# 知识网络 D0 规格 · 方案 D（Modular HTML Fragments）

> **状态**：架构冻结稿，供 D1–D5 实现对照。  
> **范围**：`initial` / `full` 主路径；`incremental` / `reorder` 暂沿用现有路径，D6 再对齐。  
> **原则**：Hermes 交付 **HTML fragment**；Worker 独占 shell、Appendix A 主权、Appendix D、终审与入库。

---

## 1. 目标与非目标

### 1.1 目标

| # | 目标 |
|---|------|
| G1 | 13 个 core slot + 附录 B/C 由 Hermes 直接写 **section HTML**，表达力接近 Codex |
| G2 | Worker 组装整页（`kb-template` shell + nav + KB-CONFIG + maturity + Appendix A/D） |
| G3 | Fragment 级 hard gate + 局部 repair，避免 13 slot 全量重写 |
| G4 | 分阶段进度文案，降低体感等待 |
| G5 | 资料以 **documentId** 为唯一身份，全量重做时复用已有 chunks，不重复切分/embedding |

### 1.2 非目标（本阶段不做）

- 恢复整套 Codex workflow skills / slash commands
- Hermes 整页 PUT 或手写 KB-CONFIG / nav / Appendix D
- JSON structured-slot-batch 主路径（保留为 `KN_GENERATION_MODE=structured` 回退）
- KB job 默认联网（`public-info-search` skill 不自动绑定）
- 同 `documentId` 原地覆盖上传（当前产品为删后重传 = 新 ID）

---

## 2. 主权分工

| 组件 | 负责人 | 说明 |
|------|--------|------|
| `kb-template` shell、CSS/JS | Worker | Hermes 禁止输出 |
| `<!-- KB-CONFIG -->`、nav、section 编号 | Worker | 来自 prep + `displayOrder` |
| 13 × `<section id="{slot}">` | Hermes | `kb-fragment-batch.fragments` |
| Appendix A 来源索引 | Worker 基线 + Hermes `sourceProposals` | **id 分配权在 Worker** |
| Appendix B 术语表 | Hermes | `appendixFragments.glossary` |
| Appendix C 数据字典 | Hermes | `appendixFragments.data-dictionary` |
| Appendix D 版本记录 | Worker | publish 时写入 |
| maturity 区 | Worker | 入库后确定性计分（可从 HTML 抽 signal） |
| 整页 L1–L3 校验 | Worker | hard |
| Codex parity marker | Worker | L4 **soft**（告警，默认不挡发布） |

---

## 3. 交付契约：`kb-fragment-batch`

### 3.1 类型名

```ts
type KbFragmentBatchType = "kb-fragment-batch";
const KB_FRAGMENT_BATCH_SCHEMA_VERSION = "2.91";
```

### 3.2 JSON 形状

```json
{
  "type": "kb-fragment-batch",
  "schemaVersion": "2.91",
  "mode": "initial",
  "batchIndex": 0,
  "fragments": {
    "snapshot": "<section class=\"block kb-panel\" id=\"snapshot\">…</section>",
    "target-overview": "…",
    "industry-market": "…"
  },
  "appendixFragments": {
    "glossary": null,
    "data-dictionary": null
  },
  "sourceProposals": [
    {
      "sourceKey": "market-report-1",
      "type": "公开资料",
      "title": "2024 行业研报摘录",
      "author": "…",
      "excerpt": "…",
      "usedIn": ["industry-market"],
      "documentId": "optional-uuid-if-from-upload"
    }
  ],
  "summary": "本批完成 snapshot、target-overview、industry-market"
}
```

### 3.3 Fragment 硬性规则（L1）

每条 `fragments[slot]` 必须：

1. 是**完整** `<section id="{slot}" …>…</section>`（id 与 key 一致）
2. 使用 v2.91 约定 class（`block kb-panel` 等）
3. **禁止**含：`<!DOCTYPE>`、`<html>`、`<body>`、`<!-- KB-CONFIG`、`<nav class="kb-nav"`、`kb-shell`、`<script>`

`appendixFragments`（若本批交付）：

- `glossary` → 完整 `<section id="glossary">…</section>`
- `data-dictionary` → 完整 `<section id="data-dictionary">…</section>`

### 3.4 引用规则（L2）

- 正文 citation 使用 `#source-{id}`（如 `#source-U-1`、`#source-A-3`）
- 批内可先用 `sourceKey` 临时引用；Worker merge `sourceProposals` 后 **rewrite** 为正式 id
- 禁止引用 registry 中不存在的 source id（repair 或 hard fail）

### 3.5 Hermes 可见回复

1. 3–8 行简体中文摘要（本批写了什么、缺口）
2. **一个** ` ```json ` 代码块，`type` 必须为 `kb-fragment-batch`
3. 禁止整页 ` ```html `、禁止 `curl PUT`

---

## 4. 批次划分（Phase 1：沿用 6 批骨架）

与现有 `KN_SLOT_BATCH_PLAN` 对齐，**只换交付物**，不先改并行度。

| batchIndex | slots | appendixFragments | 备注 |
|------------|-------|-------------------|------|
| 0 | snapshot, target-overview, industry-market | — | 可带 `sourceProposals` |
| 1 | business-operations, legal-ownership, regulatory-compliance | — | |
| 2 | resource-network, comps-benchmark | — | |
| 3 | valuation-returns | — | |
| 4 | diligence-gaps, risks-mitigation | — | |
| 5 | timeline-milestones, decision-framework | **glossary + data-dictionary** | 附录 B/C 专批交付 |

并行：沿用 `KN_SLOT_BATCH_V2` + `KN_SLOT_BATCH_PARALLEL_LIMIT`（默认 4）。

---

## 5. Worker 编排状态机

### 5.1 Session phase（`KnSlotBatchPhase`）

| phase | 含义 |
|-------|------|
| `preprocessing` | 资料指纹 + Evidence Inventory + Appendix A 基线 |
| `waiting_batches` / `waiting_hermes` / `waiting_capacity` | 等待 Hermes fragment batch |
| `between_batches` | 本批已 merge，准备下一批 |
| `assembling` | 13 fragment + B/C stitch 进 template |
| `publishing` | 见 publish step |
| `done` / `failed` | 终态 |

### 5.2 Session 字段变更（相对 structured 路径）

```ts
// 新增 / 替换
fragments: Partial<Record<CanonicalKbSlot, string>>;
appendixFragments: Partial<Record<"glossary" | "data-dictionary", string>>;
materialSnapshot: MaterialSnapshot;  // 见 §7

// 退役（fragment 模式下不用）
slots: Partial<StructuredKbSlots>;  // 仅 structured 回退
```

### 5.3 Publish 子步骤（`KnPublishStep`）

| step | fragment 模式行为 |
|------|-------------------|
| `assembling` | `assembleKbFromFragments(session)` |
| `quality_gate` | 13 section 齐全、orphan citation、空壳检测 |
| `rendering_html` | **跳过**（assemble 已产出 HTML）或 no-op |
| `validating_html` | `validateKnowledgeNetworkHtmlForWrite` + optional codex parity audit |
| `writing_r2` | upsert KB |
| `updating_d1` | 元数据 |
| `syncing_chat` | 完成 job |

---

## 6. 校验分层

| 层级 | 检查内容 | 时机 | 失败处理 |
|------|----------|------|----------|
| **L1 结构** | section id、禁止 shell、闭合标签 | 每批 fragment merge 前 | 本批 repair（≤1 次） |
| **L2 引用** | `#source-*` ∈ registry | 每批 + assemble 后 | repair 或 hard fail |
| **L3 内容** | 空壳 section、占位符堆砌、明显幻觉 | 批内 + 整页 | **fragment/batch 级重跑** |
| **L4 Codex** | 组件 marker、maturity 标签 | `validating_html` | **soft warn**，写入 audit JSON |

L3 空壳判定（初版）：section 去掉标题/nav 后纯文本 &lt; N 字符 **且** 无 table/list/gap-callout → hard。

### 6.1 Slot 呈现：「缺资料」≠「缺 fragment」（待 confirm · D2 前冻结讨论）

v2.91 / slot-specific-rules 的既有原则是：**弱板块也要保留 section 壳，用 gap / missing callout 表达缺口，不要删掉、不要从 nav 消失，不要用行业废话硬填。**

方案 D 下必须区分 **三种状态**（不要混在一个 `missingSlots` 里）：

| 状态 | 含义 | DOM | nav | 是否允许 publish |
|------|------|-----|-----|------------------|
| **A · gap-first** | 有资料缺口，但 Hermes 已交付合法 fragment | 有 `<section id="{slot}">` | 保留 | ✅ 允许（L3 须识别 gap 标记） |
| **B · undelivered** | 本 job 从未收到该 slot 的 fragment HTML | **无** section | 若强行组装会缺锚点 | ❌ 不允许直接 publish |
| **C · empty-shell** | 有 section，但无事实也无 gap 说明（偷懒空壳） | 有 section | 保留 | ❌ L3 hard，触发 batch repair |

**「没有内容」的正确做法 = 状态 A**，不是删掉板块，也不是 assemble 时当「缺 slot」跳过。

#### A · gap-first fragment（合法「薄内容」）

Hermes 必须仍交付 **完整** `<section id="{slot}">…</section>`，内部至少包含以下之一：

- `class` 含 `gap` / `missing` / `oq-` 等缺口组件
- 结构化 gap 表 / `oq-group` / timeline 的「暂无项目级节点」类 stub
- slot-specific-rules 要求的 **missing-data stub**（如 `timeline-milestones` 无节点时保留壳 + callout）

L3 校验：**有 gap 标记则不因字数少而判 empty-shell**（D1 已实现：`gap` / `oq-` / `missing` / `glossary-row` / `table` 等视为「有表达」）。

#### B · undelivered fragment（交付缺口 · D1 `missingSlots` 所指）

指 `session.fragments[slot]` 在 **进入 assemble 时仍为空**——通常是：

- 某 batch Hermes 没返回该 slot 的 HTML
- merge 失败 / repair 后仍缺

这与「板块内容上写明了缺资料」完全不同。

**编排期（between_batches）**：缺 slot 是正常的（还没跑到那一批）。  
**assemble 前（publish）**：13 个 canonical slot 必须全部 **已交付**（状态 A 或充实内容），不能仍是 undelivered。

#### 隐藏板块？

| 模式 | 策略 |
|------|------|
| `initial` / `full` | **不支持隐藏** canonical 13 slot；nav 与 section 一一对应 |
| `reorder` | 仅改 `display-order` / 编号，**不删** section 内容 |
| `incremental` | 只改用户点名 slot；未点名 slot 保持上一版 HTML |

若未来要做「项目类型默认折叠某些 slot」，属于 **display-order / UI 折叠**，不是从 HTML 删除 section（另开规格，不在 D2）。

                                                                                                                          03#### D2 已确认策略（2026-06-03）

**✅ 1. assemble：D-α（Hermes 必交 + Worker gap stub 兜底）**

1. Hermes 每批必须交本批全部 slot 的 `fragments.{slot}`；资料不足时交 gap-first section，禁止省略 key。  
2. assemble 前若仍有 `undeliveredSlots` →  responsible batch **repair 一次**。  
3. repair 仍缺 → Worker 注入 **确定性 gap stub**（`fragmentOrigin: "worker-stub"`）。  
4. stub 后仍 L3 失败 → job failed。

**✅ 2. 13 slot 不隐藏**

- **产品默认**：`initial` / `full` 下 13 个 canonical slot **全部出现在 HTML + nav + KB-CONFIG display-order** 中。  
- **不必单独做「隐藏开关」**；默认行为由现有 **strict HTML 校验** 强制执行（见下「代码层默认」）。  
- `reorder` 只改顺序/编号，不删 section。  
- 未来 UI「折叠」≠ 从 HTML 移除 slot（另开规格）。

**代码层默认（已存在，D2 复用）**

`validateKnowledgeNetworkHtml` strict 模式（`knowledge-network-html-validation.ts`）已要求：

- `display-order` 含全部 `CANONICAL_KB_SLOTS`（13 个）  
- 页面存在 13 个 `id="{slot}"` 的 section  
- nav `data-target` 与 display-order 一致  
- 附录 A–D section + nav 齐全  

因此：**少一个 slot 本来就无法通过 `validating_html` 入库**。D2 assembler 只需保证 assemble 前 13 个 slot 都有 HTML（Hermes 或 worker-stub），不必新增 `hideSlot` API。

可选（D2 实现时）：在 `knowledge-network-fragment-assembler.ts` 顶部加一行常量注释或 `KN_FRAGMENT_REQUIRE_ALL_CANONICAL_SLOTS = true` 作文档锚点，**非新行为**。

**✅ 3. gap-first：按证据是否不足，非每 slot 强制一条 gap**

| 情况 | 要求 |
|------|------|
| slot 有足够事实/表格/分析可写 | **不需要** gap；正常充实内容即可 |
| 资料不足、无法写强结论 | **必须** gap-first 表达（callout / gap 表 / slot 专用 stub） |
| 有 section 但既无事实也无 gap（empty-shell） | L3 hard → repair |

判定顺序（L3）：

1. 有事实性富内容（字数 / table / 组件 marker）→ 通过  
2. 否则有合格 gap 表达 → 通过（gap-first）  
3. 否则 → empty-shell，hard fail  

**不采用**「每个 slot 至少 1 条 gap」的全局硬性规则（与 structured schema 里部分 slot 的 coverage target 不同；fragment 路径以 **empty-shell vs gap-first vs 充实** 三分法为准）。

#### D2 启动前 Confirm checklist

- [x] **assemble 策略**：D-α（Worker gap stub 兜底）
- [x] **13 slot 禁止隐藏**：是（依赖现有 strict 校验 + assembler 凑齐 13 section）
- [x] **gap-first**：仅证据不足时要求，非每 slot 强制 gap

```ts
/** 交付状态（session / assemble 诊断用） */
type SlotFragmentDeliveryStatus =
  | "delivered"      // 有 Hermes HTML
  | "gap-first"      // 有 HTML 且含合格 gap 表达
  | "worker-stub"    // Worker 兜底 gap section
  | "undelivered";   // 尚无 HTML

type SlotFragmentRecord = {
  html?: string;
  delivery: SlotFragmentDeliveryStatus;
  batchIndex?: number;
};
```

assemble API 语义调整（相对 D1）：

```ts
// D1（当前）：missingSlots = undelivered → assemble 直接 fail
// D2（目标）：区分
undeliveredSlots: CanonicalKbSlot[];  // 尚未交付
gapFirstSlots: CanonicalKbSlot[];      // 已交付且含 gap（可 publish）
```

#### Hermes 指令要点（D3 写入）

- 「本批 slots 每个都必须有 `fragments.{slot}`，**禁止省略 key**。」
- 「资料足 → 写事实与分析，**不必强行加 gap**。」
- 「资料不足 → gap-first section，禁止 empty-shell，禁止从 nav 移除。」
- 「`timeline-milestones` 无节点时：保留 section + missing stub，禁止用行业新闻填充。」

#### 附录 B/C

- 缺术语 / 缺模型字段时：仍交付 appendix section，可用一行 gap callout 或空表 + 说明行  
- **不允许** omit `glossary` / `data-dictionary` section（与 core slot 同逻辑）

---

## 7. Material Identity & Read Cache

### 7.1 唯一身份

| 字段 | 来源 | 说明 |
|------|------|------|
| `documentId` | `documents.id`（上传时 UUID） | **canonical**；对外统一此名 |
| `fileId` | 同 `documentId` | reading plan / material hints 内部别名，实现时逐步统一 |
| `filename` | 展示用 | **不得**作为去重或缓存主键 |

**边界**：

- 删文件 → `chunks` + `documents` 删除 → 缓存失效
- 同名重传 → **新** `documentId` → 必须当新资料
- 全量重做 KB **不等于**重新上传/切 chunk/embedding

### 7.2 Content revision（判断「文件有没有变」）

```ts
type DocumentContentRevision = {
  documentId: string;
  chunkCount: number;
  embedModel: string;      // 如 text-embedding-v4
  embedDimension: number;  // 如 1024
  createdAt: string;       // documents.created_at
};

function contentRevisionKey(d: DocumentContentRevision): string {
  return `${d.documentId}:${d.chunkCount}:${d.embedModel}:${d.embedDimension}`;
}
```

无 `content_hash` 字段时，**`documentId` 不变即视为内容不变**（与当前产品一致）。

### 7.3 Material snapshot（每 KB job）

预处理写入 `session.materialSnapshot`：

```ts
type MaterialSnapshot = {
  capturedAt: string;
  documents: DocumentContentRevision[];
  fingerprint: string;  // stable hash of sorted revision keys
};
```

全量重做时：

1. 重新拉 manifest，算 `fingerprint'`
2. 若 `fingerprint' === session.materialSnapshot.fingerprint`（同 job 内 between_batches）→ 跳过重复 digest 计算
3. 若与**上一版成功 KB job** 的 snapshot 相同 → reading plan 标 `readMode: "cached"`

### 7.4 Manifest 扩展字段（Hermes `GET .../manifest`）

在现有 `documentId, filename, chunkCount, parsed, textUrl` 上增加：

```json
{
  "documentId": "uuid",
  "filename": "尽调报告.pdf",
  "chunkCount": 42,
  "parsed": true,
  "embedded": true,
  "contentRevision": "uuid:42:text-embedding-v4:1024",
  "textUrl": "…"
}
```

### 7.5 Reading plan `readMode` 扩展

在现有 `full | excerpt | manifest` 上增加：

| readMode | 含义 | Hermes 行为 |
|----------|------|-------------|
| `manifest` | 仅确认清单 | 不 GET textUrl |
| `excerpt` | Worker 已注入摘录 | 优先用 prep digest；缺口再 textUrl |
| `full` | 需读全文 | GET textUrl |
| `cached` | revision 未变且 job 内已读过 | **跳过** textUrl；用 session 内摘录 |

### 7.6 读取策略（写进 Hermes 指令）

| 场景 | 策略 |
|------|------|
| `initial` / `full`，资料无变化 | manifest → Worker reading plan + digest → 仅对 `readMode: full` 且 revision 变的文件 GET textUrl |
| `initial` / `full`，新增文件 | 仅对新 `documentId` 拉 textUrl |
| fragment batch N | 只读 **本批 slot 映射**的 documentId（见 `DEEP_REFS_BY_SLOT` + material hints） |
| `incremental` | 当前 KB + 点名 slot 相关 documentId |
| `reorder` | 不读资料包 |

**禁止**：6 个 batch 各 GET 一遍同一份尽调 PDF。

### 7.7 Appendix A 与 documentId 绑定

| 规则 | 说明 |
|------|------|
| `U-N` 用户上传来源 | `structuredKbSource.documentId`（新增可选字段）稳定绑定 |
| 全量重做 | 同 documentId → 保留原 U-N 与 excerpt；仅更新 `usedIn` |
| 新 documentId | 分配新 U-N |
| 消失的 documentId | 标为历史来源或 gap，不静默删除行（v1：保留行加 `(archived)` 注记） |

### 7.8 Worker 摘录缓存（D1+ 可选）

```
cacheKey = projectId + documentId + contentRevision
value    = top-K chunk excerpts（复用 selectChunksForChat）
TTL      = 至 invalidateChunkCache（上传/删文件）
```

prep 阶段一次性写入；between_batches 复用，不重复向量检索。

---

## 8. 进度文案表（用户可见）

映射实现：`agent-job-display.ts` ← `slotBatchProgress` + `currentPublishStep` + `completedFragments`。

| 后端信号 | 用户文案（zh） |
|----------|----------------|
| `phase=preprocessing` | 正在整理项目资料… |
| `phase=waiting_*` + batch 0..4 | 正在撰写第 {N} 部分，共 6 部分（已完成 {x}/13 个板块）… |
| `phase=waiting_*` + batch 5 | 正在整理附录（术语表与数据字典）… |
| `phase=between_batches` | 正在准备下一部分… |
| `phase=assembling` | 正在合并各板块… |
| `publishStep=quality_gate` | 正在核对引用与板块结构… |
| `publishStep=validating_html` | 正在终审知识网络… |
| `publishStep=writing_r2` / `updating_d1` | 正在保存知识网络… |
| `publishStep=syncing_chat` | 正在更新对话… |
| `phase=failed` | 知识网络生成未完成 |
| repair 进行中 | 正在修正第 {N} 部分… |

**session 扩展字段**（供 UI）：

```ts
completedFragments: CanonicalKbSlot[];
currentBatchLabel?: string;  // 如「行业与市场」
```

---

## 9. Repair 状态机

```
batch 完成
  → extract kb-fragment-batch
  → per-fragment L1/L2/L3
  → 若 hard fail 且 batchRepairAttempts[batchIndex] < 1
       → 发 minimal repair prompt（只修本批 fragment HTML）
  → 若仍 fail → session.phase = failed
```

整页 assemble 后 L3 单 slot 空壳 → **只重跑含该 slot 的 batch**，不重跑 6 批。

---

## 10. Feature flag & 回退

| 变量 | 值 | 行为 |
|------|-----|------|
| `KN_GENERATION_MODE` | `fragment`（默认目标） | D 主路径 |
| `KN_GENERATION_MODE` | `structured` | 现有 structured-slot-batch |
| 用户消息含 `slot-batch-structured` | — | 强制 structured |
| 用户消息含 `slot-batch-v1` | — | 强制 v1 串行（现有） |

---

## 11. 实现顺序（D1–D6）

| 阶段 | 交付物 |
|------|--------|
| **D1** | `fragment-types` / `extract` / `validation` / `assembler` + 单测（不接 Hermes） |
| **D2** | orchestrator 换 extract/merge/publish；`materialSnapshot` in prep；**§6.1 assemble 策略（待 confirm）** |
| **D3** | `fragment-batch-instructions` + Hermes SKILL 主路径翻转 |
| **D4** | 进度文案 + `completedFragments` API |
| **D5** | PET full 灰度 + `KN_GENERATION_MODE` |
| **D6** | incremental 切 fragment 主路径 |

### D1 验收（assembler 单测）

- [x] 13 个 fixture fragment + B/C → assemble → `validateKnowledgeNetworkHtml` strict 通过
- [x] 含 forbidden shell 的 fragment → L1 reject
- [x] orphan `#source-*` → L2 reject
- [x] **undelivered** slot（未交 fragment）→ assemble fail（D2 前占位行为；见 §6.1）

### D5 验收（端到端）

- [x] PET `full` 一次跑通，B/C 有实质内容（`pet-full-smoke.log` job `2f127b9f…` · v8 · 321s）
- [x] 资料未变时第二次 full 不重复 GET 同 document textUrl（`reading-plan-cached.test.ts` + `readMode=cached` 逻辑）
- [x] 单 batch hard fail → 仅 repair 该 batch（`fragment-merge.test.ts` · `failedSlots` + orchestrator `batchRepairAttempts`）
- [x] 对话进度文案随 batch / publish step 变化（`slot-batch-progress` / `agent-job-progress` 单测 + smoke 日志 `fragments=N/13`）
- [x] `slot-batch-structured` 回退可用（`generation-mode.test.ts`）

验收脚本：`api-worker/scripts/run-d5-acceptance.ts`（2026-06-03 跑通 11/11）

---

## 12. 关键文件索引（实现时）

| 域 | 路径 |
|----|------|
| 编排（改） | `api-worker/src/knowledge-network-slot-batch-orchestrator.ts` |
| 类型（改） | `api-worker/src/knowledge-network-slot-batch-types.ts` |
| Fragment（新） | `knowledge-network-fragment-*.ts` |
| Assembler（新） | `knowledge-network-fragment-assembler.ts` |
| 单 slot patch（复用规则） | `knowledge-network-slot-patch.ts` |
| Shell 模板（复用） | `knowledge-network-full-renderer.ts`, `knowledge-network-kb-template` |
| 资料 / reading plan（改） | `knowledge-network-reading-plan.ts`, `knowledge-network-material-hints.ts` |
| Manifest（改） | `api-worker/src/hermes-bridge.ts` |
| 进度 UI | `src/lib/agent-job-display.ts` |
| Hermes 指令（改） | `knowledge-network-slot-batch-instructions.ts` → fragment 版 |
| SKILL | `hermes-railway/skills/opportunistic-investments-hermes/SKILL.md` |

---

## 13. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-06-03 | D0 初稿：fragment 契约、6 批划分、校验分层、Material Identity、进度文案、实施顺序 |
| 2026-06-03 | §6.1 已 confirm：D-α；13 slot 靠 strict 校验默认不隐藏；gap 仅证据不足时要求 |
| 2026-06-03 | D5 验收：`run-d5-acceptance.ts` 11/11；PET fragment full v8 入库 |
