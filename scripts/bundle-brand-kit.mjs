/**
 * 将 design/brand-tokens.css 内联进 brand-kit.html，
 * 使单文件下载 / file:// 打开时毛玻璃与色板变量完整可用。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tokensPath = join(root, "design", "brand-tokens.css");
const htmlPath = join(root, "design", "brand-kit.html");
const publicHtmlPath = join(root, "public", "design", "brand-kit.html");

const tokens = readFileSync(tokensPath, "utf8");
let html = readFileSync(htmlPath, "utf8");

const inlineStyle = `<style id="brand-tokens">
/* 合域品牌 Token · 内联以便单文件下载 / file:// 离线打开（源文件：design/brand-tokens.css） */
${tokens}
</style>`;

if (html.includes('href="brand-tokens.css"')) {
  html = html.replace(
    /<link rel="stylesheet" href="brand-tokens\.css" \/>/,
    inlineStyle,
  );
} else {
  html = html.replace(
    /<style id="brand-tokens">[\s\S]*?<\/style>/,
    inlineStyle,
  );
}

writeFileSync(htmlPath, html);
writeFileSync(publicHtmlPath, html);
console.log("Bundled brand-tokens.css into design/brand-kit.html and public/design/brand-kit.html");
