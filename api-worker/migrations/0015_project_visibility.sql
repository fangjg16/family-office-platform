-- 项目可见性：public=全平台可见；invite=仅创建人与已邀请成员
ALTER TABLE projects ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public';
