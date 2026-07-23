import { motion } from "motion/react";

function fmtNum(n) {
  if (n == null || Number.isNaN(n)) return "-";
  if (n >= 1e8) return (n / 1e8).toFixed(2) + "亿";
  if (n >= 1e4) return (n / 1e4).toFixed(1) + "万";
  return Math.round(n).toLocaleString();
}

function fmtCountdown(ms) {
  if (ms <= 0) return "已重置";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}天${h}小时后`;
  if (h > 0) return `${h}小时${m}分后`;
  return `${m}分后`;
}

function fmtTime(ts) {
  if (!ts) return "-";
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function QuotaCard({ bucket, now }) {
  const pct = bucket.quota > 0 ? (bucket.used / bucket.quota) * 100 : 0;
  const remaining = Math.max(0, bucket.quota - bucket.used);
  const resetIn = bucket.resetAt ? bucket.resetAt - now : null;
  const color =
    pct >= 80 ? "var(--color-danger)" : pct >= 50 ? "var(--color-warn)" : "var(--color-accent)";

  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-ink">{bucket.label}</span>
        <span className="text-[11px] text-ink2">
          {resetIn != null ? fmtCountdown(resetIn) : ""}
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-[26px] font-semibold leading-none tracking-tight" style={{ color }}>
          {pct.toFixed(1)}
          <span className="text-sm font-medium">%</span>
        </span>
        <span className="text-[11px] text-ink2">已用</span>
      </div>
      <div className="mt-1.5 text-[11px] text-ink2">
        {fmtNum(bucket.used)} / {fmtNum(bucket.quota)} {bucket.unit}
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--color-line)" }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(pct, 100)}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-ink2">
        <span>剩 {fmtNum(remaining)}</span>
        <span>重置 {fmtTime(bucket.resetAt)}</span>
      </div>
    </div>
  );
}
