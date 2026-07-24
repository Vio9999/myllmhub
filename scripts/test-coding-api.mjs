// 用 .env.local 里的 ARK_COOKIE 直接打 coding plan 两个接口，验证服务端 fetch 能通。
// 用法：node scripts/test-coding-api.mjs
import { readFileSync } from "fs";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const cookie = env.match(/^ARK_COOKIE=(.*)$/m)?.[1]?.trim() || "";
if (!cookie) {
  console.error("✗ .env.local 里没有 ARK_COOKIE");
  process.exit(1);
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const REFERER = "https://console.volcengine.com/ark/region:cn-beijing/subscription/coding-plan";
const USAGE_URL = "https://console.volcengine.com/api/top/ark/cn-beijing/2024-01-01/GetCodingPlanUsage";
const TRADE_URL = "https://console.volcengine.com/api/top/ark/cn-beijing/2024-01-01/ListSubscribeTrade";

function headers() {
  return {
    Cookie: cookie,
    "User-Agent": UA,
    Accept: "application/json, text/plain, */*",
    Referer: REFERER,
    Origin: "https://console.volcengine.com",
    "Content-Type": "application/json",
    "x-csrf-token": cookie.match(/(?:^|;\s*)csrfToken=([^;]+)/)?.[1] || "",
  };
}

async function post(url, body) {
  const res = await fetch(url, { method: "POST", headers: headers(), body: JSON.stringify(body) });
  console.log(`\n[${res.status}] ${url.split("/").pop()}`);
  const text = await res.text();
  console.log(text.slice(0, 800));
}

console.log("cookie 长度:", cookie.length, "csrfToken:", cookie.includes("csrfToken") ? "有" : "无");

await post(USAGE_URL, {});
await post(TRADE_URL, { ResourceTypes: ["CodingPlan"], ResourceNames: [""], BizInfos: ["lite", "pro"] });
