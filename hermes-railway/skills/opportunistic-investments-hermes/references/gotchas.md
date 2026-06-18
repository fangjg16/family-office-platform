# Gotchas

These are the high-value rules that prevent common failure modes.

1. Do not use floating section references such as "第七节" in body content. Use anchors such as `#valuation-returns`.
2. `business-operations` describes target/platform revenue and operating mechanics; `valuation-returns` describes investor economics such as IRR/MOIC.
3. Reorder operations must not rewrite content panels. Hash slot bodies before and after if possible.
4. Multi-asset asymmetry must be visible. Never average away the fact that one asset has much more data than another.
5. Missing data should be specific: say what is missing, who can provide it, and what it unlocks.
6. Source count is not file count. Count independent authoring parties.
7. Party-stated and analyst-inferred claims must name the party or analyst basis.
8. Overseas target assets trigger bilingual mode even if the buyer is Chinese.
9. AI-generated files use `[AI]` prefix; user-uploaded materials do not.
10. If the KB lacks `KB-CONFIG` or line `schema-version: 2.91` inside the HTML comment, do not incremental-update it. Full rebuild first. Do not use JSON-only script blocks for KB-CONFIG.
11. IC memo should not claim a Word file exists unless a docx tool actually generated one.
12. Public-info research must separate external evidence from user-uploaded/internal evidence.
13. PUT must use `scripts/jfo_kb_put.sh` only — never hand-build curl/python PUT (Bearer redaction breaks inline scripts).
14. Read skills from `/opt/data/skills/opportunistic-investments-hermes/`, not `~/.hermes/skills`.
15. Full rebuild: do not `web_search` unless the user explicitly asks for external research.
