import { Box, Button, Flex, Heading } from "@radix-ui/themes";
import { AsyncState, ErrorCalloutIf, NoDataCallout } from "@code-code/console-web-ui";
import { AddProviderDialog } from "../domains/providers/components/add-provider-dialog";
import { ProviderCard } from "../domains/providers/components/provider-card";
import { ProviderDetailsDialog as ProviderDetailsDialog } from "../domains/providers/components/provider-details-dialog";
import { type ProviderConnectOptionKind } from "../domains/providers/provider-connect-options";
import { useProvidersPageController } from "./use-providers-page-controller";

function ProviderAddActions({
  onAdd,
  onRefreshQuota,
  refreshingQuota,
}: {
  onAdd: (kind: ProviderConnectOptionKind) => void;
  onRefreshQuota: () => void;
  refreshingQuota: boolean;
}) {
  return (
    <Flex gap="2" wrap="wrap" justify="end">
      <Button size="2" variant="soft" color="gray" onClick={onRefreshQuota} disabled={refreshingQuota}>
        {refreshingQuota ? "Refreshing quota..." : "Refresh quota"}
      </Button>
      <Button size="2" variant="solid" onClick={() => onAdd("vendorApiKey")}>
        Vendor API Key
      </Button>
      <Button size="2" variant="soft" onClick={() => onAdd("customApiKey")}>
        Custom API Key
      </Button>
      <Button size="2" variant="soft" onClick={() => onAdd("cliOAuth")}>
        CLI OAuth
      </Button>
    </Flex>
  );
}

export function ProvidersPage() {
  const page = useProvidersPageController();
  const handleAddDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && page.searchState.connectSessionId) {
      page.dismissedConnectSessionIDRef.current = page.searchState.connectSessionId;
    }
    page.setIsAddDialogOpen(nextOpen);
    if (!nextOpen) {
      page.updateConnectSessionParam(undefined, undefined);
    }
  };

  return (
    <Box>
      <AddProviderDialog
        open={page.isAddDialogOpen}
        connectSessionId={page.searchState.connectSessionId}
        preferredOptionKind={page.preferredAddKind}
        onOpenChange={handleAddDialogOpenChange}
        onConnectSessionChange={page.updateConnectSessionParam}
        onConnected={page.handleConnected}
      />
      <ProviderDetailsDialog
        provider={page.selectedProvider}
        clis={page.clis}
        surfaces={page.surfaces}
        vendors={page.vendors}
        onClose={page.closeProvider}
        onUpdated={page.refreshProviderPageData}
        onProbeActiveQuery={(provider) => void page.handleProbeProviderActiveQuery(provider)}
        probingProviderId={page.probingProviderId}
      />
      <Flex justify="between" align="start" gap="4" wrap="wrap" mb="4">
        <Box>
          <Heading size="5">Providers</Heading>
        </Box>
        <ProviderAddActions
          onAdd={page.handleAdd}
          onRefreshQuota={() => void page.handleRefreshQuota()}
          refreshingQuota={page.isRefreshingQuota}
        />
      </Flex>

      <ErrorCalloutIf error={page.observabilityProbeError} mb="4" />
      <ErrorCalloutIf error={page.providerStatusEventsError} mb="4" />
      {page.observabilityProbeMessage ? <NoDataCallout mb="4">{page.observabilityProbeMessage}</NoDataCallout> : null}
      <AsyncState
        loading={page.isLoading}
        error={page.blockingError}
        errorTitle="Failed to load providers."
        onRetry={() => void page.mutateProviders()}
        isEmpty={page.sortedProviders.length === 0}
        emptyTitle="No providers."
      >
        <Box
          style={{
            display: "grid",
            gap: "var(--space-3)",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          }}
        >
          {page.sortedProviders.map((provider) => (
            <ProviderCard
              key={provider.providerId}
              provider={provider}
              clis={page.clis}
              onOpen={page.openProvider}
              surfaces={page.surfaces}
              vendors={page.vendors}
              vendorIconUrl={provider.iconUrl}
              workflowStatus={page.providerWorkflowStatuses[provider.providerId]}
              isProbingActiveQuery={page.probingProviderId === provider.providerId}
              onProbeActiveQuery={(nextProvider) => void page.handleProbeProviderActiveQuery(nextProvider)}
            />
          ))}
        </Box>
      </AsyncState>
    </Box>
  );
}
