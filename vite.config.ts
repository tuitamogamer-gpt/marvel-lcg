import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { accountsPlugin } from "./server/vite-accounts";
export default defineConfig({
  plugins: [react(), accountsPlugin()],
  server: {
    port: 5174,
    strictPort: true,
    host: "0.0.0.0",
    fs: {
      deny: [
        ".env",
        ".env.*",
        "**/.git/**",
        "**/.vercel/**",
        "**/.accounts/**",
        "**/accounts.sqlite*",
        "*.pem",
        "*.crt",
      ],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/src/data/")) return "core-cards";
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id))
            return "react-vendor";
        },
      },
    },
  },
});
