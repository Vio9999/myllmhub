// 前端调用后端 /api/usage，返回多平台额度数组
// [{ id, name, plan?, buckets[], error? }]
export async function fetchUsage() {
  const r = await fetch("/api/usage", { cache: "no-store" });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
}
