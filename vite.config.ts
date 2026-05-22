import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/** GitHub Pages 刷新子路由时回退到 index，避免 404（见 https://github.com/rafgraph/spa-github-pages） */
function githubPagesSpaFallback(): Plugin {
  return {
    name: "github-pages-spa-fallback",
    closeBundle() {
      const index = path.resolve(__dirname, "dist/index.html");
      const fallback = path.resolve(__dirname, "dist/404.html");
      fs.copyFileSync(index, fallback);
    },
  };
}

export default defineConfig({
  plugins: [react(), githubPagesSpaFallback()],
  base: "/family-office-platform/",
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
