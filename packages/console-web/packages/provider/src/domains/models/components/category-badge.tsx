import { ModelCategory } from "@code-code/agent-contract/model/v1";
import { SoftBadge } from "@code-code/console-web-ui";
import { formatCategory } from "./model-detail-formatters";

type CategoryBadgeProps = {
  category: ModelCategory;
};

export function CategoryBadge({ category }: CategoryBadgeProps) {
  if (category === ModelCategory.UNSPECIFIED) {
    return null;
  }
  return <SoftBadge color="iris" label={formatCategory(category)} size="1" />;
}
