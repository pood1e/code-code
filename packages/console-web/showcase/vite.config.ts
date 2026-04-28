import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const rootDir = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(rootDir, "../app");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, "");
  const showcaseAPITarget = (
    env.SHOWCASE_API_PROXY_TARGET ||
    env.VITE_SHOWCASE_API_BASE_URL ||
    "http://localhost:8080"
  ).replace(/\/$/, "");

  return {
    plugins: [react()],
    server: {
      port: 5174,
      proxy: {
        "/api": {
          target: showcaseAPITarget,
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
        "@console-app": resolve(appDir, "src"),
        "@code-code/console-web-chat": resolve(appDir, "../packages/chat/src/index.ts"),
        "@copilotkit/web-inspector": resolve(appDir, "src/lib/copilotkit-web-inspector-browser.ts"),
        "@protobufjs/inquire": resolve(appDir, "src/lib/protobuf-inquire-browser.cjs"),
      },
    },
  };
});
