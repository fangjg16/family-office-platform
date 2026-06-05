-- 展示用版本号（如 5.5）；内部 version INTEGER 仍为归档序号
ALTER TABLE project_knowledge_networks ADD COLUMN version_label TEXT;
ALTER TABLE project_knowledge_network_versions ADD COLUMN version_label TEXT;
