-- 一次性：远程库已用手动 execute 建过表，但 d1_migrations 为空时用。
-- 执行：npx wrangler d1 execute jfo-meta --remote --file=./scripts/d1-remote-journal-baseline.sql
-- 勿在全新空库上执行。
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0002_uploaded_by.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0003_chat_sync.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0004_agent_jobs.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0005_projects.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0006_user_chat_messages_kn_html.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0007_user_chat_pending_job.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0008_memory_summary_and_embeddings.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0009_user_hidden_chat_messages.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0010_chat_message_audit_log.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0011_project_knowledge_networks.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0012_project_kn_versions.sql');
