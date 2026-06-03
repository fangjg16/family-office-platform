-- 知识网络历史版本（R2 归档 + 元数据）
CREATE TABLE IF NOT EXISTS project_knowledge_network_versions (
  project_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  changelog TEXT,
  PRIMARY KEY (project_id, version)
);

CREATE INDEX IF NOT EXISTS idx_project_kn_versions_project
  ON project_knowledge_network_versions (project_id, version DESC);
