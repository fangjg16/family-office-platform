import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    open: true,
    port: 5173,
    /** 监听所有网卡，避免仅未启动服务时访问 localhost 失败；也可用 http://127.0.0.1:5173 */
    host: true,
  },
});
