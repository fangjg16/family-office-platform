CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  conversation_id TEXT,
  filename TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  mime TEXT,
  scope TEXT NOT NULL DEFAULT 'package',
  uploaded_by TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  text TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_conversation ON documents(conversation_id);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_chunks_document ON chunks(document_id);

CREATE TABLE IF NOT EXISTS user_conversations (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  preview TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  variant TEXT,
  files_json TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS user_chat_messages (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  files_json TEXT,
  time_label TEXT NOT NULL,
  sort_index INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_user_conv_user ON user_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_conv_project ON user_conversations(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_user_msg_conv ON user_chat_messages(user_id, conversation_id);

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

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '未分类',
  phase TEXT NOT NULL DEFAULT 'Active（资源筹备中）',
  summary TEXT NOT NULL DEFAULT '',
  guest_summary TEXT NOT NULL DEFAULT '',
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_updated ON projects(updated_at DESC);
