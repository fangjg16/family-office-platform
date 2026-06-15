#!/usr/bin/env python3
"""Render a Project Knowledge Base HTML from structured JSON and assets/kb-template.html.

This renderer is intentionally conservative. Put pre-vetted section body HTML in
`slots.<slot>.html`; use assets/components.html for allowed classes.

Usage:
  python render_kb_html.py kb-data.json assets/kb-template.html out.html
"""
from __future__ import annotations

import html
import json
import sys
from datetime import datetime
from pathlib import Path

TITLES = {
    "snapshot": "项目快照",
    "assets": "资产构成 / 平台能力与资源",
    "legal-relationships": "法律结构与关键关系网",
    "business-model": "业务模式与收入假设",
    "capital-structure": "融资结构与资本结构",
    "comps": "市场对标与可比交易",
    "returns": "投资回报与敏感性分析",
    "timeline": "项目时间轴",
    "risks": "关键风险与缓释",
    "open-questions": "待确认问题清单",
    "decision-framework": "决策框架",
}
NUMERALS = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一"]
TIMELINE_KIND_BADGES = {
    "已发生": "timeline-past",
    "推进中": "timeline-ongoing",
    "外部依赖": "timeline-dependency",
    "截止": "timeline-deadline",
    "past": "timeline-past",
    "ongoing": "timeline-ongoing",
    "dependency": "timeline-dependency",
    "deadline": "timeline-deadline",
}
TIMELINE_KIND_LABELS = {
    "past": "已发生",
    "ongoing": "推进中",
    "dependency": "外部依赖",
    "deadline": "截止",
    "future": "未来关键节点",
}
TIMELINE_BUCKETS = {
    "已发生": "past",
    "past": "past",
    "occurred": "past",
    "推进中": "ongoing",
    "正在推进": "ongoing",
    "ongoing": "ongoing",
    "in-progress": "ongoing",
    "外部依赖": "future",
    "dependency": "future",
    "截止": "future",
    "deadline": "future",
    "未来": "future",
    "未来关键节点": "future",
    "future": "future",
}
RISK_LEVEL_CLASS = {
    "致命": "risk-level-critical",
    "critical": "risk-level-critical",
    "Critical": "risk-level-critical",
    "高": "risk-level-high",
    "high": "risk-level-high",
    "High": "risk-level-high",
    "中": "risk-level-medium",
    "medium": "risk-level-medium",
    "Medium": "risk-level-medium",
    "低": "risk-level-low",
    "low": "risk-level-low",
    "Low": "risk-level-low",
}
RISK_LEVEL_LABEL = {
    "critical": "致命",
    "Critical": "致命",
    "high": "高",
    "High": "高",
    "medium": "中",
    "Medium": "中",
    "low": "低",
    "Low": "低",
}
CIRCLED_NUMS = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪", "⑫", "⑬", "⑭", "⑮"]


def esc(x: object) -> str:
    return html.escape(str(x if x is not None else ""), quote=True)


def missing_callout(items: list[str]) -> str:
    lis = "".join(f"<li>{esc(x)}</li>" for x in items)
    return f'<aside class="callout missing"><div class="callout-title">缺乏资料</div><ul>{lis}</ul></aside>'


def render_nav(order: list[str], has_sources: bool = False, has_terms: bool = False) -> str:
    # The template already includes the overview nav item; render only slot/appendix items here.
    items = []
    for i, key in enumerate(order):
        title = TITLES.get(key, key)
        num = NUMERALS[i] if i < len(NUMERALS) else str(i + 1)
        items.append(f'<li><button class="kb-nav-btn" data-target="{key}"><span class="kb-nav-num">{num}</span><span>{esc(title)}</span></button></li>')
    if has_sources:
        items.append('<li><button class="kb-nav-btn" data-target="source-index"><span class="kb-nav-num">A</span><span>来源索引</span></button></li>')
    if has_terms:
        items.append('<li><button class="kb-nav-btn" data-target="glossary"><span class="kb-nav-num">B</span><span>术语表</span></button></li>')
    return "\n".join(items)


def render_sections(data: dict, order: list[str]) -> str:
    slots = data.get("slots", {})
    sections = []
    for i, key in enumerate(order):
        slot = slots.get(key, {})
        state = slot.get("state", "empty")
        if state == "empty":
            continue
        num = NUMERALS[i] if i < len(NUMERALS) else str(i + 1)
        title = TITLES.get(key, key)
        if key == "snapshot" and (slot.get("facts") or slot.get("items")):
            body = render_snapshot(slot)
        elif key == "assets" and (slot.get("rows") or slot.get("assets")):
            body = render_assets(slot)
        elif key == "legal-relationships" and (slot.get("entities") or slot.get("relationships") or slot.get("rows")):
            body = render_legal_relationships(slot)
        elif key == "business-model" and has_any(slot, ["journey", "processFlow", "canvas", "revenueTree", "valueChain", "flywheel", "ecosystemMap", "valuationBox", "valuationBoxes", "rows", "topics"]):
            body = render_business_model(slot)
        elif key == "capital-structure" and has_any(slot, ["sourcesUses", "capitalStack", "rows"]):
            body = render_capital_structure(slot)
        elif key == "comps" and slot.get("rows"):
            body = render_comps(slot)
        elif key == "returns" and has_any(slot, ["valuationBox", "valuationBoxes", "scenarios", "assumptions", "sensitivities", "rows"]):
            body = render_returns(slot)
        elif key == "timeline" and slot.get("rows"):
            body = render_timeline_list(slot.get("rows", []))
        elif key == "risks" and slot.get("rows"):
            body = render_risk_matrix(slot.get("rows", []))
        elif key == "open-questions" and (slot.get("groups") or slot.get("items")):
            body = render_open_questions(slot)
        elif key == "decision-framework" and has_any(slot, ["recommendation", "valuationBox", "valuationBoxes", "theses", "valueLevers", "options", "blockers", "pros", "cons", "nextActions", "rows"]):
            body = render_decision_framework(slot)
        else:
            body = slot.get("html", "")
        body = link_citations(body)
        if not body and state == "stub":
            body = missing_callout(slot.get("missing", ["该章节尚缺少可核实资料。请补充具体文件或来源。"]))
        sections.append(f'<section class="block kb-panel" id="{key}">\n<h2 class="section-title"><span class="section-num">{num}</span>{esc(title)}</h2>\n{body}\n</section>')
    return "\n\n".join(sections)


def has_any(data: dict, keys: list[str]) -> bool:
    return any(data.get(k) for k in keys)


def first(row: dict, *keys: str) -> object:
    for key in keys:
        if key in row and row.get(key) not in (None, ""):
            return row.get(key)
    return ""


def as_list(value: object) -> list:
    if not value:
        return []
    if isinstance(value, list):
        return value
    return [value]


def render_list_value(value: object) -> str:
    if isinstance(value, list):
        if not value:
            return ""
        return "<ul>" + "".join(f"<li>{esc(x)}</li>" for x in value) + "</ul>"
    return esc(value)


def render_table(columns: list[tuple[str, list[str]]], rows: list[dict], class_name: str = "") -> str:
    if not rows:
        return ""
    cls = f' class="{class_name}"' if class_name else ""
    heads = "".join(f"<th>{esc(label)}</th>" for label, _ in columns)
    body = []
    for row in rows:
        cells = []
        for _, keys in columns:
            value = first(row, *keys)
            cells.append(f"<td>{render_list_value(value)}</td>")
        body.append("<tr>" + "".join(cells) + "</tr>")
    return f"<table{cls}><thead><tr>{heads}</tr></thead><tbody>{''.join(body)}</tbody></table>"


def render_snapshot(slot: dict) -> str:
    rows = slot.get("facts") or slot.get("items") or []
    normalized = []
    for item in rows:
        if isinstance(item, dict):
            normalized.append({"label": first(item, "label", "name", "key"), "value": first(item, "value", "text", "detail"), "source": first(item, "source")})
        else:
            normalized.append({"label": "要点", "value": item, "source": ""})
    return (
        '<p class="section-sub">PROJECT SNAPSHOT · 关键事实</p>\n'
        + render_table([("项目项", ["label"]), ("内容", ["value"]), ("来源", ["source"])], normalized)
    )


def render_assets(slot: dict) -> str:
    rows = slot.get("rows") or slot.get("assets") or []
    return (
        '<p class="section-sub">ASSETS & RESOURCES · 资产 / 权利 / 平台资源</p>\n'
        + render_table(
            [
                ("资产/资源", ["asset", "name", "resource"]),
                ("类型/状态", ["type", "status"]),
                ("控制/权属", ["control", "ownership", "owner"]),
                ("证据", ["evidence", "source"]),
                ("缺口/备注", ["gap", "notes", "missing"]),
            ],
            rows,
        )
    )


def render_legal_relationships(slot: dict) -> str:
    parts = ['<p class="section-sub">LEGAL RELATIONSHIPS · 实体 / 权属 / 合同依赖</p>']
    entities = slot.get("entities") or []
    if entities:
        highlighted = entities[0]
        parts.append('<div class="org-chart">')
        parts.append(f'<div class="org-node highlight"><small>{esc(first(highlighted, "role", "type") or "核心实体")}</small><strong>{esc(first(highlighted, "name", "entity"))}</strong></div>')
        rest = entities[1:]
        if rest:
            parts.append('<div class="org-line"></div><div class="org-branch">')
            for node in rest:
                parts.append(f'<div class="org-node"><small>{esc(first(node, "role", "type"))}</small><strong>{esc(first(node, "name", "entity"))}</strong></div>')
            parts.append("</div>")
        parts.append("</div>")
    rows = slot.get("relationships") or slot.get("rows") or []
    if rows:
        parts.append(render_table(
            [
                ("主体/关系", ["relationship", "party", "entity"]),
                ("权利/义务", ["rights", "obligation", "detail"]),
                ("控制/依赖", ["control", "dependency", "owner"]),
                ("证据/缺口", ["evidence", "source", "gap"]),
            ],
            rows,
        ))
    return "\n".join(parts)


def render_business_model(slot: dict) -> str:
    parts = ['<p class="section-sub">BUSINESS MODEL · 收入路径 / 客户 / 定价 / 供应链</p>']
    if slot.get("journey"):
        parts.append(render_journey(slot["journey"]))
    if slot.get("processFlow"):
        parts.append(render_process_flow(slot["processFlow"]))
    if slot.get("canvas"):
        parts.append(render_bmc(slot["canvas"]))
    if slot.get("revenueTree"):
        parts.append(render_revenue_tree(slot["revenueTree"]))
    if slot.get("valueChain"):
        parts.append(render_value_chain(slot["valueChain"]))
    if slot.get("flywheel"):
        parts.append(render_flywheel(slot["flywheel"]))
    if slot.get("ecosystemMap"):
        parts.append(render_ecosystem_map(slot["ecosystemMap"]))
    if slot.get("valuationBox") or slot.get("valuationBoxes"):
        parts.append(render_valuation_boxes(as_list(slot.get("valuationBoxes") or slot.get("valuationBox"))))
    if slot.get("topics"):
        for topic in slot["topics"]:
            title = esc(first(topic, "title", "name"))
            count = esc(first(topic, "status", "count") or "研究要点")
            body = render_list_value(first(topic, "items", "body", "findings"))
            parts.append(f'<details class="topic" open><summary>{title}<span class="topic-count">{count}</span></summary><div class="topic-body">{body}</div></details>')
    if slot.get("rows"):
        parts.append(render_table(
            [
                ("要素", ["factor", "item", "name"]),
                ("当前判断", ["analysis", "value", "detail"]),
                ("证据", ["evidence", "source"]),
                ("缺口", ["gap", "missing"]),
            ],
            slot["rows"],
        ))
    return "\n".join(parts)


def render_journey(journey: dict) -> str:
    stages = journey.get("stages") or []
    paths = journey.get("paths") or []
    if not stages or not paths:
        return ""
    out = [f'<div class="journey-wrap"><div class="journey" style="--journey-cols:{len(stages)}">', '<div class="journey-corner"></div>']
    for i, stage in enumerate(stages):
        prefix = CIRCLED_NUMS[i] if i < len(CIRCLED_NUMS) else str(i + 1)
        out.append(f'<div class="journey-stage">{prefix} {esc(stage)}</div>')
    for path in paths:
        out.append(f'<div class="journey-lane-label">{esc(first(path, "label", "name"))}</div>')
        nodes = path.get("nodes") or []
        for node in nodes:
            if isinstance(node, dict):
                cls = "journey-node"
                if node.get("empty"):
                    cls += " empty"
                if node.get("priority"):
                    cls += " priority"
                text = esc(first(node, "text", "label", "value") or "—")
                note = first(node, "note", "detail")
                if note:
                    text += f'<br><small style="color:#888">{esc(note)}</small>'
                out.append(f'<div class="{cls}">{text}</div>')
            else:
                out.append(f'<div class="journey-node">{esc(node)}</div>')
    out.append("</div></div>")
    return "".join(out)


def render_process_flow(flow: dict) -> str:
    steps = flow.get("steps") or []
    if not steps:
        return ""
    out = ['<div class="process-flow">']
    for i, step in enumerate(steps):
        cls = "pf-step pf-step-end" if i == len(steps) - 1 else "pf-step"
        label = esc(first(step, "label", "name", "stage"))
        body = esc(first(step, "body", "detail", "description"))
        margin = esc(first(step, "margin", "value", "economics"))
        out.append(f'<div class="{cls}"><div class="pf-step-label">{label}</div><div class="pf-step-body"><p>{body}</p></div><div class="pf-step-margin">{margin}</div></div>')
        if i < len(steps) - 1:
            out.append('<div class="pf-arrow">→</div>')
    out.append("</div>")
    return "".join(out)


def render_bmc(canvas: dict) -> str:
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
        values = canvas.get(key) or []
        if not isinstance(values, list):
            values = [values]
        out.append(f'<div class="bmc-cell {cls}"><h5>{esc(label)}</h5><ul>{"".join(f"<li>{esc(v)}</li>" for v in values)}</ul></div>')
    out.append("</div>")
    return "".join(out)


def render_revenue_tree(tree: dict) -> str:
    groups = tree.get("groups") or tree.get("businessLines") or []
    rows = []
    for group in groups:
        children = group.get("items") or group.get("segments") or group.get("children") or []
        if not children:
            children = [{"name": first(group, "segment", "item", "name"), "revenue": first(group, "revenue", "amount"), "share": first(group, "share"), "note": first(group, "note", "source")}]
        for i, child in enumerate(children):
            group_cell = f'<td rowspan="{len(children)}"><strong>{esc(first(group, "name", "line", "businessLine"))}</strong></td>' if i == 0 else ""
            rows.append(
                "<tr>"
                + group_cell
                + f"<td>{esc(first(child, 'name', 'segment', 'item'))}</td>"
                + f"<td>{esc(first(child, 'revenue', 'amount', 'value'))}</td>"
                + f"<td>{esc(first(child, 'share', 'percent', 'percentage'))}</td>"
                + f"<td>{render_certainty(child.get('certainty'))} {esc(first(child, 'note', 'source', 'gap'))}</td>"
                + "</tr>"
            )
    for row in tree.get("rows") or []:
        rows.append(
            "<tr>"
            f"<td>{esc(first(row, 'line', 'businessLine', 'group'))}</td>"
            f"<td>{esc(first(row, 'segment', 'item', 'name'))}</td>"
            f"<td>{esc(first(row, 'revenue', 'amount', 'value'))}</td>"
            f"<td>{esc(first(row, 'share', 'percent', 'percentage'))}</td>"
            f"<td>{render_certainty(row.get('certainty'))} {esc(first(row, 'note', 'source', 'gap'))}</td>"
            "</tr>"
        )
    total = tree.get("total")
    if total:
        if isinstance(total, dict):
            total_value = esc(first(total, "revenue", "amount", "value"))
            total_note = esc(first(total, "note", "source"))
        else:
            total_value = esc(total)
            total_note = ""
        rows.append(f'<tr style="font-weight:600;background:rgba(114,47,55,.05)"><td colspan="2">合计</td><td>{total_value}</td><td>100%</td><td>{total_note}</td></tr>')
    if not rows:
        return ""
    label = esc(tree.get("label") or "收入拆解树")
    return (
        f'<p style="font-size:.75rem;color:#888;margin-bottom:.75rem">{label} · Revenue Tree</p>'
        "<table><thead><tr><th>业务线</th><th>细分</th><th>收入规模</th><th>占比</th><th>备注</th></tr></thead>"
        f"<tbody>{''.join(rows)}</tbody></table>"
    )


def render_value_chain(chain: dict) -> str:
    steps = chain.get("steps") or chain.get("rows") or []
    if not steps:
        return ""
    body = []
    for i, step in enumerate(steps):
        prefix = CIRCLED_NUMS[i] if i < len(CIRCLED_NUMS) else str(i + 1)
        body.append(
            "<tr>"
            f"<td><strong>{prefix} {esc(first(step, 'stage', 'step', 'name'))}</strong></td>"
            f"<td>{esc(first(step, 'capability', 'currentCapability', 'targetCapability'))}</td>"
            f"<td>{esc(first(step, 'benchmark', 'industryBenchmark'))}</td>"
            f"<td>{render_strength_badge(first(step, 'moat', 'strength', 'rating'))} {esc(first(step, 'moatNote', 'advantage', 'note'))}</td>"
            f"<td>{render_certainty(step.get('certainty'))} {esc(first(step, 'source'))}</td>"
            "</tr>"
        )
    label = esc(chain.get("label") or "价值链图")
    return (
        f'<p style="font-size:.75rem;color:#888;margin-bottom:.75rem">{label} · Value Chain</p>'
        '<div style="overflow-x:auto;margin:1.25rem 0"><table style="min-width:36rem">'
        "<thead><tr><th>环节</th><th>标的当前能力</th><th>行业基准</th><th>护城河评估</th><th>来源</th></tr></thead>"
        f"<tbody>{''.join(body)}</tbody></table></div>"
    )


def render_strength_badge(value: object) -> str:
    text = str(value or "").strip() or "待评估"
    lower = text.lower()
    if any(x in lower for x in ["strong", "high"]) or any(x in text for x in ["强", "高"]):
        cls = "badge-green"
    elif any(x in lower for x in ["medium", "moderate"]) or any(x in text for x in ["中"]):
        cls = "badge-amber"
    else:
        cls = "badge-blue"
    return f'<span class="badge {cls}">{esc(text)}</span>'


def render_flywheel(flywheel: dict) -> str:
    nodes = flywheel.get("nodes") or flywheel.get("steps") or []
    if not nodes:
        return ""
    title = esc(flywheel.get("title") or "增长飞轮")
    node_html = []
    for i, node in enumerate(nodes):
        prefix = CIRCLED_NUMS[i] if i < len(CIRCLED_NUMS) else str(i + 1)
        text = esc(first(node, "text", "label", "name") if isinstance(node, dict) else node)
        label = esc(first(node, "stage", "type") if isinstance(node, dict) else "")
        bg = "rgba(114,47,55,.06)" if i == len(nodes) - 1 else "var(--paper)"
        node_html.append(
            f'<div style="flex:0 0 calc(33% - 1.5rem);min-width:8rem;border:1px solid rgba(114,47,55,.25);border-radius:4px;padding:.75rem;background:{bg}">'
            f'<div style="font-size:.62rem;font-weight:700;color:var(--burgundy);text-transform:uppercase;letter-spacing:.06em;margin-bottom:.35rem">{prefix} {label}</div>'
            f'<div style="font-size:.82rem;color:#4a4540">{text}</div></div>'
        )
        if i < len(nodes) - 1:
            node_html.append('<div style="display:flex;align-items:center;color:var(--burgundy);font-size:1.2rem">→</div>')
    assumption = esc(flywheel.get("assumption") or flywheel.get("coreAssumption") or "")
    assumption_html = ""
    if assumption:
        assumption_html = f'<p style="margin-top:1rem;font-size:.8rem;color:#4a4540"><strong>飞轮核心假设</strong>：{assumption} {render_certainty(flywheel.get("certainty"))} {esc(flywheel.get("source") or "")}</p>'
    return (
        '<div style="border:1px solid rgba(114,47,55,.2);border-radius:6px;padding:1.5rem;margin:1.25rem 0;background:rgba(255,255,255,.4)">'
        f'<p style="text-align:center;font-family:var(--serif);font-style:italic;color:var(--burgundy);margin-bottom:1.25rem">{title}</p>'
        f'<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:.75rem 1.5rem;text-align:center">{"".join(node_html)}'
        '<div style="flex-basis:100%;text-align:center;color:var(--burgundy);font-size:.75rem;font-style:italic">→ 循环回起点，飞轮加速</div></div>'
        f"{assumption_html}</div>"
    )


def render_ecosystem_map(ecosystem: dict) -> str:
    actors = ecosystem.get("actors") or ecosystem.get("rows") or []
    if not actors:
        return ""
    center = esc(ecosystem.get("center") or ecosystem.get("platform") or "平台 / 标的主体")
    rows = []
    for actor in actors:
        rows.append(
            "<tr>"
            f"<td><strong>{esc(first(actor, 'actor', 'name', 'party'))}</strong></td>"
            f"<td>{esc(first(actor, 'gives', 'valueGiven', 'toPlatform'))}</td>"
            f"<td>{esc(first(actor, 'receives', 'valueReceived', 'fromPlatform'))}</td>"
            f"<td>{render_strength_badge(first(actor, 'strength', 'relationshipStrength'))}</td>"
            "</tr>"
        )
    capture = ecosystem.get("valueCapture") or ecosystem.get("note")
    capture_html = f'<p style="font-size:.75rem;color:#888;margin-top:.5rem">{esc(capture)}</p>' if capture else ""
    return (
        '<div style="border:1px solid rgba(114,47,55,.2);border-radius:6px;padding:1.5rem;margin:1.25rem 0;background:rgba(255,255,255,.4)">'
        f'<div style="text-align:center;margin-bottom:1.25rem"><div style="display:inline-block;border:2px solid var(--burgundy);padding:.7rem 1.5rem;background:rgba(114,47,55,.08);font-family:var(--serif);font-size:.95rem;color:var(--burgundy)">{center}</div></div>'
        "<table><thead><tr><th>参与方</th><th>给平台的价值</th><th>从平台获取的价值</th><th>关系强度</th></tr></thead>"
        f"<tbody>{''.join(rows)}</tbody></table>{capture_html}</div>"
    )


def render_valuation_boxes(boxes: list) -> str:
    out = []
    for box in boxes:
        if not isinstance(box, dict):
            box = {"value": box}
        label = esc(first(box, "label", "title", "metric") or "估值 / 关键财务指标")
        value = esc(first(box, "value", "headline", "range", "figure"))
        note = esc(first(box, "note", "methodology", "method", "assumption"))
        certainty = render_certainty(box.get("certainty"))
        source = esc(box.get("source") or "")
        out.append(
            '<div class="valuation-box">'
            f'<p style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#888;margin-bottom:.35rem">{label}</p>'
            f'<div class="big">{value} {certainty}</div>'
            f'<p style="font-size:.8rem;color:#4a4540;margin-top:.5rem">{note} {source}</p>'
            "</div>"
        )
    return "".join(out)


def render_capital_structure(slot: dict) -> str:
    parts = ['<p class="section-sub">CAPITAL STRUCTURE · 资金来源 / 用途 / 优先级</p>']
    if slot.get("sourcesUses"):
        parts.append(render_table([("项目", ["item", "name"]), ("金额/比例", ["amount", "value", "share"]), ("来源/用途", ["type", "sourceUse"]), ("备注", ["notes", "source"])], slot["sourcesUses"]))
    if slot.get("capitalStack"):
        parts.append(render_table([("层级", ["layer", "rank"]), ("资金方", ["provider", "party"]), ("金额/比例", ["amount", "share"]), ("优先级/担保", ["priority", "security"]), ("关键条款/缺口", ["terms", "gap"])], slot["capitalStack"]))
    if slot.get("rows"):
        parts.append(render_table([("项目", ["item", "name"]), ("内容", ["value", "detail"]), ("来源", ["source"]), ("缺口", ["gap"])], slot["rows"]))
    return "\n".join(parts)


def render_comps(slot: dict) -> str:
    return (
        '<p class="section-sub">COMPARABLES · 市场信号 / 可比性 / 局限</p>\n'
        + render_table(
            [
                ("可比项/数据集", ["name", "comp", "dataset"]),
                ("可比理由", ["rationale", "whyComparable"]),
                ("价格/倍数/信号", ["signal", "price", "multiple", "value"]),
                ("局限", ["caveat", "limitation"]),
                ("来源", ["source"]),
            ],
            slot.get("rows") or [],
        )
    )


def render_returns(slot: dict) -> str:
    parts = ['<p class="section-sub">RETURNS · 情景 / 假设 / 敏感变量</p>']
    if slot.get("valuationBox") or slot.get("valuationBoxes"):
        parts.append(render_valuation_boxes(as_list(slot.get("valuationBoxes") or slot.get("valuationBox"))))
    scenarios = slot.get("scenarios") or []
    if scenarios:
        parts.append(render_scenario_cards(scenarios))
    if slot.get("assumptions"):
        parts.append(render_table([("假设", ["assumption", "item", "name"]), ("Base", ["base", "value"]), ("Downside", ["downside"]), ("Upside", ["upside"]), ("来源/缺口", ["source", "gap"])], slot["assumptions"]))
    if slot.get("sensitivities"):
        parts.append(render_table([("变量", ["driver", "variable"]), ("下行情景", ["downside"]), ("基准", ["base"]), ("上行情景", ["upside"]), ("影响", ["impact"])], slot["sensitivities"]))
    if slot.get("rows"):
        parts.append(render_table([("项目", ["item", "name"]), ("内容", ["value", "detail"]), ("来源/缺口", ["source", "gap"])], slot["rows"]))
    return "\n".join(parts)


def render_scenario_cards(scenarios: list[dict]) -> str:
    out = ['<div class="scenario-cards">']
    for s in scenarios:
        name = str(first(s, "name", "case", "label")).lower()
        cls = "base" if "base" in name or "基准" in name else "up" if "up" in name or "上行" in name else "down"
        label = esc(first(s, "label", "name", "case"))
        irr = esc(first(s, "irr", "return", "headline", "moic") or "待测算")
        detail = esc(first(s, "detail", "assumption", "notes"))
        out.append(f'<div class="scenario-card {cls}"><div class="sc-label">{label}</div><div class="sc-irr">{irr}</div><div class="sc-detail">{detail}</div></div>')
    out.append("</div>")
    return "".join(out)


def render_decision_framework(slot: dict) -> str:
    parts = ['<p class="section-sub">DECISION FRAMEWORK · 投资论点 / 增值杠杆 / 选项 / 行动</p>']
    if slot.get("recommendation"):
        reason = slot.get("recommendationReason") or slot.get("reason")
        reason_html = f'<p class="callout-hint">{esc(reason)}</p>' if reason else ""
        parts.append(f'<aside class="callout info"><div class="callout-title">当前建议</div><p>{esc(slot.get("recommendation"))}</p>{reason_html}</aside>')
    if slot.get("valuationBox") or slot.get("valuationBoxes"):
        parts.append(render_valuation_boxes(as_list(slot.get("valuationBoxes") or slot.get("valuationBox"))))
    if slot.get("theses"):
        parts.append("<h3>投资论点</h3>")
        parts.append(render_table(
            [
                ("论点", ["thesis", "claim", "item"]),
                ("证据", ["evidence"]),
                ("决策意义", ["implication", "meaning", "decisionMeaning"]),
                ("来源", ["source"]),
            ],
            slot["theses"],
        ))
    if slot.get("valueLevers"):
        parts.append("<h3>投后增值杠杆</h3>")
        parts.append(render_table(
            [
                ("杠杆", ["lever", "item", "name"]),
                ("金额/价值", ["amount", "value", "impact"]),
                ("概率", ["probability", "confidence"]),
                ("时间窗口", ["window", "timing", "timeWindow"]),
                ("前置条件/证据", ["condition", "evidence", "source"]),
            ],
            slot["valueLevers"],
        ))
    if slot.get("options"):
        parts.append("<h3>决策选项</h3>")
        parts.append(render_table([("选项", ["option", "name"]), ("适用条件", ["conditions", "condition"]), ("收益/优点", ["upside", "pros"]), ("风险/限制", ["risk", "cons"]), ("行动", ["action", "nextAction"])], slot["options"]))
    if slot.get("blockers"):
        blocker_items = slot.get("blockers") or []
        parts.append(
            '<aside class="callout warning"><div class="callout-title">阻塞下一步决策的事项</div><ul>'
            + "".join(f"<li>{render_list_value(x)}</li>" if not isinstance(x, dict) else f"<li><strong>{esc(first(x, 'item', 'blocker', 'question'))}</strong> — {esc(first(x, 'why', 'impact'))} {esc(first(x, 'source'))}</li>" for x in blocker_items)
            + "</ul></aside>"
        )
    if slot.get("pros") or slot.get("cons"):
        pros = slot.get("pros") or []
        cons = slot.get("cons") or []
        parts.append(
            '<div class="adv-grid"><div class="pros"><h4>支持推进的理由</h4><ul>'
            + "".join(f"<li>{esc(x)}</li>" for x in pros)
            + '</ul></div><div class="cons"><h4>暂停 / 降级理由</h4><ul>'
            + "".join(f"<li>{esc(x)}</li>" for x in cons)
            + "</ul></div></div>"
        )
    if slot.get("nextActions"):
        parts.append("<h3>下一步动作</h3>")
        parts.append(render_table([("下一步", ["action", "item"]), ("负责人", ["owner", "source"]), ("截止/窗口", ["deadline", "window", "timing"]), ("触发条件", ["trigger", "condition"])], slot["nextActions"]))
    if slot.get("rows"):
        parts.append(render_table([("维度", ["dimension", "item", "name"]), ("判断", ["judgment", "value"]), ("条件/行动", ["condition", "action"])], slot["rows"]))
    return "\n".join(parts)


def link_citations(text: str) -> str:
    """Convert plain [U-1]/[A-2] citations into appendix anchors.

    This is deliberately small and conservative; hand-authored HTML citations still work.
    """
    import re

    def repl(match: re.Match[str]) -> str:
        cid = match.group(1)
        return f'<span class="cite-ref"><a href="#source-{cid}">[{cid}]</a></span>'

    return re.sub(r"(?<![#\w-])\[((?:U|A)-\d+)\](?!</a>)", repl, text)


def timeline_sort_key(row: dict) -> str:
    return str(row.get("sortDate") or row.get("date") or "9999-99-99")


def timeline_sources(row: dict) -> str:
    src = row.get("source", "")
    if not src and row.get("sources"):
        src = " ".join(f"[{x}]" if not str(x).startswith("[") else str(x) for x in row.get("sources", []))
    return str(src)


def render_timeline_list(rows: list[dict]) -> str:
    if not rows:
        return ""
    grouped = {"past": [], "ongoing": [], "future": []}
    for row in sorted(rows, key=timeline_sort_key):
        grouped[timeline_bucket(row)].append(row)
    blocks = []
    if grouped["past"]:
        blocks.append("<h3>8.1 已发生关键事件</h3>\n" + render_timeline_past(grouped["past"]))
    if grouped["ongoing"]:
        blocks.append("<h3>8.2 当前正在推进的事项</h3>\n" + render_timeline_flat(grouped["ongoing"], pending=True))
    if grouped["future"]:
        blocks.append("<h3>8.3 未来关键节点</h3>\n" + render_timeline_future_table(grouped["future"]))
    return (
        '<p class="section-sub">已发生事件 · 当前推进 · 未来关键节点</p>\n'
        + "\n".join(blocks)
    )


def timeline_bucket(row: dict) -> str:
    raw_kind = str(row.get("kind") or row.get("type") or row.get("bucket") or "")
    bucket = TIMELINE_BUCKETS.get(raw_kind)
    if bucket:
        return bucket
    marker = " ".join(str(row.get(k, "")) for k in ("date", "status", "item", "event", "node"))
    if "进行中" in marker or "推进" in marker:
        return "ongoing"
    if "截止" in marker or "待定" in marker or "预计" in marker or "未来" in marker:
        return "future"
    return "past"


def render_timeline_past(rows: list[dict]) -> str:
    if len(rows) <= 4 and not any(row.get("yearSummary") or row.get("monthSummary") for row in rows):
        return render_timeline_flat(rows)
    years: dict[str, list[dict]] = {}
    for row in rows:
        year = timeline_year(row)
        years.setdefault(year, []).append(row)
    out = ['<div class="tl-tree">']
    ordered_years = sorted(years.keys(), reverse=True)
    for i, year in enumerate(ordered_years):
        year_rows = sorted(years[year], key=timeline_sort_key)
        summary = first_summary(year_rows, "yearSummary") or f"{len(year_rows)} 项已发生进展"
        open_attr = " open" if i == 0 else ""
        out.append(f'<details class="tl-year"{open_attr}><summary>{esc(year)} <span class="tl-year-sum">{esc(summary)}</span></summary><div class="tl-year-body">')
        months: dict[str, list[dict]] = {}
        for row in year_rows:
            months.setdefault(timeline_month(row), []).append(row)
        for month in sorted(months.keys()):
            month_rows = sorted(months[month], key=timeline_sort_key)
            month_summary = first_summary(month_rows, "monthSummary")
            month_label = esc(month)
            summary_html = f'<span class="tl-year-sum">{esc(month_summary)}</span>' if month_summary else ""
            out.append(f'<details class="tl-month" open><summary>{month_label}{summary_html}</summary><div class="tl-month-body">')
            out.append(render_timeline_flat(month_rows))
            out.append("</div></details>")
        out.append("</div></details>")
    out.append("</div>")
    return "".join(out)


def first_summary(rows: list[dict], key: str) -> str:
    for row in rows:
        if row.get(key):
            return str(row.get(key))
    return ""


def timeline_year(row: dict) -> str:
    value = str(row.get("sortDate") or row.get("date") or "待定")
    return value[:4] if len(value) >= 4 and value[:4].isdigit() else "待定"


def timeline_month(row: dict) -> str:
    value = str(row.get("sortDate") or row.get("date") or "")
    if len(value) >= 7 and value[5:7].isdigit():
        return f"{value[5:7]} 月"
    return "未定月份"


def render_timeline_flat(rows: list[dict], pending: bool = False) -> str:
    items = "".join(render_timeline_item(row, pending=pending) for row in rows)
    return f'<div class="timeline project-timeline">{items}</div>'


def render_timeline_item(row: dict, pending: bool = False) -> str:
    title = esc(row.get("item") or row.get("event") or row.get("node") or "")
    source = timeline_sources(row)
    source_html = f" <sup>{esc(source)}</sup>" if source else ""
    badge = render_timeline_importance(row, future=False)
    certainty = render_certainty(row.get("certainty"))
    details = []
    if row.get("asset"):
        details.append(f"标的：{esc(row.get('asset'))}")
    controller = row.get("controller") or row.get("owner") or row.get("dependency")
    if controller:
        details.append(f"控制方/依赖：{esc(controller)}")
    materiality = row.get("materiality") or row.get("impact")
    if materiality:
        details.append(f"重要性：{esc(materiality)}")
    trigger = row.get("trigger") or row.get("nextAction")
    if trigger:
        details.append(f"结果触发行动：{esc(trigger)}")
    details_html = "".join(f'<p class="tl-note">{x}</p>' for x in details)
    cls = "tl-item pending" if pending else "tl-item"
    date = row.get("date") or ("进行中" if pending else "待定")
    return (
        f'<div class="{cls}">'
        f'<span class="tl-date">{esc(date)}</span>'
        f'<span class="tl-text"><strong>{title}</strong> {badge} {certainty}{source_html}</span>'
        f"{details_html}"
        "</div>"
    )


def render_timeline_importance(row: dict, future: bool) -> str:
    raw = str(row.get("importance") or row.get("importanceLevel") or row.get("impactLevel") or "").strip()
    if not raw:
        raw = "中高" if future else "重要"
    if any(x in raw for x in ("极高", "关键", "高", "critical", "Critical")):
        cls = "badge-red"
        label = "极高" if future and "关键" not in raw else raw
    elif any(x in raw for x in ("中高", "重要", "medium", "Medium")):
        cls = "badge-amber"
        label = raw
    else:
        cls = "badge-blue"
        label = raw
    return f'<span class="badge {cls}">{esc(label)}</span>'


def render_timeline_future_table(rows: list[dict]) -> str:
    body = []
    for row in rows:
        source = timeline_sources(row)
        source_html = f" <sup>{esc(source)}</sup>" if source else ""
        node = esc(row.get("node") or row.get("item") or row.get("event") or "")
        expected = esc(row.get("expectedTime") or row.get("date") or "待定")
        impact = render_timeline_importance(row, future=True)
        trigger = esc(row.get("trigger") or row.get("nextAction") or "")
        cls = ' class="highlight-row"' if row.get("blocker") or "极高" in str(row.get("impactLevel") or row.get("importance") or "") else ""
        body.append(f"<tr{cls}><td><strong>{node}</strong>{source_html}</td><td>{expected}</td><td>{impact}</td><td>{trigger}</td></tr>")
    return (
        "<table><thead><tr><th>节点</th><th>预计时间</th><th>影响程度</th><th>结果触发行动</th></tr></thead>"
        f"<tbody>{''.join(body)}</tbody></table>"
    )


def render_certainty(value: object) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    lower = text.lower()
    if "✅" in text or "verified" in lower or "已核实" in text:
        cls = "tag-verified"
    elif "🟡" in text or "party" in lower or "声明" in text or "项目方" in text or "卖方" in text:
        cls = "tag-party"
    elif "🔵" in text or "analyst" in lower or "推论" in text:
        cls = "tag-analyst"
    elif "⚪" in text or "unconfirmed" in lower or "待确认" in text:
        cls = "tag-unconfirmed"
    else:
        cls = "tag-analyst"
    return f'<span class="tag {cls}">{esc(text)}</span>'


def render_risk_matrix(rows: list[dict]) -> str:
    if not rows:
        return ""

    def score(row: dict) -> int:
        try:
            return int(row.get("score") or 0)
        except (TypeError, ValueError):
            return 0

    ordered = sorted(rows, key=lambda r: (level_rank(r.get("level")), -score(r)))
    body_rows = []
    for row in ordered:
        raw_level = str(row.get("level") or "")
        label = RISK_LEVEL_LABEL.get(raw_level, raw_level or "待定")
        cls = RISK_LEVEL_CLASS.get(raw_level, "risk-level-medium")
        risk = esc(row.get("risk") or row.get("description") or row.get("item") or "")
        risk_meta = " · ".join(x for x in [str(row.get("id") or ""), str(row.get("category") or "")] if x)
        evidence_parts = [
            esc(row.get("evidence") or row.get("sourceFinding") or ""),
            render_certainty(row.get("certainty")),
            esc(row.get("source") or ""),
        ]
        mitigation = esc(row.get("mitigation") or row.get("mitigation-current") or row.get("mitigationCurrent") or "")
        mitigation_gap = row.get("mitigation-gap") or row.get("mitigationGap") or row.get("gap")
        if mitigation_gap:
            mitigation += f'<div class="risk-meta">缺口：{esc(mitigation_gap)}</div>'
        meta_bits = []
        if row.get("owner"):
            meta_bits.append(f"责任方：{esc(row.get('owner'))}")
        if row.get("trigger"):
            meta_bits.append(f"触发：{esc(row.get('trigger'))}")
        if meta_bits:
            mitigation += f'<div class="risk-meta">{"；".join(meta_bits)}</div>'
        body_rows.append(
            "<tr>"
            f'<td><span class="risk-level {cls}">{esc(label)}</span></td>'
            f"<td><strong>{risk}</strong>{f'<div class=\"risk-meta\">{esc(risk_meta)}</div>' if risk_meta else ''}</td>"
            f"<td>{' '.join(x for x in evidence_parts if x)}</td>"
            f"<td>{mitigation}</td>"
            "</tr>"
        )
    return (
        '<p class="section-sub">RISK MATRIX · 关键风险与缓释措施</p>\n'
        '<table class="risk-matrix-table"><thead><tr><th>级别</th><th>风险</th><th>证据</th><th>缓释措施</th></tr></thead>'
        f"<tbody>{''.join(body_rows)}</tbody></table>"
    )


def level_rank(level: object) -> int:
    label = RISK_LEVEL_LABEL.get(str(level), str(level or ""))
    return {"致命": 0, "高": 1, "中": 2, "低": 3}.get(label, 4)


def render_open_questions(slot: dict) -> str:
    groups = slot.get("groups") or [{"priority": "", "title": "待确认", "items": slot.get("items", [])}]
    blocks = ['<p class="section-sub">OPEN QUESTIONS · 按优先级排序</p>']
    counter = 0
    for group in groups:
        items = group.get("items") or []
        if not items:
            continue
        title = " ".join(x for x in [str(group.get("priority") or ""), str(group.get("title") or "")] if x).strip()
        body = []
        for item in items:
            counter += 1
            num = CIRCLED_NUMS[counter - 1] if counter <= len(CIRCLED_NUMS) else f"{counter}."
            question = esc(item.get("question") or item.get("item") or item.get("description") or "")
            details = []
            if item.get("why"):
                details.append(f"影响：{esc(item.get('why'))}")
            if item.get("owner"):
                details.append(f"责任方：{esc(item.get('owner'))}")
            if item.get("action"):
                details.append(f"下一步：{esc(item.get('action'))}")
            if item.get("status"):
                details.append(f"状态：{esc(item.get('status'))}")
            if item.get("source"):
                details.append(esc(item.get("source")))
            detail_html = f'<span class="oq-action"> —— {"；".join(details)}</span>' if details else ""
            body.append(f'<li class="oq-item"><span class="oq-num">{num}</span>{question}{detail_html}</li>')
        blocks.append(
            '<details class="oq-group" open>'
            f'<summary><span class="oq-title">{esc(title or "待确认")}</span><span class="oq-count">{len(items)} 项</span></summary>'
            f'<ol class="oq-list">{"".join(body)}</ol>'
            "</details>"
        )
    return "\n".join(blocks)


def config_block(cfg: dict) -> str:
    history = cfg.get("displayOrderHistory") or [f"{datetime.now().date().isoformat()} | render | Codex v2.8 render"]
    history_text = "\n".join(f"  {esc(x)}" for x in history)
    return """display-order: {order}
project-type: {ptype}
rendering-mode: {mode}
multi-asset: {multi}
config-version: {version}
display-order-history:
{history}""".format(
        order=", ".join(cfg.get("displayOrder", [])),
        ptype=esc(cfg.get("projectType", "unknown")),
        mode=esc(cfg.get("renderingMode", "chinese-only")),
        multi=str(cfg.get("multiAsset", False)).lower(),
        version=esc(cfg.get("configVersion", 1)),
        history=history_text,
    )


def render_appendix_a(data: dict) -> str:
    sources = data.get("sources") or []
    if not sources:
        return ""
    rows = []
    for src in sources:
        sid = esc(src.get("id", ""))
        rows.append(
            "<tr>"
            f"<td id=\"source-{sid}\">{sid}</td>"
            f"<td>{esc(src.get('type', ''))}</td>"
            f"<td>{esc(src.get('title', ''))}</td>"
            f"<td>{esc(src.get('excerpt', ''))}</td>"
            "</tr>"
        )
    return (
        '<section class="block kb-panel" id="source-index">\n'
        '<h2 class="section-title"><span class="section-num">A</span>附录 A · 来源索引</h2>\n'
        '<table><thead><tr><th>ID</th><th>类型</th><th>标题</th><th>摘录</th></tr></thead>'
        f"<tbody>{''.join(rows)}</tbody></table>\n"
        "</section>"
    )


def render_appendix_b(data: dict) -> str:
    terms = data.get("terms") or []
    if not terms:
        return ""
    rows = []
    for term in terms:
        if isinstance(term, str):
            rows.append(f"<tr><td><span class=\"glossary-term\">{esc(term)}</span></td><td>待补充</td><td>首次出现后补注</td></tr>")
        else:
            rows.append(
                "<tr>"
                f"<td><span class=\"glossary-term\">{esc(term.get('term', ''))}</span></td>"
                f"<td>{esc(term.get('definition', ''))}</td>"
                f"<td>{esc(term.get('context', ''))}</td>"
                "</tr>"
            )
    return (
        '<section class="block kb-panel" id="glossary">\n'
        '<h2 class="section-title"><span class="section-num">B</span>附录 B · 术语表</h2>\n'
        '<table><thead><tr><th>术语</th><th>解释</th><th>上下文</th></tr></thead>'
        f"<tbody>{''.join(rows)}</tbody></table>\n"
        "</section>"
    )


def main() -> None:
    if len(sys.argv) != 4:
        print(__doc__.strip())
        raise SystemExit(2)
    data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8-sig"))
    template = Path(sys.argv[2]).read_text(encoding="utf-8-sig")
    out = Path(sys.argv[3])
    project = data.get("project", {})
    cfg = data.get("kbConfig", {})
    order = cfg.get("displayOrder") or list(TITLES)
    maturity = data.get("maturity", {})
    version = data.get("version", "v1.0")
    appendix_a = data.get("appendixAHtml") or render_appendix_a(data)
    appendix_b = data.get("appendixBHtml") or render_appendix_b(data)
    replacements = {
        "{{PAGE_TITLE}}": esc(project.get("name", "项目知识网络")),
        "{{PROJECT_TYPE}}": esc(cfg.get("projectType", "unknown")),
        "{{RENDERING_MODE}}": esc(cfg.get("renderingMode", "chinese-only")),
        "{{MULTI_ASSET}}": str(cfg.get("multiAsset", False)).lower(),
        "{{INTAKE_DATE}}": esc(data.get("date", datetime.now().date().isoformat())),
        "{{NAV_TITLE}}": "项目知识网络",
        "{{NAV_ITEMS}}": render_nav(order, bool(appendix_a), bool(appendix_b)),
        "{{VERSION}}": esc(version),
        "{{LANG_TOGGLE}}": "" if cfg.get("renderingMode") != "bilingual" else '<div id="lang-toggle" class="kb-lang-toggle"><button class="lang-btn active" data-lang="zh" aria-pressed="true">中文</button><button class="lang-btn" data-lang="en" aria-pressed="false">EN</button></div>',
        "{{H1_TITLE}}": esc(project.get("name", "项目知识网络")),
        "{{H1_SUB}}": esc(project.get("subtitle", "")),
        "{{MASTHEAD_SUBTITLE}}": esc(project.get("jurisdiction", "")),
        "{{MASTHEAD_LEAD}}": esc(project.get("lead", "")),
        "{{DATE}}": esc(data.get("date", datetime.now().date().isoformat())),
        "{{STATUS_DD}}": esc(project.get("status", "Draft")),
        "{{STAGE}}": esc(maturity.get("tier", "Draft")),
        "{{FACTOR_A}}": esc(maturity.get("factorA", "—")),
        "{{FACTOR_A_NOTE}}": esc(maturity.get("factorANote", "Content completeness")),
        "{{FACTOR_B}}": esc(maturity.get("factorB", "—")),
        "{{FACTOR_B_NOTE}}": esc(maturity.get("factorBNote", "Source diversity")),
        "{{COMBINED}}": esc(maturity.get("combined", "—")),
        "{{MATURITY_TIER}}": esc(maturity.get("tier", "Draft")),
        "{{AUTO_SUMMARY}}": esc(data.get("summary", "")),
        "{{MAIN_SECTIONS}}": render_sections(data, order),
        "{{APPENDIX_A}}": appendix_a,
        "{{APPENDIX_B}}": appendix_b,
        "{{CHANGELOG_ROWS}}": data.get("changelogHtml", "<tr><td>v1.0</td><td>—</td><td>Codex</td><td>Initial render</td></tr>"),
        "{{FOOTER_BRAND}}": "合域 AI · Opportunistic Investments · Codex v2.8",
        "{{TIMESTAMP}}": esc(datetime.now().isoformat(timespec="seconds")),
    }
    html_out = template
    # Avoid expanding large generated blocks inside instructional comments.
    html_out = html_out.replace(
        "Replace {{NAV_TITLE}} and {{NAV_ITEMS}}",
        "Navigation title and items are generated below",
    )
    html_out = html_out.replace(
        "Replace {{MAIN_SECTIONS}} with all rendered slot HTML.",
        "Main sections are generated below.",
    )
    for k, v in replacements.items():
        html_out = html_out.replace(k, v)
    # Replace the body of the existing KB-CONFIG placeholder with canonical config text.
    html_out = html_out.replace(
        "display-order: snapshot, assets, legal-relationships, business-model, capital-structure, comps, returns, timeline, risks, open-questions, decision-framework\nproject-type: " + replacements["{{PROJECT_TYPE}}"] + "\nrendering-mode: " + replacements["{{RENDERING_MODE}}"] + "\nmulti-asset: " + replacements["{{MULTI_ASSET}}"] + "\nconfig-version: 1\ndisplay-order-history:\n  " + replacements["{{INTAKE_DATE}}"] + " | intake | 初始顺序，项目类型 " + replacements["{{PROJECT_TYPE}}"] + " 默认",
        config_block(cfg),
    )
    out.write_text(html_out, encoding="utf-8")
    print(f"OK: rendered {out}")


if __name__ == "__main__":
    main()
