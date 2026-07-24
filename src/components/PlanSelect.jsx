import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

// Plan 选择下拉：替换原来静态的 plan 名字那一行。选中即切换整页数据。
// options: [{ id, name }]；value: 当前选中 id；onChange(id)。
// 自定义实现（不用原生 select）：iOS 上原生 select 不可控且丑，这里对齐全站单色风格 + motion 动画。
export default function PlanSelect({ options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = options.find((o) => o.id === value) || options[0];

  // 打开时：点外面 / 按 Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-lg py-0.5 pl-0.5 pr-1.5 transition-colors hover:bg-card-hover active:scale-[0.98]"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="size-1.5 rounded-full bg-accent" />
        <span className="text-[13px] font-semibold text-ink">{selected?.name ?? "-"}</span>
        <motion.svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          className="text-ink3"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
        >
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </motion.svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="absolute left-0 top-full z-20 mt-1 min-w-[190px] overflow-hidden rounded-xl border border-line bg-soft py-1 shadow-[0_8px_24px_-8px_rgba(15,20,25,0.18)]"
          >
            {options.map((o) => {
              const active = o.id === value;
              return (
                <li key={o.id} role="option" aria-selected={active}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(o.id);
                      setOpen(false);
                    }}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-card-hover"
                  >
                    <span className={active ? "text-[13px] font-semibold text-ink" : "text-[13px] text-ink2"}>
                      {o.name}
                    </span>
                    {active && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="text-accent">
                        <path
                          d="M5 12l5 5 9-10"
                          stroke="currentColor"
                          strokeWidth="2.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
