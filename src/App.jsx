import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { fetchUsage } from "./lib/api";
import QuotaCard from "./components/QuotaCard";
import PlanInfo from "./components/PlanInfo";

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
        <div className="relative mx-auto flex min-h-[52px] max-w-md items-center justify-center px-6 py-3">
          <h1 className="font-hand text-[30px] font-bold leading-none text-ink">LLM HUB</h1>
          <div className="absolute right-6 flex flex-col items-end gap-1">
            <button
              onClick={refresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 py-0.5 text-[12px] font-medium text-ink underline underline-offset-4 decoration-1 decoration-ink2/50 transition active:scale-95 disabled:opacity-50"
            >
              {loading && (
                <span className="size-3 animate-spin rounded-full border-2 border-ink2/20 border-t-ink" />
              )}
              {loading ? "Refreshing" : "Refresh"}
            </button>
            <p className="text-[10px] text-ink3">
              {lastFetch ? `Updated ${fmtClock(lastFetch)}` : "Loading…"}
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
                  <PlanInfo provider={p} />
                  <div className="my-[26px] h-px bg-black/[0.07]" />
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

        {!data && !error && (
          <div className="flex flex-col items-center gap-3 py-24 text-[13px] text-ink2">
            <span className="size-5 animate-spin rounded-full border-2 border-line border-t-accent" />
            <span>Loading…</span>
          </div>
        )}
      </main>
    </div>
  );
}
