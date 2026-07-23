// 从本地 Playwright profile 导出方舟登录 cookie 到 .env.local
// 用法：npm run dump-cookie
// 前提：之前用 probe2 登录过方舟（cookie 已存在 .profile）
import { chromium } from "playwright";
import { writeFileSync, readFileSync, existsSync } from "fs";

const PROFILE = "/Users/ylandazhou/Documents/ark-probe/.profile";
const ENV_FILE = new URL("../.env.local", import.meta.url).pathname;

const ctx = await chromium.launchPersistentContext(PROFILE, { headless: true });
const page = ctx.pages()[0] || (await ctx.newPage());
await page.goto(
  "https://console.volcengine.com/ark/region:cn-beijing/subscription/agent-plan",
  { waitUntil: "domcontentloaded" }
);
await page.waitForTimeout(4000);

const all = await ctx.cookies();
const ark = all.filter((c) => {
  const d = c.domain.replace(/^\./, "");
  return d === "volcengine.com" || d.endsWith(".volcengine.com");
});
await ctx.close();

if (!ark.length) {
  console.error("✗ 没拿到方舟 cookie。请先跑 node /Users/ylandazhou/Documents/ark-probe/probe2.mjs 登录一次。");
  process.exit(1);
}

const cookieStr = ark.map((c) => `${c.name}=${c.value}`).join("; ");

let env = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
env = env.replace(/^ARK_COOKIE=.*$/gm, "").replace(/\n{2,}/g, "\n").trim();
env = (env ? env + "\n" : "") + `ARK_COOKIE=${cookieStr}\n`;
writeFileSync(ENV_FILE, env);

console.log(`✓ 已导出 ${ark.length} 个方舟 cookie → ${ENV_FILE}`);
console.log(`  本地开发：vite 会自动读取 .env.local`);
console.log(`  生产部署：把 ARK_COOKIE 的值粘到 Vercel → Settings → Environment Variables`);
