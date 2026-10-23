#!/usr/bin/env node
/**
 * 排版医生 · 冒烟测试
 *
 * 只验证对外行为（分数、行数换算、规则开关、草稿库、导出内容），
 * 不碰内部实现细节——重构时这些断言应当继续成立。
 *
 * 依赖：playwright-core（仅开发期依赖）
 *   npm i -D playwright-core
 *   npx playwright install chromium     # 首次
 * 运行：
 *   node tests/run-tests.js
 * 指定浏览器：
 *   CHROME_PATH=/path/to/chrome node tests/run-tests.js
 */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

let chromium;
try {
  ({ chromium } = require("playwright-core"));
} catch (e) {
  console.error("缺少 playwright-core，请先执行：npm i -D playwright-core");
  process.exit(2);
}

const ROOT = path.resolve(__dirname, "..");

/* ── 本地静态服务（避免 file:// 下 localStorage 被限制） ── */
function serve() {
  const server = http.createServer((req, res) => {
    const url = req.url.split("?")[0];
    const file = path.join(ROOT, url === "/" ? "index.html" : url.replace(/^\/+/, ""));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    const ext = path.extname(file);
    const type = ext === ".html" ? "text/html; charset=utf-8"
      : ext === ".js" ? "text/javascript; charset=utf-8"
      : ext === ".md" ? "text/markdown; charset=utf-8"
      : "application/octet-stream";
    res.writeHead(200, { "content-type": type });
    res.end(fs.readFileSync(file));
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

/* ── 极简断言 ── */
let pass = 0;
const fails = [];
function ok(name, cond, detail) {
  if (cond) {
    pass++;
    console.log("  ok   " + name);
  } else {
    fails.push(name + (detail ? "  → " + detail : ""));
    console.log("  FAIL " + name + (detail ? "  → " + detail : ""));
  }
}
function eq(name, actual, expected) {
  ok(name, actual === expected, "got " + JSON.stringify(actual) + ", want " + JSON.stringify(expected));
}

const SAMPLE_HINT = "每年一到开学季";

(async () => {
  const { server, port } = await serve();
  const launchOpts = { args: ["--no-sandbox"] };
  if (process.env.CHROME_PATH) launchOpts.executablePath = process.env.CHROME_PATH;

  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("console: " + m.text());
  });

  await page.goto("http://127.0.0.1:" + port + "/", { waitUntil: "load" });
  await page.waitForFunction(() => !!window.PaibanYisheng, null, { timeout: 8000 });

  console.log("\n[1] 启动与基础渲染");
  eq("暴露 API 且版本为 1.1.0", await page.evaluate(() => window.PaibanYisheng.version), "1.1.0");
  eq("空草稿时分数显示占位符", await page.textContent("#scoreNum"), "—");

  console.log("\n[2] 示例基线（与 v1.0 口径一致）");
  await page.click("#btnSample");
  await page.waitForTimeout(200);
  eq("示例草稿总分仍为 75", await page.textContent("#scoreNum"), "75");
  eq("示例草稿被识别为 9 段", await page.evaluate(() => document.querySelectorAll(".pv-p").length), 9);

  console.log("\n[3] 一键修复与对比快照");
  await page.click("#btnFix");
  await page.waitForTimeout(250);
  eq("修复后总分 92", await page.textContent("#scoreNum"), "92");
  ok("出现「查看改动」入口", await page.isVisible("#improve .i-act button"));
  await page.click("#improve .i-act button");
  await page.waitForTimeout(200);
  ok("对比面板列出改动块", (await page.evaluate(() => document.querySelectorAll("#diffBody .d-block").length)) > 0);
  ok("对比面板有删除高亮", (await page.evaluate(() => document.querySelectorAll("#diffBody del").length)) > 0);
  ok("对比面板有新增高亮", (await page.evaluate(() => document.querySelectorAll("#diffBody ins").length)) > 0);
  await page.keyboard.press("Escape");

  console.log("\n[4] 纯函数与幂等性");
  const idem = await page.evaluate(() => {
    const api = window.PaibanYisheng;
    const once = api.autoFix("去年我们做了378份问卷,回收率62%!!");
    return { once: once, twice: api.autoFix(once) };
  });
  eq("autoFix 幂等", idem.twice, idem.once);
  ok("修复补了中英文空格", idem.once.indexOf("378 份") >= 0, idem.once);
  ok("修复把半角逗号转全角", idem.once.indexOf("问卷，") >= 0, idem.once);

  console.log("\n[5] 规则开关真的生效");
  const spacingOff = await page.evaluate(() => {
    const api = window.PaibanYisheng;
    api.setConfig({ rules: { spacing: false } });
    const out = api.autoFix("超过8行");
    api.setConfig({ rules: { spacing: true } });
    return { off: out, on: api.autoFix("超过8行") };
  });
  eq("关闭空格规则后不再补空格", spacingOff.off, "超过8行");
  eq("开启空格规则后补空格", spacingOff.on, "超过 8 行");

  console.log("\n[6] 行数上限可配置");
  const limits = await page.evaluate(() => {
    const api = window.PaibanYisheng;
    const text = "手机阅读是扫不是读，一段太长读者会直接跳过这一整段内容，所以要把段落拆短一些才好读。";
    api.setConfig({ lineLimit: 4 });
    const s4 = api.compute(text).total;
    const l4 = api.estimateLines(text);
    api.setConfig({ lineLimit: 3 });
    const s3 = api.compute(text).total;
    const cfg3 = api.getConfig().lineLimit;
    api.setConfig({ lineLimit: 4 });
    return { s4, s3, l4, cfg3 };
  });
  ok("上限下调后同一段得分下降", limits.s3 <= limits.s4, "s3=" + limits.s3 + " s4=" + limits.s4);
  eq("配置读回 3 行", limits.cfg3, 3);

  console.log("\n[7] 屏宽影响行数估算");
  const widths = await page.evaluate(() => {
    const api = window.PaibanYisheng;
    /* 24 个汉字：窄屏放不下一行，宽屏正好一行 */
    const text = "一二三四五六七八九十一二三四五六七八九十一二三四";
    api.setConfig({ viewport: 360 });
    const a = api.estimateLines(text);
    api.setConfig({ viewport: 414 });
    const b = api.estimateLines(text);
    api.setConfig({ viewport: 375 });
    return { a, b };
  });
  ok("414px 屏比 360px 屏占的行更少", widths.b < widths.a, "360→" + widths.a + " 414→" + widths.b);

  console.log("\n[8] 小标题识别");
  const heads = await page.evaluate(() => {
    const f = window.PaibanYisheng.isHeading;
    return {
      sentence: f("第一，一段不超过 4 行，让眼睛有地方休息。"),
      colon: f("比如下面这段就是典型："),
      plain: f("今天天气不错，我们去看看外面的树。")
    };
  });
  eq("带句号的编号句不算标题", heads.sentence, false);
  eq("以冒号结尾的短句算标题", heads.colon, true);
  eq("普通长句不算标题", heads.plain, false);

  console.log("\n[9] 草稿库");
  await page.click("#btnDrafts");
  await page.waitForTimeout(150);
  await page.click("#btnNewDraft");
  await page.waitForTimeout(250);
  eq("新建后正文被清空", await page.inputValue("#src"), "");
  await page.click("#btnDrafts");
  await page.waitForTimeout(150);
  eq("草稿列表有 2 篇", await page.evaluate(() => document.querySelectorAll("#draftList .draft").length), 2);
  await page.evaluate(() => {
    const rows = document.querySelectorAll("#draftList .draft");
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].textContent.indexOf("每年一到开学季") >= 0) { rows[i].click(); return; }
    }
  });
  await page.waitForTimeout(250);
  ok("切回示例草稿后正文恢复", (await page.inputValue("#src")).indexOf(SAMPLE_HINT) >= 0);

  console.log("\n[10] 导出内容");
  const exports_ = await page.evaluate(() => {
    const api = window.PaibanYisheng;
    const html = api.toWechatHtml("标题：一段话\n这是一段正文，用来测试导出，包含8个数字。");
    const md = api.toMarkdown("标题：一段话\n这是一段正文。");
    return { html, md };
  });
  ok("公众号 HTML 带内联样式", exports_.html.indexOf('style="font-size:15px') >= 0);
  ok("公众号 HTML 每个段落一个 p", (exports_.html.match(/<p /g) || []).length === 2);
  ok("Markdown 标题加了 ##", exports_.md.indexOf("## 标题：一段话") === 0, exports_.md.slice(0, 20));

  console.log("\n[11] 移动端布局");
  const m = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await m.goto("http://127.0.0.1:" + port + "/", { waitUntil: "load" });
  await m.waitForTimeout(300);
  const overflow = await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  eq("390px 视口无横向溢出", overflow, false);
  ok("移动端顶栏按钮可点", await m.isVisible("#btnSettings"));
  await m.close();

  console.log("\n[12] 无脚本错误");
  eq("控制台与页面无报错", errors.length, 0);
  if (errors.length) { console.log(errors.join("\n")); }

  await browser.close();
  server.close();

  console.log("\n" + (fails.length ? "FAILED" : "PASSED") + "  " + pass + " 通过 / " + fails.length + " 失败");
  if (fails.length) {
    fails.forEach((f) => console.log("  - " + f));
    process.exit(1);
  }
})().catch((e) => {
  console.error("测试执行异常：", e);
  process.exit(1);
});
