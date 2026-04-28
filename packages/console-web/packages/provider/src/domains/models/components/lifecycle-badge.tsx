import { ModelLifecycleStatus } from "@code-code/agent-contract/model/v1";
import { SoftBadge } from "@code-code/console-web-ui";
import { formatLifecycleStatus, lifecycleStatusColor } from "./model-detail-formatters";

type LifecycleBadgeProps = {
  status: ModelLifecycleStatus;
};

export function LifecycleBadge({ status }: LifecycleBadgeProps) {
  // Active and unspecified are the default — no badge needed.
  if (status === ModelLifecycleStatus.ACTIVE || status === ModelLifecycleStatus.UNSPECIFIED) {
    return null;
  }
  const highContrast = status === ModelLifecycleStatus.BLOCKED;
  return (
    <SoftBadge
      color={lifecycleStatusColor(status)}
      highContrast={highContrast}
      label={formatLifecycleStatus(status)}
      size="1"
    />
  );
}
