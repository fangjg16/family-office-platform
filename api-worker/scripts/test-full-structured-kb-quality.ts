/**
 * Full Structured KB quality contract + maturity + publish/repair gate tests
 * 用法：cd api-worker && npx tsx scripts/test-full-structured-kb-quality.ts
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  publishStructuredKbWithOptionalRepair,
  tryWriteKnowledgeNetworkFromStructuredKbData,
  type AgentJobEnv,
  type AgentJobRow,
  type StructuredKbRepairRunner,
} from "../src/agent-jobs.ts";
import { computeDeterministicMaturity } from "../src/knowledge-network-deterministic-maturity.ts";
import {
  evaluateStructuredKbPublishGate,
  extractStructuredKbDataFromJson,
  renderStructuredKbDataToHtml,
} from "../src/knowledge-network-structured-kb-data.ts";
import {
  isStructuredQualityRegressed,
  isWorkerStructuredRenderedKb,
  scoreKnowledgeNetworkHtmlCoverage,
} from "../src/knowledge-network-html-coverage.ts";
import { validateFullStructuredKbQuality } from "../src/knowledge-network-full-quality-contract.ts";
import { countEmptyHtmlCells, countEmptyHtmlRows } from "../src/knowledge-network-content-row-quality.ts";
import { validateKnowledgeNetworkHtmlForWrite } from "../src/knowledge-network-html-validation.ts";
import { projectKnowledgeNetworkR2Key } from "../src/project-knowledge-network.ts";

const here = dirname(fileURLToPath(import.meta.url));
const thinPath = join(here, "fixtures/full-structured-kb-data-pet.json");
const richPath = join(here, "fixtures/full-structured-kb-data-pet-rich.json");
const v5EmptyPath = join(here, "fixtures/full-structured-kb-data-pet-v5-empty-rows.json");
const v3Path = "c:/Users/jensenfang/Downloads/[AI]_proj-87c4b0718f58_知识网络_v3.html";

let failed = 0;

function report(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `: ${detail}` : ""}`);
  if (!ok) failed += 1;
}

function loadJson(path: string) {
  const extracted = extractStructuredKbDataFromJson(readFileSync(path, "utf8"));
  if (!extracted.ok) throw new Error(`${path}: ${extracted.reason}`);
  return extracted.data;
}

function wrapAnswer(jsonBody: string): string {
  return `摘要\n\n\`\`\`json\n${jsonBody}\n\`\`\``;
}

type KnStore = {
  meta: {
    projectId: string;
    r2Key: string;
    version: number;
    versionLabel: string | null;
    updatedAt: string;
    updatedBy: string;
    lastJobId: string | null;
    changelog: string | null;
  } | null;
  html: string | null;
};

function createKnTestEnv(store: KnStore): AgentJobEnv {
  const r2 = new Map<string, string>();
  if (store.meta?.r2Key && store.html) {
    r2.set(store.meta.r2Key, store.html);
  }

  return {
    DB: {
      prepare(sql: string) {
        const normalized = sql.replace(/\s+/gu, " ").trim();
        return {
          bind(...args: unknown[]) {
            return {
              async first<T>(): Promise<T | null> {
                if (normalized.includes("FROM project_knowledge_networks WHERE") && store.meta) {
                  return {
                    project_id: store.meta.projectId,
                    r2_key: store.meta.r2Key,
                    version: store.meta.version,
                    version_label: store.meta.versionLabel,
                    updated_at: store.meta.updatedAt,
                    updated_by: store.meta.updatedBy,
                    last_job_id: store.meta.lastJobId,
                    changelog: store.meta.changelog,
                  } as T;
                }
                return null;
              },
              async all<T>() {
                return { results: [] as T[] };
              },
              async run() {
                if (normalized.includes("INSERT INTO project_knowledge_networks")) {
                  store.meta = {
                    projectId: String(args[0]),
                    r2Key: String(args[1]),
                    version: Number(args[2]),
                    versionLabel: (args[3] as string | null) ?? null,
                    updatedAt: String(args[4]),
                    updatedBy: String(args[5]),
                    lastJobId: (args[6] as string | null) ?? null,
                    changelog: (args[7] as string | null) ?? null,
                  };
                }
                return { success: true };
              },
            };
          },
        };
      },
    } as unknown as D1Database,
    FILES: {
      async get(key: string) {
        const t = r2.get(key);
        return t !== undefined ? { text: async () => t } : null;
      },
      async put(key: string, value: string) {
        r2.set(key, value);
        store.html = value;
      },
    } as unknown as R2Bucket,
  };
}

function baseJob(overrides?: Partial<AgentJobRow>): AgentJobRow {
  return {
    id: "job-q-1",
    project_id: "proj-q",
    user_id: "user-q",
    conversation_id: "conv-q",
    skill_intent: "knowledge_network",
    status: "running",
    hermes_run_id: "run-q",
    answer: null,
    knowledge_network_html: null,
    error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

const thin = loadJson(thinPath);
const rich = loadJson(richPath);
const v5Empty = loadJson(v5EmptyPath);
const thinJson = readFileSync(thinPath, "utf8");
const richJson = readFileSync(richPath, "utf8");
const thinQuality = validateFullStructuredKbQuality(thin);
const richQuality = validateFullStructuredKbQuality(rich);
const v5EmptyQuality = validateFullStructuredKbQuality(v5Empty);
// --- 1. thin → repair_needed ---
report("thin fixture fails quality contract", !thinQuality.ok, `coverage=${thinQuality.coverageScore}`);
report("thin publish gate → repairNeeded", !evaluateStructuredKbPublishGate(thin).ok);

// --- 1b. v5 empty rows detected ---
report(
  "v5-empty fixture has emptyRowIssues",
  v5EmptyQuality.emptyRowIssues.length >= 5,
  `count=${v5EmptyQuality.emptyRowIssues.length}`,
);
report(
  "v5-empty publishCoverage not 100",
  v5EmptyQuality.publishCoverage < 100,
  `publish=${v5EmptyQuality.publishCoverage}`,
);
report(
  "v5-empty Factor A not 100",
  computeDeterministicMaturity(v5Empty).factorA < 100,
  `A=${computeDeterministicMaturity(v5Empty).factorA}%`,
);
report("v5-empty fails ok gate", !v5EmptyQuality.ok);

const v5EmptyRendered = renderStructuredKbDataToHtml(v5Empty);
if (v5EmptyRendered.ok) {
  const eh = v5EmptyRendered.html;
  const targetSec = eh.match(/id="target-overview"[\s\S]*?<\/section>/i)?.[0] ?? "";
  report(
    "v5-empty renderer: no empty tbody cells in target-overview",
    countEmptyHtmlCells(targetSec) === 0,
    `emptyCells=${countEmptyHtmlCells(targetSec)}`,
  );
  report(
    "v5-empty renderer: gap callout instead of empty keyClaims table",
    targetSec.includes("资料缺口") && !/<tbody><tr><td><\/td>/i.test(targetSec),
  );
}

// --- 2. rich passes + components ---
const richRendered = renderStructuredKbDataToHtml(rich);
report("rich render ok", richRendered.ok);
if (richRendered.ok) {
  const html = richRendered.html;
  report("rich has quality-coverage in KB-CONFIG", /quality-coverage:\s*100/i.test(html));
  report("rich has scenario-cards", html.includes('class="scenario-cards"'));
  report("rich diligence uses details.topic", /id="diligence-gaps"[\s\S]*<details class="topic"/i.test(html));
  report("rich full strict HTML validation", validateKnowledgeNetworkHtmlForWrite(html, { mode: "full", strict: true }).ok);
}

// --- 3. single BP maturity cap ---
const m = computeDeterministicMaturity(rich);
report("single BP Factor B ≤ 25%", m.factorB <= 25, `B=${m.factorB}%`);
report("single BP Factor A ≤ 70%", m.factorA <= 70, `A=${m.factorA}%`);
report("single BP Combined ≤ 45%", m.combined <= 45, `Combined=${m.combined}%`);
report("rich richContractMet", richQuality.richContractMet);
report("rich publishCoverage 100 only when rich", richQuality.publishCoverage === 100);

// --- 4. old/new gate: v3 Hermes HTML 不误杀 rich JSON ---
try {
  const v3Html = readFileSync(v3Path, "utf8");
  report("v3 is not worker-structured", !isWorkerStructuredRenderedKb(v3Html));
  const gateVsV3 = evaluateStructuredKbPublishGate(rich, v3Html);
  report("rich vs v3 Hermes HTML → publish ok", gateVsV3.ok, gateVsV3.ok ? "" : ("message" in gateVsV3 ? gateVsV3.message.slice(0, 80) : ""));
  const reg = isStructuredQualityRegressed(v3Html, richQuality.coverageScore);
  report("structured regression skipped for v3", !reg.regressed, reg.reason);
} catch {
  report("rich vs v3 gate (optional file)", true, "skipped");
}

// --- 5. structured-to-structured regression ---
if (richRendered.ok) {
  const prevStructured = richRendered.html;
  const gateThinAfterRich = evaluateStructuredKbPublishGate(thin, prevStructured);
  report(
    "thin after rich structured → repairNeeded (not quality_blocked first)",
    !gateThinAfterRich.ok && "repairNeeded" in gateThinAfterRich && gateThinAfterRich.repairNeeded,
  );
  const regStructured = isStructuredQualityRegressed(prevStructured, thinQuality.coverageScore);
  report(
    "thin quality vs rich structured would regress",
    regStructured.regressed,
    `${regStructured.nextScore} vs ${regStructured.previousScore}`,
  );
}

// --- 6. repair pass: thin + mock rich repair → pass ---
async function testRepairPass(): Promise<void> {
  const store: KnStore = { meta: null, html: null };
  const env = createKnTestEnv(store);
  const row = baseJob();

  const mockRepair: StructuredKbRepairRunner = async () => ({
    ok: true,
    answer: wrapAnswer(richJson),
  });

  const written = await publishStructuredKbWithOptionalRepair(
    env,
    row,
    { answer: wrapAnswer(thinJson) },
    "full",
    { repairRunner: mockRepair },
  );
  report("thin + mock repair → ok", written.ok);
  report("thin + mock repair → repairAttempted", written.repairAttempted === true);
  report("thin + mock repair → meta written", Boolean(store.meta?.lastJobId === row.id));
  report("thin + mock repair → html has kb-shell", Boolean(store.html?.includes("kb-shell")));
}

// --- 7. repair still thin → no overwrite of existing rich KB ---
async function testRepairStillFails(): Promise<void> {
  const richHtml = richRendered.ok ? richRendered.html : "";
  const store: KnStore = {
    meta: {
      projectId: "proj-q2",
      r2Key: projectKnowledgeNetworkR2Key("proj-q2"),
      version: 2,
      versionLabel: null,
      updatedAt: new Date().toISOString(),
      updatedBy: "user-q",
      lastJobId: "prev-job",
      changelog: "rich v2",
    },
    html: richHtml,
  };
  const env = createKnTestEnv(store);
  const row = baseJob({ id: "job-q2", project_id: "proj-q2" });
  const prevVersion = store.meta!.version;

  const mockRepairStillThin: StructuredKbRepairRunner = async () => ({
    ok: true,
    answer: wrapAnswer(thinJson),
  });

  const written = await publishStructuredKbWithOptionalRepair(
    env,
    row,
    { answer: wrapAnswer(thinJson) },
    "full",
    { repairRunner: mockRepairStillThin },
  );
  report("repair still thin → not ok", !written.ok);
  report("repair still thin → keeps v2", store.meta?.version === prevVersion);
  report("repair still thin → repairAttempted", written.repairAttempted === true);
}

async function main(): Promise<void> {
  console.log("=== Full Structured KB Quality + Repair Tests ===\n");
  await testRepairPass();
  await testRepairStillFails();
  console.log(`\n${failed === 0 ? "ALL PASS" : `${failed} FAILED`}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
