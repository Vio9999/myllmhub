/* ── 平台定义：每个平台怎么查额度/限流 ── */

export const PROVIDERS = [
  {
    id: "volcengine",
    name: "火山方舟",
    sub: "Agent Plan",
    color: "#6d4acb",
    authType: "bearer",
    proxyPath: "/proxy/ark",
    host: "ark.cn-beijing.volces.com",
    // 额度查询端点
    quotaEndpoints: [
      "/api/plan/v3/usage",
      "/api/v3/usage",
    ],
    // 探测端点：发一个 1-token 请求看 rate limit headers 和 usage
    probeEndpoint: {
      path: "/api/plan/v3/chat/completions",
      method: "POST",
      body: (model) => ({
        model: model || "doubao-seed-2.0-lite",
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
    },
    // 响应头里的限流字段
    rateLimitHeaders: {
      remaining: null, // 方舟不在 header 里返限流
    },
  },
  {
    id: "openai",
    name: "OpenAI",
    sub: "GPT / o-series",
    color: "#10a37f",
    authType: "bearer",
    proxyPath: "/proxy/openai",
    host: "api.openai.com",
    quotaEndpoints: [
      "/v1/usage?date=", // 后面拼日期
    ],
    probeEndpoint: {
      path: "/v1/chat/completions",
      method: "POST",
      body: () => ({
        model: "gpt-4o-mini",
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
    },
    rateLimitHeaders: {
      limit: "x-ratelimit-limit-requests",
      remaining: "x-ratelimit-remaining-requests",
      reset: "x-ratelimit-reset-requests",
      tokenLimit: "x-ratelimit-limit-tokens",
      tokenRemaining: "x-ratelimit-remaining-tokens",
    },
  },
  {
    id: "anthropic",
    name: "Anthropic",
    sub: "Claude",
    color: "#d97757",
    authType: "x-api-key",
    proxyPath: "/proxy/anthropic",
    host: "api.anthropic.com",
    quotaEndpoints: [],
    probeEndpoint: {
      path: "/v1/messages",
      method: "POST",
      body: () => ({
        model: "claude-haiku-4-5",
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
    },
    rateLimitHeaders: {
      limit: "anthropic-ratelimit-requests-limit",
      remaining: "anthropic-ratelimit-requests-remaining",
      reset: "anthropic-ratelimit-requests-reset",
      tokenLimit: "anthropic-ratelimit-tokens-limit",
      tokenRemaining: "anthropic-ratelimit-tokens-remaining",
    },
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    sub: "V3 / R1",
    color: "#4b6bfb",
    authType: "bearer",
    proxyPath: "/proxy/deepseek",
    host: "api.deepseek.com",
    quotaEndpoints: [],
    probeEndpoint: {
      path: "/v1/chat/completions",
      method: "POST",
      body: () => ({
        model: "deepseek-chat",
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
    },
    rateLimitHeaders: {},
  },
  {
    id: "gemini",
    name: "Google",
    sub: "Gemini",
    color: "#4285f4",
    authType: "url-key",
    proxyPath: "/proxy/gemini",
    host: "generativelanguage.googleapis.com",
    quotaEndpoints: [],
    probeEndpoint: {
      path: "", // 动态拼
      method: "POST",
      body: () => ({
        contents: [{ role: "user", parts: [{ text: "hi" }] }],
        generationConfig: { maxOutputTokens: 1 },
      }),
      // Gemini 特殊：key 在 URL 上
      urlBuilder: (path, key) =>
        `/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`,
    },
    rateLimitHeaders: {},
  },
];

/** 从 localStorage 读取某平台的 Key */
export function loadKey(providerId) {
  try {
    return localStorage.getItem(`quota_key_${providerId}`) || "";
  } catch {
    return "";
  }
}

/** 保存某平台的 Key */
export function saveKey(providerId, value) {
  try {
    localStorage.setItem(`quota_key_${providerId}`, value || "");
  } catch {}
}

/** 获取所有已配置 Key 的平台 */
export function configuredProviders() {
  return PROVIDERS.filter((p) => loadKey(p.id));
}