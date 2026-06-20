import { WORKER_KB_TEMPLATE_HTML } from "./knowledge-network-kb-template-content";

/** Worker 嵌入的 canonical kb-template（与 Hermes skill 同步） */
export const WORKER_KB_TEMPLATE_PATH = "assets/kb-template.html";

/** 用于 drift 检测的关键结构标记 */
export const KB_TEMPLATE_STRUCTURE_MARKERS = [
  "schema-version: 2.91",
  "{{MAIN_SECTIONS}}",
  "{{APPENDIX_A}}",
  "{{APPENDIX_B}}",
  "{{APPENDIX_C}}",
  "{{APPENDIX_D}}",
  "{{NAV_ITEMS}}",
  'function revealAnchor(anchorId)',
  'id="overview"',
  'class="kb-shell"',
] as const;

let cachedTemplate: string | null = null;

export function loadWorkerKbTemplate(): string {
  if (!cachedTemplate) cachedTemplate = WORKER_KB_TEMPLATE_HTML;
  return cachedTemplate;
}

export function assertWorkerKbTemplateMarkers(template = loadWorkerKbTemplate()): string[] {
  const missing: string[] = [];
  for (const marker of KB_TEMPLATE_STRUCTURE_MARKERS) {
    if (!template.includes(marker)) missing.push(marker);
  }
  return missing;
}

export function compareKbTemplateWithHermesSkill(hermesTemplate: string): string[] {
  const missing: string[] = [];
  for (const marker of KB_TEMPLATE_STRUCTURE_MARKERS) {
    if (!hermesTemplate.includes(marker)) missing.push(`hermes missing: ${marker}`);
    if (!loadWorkerKbTemplate().includes(marker)) missing.push(`worker missing: ${marker}`);
  }
  return missing;
}
