// 多平台适配器注册表。新增平台（Codex / Coding Plan…）在这里注册一个 adapter 即可，
// UI 和 API 层不用改。统一返回 { id, name, plan?, buckets[], error? }
// bucket: { key, label, short, windowSeconds, quota, used, unit, resetAt, subscribeAt }

import { fetchArk, fetchArkCoding } from "./ark.js";

export const adapters = [
  { id: "volcengine-agentplan", name: "Ark Agent Plan", fetch: fetchArk },
  { id: "volcengine-codingplan", name: "Ark Coding Plan", fetch: fetchArkCoding },
  // { id: "openai-codex", name: "OpenAI Codex Plus", fetch: fetchCodex },
];

export async function fetchAll(credentials = {}) {
  const settled = await Promise.allSettled(
    adapters.map(async (a) => {
      const r = await a.fetch(credentials);
      return { ...r, id: a.id, name: a.name };
    })
  );
  return settled.map((s, i) =>
    s.status === "fulfilled"
      ? s.value
      : { id: adapters[i].id, name: adapters[i].name, error: s.reason?.message || String(s.reason) }
  );
}
