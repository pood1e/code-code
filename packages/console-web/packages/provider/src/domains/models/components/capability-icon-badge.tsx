import { ModelCapability } from "@code-code/agent-contract/model/v1";
import type { ReactNode } from "react";
import { ImageInputIcon, SoftBadge, StreamingIcon, StructuredOutputIcon, ToolCallingIcon } from "@code-code/console-web-ui";
type IconBadgeProps = {
  children: ReactNode;
  color: "amber" | "blue" | "purple" | "teal";
  label: string;
};

export function CapabilityBadge({ capability }: { capability: ModelCapability }) {
  switch (capability) {
    case ModelCapability.TOOL_CALLING:
      return <IconBadge color="blue" label="Tool calling"><ToolCallingIcon /></IconBadge>;
    case ModelCapability.STRUCTURED_OUTPUT:
      return <IconBadge color="teal" label="Structured output"><StructuredOutputIcon /></IconBadge>;
    case ModelCapability.IMAGE_INPUT:
      return <IconBadge color="purple" label="Image input"><ImageInputIcon /></IconBadge>;
    case ModelCapability.STREAMING:
      return <IconBadge color="amber" label="Streaming"><StreamingIcon /></IconBadge>;
    default:
      return null;
  }
}

function IconBadge({ children, color, label }: IconBadgeProps) {
  return (
    <SoftBadge ariaLabel={label} color={color} title={label} label={children} />
  );
}
