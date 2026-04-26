import { ProviderQuotaCard } from "./provider-quota-card";
import { ProviderCardTitleSuffix } from "./provider-card-title-suffix";
import { readGoogleAIStudioQuotaSummary } from "./provider-card-google-summary";
import type { ProviderCardRendererContext } from "../provider-card-registry";

type Props = ProviderCardRendererContext;

export function ProviderCardGoogle({ observability, observabilityError, isLoading, status }: Props) {
  const summary = readGoogleAIStudioQuotaSummary(observability, new Date());
  return (
    <ProviderQuotaCard
      loading={isLoading}
      error={observabilityError}
      rows={summary?.rows || []}
      status={status}
      updatedAtLabel={summary?.updatedAtLabel}
      updatedAtTimestamp={summary?.updatedAtTimestamp}
      titleSuffix={<ProviderCardTitleSuffix tierLabel={summary?.tierLabel} />}
    />
  );
}
