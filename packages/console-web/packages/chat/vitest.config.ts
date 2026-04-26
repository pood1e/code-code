import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const agentContractSrc = resolve(dirname(fileURLToPath(import.meta.url)), "../../../agent-contract/src");

export default defineConfig({
  resolve: {
    alias: {
      "@code-code/agent-contract/agent/v1/cap": resolve(agentContractSrc, "gen/agent/cap/v1/cap_pb.ts"),
      "@code-code/agent-contract/agent/v1/core": resolve(agentContractSrc, "gen/agent/core/v1/agent_pb.ts"),
      "@code-code/agent-contract/provider/v1": resolve(agentContractSrc, "gen/provider/v1/provider_pb.ts"),
      "@code-code/agent-contract/platform/agent-run/v1": resolve(agentContractSrc, "gen/platform/agent_run/v1/agent_run_pb.ts"),
      "@code-code/agent-contract/platform/agent-profile/v1": resolve(agentContractSrc, "gen/platform/agent_profile/v1/agent_profile_pb.ts"),
      "@code-code/agent-contract/platform/agent-session/v1": resolve(agentContractSrc, "gen/platform/agent_session/v1/agent_session_pb.ts"),
      "@code-code/agent-contract/platform/agent-session-action/v1": resolve(agentContractSrc, "gen/platform/agent_session_action/v1/agent_session_action_pb.ts"),
      "@code-code/agent-contract/platform/management/v1": resolve(agentContractSrc, "gen/platform/management/v1/management_pb.ts"),
      "@code-code/agent-contract/platform/mcp/v1": resolve(agentContractSrc, "gen/platform/mcp/v1/mcp_pb.ts"),
      "@code-code/agent-contract/platform/rule/v1": resolve(agentContractSrc, "gen/platform/rule/v1/rule_pb.ts"),
      "@code-code/agent-contract/platform/skill/v1": resolve(agentContractSrc, "gen/platform/skill/v1/skill_pb.ts"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["../../test/setup.ts"],
  },
});
