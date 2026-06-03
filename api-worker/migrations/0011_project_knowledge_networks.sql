-- 项目级知识网络：HTML 存 R2，元数据存 D1（全员可读，Guest 由 API 拒绝）
CREATE TABLE IF NOT EXISTS project_knowledge_networks (
  project_id TEXT PRIMARY KEY,
  r2_key TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  last_job_id TEXT,
  changelog TEXT
);

CREATE INDEX IF NOT EXISTS idx_project_kn_updated
  ON project_knowledge_networks (updated_at DESC);
