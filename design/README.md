# 合域 · 品牌设计规范（Brand Kit）

波西米亚改版 v1 的视觉单一事实来源。

## 预览

**推荐：直接打开（无需 npm、无需服务器）**

- 双击 `design/brand-kit.html`，或
- 双击 `design/打开品牌规范.bat`

`brand-kit.html` 与 `brand-tokens.css` 在同一目录，用 `file://` 即可。仅需联网加载 Google 字体（Noto Serif / Sans SC）。

**可选**：若已在跑 `npm run dev`，也可访问  
`http://localhost:5173/family-office-platform/design/brand-kit.html`  
（`public/design/` 为同一份副本，方便和主站一起预览，并非必须）。

## 文件

| 文件 | 说明 |
|------|------|
| `brand-kit.html` | 给老板/设计评审用的完整规范页 |
| `brand-tokens.css` | CSS 变量与 `.glass-bohemian` 工具类；改版时同步到 `src/index.css` |
| `optical-alignment.md` | **光学对齐**备忘：圆/文/图标/毛玻璃的 visual center 调参规则 |

## 已定稿要点

- 主色：经典酒红 **5°**（`hsl(5, 32%, 46%)`）；深档 **353°** `hsl(353, 42%, 32%)` ≈ `#722f37`（知识网络「综合成熟度」块）；中档 `hsl(353, 32%, 43%)` ≈ `#8f4a52`
- 衬线：**Noto Serif SC**（标题）；正文 **Noto Sans SC**
- 结构：Hero **深色** → 下拉正文 **亚麻米色**
- 点缀：陶土、鼠尾草
- 正文卡片：**macOS 毛玻璃**（高透明、强模糊、清晰描边）
