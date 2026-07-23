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
    <div className="min-h-dvh bg-soft">
      <header className="sticky top-0 z-10 border-b border-line bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-[15px] font-semibold text-ink">额度监控</h1>
            <p className="mt-0.5 text-[11px] text-ink2">
              {lastFetch ? `更新于 ${fmtClock(lastFetch)}` : "加载中…"}
            </p>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="rounded-md bg-accent px-3.5 py-1.5 text-[13px] font-medium text-white transition-opacity disabled:opacity-50"
          >
            {loading ? "刷新中" : "刷新"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-5">
        {error && (
          <div
            className="mb-4 rounded-lg border bg-white p-3 text-[13px]"
            style={{ borderColor: "var(--color-danger)", color: "var(--color-danger)" }}
          >
            {error}
          </div>
        )}

        <AnimatePresence mode="popLayout">
          {data?.map((p) => (
            <motion.section
              key={p.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-6"
            >
              <div className="mb-3 flex items-center justify-between px-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-ink">{p.name}</span>
                  {p.plan && (
                    <span className="rounded border border-line bg-white px-1.5 py-0.5 text-[10px] text-ink2">
                      {p.plan}
                    </span>
                  )}
                </div>
              </div>
              {p.error ? (
                <div
                  className="rounded-lg border bg-white p-3 text-[12px]"
                  style={{ borderColor: "var(--color-danger)", color: "var(--color-danger)" }}
                >
                  {p.error}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5">
                  {p.buckets?.map((b) => (
                    <QuotaCard key={b.key} bucket={b} now={now} />
                  ))}
                </div>
              )}
            </motion.section>
          ))}
        </AnimatePresence>

        {!data && !error && (
          <div className="py-20 text-center text-[13px] text-ink2">加载中…</div>
        )}
      </main>
    </div>
  );
}
