import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

function fmtNum(n) {
  if (n == null || Number.isNaN(n)) return "-";
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return Math.round(n).toLocaleString();
}

function fmtCountdown(ms) {
  if (ms <= 0) return "Reset";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

function fmtTime(ts) {
  if (!ts) return "-";
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 目标值变化时，从当前显示值平滑过渡到新值（easeOutCubic）
function useCountUp(target, duration = 0.7) {
  const [val, setVal] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef(0);
  useEffect(() => {
    const from = fromRef.current;
    const to = target;
    if (from === to) return;
    const start = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - start) / (duration * 1000));
      const e = 1 - Math.pow(1 - p, 3);
      setVal(from + (to - from) * e);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);
  return val;
}

const itemVariant = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 320, damping: 26 },
  },
};

export default function QuotaCard({ bucket, now }) {
  // Coding Plan 直接给 percent；Agent Plan 用 used/quota 算
  const pct =
    bucket.percent != null
      ? bucket.percent
      : bucket.quota > 0
        ? (bucket.used / bucket.quota) * 100
        : 0;
  const resetIn = bucket.resetAt ? bucket.resetAt - now : null;
  // 数字：超额才跳橙红，平时纯黑；进度条：超额才跳橙红，平时灰
  const textColor =
    pct >= 90 ? "var(--color-danger)" : pct >= 70 ? "var(--color-warn)" : "#000000";
  const barColor =
    pct >= 90 ? "var(--color-danger)" : pct >= 70 ? "var(--color-warn)" : "var(--color-bar)";
  const counted = useCountUp(pct);
  // Coding Plan 没有绝对配额（unit 为 null）：隐藏 "Used X / Y" 行
  const hasUnit = !!bucket.unit;

  return (
    <motion.div
      variants={itemVariant}
      className="rounded-2xl bg-card p-4 transition-colors duration-150 hover:bg-card-hover"
    >
      <div className="flex items-center justify-between">
        <span className="text-[15px] font-light text-[#000000]">{bucket.label}</span>
        {resetIn != null && (
          <span className="rounded-md bg-soft px-1.5 py-0.5 text-[10px] text-ink2">
            {fmtCountdown(resetIn)}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span
          className="text-[22px] font-semibold leading-none tracking-tight tabular-nums"
          style={{ color: textColor }}
        >
          {counted.toFixed(1)}
        </span>
        <span className="text-sm font-medium text-ink2">%</span>
      </div>
      <div className="mt-3.5 h-2 w-full overflow-hidden rounded-full bg-transparent">
        <motion.div
          className="h-full rounded-full"
          style={{ background: barColor }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(pct, 100)}%` }}
          transition={{ type: "spring", stiffness: 90, damping: 18, mass: 0.9 }}
        />
      </div>
      <div className="mt-2.5 flex justify-between text-[11px] text-ink3">
        <span>{hasUnit ? `Used ${fmtNum(bucket.used)} / ${fmtNum(bucket.quota)} ${bucket.unit}` : ""}</span>
        {bucket.resetAt != null && <span>Reset {fmtTime(bucket.resetAt)}</span>}
      </div>
    </motion.div>
  );
}
