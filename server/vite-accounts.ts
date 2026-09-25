import { loadEnv } from "vite";
import type { Plugin } from "vite";
import { createAccountHandler } from "./account";

export function accountsPlugin(): Plugin {
  const handler = createAccountHandler();
  return {
    name: "champions-accounts",
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.root, "");
      for (const key of [
        "UPSTASH_REDIS_REST_URL",
        "UPSTASH_REDIS_REST_TOKEN",
        "KV_REST_API_URL",
        "KV_REST_API_TOKEN",
        "ACCOUNTS_ORIGIN",
        "ACCOUNTS_DB_PATH",
      ]) {
        if (!process.env[key] && env[key]) process.env[key] = env[key];
      }
      server.middlewares.use("/api/account", (req, res) => {
        void handler(req, res);
      });
    },
  };
}
