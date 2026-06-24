import { CANONICAL_KB_SLOTS, KB_APPENDIX_SLOTS } from "./knowledge-network-html-validation";
import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import { loadWorkerKbTemplate } from "./knowledge-network-kb-template";
import { adaptStructuredKbDataFromCodexKeys } from "./knowledge-network-codex-payload-adapter";
import {
  normalizeSourceId,
} from "./knowledge-network-slot-payload-validation";
import {
  renderCanonicalSlotSection,
  resolveSlotNumeral,
  SLOT_DEFAULT_TITLES,
} from "./knowledge-network-slot-render";
import type {
  StructuredKbData,
  StructuredKbDataDictionaryEntry,
  StructuredKbGlossaryTerm,
  StructuredKbSource,
} from "./knowledge-network-structured-kb-data-types";

const APPENDIX_NAV: Record<(typeof KB_APPENDIX_SLOTS)[number], { num: string; label: string }> = {
  "source-index": { num: "A", label: "来源索引" },
  glossary: { num: "B", label: "术语表" },
  "data-dictionary": { num: "C", label: "数据字典" },
  "version-ledger": { num: "D", label: "版本记录" },
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slugTermId(term: string): string {
  return term
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u4e00-\u9fff-]/g, "");
}

export function resolveStructuredKbDisplayOrder(data: StructuredKbData): CanonicalKbSlot[] {
  const requested = data.config.displayOrder ?? [...CANONICAL_KB_SLOTS];
  const seen = new Set<string>();
  const order: CanonicalKbSlot[] = [];
  for (const slot of requested) {
    if (!CANONICAL_KB_SLOTS.includes(slot as CanonicalKbSlot)) continue;
    if (seen.has(slot)) continue;
    seen.add(slot);
    order.push(slot as CanonicalKbSlot);
  }
  for (const slot of CANONICAL_KB_SLOTS) {
    if (!seen.has(slot)) order.push(slot);
  }
  return order;
}

function buildKbConfigBlock(
  data: StructuredKbData,
  displayOrder: CanonicalKbSlot[],
  structureCoverageDebug?: number,
  renderNote = "structured-full | Worker deterministic render",
): string {
  const projectType = data.config.projectType?.trim() || "general";
  const renderingMode = data.config.renderingMode ?? "chinese-only";
  const multiAsset = data.config.multiAsset === true ? "true" : "false";
  const configVersion = data.config.configVersion ?? 1;
  const intakeDate = data.meta.date?.trim() || new Date().toISOString().slice(0, 10);
  const debugLine =
    typeof structureCoverageDebug === "number"
      ? `structure-coverage-debug: ${Math.round(structureCoverageDebug)}`
      : "";
  return [
    "<!-- KB-CONFIG",
    "schema-version: 2.91",
    `display-order: ${displayOrder.join(", ")}`,
    `project-type: ${projectType}`,
    `rendering-mode: ${renderingMode}`,
    `multi-asset: ${multiAsset}`,
    `config-version: ${configVersion}`,
    ...(debugLine ? [debugLine] : []),
    "display-order-history:",
    `  ${intakeDate} | ${renderNote}`,
    "-->",
  ].join("\n");
}

function buildNavItems(displayOrder: CanonicalKbSlot[]): string {
  const core = displayOrder
    .map((slot) => {
      const d = SLOT_DEFAULT_TITLES[slot];
      const num = resolveSlotNumeral(displayOrder, slot);
      return (
        `<li><button class="kb-nav-btn" data-target="${slot}">` +
        `<span class="kb-nav-num">${esc(num)}</span><span>${esc(d.title)}</span></button></li>`
      );
    })
    .join("\n");
  const appendix = KB_APPENDIX_SLOTS.map((slot) => {
    const a = APPENDIX_NAV[slot];
    const style =
      slot === "source-index" || slot === "glossary" || slot === "data-dictionary" || slot === "version-ledger"
        ? ' style="font-size:.52rem;width:2rem"'
        : "";
    return (
      `<li><button class="kb-nav-btn" data-target="${slot}">` +
      `<span class="kb-nav-num"${style}>${a.num}</span><span>${esc(a.label)}</span></button></li>`
    );
  }).join("\n");
  return `${core}\n${appendix}`;
}

function buildLangToggle(renderingMode: string | undefined): string {
  if (renderingMode !== "bilingual") return "";
  return `<div class="kb-lang-toggle" id="lang-toggle" style="display:none">
      <button type="button" class="lang-btn active" data-lang="zh" aria-pressed="true">中文</button>
      <button type="button" class="lang-btn" data-lang="en" aria-pressed="false">EN</button>
    </div>`;
}

function renderAppendixSourceIndex(sources: StructuredKbSource[]): string {
  const rows = sources
    .map((s) => {
      const shortId = s.id.trim().replace(/^source-/, "");
      const anchorId = normalizeSourceId(shortId);
      const usedIn = (s.usedIn ?? []).join(", ");
      return (
        `<tr><td><span id="${esc(anchorId)}">${esc(shortId)}</span></td>` +
        `<td>${esc(s.type)}</td>` +
        `<td>${esc(s.title)}</td>` +
        `<td>${esc(s.author ?? "")}</td>` +
        `<td>${esc(s.excerpt ?? "")}</td>` +
        `<td>${esc(usedIn)}</td></tr>`
      );
    })
    .join("");
  return (
    `<section class="block kb-panel" id="source-index">` +
    `<h2 class="section-title"><span class="section-num">A</span>附录 A · 来源索引</h2>` +
    `<table><thead><tr><th>ID</th><th>类型</th><th>标题</th><th>主体</th><th>摘录/说明</th><th>影响章节</th></tr></thead>` +
    `<tbody>${rows}</tbody></table></section>`
  );
}

function renderAppendixGlossary(terms: StructuredKbGlossaryTerm[]): string {
  const rows = terms
    .map((t) => {
      const id = `term-${slugTermId(t.term)}`;
      const ctx = t.context ? `<span>${esc(t.context)}</span>` : "";
      return (
        `<div class="glossary-row" id="${esc(id)}">` +
        `<span class="term">${esc(t.term)}</span>` +
        `<span>${esc(t.definition)}</span>${ctx}</div>`
      );
    })
    .join("");
  return (
    `<section class="block kb-panel" id="glossary">` +
    `<h2 class="section-title"><span class="section-num">B</span>附录 B · 术语表</h2>${rows}</section>`
  );
}

function renderAppendixDataDictionary(entries: StructuredKbDataDictionaryEntry[]): string {
  const body = entries
    .map((e) => {
      const formula = e.formula ?? e.definition ?? "";
      return (
        `<tr><td>${esc(e.field)}</td><td>${esc(formula)}</td>` +
        `<td>${esc(e.sample ?? "")}</td><td>${esc(e.caveat ?? "")}</td></tr>`
      );
    })
    .join("");
  return (
    `<section class="block kb-panel" id="data-dictionary">` +
    `<h2 class="section-title"><span class="section-num">C</span>附录 C · 数据字典、模型假设与数据证据底稿</h2>` +
    `<table><thead><tr><th>字段/模型项</th><th>口径/公式</th><th>样本范围/清洗逻辑</th><th>Caveat</th></tr></thead>` +
    `<tbody>${body}</tbody></table></section>`
  );
}

/** Appendix D 占位：入库时由 mergeVersionLedgerFromDb 合并 D1 历史 */
export function renderAppendixVersionLedgerPlaceholder(): string {
  return (
    `<section class="block kb-panel" id="version-ledger">` +
    `<h2 class="section-title"><span class="section-num">D</span>附录 D · 版本记录</h2>` +
    `<table><thead><tr><th>版本</th><th>时间</th><th>父版本</th><th>来源</th><th>变更摘要</th></tr></thead>` +
    `<tbody><!-- WORKER_VERSION_LEDGER --></tbody></table></section>`
  );
}

function buildMainSections(data: StructuredKbData, displayOrder: CanonicalKbSlot[]): string {
  return displayOrder
    .map((slot) =>
      renderCanonicalSlotSection(slot, data.slots[slot], {
        numeral: resolveSlotNumeral(displayOrder, slot),
        title: SLOT_DEFAULT_TITLES[slot].title,
      }),
    )
    .join("\n\n");
}

export type KbTemplateSectionOverrides = {
  mainSectionsHtml: string;
  appendixAHtml?: string;
  appendixBHtml?: string;
  appendixCHtml?: string;
  appendixDHtml?: string;
  kbConfigNote?: string;
};

/** 将 shell 元数据 + 自定义 section HTML 注入 kb-template（fragment 组装与 structured 渲染共用） */
export function renderKbTemplateWithSections(
  data: StructuredKbData,
  sections: KbTemplateSectionOverrides,
  options?: { structureCoverageDebug?: number; versionDisplay?: string; schemaVersion?: string },
): string {
  const template = loadWorkerKbTemplate();
  const displayOrder = resolveStructuredKbDisplayOrder(data);
  const schemaVersion = options?.schemaVersion?.trim() || data.schemaVersion || "2.91";
  const version =
    options?.versionDisplay?.trim() ||
    (data.meta.version?.trim() && !/^v?\d+\.\d+/i.test(data.meta.version.trim())
      ? data.meta.version.trim().startsWith("v")
        ? data.meta.version.trim()
        : `v${data.meta.version.trim()}`
      : "v1");
  const versionLabel = version.startsWith("v") ? version : `v${version}`;
  const aiBadge = `${versionLabel} · schema ${schemaVersion}`;
  const date = data.meta.date?.trim() || new Date().toISOString().slice(0, 10);
  const status = data.meta.status?.trim() || "内部讨论";
  const stage = data.meta.stage?.trim() || "早期线索";
  const navTitle = data.meta.navTitle?.trim() || "项目知识网络";
  const footerBrand = data.meta.footerBrand?.trim() || "联合家办 · Project Knowledge Network";
  const timestamp = `${date} 00:00`;

  let html = template.replace(
    /<!--\s*KB-CONFIG[\s\S]*?-->/i,
    buildKbConfigBlock(
      data,
      displayOrder,
      options?.structureCoverageDebug,
      sections.kbConfigNote?.trim() || "fragment-full | Worker assemble",
    ),
  );

  const replacements: Record<string, string> = {
    "{{PAGE_TITLE}}": `${data.meta.title} · 项目知识网络`,
    "{{PROJECT_TYPE}}": data.config.projectType?.trim() || "general",
    "{{RENDERING_MODE}}": data.config.renderingMode ?? "chinese-only",
    "{{MULTI_ASSET}}": data.config.multiAsset === true ? "true" : "false",
    "{{INTAKE_DATE}}": date,
    "{{NAV_TITLE}}": navTitle,
    "{{NAV_ITEMS}}": buildNavItems(displayOrder),
    "{{LANG_TOGGLE}}": buildLangToggle(data.config.renderingMode),
    "{{VERSION}}": versionLabel,
    "{{H1_TITLE}}": data.meta.title,
    "{{H1_SUB}}": data.meta.subtitle ?? "",
    "{{MASTHEAD_SUBTITLE}}": data.meta.mastheadSubtitle ?? "",
    "{{MASTHEAD_LEAD}}": data.meta.lead ?? "",
    "{{DATE}}": date,
    "{{STATUS_DD}}": status,
    "{{STAGE}}": stage,
    "{{FACTOR_A}}": data.maturity.factorA,
    "{{FACTOR_A_NOTE}}": data.maturity.factorANote ?? "",
    "{{FACTOR_B}}": data.maturity.factorB,
    "{{FACTOR_B_NOTE}}": data.maturity.factorBNote ?? "",
    "{{COMBINED}}": data.maturity.combined,
    "{{MATURITY_TIER}}": data.maturity.tier ?? "",
    "{{AUTO_SUMMARY}}": data.meta.autoSummary,
    "{{MAIN_SECTIONS}}": sections.mainSectionsHtml,
    "{{APPENDIX_A}}":
      sections.appendixAHtml ?? renderAppendixSourceIndex(data.sources),
    "{{APPENDIX_B}}":
      sections.appendixBHtml ?? renderAppendixGlossary(data.terms ?? []),
    "{{APPENDIX_C}}":
      sections.appendixCHtml ?? renderAppendixDataDictionary(data.dataDictionary ?? []),
    "{{APPENDIX_D}}": sections.appendixDHtml ?? renderAppendixVersionLedgerPlaceholder(),
    "{{FOOTER_BRAND}}": footerBrand,
    "{{TIMESTAMP}}": timestamp,
  };

  for (const [key, value] of Object.entries(replacements)) {
    html = html.split(key).join(escTemplateValue(key, value));
  }

  html = html.replace(/(AI-Generated · )[^<]+(<\/span>)/i, `$1${aiBadge}$2`);
  return html;
}

function replaceTemplateBlock(
  _template: string,
  data: StructuredKbData,
  options?: { structureCoverageDebug?: number; versionDisplay?: string; schemaVersion?: string },
): string {
  const displayOrder = resolveStructuredKbDisplayOrder(data);
  return renderKbTemplateWithSections(
    data,
    {
      mainSectionsHtml: buildMainSections(data, displayOrder),
      kbConfigNote: "structured-full | Worker deterministic render",
    },
    options,
  );
}

function escTemplateValue(key: string, value: string): string {
  if (key === "{{MAIN_SECTIONS}}" || key === "{{NAV_ITEMS}}" || key === "{{APPENDIX_A}}" ||
      key === "{{APPENDIX_B}}" || key === "{{APPENDIX_C}}" || key === "{{APPENDIX_D}}" ||
      key === "{{LANG_TOGGLE}}") {
    return value;
  }
  return esc(value);
}

/** structured-kb-data → 完整 v2.91 HTML（不含 D1 version-ledger 合并） */
export function renderFullStructuredKnowledgeNetwork(
  data: StructuredKbData,
  options?: { structureCoverageDebug?: number; versionDisplay?: string; schemaVersion?: string },
): string {
  const normalized = adaptStructuredKbDataFromCodexKeys(data);
  const template = loadWorkerKbTemplate();
  return replaceTemplateBlock(template, normalized, options);
}
