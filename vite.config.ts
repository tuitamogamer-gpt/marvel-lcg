import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: { port: 5174, strictPort: true, host: "0.0.0.0" },
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
