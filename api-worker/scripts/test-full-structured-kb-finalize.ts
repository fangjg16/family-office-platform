/**
 * Full / initial structured-kb-data finalize tests
 * 用法：cd api-worker && npx tsx scripts/test-full-structured-kb-finalize.ts
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  finalizeKnowledgeNetworkJobResult,
  publishStructuredKbWithOptionalRepair,
  tryWriteKnowledgeNetworkFromStructuredKbData,
  type AgentJobEnv,
  type AgentJobRow,
} from "../src/agent-jobs.ts";
import { renderStructuredKbDataToHtml } from "../src/knowledge-network-structured-kb-data.ts";
import { projectKnowledgeNetworkR2Key } from "../src/project-knowledge-network.ts";

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, "fixtures/full-structured-kb-data-pet-rich.json");
const sampleHtmlPath = join(
  here,
  "../../hermes-railway/skills/opportunistic-investments-hermes/sample-output.html",
);

let failed = 0;

function report(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `: ${detail}` : ""}`);
  if (!ok) failed += 1;
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
  versions: unknown[];
  chatMessages: { id: string; role: string; content: string; sort_index: number; pending_job_id: string | null }[];
};

function createKnTestEnv(store: KnStore): AgentJobEnv {
  const r2 = new Map<string, string>();
  if (store.meta && store.html) {
    r2.set(store.meta.r2Key, store.html);
  }

  const db = {
    prepare(sql: string) {
      const normalized = sql.replace(/\s+/gu, " ").trim();
      return {
        bind(...args: unknown[]) {
          return {
            async first<T>(): Promise<T | null> {
              if (normalized.includes("FROM project_knowledge_networks WHERE")) {
                if (!store.meta) return null;
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
              if (normalized.includes("FROM user_chat_messages")) {
                return { results: store.chatMessages as T[] };
              }
              if (normalized.includes("FROM project_knowledge_network_versions")) {
                return { results: store.versions as T[] };
              }
              return { results: [] as T[] };
            },
            async run() {
              if (normalized.includes("INSERT INTO project_knowledge_networks")) {
                const projectId = String(args[0]);
                store.meta = {
                  projectId,
                  r2Key: String(args[1]),
                  version: Number(args[2]),
                  versionLabel: (args[3] as string | null) ?? null,
                  updatedAt: String(args[4]),
                  updatedBy: String(args[5]),
                  lastJobId: (args[6] as string | null) ?? null,
                  changelog: (args[7] as string | null) ?? null,
                };
              }
              if (normalized.includes("INSERT INTO project_knowledge_network_versions")) {
                store.versions.push(args);
              }
              return { success: true };
            },
          };
        },
      };
    },
  };

  return {
    DB: db as unknown as D1Database,
    FILES: {
      async get(key: string) {
        const text = r2.get(key);
        if (text === undefined) return null;
        return { text: async () => text };
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
    id: "job-test-1",
    project_id: "proj-test",
    user_id: "user-test",
    conversation_id: "conv-test",
    skill_intent: "knowledge_network",
    status: "running",
    hermes_run_id: "run-test",
    answer: null,
    knowledge_network_html: null,
    error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

const fixtureJson = readFileSync(fixturePath, "utf8");
const fixtureParsed = JSON.parse(fixtureJson) as Record<string, unknown>;
const sampleHtml = readFileSync(sampleHtmlPath, "utf8");

function wrapStructuredAnswer(jsonBody: string): string {
  return `## 摘要\n全量 structured KB 测试交付。\n\n\`\`\`json\n${jsonBody}\n\`\`\``;
}

async function testStructuredSuccess(): Promise<void> {
  const store: KnStore = { meta: null, html: null, versions: [], chatMessages: [
    { id: "user-job-test-1", role: "user", content: "全量重做知识网络", sort_index: 1, pending_job_id: "job-test-1" },
  ] };
  const env = createKnTestEnv(store);
  const row = baseJob();
  const answer = wrapStructuredAnswer(fixtureJson);
  const written = await publishStructuredKbWithOptionalRepair(
    env,
    row,
    { answer },
    "full",
    { repairRunner: null },
  );
  report("structured JSON → tryWrite ok", written.ok, written.ok ? "" : (written as { error: string }).error);
  report("structured JSON → meta written", Boolean(store.meta?.lastJobId === row.id));
  report("structured JSON → html in store", Boolean(store.html && store.html.includes("kb-shell")));
}

async function testThinStructuredRepairNeeded(): Promise<void> {
  const thinPath = join(here, "fixtures/full-structured-kb-data-pet.json");
  const thinJson = readFileSync(thinPath, "utf8");
  const store: KnStore = { meta: null, html: null, versions: [], chatMessages: [
    { id: "user-job-test-thin", role: "user", content: "全量重做知识网络", sort_index: 1, pending_job_id: "job-test-thin" },
  ] };
  const env = createKnTestEnv(store);
  const row = baseJob({ id: "job-test-thin" });
  const written = await publishStructuredKbWithOptionalRepair(
    env,
    row,
    { answer: wrapStructuredAnswer(thinJson) },
    "full",
    { repairRunner: null },
  );
  report("thin structured → repairNeeded", !written.ok && written.repairNeeded === true);
  report("thin structured → no meta written", store.meta === null);
}

async function testFinalizeStructuredSuccess(): Promise<void> {
  const store: KnStore = { meta: null, html: null, versions: [], chatMessages: [
    { id: "user-job-test-1", role: "user", content: "全量重做知识网络", sort_index: 1, pending_job_id: "job-test-1" },
  ] };
  const env = createKnTestEnv(store);
  const row = baseJob();
  const result = await finalizeKnowledgeNetworkJobResult(env, row, {
    answer: wrapStructuredAnswer(fixtureJson),
    knowledgeNetworkHtml: null,
  });
  report("finalize structured → status ok", result.status === "ok");
  report(
    "finalize structured → mentions structured-kb-data",
    result.status === "ok" && result.answer.includes("structured-kb-data"),
  );
  report("finalize structured → html returned", result.status === "ok" && Boolean(result.knowledgeNetworkHtml));
}

async function testHtmlFallbackWhenStructuredMissing(): Promise<void> {
  const store: KnStore = { meta: null, html: null, versions: [], chatMessages: [
    { id: "user-job-test-2", role: "user", content: "全量重做知识网络", sort_index: 1, pending_job_id: "job-test-2" },
  ] };
  const env = createKnTestEnv(store);
  const row = baseJob({ id: "job-test-2" });
  const result = await finalizeKnowledgeNetworkJobResult(env, row, {
    answer: `摘要\n\n\`\`\`html\n${sampleHtml}\n\`\`\``,
    knowledgeNetworkHtml: null,
  });
  report("HTML fallback → status ok", result.status === "ok");
  report("HTML fallback → stored html", Boolean(store.meta?.lastJobId === row.id && store.html));
}

async function testPutFallbackWhenStructuredInvalid(): Promise<void> {
  const putHtml = sampleHtml;
  const store: KnStore = {
    meta: {
      projectId: "proj-test",
      r2Key: projectKnowledgeNetworkR2Key("proj-test"),
      version: 3,
      versionLabel: null,
      updatedAt: new Date().toISOString(),
      updatedBy: "user-test",
      lastJobId: "job-test-3",
      changelog: "Hermes PUT ok",
    },
    html: putHtml,
    versions: [],
    chatMessages: [
      { id: "user-job-test-3", role: "user", content: "全量重做知识网络", sort_index: 1, pending_job_id: "job-test-3" },
    ],
  };
  const env = createKnTestEnv(store);
  const row = baseJob({ id: "job-test-3" });
  const badFixture = { ...fixtureParsed, sources: [
    { id: "U-1", type: "用户上传", title: "A" },
    { id: "U-1", type: "用户上传", title: "dup" },
  ] };
  const result = await finalizeKnowledgeNetworkJobResult(env, row, {
    answer: wrapStructuredAnswer(JSON.stringify(badFixture)),
    knowledgeNetworkHtml: null,
  });
  report("invalid structured + PUT ok → status ok", result.status === "ok");
  report(
    "invalid structured + PUT ok → keeps PUT html",
    result.status === "ok" &&
      Boolean(result.knowledgeNetworkHtml) &&
      store.meta?.version === 3 &&
      store.meta?.lastJobId === row.id,
  );
  report(
    "invalid structured + PUT ok → file API note",
    result.status === "ok" && result.answer.includes("文件 API 回传"),
  );
}

async function testDuplicateSourceFailsWithoutFallback(): Promise<void> {
  const store: KnStore = { meta: null, html: null, versions: [], chatMessages: [
    { id: "user-job-test-4", role: "user", content: "全量重做知识网络", sort_index: 1, pending_job_id: "job-test-4" },
  ] };
  const env = createKnTestEnv(store);
  const row = baseJob({ id: "job-test-4" });
  const badFixture = { ...fixtureParsed, sources: [
    { id: "U-1", type: "用户上传", title: "A" },
    { id: "U-1", type: "用户上传", title: "dup" },
  ] };
  const result = await finalizeKnowledgeNetworkJobResult(env, row, {
    answer: wrapStructuredAnswer(JSON.stringify(badFixture)),
    knowledgeNetworkHtml: null,
  });
  report("duplicate source → failed", result.status === "failed");
  report(
    "duplicate source → error mentions duplicate",
    result.status === "failed" && /duplicate source id/i.test(result.answer),
  );
  report("duplicate source → no meta", store.meta === null);
}

async function testRenderThenValidate(): Promise<void> {
  const rendered = renderStructuredKbDataToHtml(JSON.parse(fixtureJson));
  report("render fixture for validate path", rendered.ok);
}

async function testThinRepairPassViaFinalize(): Promise<void> {
  const thinPath = join(here, "fixtures/full-structured-kb-data-pet.json");
  const richPathLocal = join(here, "fixtures/full-structured-kb-data-pet-rich.json");
  const thinJson = readFileSync(thinPath, "utf8");
  const richJsonLocal = readFileSync(richPathLocal, "utf8");
  const store: KnStore = { meta: null, html: null, versions: [], chatMessages: [
    { id: "user-job-repair", role: "user", content: "全量重做知识网络", sort_index: 1, pending_job_id: "job-repair" },
  ] };
  const env = createKnTestEnv(store);
  const row = baseJob({ id: "job-repair" });

  const result = await finalizeKnowledgeNetworkJobResult(env, row, {
    answer: wrapStructuredAnswer(thinJson),
    knowledgeNetworkHtml: null,
  }, {
    repairRunner: async () => ({ ok: true, answer: wrapStructuredAnswer(richJsonLocal) }),
  });
  report("finalize thin+mock repair → ok", result.status === "ok");
  report("finalize thin+mock repair → html stored", Boolean(store.html?.includes("quality-coverage")));
}

async function main(): Promise<void> {
  console.log("=== full / initial structured-kb-data finalize ===\n");
  await testStructuredSuccess();
  await testThinStructuredRepairNeeded();
  await testThinRepairPassViaFinalize();
  await testFinalizeStructuredSuccess();
  await testHtmlFallbackWhenStructuredMissing();
  await testPutFallbackWhenStructuredInvalid();
  await testDuplicateSourceFailsWithoutFallback();
  await testRenderThenValidate();

  console.log(`\n${failed === 0 ? "ALL PASS" : `${failed} FAILED`} (${8} scenarios)`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
