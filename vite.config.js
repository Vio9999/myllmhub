import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/proxy/ark": {
        target: "https://ark.cn-beijing.volces.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/proxy\/ark/, ""),
      },
      "/proxy/openai": {
        target: "https://api.openai.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/proxy\/openai/, ""),
      },
      "/proxy/anthropic": {
        target: "https://api.anthropic.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/proxy\/anthropic/, ""),
      },
      "/proxy/deepseek": {
        target: "https://api.deepseek.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/proxy\/deepseek/, ""),
      },
      "/proxy/gemini": {
        target: "https://generativelanguage.googleapis.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/proxy\/gemini/, ""),
      },
    },
  },
});