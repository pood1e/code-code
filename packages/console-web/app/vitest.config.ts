import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const agentContractSrc = resolve(dirname(fileURLToPath(import.meta.url)), "../../agent-contract/src");
const chatSrc = resolve(dirname(fileURLToPath(import.meta.url)), "../packages/chat/src");
const overviewSrc = resolve(dirname(fileURLToPath(import.meta.url)), "../packages/overview/src");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@code-code/agent-contract/agent/v1/core": resolve(agentContractSrc, "gen/agent/core/v1/agent_pb.ts"),
      "@code-code/agent-contract/egress/v1": resolve(agentContractSrc, "gen/egress/v1/policy_pb.ts"),
      "@code-code/agent-contract/platform/agent-run/v1": resolve(agentContractSrc, "gen/platform/agent_run/v1/agent_run_pb.ts"),
      "@code-code/agent-contract/platform/agent-session/v1": resolve(agentContractSrc, "gen/platform/agent_session/v1/agent_session_pb.ts"),
      "@code-code/agent-contract/platform/agent-session-action/v1": resolve(agentContractSrc, "gen/platform/agent_session_action/v1/agent_session_action_pb.ts"),
      "@code-code/agent-contract/platform/chat/v1": resolve(agentContractSrc, "gen/platform/chat/v1/chat_service_pb.ts"),
      "@code-code/agent-contract/platform/management/v1": resolve(agentContractSrc, "gen/platform/management/v1/management_pb.ts"),
      "@code-code/console-web-chat": resolve(chatSrc, "index.ts"),
      "@code-code/console-web-overview": resolve(overviewSrc, "index.ts"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["../test/setup.ts"],
  },
});
