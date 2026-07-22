import { useCallback, useEffect, useState } from "react";
import { PROVIDERS, loadKey, saveKey, configuredProviders } from "./providers.js";

/* ── 图标 ── */
const I = {
  Back: () => <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M14 5L8 11L14 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Refresh: () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M14.8 7A6.1 6.1 0 0 0 4.2 4.4L2.5 6" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round"/><path d="M2.5 3.2V6h2.8" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round"/><path d="M3.2 11a6.1 6.1 0 0 0 10.6 2.6l1.7-1.6" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round"/><path d="M15.5 14.8V12h-2.8" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Plus: () => <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><line x1="10" y1="4" x2="10" y2="16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><line x1="4" y1="10" x2="16" y2="10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  Check: () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Close: () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><line x1="4" y1="4" x2="14" y2="14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><line x1="14" y1="4" x2="4" y2="14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
  Key: () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4"/><path d="M9.5 9.5L15 15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  Trash: () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6 4V2.5h4V4M4.5 4l.8 9.5h5.4l.8-9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>,
};

/* ── 工具函数 ── */
const fmtNum = (n) => {
  if (n == null) return "—";
  if (n >= 1e8) return `${(n / 1e8).toFixed(2)}亿`;
  if (n >= 1e4) return `${(n / 1e4).toFixed(1)}万`;
  return n.toLocaleString();
};

const fmtTime = (ts) => {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
};

const fmtDate = (d) => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const api = (proxyPath, path) => `${proxyPath}${path}`;

/* ── 主页面 ── */
export default function App() {
  const [page, setPage] = useState("home");       // home | add | detail:{id}
  const [detailId, setDetailId] = useState(null);
  const [results, setResults] = useState({});       // { [providerId]: { quota, rateLimit, error, loading, ts } }
  const [globalLoading, setGlobalLoading] = useState(false);

  // 刷新所有已配置平台
  const refreshAll = useCallback(async () => {
    const configured = configuredProviders();
    if (!configured.length) return;
    setGlobalLoading(true);
    await Promise.all(configured.map((p) => refreshOne(p.id)));
    setGlobalLoading(false);
  }, []);

  // 刷新单个平台
  const refreshOne = async (providerId) => {
    const p = PROVIDERS.find((x) => x.id === providerId);
    if (!p) return;
    const key = loadKey(p.id);
    if (!key) return;

    setResults((prev) => ({ ...prev, [p.id]: { ...prev[p.id], loading: true, error: null } }));

    try {
      const [quota, rateLimit] = await Promise.all([
        fetchQuota(p, key),
        fetchRateLimit(p, key),
      ]);
      setResults((prev) => ({
        ...prev,
        [p.id]: { quota, rateLimit, loading: false, error: null, ts: Date.now() },
      }));
    } catch (err) {
      setResults((prev) => ({
        ...prev,
        [p.id]: { ...prev[p.id], loading: false, error: err.message },
      }));
    }
  };

  // 查询额度
  const fetchQuota = async (provider, key) => {
    const authHeaders = buildAuthHeaders(provider, key);
    for (const ep of provider.quotaEndpoints) {
      try {
        let path = ep;
        // OpenAI usage 需要日期
        if (provider.id === "openai" && ep.includes("?date=")) {
          path = ep + fmtDate(new Date());
        }
        const res = await fetch(api(provider.proxyPath, path), { headers: authHeaders });
        if (res.ok) {
          const data = await res.json();
          return parseQuota(provider, data);
        }
      } catch {}
    }
    return null;
  };

  // 探测限流信息
  const fetchRateLimit = async (provider, key) => {
    const ep = provider.probeEndpoint;
    if (!ep) return null;
    const authHeaders = buildAuthHeaders(provider, key);

    let url, body;
    if (ep.urlBuilder) {
      url = api(provider.proxyPath, ep.urlBuilder("", key));
      body = JSON.stringify(ep.body());
    } else {
      url = api(provider.proxyPath, ep.path);
      body = JSON.stringify(ep.body());
    }

    const res = await fetch(url, {
      method: ep.method,
      headers: { "Content-Type": "application/json", ...authHeaders },
      body,
    });

    // 提取 rate limit headers
    const rl = provider.rateLimitHeaders;
    const headers = {};
    for (const [k, headerName] of Object.entries(rl)) {
      if (headerName) {
        headers[k] = res.headers.get(headerName);
      }
    }

    // 即使请求失败（如 404 ModelNotOpen），headers 里可能仍有配额信息
    return Object.keys(headers).length > 0 ? headers : null;
  };

  // 某一平台的 Key 被删除
  const removeKey = (providerId) => {
    saveKey(providerId, "");
    setResults((prev) => {
      const next = { ...prev };
      delete next[providerId];
      return next;
    });
  };

  // 初始加载
  useEffect(() => {
    refreshAll();
  }, []);

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      {/* 顶栏 */}
      <header style={{
        padding: "max(env(safe-area-inset-top), 12px) 16px 12px",
        display: "flex", alignItems: "center", gap: 12,
        borderBottom: "1px solid rgba(255,255,255,.06)",
      }}>
        {page === "home" ? (
          <>
            <span style={{ fontSize: 17, fontWeight: 700, flex: 1 }}>额度面板</span>
            <button onClick={refreshAll} disabled={globalLoading}
              style={{ ...btnStyle, opacity: globalLoading ? .4 : 1 }}>
              <I.Refresh />
            </button>
            <button onClick={() => setPage("add")}
              style={{ ...btnStyle, color: "#a78bfa" }}>
              <I.Plus />
            </button>
          </>
        ) : (
          <>
            <button onClick={() => { setPage("home"); setDetailId(null); }}
              style={{ ...btnStyle, marginRight: 4 }}>
              <I.Back />
            </button>
            <span style={{ fontSize: 17, fontWeight: 700, flex: 1 }}>
              {page === "add" ? "添加平台" : PROVIDERS.find(p => p.id === detailId)?.name || ""}
            </span>
            {detailId && (
              <button onClick={() => refreshOne(detailId)}
                disabled={results[detailId]?.loading}
                style={{ ...btnStyle, opacity: results[detailId]?.loading ? .4 : 1 }}>
                <I.Refresh />
              </button>
            )}
          </>
        )}
      </header>

      {/* 主体 */}
      <main style={{ flex: 1, padding: "16px", overflow: "auto" }}>
        {page === "home" && <HomeView results={results} onDetail={(id) => { setDetailId(id); setPage("detail"); }} onAdd={() => setPage("add")} />}
        {page === "add" && <AddView onDone={(id) => { setPage("home"); if (id) refreshOne(id); }} />}
        {page === "detail" && detailId && (
          <DetailView
            provider={PROVIDERS.find((p) => p.id === detailId)}
            result={results[detailId]}
            onRemove={() => { removeKey(detailId); setPage("home"); setDetailId(null); }}
          />
        )}
      </main>
    </div>
  );
}

/* ── 首页视图 ── */
function HomeView({ results, onDetail, onAdd }) {
  const configured = configuredProviders();
  const unconfigured = PROVIDERS.filter((p) => !loadKey(p.id));

  return (
    <>
      {/* 已配置的平台卡片 */}
      {configured.length === 0 ? (
        <Empty msg="还没有配置任何平台" action={onAdd} actionLabel="添加平台" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {configured.map((p) => {
            const r = results[p.id];
            return (
              <button key={p.id} onClick={() => onDetail(p.id)}
                style={{
                  ...cardStyle, textAlign: "left", width: "100%", cursor: "pointer",
                  borderLeft: `3px solid ${p.color}`,
                }}>
                {/* 平台名 + 状态 */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: r ? 10 : 0 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                    background: `${p.color}22`, color: p.color, fontSize: 16, fontWeight: 700,
                  }}>
                    {p.name[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 650 }}>{p.name}</div>
                    <div style={{ fontSize: 10.5, opacity: .45 }}>{p.sub}</div>
                  </div>
                  {r?.loading ? (
                    <span style={{ fontSize: 10.5, opacity: .4 }}>查询中…</span>
                  ) : r?.error ? (
                    <span style={{ fontSize: 10.5, color: "#f59e0b" }}>查询失败</span>
                  ) : r ? (
                    <span style={{ fontSize: 10.5, color: "#4ade80" }}>已刷新</span>
                  ) : (
                    <span style={{ fontSize: 10.5, opacity: .3 }}>待查询</span>
                  )}
                </div>
                {/* 数据摘要 */}
                {r && !r.loading && !r.error && (
                  <QuotaSummary provider={p} result={r} />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* 未配置的平台 */}
      {unconfigured.length > 0 && configured.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 11, opacity: .35, marginBottom: 10, paddingLeft: 4 }}>可添加的平台</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {unconfigured.map((p) => (
              <button key={p.id} onClick={() => onDetail(p.id)}
                style={{
                  ...btnStyle, width: "auto", height: 32, padding: "0 12px", gap: 6,
                  border: "1px solid rgba(255,255,255,.1)", borderRadius: 16, fontSize: 11.5,
                }}>
                <span style={{ color: p.color, fontWeight: 700 }}>{p.name[0]}</span>
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/* ── 卡片内摘要 ── */
function QuotaSummary({ provider, result }) {
  const { quota, rateLimit } = result;

  // 用量数据
  if (quota?.total > 0) {
    const pct = Math.min((quota.used / quota.total) * 100, 100);
    const barColor = pct > 80 ? "#ef4444" : pct > 50 ? "#f59e0b" : provider.color;
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, opacity: .55, marginBottom: 4 }}>
          <span>已用 {fmtNum(quota.used)}</span>
          <span>总额 {fmtNum(quota.total)}</span>
        </div>
        <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,.08)", overflow: "hidden" }}>
          <div style={{ width: `${Math.max(pct, 1)}%`, height: "100%", borderRadius: 3, background: barColor, transition: "width .5s" }} />
        </div>
      </div>
    );
  }

  // 限流数据
  if (rateLimit?.remaining != null) {
    const limit = parseInt(rateLimit.limit) || 0;
    const remaining = parseInt(rateLimit.remaining) || 0;
    const used = limit - remaining;
    const pct = limit > 0 ? (used / limit) * 100 : 0;
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, opacity: .55, marginBottom: 4 }}>
          <span>请求配额 {remaining}/{limit}</span>
          {rateLimit.reset && <span>重置 {fmtTime(rateLimit.reset)}</span>}
        </div>
        <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,.08)", overflow: "hidden" }}>
          <div style={{ width: `${Math.max(pct, 1)}%`, height: "100%", borderRadius: 3, background: provider.color, transition: "width .5s" }} />
        </div>
        {rateLimit.tokenRemaining != null && (
          <div style={{ fontSize: 10, opacity: .4, marginTop: 3 }}>
            Token: {rateLimit.tokenRemaining}/{rateLimit.tokenLimit || "—"}
          </div>
        )}
      </div>
    );
  }

  return null;
}

/* ── 详情页 ── */
function DetailView({ provider, result, onRemove }) {
  const [showKey, setShowKey] = useState(false);
  const key = loadKey(provider.id);
  const { quota, rateLimit, loading, error, ts } = result || {};

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* 平台信息 */}
      <div style={{
        ...cardStyle, borderLeft: `3px solid ${provider.color}`,
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
          background: `${provider.color}22`, color: provider.color, fontSize: 20, fontWeight: 700,
        }}>
          {provider.name[0]}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{provider.name}</div>
          <div style={{ fontSize: 11, opacity: .45 }}>{provider.sub}</div>
        </div>
        <button onClick={onRemove}
          style={{ ...btnStyle, color: "#ef4444", opacity: .6 }}>
          <I.Trash />
        </button>
      </div>

      {/* API Key */}
      <div style={cardStyle}>
        <div style={{ fontSize: 11, opacity: .5, marginBottom: 6 }}>API Key</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <code style={{
            flex: 1, fontSize: 11.5, padding: "8px 10px", borderRadius: 8,
            background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)",
            wordBreak: "break-all", opacity: .7,
          }}>
            {showKey ? key : key.slice(0, 8) + "••••••••" + key.slice(-4)}
          </code>
          <button onClick={() => setShowKey((v) => !v)}
            style={{ ...btnStyle, fontSize: 10, width: "auto", padding: "0 8px", opacity: .5 }}>
            {showKey ? "隐藏" : "显示"}
          </button>
        </div>
      </div>

      {/* 额度 */}
      {quota && (
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 650, marginBottom: 12, opacity: .7 }}>用量配额</div>
          {quota.total > 0 ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
                <MiniStat label="总配额" value={fmtNum(quota.total)} />
                <MiniStat label="已使用" value={fmtNum(quota.used)} />
                <MiniStat label="剩余" value={fmtNum(quota.remaining)} color={provider.color} />
              </div>
              <QuotaBar used={quota.used} total={quota.total} color={provider.color} />
            </>
          ) : (
            <div style={{ fontSize: 11, opacity: .5 }}>该平台暂未返回额度数据</div>
          )}
          <RawJson data={quota.raw} />
        </div>
      )}

      {/* 限流 */}
      {rateLimit && (
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 650, marginBottom: 12, opacity: .7 }}>速率限制</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rateLimit.remaining != null && (
              <LimitRow label="请求数" remaining={rateLimit.remaining} limit={rateLimit.limit} reset={rateLimit.reset} color={provider.color} />
            )}
            {rateLimit.tokenRemaining != null && (
              <LimitRow label="Token" remaining={rateLimit.tokenRemaining} limit={rateLimit.tokenLimit} color={provider.color} />
            )}
          </div>
        </div>
      )}

      {/* 错误 */}
      {error && (
        <div style={{ padding: 12, borderRadius: 12, background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.2)", fontSize: 11.5, lineHeight: 1.6, opacity: .8 }}>
          {error}
        </div>
      )}

      {/* 加载 */}
      {loading && (
        <div style={{ textAlign: "center", padding: 20, fontSize: 12, opacity: .4 }}>查询中…</div>
      )}

      {/* 更新时间 */}
      {ts && (
        <div style={{ textAlign: "center", fontSize: 10, opacity: .25 }}>
          更新于 {new Date(ts).toLocaleTimeString("zh-CN")}
        </div>
      )}
    </div>
  );
}

/* ── 添加平台页 ── */
function AddView({ onDone }) {
  const [selected, setSelected] = useState(null);
  const [key, setKey] = useState("");

  const handleSave = () => {
    if (selected && key.trim()) {
      saveKey(selected.id, key.trim());
      onDone(selected.id);
    }
  };

  if (selected) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
            background: `${selected.color}22`, color: selected.color, fontSize: 18, fontWeight: 700,
          }}>
            {selected.name[0]}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 650 }}>{selected.name}</div>
            <div style={{ fontSize: 11, opacity: .45 }}>{selected.sub}</div>
          </div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 11, opacity: .5, marginBottom: 8 }}>API Key</div>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="粘贴 API Key…"
            autoFocus
            style={{
              width: "100%", height: 44, padding: "0 14px",
              borderRadius: 10, border: "1px solid rgba(255,255,255,.15)",
              background: "rgba(255,255,255,.06)", color: "#fff",
              fontSize: 13, outline: "none", boxSizing: "border-box",
            }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={() => setSelected(null)}
              style={{ ...btnStyle, flex: 1, height: 40, border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, fontSize: 13 }}>
              返回
            </button>
            <button onClick={handleSave} disabled={!key.trim()}
              style={{
                ...btnStyle, flex: 1, height: 40, borderRadius: 10, fontSize: 13,
                background: selected.color, color: "#fff", opacity: key.trim() ? 1 : .4,
              }}>
              保存
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 11, opacity: .4, marginBottom: 4, paddingLeft: 4 }}>选择平台</div>
      {PROVIDERS.map((p) => {
        const hasKey = !!loadKey(p.id);
        return (
          <button key={p.id} onClick={() => { if (!hasKey) setSelected(p); }}
            disabled={hasKey}
            style={{
              ...cardStyle, textAlign: "left", width: "100%", cursor: hasKey ? "default" : "pointer",
              display: "flex", alignItems: "center", gap: 12, opacity: hasKey ? .35 : 1,
              borderLeft: hasKey ? "3px solid transparent" : `3px solid ${p.color}`,
            }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
              background: `${p.color}22`, color: p.color, fontSize: 16, fontWeight: 700,
            }}>
              {p.name[0]}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 650 }}>{p.name}</div>
              <div style={{ fontSize: 10.5, opacity: .45 }}>{p.sub}</div>
            </div>
            {hasKey && <span style={{ fontSize: 10.5, color: "#4ade80" }}>已配置</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ── 小部件 ── */
function MiniStat({ label, value, color }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 9.5, opacity: .45, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: color || undefined }}>{value}</div>
    </div>
  );
}

function QuotaBar({ used, total, color }) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  return (
    <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,.08)", overflow: "hidden" }}>
      <div style={{ width: `${Math.max(pct, 1)}%`, height: "100%", borderRadius: 3, background: color, transition: "width .5s" }} />
    </div>
  );
}

function LimitRow({ label, remaining, limit, reset, color }) {
  const r = parseInt(remaining) || 0;
  const l = parseInt(limit) || 1;
  const pct = l > 0 ? ((l - r) / l) * 100 : 0;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
        <span style={{ opacity: .6 }}>{label}</span>
        <span>
          <strong>{r}</strong>
          <span style={{ opacity: .4 }}> / {limit || "—"}</span>
          {reset && <span style={{ opacity: .35, marginLeft: 6 }}>重置 {fmtTime(reset)}</span>}
        </span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,.08)", overflow: "hidden" }}>
        <div style={{ width: `${Math.max(pct, 1)}%`, height: "100%", borderRadius: 2, background: color, opacity: .6, transition: "width .5s" }} />
      </div>
    </div>
  );
}

function RawJson({ data }) {
  if (!data) return null;
  return (
    <details style={{ marginTop: 10 }}>
      <summary style={{ fontSize: 10, opacity: .35, cursor: "pointer" }}>原始响应</summary>
      <pre style={{ fontSize: 10, opacity: .5, overflow: "auto", maxHeight: 160, whiteSpace: "pre-wrap", wordBreak: "break-all", marginTop: 6 }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  );
}

function Empty({ msg, action, actionLabel }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px", gap: 14 }}>
      <div style={{ fontSize: 13, opacity: .4, textAlign: "center" }}>{msg}</div>
      {action && (
        <button onClick={action} style={{ ...btnStyle, padding: "8px 20px", borderRadius: 10, border: "1px solid rgba(255,255,255,.2)", fontSize: 13, width: "auto" }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

/* ── 构建请求头 ── */
function buildAuthHeaders(provider, key) {
  switch (provider.authType) {
    case "bearer":
      return { Authorization: `Bearer ${key}` };
    case "x-api-key":
      return { "x-api-key": key };
    case "url-key":
      return {}; // key 在 URL 上
    default:
      return { Authorization: `Bearer ${key}` };
  }
}

/* ── 解析额度数据 ── */
function parseQuota(provider, data) {
  const d = data?.data || data || {};
  const raw = d;

  // 不同平台返回格式不同
  switch (provider.id) {
    case "openai": {
      // /v1/usage 返回 { data: [...] }
      const items = Array.isArray(d.data) ? d.data : Array.isArray(d) ? d : [];
      // 简单汇总
      let totalTokens = 0;
      for (const item of items) {
        totalTokens += (item.n_context_tokens_total || 0) + (item.n_generated_tokens_total || 0);
      }
      return { total: 0, used: totalTokens, remaining: 0, raw };
    }
    default: {
      return {
        total: d.total_tokens || d.total_quota || d.quota || d.limit || d.total || 0,
        used: d.used_tokens || d.used_quota || d.usage || d.consumed || d.used || 0,
        remaining: d.remaining_tokens || d.remaining_quota || d.remaining || 0,
        raw,
      };
    }
  }
}