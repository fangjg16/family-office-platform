/** 网站对话快捷话术（人话，不含 skill 名；与 api-worker chat-modes USER_QUICK_PROMPTS 对齐） */
export const CHAT_QUICK_PROMPTS: { label: string; message: string }[] = [
  { label: "分析项目", message: "帮我全面分析下这个项目" },
  { label: "五维覆盖度", message: "根据尽调资料做五维覆盖度，用 ✅⚠️❌ 标注" },
  { label: "尽调清单", message: "生成尽调清单，标出已有和还缺的材料" },
  { label: "风险矩阵", message: "做一版风险矩阵，列主要风险和缓释建议" },
  { label: "IC 备忘录", message: "写一版投资委员会备忘录草稿" },
  { label: "知识网络", message: "生成项目知识网络" },
  { label: "查外部资料", message: "查外部资料：补充这个项目公开信息并与现有材料对照" },
];
