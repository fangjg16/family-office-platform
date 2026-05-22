export type LiveChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  files?: { name: string }[];
  time: string;
};
