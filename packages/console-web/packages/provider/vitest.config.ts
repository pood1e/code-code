import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["../../test/setup.ts"],
    server: {
      deps: {
        inline: ["@code-code/agent-contract"],
      },
    },
  },
});
