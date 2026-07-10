CREATE TABLE IF NOT EXISTS token_usage_log (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  project_id TEXT,
  conversation_id TEXT,
  source TEXT NOT NULL,
  model TEXT,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  is_estimated INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_token_usage_created ON token_usage_log(created_at);
CREATE INDEX IF NOT EXISTS idx_token_usage_user ON token_usage_log(user_id, created_at);

CREATE TABLE IF NOT EXISTS project_admin_cognition (
  project_id TEXT PRIMARY KEY,
  summary TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  model TEXT,
  generated_by TEXT NOT NULL DEFAULT 'admin'
);
