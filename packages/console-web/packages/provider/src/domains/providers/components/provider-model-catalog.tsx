import type { ProviderModelCatalog } from "@code-code/agent-contract/provider/v1";
import { Flex } from "@radix-ui/themes";
import { NoDataCallout, SoftBadge } from "@code-code/console-web-ui";
import { describeProviderModelCatalogEntry } from "../provider-surface-binding-model-presentation";

type Props = {
  catalog?: ProviderModelCatalog;
};

export function ProviderModelCatalogBadges({ catalog }: Props) {
  if (!catalog) {
    return null;
  }

  const models = catalog.models ?? [];
  if (!models.length) {
    return <NoDataCallout size="1">No provider models.</NoDataCallout>;
  }

  return (
    <Flex wrap="wrap" gap="2">
      {models.map((model) => {
        const presentation = describeProviderModelCatalogEntry(model);
        return (
          <SoftBadge
            key={presentation.key}
            color="gray"
            size="1"
            title={presentation.detail || undefined}
            label={presentation.label}
          />
        );
      })}
    </Flex>
  );
}
