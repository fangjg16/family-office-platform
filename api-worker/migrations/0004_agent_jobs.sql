CREATE TABLE IF NOT EXISTS agent_jobs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  conversation_id TEXT,
  skill_intent TEXT NOT NULL,
  status TEXT NOT NULL,
  hermes_run_id TEXT,
  answer TEXT,
  knowledge_network_html TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_jobs_user ON agent_jobs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_agent_jobs_project ON agent_jobs(project_id);
