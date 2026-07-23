import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fetchAll } from "./server/adapters.js";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "api-dev",
        configureServer(server) {
          server.middlewares.use("/api/usage", async (_req, res) => {
            try {
              const out = await fetchAll({ ARK_COOKIE: env.ARK_COOKIE });
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify(out));
            } catch (e) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: e.message }));
            }
          });
        },
      },
    ],
  };
});
