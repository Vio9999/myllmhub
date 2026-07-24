// 方舟套餐适配器：用登录 cookie 扒官方控制台接口
// 数据源：
//   Agent Plan  - GetAgentPlanAFPUsage(GET) + ListSubscribeTrade(ResourceTypes:["AgentPlan"])
//   Coding Plan - GetCodingPlanUsage(POST{}) + ListSubscribeTrade(ResourceTypes:["CodingPlan"])
// 统一返回 { id, name, plan?, planQuota?, planStart?, planEnd?, subscribed, buckets[], error? }
// bucket: { key, label, short, windowSeconds, quota, used, unit, percent?, resetAt, subscribeAt }
//   - Agent：有绝对配额 quota/used/unit(AFP)，pct 由 used/quota 算
//   - Coding：只有百分比 percent + 重置时间，没有绝对配额（quota/used/unit 为 null）

const AGENT_USAGE_URL =
  "https://console.volcengine.com/api/top/ark/cn-beijing/2024-01-01/GetAgentPlanAFPUsage";
const CODING_USAGE_URL =
  "https://console.volcengine.com/api/top/ark/cn-beijing/2024-01-01/GetCodingPlanUsage";
const TRADE_URL =
  "https://console.volcengine.com/api/top/ark/cn-beijing/2024-01-01/ListSubscribeTrade";
const AGENT_REFERER =
  "https://console.volcengine.com/ark/region:cn-beijing/subscription/agent-plan";
const CODING_REFERER =
  "https://console.volcengine.com/ark/region:cn-beijing/subscription/coding-plan";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// Agent Plan 窗口：key 对应返回字段 AFP<Cap(key)>，ResetTime 为毫秒
const AGENT_WINDOWS = [
  { key: "fiveHour", label: "5 Hours", short: "5h", seconds: 18000 },
  { key: "weekly", label: "This Week", short: "Wk", seconds: 604800 },
  { key: "monthly", label: "This Month", short: "Mo", seconds: 2592000 },
];

// Coding Plan 窗口：按 Level 取；只有 Percent + ResetTimestamp(秒)，session 无重置(-1)
const CODING_WINDOWS = [
  { level: "session", label: "Session", short: "Ses", seconds: null },
  { level: "weekly", label: "Last 7 Days", short: "7d", seconds: 604800 },
  { level: "monthly", label: "Last 30 Days", short: "30d", seconds: 2592000 },
];

const cap = (s) => s[0].toUpperCase() + s.slice(1);

function baseHeaders(cookie, referer) {
  return {
    Cookie: cookie,
    "User-Agent": UA,
    Accept: "application/json, text/plain, */*",
    Referer: referer,
    Origin: "https://console.volcengine.com",
  };
}

async function readArk(res) {
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error("Ark cookie expired or invalid, please run 'npm run dump-cookie' again");
    }
    const t = await res.text().catch(() => "");
    throw new Error(`Ark API ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const err = data?.ResponseMetadata?.Error;
  if (err) throw new Error(err.Message || JSON.stringify(err));
  return data.Result;
}

async function getJson(url, cookie, referer) {
  const res = await fetch(url, { headers: baseHeaders(cookie, referer) });
  return readArk(res);
}

async function postJson(url, cookie, referer, body) {
  const csrf = cookie.match(/(?:^|;\s*)csrfToken=([^;]+)/)?.[1] || "";
  const res = await fetch(url, {
    method: "POST",
    headers: { ...baseHeaders(cookie, referer), "Content-Type": "application/json", "x-csrf-token": csrf },
    body: JSON.stringify(body),
  });
  return readArk(res);
}

// 拉订阅信息：拿真实的会员开始/到期时间。失败返回 []（不影响配额展示）
async function fetchSubscribeTrade(cookie, referer, query) {
  try {
    const trade = await postJson(TRADE_URL, cookie, referer, query);
    return trade?.InfoList || [];
  } catch {
    return [];
  }
}

function pickRunning(infoList, resourceType) {
  return (
    infoList.find((t) => t.ResourceType === resourceType && t.Status === "Running") ||
    infoList.find((t) => t.ResourceType === resourceType) ||
    infoList[0] ||
    null
  );
}

function getCookie(credentials = {}) {
  return credentials.ARK_COOKIE || process.env.ARK_COOKIE || "";
}

// credentials: { ARK_COOKIE }
export async function fetchArk(credentials = {}) {
  const cookie = getCookie(credentials);
  if (!cookie) {
    throw new Error("ARK_COOKIE not configured, please run 'npm run dump-cookie' first");
  }
  const r = await getJson(AGENT_USAGE_URL, cookie, AGENT_REFERER);

  const infoList = await fetchSubscribeTrade(cookie, AGENT_REFERER, {
    ResourceTypes: ["AgentPlan"],
    ResourceNames: ["RealAgentPlanPersonal"],
    BizInfos: ["small", "medium", "large", "max"],
  });
  const sub = pickRunning(infoList, "AgentPlan");
  const subscribed = sub != null || !!r?.PlanType;

  const buckets = AGENT_WINDOWS.map((w) => {
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
    subscribed,
    buckets,
  };
}

// credentials: { ARK_COOKIE }
export async function fetchArkCoding(credentials = {}) {
  const cookie = getCookie(credentials);
  if (!cookie) {
    throw new Error("ARK_COOKIE not configured, please run 'npm run dump-cookie' first");
  }
  // GetCodingPlanUsage 是 POST {}，返回 Status + QuotaUsage(只有百分比 + 重置时间)
  const r = await postJson(CODING_USAGE_URL, cookie, CODING_REFERER, {});

  const infoList = await fetchSubscribeTrade(cookie, CODING_REFERER, {
    ResourceTypes: ["CodingPlan"],
    ResourceNames: [""],
    BizInfos: ["lite", "pro"],
  });
  const sub = pickRunning(infoList, "CodingPlan");
  // Status==="Running" 即订阅生效；trade 拿不到也以 usage 为准
  const subscribed = r?.Status === "Running" || sub != null;

  const byLevel = {};
  for (const q of r?.QuotaUsage || []) byLevel[q.Level] = q;

  const buckets = CODING_WINDOWS.map((w) => {
    const seg = byLevel[w.level] || {};
    const resetTs = seg.ResetTimestamp;
    return {
      key: w.level,
      label: w.label,
      short: w.short,
      windowSeconds: w.seconds,
      // Coding Plan 只有百分比，没有绝对配额
      quota: null,
      used: null,
      unit: null,
      percent: seg.Percent ?? 0,
      // ResetTimestamp 是秒，-1 表示无重置（session）
      resetAt: Number.isFinite(resetTs) && resetTs > 0 ? resetTs * 1000 : null,
      subscribeAt: null,
    };
  });
  return {
    id: "volcengine-codingplan",
    name: "Ark Coding Plan",
    plan: sub?.BizInfo || "",
    planQuota: null,
    planStart: sub ? Date.parse(sub.StartTime) : null,
    planEnd: sub ? Date.parse(sub.EndTime) : null,
    subscribed,
    buckets,
  };
}
