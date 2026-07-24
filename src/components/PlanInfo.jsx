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
export default function PlanInfo({ provider, now }) {
  // 未订阅：会员等级显示 Not Subscribed、天数显示 0；配额行/起止时间留空。
  const subscribed = provider.subscribed !== false;
  const plan = provider.plan;
  const quota = provider.planQuota;
  const start = provider.planStart;
  const end = provider.planEnd;
  // 剩余天数：实时随 now 递减，到期归零（向上取整，和控制台“剩余时间”一致）
  const days =
    end != null ? Math.max(0, Math.ceil((end - (now ?? Date.now())) / 86400000)) : null;
  const planLabel = !subscribed ? "Not Subscribed" : plan ? plan[0].toUpperCase() + plan.slice(1) : "-";
  // Coding Plan 没有绝对配额（只有百分比），quota 为 null 时这行留空保持卡片等高
  const showQuota = subscribed && quota != null;

  return (
    <div className="grid grid-cols-2 gap-4">
      <motion.div {...cardAnim} className="rounded-2xl bg-card p-4">
        <p className="text-[10px] uppercase tracking-wider text-ink3">Plan Type</p>
        <p className="mt-2 text-[22px] font-semibold leading-none text-ink">{planLabel}</p>
        <p className="mt-3 text-[11px] text-ink3">{showQuota ? `Quota ${fmtNum(quota)} AFP` : ""}</p>
      </motion.div>
      <motion.div {...cardAnim} className="rounded-2xl bg-card p-4">
        <p className="text-[10px] uppercase tracking-wider text-ink3">Remaining</p>
        <p className="mt-2 text-[22px] font-semibold leading-none text-ink">
          {!subscribed ? "0 Days" : days != null ? `${days} Days` : "-"}
        </p>
        <p className="mt-3 text-[11px] text-ink3">
          {subscribed ? `Start ${fmtDate(start)} · End ${fmtDate(end)}` : ""}
        </p>
      </motion.div>
    </div>
  );
}
