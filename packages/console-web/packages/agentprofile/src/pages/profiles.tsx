import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ActionIconButton, AsyncState, ErrorCalloutIf, requestErrorMessage } from "@code-code/console-web-ui";
import { Box, Flex, Grid, Tabs } from "@radix-ui/themes";
import { PlusIcon } from "../components/action-icons";
import { MCPResourceTab } from "../components/mcp-resource-tab";
import { ProfileCard } from "../components/profile-card";
import { ProfileEditorDialog } from "../components/profile-editor-dialog";
import { TextResourceTab } from "../components/text-resource-tab";
import { mcpListItemToSummary, ruleListItemToSummary, skillListItemToSummary } from "../domain/resource-adapters";
import { agentProfileToDraft } from "../domain/profile-adapters";
import { useMCPServers } from "../domain/mcp-api";
import { readProfileRootTab, writeProfileRootTab } from "../domain/profile-page-search";
import {
  deleteMCPResourceDraft,
  deleteRuleResourceDraft,
  deleteSkillResourceDraft,
  loadMCPResourceDraft,
  loadRuleResourceDraft,
  loadSkillResourceDraft,
  saveMCPResourceDraft,
  saveRuleResourceDraft,
  saveSkillResourceDraft,
} from "../domain/profile-resource-actions";
import { createAgentProfile, deleteAgentProfile, mutateAgentProfiles, updateAgentProfile, useAgentProfile, useAgentProfiles } from "../domain/profile-api";
import { useCLIReferences, useProviderSurfaces, useSessionRuntimeOptions, useVendors } from "../domain/reference-data";
import { useRules, useSkills } from "../domain/text-resource-api";

export function ProfilesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [creatingProfile, setCreatingProfile] = useState(false);
  const activeTab = readProfileRootTab(searchParams);

  const profiles = useAgentProfiles();
  const editingProfileQuery = useAgentProfile(creatingProfile ? undefined : editingProfileId || undefined);
  const vendors = useVendors();
  const providerSurfaces = useProviderSurfaces();
  const clis = useCLIReferences();
  const sessionRuntimeOptions = useSessionRuntimeOptions();
  const mcpList = useMCPServers();
  const skillList = useSkills();
  const ruleList = useRules();

  const editingProfile = useMemo(() => {
    if (creatingProfile || !editingProfileQuery.profile) {
      return null;
    }
    return agentProfileToDraft(editingProfileQuery.profile, providerSurfaces.providerSurfaces, vendors.vendors, sessionRuntimeOptions.sessionRuntimeOptions);
  }, [creatingProfile, editingProfileQuery.profile, providerSurfaces.providerSurfaces, sessionRuntimeOptions.sessionRuntimeOptions, vendors.vendors]);

  const mcps = useMemo(() => mcpList.mcps.map(mcpListItemToSummary), [mcpList.mcps]);
  const skills = useMemo(() => skillList.skills.map(skillListItemToSummary), [skillList.skills]);
  const rules = useMemo(() => ruleList.rules.map(ruleListItemToSummary), [ruleList.rules]);
  const handleProfileEditorOpenChange = (open: boolean) => {
    if (!open) {
      setCreatingProfile(false);
      setEditingProfileId(null);
    }
  };

  const pageError = mcpList.error || skillList.error || ruleList.error || vendors.error || providerSurfaces.error || clis.error || sessionRuntimeOptions.error;

  return (
    <Flex direction="column" gap="4">
      <Tabs.Root value={activeTab} onValueChange={(value) => writeProfileRootTab(value, setSearchParams)}>
        <Tabs.List size="2">
          <Tabs.Trigger value="profiles">Profiles</Tabs.Trigger>
          <Tabs.Trigger value="mcps">MCPs</Tabs.Trigger>
          <Tabs.Trigger value="skills">Skills</Tabs.Trigger>
          <Tabs.Trigger value="rules">Rules</Tabs.Trigger>
        </Tabs.List>

        <Box mt="4">
          <ErrorCalloutIf
            error={pageError ? requestErrorMessage(pageError, "Failed to load profile resources.") : ""}
            size="2"
          />

          <Tabs.Content value="profiles">
            <Flex direction="column" gap="3">
              <Flex justify="end">
                <ActionIconButton
                  aria-label="New profile"
                  title="New profile"
                  onClick={() => {
                    setCreatingProfile(true);
                    setEditingProfileId(null);
                  }}
                >
                  <PlusIcon />
                </ActionIconButton>
              </Flex>

              <AsyncState
                loading={profiles.isLoading}
                error={profiles.error}
                isEmpty={profiles.profiles.length === 0}
                emptyTitle="No profiles yet."
              >
                <Grid columns={{ initial: "1", md: "2", xl: "3" }} gap="3">
                  {profiles.profiles.map((item) => (
                    <ProfileCard
                      key={item.profileId}
                      item={item}
                      clis={clis.clis}
                      sessionRuntimeOptions={sessionRuntimeOptions.sessionRuntimeOptions}
                      providerSurfaces={providerSurfaces.providerSurfaces}
                      vendors={vendors.vendors}
                      mcps={mcps}
                      skills={skills}
                      rules={rules}
                      onEdit={(profileId) => {
                        setEditingProfileId(profileId);
                        setCreatingProfile(false);
                      }}
                      onDelete={async (profileId) => {
                        await deleteAgentProfile(profileId);
                        await mutateAgentProfiles();
                      }}
                    />
                  ))}
                </Grid>
              </AsyncState>
            </Flex>
          </Tabs.Content>

          <Tabs.Content value="mcps">
            <MCPResourceTab
              items={mcps}
              onLoad={loadMCPResourceDraft}
              onSave={saveMCPResourceDraft}
              onDelete={deleteMCPResourceDraft}
            />
          </Tabs.Content>

          <Tabs.Content value="skills">
            <TextResourceTab
              kindLabel="Skill"
              items={skills}
              onLoad={loadSkillResourceDraft}
              onSave={saveSkillResourceDraft}
              onDelete={deleteSkillResourceDraft}
            />
          </Tabs.Content>

          <Tabs.Content value="rules">
            <TextResourceTab
              kindLabel="Rule"
              items={rules}
              onLoad={loadRuleResourceDraft}
              onSave={saveRuleResourceDraft}
              onDelete={deleteRuleResourceDraft}
            />
          </Tabs.Content>
        </Box>
      </Tabs.Root>

      <ProfileEditorDialog
        open={creatingProfile || editingProfileId !== null}
        profile={creatingProfile ? null : editingProfile}
        isLoading={!creatingProfile && editingProfileId !== null && editingProfileQuery.isLoading}
        clis={clis.clis}
        sessionRuntimeOptions={sessionRuntimeOptions.sessionRuntimeOptions}
        providerSurfaces={providerSurfaces.providerSurfaces}
        vendors={vendors.vendors}
        mcps={mcps}
        skills={skills}
        rules={rules}
        onOpenChange={handleProfileEditorOpenChange}
        onSubmit={async (draft) => {
          if (editingProfileId && !creatingProfile) {
            await updateAgentProfile(editingProfileId, draft);
          } else {
            await createAgentProfile(draft);
          }
          await mutateAgentProfiles();
        }}
      />
    </Flex>
  );
}
