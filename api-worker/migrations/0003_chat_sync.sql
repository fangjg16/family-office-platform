-- 多设备同步：对话列表 + Live 聊天记录（按 user_id）
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
