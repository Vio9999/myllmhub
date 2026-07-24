// 视觉冒烟：起本地服务（静态 dist + 真实 /api/usage），用 playwright 截图
// agent / coding 两个视图 + 下拉打开态，确认下拉框和 coding 卡片渲染正常。
// 用法：node scripts/visual-check.mjs
import { createServer } from "http";
import { readFileSync, existsSync, statSync } from "fs";
import { chromium } from "playwright";

// 注入 cookie 给后端适配器
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
process.env.ARK_COOKIE = env.match(/^ARK_COOKIE=(.*)$/m)?.[1]?.trim() || "";
const { fetchAll } = await import("../server/adapters.js");

const DIST = new URL("../dist/", import.meta.url).pathname;
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".svg": "image/svg+xml", ".woff2": "font/woff2", ".json": "application/json",
  ".png": "image/png", ".webmanifest": "application/manifest+json",
};

const server = createServer(async (req, res) => {
  if (req.url === "/api/usage") {
    try {
      const out = await fetchAll({});
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(out));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }
  let path = req.url.split("?")[0];
  if (path === "/") path = "/index.html";
  const file = DIST + path.slice(1);
  if (!existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404); res.end("not found"); return;
  }
  const ext = file.match(/\.[^.]+$/)?.[0];
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  res.end(readFileSync(file));
});

await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const base = `http://localhost:${port}`;
console.log("本地服务:", base);

const ctx = await chromium.launchPersistentContext("/tmp/myllmhub-visual-profile", {
  headless: true,
  viewport: { width: 420, height: 880 },
});
const page = await ctx.newPage();
await page.goto(base, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);

// 1) 默认（agent）视图
await page.screenshot({ path: "/tmp/myllmhub-1-agent.png", fullPage: true });
console.log("✓ agent 视图 -> /tmp/myllmhub-1-agent.png");

// 2) 打开下拉
await page.locator("button[aria-haspopup='listbox']").click();
await page.waitForTimeout(500);
await page.screenshot({ path: "/tmp/myllmhub-2-dropdown.png", fullPage: true });
console.log("✓ 下拉打开 -> /tmp/myllmhub-2-dropdown.png");

// 3) 选 coding plan
const codingItem = page.getByRole("option", { name: "Ark Coding Plan" });
await codingItem.click();
await page.waitForTimeout(1500);
await page.screenshot({ path: "/tmp/myllmhub-3-coding.png", fullPage: true });
console.log("✓ coding 视图 -> /tmp/myllmhub-3-coding.png");

// 4) 截一下页面文本，确认渲染内容
const txt = await page.evaluate(() => document.body.innerText);
console.log("\n=== coding 视图文本（前 500 字）===\n" + txt.slice(0, 500));

await ctx.close();
server.close();
