# 排版医生 · 公众号移动端阅读体检

把公众号草稿粘进去，算出**每一段在手机上到底占几行**，给出四维评分、逐条可定位的改稿清单，以及一个只整理格式、不改写语义的「一键修复」。

在线体验：<https://workbuddy.link/p/jbhmStKun7Y2C1rHGfz2HB>

镜像站点：<https://nance-mike.github.io/paiban-yisheng/>（GitHub Pages，内容与本仓库 `index.html` 一致，可作长期链接）

![体检前：75 分](docs/screenshots/01-before-75.png)

![一键修复后：92 分](docs/screenshots/02-after-92.png)

## 为什么做这个

电脑屏幕上看着只有三行的段落，到了手机上可能是六行。读者划到第四行就开始走神，而作者几乎永远看不到这个瞬间——因为写作和阅读发生在两块不同的屏幕上。

排版医生把这个判断从「凭感觉」变成「可量化」：按设定屏宽与字号换算实际行数，超出上限标黄、再超三行标红。写完推送、排完版、点群发之前，花三分钟自查一遍。

## 功能

| 功能 | 说明 |
| --- | --- |
| 行数可视化 | 按屏宽与字号换算每段行数，手机预览逐段着色 |
| 四维评分 | 段落呼吸感 30 + 句子长度 25 + 结构层级 20 + 标点与规范 25 |
| 改稿清单 | 每条问题定位到第几段，点击自动滚到对应位置 |
| 一键修复 | 批量整理空格、全半角标点、连用标点、空行，并给出修复前后分差 |
| 修复对比 | 逐段并列展示改动，红底是删掉的字、绿底是加上的字，改了什么一目了然 |
| 规范配置 | 屏宽（360/375/390/414）、单段行数上限（3/4/5）、8 条检查规则可逐项开关 |
| 草稿库 | 多篇草稿本地管理，自动保存、切换、删除，不再覆盖上一篇 |
| 导出中心 | 体检卡 PNG / 公众号富文本（带内联样式）/ Markdown / 纯文本 |
| 统计面板 | 字数、段落、阅读时长、平均段长、平均句长、最长段 |
| 草稿记忆 | 草稿与全部设置在 `localStorage`，刷新不丢 |
| 键盘快捷键 | `Ctrl/Cmd + Enter` 修复，`Ctrl/Cmd + Shift + C` 复制，`Esc` 关闭弹层 |

## 快速开始

### 方式一：直接打开

双击 `index.html`，或拖进浏览器。不需要安装依赖，不需要构建，不需要联网。

### 方式二：本地起服务（如需在手机上预览）

```bash
# 在仓库根目录执行
python -m http.server 8000
# 浏览器打开 http://localhost:8000
# 手机与电脑同一局域网时，可用 http://<本机IP>:8000 在真机上验收
```

## 评分口径（摘要）

完整公式、阈值、扣分表与配置项见 [`docs/scoring-spec.md`](docs/scoring-spec.md)。

行数估算：可用宽度 = 屏宽 − 左右各 16px 内边距，除以当前字号得到每行的 em 容量（375px、15px 时约 22.86 个汉字），英文与数字按半个汉字宽折算。

| 维度 | 分值 | 满分条件 |
| --- | --- | --- |
| 段落呼吸感 | 30 | 每段折算行数不超过单段上限（默认 4 行） |
| 句子长度 | 25 | 每句 ≤ 30 字 |
| 结构层级 | 20 | 有小标题、段落 3—25 段、首段不超上限、标题前后留空行 |
| 标点与规范 | 25 | 已开启的规则全部无扣分 |

分数与等级：≥90 通透 / 80—89 清爽 / 70—79 尚可 / 55—69 需要改 / <55 读起来累。

## 配置与规范

规范跟着账号走，不写死在代码里。点顶栏「设置」：

- **预览屏宽**：360 / 375 / 390 / 414。屏宽变了，每段行数与评分随之变化——同一篇稿子在 iPhone SE 和 Pro Max 上的阅读体验本来就不同。
- **单段行数上限**：3 / 4 / 5 行。这是各账号最不一致的一条，所以做成可调。
- **检查项与自动修复范围**：8 条规则可逐项开关。关掉的规则既不参与扣分，也不会被一键修复改动。

所有配置与草稿一起存在本机 `localStorage`，不上传。

## 设计取舍

1. **单文件，不做工程化拆分。** 这个工具要发布到内容平台的静态托管上，单文件是部署成本最低的形态，也保证了「双击即用」。为此 CSS 与 JS 内联，运行时外部依赖为零。
2. **机器只修格式，不替你改句子。** 自动修复不会在逗号处断开长段——那样会在段末留下半截逗号，也等于替你决定了语义。遇到「一整段其实是一句话」，工具只标出来，断句留给作者。
3. **修复必须可审。** 一键修复后不给「相信我没错」，而是并排展示改动前后的字级差异。改了什么、改得对不对，由人决定。
4. **ES5 语法。** 目标环境包含旧版 WebView，`const` / 箭头函数 / 模板字符串一律不用。
5. **所有动态文本走 `textContent`。** 不使用 `innerHTML` 拼接用户输入；富文本复制走 `DOMParser` 解析，避免 XSS。
6. **诚实标注误差。** 估算口径与微信真机渲染通常差 ±1 行，界面底部与文档都写明，不宣称精确。

## 目录结构

```
paiban-yisheng/
├── index.html                 # 应用本体（单文件，含内联样式与脚本）
├── README.md
├── CHANGELOG.md
├── LICENSE
├── package.json               # 仅声明开发期测试依赖
├── .editorconfig
├── .gitattributes
├── .gitignore
├── docs/
│   ├── scoring-spec.md        # 评分算法、阈值、扣分表、可配置项
│   ├── submission-pack.md     # 「1024 造物挑战」投稿材料
│   └── screenshots/           # 四张界面截图
├── tests/
│   └── run-tests.js           # 冒烟测试：29 条断言
└── .github/workflows/
    └── pages.yml              # GitHub Pages 自动部署
```

## 对外 API

页面加载后暴露 `window.PaibanYisheng`，供自动化测试或第三方接入：

```js
PaibanYisheng.version                       // "1.1.0"
PaibanYisheng.compute(text)                 // { total, dims, issues, paras, avgLines, ... }
PaibanYisheng.autoFix(text)                 // 返回整理后的文本
PaibanYisheng.estimateLines(text)           // 按当前配置估算行数
PaibanYisheng.emWidth(text)                 // 文本宽度（以 em 计）
PaibanYisheng.isHeading("一、标题")          // true
PaibanYisheng.toWechatHtml(text)            // 带内联样式的段落 HTML
PaibanYisheng.toMarkdown(text)              // Markdown
PaibanYisheng.getConfig()                   // { viewport, lineLimit, fontSize, lineHeight, rules }
PaibanYisheng.setConfig({ lineLimit: 3 })   // 改配置并重算
```

## 开发与验证

```bash
npm install          # 只装 playwright-core（开发期依赖）
npx playwright install chromium
npm test             # 29 条断言：分数基线、幂等性、规则开关、草稿库、导出、移动端布局
```

测试覆盖的不是内部实现，而是对外行为——重构时这些断言应当继续成立。当前状态：**29 通过 / 0 失败**。

自查清单（不装依赖也能做）：粘入示例 → 分数应为 75 → 点一键修复 → 应变为 92 且标点维度 25/25 → 点「查看改动」应有红绿高亮 → 导出体检卡应下载 PNG。

## 技术栈与兼容性

- 原生 HTML / CSS / JavaScript，运行时无框架、无依赖、无构建步骤。
- 使用 `localStorage`、`canvas.toDataURL`、`ClipboardItem`（不可用时降级 `execCommand`）、`Element.closest`、`DOMParser`。
- 已在 Chromium 桌面端与 390px 移动视口验证：无控制台报错、无横向溢出、导出下载正常。

## 已知限制

- 行数是**估算**：微信实际渲染受机型、字体、字重影响，通常有 ±1 行误差，不能替代真机预览。
- 只处理纯文本。图片间距、卡片样式、秀米等第三方排版工具的容器内边距不在检测范围内。
- 「小标题」用启发式规则识别（编号开头、短句无句末标点、以冒号结尾），极短的正文段落可能被误判，暂不支持手动纠正。
- 草稿存在本机浏览器，换浏览器或清缓存会丢失，暂不支持导入导出全部草稿。
- 不评价内容质量，只衡量阅读体验。

## 竞赛背景

本项目为 WorkBuddy「1024 造物挑战」程序员节应用创作大赛参赛作品（投稿征集 2026-10-21 至 2026-11-01）。投稿材料与社媒文案见 [`docs/submission-pack.md`](docs/submission-pack.md)。

## 许可

[MIT](LICENSE)
