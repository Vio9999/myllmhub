import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { parseArk } from "./lib/ark";
import QuotaCard from "./components/QuotaCard";
import PlanInfo from "./components/PlanInfo";

// 方舟控制台用量页：点 Refresh 会打开它，用户在页面上点书签抓最新数据。
const ARK_CONSOLE =
  "https://console.volcengine.com/ark/region:cn-beijing/subscription/agent-plan";
const CACHE_KEY = "llmhub:cache:v1";

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
  const [lastFetch, setLastFetch] = useState(() => loadCache()?.at ?? null);
  const [now, setNow] = useState(Date.now());

  // 链接里带 #import= 就是书签抓回来的数据：解析 -> 显示 -> 存缓存 -> 清掉 hash
  useEffect(() => {
    const m = window.location.hash.match(/#import=(.+)$/);
    if (!m) return;
    try {
      const bundle = JSON.parse(decodeURIComponent(m[1]));
      const arr = [parseArk(bundle)];
      const at = bundle.at || Date.now();
      setData(arr);
      setLastFetch(at);
      setError(null);
      saveCache(arr, at);
    } catch (e) {
      setError("数据解析失败: " + e.message);
    }
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }, []);

  // “刷新”= 当前页跳到方舟控制台，去点书签抓最新数据，书签会把数据回带到本页。
  // 用 location.href（同标签页）而不是 window.open（新标签页）：新标签页会让书签回跳到
  // 另一个标签，看起来“回不来”；同标签页则和浏览器里直接点书签是同一条链路。
  const refresh = useCallback(() => {
    window.location.href = ARK_CONSOLE;
  }, []);

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
              onClick={refresh}
              className="inline-flex items-center gap-1.5 py-0.5 text-[12px] font-medium text-ink underline underline-offset-4 decoration-1 decoration-ink2/50 transition active:scale-95"
            >
              Refresh
            </button>
            <p className="text-[10px] text-ink3">
              {lastFetch ? `Updated ${fmtClock(lastFetch)}` : "Tap Refresh →"}
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
            <span className="text-[15px] font-medium text-ink">还没有数据</span>
            <span className="text-ink3">
              点右上角 Refresh 打开方舟控制台，
              <br />
              再点你存的 LLM HUB 书签，数据就会回来。
            </span>
          </div>
        )}
      </main>
    </div>
  );
}
