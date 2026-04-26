import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, "");
  const consoleAPITarget = (env.CONSOLE_API_PROXY_TARGET || env.VITE_CONSOLE_API_BASE_URL || "http://console.localhost").replace(/\/$/, "");

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api": {
          target: consoleAPITarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      chunkSizeWarningLimit: 800,
      sourcemap: false,
    },
    resolve: {
      alias: {
        "@code-code/console-web-chat": resolve(rootDir, "../packages/chat/src/index.ts"),
        "@copilotkit/web-inspector": resolve(rootDir, "src/lib/copilotkit-web-inspector-browser.ts"),
        "@protobufjs/inquire": resolve(rootDir, "src/lib/protobuf-inquire-browser.cjs"),
      },
    },
  };
});
