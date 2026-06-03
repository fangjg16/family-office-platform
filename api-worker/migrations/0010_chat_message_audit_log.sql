-- 对话审计：只追加，供运维/Admin Portal 查询；用户侧真删 user_chat_messages
CREATE TABLE IF NOT EXISTS chat_message_audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  event TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  files_json TEXT,
  knowledge_network_html TEXT,
  time_label TEXT,
  sort_index INTEGER,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_audit_user_time
  ON chat_message_audit_log (user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_chat_audit_conv
  ON chat_message_audit_log (user_id, conversation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_chat_audit_message
  ON chat_message_audit_log (user_id, message_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_audit_user_msg_event
  ON chat_message_audit_log (user_id, message_id, event);
