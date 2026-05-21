/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 设为 `1` / `true` 且配置 `VITE_AI_CHAT_ENDPOINT` 时启用真实 AI 对话 */
  readonly VITE_ENABLE_LIVE_CHAT?: string;
  /** Cloudflare Worker：`https://xxx.workers.dev/api/chat` */
  readonly VITE_AI_CHAT_ENDPOINT?: string;
  readonly VITE_RAGFLOW_CHAT_ENDPOINT?: string;
  readonly VITE_RAGFLOW_MODE?: string;
  readonly VITE_RAGFLOW_API_KEY?: string;
  /**
   * 默认已为逐步演示；设为 `"0"` / `"false"` 则关闭逐步演示（除非 URL 另有约定）。
   * @deprecated 优先使用 URL：`?chatInstant=1` 一次性展示原版预设对话。
   */
  readonly VITE_CHAT_PLAYBACK?: string;
}
