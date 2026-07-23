import { motion } from "motion/react";

function fmtNum(n) {
  if (n == null || Number.isNaN(n)) return "-";
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return Math.round(n).toLocaleString();
}

function fmtDate(ts) {
  if (!ts) return "-";
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const cardAnim = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { type: "spring", stiffness: 320, damping: 26 },
};

// 套餐概览：左卡套餐类型+限额，右卡周期+起止时间
export default function PlanInfo({ provider }) {
  const plan = provider.plan;
  const quota = provider.planQuota;
  const start = provider.planStart;
  const end = provider.planEnd;
  const days = start && end ? Math.max(0, Math.round((end - start) / 86400000)) : null;
  const planLabel = plan ? plan[0].toUpperCase() + plan.slice(1) : "-";

  return (
    <div className="grid grid-cols-2 gap-4">
      <motion.div {...cardAnim} className="rounded-2xl bg-card p-4">
        <p className="text-[10px] uppercase tracking-wider text-ink3">Plan Type</p>
        <p className="mt-2 text-[22px] font-semibold leading-none text-ink">{planLabel}</p>
        <p className="mt-3 text-[11px] text-ink3">Quota {fmtNum(quota)} AFP</p>
      </motion.div>
      <motion.div {...cardAnim} className="rounded-2xl bg-card p-4">
        <p className="text-[10px] uppercase tracking-wider text-ink3">Plan Period</p>
        <p className="mt-2 text-[22px] font-semibold leading-none text-ink">
          {days != null ? `${days} Days` : "-"}
        </p>
        <p className="mt-3 text-[11px] text-ink3">
          Start {fmtDate(start)} · End {fmtDate(end)}
        </p>
      </motion.div>
    </div>
  );
}
