import { useCallback, useEffect, useState } from "react";

/* ── 简单的图标 ── */
const I = {
  Back: () => <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M14 5L8 11L14 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Refresh: () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M14.8 7A6.1 6.1 0 0 0 4.2 4.4L2.5 6" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round"/><path d="M2.5 3.2V6h2.8" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round"/><path d="M3.2 11a6.1 6.1 0 0 0 10.6 2.6l1.7-1.6" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round"/><path d="M15.5 14.8V12h-2.8" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Key: () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/><path d="M11 11l5.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  Check: () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Alert: () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3"/><line x1="8" y1="5" x2="8" y2="9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><circle cx="8" cy="11.5" r="0.7" fill="currentColor"/></svg>,
};

/* ── 工具函数 ── */
const fmtNum = (n) => {
  if (n == null) return "—";
  if (n >= 1e8) return `${(n / 1e8).toFixed(2)}亿`;
  if (n >= 1e4) return `${(n / 1e4).toFixed(1)}万`;
  return n.toLocaleString();
};

const fmtMoney = (v) => v != null ? `¥${Number(v).toFixed(2)}` : "—";

const API = (path) => `/proxy/ark${path}`;

/* ── 页面 ── */
export default function App() {
  const [key, setKey] = useState(() => localStorage.getItem("ark_quota_key") || "");
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);       // API 返回的额度数据
  const [usage, setUsage] = useState(null);      // 聊天 API 累计用量

  // 保存 Key
  const saveKey = (v) => {
    setKey(v);
    localStorage.setItem("ark_quota_key", v || "");
    setShowKeyInput(false);
    if (v) fetchAll(v);
  };

  // 通用请求
  const arkFetch = async (path, apiKey) => {
    const res = await fetch(API(path), {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`${res.status}: ${text.slice(0, 120)}`);
    }
    return res.json();
  };

  // 拉取额度 + 用量
  const fetchAll = useCallback(async (apiKey) => {
    const k = apiKey || key;
    if (!k) return;
    setLoading(true);
    setError("");

    // 并行尝试多个端点
    const tryGet = async (path) => {
      try { return await arkFetch(path, k); } catch { return null; }
    };

    const [quotaData, usageData] = await Promise.all([
      // 尝试可能的额度查询端点
      (async () => {
        for (const ep of ["/api/plan/v3/usage", "/api/v3/usage"]) {
          const d = await tryGet(ep);
          if (d) return d;
        }
        return null;
      })(),
      // 用聊天接口探一下（发 1 token 请求看 usage 返回）
      (async () => {
        try {
          const res = await fetch(API("/api/plan/v3/chat/completions"), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${k}`,
            },
            body: JSON.stringify({
              model: "doubao-seed-2.0-lite",
              max_tokens: 1,
              messages: [{ role: "user", content: "hi" }],
            }),
          });
          if (!res.ok) {
            const text = await res.text().catch(() => "");
            // ModelNotOpen = 模型没开通，但 Key 有效
            if (text.includes("ModelNotOpen")) return { note: "模型未开通，但 Key 有效" };
            throw new Error(`${res.status}: ${text.slice(0, 120)}`);
          }
          return res.json();
        } catch (e) {
          return { error: e.message };
        }
      })(),
    ]);

    setData(quotaData);
    setUsage(usageData);
    setLoading(false);
  }, [key]);

  useEffect(() => {
    if (key) fetchAll(key);
  }, []);

  // 解析数据
  const parsed = parseQuotaData(data, usage);

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      {/* 顶栏 */}
      <header style={{
        padding: "max(env(safe-area-inset-top), 12px) 16px 12px",
        display: "flex", alignItems: "center", gap: 12,
        borderBottom: "1px solid rgba(255,255,255,.06)",
      }}>
        <span style={{ fontSize: 17, fontWeight: 700, flex: 1 }}>方舟额度</span>
        <button onClick={() => { fetchAll(key); setError(""); }}
          disabled={loading || !key}
          style={btnStyle}>{loading ? "查询中…" : <I.Refresh />}</button>
        <button onClick={() => setShowKeyInput(v => !v)}
          style={{ ...btnStyle, color: showKeyInput ? "#a78bfa" : "rgba(255,255,255,.5)" }}>
          <I.Key />
        </button>
      </header>

      {/* Key 输入 */}
      {showKeyInput && (
        <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
          <div style={{ fontSize: 11, opacity: .5, marginBottom: 6 }}>火山方舟 API Key</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="password"
              value={key}
              onChange={e => setKey(e.target.value)}
              placeholder="粘贴你的 API Key…"
              style={{
                flex: 1, height: 40, padding: "0 12px",
                borderRadius: 10, border: "1px solid rgba(255,255,255,.15)",
                background: "rgba(255,255,255,.06)", color: "#fff",
                fontSize: 13, outline: "none",
              }}
            />
            <button onClick={() => saveKey(key)} disabled={!key.trim()}
              style={{
                ...btnStyle, background: "#6d4acb", color: "#fff",
                padding: "0 16px", borderRadius: 10, opacity: key.trim() ? 1 : .4,
              }}>
              保存
            </button>
          </div>
        </div>
      )}

      {/* 主体 */}
      <main style={{ flex: 1, padding: "16px", overflow: "auto" }}>
        {!key ? (
          <Empty msg="请先设置 API Key" action={() => setShowKeyInput(true)} actionLabel="设置 Key" />
        ) : loading ? (
          <Empty msg="正在查询…" />
        ) : error ? (
          <Empty msg={error} action={() => fetchAll(key)} actionLabel="重试" />
        ) : (
          <>
            {/* Hero 卡片 */}
            {parsed.total > 0 && (
              <QuotaHero total={parsed.total} used={parsed.used} remaining={parsed.remaining} />
            )}

            {/* 统计卡片 */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
              <StatCard label="总配额" value={fmtNum(parsed.total)} sub="tokens" />
              <StatCard label="已使用" value={fmtNum(parsed.used)} sub="tokens" />
              <StatCard label="剩余" value={fmtNum(parsed.remaining)} sub="tokens" />
            </div>

            {/* API 原始响应 */}
            {data && (
              <Card title="API 返回">
                <pre style={{ fontSize: 10.5, opacity: .6, overflow: "auto", maxHeight: 200, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                  {JSON.stringify(data, null, 2)}
                </pre>
              </Card>
            )}

            {usage && (
              <Card title="连通性探测" style={{ marginTop: 12 }}>
                <pre style={{ fontSize: 10.5, opacity: .6, overflow: "auto", maxHeight: 200, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                  {JSON.stringify(usage, null, 2)}
                </pre>
              </Card>
            )}

            {/* 说明 */}
            {!data && !error && (
              <div style={{ marginTop: 20, padding: 14, borderRadius: 14, background: "rgba(245,158,11,.1)", border: "1px solid rgba(245,158,11,.2)", fontSize: 11.5, lineHeight: 1.7, opacity: .8 }}>
                <strong>未获取到额度数据</strong><br />
                方舟可能暂未提供公开的额度查询 API。上面显示的是连通性探测结果，可以确认 Key 是否有效。
                如果你知道额度查询的具体接口地址，请告诉我。
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

/* ── 解析额度数据 ── */
function parseQuotaData(quotaData, usageData) {
  const d = quotaData?.data || quotaData || {};
  return {
    total: d.total_tokens || d.total_quota || d.quota || d.limit || d.total || 0,
    used: d.used_tokens || d.used_quota || d.usage || d.consumed || d.used || 0,
    remaining: d.remaining_tokens || d.remaining_quota || d.remaining || 0,
  };
}

/* ── 组件 ── */
function QuotaHero({ total, used, remaining }) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const barColor = pct > 80 ? "#ef4444" : pct > 50 ? "#f59e0b" : "#6d4acb";
  return (
    <div style={{
      padding: "22px 20px", borderRadius: 20, marginBottom: 14,
      background: "linear-gradient(135deg, #1a1040 0%, #34245f 55%, #6d4acb 115%)",
      boxShadow: "0 18px 38px rgba(89,58,160,.3)",
    }}>
      <div style={{ fontSize: 11, opacity: .6, marginBottom: 4 }}>Agent Plan 额度</div>
      <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1, marginBottom: 14 }}>
        {fmtNum(remaining)} <span style={{ fontSize: 13, fontWeight: 500, opacity: .6 }}>剩余</span>
      </div>
      <div style={{ height: 8, borderRadius: 5, background: "rgba(255,255,255,.12)", overflow: "hidden", marginBottom: 6 }}>
        <div style={{ width: `${Math.max(pct, 1)}%`, height: "100%", borderRadius: 5, background: barColor, transition: "width .5s" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, opacity: .5 }}>
        <span>已用 {fmtNum(used)}</span>
        <span>总额 {fmtNum(total)}</span>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div style={{
      padding: "14px 12px", borderRadius: 16, textAlign: "center",
      background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)",
    }}>
      <div style={{ fontSize: 10, opacity: .5, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 750 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, opacity: .4, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Card({ title, children, style }) {
  return (
    <div style={{
      padding: "16px", borderRadius: 16, marginBottom: 12,
      background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)",
      ...style,
    }}>
      {title && <div style={{ fontSize: 13, fontWeight: 650, marginBottom: 10, opacity: .7 }}>{title}</div>}
      {children}
    </div>
  );
}

function Empty({ msg, action, actionLabel }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px", gap: 14 }}>
      <div style={{ fontSize: 13, opacity: .5, textAlign: "center" }}>{msg}</div>
      {action && (
        <button onClick={action} style={{ ...btnStyle, padding: "8px 20px", borderRadius: 10, border: "1px solid rgba(255,255,255,.2)", fontSize: 13 }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

const btnStyle = {
  background: "none", border: "none", color: "rgba(255,255,255,.7)",
  width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center",
  borderRadius: 10, cursor: "pointer", fontSize: 13,
};