// 抓方舟 Coding Plan 控制台接口 v2：只打 coding-plan 页，等 networkidle + 更久，
// 录下 console.volcengine.com 全部 JSON 响应（不限 /api/top/ark），并截图+存页面文本。
// 用法：node scripts/probe-coding.mjs
import { chromium } from "playwright";
import { writeFileSync, readFileSync } from "fs";

const PROFILE_DIR = "/Users/ylandazhou/Documents/ark-probe/.profile";
const START_URL = "https://console.volcengine.com/ark/region:cn-beijing/subscription/coding-plan";
const OUT = "/Users/ylandazhou/Documents/ark-probe/coding-captured.json";
const LOG = "/Users/ylandazhou/Documents/ark-probe/coding-api.log";
const SHOT = "/Users/ylandazhou/Documents/ark-probe/coding-shot.png";
const TEXT = "/Users/ylandazhou/Documents/ark-probe/coding-page.txt";

writeFileSync(OUT, "[]");
writeFileSync(LOG, "");

const isConsole = (url) => /console\.volcengine\.com/.test(url);

const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: true,
  viewport: { width: 1320, height: 920 },
});
const page = ctx.pages()[0] || (await ctx.newPage());
const captured = [];

ctx.on("request", (req) => {
  if (!isConsole(req.url()) || req.method() !== "POST") return;
  captured.push({ url: req.url(), method: "POST", postData: req.postData() });
  writeFileSync(OUT, JSON.stringify(captured, null, 2));
});

page.on("response", async (res) => {
  const url = res.url();
  if (!isConsole(url)) return;
  try {
    const ct = res.headers()["content-type"] || "";
    if (!ct.includes("json")) return;
    const status = res.status();
    let body = "";
    try { body = await res.text(); } catch { return; }
    if (!body || body.length > 300000) return;
    captured.push({ url, status, body: body.slice(0, 12000) });
    writeFileSync(OUT, JSON.stringify(captured, null, 2));
    const action = url.split("/").pop()?.split("?")[0];
    const line = `\n[${status}] ${action}  <- ${url.slice(0, 120)}\n${body.slice(0, 1200)}\n`;
    writeFileSync(LOG, readFileSync(LOG, "utf8") + line);
    console.log(line);
  } catch {}
});

console.log(`\n>>> 打开 ${START_URL}`);
await page.goto(START_URL, { waitUntil: "domcontentloaded" }).catch((e) => console.log("goto err", e.message));
await page.waitForLoadState("networkidle").catch(() => {});
await page.waitForTimeout(8000);
console.log(`    落地页: ${page.url()}`);

// 截图 + 页面文本，看实际渲染
await page.screenshot({ path: SHOT, fullPage: true }).catch(() => {});
try {
  const txt = await page.evaluate(() => document.body.innerText);
  writeFileSync(TEXT, txt.slice(0, 8000));
  console.log(`    页面文本前 600 字:\n${txt.slice(0, 600)}\n`);
} catch (e) {
  console.log("    取页面文本失败:", e.message);
}

writeFileSync(OUT, JSON.stringify(captured, null, 2));
console.log(`\n>>> 完成，共录到 ${captured.length} 条记录 -> ${OUT}`);
console.log(`    截图 -> ${SHOT}；页面文本 -> ${TEXT}`);
await ctx.close();
