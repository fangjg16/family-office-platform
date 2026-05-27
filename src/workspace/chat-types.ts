export type LiveChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  files?: { name: string }[];
  time: string;
  /** 会话内顺序（0 起）；刷新后按此排序，避免同秒 user/assistant 颠倒 */
  sortIndex?: number;
  /** Worker 解析出的合域风格知识网络 HTML（可预览/下载） */
  knowledgeNetworkHtml?: string | null;
  /** Hermes 异步任务 ID，轮询完成后清除 */
  pendingJobId?: string;
  /** 轮询接口返回的实时进度文案 */
  jobProgressLabel?: string;
  /** SSE 流式生成中：保留「思考中」条，下方同步追加正文 */
  isStreaming?: boolean;
};
