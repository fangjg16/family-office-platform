#!/usr/bin/env python3
"""Render a v2.91 Project Knowledge Base HTML from structured JSON.

Usage:
  python render_kb_html.py kb-data.json assets/kb-template.html out.html
"""
from __future__ import annotations

import html
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

CIRCLED_NUMS = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"]

CANONICAL = [
    "snapshot",
    "target-overview",
    "industry-market",
    "business-operations",
    "legal-ownership",
    "regulatory-compliance",
    "resource-network",
    "comps-benchmark",
    "valuation-returns",
    "diligence-gaps",
    "risks-mitigation",
    "timeline-milestones",
    "decision-framework",
]

TITLES = {
    "snapshot": "项目快照",
    "target-overview": "资产构成 / 标的概况",
    "resource-network": "资源网络与关键协作",
    "industry-market": "行业背景与市场格局",
    "business-operations": "业务模式与运营假设",
    "legal-ownership": "法律结构与权属关系",
    "regulatory-compliance": "监管合规与许可路径",
    "comps-benchmark": "市场对标与可比案例",
    "valuation-returns": "投资回报与敏感性分析",
    "diligence-gaps": "待确认问题 / 尽调缺口",
    "risks-mitigation": "关键风险与缓释",
    "timeline-milestones": "项目时间轴",
    "decision-framework": "决策框架",
}

APPENDICES = {
    "source-index": ("A", "来源索引"),
    "glossary": ("B", "术语表"),
    "data-dictionary": ("C", "数据字典"),
    "version-ledger": ("D", "版本记录"),
}

NUMERALS = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二", "十三"]
CIRCLED = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪", "⑫", "⑬", "⑭", "⑮"]


def esc(value: Any) -> str:
    return html.escape(str(value if value is not None else ""), quote=True)


def slug(value: Any) -> str:
    text = re.sub(r"[^a-zA-Z0-9\u4e00-\u9fff]+", "-", str(value or "").strip().lower())
    return text.strip("-") or "item"


def first(row: dict[str, Any], *keys: str, default: Any = "") -> Any:
    for key in keys:
        value = row.get(key)
        if value not in (None, ""):
            return value
    return default


def as_list(value: Any) -> list[Any]:
    if value in (None, ""):
        return []
    return value if isinstance(value, list) else [value]


def has_any(row: dict[str, Any], keys: list[str]) -> bool:
    return any(row.get(k) for k in keys)


def render_value(value: Any) -> str:
    if isinstance(value, list):
        if not value:
            return ""
        return "<ul>" + "".join(f"<li>{esc(x)}</li>" for x in value) + "</ul>"
    if isinstance(value, dict):
        parts = [f"{esc(k)}: {esc(v)}" for k, v in value.items() if v not in (None, "", [])]
        return "<br>".join(parts)
    return esc(value)


def table(columns: list[tuple[str, list[str]]], rows: list[dict[str, Any]], class_name: str = "") -> str:
    if not rows:
        return ""
    cls = f' class="{class_name}"' if class_name else ""
    heads = "".join(f"<th>{esc(label)}</th>" for label, _ in columns)
    body = []
    for row in rows:
        cells = []
        for _, keys in columns:
            cells.append(f"<td>{render_value(first(row, *keys))}</td>")
        body.append("<tr>" + "".join(cells) + "</tr>")
    return f"<table{cls}><thead><tr>{heads}</tr></thead><tbody>{''.join(body)}</tbody></table>"


def missing_callout(items: list[str] | None = None) -> str:
    points = items or ["该板块暂无足够可核实资料。请补充项目方文件、交易资料或独立来源。"]
    return (
        '<aside class="callout missing"><div class="callout-title">缺乏资料</div><ul>'
        + "".join(f"<li>{esc(x)}</li>" for x in points)
        + "</ul></aside>"
    )


def link_citations(body: str) -> str:
    def repl(match: re.Match[str]) -> str:
        source_id = f"{match.group(1)}-{match.group(2)}"
        return f'<sup class="cite-ref"><a href="#source-{source_id}">[{source_id}]</a></sup>'

    return re.sub(r"\[(U|A)-(\d+)\]", repl, body)


def score(value: Any, default: str = "—") -> str:
    if value in (None, ""):
        return default
    text = str(value).strip()
    if text.endswith("%") or text == "—":
        return text
    if re.fullmatch(r"\d+(?:\.\d+)?", text):
        return f"{text}%"
    if "/" in text or re.fullmatch(r"[A-F][+-]?", text):
        return default
    return text


def render_nav(order: list[str], appendices: list[str]) -> str:
    items = []
    for index, key in enumerate(order):
        items.append(
            f'<li><button class="kb-nav-btn" data-target="{key}">'
            f'<span class="kb-nav-num">{NUMERALS[index]}</span><span>{esc(TITLES[key])}</span></button></li>'
        )
    for key in appendices:
        num, title = APPENDICES[key]
        items.append(
            f'<li><button class="kb-nav-btn" data-target="{key}">'
            f'<span class="kb-nav-num">{num}</span><span>{esc(title)}</span></button></li>'
        )
    return "\n".join(items)


def section(number: str, key: str, body: str, sub: str = "") -> str:
    sub_html = f'<p class="section-sub">{esc(sub)}</p>\n' if sub else ""
    return (
        f'<section class="block kb-panel" id="{key}">\n'
        f'<h2 class="section-title"><span class="section-num">{number}</span>{esc(TITLES[key])}</h2>\n'
        f"{sub_html}{link_citations(body)}\n</section>"
    )


def render_snapshot(slot: dict[str, Any]) -> str:
    rows = slot.get("facts") or slot.get("items") or slot.get("rows") or []
    if not rows:
        return missing_callout(slot.get("missing"))
    return table(
        [("项目项", ["label", "name", "key"]), ("内容", ["value", "text", "detail"]), ("证据/来源", ["source", "evidence"])],
        rows,
    )


def render_target_overview(slot: dict[str, Any]) -> str:
    rows = slot.get("rows") or slot.get("assets") or slot.get("items") or []
    if not rows:
        return missing_callout(slot.get("missing"))
    return table(
        [
            ("资产/权利/能力", ["asset", "right", "name", "item"]),
            ("定义与范围", ["definition", "scope", "description"]),
            ("可投资性", ["investability", "investmentCase", "status"]),
            ("关键证据/缺口", ["evidence", "gap", "source"]),
        ],
        rows,
    )


def render_resource_network(slot: dict[str, Any]) -> str:
    rows = slot.get("rows") or slot.get("resources") or slot.get("relationships") or []
    if not rows:
        return missing_callout(slot.get("missing"))
    return table(
        [
            ("主体/资源", ["party", "resource", "name"]),
            ("关系与作用", ["role", "relationship", "value"]),
            ("强度/可验证性", ["strength", "verification", "certainty"]),
            ("依赖与风险", ["dependency", "risk", "note"]),
        ],
        rows,
    )


def render_industry_market(slot: dict[str, Any]) -> str:
    rows = slot.get("rows") or slot.get("findings") or slot.get("dataPoints") or []
    if not rows:
        return missing_callout(slot.get("missing"))
    return table(
        [
            ("主题", ["topic", "driver", "metric"]),
            ("事实/数据", ["finding", "value", "data"]),
            ("投资含义", ["implication", "meaning"]),
            ("来源", ["source", "evidence"]),
        ],
        rows,
    )


def render_journey(data: dict[str, Any]) -> str:
    stages = [str(x) for x in data.get("stages", [])]
    lanes = data.get("lanes", [])
    if not stages or not lanes:
        return ""
    out = [f'<div class="journey-wrap"><div class="journey" style="--journey-cols:{len(stages)}">']
    out.append('<div class="journey-corner"></div>')
    out.extend(f'<div class="journey-stage">{esc(stage)}</div>' for stage in stages)
    for lane in lanes:
        out.append(f'<div class="journey-lane-label">{esc(first(lane, "label", "name"))}</div>')
        nodes = as_list(lane.get("nodes"))
        for idx in range(len(stages)):
            node = nodes[idx] if idx < len(nodes) else ""
            cls = "journey-node"
            text = ""
            if isinstance(node, dict):
                text = first(node, "text", "value", "label")
                if node.get("priority"):
                    cls += " priority"
            else:
                text = node
            if not text:
                cls += " empty"
            out.append(f'<div class="{cls}">{esc(text)}</div>')
    out.append("</div></div>")
    return "".join(out)


def render_process_flow(steps: list[dict[str, Any]]) -> str:
    if not steps:
        return ""
    out = ['<div class="process-flow">']
    for index, step in enumerate(steps):
        cls = "pf-step pf-step-end" if index == len(steps) - 1 else "pf-step"
        out.append(
            f'<div class="{cls}"><div class="pf-step-title">{esc(first(step, "title", "name", "stage"))}</div>'
            f'<div class="pf-step-body">{esc(first(step, "detail", "text", "description"))}</div>'
            f'<div class="pf-step-value">{esc(first(step, "value", "margin", "kpi"))}</div></div>'
        )
    out.append("</div>")
    return "".join(out)


def render_bmc(canvas: dict[str, Any]) -> str:
    if not canvas:
        return ""
    cells = [
        ("bmc-kp", "Key Partners", "keyPartners"),
        ("bmc-ka", "Key Activities", "keyActivities"),
        ("bmc-kr", "Key Resources", "keyResources"),
        ("bmc-vp", "Value Proposition", "valueProposition"),
        ("bmc-cr", "Customer Relationships", "customerRelationships"),
        ("bmc-ch", "Channels", "channels"),
        ("bmc-cs", "Customer Segments", "customerSegments"),
        ("bmc-cost", "Cost Structure", "costStructure"),
        ("bmc-rev", "Revenue Streams", "revenueStreams"),
    ]
    out = ['<div class="bmc">']
    for cls, label, key in cells:
        items = as_list(canvas.get(key))
        out.append(f'<div class="bmc-cell {cls}"><h5>{esc(label)}</h5><ul>')
        out.extend(f"<li>{esc(item)}</li>" for item in items)
        out.append("</ul></div>")
    out.append("</div>")
    return "".join(out)


def render_business_operations(slot: dict[str, Any]) -> str:
    body = []
    if slot.get("journey"):
        body.append(render_journey(slot["journey"]))
    elif slot.get("processFlow"):
        body.append(render_process_flow(slot["processFlow"]))
    elif slot.get("canvas"):
        body.append(render_bmc(slot["canvas"]))
    elif slot.get("revenueTree"):
        body.append(table([("收入层级", ["node", "name"]), ("驱动", ["driver"]), ("假设", ["assumption"]), ("证据", ["source", "evidence"])], slot["revenueTree"], "revenue-tree"))
    elif slot.get("flywheel"):
        body.append(table([("飞轮环节", ["step", "name"]), ("增强机制", ["mechanism"]), ("待验证指标", ["metric"])], slot["flywheel"], "flywheel-table"))
    elif slot.get("ecosystemMap"):
        body.append(table([("节点", ["node", "party"]), ("关系", ["relationship"]), ("价值流", ["valueFlow"])], slot["ecosystemMap"]))
    else:
        body.append(missing_callout(slot.get("missing")))

    body.append(table([("应用/产品场景", ["scenario", "useCase"]), ("价值主张", ["value"]), ("证据/缺口", ["evidence", "gap"])], slot.get("applications", [])))
    body.append(table([("客户/受众/付费方", ["customer", "payer", "segment"]), ("需求", ["need"]), ("获客/渠道", ["channel"]), ("验证状态", ["status", "evidence"])], slot.get("customers", [])))
    body.append(table([("收入来源", ["source", "stream"]), ("定价/费率", ["pricing", "price"]), ("成本/履约", ["cost", "fulfillment"]), ("单位经济/KPI", ["unitEconomics", "kpi", "metric"])], slot.get("economics", []) or slot.get("unitEconomics", [])))
    body.append(table([("待验证假设", ["assumption"]), ("为什么关键", ["why", "importance"]), ("验证方式", ["test", "nextStep"])], slot.get("assumptions", [])))
    return "\n".join(x for x in body if x)


def render_legal_ownership(slot: dict[str, Any]) -> str:
    body = []
    body.append(table([("主体/权利", ["entity", "right", "party"]), ("角色/归属", ["role", "owner", "ownership"]), ("限制/负担", ["restriction", "encumbrance"]), ("证据/缺口", ["evidence", "gap"])], slot.get("entities", []) or slot.get("rows", [])))
    body.append(table([("关系", ["relationship"]), ("从", ["from"]), ("到", ["to"]), ("状态", ["status"]), ("风险", ["risk"])], slot.get("relationships", [])))
    return "\n".join(x for x in body if x) or missing_callout(slot.get("missing"))


def render_regulatory_compliance(slot: dict[str, Any]) -> str:
    rows = slot.get("rows") or slot.get("requirements") or []
    if not rows:
        return missing_callout(slot.get("missing"))
    return table(
        [
            ("监管/规则", ["rule", "topic", "regime"]),
            ("适用原因", ["applicability", "reason"]),
            ("状态/许可", ["status", "license", "approval"]),
            ("红线/下一步", ["redFlag", "nextStep", "action"]),
        ],
        rows,
    )


def render_comps(slot: dict[str, Any]) -> str:
    rows = slot.get("rows") or slot.get("comps") or []
    if not rows:
        return missing_callout(slot.get("missing"))
    return table(
        [
            ("可比对象", ["name", "company", "case"]),
            ("可比逻辑", ["rationale", "basis"]),
            ("指标/倍数", ["metrics", "multiple", "valuation"]),
            ("可借鉴/差异", ["lesson", "difference"]),
        ],
        rows,
    )


def render_valuation_returns(slot: dict[str, Any]) -> str:
    body = []
    boxes = slot.get("valuationBoxes") or as_list(slot.get("valuationBox"))
    if boxes:
        body.append('<div class="valuation-grid">')
        for box in boxes:
            body.append(
                '<div class="valuation-box">'
                f'<div class="valuation-label">{esc(first(box, "label", "name"))}</div>'
                f'<div class="valuation-value">{esc(first(box, "value", "amount"))}</div>'
                f'<div class="valuation-note">{esc(first(box, "note", "basis"))}</div></div>'
            )
        body.append("</div>")
    scenarios = slot.get("scenarios", [])
    if scenarios:
        body.append('<div class="scenario-grid">')
        for sc in scenarios:
            cls = "scenario-card " + esc(str(first(sc, "case", "name", default="base")).lower())
            body.append(
                f'<div class="{cls}"><div class="sc-label">{esc(first(sc, "label", "name", "case"))}</div>'
                f'<div class="sc-irr">{esc(first(sc, "irr", "return", "value"))}</div>'
                f'<div class="sc-detail">{esc(first(sc, "detail", "assumption", "note"))}</div></div>'
            )
        body.append("</div>")
    body.append(table([("资金用途", ["use", "item"]), ("金额/比例", ["amount", "share"]), ("说明", ["note", "basis"])], slot.get("capitalUses", [])))
    body.append(table([("假设", ["assumption", "name"]), ("Base", ["base"]), ("Upside", ["upside"]), ("Downside", ["downside"]), ("证据", ["source", "evidence"])], slot.get("assumptions", [])))
    body.append(table([("敏感变量", ["variable"]), ("影响方向", ["impact"]), ("阈值/区间", ["range", "threshold"]), ("观察方式", ["monitoring", "source"])], slot.get("sensitivities", [])))
    return "\n".join(x for x in body if x) or missing_callout(slot.get("missing"))


def render_diligence_gaps(slot: dict[str, Any]) -> str:
    groups = slot.get("groups") or []
    if groups:
        out = ['<p class="section-sub">OPEN QUESTIONS · 按优先级排序</p>']
        counter = 0
        for group in groups:
            name = first(group, "name", "priority", "label")
            title = first(group, "title")
            label = " ".join(x for x in [str(name or ""), str(title or "")] if x).strip() or "待确认"
            rows = group.get("items") or group.get("rows") or []
            if not rows:
                continue
            items = []
            for row in rows:
                counter += 1
                num = CIRCLED_NUMS[counter - 1] if counter <= len(CIRCLED_NUMS) else f"{counter}."
                question = esc(first(row, "question", "claim", "item"))
                details = []
                if first(row, "why", "whyItMatters", "impact"):
                    details.append(f"影响：{esc(first(row, 'why', 'whyItMatters', 'impact'))}")
                if first(row, "owner"):
                    details.append(f"责任方：{esc(first(row, 'owner'))}")
                if first(row, "request", "nextStep", "action"):
                    details.append(f"下一步：{esc(first(row, 'request', 'nextStep', 'action'))}")
                detail_html = f'<span class="oq-action"> —— {"；".join(details)}</span>' if details else ""
                items.append(f'<li class="oq-item"><span class="oq-num">{num}</span>{question}{detail_html}</li>')
            out.append(
                '<details class="oq-group" open>'
                f'<summary><span class="oq-title">{esc(label)}</span><span class="oq-count">{len(rows)} 项</span></summary>'
                f'<ol class="oq-list">{"".join(items)}</ol>'
                "</details>"
            )
        return "\n".join(out)
    rows = slot.get("rows") or slot.get("items") or []
    if not rows:
        return missing_callout(slot.get("missing"))
    return table([("问题/主张", ["question", "claim", "item"]), ("证据强度", ["evidenceStrength", "strength"]), ("Owner", ["owner"]), ("紧急程度/阻塞", ["urgency", "blocker"]), ("需要资料/动作", ["request", "nextStep"])], rows)


def render_risks(slot: dict[str, Any]) -> str:
    rows = slot.get("rows") or slot.get("risks") or []
    if not rows:
        return missing_callout(slot.get("missing"))
    body = table(
        [
            ("级别", ["severity", "level"]),
            ("风险", ["risk", "title"]),
            ("原因/触发", ["cause", "trigger"]),
            ("影响", ["impact"]),
            ("证据", ["evidence", "source"]),
            ("缓释/负责人/状态", ["mitigation", "owner", "status"]),
        ],
        rows,
        "risk-matrix-table",
    )
    red_flags = slot.get("redFlags") or []
    if red_flags:
        body += "\n" + table([("停推条件", ["condition", "risk"]), ("触发动作", ["action"]), ("Owner", ["owner"])], red_flags)
    return body


def timeline_bucket(row: dict[str, Any]) -> str:
    raw = str(first(row, "bucket", "status", "kind", default="")).lower()
    if raw in {"past", "occurred", "已发生"}:
        return "past"
    if raw in {"ongoing", "in-progress", "推进中", "正在推进"}:
        return "ongoing"
    return "future"


def render_timeline_items(rows: list[dict[str, Any]], bucket: str) -> str:
    picked = [row for row in rows if timeline_bucket(row) == bucket]
    if not picked:
        return missing_callout(["暂无已核实的项目级节点。"])
    out = ['<div class="timeline">']
    for row in picked:
        cls = "tl-item timeline-ongoing" if bucket == "ongoing" else "tl-item"
        if bucket == "future":
            cls = "tl-item timeline-deadline"
        out.append(
            f'<div class="{cls}"><span class="tl-date">{esc(first(row, "date", "when", "time"))}</span>'
            f'<span class="tl-text"><strong>{esc(first(row, "title", "event", "milestone"))}</strong> '
            f'{esc(first(row, "detail", "description", "note"))}</span></div>'
        )
    out.append("</div>")
    return "".join(out)


def render_timeline(slot: dict[str, Any]) -> str:
    rows = slot.get("rows") or slot.get("items") or []
    intro = '<p class="section-sub">PROJECT TIMELINE · 仅记录项目自身节点，不放行业动向、市场趋势或研究动作</p>'
    return (
        intro
        + "<h3>8.1 已发生关键事件</h3>"
        + render_timeline_items(rows, "past")
        + "<h3>8.2 正在推进</h3>"
        + render_timeline_items(rows, "ongoing")
        + "<h3>8.3 未来关键节点</h3>"
        + render_timeline_items(rows, "future")
    )


def render_decision_framework(slot: dict[str, Any]) -> str:
    body = []
    if slot.get("recommendation"):
        body.append(f'<aside class="callout info"><div class="callout-title">条件式建议</div><p>{esc(slot["recommendation"])}</p></aside>')
    body.append(table([("投资论点", ["thesis", "argument"]), ("证据", ["evidence"]), ("前置条件", ["condition"]), ("反证/风险", ["counterpoint", "risk"])], slot.get("theses", [])))
    body.append(table([("选项", ["option", "name"]), ("好处", ["pros"]), ("代价/风险", ["cons", "tradeoff"]), ("适用条件", ["condition"])], slot.get("options", [])))
    body.append(table([("投后增值杠杆", ["lever", "valueLever"]), ("执行动作", ["action"]), ("Owner", ["owner"]), ("验证指标", ["metric"])], slot.get("valueLevers", [])))
    body.append(table([("下一步", ["action", "nextStep"]), ("Owner", ["owner"]), ("时间", ["timing", "date"]), ("交付物", ["deliverable"])], slot.get("nextActions", [])))
    if slot.get("icReadiness"):
        body.append(f'<aside class="callout warning"><div class="callout-title">IC Readiness</div><p>{esc(slot["icReadiness"])}</p></aside>')
    return "\n".join(x for x in body if x) or missing_callout(slot.get("missing"))


RENDERERS = {
    "snapshot": render_snapshot,
    "target-overview": render_target_overview,
    "industry-market": render_industry_market,
    "business-operations": render_business_operations,
    "legal-ownership": render_legal_ownership,
    "regulatory-compliance": render_regulatory_compliance,
    "resource-network": render_resource_network,
    "comps-benchmark": render_comps,
    "valuation-returns": render_valuation_returns,
    "diligence-gaps": render_diligence_gaps,
    "risks-mitigation": render_risks,
    "timeline-milestones": render_timeline,
    "decision-framework": render_decision_framework,
}


def rendered_core_order(data: dict[str, Any]) -> list[str]:
    config = data.get("config", {})
    order = config.get("displayOrder") or config.get("display-order") or CANONICAL
    clean = [key for key in order if key in CANONICAL]
    return clean or CANONICAL


def render_sections(data: dict[str, Any], order: list[str]) -> tuple[str, list[str]]:
    slots = data.get("slots", {})
    sections = []
    visible = []
    for key in order:
        slot = slots.get(key, {})
        state = slot.get("state", "filled" if slot else "stub")
        if state == "empty":
            continue
        index = order.index(key)
        if slot.get("html"):
            body = str(slot["html"])
        else:
            body = RENDERERS[key](slot)
        sections.append(section(NUMERALS[index], key, body))
        visible.append(key)
    return "\n\n".join(sections), visible


def source_anchor(source_id: str) -> str:
    return "source-" + source_id.replace("_", "-")


def render_appendix_a(sources: list[dict[str, Any]]) -> str:
    if not sources:
        return ""
    rows = []
    for src in sources:
        sid = first(src, "id", default="")
        rows.append(
            {
                "id": f'<span id="{esc(source_anchor(str(sid)))}">{esc(sid)}</span>',
                "type": first(src, "type", "kind"),
                "title": first(src, "title", "name"),
                "author": first(src, "author", "source", "publisher"),
                "excerpt": first(src, "excerpt", "note"),
                "usedIn": ", ".join(as_list(first(src, "usedIn", "slots"))),
            }
        )
    body = table([("ID", ["id"]), ("类型", ["type"]), ("标题", ["title"]), ("主体", ["author"]), ("摘录/说明", ["excerpt"]), ("影响章节", ["usedIn"])], rows)
    body = body.replace("&lt;span", "<span").replace("&lt;/span&gt;", "</span>").replace("&quot;", '"').replace("&gt;", ">")
    return '<section class="block kb-panel" id="source-index"><h2 class="section-title"><span class="section-num">A</span>附录 A · 来源索引</h2>' + body + "</section>"


def render_appendix_b(terms: list[dict[str, Any]]) -> str:
    if not terms:
        return ""
    rows = []
    for term in terms:
        name = first(term, "term", "name")
        rows.append(
            f'<div class="glossary-row" id="term-{slug(name)}"><span class="term">{esc(name)}</span>'
            f'<span>{esc(first(term, "definition", "meaning"))}</span>'
            f'<span>{esc(first(term, "context", "slot"))}</span></div>'
        )
    return '<section class="block kb-panel" id="glossary"><h2 class="section-title"><span class="section-num">B</span>附录 B · 术语表</h2>' + "".join(rows) + "</section>"


def render_appendix_c(rows: list[dict[str, Any]]) -> str:
    if not rows:
        return ""
    body = table(
        [
            ("字段/模型项", ["field", "name", "item"]),
            ("口径/公式", ["definition", "formula", "method"]),
            ("样本范围/清洗逻辑", ["sample", "cleaning", "scope"]),
            ("Caveat", ["caveat", "limitation", "note"]),
        ],
        rows,
    )
    return '<section class="block kb-panel" id="data-dictionary"><h2 class="section-title"><span class="section-num">C</span>附录 C · 数据字典、模型假设与数据证据底稿</h2>' + body + "</section>"


def render_appendix_d(rows: list[dict[str, Any]]) -> str:
    if not rows:
        rows = [{"version": "v1.0", "time": datetime.now().date().isoformat(), "source": "Codex", "change": "Initial v2.91 render"}]
    body = table([("版本", ["version"]), ("时间", ["time", "date"]), ("父版本", ["parent", "parentVersion"]), ("来源", ["source"]), ("变更摘要", ["change", "summary"])], rows)
    return '<section class="block kb-panel" id="version-ledger"><h2 class="section-title"><span class="section-num">D</span>附录 D · 版本记录</h2>' + body + "</section>"


def config_block(data: dict[str, Any], order: list[str]) -> str:
    cfg = data.get("config", {})
    history = cfg.get("displayOrderHistory") or [f"{datetime.now().date().isoformat()} | intake | v2.91 initial order"]
    history_lines = "\n".join(f"  {line}" for line in history)
    return (
        "schema-version: 2.91\n"
        f"display-order: {', '.join(order)}\n"
        f"project-type: {cfg.get('projectType', cfg.get('project-type', 'unknown'))}\n"
        f"rendering-mode: {cfg.get('renderingMode', cfg.get('rendering-mode', 'chinese-only'))}\n"
        f"multi-asset: {str(cfg.get('multiAsset', cfg.get('multi-asset', False))).lower()}\n"
        f"config-version: {cfg.get('configVersion', cfg.get('config-version', 1))}\n"
        f"parent-version: {cfg.get('parentVersion', cfg.get('parent-version', 'none'))}\n"
        f"generated-at: {cfg.get('generatedAt', datetime.now().strftime('%Y-%m-%d %H:%M'))}\n"
        "display-order-history:\n"
        f"{history_lines}"
    )


def replace_config(template: str, block: str) -> str:
    return re.sub(r"<!--\s*KB-CONFIG\s*.*?-->", "<!-- KB-CONFIG\n" + block + "\n-->", template, count=1, flags=re.S)


def main() -> None:
    if len(sys.argv) != 4:
        print(__doc__.strip())
        raise SystemExit(2)

    data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8-sig"))
    template = Path(sys.argv[2]).read_text(encoding="utf-8-sig")
    output = Path(sys.argv[3])

    order = rendered_core_order(data)
    main_sections, visible = render_sections(data, order)
    sources = data.get("sources", []) or data.get("appendices", {}).get("source-index", [])
    terms = data.get("terms", []) or data.get("appendices", {}).get("glossary", [])
    data_dictionary = data.get("dataDictionary", []) or data.get("appendices", {}).get("data-dictionary", [])
    version_ledger = data.get("versionLedger", []) or data.get("appendices", {}).get("version-ledger", [])
    appendices = []
    if sources:
        appendices.append("source-index")
    if terms:
        appendices.append("glossary")
    if data_dictionary:
        appendices.append("data-dictionary")
    appendices.append("version-ledger")

    maturity = data.get("maturity", {})
    meta = data.get("meta", {})
    replacements = {
        "{{PAGE_TITLE}}": esc(meta.get("pageTitle", meta.get("title", "项目知识网络") + " · Project Knowledge Base")),
        "{{NAV_TITLE}}": esc(meta.get("navTitle", "项目知识网络")),
        "{{NAV_ITEMS}}": render_nav(visible, appendices),
        "{{LANG_TOGGLE}}": data.get("langToggle", ""),
        "{{VERSION}}": esc(meta.get("version", "v1.0")),
        "{{DATE}}": esc(meta.get("date", datetime.now().date().isoformat())),
        "{{STATUS_DD}}": esc(meta.get("status", "内部讨论")),
        "{{STAGE}}": esc(meta.get("stage", "初步分析")),
        "{{H1_TITLE}}": esc(meta.get("title", "项目知识网络")),
        "{{H1_SUB}}": esc(meta.get("subtitle", "")),
        "{{MASTHEAD_SUBTITLE}}": esc(meta.get("mastheadSubtitle", "Project Knowledge Base")),
        "{{MASTHEAD_LEAD}}": esc(meta.get("lead", "")),
        "{{FACTOR_A}}": esc(score(maturity.get("factorA"), "0%")),
        "{{FACTOR_A_NOTE}}": esc(maturity.get("factorANote", f"{len(visible)}/13 core slots rendered; score uses hard-evidence rules")),
        "{{FACTOR_B}}": esc(score(maturity.get("factorB"), "0%")),
        "{{FACTOR_B_NOTE}}": esc(maturity.get("factorBNote", "Source diversity scored by independent authoring parties")),
        "{{COMBINED}}": esc(score(maturity.get("combined"), "0%")),
        "{{MATURITY_TIER}}": esc(maturity.get("tier", "Bare Lead")),
        "{{AUTO_SUMMARY}}": link_citations(esc(meta.get("summary", ""))),
        "{{MAIN_SECTIONS}}": main_sections,
        "{{APPENDIX_A}}": render_appendix_a(sources),
        "{{APPENDIX_B}}": render_appendix_b(terms),
        "{{APPENDIX_C}}": render_appendix_c(data_dictionary),
        "{{APPENDIX_D}}": render_appendix_d(version_ledger),
        "{{FOOTER_BRAND}}": esc(meta.get("footerBrand", "合域 AI · Opportunistic Investments · Hermes v2.92")),
        "{{TIMESTAMP}}": esc(datetime.now().strftime("%Y-%m-%d %H:%M")),
        "{{PROJECT_TYPE}}": esc(data.get("config", {}).get("projectType", "unknown")),
        "{{RENDERING_MODE}}": esc(data.get("config", {}).get("renderingMode", "chinese-only")),
        "{{MULTI_ASSET}}": esc(str(data.get("config", {}).get("multiAsset", False)).lower()),
        "{{INTAKE_DATE}}": esc(datetime.now().date().isoformat()),
    }

    html_out = replace_config(template, config_block(data, order))
    for key, value in replacements.items():
        html_out = html_out.replace(key, value)
    unresolved = re.findall(r"\{\{[A-Z0-9_]+\}\}", html_out)
    if unresolved:
        raise SystemExit(f"Unresolved placeholders: {sorted(set(unresolved))}")
    output.write_text(html_out, encoding="utf-8")
    print(f"OK: rendered {output} ({len(visible)} core slots, {len(appendices)} appendices)")


if __name__ == "__main__":
    main()
