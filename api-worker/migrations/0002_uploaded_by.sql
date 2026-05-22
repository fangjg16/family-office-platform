-- 按账号隔离上传资料（演示多账号）
ALTER TABLE documents ADD COLUMN uploaded_by TEXT;
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);
