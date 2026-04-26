import { Box, Card, Flex, Text } from "@radix-ui/themes";
import { PencilIcon, TrashIcon } from "./action-icons";
import { AgentTypeChip } from "./agent-type-chip";
import { FallbackChainPreview } from "./fallback-chain";
import { agentProfileToDraft, resolveCLI } from "../domain/profile-adapters";
import { useAgentProfile } from "../domain/profile-api";
import type { AgentProfileListItem, ProviderSurfaceBindingView } from "@code-code/agent-contract/platform/management/v1";
import type { VendorView } from "@code-code/agent-contract/platform/provider/v1";
import type { CLIReference, MCPResourceSummary, SessionRuntimeOptions, TextResourceSummary } from "../domain/types";
import { ActionIconButton, AsyncState, ConfirmActionButton, NoDataCallout, SoftBadge } from "@code-code/console-web-ui";

type ProfileCardProps = {
  item: AgentProfileListItem;
  clis: CLIReference[];
  sessionRuntimeOptions: SessionRuntimeOptions;
  providerSurfaces: ProviderSurfaceBindingView[];
  vendors: VendorView[];
  mcps: MCPResourceSummary[];
  skills: TextResourceSummary[];
  rules: TextResourceSummary[];
  onEdit: (profileId: string) => void;
  onDelete: (profileId: string) => Promise<void>;
};

export function ProfileCard({ item, clis, sessionRuntimeOptions, providerSurfaces, vendors, mcps, skills, rules, onEdit, onDelete }: ProfileCardProps) {
  const { profile, isLoading, isError } = useAgentProfile(item.profileId);
  const draft = profile ? agentProfileToDraft(profile, providerSurfaces, vendors, sessionRuntimeOptions) : null;
  const cli = resolveCLI(draft?.selectionStrategy.cliId || item.providerId, clis);
  const resourceTags = draft
    ? [
        ...mcps.filter((resource) => draft.mcpIds.includes(resource.id)).map((resource) => resource.name),
        ...skills.filter((resource) => draft.skillIds.includes(resource.id)).map((resource) => resource.name),
        ...rules.filter((resource) => draft.ruleIds.includes(resource.id)).map((resource) => resource.name)
      ]
    : [];

  return (
    <Card size="2">
      <Flex direction="column" gap="3">
        <Flex justify="between" align="start" gap="3">
          <Box>
            <Text size="3" weight="medium">{item.name}</Text>
          </Box>
          <Flex gap="2">
            <ActionIconButton size="1" variant="soft" color="gray" aria-label="Edit profile" title="Edit profile" onClick={() => onEdit(item.profileId)}>
              <PencilIcon />
            </ActionIconButton>
            <ConfirmActionButton
              title={`Delete ${item.name}`}
              description={`Delete ${item.name}?`}
              confirmText="Delete"
              onConfirm={async () => {
                await onDelete(item.profileId);
              }}
            >
              <ActionIconButton
                size="1"
                variant="soft"
                color="red"
                aria-label="Delete profile"
                title="Delete profile"
              >
                <TrashIcon />
              </ActionIconButton>
            </ConfirmActionButton>
          </Flex>
        </Flex>

        <AgentTypeChip agentType={cli?.displayName || item.providerId} iconUrl={cli?.iconUrl} />
        <div style={{ width: "fit-content" }}>
          <SoftBadge color="gray" label={draft?.selectionStrategy.executionClass || item.selectionSummary} />
        </div>

        <AsyncState
          loading={isLoading}
          error={isError ? new Error("Failed to load profile details.") : undefined}
          isEmpty={!draft}
          emptyContent={<NoDataCallout size="2">Profile details unavailable.</NoDataCallout>}
        >
          {draft ? <FallbackChainPreview items={draft.selectionStrategy.fallbackChain} /> : null}
        </AsyncState>

        {resourceTags.length > 0 ? (
          <Flex gap="2" wrap="wrap">
            {resourceTags.map((tag) => (
              <SoftBadge key={`${item.profileId}:${tag}`} color="gray" label={tag} />
            ))}
          </Flex>
        ) : null}
      </Flex>
    </Card>
  );
}
