import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { fetchUsage } from "./lib/api";
import QuotaCard from "./components/QuotaCard";

function fmtClock(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const containerVariant = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
};

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [now, setNow] = useState(Date.now());

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await fetchUsage();
      setData(d);
      setLastFetch(Date.now());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-line bg-soft">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-[16px] font-semibold tracking-tight text-ink">
              额度监控
            </h1>
            <p className="mt-0.5 text-[11px] text-ink2">
              {lastFetch ? `更新于 ${fmtClock(lastFetch)}` : "加载中…"}
            </p>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-white shadow-sm transition active:scale-95 disabled:opacity-60"
          >
            {loading && (
              <span className="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            )}
            {loading ? "刷新中" : "刷新"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-5">
        {error && (
          <div className="mb-4 rounded-xl bg-danger-soft p-3 text-[13px] text-danger">
            {error}
          </div>
        )}

        <AnimatePresence mode="popLayout">
          {data?.map((p) => (
            <motion.section key={p.id} layout exit={{ opacity: 0 }} className="mb-7">
              <div className="mb-3 flex items-center gap-2 px-1">
                <span className="size-1.5 rounded-full bg-accent" />
                <span className="text-[13px] font-semibold text-ink">{p.name}</span>
                {p.plan && (
                  <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent">
                    {p.plan}
                  </span>
                )}
                {p.buckets?.length > 0 && (
                  <span className="text-[11px] text-ink3">{p.buckets.length} 项</span>
                )}
              </div>
              {p.error ? (
                <div className="rounded-xl bg-danger-soft p-3 text-[12px] text-danger">
                  {p.error}
                </div>
              ) : (
                <motion.div
                  variants={containerVariant}
                  initial="hidden"
                  animate="show"
                  className="grid grid-cols-1 gap-3"
                >
                  {p.buckets?.map((b) => (
                    <QuotaCard key={b.key} bucket={b} now={now} />
                  ))}
                </motion.div>
              )}
            </motion.section>
          ))}
        </AnimatePresence>

        {!data && !error && (
          <div className="flex flex-col items-center gap-3 py-24 text-[13px] text-ink2">
            <span className="size-5 animate-spin rounded-full border-2 border-line border-t-accent" />
            <span>加载中…</span>
          </div>
        )}
      </main>
    </div>
  );
}
