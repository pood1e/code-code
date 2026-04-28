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
    case ModelCapability.REASONING:
      return <SoftBadge color="violet" label="Reasoning" size="1" />;
    case ModelCapability.BATCH:
      return <SoftBadge color="brown" label="Batch" size="1" />;
    case ModelCapability.FINE_TUNE:
      return <SoftBadge color="bronze" label="Fine-tune" size="1" />;
    case ModelCapability.EMBEDDING:
      return <SoftBadge color="cyan" label="Embedding" size="1" />;
    case ModelCapability.RERANK:
      return <SoftBadge color="indigo" label="Rerank" size="1" />;
    case ModelCapability.JSON_MODE:
      return <SoftBadge color="teal" label="JSON Mode" size="1" />;
    case ModelCapability.JSON_SCHEMA:
      return <SoftBadge color="teal" label="JSON Schema" size="1" />;
    case ModelCapability.AUDIO_INPUT:
      return <SoftBadge color="orange" label="Audio In" size="1" />;
    case ModelCapability.AUDIO_OUTPUT:
      return <SoftBadge color="orange" label="Audio Out" size="1" />;
    case ModelCapability.VIDEO_INPUT:
      return <SoftBadge color="crimson" label="Video In" size="1" />;
    default:
      return null;
  }
}

function IconBadge({ children, color, label }: IconBadgeProps) {
  return (
    <SoftBadge ariaLabel={label} color={color} title={label} label={children} />
  );
}
