// 客户端解析：把书签脚本从方舟抓回的原始数据，解析成 UI 用的结构。
// 和原 server/ark.js 的解析逻辑一致，只是搬到前端——书签只负责抓原始数据，解析在 App 里做。

const WINDOWS = [
  { key: "fiveHour", label: "5 Hours", short: "5h", seconds: 18000 },
  { key: "weekly", label: "This Week", short: "Wk", seconds: 604800 },
  { key: "monthly", label: "This Month", short: "Mo", seconds: 2592000 },
];

const cap = (s) => s[0].toUpperCase() + s.slice(1);

// bundle = 书签回传的对象：
//   { usage, trade, usageStatus, tradeStatus, usageError, tradeError, at }
//   usage / trade 已经是各接口返回的 Result 部分（书签里取过 .Result）
export function parseArk(bundle = {}) {
  const { usage, trade, usageStatus, usageError } = bundle;

  if (usageError) {
    return { id: "volcengine-agentplan", name: "Ark Agent Plan", error: usageError };
  }
  if (!usage) {
    if (usageStatus === 401 || usageStatus === 403) {
      return {
        id: "volcengine-agentplan",
        name: "Ark Agent Plan",
        error: "Cookie 已失效，请在方舟重新登录后再点书签",
      };
    }
    return {
      id: "volcengine-agentplan",
      name: "Ark Agent Plan",
      error: `未拿到数据（HTTP ${usageStatus ?? "?"}）`,
    };
  }

  const r = usage;
  // 订阅信息（会员起止时间）。POST 抓取失败则回退到月度窗口时间，不影响配额展示。
  let sub = null;
  if (trade && Array.isArray(trade.InfoList)) {
    sub =
      trade.InfoList.find(
        (t) => t.ResourceType === "AgentPlan" && t.Status === "Running"
      ) ||
      trade.InfoList[0] ||
      null;
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
    planStart: sub ? Date.parse(sub.StartTime) : r.AFPMonthly?.SubscribeTime ?? null,
    planEnd: sub ? Date.parse(sub.EndTime) : r.AFPMonthly?.ResetTime ?? null,
    buckets,
  };
}
