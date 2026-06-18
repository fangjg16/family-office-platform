# Deep Reference - Knowledge Base Generation

Use by default for initial/full KB generation. Use for incremental work only when the user asks for a deep refresh, IC-facing output, or multiple slots are materially rewritten.

## Purpose
Raise KB depth without loading the full Codex workflow system. Keep the Hermes output stable: 13 core slots + Appendix A-D, deterministic template, validated HTML.

## Required Thinking
1. Build an evidence inventory before writing narrative.
2. Classify each finding as project fact, counterparty fact, asset fact, market context, regulatory fact, AI inference, or gap.
3. Route every finding to the canonical slot before drafting.
4. For each slot, separate: facts, interpretation, evidence strength, missing input, investment implication, next action.
5. Keep weak slots visible with missing callouts; do not delete them.
6. Keep Appendix A-D current: sources, glossary, data dictionary, version ledger.

## Quality Floor
- Header scorecard must be percentages, not counts or letter grades.
- Public research can enrich industry/comps/regulatory context, but cannot raise project-specific maturity beyond evidence caps.
- Timeline is project execution only; no industry history or AI workflow events.
- Decision framework must synthesize go / no-go / continue-with-conditions, not repeat assumptions.

## Speed Guardrail
Do not read every optional workflow file. Read only these short deep refs by default, plus slot-specific refs when the user requests deepening.
