-- 用户在各设备上「界面隐藏」的消息（不删除 user_chat_messages 正文）
CREATE TABLE IF NOT EXISTS user_hidden_chat_messages (
  user_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  hidden_at TEXT NOT NULL,
  PRIMARY KEY (user_id, conversation_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_user_hidden_chat_messages_user
  ON user_hidden_chat_messages(user_id);
