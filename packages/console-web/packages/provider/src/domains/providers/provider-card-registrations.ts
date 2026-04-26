import { ProviderCardAntigravity } from "./components/provider-card-antigravity";
import { ProviderCardCerebras } from "./components/provider-card-cerebras";
import { ProviderCardCodex } from "./components/provider-card-codex";
import { ProviderCardGemini } from "./components/provider-card-gemini";
import { ProviderCardGoogle } from "./components/provider-card-google";
import { ProviderCardMiniMax } from "./components/provider-card-minimax";
import { ProviderCardOpenRouter } from "./components/provider-card-openrouter";
import { registerProviderCardRenderer } from "./provider-card-registry-store";

const providerCardRegistrations = [
  {
    owner: { kind: "cli", cliId: "antigravity" },
    render: ProviderCardAntigravity,
  },
  {
    owner: { kind: "cli", cliId: "codex" },
    render: ProviderCardCodex,
  },
  {
    owner: { kind: "cli", cliId: "gemini-cli" },
    render: ProviderCardGemini,
  },
  {
    owner: { kind: "vendor", vendorId: "minimax" },
    render: ProviderCardMiniMax,
  },
  {
    owner: { kind: "vendor", vendorId: "cerebras" },
    render: ProviderCardCerebras,
  },
  {
    owner: { kind: "vendor", vendorId: "google" },
    render: ProviderCardGoogle,
  },
  {
    owner: { kind: "vendor", vendorId: "openrouter" },
    render: ProviderCardOpenRouter,
  },
] as const;

for (const binding of providerCardRegistrations) {
  registerProviderCardRenderer(binding);
}
