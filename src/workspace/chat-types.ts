export type LiveChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  files?: { name: string }[];
  time: string;
  /** Worker 解析出的合域风格知识网络 HTML（可预览/下载） */
  knowledgeNetworkHtml?: string | null;
};
