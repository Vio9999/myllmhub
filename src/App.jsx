import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import QuotaCard from "./components/QuotaCard";
import PlanInfo from "./components/PlanInfo";

const CACHE_KEY = "llmhub:cache:v1";
// 缓存 5 分钟内算新鲜：打开 App 自动拉一次，但 5 分钟内重复打开不再打扰方舟接口，
// 避免频繁请求被判定异常。点 Refresh 总是强制刷新。
const STALE_MS = 5 * 60 * 1000;

function fmtClock(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    return { data: c.data, at: c.at };
  } catch {
    return null;
  }
}

function saveCache(data, at) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, at }));
  } catch {
    /* 忽略配额错误 */
  }
}

const containerVariant = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
};

export default function App() {
  const [data, setData] = useState(() => loadCache()?.data ?? null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState(() => loadCache()?.at ?? null);
  const [now, setNow] = useState(Date.now());

  // 找后端要数据：后端拿着登录 cookie 去方舟抓，App 这边不碰 cookie、不点书签。
  const fetchUsage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/usage", { cache: "no-store" });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || `HTTP ${res.status}`);
      }
      const arr = await res.json();
      const at = Date.now();
      setData(arr);
      setLastFetch(at);
      saveCache(arr, at);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // 打开 App：缓存超过 5 分钟（或没有）才自动拉一次，避免频繁打扰方舟接口。
  useEffect(() => {
    const c = loadCache();
    const stale = !c || !c.at || Date.now() - c.at > STALE_MS;
    if (stale) fetchUsage();
  }, [fetchUsage]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const isEmpty = !data && !error;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-line bg-soft">
        <div className="relative mx-auto flex min-h-[52px] max-w-md items-center justify-center px-6 py-3">
          <h1 className="font-hand text-[30px] font-bold leading-none text-ink">LLM HUB</h1>
          <div className="absolute right-6 flex flex-col items-end gap-1">
            <button
              onClick={fetchUsage}
              disabled={loading}
              className="inline-flex items-center gap-1.5 py-0.5 text-[12px] font-medium text-ink underline underline-offset-4 decoration-1 decoration-ink2/50 transition active:scale-95 disabled:opacity-40"
            >
              {loading ? "Loading…" : "Refresh"}
            </button>
            <p className="text-[10px] text-ink3">
              {lastFetch ? `Updated ${fmtClock(lastFetch)}` : "Tap Refresh ->"}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-6 py-10">
        {error && (
          <div className="mb-4 rounded-xl bg-danger-soft p-3 text-[13px] text-danger">
            {error}
          </div>
        )}

        <AnimatePresence mode="popLayout">
          {data?.map((p) => (
            <motion.section key={p.id} layout exit={{ opacity: 0 }} className="mb-12">
              <div className="-mt-0.5 mb-[26px] flex items-center gap-2 px-1">
                <span className="size-1.5 rounded-full bg-accent" />
                <span className="text-[13px] font-semibold text-ink">{p.name}</span>
                {p.plan && (
                  <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent">
                    {p.plan}
                  </span>
                )}
                {p.buckets?.length > 0 && (
                  <span className="text-[11px] text-ink3">{p.buckets.length} items</span>
                )}
              </div>
              {p.error ? (
                <div className="rounded-xl bg-danger-soft p-3 text-[12px] text-danger">
                  {p.error}
                </div>
              ) : (
                <>
                  <PlanInfo provider={p} now={now} />
                  <div className="my-[32px] h-px bg-black/[0.07]" />
                  <motion.div
                    variants={containerVariant}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 gap-[26px]"
                  >
                    {p.buckets?.map((b) => (
                      <QuotaCard key={b.key} bucket={b} now={now} />
                    ))}
                  </motion.div>
                </>
              )}
            </motion.section>
          ))}
        </AnimatePresence>

        {isEmpty && (
          <div className="flex flex-col items-center gap-3 py-24 text-center text-[13px] text-ink2">
            <span className="text-[15px] font-medium text-ink">
              {loading ? "加载中…" : "还没有数据"}
            </span>
            {!loading && (
              <span className="text-ink3">点右上角 Refresh 重新拉取。</span>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
