// 方舟 Agent Plan 适配器：用登录 cookie 扒官方控制台接口
// 数据源：https://console.volcengine.com/.../GetAgentPlanAFPUsage

const USAGE_URL =
  "https://console.volcengine.com/api/top/ark/cn-beijing/2024-01-01/GetAgentPlanAFPUsage";
const REFERER =
  "https://console.volcengine.com/ark/region:cn-beijing/subscription/agent-plan";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// 窗口定义：key 对应返回字段 AFP<Cap(key)>
const WINDOWS = [
  { key: "fiveHour", label: "5 Hours", short: "5h", seconds: 18000 },
  { key: "weekly", label: "This Week", short: "Wk", seconds: 604800 },
  { key: "monthly", label: "This Month", short: "Mo", seconds: 2592000 },
];

const cap = (s) => s[0].toUpperCase() + s.slice(1);

async function fetchAFPUsage(cookie) {
  const res = await fetch(USAGE_URL, {
    headers: {
      Cookie: cookie,
      "User-Agent": UA,
      Accept: "application/json, text/plain, */*",
      Referer: REFERER,
      Origin: "https://console.volcengine.com",
    },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) {
      throw new Error("Ark cookie expired or invalid, please run 'npm run dump-cookie' again");
    }
    throw new Error(`Ark API ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const err = data?.ResponseMetadata?.Error;
  if (err) throw new Error(err.Message || JSON.stringify(err));
  return data.Result;
}

// credentials: { ARK_COOKIE }
export async function fetchArk(credentials = {}) {
  const cookie = credentials.ARK_COOKIE || process.env.ARK_COOKIE || "";
  if (!cookie) {
    throw new Error("ARK_COOKIE not configured, please run 'npm run dump-cookie' first");
  }
  const r = await fetchAFPUsage(cookie);
  const buckets = WINDOWS.map((w) => {
    const seg = r[`AFP${cap(w.key)}`] || {};
    return {
      key: w.key,
      label: w.label,
      short: w.short,
      windowSeconds: w.seconds,
      quota: seg.Quota ?? 0,
      used: seg.Used ?? 0,
      unit: "AFP",
      resetAt: seg.ResetTime ?? null,
      subscribeAt: seg.SubscribeTime ?? null,
    };
  });
  return {
    id: "volcengine-agentplan",
    name: "Ark Agent Plan",
    plan: r.PlanType || "",
    // 接口无套餐级总额度/有效期，用月度窗口代表套餐限额与周期
    planQuota: r.AFPMonthly?.Quota ?? null,
    planStart: r.AFPMonthly?.SubscribeTime ?? null,
    planEnd: r.AFPMonthly?.ResetTime ?? null,
    buckets,
  };
}
