import type { ModelDefinition } from "@code-code/agent-contract/model/v1";
import {
  formatCapability,
  formatModality,
  formatShape
} from "./model-detail-formatters";
import { ModelDetailBadges, ModelDetailRow, ModelDetailsSection, ModelDetailText } from "./model-details-section";

type ModelDetailsRuntimeProps = {
  model: ModelDefinition;
};

export function ModelDetailsRuntime({ model }: ModelDetailsRuntimeProps) {
  return (
    <ModelDetailsSection title="Runtime">
      <ModelDetailRow label="Capabilities">
        <ModelDetailBadges values={model.capabilities.map(formatCapability)} />
      </ModelDetailRow>
      <ModelDetailRow label="Primary shape">
        <ModelDetailText>{formatShape(model.primaryShape)}</ModelDetailText>
      </ModelDetailRow>
      <ModelDetailRow label="Supported shapes">
        <ModelDetailBadges values={model.supportedShapes.map(formatShape)} />
      </ModelDetailRow>
      <ModelDetailRow label="Input modalities">
        <ModelDetailBadges values={model.inputModalities.map(formatModality)} />
      </ModelDetailRow>
      <ModelDetailRow label="Output modalities">
        <ModelDetailBadges values={model.outputModalities.map(formatModality)} />
      </ModelDetailRow>
    </ModelDetailsSection>
  );
}
