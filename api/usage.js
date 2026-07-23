import { fetchAll } from "../server/adapters.js";

// Vercel serverless function: /api/usage
// 生产环境 ARK_COOKIE 从 Vercel 环境变量注入 process.env
export default async function handler(_req, res) {
  try {
    const out = await fetchAll({});
    res.status(200).json(out);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
