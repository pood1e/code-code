import { useEffect, useMemo, useState } from "react";
import { Box, Flex } from "@radix-ui/themes";
import { InlineSelect, SoftBadge } from "@code-code/console-web-ui";
import type { ProviderCardRendererContext } from "../provider-card-registry";
import { ProviderQuotaCard } from "./provider-quota-card";
import { listCerebrasQuotaOrganizations, readCerebrasQuotaSummary } from "./provider-card-cerebras-summary";
import { ProviderCardTitleSuffix } from "./provider-card-title-suffix";
import { formatQuotaAmountSummary } from "../provider-quota-presentation";

type Props = ProviderCardRendererContext;

export function ProviderCardCerebras({ observability, observabilityError, isLoading, status }: Props) {
  const organizations = useMemo(() => listCerebrasQuotaOrganizations(observability), [observability]);
  const [selectedOrgID, setSelectedOrgID] = useState("");
  const resolvedOrgID = useMemo(
    () => resolveSelectedOrganizationID(organizations, selectedOrgID),
    [organizations, selectedOrgID],
  );
  const selectedOrg = useMemo(
    () => organizations.find((item) => item.id === resolvedOrgID) ?? null,
    [organizations, resolvedOrgID],
  );
  const summary = readCerebrasQuotaSummary(observability, resolvedOrgID, new Date());
  const rows = summary?.rows.map((row) => ({
    id: row.id,
    label: row.label,
    value: formatQuotaAmountSummary(row.remaining, row.limit),
    progressPercent: row.progressPercent,
    subtle: row.subtle,
  })) || [];

  useEffect(() => {
    if (!selectedOrgID && resolvedOrgID) {
      setSelectedOrgID(resolvedOrgID);
      return;
    }
    if (!selectedOrgID) {
      return;
    }
    if (!organizations.some((item) => item.id === selectedOrgID)) {
      setSelectedOrgID(resolvedOrgID);
    }
  }, [organizations, resolvedOrgID, selectedOrgID]);

  const titleSuffix = organizations.length > 1 ? (
    <QuotaOrganizationPicker
      organizations={organizations}
      selectedOrgID={resolvedOrgID}
      onSelectOrg={setSelectedOrgID}
    />
  ) : (
    <ProviderCardTitleSuffix labels={selectedOrg?.label ? [`Org: ${selectedOrg.label}`] : []} />
  );

  return (
    <ProviderQuotaCard
      loading={isLoading}
      error={observabilityError}
      rows={rows}
      status={status}
      updatedAtLabel={summary?.updatedAtLabel}
      updatedAtTimestamp={summary?.updatedAtTimestamp}
      titleSuffix={titleSuffix}
    />
  );
}

function QuotaOrganizationPicker({
  organizations,
  selectedOrgID,
  onSelectOrg,
}: {
  organizations: ReturnType<typeof listCerebrasQuotaOrganizations>;
  selectedOrgID: string;
  onSelectOrg: (orgID: string) => void;
}) {
  return (
    <Box
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <Flex align="center" gap="2">
        <SoftBadge color="gray" label="Org" />
        <InlineSelect
          value={selectedOrgID}
          ariaLabel="Cerebras organization"
          items={organizations.map((item) => ({ value: item.id, label: item.label }))}
          onValueChange={onSelectOrg}
        />
      </Flex>
    </Box>
  );
}

function resolveSelectedOrganizationID(
  organizations: ReturnType<typeof listCerebrasQuotaOrganizations>,
  selectedOrgID: string,
) {
  const normalizedSelectedOrgID = selectedOrgID.trim();
  if (normalizedSelectedOrgID && organizations.some((item) => item.id === normalizedSelectedOrgID)) {
    return normalizedSelectedOrgID;
  }
  return organizations[0]?.id || "";
}
