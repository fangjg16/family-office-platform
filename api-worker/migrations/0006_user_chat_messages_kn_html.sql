-- Persist knowledge network HTML per message (fix: refresh loses HTML preview buttons)
ALTER TABLE user_chat_messages ADD COLUMN knowledge_network_html TEXT;

