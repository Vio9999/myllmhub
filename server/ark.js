// 方舟 Agent Plan 适配器：用登录 cookie 扒官方控制台接口
// 数据源：https://console.volcengine.com/.../GetAgentPlanAFPUsage + ListSubscribeTrade

const USAGE_URL =
  "https://console.volcengine.com/api/top/ark/cn-beijing/2024-01-01/GetAgentPlanAFPUsage";
const TRADE_URL =
  "https://console.volcengine.com/api/top/ark/cn-beijing/2024-01-01/ListSubscribeTrade";
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

function baseHeaders(cookie) {
  return {
    Cookie: cookie,
    "User-Agent": UA,
    Accept: "application/json, text/plain, */*",
    Referer: REFERER,
    Origin: "https://console.volcengine.com",
  };
}

async function fetchAFPUsage(cookie) {
  const res = await fetch(USAGE_URL, { headers: baseHeaders(cookie) });
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

// 拉订阅信息：拿到真实的会员开始/到期时间。
// GetAgentPlanAFPUsage 只有配额窗口的 ResetTime（每月滚动重置），不是会员到期日。
// ListSubscribeTrade 是 POST，需要从 cookie 里取 csrfToken 作 x-csrf-token 头。
async function fetchSubscribeTrade(cookie) {
  const csrf = cookie.match(/(?:^|;\s*)csrfToken=([^;]+)/)?.[1] || "";
  const res = await fetch(TRADE_URL, {
    method: "POST",
    headers: {
      ...baseHeaders(cookie),
      "Content-Type": "application/json",
      "x-csrf-token": csrf,
    },
    body: JSON.stringify({
      ResourceTypes: ["AgentPlan"],
      ResourceNames: ["RealAgentPlanPersonal"],
      BizInfos: ["small", "medium", "large", "max"],
    }),
  });
  if (!res.ok) throw new Error(`Ark trade API ${res.status}`);
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

  // 订阅信息失败不影响配额展示，回退到月度窗口
  let sub = null;
  try {
    const trade = await fetchSubscribeTrade(cookie);
    sub =
      (trade?.InfoList || []).find(
        (t) => t.ResourceType === "AgentPlan" && t.Status === "Running"
      ) ||
      trade?.InfoList?.[0] ||
      null;
  } catch {
    sub = null;
  }

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
    plan: sub?.BizInfo || r.PlanType || "",
    planQuota: r.AFPMonthly?.Quota ?? null,
    // 真实会员起止时间（ListSubscribeTrade），失败回退月度窗口
    planStart: sub ? Date.parse(sub.StartTime) : r.AFPMonthly?.SubscribeTime ?? null,
    planEnd: sub ? Date.parse(sub.EndTime) : r.AFPMonthly?.ResetTime ?? null,
    buckets,
  };
}
