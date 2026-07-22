/* ── 平台定义 ── */

export const PROVIDERS = [
  {
    id: "volcengine",
    name: "火山方舟",
    sub: "Volcengine Ark",
    color: "#6d4acb",
    authType: "bearer",
    proxyPath: "/proxy/ark",
    quotaEndpoints: ["/api/plan/v3/usage", "/api/v3/usage"],
    probe: {
      path: "/api/plan/v3/chat/completions",
      method: "POST",
      body: () => ({ model: "doubao-seed-2.0-lite", max_tokens: 1, messages: [{ role: "user", content: "hi" }] }),
    },
    rateHeaders: {},
  },
  {
    id: "openai",
    name: "OpenAI",
    sub: "GPT / o-series",
    color: "#10a37f",
    authType: "bearer",
    proxyPath: "/proxy/openai",
    quotaEndpoints: ["/v1/usage?date="],
    probe: {
      path: "/v1/chat/completions",
      method: "POST",
      body: () => ({ model: "gpt-4o-mini", max_tokens: 1, messages: [{ role: "user", content: "hi" }] }),
    },
    rateHeaders: { limit: "x-ratelimit-limit-requests", remaining: "x-ratelimit-remaining-requests", reset: "x-ratelimit-reset-requests", tokenLimit: "x-ratelimit-limit-tokens", tokenRemaining: "x-ratelimit-remaining-tokens" },
  },
  {
    id: "anthropic",
    name: "Anthropic",
    sub: "Claude",
    color: "#d97757",
    authType: "x-api-key",
    proxyPath: "/proxy/anthropic",
    quotaEndpoints: [],
    probe: {
      path: "/v1/messages",
      method: "POST",
      body: () => ({ model: "claude-haiku-4-5", max_tokens: 1, messages: [{ role: "user", content: "hi" }] }),
    },
    rateHeaders: { limit: "anthropic-ratelimit-requests-limit", remaining: "anthropic-ratelimit-requests-remaining", reset: "anthropic-ratelimit-requests-reset", tokenLimit: "anthropic-ratelimit-tokens-limit", tokenRemaining: "anthropic-ratelimit-tokens-remaining" },
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    sub: "V3 / R1",
    color: "#4b6bfb",
    authType: "bearer",
    proxyPath: "/proxy/deepseek",
    quotaEndpoints: [],
    probe: {
      path: "/v1/chat/completions",
      method: "POST",
      body: () => ({ model: "deepseek-chat", max_tokens: 1, messages: [{ role: "user", content: "hi" }] }),
    },
    rateHeaders: {},
  },
  {
    id: "gemini",
    name: "Google",
    sub: "Gemini",
    color: "#4285f4",
    authType: "url-key",
    proxyPath: "/proxy/gemini",
    quotaEndpoints: [],
    probe: {
      path: "",
      method: "POST",
      body: () => ({ contents: [{ role: "user", parts: [{ text: "hi" }] }], generationConfig: { maxOutputTokens: 1 } }),
      urlBuilder: (key) => `/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`,
    },
    rateHeaders: {},
  },
]

/* ── Key 存取 ── */
export function loadKey(id) {
  try { return localStorage.getItem(`quota_key_${id}`) || "" } catch { return "" }
}
export function saveKey(id, val) {
  try { localStorage.setItem(`quota_key_${id}`, val || "") } catch {}
}
export function configuredProviders() {
  return PROVIDERS.filter((p) => loadKey(p.id))
}

/* ── 请求逻辑 ── */
function buildHeaders(provider, key) {
  switch (provider.authType) {
    case "bearer": return { Authorization: `Bearer ${key}` }
    case "x-api-key": return { "x-api-key": key }
    default: return {}
  }
}

function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export async function fetchQuota(provider, key) {
  const headers = buildHeaders(provider, key)
  for (const ep of provider.quotaEndpoints) {
    try {
      let path = ep
      if (provider.id === "openai" && ep.includes("?date=")) path = ep + fmtDate(new Date())
      const res = await fetch(`${provider.proxyPath}${path}`, { headers })
      if (res.ok) {
        const data = await res.json()
        const d = data?.data || data || {}
        return { total: d.total_tokens || d.total_quota || d.quota || 0, used: d.used_tokens || d.used_quota || d.usage || 0, remaining: d.remaining_tokens || d.remaining || 0, raw: data }
      }
    } catch {}
  }
  return null
}

export async function fetchRateLimit(provider, key) {
  const ep = provider.probe
  if (!ep) return null
  const headers = buildHeaders(provider, key)
  let url, body
  if (ep.urlBuilder) {
    url = `${provider.proxyPath}${ep.urlBuilder(key)}`
    body = JSON.stringify(ep.body())
  } else {
    url = `${provider.proxyPath}${ep.path}`
    body = JSON.stringify(ep.body())
  }
  try {
    const res = await fetch(url, { method: ep.method, headers: { "Content-Type": "application/json", ...headers }, body })
    const rl = provider.rateHeaders
    const result = {}
    for (const [k, name] of Object.entries(rl)) {
      if (name) result[k] = res.headers.get(name)
    }
    return Object.keys(result).length > 0 ? result : null
  } catch {
    return null
  }
}
